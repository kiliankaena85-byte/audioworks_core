import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeHeroVisualOptics,
  computeUnifiedSeekTargets,
  resolveClutterLoopBounds,
  shapeOscilloscopeSamplesForPole,
  wrapClutterPlaybackTime,
} from './heroAbComparison';

test('resolveClutterLoopBounds keeps builtin stream strictly before 6.1s FMWorks entry', () => {
  const bounds = resolveClutterLoopBounds({
    isCustomUpload: false,
    configuredStartSec: 1.6,
    configuredDurationSec: 8.0,
  });

  assert.equal(bounds.startSec, 1.6);
  assert.ok(bounds.endSec <= 5.75, `Expected endSec <= 5.75, got ${bounds.endSec}`);
  assert.ok(bounds.spanSec >= 1.8);
});

test('resolveClutterLoopBounds respects custom uploaded clutter media duration', () => {
  const bounds = resolveClutterLoopBounds({
    isCustomUpload: true,
    configuredStartSec: 0,
    configuredDurationSec: 12,
    mediaDurationSec: 9.5,
  });

  assert.equal(bounds.startSec, 0);
  assert.equal(bounds.endSec, 9.5);
  assert.equal(bounds.spanSec, 9.5);
});

test('wrapClutterPlaybackTime rewinds when cursor reaches loop end or precedes loop start', () => {
  const bounds = { startSec: 1.2, endSec: 5.2, spanSec: 4.0 };

  assert.deepEqual(wrapClutterPlaybackTime(3.1, bounds), {
    shouldSeek: false,
    targetTimeSec: 3.1,
  });

  assert.deepEqual(wrapClutterPlaybackTime(5.18, bounds), {
    shouldSeek: true,
    targetTimeSec: 1.2,
  });

  assert.deepEqual(wrapClutterPlaybackTime(0.4, bounds), {
    shouldSeek: true,
    targetTimeSec: 1.2,
  });
});

test('computeUnifiedSeekTargets maps timeline ratio to both studio and clutter streams without resetting', () => {
  const bounds = { startSec: 1.0, endSec: 5.0, spanSec: 4.0 };
  const res = computeUnifiedSeekTargets({
    ratio: 0.5,
    studioStartSec: 6.1,
    studioDurationSec: 20,
    clutterBounds: bounds,
  });

  assert.equal(res.clampedRatio, 0.5);
  assert.equal(res.studioElapsedSec, 10);
  assert.equal(res.studioTargetTimeSec, 16.1);
  // 10 % 4.0 = 2.0 -> 1.0 + 2.0 = 3.0
  assert.equal(res.clutterTargetTimeSec, 3.0);
});

test('shapeOscilloscopeSamplesForPole compresses clutter peaks vs dynamic studio range', () => {
  const raw = new Float32Array(32);
  for (let i = 0; i < raw.length; i++) {
    raw[i] = Math.sin((i / raw.length) * Math.PI * 2) * 0.85;
  }

  const studioWave = shapeOscilloscopeSamplesForPole({
    rawSamples: raw,
    pole: 'studio',
    isPlaying: true,
    roadNoiseEnabled: false,
    timeSec: 1.0,
  });
  const clutterWave = shapeOscilloscopeSamplesForPole({
    rawSamples: raw,
    pole: 'clutter',
    isPlaying: true,
    roadNoiseEnabled: false,
    timeSec: 1.0,
  });

  const studioPeak = Math.max(...Array.from(studioWave, Math.abs));
  const clutterPeak = Math.max(...Array.from(clutterWave, Math.abs));

  assert.ok(
    studioPeak > clutterPeak * 1.4,
    `Expected dynamic studio peak (${studioPeak}) > compressed clutter peak (${clutterPeak})`
  );
  assert.ok(clutterPeak <= 0.42);
});

test('computeHeroVisualOptics differentiates desaturated clutter from crisp full-color studio', () => {
  const clutterOptics = computeHeroVisualOptics({
    pole: 'clutter',
    isPlaying: true,
    roadNoiseEnabled: false,
  });
  const studioOptics = computeHeroVisualOptics({
    pole: 'studio',
    isPlaying: true,
    roadNoiseEnabled: false,
  });

  assert.equal(clutterOptics.showClutterStreamOverlay, true);
  assert.ok(clutterOptics.videoGrayscalePct >= 80);
  assert.ok(clutterOptics.videoBlurPx > 0);

  assert.equal(studioOptics.showClutterStreamOverlay, false);
  assert.equal(studioOptics.videoGrayscalePct, 0);
  assert.equal(studioOptics.videoBlurPx, 0);
  assert.ok(studioOptics.waveCoreRgba !== null);
});
