export type BroadcastSourceMode =
  | 'captured_regional_host'
  | 'captured_story_program'
  | 'live_regional_stream';

export type InsertedSpotMode = 'fmworks_example' | 'typical_cliche' | 'client_upload';

export interface VerifiedRegionalStationSpec {
  id: 'kp_reg_91' | 'kp_reg_972' | 'radio_kniga' | 'bfm_air';
  title: string;
  frequencyBadge: string;
  formatSummary: string;
  streamUrl: string;
  fallbackAircheckUrl: string;
}

export const AIRCHECK_AUDIO_URLS = {
  regionalHostLeadin: '/assets/aistudio/aircheck/regional_host_long_leadin.mp3',
  storyProgramLeadin: '/assets/aistudio/aircheck/story_program_long_leadin.mp3',
  adSpliceJingleIn: '/assets/aistudio/aircheck/ad_splice_jingle_in.mp3',
  competitorBefore1: '/assets/aistudio/aircheck/competitor_before_1.mp3',
  fmworksReferenceSpot: '/assets/aistudio/aircheck/fmworks_reference_spot.mp3',
  typicalClicheSpot: '/assets/aistudio/aircheck/adbreak_slot1_cliche.mp3',
  competitorAfter1: '/assets/aistudio/aircheck/competitor_after_1.mp3',
  competitorAfter2: '/assets/aistudio/aircheck/competitor_after_2.mp3',
  competitorAfter3: '/assets/aistudio/aircheck/competitor_after_3.mp3',
  broadcastReturnOutro: '/assets/aistudio/aircheck/broadcast_return_long.mp3',
} as const;

export const DEFAULT_AIRCHECK_DURATIONS_SEC = {
  regionalHostLeadin: 50.42,
  storyProgramLeadin: 52.9,
  liveLeadInWindow: 48.0,
  adSpliceJingleIn: 3.74,
  competitorBefore1: 14.73,
  fmworksReferenceSpot: 15.39,
  typicalClicheSpot: 5.67,
  competitorAfter1: 14.13,
  competitorAfter2: 15.39,
  competitorAfter3: 12.28,
  broadcastReturnOutro: 18.83,
} as const;

/**
 * Проверенные реальные потоки радиостанций (проксируются сервером через /api/radio/live-stream,
 * чтобы исключить блокировки Mixed Content и CORS в браузере).
 */
export const VERIFIED_LIVE_REGIONAL_STATIONS: readonly VerifiedRegionalStationSpec[] = [
  {
    id: 'kp_reg_91',
    title: 'Региональный разговорный эфир',
    frequencyBadge: '91.0 FM · Южный округ',
    formatSummary: 'Живые ведущие, обсуждение новостей дня и региональные рекламные блоки',
    streamUrl: 'http://kpradio.hostingradio.ru:8000/krasnodar.radiokp128.mp3',
    fallbackAircheckUrl: AIRCHECK_AUDIO_URLS.regionalHostLeadin,
  },
  {
    id: 'kp_reg_972',
    title: 'Региональная информационная волна',
    frequencyBadge: '97.2 FM · Северо-Запад',
    formatSummary: 'Региональная студия, утренние и вечерние рубрики для автомобилистов',
    streamUrl: 'https://kpradio.hostingradio.ru:8000/vologda.radiokp128.mp3',
    fallbackAircheckUrl: AIRCHECK_AUDIO_URLS.regionalHostLeadin,
  },
  {
    id: 'radio_kniga',
    title: 'Радио Книга · Истории в эфире',
    frequencyBadge: 'Разговорно-литературный формат',
    formatSummary: 'Актёрское чтение рассказов и историй с рекламными паузами между главами',
    streamUrl: 'http://bookradio.hostingradio.ru:8069/fm',
    fallbackAircheckUrl: AIRCHECK_AUDIO_URLS.storyProgramLeadin,
  },
  {
    id: 'bfm_air',
    title: 'Деловой региональный эфир',
    frequencyBadge: '106.8 FM · Деловое вещание',
    formatSummary: 'Рубрики для руководителей и автомобилистов каждые 15 минут',
    streamUrl: 'http://195.128.153.153:8005/bfm_tuner',
    fallbackAircheckUrl: AIRCHECK_AUDIO_URLS.regionalHostLeadin,
  },
] as const;

