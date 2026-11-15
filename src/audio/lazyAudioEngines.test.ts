import assert from 'node:assert/strict';
import test from 'node:test';
import {
  claimExclusiveAudioFocus,
  onExclusiveAudioFocusClaimed,
} from './audioFocusCoordinator';
import {
  lazyBroadcastAircheckEngine,
  lazyCasePlayerEngine,
  lazyContrastAudioEngine,
} from './lazyAudioEngines';

test('idle snapshots, subscriptions, passive syncs, and teardown do not dynamically load heavy audio engines', () => {
  assert.equal(lazyBroadcastAircheckEngine.isLoaded(), false);
  assert.equal(lazyCasePlayerEngine.isLoaded(), false);
  assert.equal(lazyContrastAudioEngine.isLoaded(), false);

  const aircheckSnap = lazyBroadcastAircheckEngine.getSnapshot();
  assert.equal(aircheckSnap.isPlaying, false);
  assert.equal(aircheckSnap.targetSlotIndex, 2);
  assert.ok(aircheckSnap.segments.length >= 6);

  const caseSnap = lazyCasePlayerEngine.getSnapshot();
  assert.equal(caseSnap.isPlaying, false);
  assert.equal(caseSnap.activeCase, null);
  assert.equal(caseSnap.spectrumBands.length, 32);

  let receivedContrastSnaps = 0;
  let lastContrastLabel: string | null = null;
  let lastClutterDuration = 0;
  const unsubContrast = lazyContrastAudioEngine.subscribe((snap) => {
    receivedContrastSnaps += 1;
    lastContrastLabel = snap.activeHeroTrackLabel;
    lastClutterDuration = snap.clutterDurationSec;
  });

  assert.equal(receivedContrastSnaps, 1);

  // Passive mount-time syncs and route-transition stops must stay zero-network / unloaded
  lazyContrastAudioEngine.syncPersonaConfig('editorial', 7);
  lazyContrastAudioEngine.syncCmsHeroStage({
    clutter: {
      mode: 'builtin_stream',
      audioUrl: '',
      fileName: null,
      startSec: 0,
      durationSec: 3.4,
      roadNoiseOnClutter: false,
    },
    stopPauseDurationSec: 1.1,
    totalIntroDurationSec: 4.5,
    focus: {
      sourceKind: 'portfolio_case',
      audioUrl: '/audio/aircheck/zerno_audioworks_15.mp3',
      label: 'Зерно — утренний спот',
      fileName: 'zerno_audioworks_15.mp3',
      startSec: 1.5,
      endSec: 16.5,
      durationSec: 15,
      linkedCaseId: 'zerno',
      activePersonaOverride: null,
    },
    isCustomized: true,
  });

  lazyBroadcastAircheckEngine.stop();
  lazyBroadcastAircheckEngine.pause();
  lazyCasePlayerEngine.stop();
  lazyCasePlayerEngine.stopPreview();
  lazyContrastAudioEngine.stopAll();
  lazyContrastAudioEngine.pauseKeepingMode();

  const bins = new Uint8Array(new ArrayBuffer(16));
  assert.equal(lazyContrastAudioEngine.readFrequencyBins(bins), false);

  unsubContrast();

  assert.equal(receivedContrastSnaps, 2);
  assert.equal(lastContrastLabel, 'Зерно — утренний спот');
  assert.equal(lastClutterDuration, 3.4);

  // Confirm zero engines were dynamically imported during passive lifecycle
  assert.equal(lazyBroadcastAircheckEngine.isLoaded(), false);
  assert.equal(lazyCasePlayerEngine.isLoaded(), false);
  assert.equal(lazyContrastAudioEngine.isLoaded(), false);
});

test('audioFocusCoordinator notifies competing channels exclusively', () => {
  const claimed: string[] = [];
  const unsub = onExclusiveAudioFocusClaimed((channel) => {
    claimed.push(channel);
  });

  claimExclusiveAudioFocus('fifteen_sec_duel');
  claimExclusiveAudioFocus('broadcast_aircheck');
  unsub();
  claimExclusiveAudioFocus('case_player');

  assert.deepEqual(claimed, ['fifteen_sec_duel', 'broadcast_aircheck']);
});

test('interacting with one lazy engine loads only that engine chunk and replays buffered state', async () => {
  assert.equal(lazyContrastAudioEngine.isLoaded(), false);
  assert.equal(lazyBroadcastAircheckEngine.isLoaded(), false);
  assert.equal(lazyCasePlayerEngine.isLoaded(), false);

  let latestVolume = lazyContrastAudioEngine.getSnapshot().volume;
  const unsub = lazyContrastAudioEngine.subscribe((snap) => {
    latestVolume = snap.volume;
  });

  lazyContrastAudioEngine.setVolume(0.42);
  await lazyContrastAudioEngine.preload();
  // Wait a microtask for `.then((engine) => engine.setVolume(0.42))`
  await Promise.resolve();

  assert.equal(lazyContrastAudioEngine.isLoaded(), true);
  assert.equal(lazyBroadcastAircheckEngine.isLoaded(), false);
  assert.equal(lazyCasePlayerEngine.isLoaded(), false);

  const loadedSnap = lazyContrastAudioEngine.getSnapshot();
  assert.equal(Math.round(loadedSnap.volume * 100), 42);
  assert.equal(Math.round(latestVolume * 100), 42);
  // Buffered CMS config from prior test replayed onto real engine
  assert.equal(loadedSnap.activeHeroTrackLabel, 'Зерно — утренний спот');
  assert.equal(loadedSnap.focusSegmentStartSec, 1.5);
  assert.equal(loadedSnap.filmDurationSec, 16.5);

  unsub();

  // Now dynamically load broadcastAircheckEngine via slot selection while casePlayerEngine stays unloaded
  lazyBroadcastAircheckEngine.setTargetSlotIndex(4);
  await lazyBroadcastAircheckEngine.preload();
  await Promise.resolve();

  assert.equal(lazyBroadcastAircheckEngine.isLoaded(), true);
  assert.equal(lazyBroadcastAircheckEngine.getSnapshot().targetSlotIndex, 4);
  assert.equal(lazyCasePlayerEngine.isLoaded(), false);

  // Finally verify casePlayerEngine dynamic preload
  await lazyCasePlayerEngine.preload();
  assert.equal(lazyCasePlayerEngine.isLoaded(), true);
  assert.equal(lazyCasePlayerEngine.getSnapshot().isPlaying, false);
});
