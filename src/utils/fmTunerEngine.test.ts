import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyFmMagneticSnap,
  clampFmFrequency,
  evaluateFmTunerSignal,
  FM_STUDIO_FREQUENCY,
  FM_TUNER_MAX_FREQ,
  FM_TUNER_MIN_FREQ,
  FM_TUNER_STATIONS,
  formatFmFrequency,
  frequencyToRatio,
  ratioToFrequency,
  stepFmTunerDrag,
  stepFmTunerInertia,
  computeStudioMagneticField,
  type FmFlywheelState,
} from './fmTunerEngine';

test('FM tuner clamping, formatting, and ratio <-> frequency conversion', () => {
  assert.equal(clampFmFrequency(80), FM_TUNER_MIN_FREQ);
  assert.equal(clampFmFrequency(120), FM_TUNER_MAX_FREQ);
  assert.equal(clampFmFrequency(104.24), 104.2);
  assert.equal(formatFmFrequency(88), '88.0');
  assert.equal(formatFmFrequency(104.2), '104.2');

  assert.equal(frequencyToRatio(88.0), 0);
  assert.equal(frequencyToRatio(108.0), 1);
  assert.equal(ratioToFrequency(0), 88.0);
  assert.equal(ratioToFrequency(1), 108.0);
  assert.equal(ratioToFrequency(0.5), 98.0);
});

test('FM tuner magnetic snap pulls cleanly to 104.2 FM studio frequency', () => {
  // Within drag magnet radius (<= 0.35)
  assert.equal(applyFmMagneticSnap(104.0, 'drag'), FM_STUDIO_FREQUENCY);
  assert.equal(applyFmMagneticSnap(104.5, 'drag'), FM_STUDIO_FREQUENCY);
  // Outside drag magnet radius
  assert.equal(applyFmMagneticSnap(103.6, 'drag'), 103.6);

  // Within release/commit magnet radius (<= 0.65)
  assert.equal(applyFmMagneticSnap(103.7, 'commit'), FM_STUDIO_FREQUENCY);
  assert.equal(applyFmMagneticSnap(104.8, 'commit'), FM_STUDIO_FREQUENCY);

  // Alien noise presets snap softly on commit, not blocking distant manual scroll
  assert.equal(applyFmMagneticSnap(90.5, 'commit'), 90.4);
  assert.equal(applyFmMagneticSnap(95.1, 'commit'), 95.2);
  assert.equal(applyFmMagneticSnap(99.7, 'commit'), 99.6);
  assert.equal(applyFmMagneticSnap(92.3, 'commit'), 92.3);
});

test('FM tuner signal clarity & presets behave deterministically', () => {
  assert.equal(FM_TUNER_STATIONS.length, 4);
  assert.deepEqual(
    FM_TUNER_STATIONS.map((s) => s.frequency),
    [90.4, 95.2, 99.6, 104.2]
  );

  const locked = evaluateFmTunerSignal(104.2);
  assert.equal(locked.isLockedOnStudio, true);
  assert.equal(locked.studioClarity, 1);
  assert.equal(locked.interferenceLevel, 0);
  assert.equal(locked.signalBars, 8);
  assert.equal(locked.matchedStation?.id, 'fmworks_studio');
  assert.equal(locked.statusText, 'STEREO • ON AIR');

  // Keyboard step mode escapes magnetic traps on 104.2 and preset stations
  assert.equal(applyFmMagneticSnap(104.0, 'step'), 104.0);
  assert.equal(applyFmMagneticSnap(90.6, 'step'), 90.6);

  const alien = evaluateFmTunerSignal(90.4);
  assert.equal(alien.isLockedOnStudio, false);
  assert.equal(alien.matchedStation?.id, 'noise_flow');
  assert.ok(alien.interferenceLevel > 0.6);
  assert.equal(alien.signalBars, 4);
  assert.equal(alien.statusText, 'СЛАБЫЙ ОТКЛИК • ФОНОВЫЙ ШУМ');

  const noiseOffsets = FM_TUNER_STATIONS.filter((s) => s.kind === 'noise').map(
    (s) => s.clutterSampleSec
  );
  assert.equal(new Set(noiseOffsets).size, 3);
});

test('FM flywheel drag applies tactile magnetic resistance near 104.2 FM and releases cleanly', () => {
  assert.equal(computeStudioMagneticField(104.2), 1);
  assert.equal(computeStudioMagneticField(100.0), 0);

  // Pulling away slightly from 104.2 (cursor at 104.55) meets strong magnetic resistance
  const resistStep = stepFmTunerDrag({
    currentFreq: 104.2,
    cursorFreq: 104.55,
    dtSec: 0.016,
  });
  assert.equal(resistStep.isResistingBreakaway, true);
  assert.ok(resistStep.nextFreq > 104.2 && resistStep.nextFreq < 104.32);
  assert.ok(resistStep.magneticPull > 0.7);

  // Pulling strongly past breakaway rim overcomes detent cleanly
  const breakawayStep = stepFmTunerDrag({
    currentFreq: 104.2,
    cursorFreq: 106.0,
    dtSec: 0.016,
  });
  assert.ok(breakawayStep.nextFreq > 104.6);
});

test('FM flywheel inertia smoothly decelerates on release and magnetically captures 104.2 FM', () => {
  // 1. Free coasting around 93.0 MHz decays monotonically and settles
  let state: FmFlywheelState = {
    frequency: 93.0,
    velocity: 6.5,
    magneticPull: 0,
    activeSpringTarget: null,
    settled: false,
  };
  const initialFreq = state.frequency;
  for (let i = 0; i < 80; i++) {
    state = stepFmTunerInertia(state, 0.016);
    if (state.settled) break;
  }
  assert.equal(state.settled, true);
  assert.equal(state.velocity, 0);
  assert.ok(state.frequency > initialFreq + 0.6 && state.frequency < 95.5);

  // 2. Coasting gently into the 104.2 FM magnetic well settles directly onto 104.2 FM
  let magnetState: FmFlywheelState = {
    frequency: 103.55,
    velocity: 1.4,
    magneticPull: 0.2,
    activeSpringTarget: null,
    settled: false,
  };
  for (let i = 0; i < 120; i++) {
    magnetState = stepFmTunerInertia(magnetState, 0.016);
    if (magnetState.settled) break;
  }
  assert.equal(magnetState.settled, true);
  assert.equal(magnetState.frequency, FM_STUDIO_FREQUENCY);
});