export type BroadcastSegmentId =
  | 'program_leadin'
  | 'ad_jingle_in'
  | 'competitor_before_1'
  | 'target_spot'
  | 'competitor_after_1'
  | 'competitor_after_2'
  | 'competitor_after_3'
  | 'program_return';

export type BroadcastSegmentKind = 'program' | 'splice' | 'competitor' | 'target';

export interface BroadcastTimelineSegment {
  id: BroadcastSegmentId;
  kind: BroadcastSegmentKind;
  orderIndex: number;
  shortStepLabel: string;
  compactWaveLabel: string;
  title: string;
  subtitle: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  isTargetSlot: boolean;
}

export interface WaveformPhaseMarker {
  id:
    | 'phase_program'
    | 'phase_splice'
    | 'phase_before'
    | 'phase_target'
    | 'phase_after_pack'
    | 'phase_return';
  targetSegmentId: BroadcastSegmentId;
  label: string;
  shortMobileLabel: string;
  durationLabel: string;
  startSec: number;
  endSec: number;
  widthPercent: number;
  isTarget: boolean;
  isActive: boolean;
}

export interface BuildBroadcastTimelineParams {
  sourceMode: BroadcastSourceMode;
  spotMode: InsertedSpotMode;
  clientSpotName?: string | null;
  clientSpotDurationSec?: number | null;
  liveStationTitle?: string;
  segmentDurationOverrides?: Partial<Record<BroadcastSegmentId, number>>;
}

function roundSec(val: number): number {
  return Math.round(val * 100) / 100;
}

