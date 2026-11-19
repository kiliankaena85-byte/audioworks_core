import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeScriptFullComplianceAndChronometer,
  buildChronometerBriefTransferText,
  buildFullReportBriefTransferText,
  CLIENT_CHRONOMETER_SAMPLES,
  evaluateCharacterCountChronometer,
  evaluateClientScriptAndFz38,
  getRecommendedCharRangesForTempo,
} from './clientChronometerAndFz38';
import {
  calculateScriptChronometer,
  expandRussianTextForVoiceover,
  numberToRussianSpokenWords,
} from './scriptChronometer';

test('numberToRussianSpokenWords and expandRussianTextForVoiceover accurately expand Russian phones, numbers, percentages, domains and abbreviations', () => {
  assert.equal(numberToRussianSpokenWords('310'), 'триста десять');
  assert.equal(numberToRussianSpokenWords('00'), 'ноль ноль');
  assert.equal(numberToRussianSpokenWords('300000'), 'триста тысяч');

  const expanded = expandRussianTextForVoiceover(
    '[Музыка: фанк]\nДиктор (уверенно): ЖК «Речной» — ипотека от 6,5% и скидка 300 000 ₽! Подробности на park.ru, тел. 310-77-00.'
  );
  assert.equal(expanded.spokenText.includes('Музыка'), false);
  assert.equal(expanded.spokenText.includes('Диктор'), false);
  assert.ok(expanded.spokenText.includes('жэ ка'));
  assert.ok(expanded.spokenText.includes('шесть с половиной процентов'));
  assert.ok(expanded.spokenText.includes('триста тысяч рублей'));
  assert.ok(expanded.spokenText.includes('park точка ру'));
  assert.ok(expanded.spokenText.includes('триста десять семьдесят семь ноль ноль'));

  // Классический ориентир радиостудий РФ: ~28–30 слов (~210–225 зн.) = ~14.5–15.0 сек; ~60 слов (~415 зн.) = ~29.5–30.0 сек
  const classic15s = calculateScriptChronometer({
    text: 'Быстрая подача корпоративного такси для ваших сотрудников в любое время суток. Фиксированные тарифы, электронный документооборот и персональный менеджер в сервисе «БизнесДрайв». Подключайтесь сегодня на сайте драйв точка ру!',
    tempo: 'business_standard',
  });
  assert.ok(
    classic15s.spokenSecondsExact >= 13.8 && classic15s.spokenSecondsExact <= 15.5,
    `Expected classic 15s spot to be ~14.5-15.2s, got ${classic15s.spokenSecondsExact}s`
  );
  assert.equal(classic15s.nearestStandardSec, 15);

  const classic30s = calculateScriptChronometer({
    text: 'Ищете надёжный складской комплекс класса А рядом с кольцевой автодорогой? Логистический парк «Северные Ворота» предлагает тёплые сухие боксы от пятисот квадратных метров с круглосуточной охраной, удобными пандусами для фур и высокоскоростным интернетом. Гибкие арендные каникулы на время переезда и прозрачный договор без скрытых платежей. Запишитесь на просмотр площадей прямо сейчас по телефону +7 (812) 450-20-10!',
    tempo: 'business_standard',
  });
  assert.ok(
    classic30s.spokenSecondsExact >= 28.0 && classic30s.spokenSecondsExact <= 31.0,
    `Expected classic 30s spot to be ~29-30.5s, got ${classic30s.spokenSecondsExact}s`
  );
});

