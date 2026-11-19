import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildChronometerFindingsSignature,
  computeChronometerBarScales,
  easeOutCubic,
  formatChronometerNumber,
  interpolateChronometerNumber,
} from './chronometerResultMotion';

test('easeOutCubic starts at 0, settles smoothly at 1, and decelerates cleanly', () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.equal(easeOutCubic(-0.5), 0);
  assert.equal(easeOutCubic(1.5), 1);
  assert.equal(easeOutCubic(0.5), 0.875);
});

test('interpolateChronometerNumber interpolates smoothly and respects reducedMotion', () => {
  assert.equal(
    interpolateChronometerNumber({ from: 10, to: 20, progress: 0, decimals: 1 }),
    10
  );
  assert.equal(
    interpolateChronometerNumber({ from: 10, to: 20, progress: 0.5, decimals: 1 }),
    18.8
  );
  assert.equal(
    interpolateChronometerNumber({ from: 10, to: 20, progress: 1, decimals: 1 }),
    20
  );
  // При включённом prefers-reduced-motion возвращается сразу целевое значение
  assert.equal(
    interpolateChronometerNumber({
      from: 10,
      to: 25.4,
      progress: 0.15,
      decimals: 1,
      reducedMotion: true,
    }),
    25.4
  );
  assert.equal(
    interpolateChronometerNumber({
      from: 140,
      to: 280,
      progress: 0.5,
      decimals: 0,
    }),
    263
  );
});

test('formatChronometerNumber and computeChronometerBarScales produce clean UI outputs', () => {
  assert.equal(formatChronometerNumber(12.9, 1, '~'), '~12.9');
  assert.equal(formatChronometerNumber(15.0, 1, '~'), '~15');
  assert.equal(formatChronometerNumber(210, 0), '210');

  const scales = computeChronometerBarScales({
    creativeSharePct: 66,
    disclaimerSharePct: 20,
  });
  assert.equal(scales.creativeScale, 0.66);
  assert.equal(scales.totalOccupiedScale, 0.86);
});

test('buildChronometerFindingsSignature stays stable across char-count changes and updates on mode/finding/pulse change', () => {
  const sigChars15 = buildChronometerFindingsSignature(
    {
      inputMode: 'chars',
      isEmpty: false,
      findings: [],
    },
    1
  );
  const sigChars30 = buildChronometerFindingsSignature(
    {
      inputMode: 'chars',
      isEmpty: false,
      findings: [],
    },
    1
  );
  const sigPulse2 = buildChronometerFindingsSignature(
    {
      inputMode: 'chars',
      isEmpty: false,
      findings: [],
    },
    2
  );
  const sigTextMode = buildChronometerFindingsSignature(
    {
      inputMode: 'text',
      isEmpty: false,
      findings: [],
    },
    1
  );

  assert.equal(sigChars15, sigChars30);
  assert.notEqual(sigChars15, sigPulse2);
  assert.notEqual(sigChars15, sigTextMode);
});
