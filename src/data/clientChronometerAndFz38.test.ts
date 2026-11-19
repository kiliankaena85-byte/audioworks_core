import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildChronometerBriefTransferText,
  CLIENT_CHRONOMETER_SAMPLES,
  evaluateCharacterCountChronometer,
  evaluateClientScriptAndFz38,
  getRecommendedCharRangesForTempo,
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
  assert.equal(reEvaluated.charCountWithSpaces, evaluation.charCountWithSpaces);
  assert.ok(reEvaluated.charCountWithSpaces > reEvaluated.charCountWithoutSpaces);
});

test('evaluateCharacterCountChronometer estimates audio spot duration accurately by character count, space mode, tempo and FZ-38', () => {
  const std270 = evaluateCharacterCountChronometer({
    charCount: 270,
    countMode: 'with_spaces',
    tempo: 'business_standard',
    categorySelection: 'general_b2b',
    targetSlotSec: 20,
  });
  assert.equal(std270.charCountWithSpaces, 270);
  assert.ok(std270.totalExactSec >= 19 && std270.totalExactSec <= 22);

  // 270 знаков БЕЗ пробелов читаются дольше, чем 270 знаков С пробелами
  const noSpaces270 = evaluateCharacterCountChronometer({
    charCount: 270,
    countMode: 'without_spaces',
    tempo: 'business_standard',
    categorySelection: 'general_b2b',
    targetSlotSec: 20,
  });
  assert.ok(noSpaces270.totalExactSec > std270.totalExactSec);
  assert.equal(noSpaces270.fitStatus, 'overflow');

  // Динамичный темп читается быстрее спокойного
  const calm270 = evaluateCharacterCountChronometer({
    charCount: 270,
    countMode: 'with_spaces',
    tempo: 'calm_image',
    categorySelection: 'general_b2b',
    targetSlotSec: 20,
  });
  const fast270 = evaluateCharacterCountChronometer({
    charCount: 270,
    countMode: 'with_spaces',
    tempo: 'dynamic_retail',
    categorySelection: 'general_b2b',
    targetSlotSec: 20,
  });
  assert.ok(calm270.totalExactSec > fast270.totalExactSec);

  // Медицинский дисклеймер прибавляет >= 3 сек
  const med200 = evaluateCharacterCountChronometer({
    charCount: 200,
    countMode: 'with_spaces',
    tempo: 'business_standard',
    categorySelection: 'medicine_24fz',
    targetSlotSec: 15,
  });
  assert.equal(med200.disclaimerRequiredSec, 3.5);
  assert.equal(med200.fitStatus, 'overflow');

  // Справочник ориентиров знаков по слотам строго растёт со слотом
  const ranges = getRecommendedCharRangesForTempo({
    tempo: 'business_standard',
    countMode: 'with_spaces',
    disclaimerSec: 0,
  });
  assert.equal(ranges.length, 5);
  assert.ok(ranges[0]!.maxChars < ranges[2]!.maxChars);
  assert.ok(ranges[2]!.maxChars < ranges[4]!.maxChars);
});