export function buildBroadcastTimelineSegments(
  params: BuildBroadcastTimelineParams
): readonly BroadcastTimelineSegment[] {
  const ov = params.segmentDurationOverrides ?? {};

  const defaultLeadIn =
    params.sourceMode === 'captured_story_program'
      ? DEFAULT_AIRCHECK_DURATIONS_SEC.storyProgramLeadin
      : params.sourceMode === 'live_regional_stream'
        ? DEFAULT_AIRCHECK_DURATIONS_SEC.liveLeadInWindow
        : DEFAULT_AIRCHECK_DURATIONS_SEC.regionalHostLeadin;

  const leadInDur = ov.program_leadin ?? defaultLeadIn;
  const spliceInDur = ov.ad_jingle_in ?? DEFAULT_AIRCHECK_DURATIONS_SEC.adSpliceJingleIn;
  const compBeforeDur =
    ov.competitor_before_1 ?? DEFAULT_AIRCHECK_DURATIONS_SEC.competitorBefore1;

  const rawTargetDur =
    params.spotMode === 'client_upload' &&
    typeof params.clientSpotDurationSec === 'number' &&
    Number.isFinite(params.clientSpotDurationSec) &&
    params.clientSpotDurationSec > 0.5
      ? Math.min(90, Math.max(2, roundSec(params.clientSpotDurationSec)))
      : params.spotMode === 'typical_cliche'
        ? ov.target_spot ?? DEFAULT_AIRCHECK_DURATIONS_SEC.typicalClicheSpot
        : ov.target_spot ?? DEFAULT_AIRCHECK_DURATIONS_SEC.fmworksReferenceSpot;

  const compAfter1Dur =
    ov.competitor_after_1 ?? DEFAULT_AIRCHECK_DURATIONS_SEC.competitorAfter1;
  const compAfter2Dur =
    ov.competitor_after_2 ?? DEFAULT_AIRCHECK_DURATIONS_SEC.competitorAfter2;
  const compAfter3Dur =
    ov.competitor_after_3 ?? DEFAULT_AIRCHECK_DURATIONS_SEC.competitorAfter3;
  const returnDur =
    ov.program_return ?? DEFAULT_AIRCHECK_DURATIONS_SEC.broadcastReturnOutro;

  const leadInTitle =
    params.sourceMode === 'captured_story_program'
      ? 'Эфир радиопередачи: актёрское чтение истории до ухода на рекламу'
      : params.sourceMode === 'live_regional_stream'
        ? `Прямой поток: ${params.liveStationTitle || 'Региональное радио'}`
        : 'Живой региональный эфир: рубрика ведущих перед рекламным блоком';

  const leadInSubtitle =
    params.sourceMode === 'captured_story_program'
      ? 'Почти минута погружения в сюжет программы перед рекламной склейкой'
      : params.sourceMode === 'live_regional_stream'
        ? 'Реальное вещание выбранной волны перед переходом в рекламный блок'
        : 'Слушатель едет под разговор ведущих — до вашего ролика ещё больше минуты эфира';

  const targetTitle =
    params.spotMode === 'client_upload'
      ? `Ваш ролик в блоке (слот №2): ${params.clientSpotName || 'Загруженный файл'}`
      : params.spotMode === 'typical_cliche'
        ? 'Обычный шаблонный ролик (слот №2 среди 4 конкурентов)'
        : 'Эталон FMWorks «Зерно и Свет» (слот №2 среди 4 конкурентов)';

  const targetSubtitle =
    params.spotMode === 'client_upload'
      ? 'Стоит после первого конкурента, а следом идут ещё 3 чужих объявления подряд'
      : params.spotMode === 'typical_cliche'
        ? 'Сливается с соседними объявлениями до и после в единый рекламный шум'
        : 'Пауза 0.4 сек и живая сцена отделяют бренд от 4 соседних объявлений в блоке';

  const specs: Array<{
    id: BroadcastSegmentId;
    kind: BroadcastSegmentKind;
    shortStepLabel: string;
    compactWaveLabel: string;
    title: string;
    subtitle: string;
    durationSec: number;
    isTargetSlot: boolean;
  }> = [
    {
      id: 'program_leadin',
      kind: 'program',
      shortStepLabel: '01 · Живой эфир',
      compactWaveLabel: 'Эфир передачи',
      title: leadInTitle,
      subtitle: leadInSubtitle,
      durationSec: leadInDur,
      isTargetSlot: false,
    },
    {
      id: 'ad_jingle_in',
      kind: 'splice',
      shortStepLabel: '02 · Рекламная склейка',
      compactWaveLabel: 'Склейка',
      title: 'Эфирная отбивка перехода к рекламе',
      subtitle: 'Фирменный сигнал станции о начале коммерческого блока',
      durationSec: spliceInDur,
      isTargetSlot: false,
    },
    {
      id: 'competitor_before_1',
      kind: 'competitor',
      shortStepLabel: '03 · Конкурент №1',
      compactWaveLabel: 'Сосед №1',
      title: 'Рекламный блок: первый ролик конкурента перед вами',
      subtitle: 'Плотная потоковая начитка акций и скидок в начале очереди',
      durationSec: compBeforeDur,
      isTargetSlot: false,
    },
    {
      id: 'target_spot',
      kind: 'target',
      shortStepLabel:
        params.spotMode === 'client_upload'
          ? '04 · Ваш ролик (слот №2)'
          : '04 · Слот №2 (FMWorks)',
      compactWaveLabel:
        params.spotMode === 'client_upload' ? 'Ваш ролик' : 'FMWorks',
      title: targetTitle,
      subtitle: targetSubtitle,
      durationSec: rawTargetDur,
      isTargetSlot: true,
    },
    {
      id: 'competitor_after_1',
      kind: 'competitor',
      shortStepLabel: '05 · Конкурент №2 (после)',
      compactWaveLabel: 'Сосед №2',
      title: 'Сразу после вас: второй чужой ролик в блоке',
      subtitle: 'Следующий рекламодатель пытается перехватить внимание водителя',
      durationSec: compAfter1Dur,
      isTargetSlot: false,
    },
    {
      id: 'competitor_after_2',
      kind: 'competitor',
      shortStepLabel: '06 · Конкурент №3 (после)',
      compactWaveLabel: 'Сосед №3',
      title: 'Продолжение блока: третий чужой ролик подряд',
      subtitle: 'Очередное объявление усиливает информационную перегрузку в паузе',
      durationSec: compAfter2Dur,
      isTargetSlot: false,
    },
    {
      id: 'competitor_after_3',
      kind: 'competitor',
      shortStepLabel: '07 · Конкурент №4 (после)',
      compactWaveLabel: 'Сосед №4',
      title: 'Замыкающий четвёртый чужой ролик в рекламном блоке',
      subtitle: 'Финальный поток условий и телефонов перед выходом из рекламы',
      durationSec: compAfter3Dur,
      isTargetSlot: false,
    },
    {
      id: 'program_return',
      kind: 'program',
      shortStepLabel: '08 · Возврат в эфир',
      compactWaveLabel: 'Возврат',
      title: 'Выходная склейка и возврат ведущих в эфир радиостанции',
      subtitle: 'Рекламный блок окончен — станция продолжает основную передачу',
      durationSec: returnDur,
      isTargetSlot: false,
    },
  ];

  let cursor = 0;
  return specs.map((spec, idx) => {
    const startSec = roundSec(cursor);
    const endSec = roundSec(startSec + spec.durationSec);
    cursor = endSec;
    return {
      id: spec.id,
      kind: spec.kind,
      orderIndex: idx + 1,
      shortStepLabel: spec.shortStepLabel,
      compactWaveLabel: spec.compactWaveLabel,
      title: spec.title,
      subtitle: spec.subtitle,
      startSec,
      endSec,
      durationSec: spec.durationSec,
      isTargetSlot: spec.isTargetSlot,
    };
  });
}

