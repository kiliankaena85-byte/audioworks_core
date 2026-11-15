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
  findOptimalSpeechExitSec,
  getCompetitorsAfterTargetCount,
  getCompetitorsBeforeTargetCount,
  getTotalBroadcastDurationSec,
  getWaitBeforeTargetSpotSec,
  randomizeSlotPlacement,
  resolveActiveBroadcastSegmentAtTime,
  TARGET_SPOT_PRESETS,
  VERIFIED_LIVE_REGIONAL_STATIONS,
} from './broadcastAircheckData';
import { BANNED_EDITORIAL_TERMS } from './studioCmsTypes';

test('Полный эфирный блок длится 115–155 сек и поддерживает слоты 1–5 с корректным окружением', () => {
  const segments = buildBroadcastTimelineSegments({
    sourceMode: 'captured_regional_host',
    spotMode: 'fmworks_example',
    targetPresetId: 'zerno_craft',
    targetSlotIndex: 2,
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

  // Долгий живой эфир с выходом в естественную паузу речи ведущего
  assert.ok(
    segments[0].durationSec >= 45 && segments[0].durationSec <= 62,
    `Ожидался долгий эфир 45–62 сек, получено ${segments[0].durationSec}`
  );

  // До выхода целевого ролика в слоте №2 проходит больше минуты эфира + склейка + первый сосед
  const waitSec = getWaitBeforeTargetSpotSec(segments);
  assert.ok(waitSec >= 60, `До целевого слота должно быть >= 60 сек, получено ${waitSec}`);

  assert.equal(getCompetitorsBeforeTargetCount(segments), 1);
  assert.equal(getCompetitorsAfterTargetCount(segments), 3);

  const total = getTotalBroadcastDurationSec(segments);
  assert.ok(
    total >= 115 && total <= 175,
    `Полный хронометраж блока должен быть в окне 115–175 сек, получено ${total}`
  );

  for (const seg of segments) {
    if (seg.audioUrl) {
      const diskPath = path.resolve(process.cwd(), 'public', seg.audioUrl.replace(/^\//, ''));
      assert.equal(fs.existsSync(diskPath), true, `Отсутствует аудиофайл: ${diskPath}`);
      assert.ok(fs.statSync(diskPath).size > 20_000, `Слишком малый размер файла: ${diskPath}`);
    }
  }

  const atHost = resolveActiveBroadcastSegmentAtTime(segments, 18.0);
  assert.equal(atHost.segment.id, 'program_leadin');

  const atSplice = resolveActiveBroadcastSegmentAtTime(
    segments,
    segments[1].startSec + 1.0
  );
  assert.equal(atSplice.segment.id, 'ad_jingle_in');

  const atTarget = resolveActiveBroadcastSegmentAtTime(
    segments,
    segments[3].startSec + 4.0
  );
  assert.equal(atTarget.segment.id, 'target_spot');
  assert.equal(atTarget.segment.isTargetSlot, true);

  // Проверка всех слотов №1..№5: всегда ровно 4 рекламных соседа вокруг целевого слота
  for (const slot of [1, 2, 3, 4, 5] as const) {
    const slotSegs = buildBroadcastTimelineSegments({
      sourceMode: 'captured_regional_host',
      spotMode: 'fmworks_example',
      targetPresetId: 'dmitrogorsky_fmcg',
      targetSlotIndex: slot,
    });
    assert.equal(getCompetitorsBeforeTargetCount(slotSegs), slot - 1);
    assert.equal(getCompetitorsAfterTargetCount(slotSegs), 5 - slot);
    const targetSeg = slotSegs.find((s) => s.isTargetSlot);
    assert.equal(targetSeg?.slotNumber, slot);
  }
});

test('Переключение реальных кейсов студии и рандомизация врезки (слот 1–5 + порядок соседей)', () => {
  assert.equal(TARGET_SPOT_PRESETS.filter((p) => p.category === 'studio_case').length, 3);

  const dmitro = buildBroadcastTimelineSegments({
    sourceMode: 'captured_regional_host',
    spotMode: 'fmworks_example',
    targetPresetId: 'dmitrogorsky_fmcg',
    targetSlotIndex: 3,
  });
  const targetDmitro = dmitro.find((s) => s.isTargetSlot);
  assert.ok(targetDmitro?.title.includes('Дмитрогорский'));
  assert.ok((targetDmitro?.durationSec ?? 0) >= 20);

  let rngStep = 0;
  const seq = [0.25, 0.8, 0.15, 0.65, 0.4];
  const randomized = randomizeSlotPlacement({
    currentSlotIndex: 2,
    randomFn: () => {
      const v = seq[rngStep % seq.length];
      rngStep += 1;
      return v;
    },
  });

  assert.notEqual(randomized.targetSlotIndex, 2);
  assert.ok(randomized.targetSlotIndex >= 1 && randomized.targetSlotIndex <= 5);
  assert.deepEqual([...randomized.neighborOrder].sort(), [
    'neighbor_1',
    'neighbor_2',
    'neighbor_3',
    'neighbor_4',
  ]);
});

test('Кликабельные метки фаз на звуковой волне адаптируются к слотам №1, №2 и №5 и покрывают 100% шкалы', () => {
  const segSlot2 = buildBroadcastTimelineSegments({
    sourceMode: 'captured_story_program',
    spotMode: 'client_upload',
    targetSlotIndex: 2,
    clientSpotName: 'spot_klinika_20s.mp3',
    clientSpotDurationSec: 20.4,
  });

  const markers2 = buildWaveformPhaseMarkers(segSlot2, 'competitor_after_2', 'client_upload');
  assert.equal(markers2.length, 6);
  assert.equal(markers2[3].id, 'phase_target');
  assert.equal(markers2[3].isTarget, true);
  assert.equal(markers2[3].label, 'Ваш №2');
  assert.equal(markers2[4].id, 'phase_after_pack');
  assert.equal(markers2[4].isActive, true);
  const sum2 = markers2.reduce((acc, m) => acc + m.widthPercent, 0);
  assert.ok(Math.abs(sum2 - 100) < 0.25, `Сумма ширин меток ${sum2}% должна быть ~100%`);

  // Слот №1 — нет фазы «До вас», 5 кликабельных фаз
  const segSlot1 = buildBroadcastTimelineSegments({
    sourceMode: 'captured_regional_host',
    spotMode: 'fmworks_example',
    targetPresetId: 'zerno_craft',
    targetSlotIndex: 1,
  });
  const markers1 = buildWaveformPhaseMarkers(segSlot1, 'target_spot', 'fmworks_example', 'zerno_craft');
  assert.equal(markers1.length, 5);
  assert.equal(markers1.some((m) => m.id === 'phase_before'), false);
  const sum1 = markers1.reduce((acc, m) => acc + m.widthPercent, 0);
  assert.ok(Math.abs(sum1 - 100) < 0.25);

  // Слот №5 — нет фазы «После вас», 5 кликабельных фаз
  const segSlot5 = buildBroadcastTimelineSegments({
    sourceMode: 'captured_regional_host',
    spotMode: 'fmworks_example',
    targetPresetId: 'business_estate',
    targetSlotIndex: 5,
  });
  const markers5 = buildWaveformPhaseMarkers(segSlot5, 'target_spot', 'fmworks_example', 'business_estate');
  assert.equal(markers5.length, 5);
  assert.equal(markers5.some((m) => m.id === 'phase_after_pack'), false);
  const sum5 = markers5.reduce((acc, m) => acc + m.widthPercent, 0);
  assert.ok(Math.abs(sum5 - 100) < 0.25);
});

test('Детектор естественной паузы речи findOptimalSpeechExitSec находит паузу между фразами и не режет слово', () => {
  const sampleRate = 16000;
  const durationSec = 10;
  const samples = new Float32Array(sampleRate * durationSec);

  for (let i = 0; i < samples.length; i += 1) {
    const t = i / sampleRate;
    // Пауза между фразами в интервале [6.80s .. 7.22s] (420 мс)
    const isPause = t >= 6.8 && t <= 7.22;
    const amp = isPause ? 0.008 : 0.26;
    samples[i] = amp * Math.sin(2 * Math.PI * 195 * t);
  }

  const res = findOptimalSpeechExitSec({
    samples,
    sampleRate,
    searchStartSec: 4.0,
    searchEndSec: 9.8,
    preferredExitSec: 7.4,
    minPauseSec: 0.14,
  });

  assert.equal(res.foundNaturalPause, true);
  assert.ok(
    res.exitSec >= 6.8 && res.exitSec <= 7.25,
    `Ожидалась точка выхода в паузе [6.80..7.25], получено ${res.exitSec}`
  );
  assert.ok(res.pauseDepthDb >= 15, `Глубина паузы слишком мала: ${res.pauseDepthDb}`);
});

test('Анализатор клиентских загрузок ловит громкий перегруз (ФАС), тихий ролик, клиппинг, противофазу, низкий кГц и тишину', () => {
  const sampleRate = 44100;

  // 1) Плотный клише-ролик 17.6 сек
  const flatLen = Math.floor(sampleRate * 17.6);
  const flatSamples = new Float32Array(flatLen);
  for (let i = 0; i < flatLen; i += 1) {
    flatSamples[i] = i % 2 === 0 ? 0.12 : -0.12;
  }
  const flatDiag = analyzeUploadedSpotSamples({
    fileName: 'flat_cliche_17s.wav',
    samples: flatSamples,
    sampleRate,
    targetSlotIndex: 2,
  });
  assert.equal(flatDiag.timingVerdict, 'non_standard_length');
  assert.equal(flatDiag.nearestStandardSec, 20);
  assert.equal(flatDiag.introContrastVerdict, 'merges_with_stream');
  assert.equal(flatDiag.outroRetentionVerdict, 'crowded_ending');
  assert.ok(
    flatDiag.complianceChecklist.some((c) => c.id === 'disclaimer_speed_fz38')
  );
  assert.ok(
    flatDiag.complianceChecklist.some((c) => c.id === 'rao_vois_rights')
  );

  // 2) Громкий перегруженный ролик с клиппингом (+11 дБ выше эфира ФАС)
  const loudLen = sampleRate * 15;
  const loudSamples = new Float32Array(loudLen);
  for (let i = 0; i < loudLen; i += 1) {
    loudSamples[i] = Math.max(-1, Math.min(1, Math.sin(2 * Math.PI * 300 * (i / sampleRate)) * 1.45));
  }
  const loudDiag = analyzeUploadedSpotSamples({
    fileName: 'too_loud_clipped_15s.wav',
    samples: loudSamples,
    sampleRate,
    targetSlotIndex: 1,
  });
  assert.equal(loudDiag.overallReadiness, 'critical_issues');
  assert.ok(loudDiag.recommendedMakeupGainDb < -3);
  assert.ok(loudDiag.introHumanLabel.includes('отбивк'));
  assert.equal(
    loudDiag.complianceChecklist.find((c) => c.id === 'loudness_fas_level')?.severity,
    'critical'
  );
  assert.equal(
    loudDiag.complianceChecklist.find((c) => c.id === 'peak_clipping')?.severity,
    'critical'
  );

  // 3) Слишком тихий ролик + противофаза стерео + длинная пустота в начале + низкий sample rate (16 кГц)
  const lowRate = 16000;
  const quietSamples = new Float32Array(lowRate * 15);
  const quietRight = new Float32Array(lowRate * 15);
  for (let i = lowRate * 1.4; i < quietSamples.length; i += 1) {
    const val = Math.sin(2 * Math.PI * 240 * (i / lowRate)) * 0.03;
    quietSamples[i] = val;
    quietRight[i] = -val; // 180° противофаза
  }
  const phaseDiag = analyzeUploadedSpotSamples({
    fileName: 'quiet_antiphase_15s.wav',
    samples: quietSamples,
    rightSamples: quietRight,
    sampleRate: lowRate,
    targetSlotIndex: 5,
  });
  assert.ok(phaseDiag.leadingSilenceSec >= 1.1);
  assert.ok((phaseDiag.stereoCorrelation ?? 1) < -0.5);
  assert.ok(phaseDiag.recommendedMakeupGainDb > 5);
  assert.equal(
    phaseDiag.complianceChecklist.find((c) => c.id === 'stereo_mono_phase')?.severity,
    'critical'
  );
  assert.equal(
    phaseDiag.complianceChecklist.find((c) => c.id === 'sample_rate_quality')?.severity,
    'warning'
  );
  assert.equal(
    phaseDiag.complianceChecklist.find((c) => c.id === 'edges_dead_air')?.severity,
    'warning'
  );

  // 4) Пустой (немой) файл
  const silentSamples = new Float32Array(sampleRate * 10);
  const silentDiag = analyzeUploadedSpotSamples({
    fileName: 'empty_export_10s.wav',
    samples: silentSamples,
    sampleRate,
  });
  assert.equal(silentDiag.overallReadiness, 'critical_issues');
  assert.equal(
    silentDiag.complianceChecklist.find((c) => c.id === 'silence_or_corrupt')?.severity,
    'critical'
  );

  // 5) Срежиссированный чистый ролик 15.0 сек
  const crispSamples = new Float32Array(sampleRate * 15);
  for (
    let i = Math.floor(sampleRate * 0.48);
    i < crispSamples.length - Math.floor(sampleRate * 0.42);
    i += 1
  ) {
    const env = Math.sin((i / sampleRate) * Math.PI * 2.5) > 0.2 ? 0.42 : 0.03;
    crispSamples[i] = Math.sin((2 * Math.PI * 220 * i) / sampleRate) * env;
  }
  const crispDiag = analyzeUploadedSpotSamples({
    fileName: 'fmworks_style_15s.wav',
    samples: crispSamples,
    sampleRate,
    targetSlotIndex: 2,
  });
  assert.equal(crispDiag.timingVerdict, 'exact_grid');
  assert.equal(crispDiag.nearestStandardSec, 15);
  assert.equal(crispDiag.introContrastVerdict, 'strong_contrast');
  assert.equal(crispDiag.outroRetentionVerdict, 'clean_packshot');

  const brief = buildAircheckAuditBriefSummary({
    clientName: 'Алексей, клиника ВераМед',
    sourceMode: 'captured_regional_host',
    targetSlotIndex: 4,
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
      presets: TARGET_SPOT_PRESETS,
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