test('evaluateClientScriptAndFz38 auto-detects medicine category and enforces >= 3s FZ-38 disclaimer without double-counting', () => {
  const res = evaluateClientScriptAndFz38({
    text: 'Комплексная диагностика зрения в клинике СветМед за один визит. Запись 310-77-00.',
    tempo: 'calm_image',
    categorySelection: 'auto',
    targetSlotSec: 20,
  });

  assert.equal(res.isAutoDetected, true);
  assert.equal(res.resolvedCategory, 'medicine_24fz');
  assert.equal(res.disclaimerRequiredSec, 3);
  assert.equal(res.categorySpec.mappedIndustryPreset, 'medicine');
  assert.ok(res.totalExactSec > res.spokenCreativeSec);

  // Если предупреждение уже написано прямо в тексте — не прибавляем повторные +3 сек сверху
  const resWithInlineDisc = evaluateClientScriptAndFz38({
    text: 'Комплексная диагностика зрения в клинике СветМед за один визит. Запись 310-77-00. Имеются противопоказания. Необходима консультация специалиста.',
    tempo: 'calm_image',
    categorySelection: 'auto',
    targetSlotSec: 20,
  });
  assert.equal(resWithInlineDisc.disclaimerRequiredSec, 0);
  assert.ok(Math.abs(resWithInlineDisc.totalExactSec - res.totalExactSec) <= 0.6);
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

test('evaluateCharacterCountChronometer matches KupiGolos/Hronomer character benchmarks across 10/15/20/30s slots', () => {
  const std210 = evaluateCharacterCountChronometer({
    charCount: 210,
    countMode: 'with_spaces',
    tempo: 'business_standard',
    categorySelection: 'general_b2b',
    targetSlotSec: 15,
  });
  assert.equal(std210.charCountWithSpaces, 210);
  assert.ok(std210.totalExactSec >= 14.3 && std210.totalExactSec <= 15.3);
  assert.equal(std210.nearestStandardSlotSec, 15);

  const std280 = evaluateCharacterCountChronometer({
    charCount: 280,
    countMode: 'with_spaces',
    tempo: 'business_standard',
    categorySelection: 'general_b2b',
    targetSlotSec: 20,
  });
  assert.ok(std280.totalExactSec >= 19.0 && std280.totalExactSec <= 20.4);
  assert.equal(std280.nearestStandardSlotSec, 20);

  // 280 знаков БЕЗ пробелов читаются дольше, чем 280 знаков С пробелами
  const noSpaces280 = evaluateCharacterCountChronometer({
    charCount: 280,
    countMode: 'without_spaces',
    tempo: 'business_standard',
    categorySelection: 'general_b2b',
    targetSlotSec: 20,
  });
  assert.ok(noSpaces280.totalExactSec > std280.totalExactSec);
  assert.equal(noSpaces280.fitStatus, 'overflow');

  // Динамичный темп читается быстрее спокойного
  const calm280 = evaluateCharacterCountChronometer({
    charCount: 280,
    countMode: 'with_spaces',
    tempo: 'calm_image',
    categorySelection: 'general_b2b',
    targetSlotSec: 20,
  });
  const fast280 = evaluateCharacterCountChronometer({
    charCount: 280,
    countMode: 'with_spaces',
    tempo: 'dynamic_retail',
    categorySelection: 'general_b2b',
    targetSlotSec: 20,
  });
  assert.ok(calm280.totalExactSec > fast280.totalExactSec);

  // Медицинский дисклеймер прибавляет ровно 3.0 сек (ч. 7 ст. 24 ФЗ-38)
  const med200 = evaluateCharacterCountChronometer({
    charCount: 200,
    countMode: 'with_spaces',
    tempo: 'business_standard',
    categorySelection: 'medicine_24fz',
    targetSlotSec: 15,
  });
  assert.equal(med200.disclaimerRequiredSec, 3);
  assert.equal(med200.fitStatus, 'overflow');

  const ranges = getRecommendedCharRangesForTempo({
    tempo: 'business_standard',
    countMode: 'with_spaces',
    disclaimerSec: 0,
  });
  assert.equal(ranges.length, 5);
  assert.ok(ranges[0]!.maxChars < ranges[2]!.maxChars);
  assert.ok(ranges[2]!.maxChars < ranges[4]!.maxChars);
});

test('analyzeScriptFullComplianceAndChronometer consolidates multiple 38-FZ disclaimers realistically (<= 4.5s) and avoids double-counting when already in text', () => {
  const complexScript =
    'ЖК «Речной Парк» — лучший дом у воды! Ипотека от 6% и скидка до 500 тысяч рублей. Подробности на park.ru, стиль Premium.';
  const report = analyzeScriptFullComplianceAndChronometer({
    inputMode: 'text',
    text: complexScript,
  });

  const codes = report.findings.map((f) => f.code);
  assert.ok(codes.includes('real_estate_214fz'), 'Should detect ЖК / 214-ФЗ');
  assert.ok(codes.includes('finance_credit_28fz'), 'Should detect ипотека / ст. 28');
  assert.ok(codes.includes('promo_stim_9fz'), 'Should detect скидка / ст. 9');
  assert.ok(
    codes.includes('superlative_comparison_5fz'),
    'Should detect превосходную степень «лучший»'
  );
  assert.ok(
    codes.includes('foreign_words_5fz'),
    'Should detect иностранное слово Premium (ignoring domain park.ru)'
  );
  assert.equal(report.hasMandatoryDisclaimers, true);
  assert.equal(report.hasModerationRisks, true);
  assert.ok(report.spokenWordCount > report.wordCount);
  // 3 обязательные сноски в ускоренной эфирной подаче объединяются и не превышают 4.5 сек (вместо нереалистичных 7.0 сек)
  assert.equal(report.legalDisclaimerSec, 4.5);
  assert.ok(report.combinedSampleDisclaimer.includes('наш.дом.рф'));
  assert.ok(report.combinedSampleDisclaimer.includes('финансовые возможности'));
  assert.ok(report.totalExactSec > report.spokenCreativeSec);

  const brief = buildFullReportBriefTransferText({
    scriptText: complexScript,
    report,
    includeSampleDisclaimer: true,
  });
  assert.ok(brief.includes('[Дисклеймер'));
  assert.ok(brief.includes('[Расчёт хронометра:'));
  assert.ok(brief.includes('проверить до записи'));

  // Сценарий, где юридическая сноска УЖЕ написана автором в конце текста -> extraSeconds = 0, severity = already_included
  const scriptWithDisclaimerIncluded =
    'Комплексная диагностика зрения и МРТ за один утренний визит без очередей. Клиника «СветМед», запись по телефону 310-77-00. Имеются противопоказания. Необходима консультация специалиста.';
  const reportIncluded = analyzeScriptFullComplianceAndChronometer({
    text: scriptWithDisclaimerIncluded,
  });
  assert.equal(reportIncluded.legalDisclaimerSec, 0);
  assert.equal(reportIncluded.hasMandatoryDisclaimers, false);
  assert.equal(
    reportIncluded.findings.find((f) => f.code === 'medicine_24fz')?.severity,
    'already_included'
  );
  assert.equal(reportIncluded.recommendedSlotSec, 15);
});

test('analyzeScriptFullComplianceAndChronometer detects medicine МРТ, БАД, distance sale, and 436-FZ age rating', () => {
  const medBadReport = analyzeScriptFullComplianceAndChronometer({
    text: 'Пройдите МРТ позвоночника за один день и попробуйте наш БАД для суставов с доставкой курьером.',
  });
  const medCodes = medBadReport.findings.map((f) => f.code);
  assert.ok(medCodes.includes('medicine_24fz'));
  assert.ok(medCodes.includes('dietary_supplement_25fz'));
  assert.ok(medCodes.includes('distance_sale_8fz'));
  assert.equal(medBadReport.mappedIndustryPreset, 'medicine');

  const eventMissingAge = analyzeScriptFullComplianceAndChronometer({
    text: 'Большой симфонический концерт в субботу в Доме музыки. Билеты в кассах города.',
  });
  assert.ok(eventMissingAge.findings.some((f) => f.code === 'age_rating_436fz'));

  const eventWithAge = analyzeScriptFullComplianceAndChronometer({
    text: 'Большой симфонический концерт в субботу в Доме музыки. Билеты в кассах города. 12+.',
  });
  assert.equal(
    eventWithAge.findings.some((f) => f.code === 'age_rating_436fz'),
    false
  );
});

test('analyzeScriptFullComplianceAndChronometer marks clean neutral script with zero disclaimers and supports char-count fallback', () => {
  const cleanReport = analyzeScriptFullComplianceAndChronometer({
    text: 'Свежая выпечка на сливочном масле и ароматный зерновой кофе каждое утро в пекарне «Тёплый Хлеб» на улице Мира. Ждём вас с восьми утра.',
  });

  assert.equal(cleanReport.isEmpty, false);
  assert.equal(cleanReport.hasMandatoryDisclaimers, false);
  assert.equal(cleanReport.hasModerationRisks, false);
  assert.equal(cleanReport.findings.length, 0);
  assert.equal(cleanReport.legalDisclaimerSec, 0);
  assert.equal(cleanReport.totalExactSec, cleanReport.spokenCreativeSec);
  assert.ok(cleanReport.totalExactSec >= 8.5 && cleanReport.totalExactSec <= 10.5);

  const charsReport210 = analyzeScriptFullComplianceAndChronometer({
    inputMode: 'chars',
    charCount: 210,
    countMode: 'with_spaces',
  });
  assert.equal(charsReport210.recommendedSlotSec, 15);

  const charsReport420 = analyzeScriptFullComplianceAndChronometer({
    inputMode: 'chars',
    charCount: 420,
    countMode: 'with_spaces',
  });
  assert.equal(charsReport420.recommendedSlotSec, 30);
});