export function getTotalBroadcastDurationSec(
  segments: readonly BroadcastTimelineSegment[]
): number {
  if (segments.length === 0) return 0;
  return segments[segments.length - 1].endSec;
}

export function getWaitBeforeTargetSpotSec(
  segments: readonly BroadcastTimelineSegment[]
): number {
  const target = segments.find((s) => s.isTargetSlot);
  return target ? target.startSec : 0;
}

export function getCompetitorsAfterTargetCount(
  segments: readonly BroadcastTimelineSegment[]
): number {
  const targetIdx = segments.findIndex((s) => s.isTargetSlot);
  if (targetIdx < 0) return 0;
  return segments.slice(targetIdx + 1).filter((s) => s.kind === 'competitor').length;
}

/**
 * Формирует 6 пропорциональных кликабельных меток этапов прямо над звуковой волной,
 * объединяя три идущих подряд ролика конкурентов после целевого слота в читаемый сегмент «Ещё 3 ролика».
 */
export function buildWaveformPhaseMarkers(
  segments: readonly BroadcastTimelineSegment[],
  activeSegmentId: BroadcastSegmentId,
  spotMode: InsertedSpotMode
): readonly WaveformPhaseMarker[] {
  const total = Math.max(1, getTotalBroadcastDurationSec(segments));
  const byId = new Map(segments.map((s) => [s.id, s]));

  const leadIn = byId.get('program_leadin');
  const splice = byId.get('ad_jingle_in');
  const before1 = byId.get('competitor_before_1');
  const target = byId.get('target_spot');
  const after1 = byId.get('competitor_after_1');
  const after2 = byId.get('competitor_after_2');
  const after3 = byId.get('competitor_after_3');
  const ret = byId.get('program_return');

  if (!leadIn || !splice || !before1 || !target || !after1 || !after3 || !ret) {
    return [];
  }

  const afterStart = after1.startSec;
  const afterEnd = after3.endSec;
  const afterDur = roundSec(afterEnd - afterStart);

  const rawGroups: Omit<WaveformPhaseMarker, 'widthPercent'>[] = [
    {
      id: 'phase_program',
      targetSegmentId: 'program_leadin',
      label: `Эфир · ${Math.round(leadIn.durationSec)}с`,
      shortMobileLabel: 'Эфир',
      durationLabel: `${Math.round(leadIn.durationSec)}с`,
      startSec: leadIn.startSec,
      endSec: leadIn.endSec,
      isTarget: false,
      isActive: activeSegmentId === 'program_leadin',
    },
    {
      id: 'phase_splice',
      targetSegmentId: 'ad_jingle_in',
      label: 'Склейка',
      shortMobileLabel: 'Склейка',
      durationLabel: `${Math.round(splice.durationSec)}с`,
      startSec: splice.startSec,
      endSec: splice.endSec,
      isTarget: false,
      isActive: activeSegmentId === 'ad_jingle_in',
    },
    {
      id: 'phase_before',
      targetSegmentId: 'competitor_before_1',
      label: 'Конкурент 1',
      shortMobileLabel: 'Сосед 1',
      durationLabel: `${Math.round(before1.durationSec)}с`,
      startSec: before1.startSec,
      endSec: before1.endSec,
      isTarget: false,
      isActive: activeSegmentId === 'competitor_before_1',
    },
    {
      id: 'phase_target',
      targetSegmentId: 'target_spot',
      label:
        spotMode === 'client_upload'
          ? 'Ваш ролик'
          : spotMode === 'typical_cliche'
            ? 'Шаблон №2'
            : 'FMWorks №2',
      shortMobileLabel: spotMode === 'client_upload' ? 'Ваш №2' : 'Слот №2',
      durationLabel: `${Math.round(target.durationSec)}с`,
      startSec: target.startSec,
      endSec: target.endSec,
      isTarget: true,
      isActive: activeSegmentId === 'target_spot',
    },
    {
      id: 'phase_after_pack',
      targetSegmentId: 'competitor_after_1',
      label: 'Ещё 3 конкурента',
      shortMobileLabel: '+3 соседа',
      durationLabel: `${Math.round(afterDur)}с`,
      startSec: afterStart,
      endSec: afterEnd,
      isTarget: false,
      isActive:
        activeSegmentId === 'competitor_after_1' ||
        activeSegmentId === (after2?.id ?? 'competitor_after_2') ||
        activeSegmentId === 'competitor_after_3',
    },
    {
      id: 'phase_return',
      targetSegmentId: 'program_return',
      label: 'Возврат в эфир',
      shortMobileLabel: 'Возврат',
      durationLabel: `${Math.round(ret.durationSec)}с`,
      startSec: ret.startSec,
      endSec: ret.endSec,
      isTarget: false,
      isActive: activeSegmentId === 'program_return',
    },
  ];

  return rawGroups.map((g) => ({
    ...g,
    widthPercent: Math.round(((g.endSec - g.startSec) / total) * 10000) / 100,
  }));
}

