import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildChronometerBriefTransferText,
  CLIENT_CHRONOMETER_SAMPLES,
  evaluateClientScriptAndFz38,
} from './clientChronometerAndFz38';

test('evaluateClientScriptAndFz38 auto-detects medicine category and enforces >= 3s FZ-38 disclaimer', () => {
  const res = evaluateClientScriptAndFz38({
    text: 'Комплексная диагностика зрения в клинике СветМед за один визит. Запись 310-77-00.',
    tempo: 'calm_image',
    categorySelection: 'auto',
    targetSlotSec: 20,
  });

  assert.equal(res.isAutoDetected, true);
  assert.equal(res.resolvedCategory, 'medicine_24fz');
  assert.equal(res.disclaimerRequiredSec >= 3, true);
  assert.equal(res.categorySpec.mappedIndustryPreset, 'medicine');
  assert.ok(res.totalExactSec > res.spokenCreativeSec);
});

test('evaluateClientScriptAndFz38 detects overflow when script + realty disclaimer exceed 15s slot', () => {
  const longRealtyScript =
    'Приватный квартал бизнес-класса у соснового парка с подземным паркингом, террасами на верхних этажах и закрытой набережной. Квартиры от застройщика с ключами уже этой осенью, звоните 240-15-80 или заходите на наш сайт.';
  const res = evaluateClientScriptAndFz38({
    text: longRealtyScript,
    tempo: 'calm_image',
    categorySelection: 'auto',
    targetSlotSec: 15,
  });

  assert.equal(res.resolvedCategory, 'real_estate_214fz');
  assert.equal(res.fitStatus, 'overflow');
  assert.ok(res.recommendedSpotSec > 15);
});

test('buildChronometerBriefTransferText appends mandatory sample disclaimer when requested', () => {
  const sample = CLIENT_CHRONOMETER_SAMPLES[0]!;
  const evaluation = evaluateClientScriptAndFz38({
    text: sample.text,
    tempo: sample.tempo,
    categorySelection: sample.category,
    targetSlotSec: sample.targetSlotSec,
  });

  const transferred = buildChronometerBriefTransferText({
    scriptText: sample.text,
    evaluation,
    includeSampleDisclaimer: true,
  });

  assert.ok(transferred.includes('Речной Парк'));
  assert.ok(transferred.includes('наш.дом.рф'));
  assert.ok(transferred.includes('Расчёт хронометра:'));

  const reEvaluated = evaluateClientScriptAndFz38({
    text: transferred,
    tempo: sample.tempo,
    categorySelection: 'auto',
    targetSlotSec: sample.targetSlotSec,
  });
  assert.equal(reEvaluated.totalExactSec, evaluation.totalExactSec);
  assert.equal(reEvaluated.wordCount, evaluation.wordCount);
});
