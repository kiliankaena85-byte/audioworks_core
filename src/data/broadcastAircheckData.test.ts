import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  AIRCHECK_AUDIO_URLS,
  analyzeUploadedSpotSamples,
  buildAircheckAuditBriefSummary,
  buildBroadcastTimelineSegments,
  buildWaveformPhaseMarkers,
  getCompetitorsAfterTargetCount,
  getTotalBroadcastDurationSec,
  getWaitBeforeTargetSpotSec,
  resolveActiveBroadcastSegmentAtTime,
  VERIFIED_LIVE_REGIONAL_STATIONS,
} from './broadcastAircheckData';
import { BANNED_EDITORIAL_TERMS } from './studioCmsTypes';

test('Полный эфирный блок длится 120–150 сек: долгий эфир -> рекламная склейка -> конкурент №1 -> целевой ролик -> ещё 3 конкурента -> возврат в эфир', () => {
  const segments = buildBroadcastTimelineSegments({
    sourceMode: 'captured_regional_host',
    spotMode: 'fmworks_example',
  });

  assert.equal(segments.length, 8);
  assert.deepEqual(
    segments.map((s) => s.id),
    [
      'program_leadin',
      'ad_jingle_in',
      'competitor_before_1',
      'target_spot',
      'competitor_after_1',
      'competitor_after_2',
      'competitor_after_3',
      'program_return',
    ]
  );

  // Долгий живой эфир до рекламной паузы (45–60 сек)
  assert.ok(
    segments[0].durationSec >= 45 && segments[0].durationSec <= 62,
    `Ожидался долгий эфир 45–62 сек, получено ${segments[0].durationSec}`
  );

  // До выхода целевого ролика проходит больше минуты эфира + склейка + первый конкурент
  const waitSec = getWaitBeforeTargetSpotSec(segments);
  assert.ok(waitSec >= 60, `До целевого слота должно быть >= 60 сек, получено ${waitSec}`);

  // После целевого ролика идут 3 разных ролика конкурентов подряд, затем возврат в эфир
  assert.equal(getCompetitorsAfterTargetCount(segments), 3);

  const total = getTotalBroadcastDurationSec(segments);
  assert.ok(
    total >= 120 && total <= 155,
    `Полный хронометраж блока должен быть в окне 120–155 сек, получено ${total}`
  );

  const atHost = resolveActiveBroadcastSegmentAtTime(segments, 18.0);
  assert.equal(atHost.segment.id, 'program_leadin');

  const atSplice = resolveActiveBroadcastSegmentAtTime(
    segments,
    segments[1].startSec + 1.0
  );
  assert.equal(atSplice.segment.id, 'ad_jingle_in');

  const atBefore = resolveActiveBroadcastSegmentAtTime(
    segments,
    segments[2].startSec + 3.0
  );
  assert.equal(atBefore.segment.id, 'competitor_before_1');

  const atTarget = resolveActiveBroadcastSegmentAtTime(
    segments,
    segments[3].startSec + 4.0
  );
  assert.equal(atTarget.segment.id, 'target_spot');
  assert.equal(atTarget.segment.isTargetSlot, true);

  const atAfter2 = resolveActiveBroadcastSegmentAtTime(
    segments,
    segments[5].startSec + 2.0
  );
  assert.equal(atAfter2.segment.id, 'competitor_after_2');

  const atReturn = resolveActiveBroadcastSegmentAtTime(
    segments,
    segments[7].startSec + 3.0
  );
  assert.equal(atReturn.segment.id, 'program_return');
});

test('Кликабельные метки фаз на звуковой волне пропорциональны времени и покрывают 100% шкалы', () => {
  const segments = buildBroadcastTimelineSegments({
    sourceMode: 'captured_story_program',
    spotMode: 'client_upload',
    clientSpotName: 'spot_klinika_20s.mp3',
    clientSpotDurationSec: 20.4,
  });

  const targetSeg = segments.find((s) => s.id === 'target_spot');
  assert.ok(targetSeg);
  assert.equal(targetSeg.durationSec, 20.4);
  assert.ok(targetSeg.title.includes('spot_klinika_20s.mp3'));

  const markers = buildWaveformPhaseMarkers(segments, 'competitor_after_2', 'client_upload');
  assert.equal(markers.length, 6);
  assert.equal(markers[3].id, 'phase_target');
  assert.equal(markers[3].isTarget, true);
  assert.equal(markers[3].label, 'Ваш ролик');

  // При проигрывании второго конкурента после клиента подсвечивается объединённый этап «Ещё 3 конкурента»
  assert.equal(markers[4].id, 'phase_after_pack');
  assert.equal(markers[4].isActive, true);

  const sumPct = markers.reduce((acc, m) => acc + m.widthPercent, 0);
  assert.ok(Math.abs(sumPct - 100) < 0.25, `Сумма ширин меток ${sumPct}% должна быть ~100%`);
});