export function resolveActiveBroadcastSegmentAtTime(
  segments: readonly BroadcastTimelineSegment[],
  elapsedSec: number
): {
  segment: BroadcastTimelineSegment;
  segmentLocalSec: number;
  segmentProgressRatio: number;
} {
  const fallback = segments[0];
  const clamped = Math.max(0, Number.isFinite(elapsedSec) ? elapsedSec : 0);
  const found =
    segments.find((seg) => clamped >= seg.startSec && clamped < seg.endSec) ??
    segments[segments.length - 1] ??
    fallback;

  const localSec = Math.max(0, Math.min(found.durationSec, clamped - found.startSec));
  const ratio =
    found.durationSec > 0 ? Math.min(1, Math.max(0, localSec / found.durationSec)) : 0;

  return {
    segment: found,
    segmentLocalSec: roundSec(localSec),
    segmentProgressRatio: ratio,
  };
}

export type IntroHookVerdict = 'strong_contrast' | 'moderate_contrast' | 'merges_with_stream';
export type OutroRetentionVerdict = 'clean_packshot' | 'crowded_ending';
export type GridTimingVerdict = 'exact_grid' | 'non_standard_length';

export interface UploadedSpotBroadcastDiagnostic {
  fileName: string;
  durationSec: number;
  nearestStandardSec: 10 | 15 | 20 | 30;
  timingDriftSec: number;
  timingVerdict: GridTimingVerdict;
  timingHumanLabel: string;
  meanRmsDb: number;
  peakDb: number;
  loudnessDeltaVsAirDb: number;
  loudnessHumanLabel: string;
  introContrastVerdict: IntroHookVerdict;
  introHumanLabel: string;
  outroRetentionVerdict: OutroRetentionVerdict;
  outroHumanLabel: string;
  recommendationSummary: string;
}

