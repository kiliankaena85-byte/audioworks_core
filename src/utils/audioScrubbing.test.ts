import assert from 'node:assert/strict';
import test from 'node:test';
import { casePlayerEngine } from '../audio/casePlayerEngine';
import { contrastAudioEngine } from '../audio/contrastAudioEngine';
import { BRAND_CASES } from '../data/casesData';
import {
  clampScrubRatio,
  computeTrackPointerRatio,
  OPTIMISTIC_SCRUB_HOLD_MS,
  resolveEffectiveDisplayRatio,
  shouldCommitClickAfterPointerOrTouch,
  SYNTHETIC_CLICK_SUPPRESSION_MS,
} from './audioScrubbing';

test('clampScrubRatio clamps out-of-bounds and non-finite ratios safely', () => {
  assert.equal(clampScrubRatio(-0.45), 0);
  assert.equal(clampScrubRatio(0), 0);
  assert.equal(clampScrubRatio(0.42), 0.42);
  assert.equal(clampScrubRatio(1), 1);
  assert.equal(clampScrubRatio(1.85), 1);
  assert.equal(clampScrubRatio(Number.NaN), 0);
  assert.equal(clampScrubRatio(Number.POSITIVE_INFINITY), 0);
});

test('computeTrackPointerRatio converts touch/pointer clientX into normalized 0..1 track offset', () => {
  // 300px wide mobile track starting at x=20
  assert.equal(computeTrackPointerRatio(20, 20, 300), 0);
  assert.equal(computeTrackPointerRatio(170, 20, 300), 0.5);
  assert.equal(computeTrackPointerRatio(320, 20, 300), 1);

  // Dragged past left or right edge of phone screen clamps cleanly
  assert.equal(computeTrackPointerRatio(2, 20, 300), 0);
  assert.equal(computeTrackPointerRatio(385, 20, 300), 1);

  // Guard against collapsed/hidden containers or invalid coordinates
  assert.equal(computeTrackPointerRatio(100, 20, 0), null);
  assert.equal(computeTrackPointerRatio(100, 20, 1), null);
  assert.equal(computeTrackPointerRatio(Number.NaN, 20, 300), null);
});

test('shouldCommitClickAfterPointerOrTouch suppresses duplicate mobile synthetic clicks', () => {
  const commitAt = 1000;
  const suppressUntil = commitAt + SYNTHETIC_CLICK_SUPPRESSION_MS;

  // Synthetic click arriving 40ms or 300ms after touchend/pointerup is suppressed
  assert.equal(shouldCommitClickAfterPointerOrTouch(commitAt + 40, suppressUntil), false);
  assert.equal(shouldCommitClickAfterPointerOrTouch(commitAt + 300, suppressUntil), false);
  assert.equal(shouldCommitClickAfterPointerOrTouch(suppressUntil, suppressUntil), false);

  // Subsequent deliberate tap after suppression window commits normally
  assert.equal(
    shouldCommitClickAfterPointerOrTouch(suppressUntil + 1, suppressUntil),
    true
  );
  assert.equal(OPTIMISTIC_SCRUB_HOLD_MS > 100, true);
});

test('resolveEffectiveDisplayRatio prioritizes active finger drag, then optimistic hold, then engine ratio', () => {
  // Idle playback uses engine ratio
  assert.equal(
    resolveEffectiveDisplayRatio({
      engineRatio: 0.25,
      activeScrubRatio: null,
      optimisticRatio: null,
    }),
    0.25
  );

  // Optimistic post-release hold prevents 1-frame snapback to old engineRatio
  assert.equal(
    resolveEffectiveDisplayRatio({
      engineRatio: 0.25,
      activeScrubRatio: null,
      optimisticRatio: 0.72,
    }),
    0.72
  );

  // Active finger drag overrides both optimistic and engine ratios
  assert.equal(
    resolveEffectiveDisplayRatio({
      engineRatio: 0.25,
      activeScrubRatio: 0.88,
      optimisticRatio: 0.72,
    }),
    0.88
  );
});

test('casePlayerEngine.seekToRatio cold-starts full playback at requested offset and updates in-place', () => {
  casePlayerEngine.stop();
  const sampleCase = BRAND_CASES[0];
  assert.ok(sampleCase, 'Expected at least one initial brand case');

  // Cold seek to 50% on a stopped case starts full playback at ~50% duration
  casePlayerEngine.seekToRatio(0.5, sampleCase);
  const snapAfterColdSeek = casePlayerEngine.getSnapshot();
  assert.equal(snapAfterColdSeek.isPlaying, true);
  assert.equal(snapAfterColdSeek.playbackMode, 'full');
  assert.equal(snapAfterColdSeek.activeCase?.id, sampleCase.id);
  assert.ok(
    Math.abs(snapAfterColdSeek.progress - 0.5) < 0.05,
    `Expected progress ~0.5, got ${snapAfterColdSeek.progress}`
  );

  // In-place seek to 80% updates currentTimeSec and progress without stopping
  casePlayerEngine.seekToRatio(0.8);
  const snapAfterInPlaceSeek = casePlayerEngine.getSnapshot();
  assert.equal(snapAfterInPlaceSeek.isPlaying, true);
  assert.equal(snapAfterInPlaceSeek.playbackMode, 'full');
  assert.ok(
    Math.abs(snapAfterInPlaceSeek.progress - 0.8) < 0.05,
    `Expected progress ~0.8, got ${snapAfterInPlaceSeek.progress}`
  );

  casePlayerEngine.stop();
});

test('contrastAudioEngine.seekToRatio maps [0..1] onto active focus showreel window', () => {
  contrastAudioEngine.stopAll();
  const initialSnap = contrastAudioEngine.getSnapshot();
  const span = Math.max(
    1,
    initialSnap.filmDurationSec - initialSnap.focusSegmentStartSec
  );

  contrastAudioEngine.seekToRatio(0.5);
  const midSnap = contrastAudioEngine.getSnapshot();
  const expectedSec = initialSnap.focusSegmentStartSec + 0.5 * span;

  assert.equal(midSnap.isLensExpanded, true);
  assert.equal(midSnap.crashPhase, 'audioworks');
  assert.ok(
    Math.abs(midSnap.filmElapsedSec - expectedSec) < 0.25,
    `Expected filmElapsedSec ~${expectedSec}, got ${midSnap.filmElapsedSec}`
  );

  contrastAudioEngine.stopAll();
});