test('Анализатор двойного стыка проверяет и вход после конкурента №1, и концовку перед 3 конкурентами', () => {
  const sampleRate = 8000;
  // 1) Плотная постоянная скороговорка 17.6 сек от первой до последней миллисекунды
  const flatLen = Math.floor(sampleRate * 17.6);
  const flatSamples = new Float32Array(flatLen);
  for (let i = 0; i < flatLen; i += 1) {
    flatSamples[i] = i % 2 === 0 ? 0.14 : -0.14;
  }

  const flatDiag = analyzeUploadedSpotSamples({
    fileName: 'flat_cliche_17s.wav',
    samples: flatSamples,
    sampleRate,
  });

  assert.equal(flatDiag.timingVerdict, 'non_standard_length');
  assert.equal(flatDiag.nearestStandardSec, 20);
  assert.equal(flatDiag.introContrastVerdict, 'merges_with_stream');
  assert.equal(flatDiag.outroRetentionVerdict, 'crowded_ending');

  // 2) Срежиссированный ролик 15.0 сек со стартовой паузой 0.45 сек и чистой точкой в финале
  const crispLen = sampleRate * 15;
  const crispSamples = new Float32Array(crispLen);
  for (
    let i = Math.floor(sampleRate * 0.48);
    i < crispLen - Math.floor(sampleRate * 0.42);
    i += 1
  ) {
    const env = Math.sin((i / sampleRate) * Math.PI * 2.5) > 0.2 ? 0.42 : 0.03;
    crispSamples[i] = Math.sin((2 * Math.PI * 220 * i) / sampleRate) * env;
  }

  const crispDiag = analyzeUploadedSpotSamples({
    fileName: 'fmworks_style_15s.wav',
    samples: crispSamples,
    sampleRate,
  });

  assert.equal(crispDiag.timingVerdict, 'exact_grid');
  assert.equal(crispDiag.nearestStandardSec, 15);
  assert.equal(crispDiag.introContrastVerdict, 'strong_contrast');
  assert.equal(crispDiag.outroRetentionVerdict, 'clean_packshot');

  const brief = buildAircheckAuditBriefSummary({
    clientName: 'Алексей, клиника ВераМед',
    sourceMode: 'captured_regional_host',
    diagnostic: crispDiag,
  });
  assert.ok(brief.includes('fmworks_style_15s.wav'));
  assert.ok(brief.includes('Алексей'));
});

test('Тексты эфирного модуля и компонента полосы не содержат запрещённых редакционных слов', () => {
  assert.ok(VERIFIED_LIVE_REGIONAL_STATIONS.length >= 3);
  assert.ok(AIRCHECK_AUDIO_URLS.regionalHostLeadin.endsWith('.mp3'));

  const benchSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/RealRadioBroadcastBench.tsx'),
    'utf8'
  );

  const userFacingCopy = (
    JSON.stringify({
      stations: VERIFIED_LIVE_REGIONAL_STATIONS.map((s) => ({
        title: s.title,
        frequencyBadge: s.frequencyBadge,
        formatSummary: s.formatSummary,
      })),
      timelineA: buildBroadcastTimelineSegments({
        sourceMode: 'captured_regional_host',
        spotMode: 'fmworks_example',
      }),
      timelineB: buildBroadcastTimelineSegments({
        sourceMode: 'captured_story_program',
        spotMode: 'typical_cliche',
      }),
    }) +
    '\n' +
    benchSource
  ).toLowerCase();

  const violations = BANNED_EDITORIAL_TERMS.filter((term) =>
    userFacingCopy.includes(term)
  );
  assert.deepEqual(
    violations,
    [],
    `Найдены запрещённые слова в эфирном модуле: ${violations.join(', ')}`
  );
});

test('Премиальная акустическая огибающая строит гладкие кривые Безье и сегментированный рельеф эфирного блока', async () => {
  const {
    buildSmoothAcousticRibbonPaths,
    computeSegmentedBroadcastContour,
    computeStudioStemContour,
    interpolateActiveSpectrumContour,
  } = await import('../components/PremiumAcousticWaveform');

  const baseA = computeStudioStemContour('zerno-i-svet');
  const baseB = computeStudioStemContour('business-estate');
  assert.equal(baseA.length, 92);
  assert.notDeepEqual(baseA, baseB);
  assert.ok(baseA.every((v) => v >= 0.08 && v <= 0.96));

  const segContour = computeSegmentedBroadcastContour(
    'aircheck-2m16s',
    [
      { id: 'p', startRatio: 0, endRatio: 0.38, kind: 'program' },
      { id: 's', startRatio: 0.38, endRatio: 0.41, kind: 'splice' },
      { id: 'c1', startRatio: 0.41, endRatio: 0.51, kind: 'competitor' },
      { id: 't', startRatio: 0.51, endRatio: 0.62, kind: 'target' },
      { id: 'c2', startRatio: 0.62, endRatio: 0.9, kind: 'competitor' },
      { id: 'r', startRatio: 0.9, endRatio: 1, kind: 'program' },
    ],
    128
  );
  assert.equal(segContour.length, 128);
  assert.ok(segContour.every((v) => v >= 0.08 && v <= 0.97));

  const liveBands = Array.from({ length: 32 }, (_, idx) =>
    0.25 + 0.55 * Math.sin((idx / 31) * Math.PI)
  );
  const activeContour = interpolateActiveSpectrumContour(baseA, liveBands, true, false);
  assert.equal(activeContour.length, 92);

  const ribbon = buildSmoothAcousticRibbonPaths(activeContour);
  assert.ok(ribbon.upperCrestPath.includes(' C '));
  assert.ok(ribbon.lowerCrestPath.includes(' C '));
  assert.ok(ribbon.closedAreaPath.endsWith(' Z'));
  assert.equal(ribbon.filaments.length, 92);
});