const STANDARD_GRID_SECONDS: readonly (10 | 15 | 20 | 30)[] = [10, 15, 20, 30];
const REGIONAL_BROADCAST_REF_RMS_DB = -18.5;

/**
 * Детерминированный расчёт поведения загруженного ролика внутри полного рекламного блока:
 * оценивает шаг сетки, баланс громкости, отстройку на входе после конкурента №1
 * и сохранность финального пэкшота перед натиском 3 следующих роликов конкурентов.
 */
export function analyzeUploadedSpotSamples(params: {
  fileName: string;
  samples: Float32Array | readonly number[];
  sampleRate: number;
}): UploadedSpotBroadcastDiagnostic {
  const safeRate = Math.max(8000, Math.round(params.sampleRate || 44100));
  const totalSamples = params.samples.length;
  const durationSec = roundSec(Math.max(0.5, totalSamples / safeRate));

  let nearestStandardSec: 10 | 15 | 20 | 30 = 15;
  let minDiff = Infinity;
  for (const std of STANDARD_GRID_SECONDS) {
    const diff = Math.abs(durationSec - std);
    if (diff < minDiff) {
      minDiff = diff;
      nearestStandardSec = std;
    }
  }
  const timingDriftSec = roundSec(durationSec - nearestStandardSec);
  const timingVerdict: GridTimingVerdict =
    Math.abs(timingDriftSec) <= 0.45 ? 'exact_grid' : 'non_standard_length';

  const timingHumanLabel =
    timingVerdict === 'exact_grid'
      ? `В сетке ${nearestStandardSec} сек (${durationSec.toFixed(1)} с)`
      : `${durationSec.toFixed(1)} с (отклонение ${timingDriftSec > 0 ? '+' : ''}${timingDriftSec.toFixed(1)} с от ${nearestStandardSec} сек)`;

  let sumSq = 0;
  let peakAbs = 0;
  const stride = Math.max(1, Math.floor(totalSamples / 120_000));
  let counted = 0;

  for (let i = 0; i < totalSamples; i += stride) {
    const v = Math.abs(params.samples[i] ?? 0);
    if (v > peakAbs) peakAbs = v;
    sumSq += v * v;
    counted += 1;
  }

  const rms = counted > 0 ? Math.sqrt(sumSq / counted) : 0.0001;
  const meanRmsDb = roundDb(20 * Math.log10(Math.max(0.00003, rms)));
  const peakDb = roundDb(20 * Math.log10(Math.max(0.00003, peakAbs)));
  const loudnessDeltaVsAirDb = roundDb(meanRmsDb - REGIONAL_BROADCAST_REF_RMS_DB);

  let loudnessHumanLabel = 'В балансе с уровнем регионального эфира';
  if (loudnessDeltaVsAirDb < -3.2) {
    loudnessHumanLabel = `Тише соседей на ${Math.abs(loudnessDeltaVsAirDb).toFixed(1)} дБ — риск провалиться в дороге`;
  } else if (loudnessDeltaVsAirDb > 3.2) {
    loudnessHumanLabel = `Перегружен на +${loudnessDeltaVsAirDb.toFixed(1)} дБ — лимитер станции прижмёт разборчивость`;
  }

  // 1. Вход после первого конкурента (первые 2.4 сек)
  const firstHalfSecEnd = Math.min(totalSamples, Math.floor(safeRate * 0.42));
  const introWindowEnd = Math.min(totalSamples, Math.floor(safeRate * 2.4));

  let earlySumSq = 0;
  let earlyCount = 0;
  for (
    let i = 0;
    i < firstHalfSecEnd;
    i += Math.max(1, Math.floor(firstHalfSecEnd / 4000))
  ) {
    const v = params.samples[i] ?? 0;
    earlySumSq += v * v;
    earlyCount += 1;
  }
  const earlyRms = earlyCount > 0 ? Math.sqrt(earlySumSq / earlyCount) : rms;
  const earlyDb = 20 * Math.log10(Math.max(0.00003, earlyRms));

  let introPeak = 0;
  let introSumSq = 0;
  let introCount = 0;
  const frameLen = Math.max(64, Math.floor(safeRate * 0.12));
  let quietFrames = 0;
  let totalFrames = 0;

  for (let start = 0; start + frameLen <= introWindowEnd; start += frameLen) {
    let fSq = 0;
    for (let j = start; j < start + frameLen; j += 8) {
      const sv = Math.abs(params.samples[j] ?? 0);
      if (sv > introPeak) introPeak = sv;
      fSq += sv * sv;
      introSumSq += sv * sv;
      introCount += 1;
    }
    const fRms = Math.sqrt(fSq / Math.max(1, Math.ceil(frameLen / 8)));
    const fDb = 20 * Math.log10(Math.max(0.00003, fRms));
    totalFrames += 1;
    if (fDb < meanRmsDb - 6.5) {
      quietFrames += 1;
    }
  }

  const introRms = introCount > 0 ? Math.sqrt(introSumSq / introCount) : rms;
  const crestDb =
    20 * Math.log10(Math.max(0.0001, introPeak) / Math.max(0.0001, introRms));
  const hasAirPocketStart =
    earlyDb < meanRmsDb - 4.5 ||
    quietFrames >= Math.max(2, Math.floor(totalFrames * 0.18));

  let introContrastVerdict: IntroHookVerdict = 'moderate_contrast';
  let introHumanLabel = 'Умеренное отделение от конкурента №1';

  if (hasAirPocketStart && crestDb >= 5.2) {
    introContrastVerdict = 'strong_contrast';
    introHumanLabel = 'Чистая пауза и акцент — заметно отделяется от соседа №1';
  } else if (!hasAirPocketStart && crestDb < 5.0) {
    introContrastVerdict = 'merges_with_stream';
    introHumanLabel = 'Старт без паузы — риск слиться с предыдущим объявлением';
  }

  // 2. Выход перед тремя следующими конкурентами (последние 2.0 сек)
  const outroWindowStart = Math.max(0, totalSamples - Math.floor(safeRate * 2.0));
  const lastTailStart = Math.max(0, totalSamples - Math.floor(safeRate * 0.35));
  let tailSumSq = 0;
  let tailCount = 0;
  for (
    let i = lastTailStart;
    i < totalSamples;
    i += Math.max(1, Math.floor((totalSamples - lastTailStart) / 2500))
  ) {
    const v = params.samples[i] ?? 0;
    tailSumSq += v * v;
    tailCount += 1;
  }
  const tailRms = tailCount > 0 ? Math.sqrt(tailSumSq / tailCount) : rms;
  const tailDb = 20 * Math.log10(Math.max(0.00003, tailRms));

  let outroQuietFrames = 0;
  let outroFrames = 0;
  for (let start = outroWindowStart; start + frameLen <= totalSamples; start += frameLen) {
    let fSq = 0;
    for (let j = start; j < start + frameLen; j += 8) {
      const sv = Math.abs(params.samples[j] ?? 0);
      fSq += sv * sv;
    }
    const fRms = Math.sqrt(fSq / Math.max(1, Math.ceil(frameLen / 8)));
    const fDb = 20 * Math.log10(Math.max(0.00003, fRms));
    outroFrames += 1;
    if (fDb < meanRmsDb - 5.5) {
      outroQuietFrames += 1;
    }
  }

  const hasCleanOutroTail =
    tailDb < meanRmsDb - 4.0 ||
    outroQuietFrames >= Math.max(1, Math.floor(outroFrames * 0.16));

  const outroRetentionVerdict: OutroRetentionVerdict = hasCleanOutroTail
    ? 'clean_packshot'
    : 'crowded_ending';
  const outroHumanLabel = hasCleanOutroTail
    ? 'Финал с точкой — бренд успевает зафиксироваться до 3 следующих роликов'
    : 'Плотная скороговорка до последней доли секунды — 3 следующих ролика перебьют концовку';

  const issues: string[] = [];
  if (introContrastVerdict === 'merges_with_stream') {
    issues.push('добавить 0.4 сек стартовой отсечки после первого конкурента');
  }
  if (outroRetentionVerdict === 'crowded_ending') {
    issues.push(
      'разгрузить концовку и выделить имя бренда перед натиском 3 следующих объявлений'
    );
  }
  if (timingVerdict === 'non_standard_length') {
    issues.push(`выровнять хронометраж ровно под эфирный шаг ${nearestStandardSec}.0 сек`);
  }
  if (Math.abs(loudnessDeltaVsAirDb) > 3.2) {
    issues.push('сбалансировать плотность голоса под реальный радиоэфир');
  }

  const recommendationSummary =
    issues.length > 0
      ? `Точки роста в блоке: ${issues.join('; ')}.`
      : 'Ролик уверенно держит вход и концовку внутри рекламного блока — продюсер проверит сценарий и юридическую чистоту.';

  return {
    fileName: params.fileName,
    durationSec,
    nearestStandardSec,
    timingDriftSec,
    timingVerdict,
    timingHumanLabel,
    meanRmsDb,
    peakDb,
    loudnessDeltaVsAirDb,
    loudnessHumanLabel,
    introContrastVerdict,
    introHumanLabel,
    outroRetentionVerdict,
    outroHumanLabel,
    recommendationSummary,
  };
}

