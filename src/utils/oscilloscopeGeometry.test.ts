import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOscilloscopeCanvasPoints,
  computeWaveformSignalMetrics,
  extractSmoothedOscilloscopeSamples,
  findRisingZeroCrossingIndex,
} from './oscilloscopeGeometry';

test('computeWaveformSignalMetrics detects silence at 128 and live sine wave amplitude', () => {
  const silence = new Uint8Array(256).fill(128);
  const silentMetrics = computeWaveformSignalMetrics(silence);
  assert.equal(silentMetrics.rms, 0);
  assert.equal(silentMetrics.peak, 0);
  assert.equal(silentMetrics.hasLiveSignal, false);

  const sineBytes = new Uint8Array(256);
  for (let i = 0; i < sineBytes.length; i++) {
    sineBytes[i] = Math.round(128 + Math.sin((i / 32) * Math.PI * 2) * 90);
  }
  const liveMetrics = computeWaveformSignalMetrics(sineBytes);
  assert.equal(liveMetrics.hasLiveSignal, true);
  assert.ok(liveMetrics.rms > 0.4 && liveMetrics.rms < 0.6);
  assert.ok(liveMetrics.peak > 0.68 && liveMetrics.peak <= 1);
});

test('findRisingZeroCrossingIndex locks onto rising transition across 128', () => {
  const buf = new Uint8Array(128).fill(128);
  // Falling crossing around index 10 (should be ignored)
  buf[9] = 145;
  buf[10] = 128;
  buf[11] = 110;
  // Clean rising crossing at index 28
  buf[26] = 104;
  buf[27] = 116;
  buf[28] = 131;
  buf[29] = 148;

  const triggerIdx = findRisingZeroCrossingIndex(buf);
  assert.equal(triggerIdx, 28);
});

test('extractSmoothedOscilloscopeSamples switches cleanly between idle carrier and live AnalyserNode waveform', () => {
  const silence = new Uint8Array(512).fill(128);
  const idleFrame = extractSmoothedOscilloscopeSamples({
    timeDomainBytes: silence,
    pointCount: 64,
    timeSec: 1.5,
    isBroadcastActive: false,
    isLockedOnStudio: true,
    interferenceLevel: 0,
  });

  assert.equal(idleFrame.usingLiveAnalyser, false);
  assert.equal(idleFrame.samples.length, 64);
  // Tapered ends at 0 and 63 must equal 0
  assert.ok(Math.abs(idleFrame.samples[0]) < 1e-6);
  assert.ok(Math.abs(idleFrame.samples[63]) < 1e-6);

  const liveBuffer = new Uint8Array(512);
  for (let i = 0; i < liveBuffer.length; i++) {
    liveBuffer[i] = Math.round(128 + Math.sin((i / 48) * Math.PI * 2) * 80);
  }
  const liveFrame = extractSmoothedOscilloscopeSamples({
    timeDomainBytes: liveBuffer,
    pointCount: 64,
    timeSec: 1.5,
    isBroadcastActive: true,
    isLockedOnStudio: true,
    interferenceLevel: 0,
  });

  assert.equal(liveFrame.usingLiveAnalyser, true);
  assert.ok(liveFrame.rms > 0.35);
  const maxAbsSample = Math.max(...Array.from(liveFrame.samples, (v) => Math.abs(v)));
  assert.ok(maxAbsSample > 0.35 && maxAbsSample <= 1);
  assert.ok(Math.abs(liveFrame.samples[0]) < 1e-6);
  assert.ok(Math.abs(liveFrame.samples[63]) < 1e-6);
});

test('buildOscilloscopeCanvasPoints maps normalized samples to exact canvas width and vertical amplitude', () => {
  const samples = new Float32Array([0, 0.5, -0.5, 0]);
  const pts = buildOscilloscopeCanvasPoints(samples, 300, 200, 80);
  assert.equal(pts.length, 4);
  assert.deepEqual(pts[0], { x: 0, y: 200 });
  assert.deepEqual(pts[1], { x: 100, y: 160 });
  assert.deepEqual(pts[2], { x: 200, y: 240 });
  assert.deepEqual(pts[3], { x: 300, y: 200 });
});