function roundDb(val: number): number {
  return Math.round(val * 10) / 10;
}

export function buildAircheckAuditBriefSummary(params: {
  clientName: string;
  sourceMode: BroadcastSourceMode;
  diagnostic: UploadedSpotBroadcastDiagnostic | null;
}): string {
  const sourceLabel =
    params.sourceMode === 'live_regional_stream'
      ? 'живой поток регионального радио'
      : params.sourceMode === 'captured_story_program'
        ? 'длинный эфир радиопередачи с историей'
        : 'региональный эфир 91.0 FM (полный блок 2:25)';

  if (!params.diagnostic) {
    return `Запрос из стенда реального радиоэфира (${sourceLabel}, окружение из 4 конкурентов). Клиент: ${params.clientName.trim()}. Нужен расчёт и пример выделения бренда в рекламном блоке.`;
  }

  const d = params.diagnostic;
  return [
    `Проверка ролика в полном рекламном блоке (${sourceLabel}).`,
    `Клиент: ${params.clientName.trim()}.`,
    `Файл: ${d.fileName} (${d.durationSec} сек, ориентир ${d.nearestStandardSec} сек).`,
    `Вход после конкурента №1: ${d.introHumanLabel}.`,
    `Защита финала перед 3 конкурентами: ${d.outroHumanLabel}.`,
    `Громкость: ${d.loudnessHumanLabel} (${d.meanRmsDb} дБ).`,
    d.recommendationSummary,
  ].join(' ');
}
