export type BroadcastSourceMode =
  | 'captured_regional_host'
  | 'captured_story_program'
  | 'live_regional_stream';

export type InsertedSpotMode = 'fmworks_example' | 'typical_cliche' | 'client_upload';

export type TargetSpotPresetId =
  | 'zerno_craft'
  | 'dmitrogorsky_fmcg'
  | 'business_estate'
  | 'cliche_template';

export type TargetSlotPosition = 1 | 2 | 3 | 4 | 5;

export interface TargetSpotPresetSpec {
  id: TargetSpotPresetId;
  category: 'studio_case' | 'cliche';
  shortTitle: string;
  fullTitle: string;
  sectorLabel: string;
  subtitle: string;
  audioUrl: string;
  durationSec: number;
}

export interface NeighborBroadcastSpotSpec {
  id: 'neighbor_1' | 'neighbor_2' | 'neighbor_3' | 'neighbor_4';
  title: string;
  sectorLabel: string;
  subtitle: string;
  audioUrl: string;
  durationSec: number;
}

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
  fmworksReferenceSpot: '/assets/aistudio/aircheck/case_zerno_craft.mp3',
  caseZernoCraft: '/assets/aistudio/aircheck/case_zerno_craft.mp3',
  caseDmitrogorskyFmcg: '/assets/aistudio/aircheck/case_dmitrogorsky_fmcg.mp3',
  caseBusinessEstate: '/assets/aistudio/aircheck/case_business_estate.mp3',
  typicalClicheSpot: '/assets/aistudio/aircheck/adbreak_slot1_cliche.mp3',
  competitorAfter1: '/assets/aistudio/aircheck/competitor_after_1.mp3',
  competitorAfter2: '/assets/aistudio/aircheck/competitor_after_2.mp3',
  competitorAfter3: '/assets/aistudio/aircheck/competitor_after_3.mp3',
  broadcastReturnOutro: '/assets/aistudio/aircheck/broadcast_return_long.mp3',
} as const;

export const DEFAULT_AIRCHECK_DURATIONS_SEC = {
  /** Завершение фразы Кати Калиной на отбивке перед новостями (без обрыва) */
  regionalHostLeadin: 46.5,
  /** Завершение цельной фразы истории («...отличается лаконичностью и сдержанностью») */
  storyProgramLeadin: 50.7,
  liveLeadInWindow: 48.0,
  adSpliceJingleIn: 3.74,
  competitorBefore1: 14.88,
  fmworksReferenceSpot: 15.38,
  caseDmitrogorskyFmcg: 21.34,
  caseBusinessEstate: 19.75,
  typicalClicheSpot: 6.84,
  competitorAfter1: 16.58,
  competitorAfter2: 19.94,
  competitorAfter3: 29.88,
  broadcastReturnOutro: 15.1,
} as const;

export const PROGRAM_TRANSITION_CONFIG = {
  /** Длительность поиска естественной паузы речи в предзаписанном эфире */
  recordedSearchWindowSec: 8.5,
  /** Длительность плавного затухания речи ведущего при уходе на склейку */
  programFadeOutSec: 0.42,
  /** Наложение начала джингл-отбивки склейки на хвост затухающей программы */
  spliceCrossfadeOverlapSec: 0.24,
  /** Плавный микро-переход между соседними роликами в рекламном блоке */
  adSlotMicroCrossfadeSec: 0.04,
  /** Окно детектора речевой паузы при прослушивании Live-потока (от — до) */
  livePauseGateStartSec: 44.0,
  livePauseGateHardLimitSec: 54.0,
} as const;

export const TARGET_SPOT_PRESETS: readonly TargetSpotPresetSpec[] = [
  {
    id: 'zerno_craft',
    category: 'studio_case',
    shortTitle: 'Зерно и Свет',
    fullTitle: 'Кейс FMWorks: Кофейня «Зерно и Свет» (15с)',
    sectorLabel: 'HoReCa · Игровой ролик',
    subtitle: 'Стартовая пауза и подсечка внимания водителя из дорожного потока',
    audioUrl: AIRCHECK_AUDIO_URLS.caseZernoCraft,
    durationSec: DEFAULT_AIRCHECK_DURATIONS_SEC.fmworksReferenceSpot,
  },
  {
    id: 'dmitrogorsky_fmcg',
    category: 'studio_case',
    shortTitle: 'Дмитрогорский',
    fullTitle: 'Кейс FMWorks: Дмитрогорский продукт (21с)',
    sectorLabel: 'FMCG · Тактильный саунд-дизайн',
    subtitle: 'Живой вкус в деталях и пауза вместо крикливой начитки скидок',
    audioUrl: AIRCHECK_AUDIO_URLS.caseDmitrogorskyFmcg,
    durationSec: DEFAULT_AIRCHECK_DURATIONS_SEC.caseDmitrogorskyFmcg,
  },
  {
    id: 'business_estate',
    category: 'studio_case',
    shortTitle: 'Квартал статус',
    fullTitle: 'Кейс FMWorks: Квартал бизнес-класса (20с)',
    sectorLabel: 'Девелопмент · Камерный тембр',
    subtitle: 'Спокойная уверенность и акустическая тишина среди шумных соседей',
    audioUrl: AIRCHECK_AUDIO_URLS.caseBusinessEstate,
    durationSec: DEFAULT_AIRCHECK_DURATIONS_SEC.caseBusinessEstate,
  },
  {
    id: 'cliche_template',
    category: 'cliche',
    shortTitle: 'Обычный шаблон',
    fullTitle: 'Шаблонный эфирный ролик «под радио»',
    sectorLabel: 'Типовая начитка · Поток',
    subtitle: 'Сливается с общим фоном рекламной паузы без пауз и образного крючка',
    audioUrl: AIRCHECK_AUDIO_URLS.typicalClicheSpot,
    durationSec: DEFAULT_AIRCHECK_DURATIONS_SEC.typicalClicheSpot,
  },
] as const;

export const NEIGHBOR_AD_SPOTS: readonly NeighborBroadcastSpotSpec[] = [
  {
    id: 'neighbor_1',
    title: 'Сетевой спортивный ритейл — сезонная акция на обувь и скидки до 30%',
    sectorLabel: 'Ритейл',
    subtitle: 'Реальная реклама из FM-эфира: плотная акционная подача с ценой и сроками',
    audioUrl: AIRCHECK_AUDIO_URLS.competitorBefore1,
    durationSec: DEFAULT_AIRCHECK_DURATIONS_SEC.competitorBefore1,
  },
  {
    id: 'neighbor_2',
    title: 'Дилер внедорожников — выгода до 850 000 ₽ до конца месяца',
    sectorLabel: 'Автобренд',
    subtitle: 'Реальная реклама из FM-эфира: низкий мужской баритон и спецпредложение месяца',
    audioUrl: AIRCHECK_AUDIO_URLS.competitorAfter1,
    durationSec: DEFAULT_AIRCHECK_DURATIONS_SEC.competitorAfter1,
  },
  {
    id: 'neighbor_3',
    title: 'Федеральная логистика — набор водителей-экспедиторов и короткий номер',
    sectorLabel: 'Логистика',
    subtitle: 'Реальная реклама из FM-эфира: энергичный призыв и короткий номер с повтором',
    audioUrl: AIRCHECK_AUDIO_URLS.competitorAfter2,
    durationSec: DEFAULT_AIRCHECK_DURATIONS_SEC.competitorAfter2,
  },
  {
    id: 'neighbor_4',
    title: 'Банк для бизнеса — открытие счёта и ускоренный дисклеймер в концовке',
    sectorLabel: 'Финансы',
    subtitle: 'Реальная реклама из FM-эфира: диалог и ускоренный юридический дисклеймер в финале',
    audioUrl: AIRCHECK_AUDIO_URLS.competitorAfter3,
    durationSec: DEFAULT_AIRCHECK_DURATIONS_SEC.competitorAfter3,
  },
] as const;

export const DEFAULT_NEIGHBOR_ORDER: readonly NeighborBroadcastSpotSpec['id'][] = [
  'neighbor_1',
  'neighbor_2',
  'neighbor_3',
  'neighbor_4',
] as const;

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
  | 'competitor_before_2'
  | 'competitor_before_3'
  | 'competitor_before_4'
  | 'target_spot'
  | 'competitor_after_1'
  | 'competitor_after_2'
  | 'competitor_after_3'
  | 'competitor_after_4'
  | 'program_return';

export type BroadcastSegmentKind = 'program' | 'splice' | 'competitor' | 'target';

export interface BroadcastTimelineSegment {
  id: BroadcastSegmentId;
  kind: BroadcastSegmentKind;
  orderIndex: number;
  slotNumber: number | null;
  shortStepLabel: string;
  compactWaveLabel: string;
  title: string;
  subtitle: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  audioUrl?: string;
  clipEndSec?: number;
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
  targetPresetId?: TargetSpotPresetId;
  targetSlotIndex?: TargetSlotPosition;
  neighborOrder?: readonly NeighborBroadcastSpotSpec['id'][];
  clientSpotName?: string | null;
  clientSpotDurationSec?: number | null;
  liveStationTitle?: string;
  segmentDurationOverrides?: Partial<Record<BroadcastSegmentId, number>>;
}

function roundSec(val: number): number {
  return Math.round(val * 100) / 100;
}

export function clampTargetSlotIndex(slot?: number | null): TargetSlotPosition {
  if (slot === 1 || slot === 2 || slot === 3 || slot === 4 || slot === 5) {
    return slot;
  }
  return 2;
}

export function getTargetSpotPresetSpec(
  presetId?: TargetSpotPresetId | null
): TargetSpotPresetSpec {
  return (
    TARGET_SPOT_PRESETS.find((p) => p.id === presetId) ?? TARGET_SPOT_PRESETS[0]
  );
}

/**
 * Детерминированная (при передаче randomFn) рандомизация позиции целевого ролика (1–5)
 * и перестановка рекламных соседей вокруг места врезки.
 */
export function randomizeSlotPlacement(params: {
  currentSlotIndex: TargetSlotPosition;
  currentNeighborOrder?: readonly NeighborBroadcastSpotSpec['id'][];
  randomFn?: () => number;
}): {
  targetSlotIndex: TargetSlotPosition;
  neighborOrder: NeighborBroadcastSpotSpec['id'][];
} {
  const rng = params.randomFn ?? Math.random;
  const allSlots: TargetSlotPosition[] = [1, 2, 3, 4, 5];
  const candidates = allSlots.filter((s) => s !== params.currentSlotIndex);
  const pickIdx = Math.min(
    candidates.length - 1,
    Math.max(0, Math.floor(rng() * candidates.length))
  );
  const targetSlotIndex = candidates[pickIdx] ?? 2;

  const base = [...(params.currentNeighborOrder ?? DEFAULT_NEIGHBOR_ORDER)];
  for (let i = base.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.max(0, Math.floor(rng() * (i + 1))));
    const tmp = base[i];
    base[i] = base[j];
    base[j] = tmp;
  }

  return {
    targetSlotIndex,
    neighborOrder: base,
  };
}

function resolveOrderedNeighborSpecs(
  neighborOrder?: readonly NeighborBroadcastSpotSpec['id'][]
): NeighborBroadcastSpotSpec[] {
  const byId = new Map(NEIGHBOR_AD_SPOTS.map((n) => [n.id, n]));
  const seen = new Set<NeighborBroadcastSpotSpec['id']>();
  const ordered: NeighborBroadcastSpotSpec[] = [];

  for (const id of neighborOrder ?? DEFAULT_NEIGHBOR_ORDER) {
    const spec = byId.get(id);
    if (spec && !seen.has(id)) {
      seen.add(id);
      ordered.push(spec);
    }
  }

  for (const fallback of NEIGHBOR_AD_SPOTS) {
    if (!seen.has(fallback.id)) {
      ordered.push(fallback);
    }
  }

  return ordered;
}

export function buildBroadcastTimelineSegments(
  params: BuildBroadcastTimelineParams
): readonly BroadcastTimelineSegment[] {
  const ov = params.segmentDurationOverrides ?? {};
  const targetSlotIndex = clampTargetSlotIndex(params.targetSlotIndex);
  const orderedNeighbors = resolveOrderedNeighborSpecs(params.neighborOrder);

  const defaultLeadIn =
    params.sourceMode === 'captured_story_program'
      ? DEFAULT_AIRCHECK_DURATIONS_SEC.storyProgramLeadin
      : params.sourceMode === 'live_regional_stream'
        ? DEFAULT_AIRCHECK_DURATIONS_SEC.liveLeadInWindow
        : DEFAULT_AIRCHECK_DURATIONS_SEC.regionalHostLeadin;

  const leadInDur = roundSec(ov.program_leadin ?? defaultLeadIn);
  const spliceInDur = roundSec(
    ov.ad_jingle_in ?? DEFAULT_AIRCHECK_DURATIONS_SEC.adSpliceJingleIn
  );
  const returnDur = roundSec(
    ov.program_return ?? DEFAULT_AIRCHECK_DURATIONS_SEC.broadcastReturnOutro
  );

  const effectivePreset =
    params.spotMode === 'typical_cliche'
      ? getTargetSpotPresetSpec('cliche_template')
      : getTargetSpotPresetSpec(params.targetPresetId ?? 'zerno_craft');

  const rawTargetDur =
    params.spotMode === 'client_upload' &&
    typeof params.clientSpotDurationSec === 'number' &&
    Number.isFinite(params.clientSpotDurationSec) &&
    params.clientSpotDurationSec > 0.5
      ? Math.min(90, Math.max(1.5, roundSec(params.clientSpotDurationSec)))
      : roundSec(ov.target_spot ?? effectivePreset.durationSec);

  const leadInTitle =
    params.sourceMode === 'captured_story_program'
      ? 'Актёрское чтение истории до плавного ухода на рекламу'
      : params.sourceMode === 'live_regional_stream'
        ? params.liveStationTitle || 'Региональное радио'
        : 'Рубрика ведущих с естественной паузой перед рекламой';

  const leadInSubtitle =
    params.sourceMode === 'captured_story_program'
      ? 'Законченная фраза истории и мягкое затухание под джингл рекламной склейки'
      : params.sourceMode === 'live_regional_stream'
        ? 'Реальное вещание с поиском ближайшей речевой паузы для плавной склейки'
        : 'Слушатель едет под разговор ведущих — в паузе включается рекламный блок';

  const beforeCount = targetSlotIndex - 1;
  const afterCount = 5 - targetSlotIndex;

  const targetTitle =
    params.spotMode === 'client_upload'
      ? `Ваш ролик в блоке (слот №${targetSlotIndex}): ${params.clientSpotName || 'Загруженный файл'}`
      : params.spotMode === 'typical_cliche'
        ? `Обычный шаблонный ролик (слот №${targetSlotIndex} среди 4 конкурентов)`
        : `${effectivePreset.fullTitle} · слот №${targetSlotIndex}`;

  const targetSubtitle =
    targetSlotIndex === 1
      ? 'Первая позиция сразу после эфирной отбивки — следом идут ещё 4 объявления'
      : targetSlotIndex === 5
        ? 'Финальная позиция после 4 конкурентов перед возвратом ведущих в эфир'
        : `Стоит в слоте №${targetSlotIndex}: до вас ${beforeCount} рол., сразу после — ещё ${afterCount}`;

  const rawSpecs: Array<{
    id: BroadcastSegmentId;
    kind: BroadcastSegmentKind;
    slotNumber: number | null;
    shortStepLabel: string;
    compactWaveLabel: string;
    title: string;
    subtitle: string;
    durationSec: number;
    audioUrl?: string;
    clipEndSec?: number;
    isTargetSlot: boolean;
  }> = [
    {
      id: 'program_leadin',
      kind: 'program',
      slotNumber: null,
      shortStepLabel: '01 · Живой эфир',
      compactWaveLabel: 'Эфир передачи',
      title: leadInTitle,
      subtitle: leadInSubtitle,
      durationSec: leadInDur,
      audioUrl:
        params.sourceMode === 'captured_story_program'
          ? AIRCHECK_AUDIO_URLS.storyProgramLeadin
          : AIRCHECK_AUDIO_URLS.regionalHostLeadin,
      clipEndSec:
        params.sourceMode === 'live_regional_stream' ? undefined : leadInDur,
      isTargetSlot: false,
    },
    {
      id: 'ad_jingle_in',
      kind: 'splice',
      slotNumber: null,
      shortStepLabel: '02 · Рекламная склейка',
      compactWaveLabel: 'Склейка',
      title: 'Эфирная отбивка перехода к рекламе',
      subtitle: 'Фирменный джингл станции с плавным кроссфейдом из речи ведущего',
      durationSec: spliceInDur,
      audioUrl: AIRCHECK_AUDIO_URLS.adSpliceJingleIn,
      isTargetSlot: false,
    },
  ];

  for (let i = 0; i < beforeCount; i += 1) {
    const neighbor = orderedNeighbors[i];
    const segId = `competitor_before_${i + 1}` as BroadcastSegmentId;
    const slotNum = i + 1;
    const dur = roundSec(ov[segId] ?? neighbor.durationSec);
    rawSpecs.push({
      id: segId,
      kind: 'competitor',
      slotNumber: slotNum,
      shortStepLabel: `Слот №${slotNum} · Сосед (${neighbor.sectorLabel})`,
      compactWaveLabel: `Сосед №${slotNum}`,
      title: neighbor.title,
      subtitle: neighbor.subtitle,
      durationSec: dur,
      audioUrl: neighbor.audioUrl,
      isTargetSlot: false,
    });
  }

  rawSpecs.push({
    id: 'target_spot',
    kind: 'target',
    slotNumber: targetSlotIndex,
    shortStepLabel:
      params.spotMode === 'client_upload'
        ? `Слот №${targetSlotIndex} · Ваш ролик`
        : params.spotMode === 'typical_cliche'
          ? `Слот №${targetSlotIndex} · Шаблон`
          : `Слот №${targetSlotIndex} · ${effectivePreset.shortTitle}`,
    compactWaveLabel:
      params.spotMode === 'client_upload'
        ? `Ваш №${targetSlotIndex}`
        : params.spotMode === 'typical_cliche'
          ? `Шаблон №${targetSlotIndex}`
          : `${effectivePreset.shortTitle} №${targetSlotIndex}`,
    title: targetTitle,
    subtitle: targetSubtitle,
    durationSec: rawTargetDur,
    audioUrl:
      params.spotMode === 'client_upload' ? undefined : effectivePreset.audioUrl,
    isTargetSlot: true,
  });

  for (let j = 0; j < afterCount; j += 1) {
    const neighbor = orderedNeighbors[beforeCount + j];
    const segId = `competitor_after_${j + 1}` as BroadcastSegmentId;
    const slotNum = targetSlotIndex + 1 + j;
    const dur = roundSec(ov[segId] ?? neighbor.durationSec);
    rawSpecs.push({
      id: segId,
      kind: 'competitor',
      slotNumber: slotNum,
      shortStepLabel: `Слот №${slotNum} · Сосед (${neighbor.sectorLabel})`,
      compactWaveLabel: `Сосед №${slotNum}`,
      title: neighbor.title,
      subtitle: neighbor.subtitle,
      durationSec: dur,
      audioUrl: neighbor.audioUrl,
      isTargetSlot: false,
    });
  }

  rawSpecs.push({
    id: 'program_return',
    kind: 'program',
    slotNumber: null,
    shortStepLabel: 'Финал · Возврат в эфир',
    compactWaveLabel: 'Возврат',
    title: 'Выходная склейка и возврат ведущих в эфир радиостанции',
    subtitle: 'Рекламный блок окончен — станция продолжает основную передачу',
    durationSec: returnDur,
    audioUrl: AIRCHECK_AUDIO_URLS.broadcastReturnOutro,
    isTargetSlot: false,
  });

  let cursor = 0;
  return rawSpecs.map((spec, idx) => {
    const startSec = roundSec(cursor);
    const endSec = roundSec(startSec + spec.durationSec);
    cursor = endSec;
    return {
      id: spec.id,
      kind: spec.kind,
      orderIndex: idx + 1,
      slotNumber: spec.slotNumber,
      shortStepLabel: spec.shortStepLabel,
      compactWaveLabel: spec.compactWaveLabel,
      title: spec.title,
      subtitle: spec.subtitle,
      startSec,
      endSec,
      durationSec: spec.durationSec,
      audioUrl: spec.audioUrl,
      clipEndSec: spec.clipEndSec,
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

export function getCompetitorsBeforeTargetCount(
  segments: readonly BroadcastTimelineSegment[]
): number {
  const targetIdx = segments.findIndex((s) => s.isTargetSlot);
  if (targetIdx < 0) return 0;
  return segments.slice(0, targetIdx).filter((s) => s.kind === 'competitor').length;
}

export function getCompetitorsAfterTargetCount(
  segments: readonly BroadcastTimelineSegment[]
): number {
  const targetIdx = segments.findIndex((s) => s.isTargetSlot);
  if (targetIdx < 0) return 0;
  return segments.slice(targetIdx + 1).filter((s) => s.kind === 'competitor').length;
}

/**
 * Формирует адаптивные кликабельные метки этапов прямо над звуковой волной,
 * подстраиваясь под выбранное место врезки (слот 1–5).
 */
export function buildWaveformPhaseMarkers(
  segments: readonly BroadcastTimelineSegment[],
  activeSegmentId: BroadcastSegmentId,
  spotMode: InsertedSpotMode,
  targetPresetId: TargetSpotPresetId = 'zerno_craft'
): readonly WaveformPhaseMarker[] {
  const total = Math.max(1, getTotalBroadcastDurationSec(segments));
  const leadIn = segments.find((s) => s.id === 'program_leadin');
  const splice = segments.find((s) => s.id === 'ad_jingle_in');
  const target = segments.find((s) => s.isTargetSlot);
  const ret = segments.find((s) => s.id === 'program_return');

  if (!leadIn || !splice || !target || !ret) {
    return [];
  }

  const targetIdx = segments.findIndex((s) => s.isTargetSlot);
  const beforeComps = segments
    .slice(0, targetIdx)
    .filter((s) => s.kind === 'competitor');
  const afterComps = segments
    .slice(targetIdx + 1)
    .filter((s) => s.kind === 'competitor');

  const slotNumber = target.slotNumber ?? beforeComps.length + 1;
  const preset = getTargetSpotPresetSpec(targetPresetId);

  const rawGroups: Omit<WaveformPhaseMarker, 'widthPercent'>[] = [
    {
      id: 'phase_program',
      targetSegmentId: 'program_leadin',
      label: 'Эфир',
      shortMobileLabel: 'Эфир',
      durationLabel: `${Math.floor(leadIn.endSec)}с`,
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
  ];

  if (beforeComps.length > 0) {
    const first = beforeComps[0];
    const last = beforeComps[beforeComps.length - 1];
    const beforeDur = roundSec(last.endSec - first.startSec);
    rawGroups.push({
      id: 'phase_before',
      targetSegmentId: first.id,
      label:
        beforeComps.length === 1
          ? 'Реклама 1'
          : `До вас · ${beforeComps.length} рол.`,
      shortMobileLabel:
        beforeComps.length === 1 ? 'Сосед 1' : `До (${beforeComps.length})`,
      durationLabel: `${Math.round(beforeDur)}с`,
      startSec: first.startSec,
      endSec: last.endSec,
      isTarget: false,
      isActive: beforeComps.some((s) => s.id === activeSegmentId),
    });
  }

  rawGroups.push({
    id: 'phase_target',
    targetSegmentId: target.id,
    label:
      spotMode === 'client_upload'
        ? `Ваш №${slotNumber}`
        : spotMode === 'typical_cliche'
          ? `Шаблон №${slotNumber}`
          : `${preset.shortTitle} №${slotNumber}`,
    shortMobileLabel:
      spotMode === 'client_upload' ? `Ваш №${slotNumber}` : `Слот №${slotNumber}`,
    durationLabel: `${Math.round(target.durationSec)}с`,
    startSec: target.startSec,
    endSec: target.endSec,
    isTarget: true,
    isActive: activeSegmentId === target.id,
  });

  if (afterComps.length > 0) {
    const firstAfter = afterComps[0];
    const lastAfter = afterComps[afterComps.length - 1];
    const afterDur = roundSec(lastAfter.endSec - firstAfter.startSec);
    rawGroups.push({
      id: 'phase_after_pack',
      targetSegmentId: firstAfter.id,
      label:
        afterComps.length === 1
          ? 'Ещё 1 реклама'
          : `Ещё ${afterComps.length} рекламы`,
      shortMobileLabel: `+${afterComps.length} соседа`,
      durationLabel: `${Math.round(afterDur)}с`,
      startSec: firstAfter.startSec,
      endSec: lastAfter.endSec,
      isTarget: false,
      isActive: afterComps.some((s) => s.id === activeSegmentId),
    });
  }

  rawGroups.push({
    id: 'phase_return',
    targetSegmentId: 'program_return',
    label: 'Возврат в эфир',
    shortMobileLabel: 'Возврат',
    durationLabel: `${Math.round(ret.durationSec)}с`,
    startSec: ret.startSec,
    endSec: ret.endSec,
    isTarget: false,
    isActive: activeSegmentId === 'program_return',
  });

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

export interface SpeechExitDetectionResult {
  exitSec: number;
  pauseDepthDb: number;
  foundNaturalPause: boolean;
}

/**
 * Сканирует хвост PCM-сигнала эфирной программы в заданном окне [searchStartSec, searchEndSec]
 * для поиска естественной межфразной паузы и нулевого пересечения (чтобы не обрывать ведущего на полуслове).
 */
export function findOptimalSpeechExitSec(params: {
  samples: Float32Array | readonly number[];
  sampleRate: number;
  searchStartSec: number;
  searchEndSec: number;
  preferredExitSec?: number;
  minPauseSec?: number;
}): SpeechExitDetectionResult {
  const safeRate = Math.max(8000, Math.round(params.sampleRate || 44100));
  const totalSec = params.samples.length / safeRate;
  const startSec = Math.max(0.2, Math.min(totalSec - 0.5, params.searchStartSec));
  const endSec = Math.max(startSec + 0.3, Math.min(totalSec, params.searchEndSec));
  const minPauseSec = Math.max(0.08, params.minPauseSec ?? 0.14);

  const winSamples = Math.max(64, Math.floor(safeRate * 0.025)); // 25ms окна
  const startIdx = Math.floor(startSec * safeRate);
  const endIdx = Math.min(params.samples.length, Math.floor(endSec * safeRate));

  const windowDb: { midSec: number; db: number; idx: number }[] = [];
  for (let i = startIdx; i + winSamples <= endIdx; i += winSamples) {
    let sq = 0;
    const step = Math.max(1, Math.floor(winSamples / 32));
    let count = 0;
    for (let j = i; j < i + winSamples; j += step) {
      const s = params.samples[j] ?? 0;
      sq += s * s;
      count += 1;
    }
    const rms = count > 0 ? Math.sqrt(sq / count) : 0.00003;
    const db = 20 * Math.log10(Math.max(0.00003, rms));
    windowDb.push({
      midSec: (i + winSamples * 0.5) / safeRate,
      db,
      idx: i + Math.floor(winSamples * 0.5),
    });
  }

  if (windowDb.length === 0) {
    return {
      exitSec: roundSec(params.preferredExitSec ?? endSec),
      pauseDepthDb: 0,
      foundNaturalPause: false,
    };
  }

  const sortedDbs = [...windowDb.map((w) => w.db)].sort((a, b) => a - b);
  const speechP75Db = sortedDbs[Math.floor(sortedDbs.length * 0.75)] ?? -18;
  const quietThresholdDb = speechP75Db - 11.5;
  const minFrames = Math.max(2, Math.ceil(minPauseSec / 0.025));

  interface PauseSpan {
    startIdx: number;
    endIdx: number;
    centerSec: number;
    minDb: number;
    depthDb: number;
  }

  const spans: PauseSpan[] = [];
  let runStart = -1;
  for (let i = 0; i < windowDb.length; i += 1) {
    if (windowDb[i].db <= quietThresholdDb) {
      if (runStart < 0) runStart = i;
    } else if (runStart >= 0) {
      if (i - runStart >= minFrames) {
        const slice = windowDb.slice(runStart, i);
        const minW = slice.reduce((a, b) => (b.db < a.db ? b : a), slice[0]);
        spans.push({
          startIdx: runStart,
          endIdx: i - 1,
          centerSec: roundSec(minW.midSec),
          minDb: roundDb(minW.db),
          depthDb: roundDb(speechP75Db - minW.db),
        });
      }
      runStart = -1;
    }
  }
  if (runStart >= 0 && windowDb.length - runStart >= minFrames) {
    const slice = windowDb.slice(runStart);
    const minW = slice.reduce((a, b) => (b.db < a.db ? b : a), slice[0]);
    spans.push({
      startIdx: runStart,
      endIdx: windowDb.length - 1,
      centerSec: roundSec(minW.midSec),
      minDb: roundDb(minW.db),
      depthDb: roundDb(speechP75Db - minW.db),
    });
  }

  if (spans.length > 0) {
    const targetRef = params.preferredExitSec ?? endSec - 1.2;
    const chosen = spans.reduce((best, curr) => {
      const bestDist = Math.abs(best.centerSec - targetRef);
      const currDist = Math.abs(curr.centerSec - targetRef);
      const bestScore = best.depthDb - bestDist * 1.4;
      const currScore = curr.depthDb - currDist * 1.4;
      return currScore > bestScore ? curr : best;
    }, spans[0]);

    return {
      exitSec: chosen.centerSec,
      pauseDepthDb: chosen.depthDb,
      foundNaturalPause: true,
    };
  }

  // Фоллбэк: ближайший локальный минимум громкости в последних 40% окна поиска
  const tailWindows = windowDb.slice(Math.floor(windowDb.length * 0.55));
  const quietest = tailWindows.reduce((a, b) => (b.db < a.db ? b : a), tailWindows[0]);
  return {
    exitSec: roundSec(quietest.midSec),
    pauseDepthDb: roundDb(Math.max(0, speechP75Db - quietest.db)),
    foundNaturalPause: speechP75Db - quietest.db >= 6.5,
  };
}

export type IntroHookVerdict = 'strong_contrast' | 'moderate_contrast' | 'merges_with_stream';
export type OutroRetentionVerdict = 'clean_packshot' | 'crowded_ending';
export type GridTimingVerdict = 'exact_grid' | 'non_standard_length';
export type ComplianceIssueSeverity = 'critical' | 'warning' | 'pass';
export type ComplianceIssueCategory = 'technical' | 'legal' | 'creative';

export interface SpotComplianceCheckItem {
  id:
    | 'silence_or_corrupt'
    | 'loudness_fas_level'
    | 'peak_clipping'
    | 'stereo_mono_phase'
    | 'sample_rate_quality'
    | 'grid_duration'
    | 'edges_dead_air'
    | 'disclaimer_speed_fz38'
    | 'rao_vois_rights';
  category: ComplianceIssueCategory;
  severity: ComplianceIssueSeverity;
  title: string;
  detail: string;
}

export interface UploadedSpotBroadcastDiagnostic {
  fileName: string;
  targetSlotIndex: TargetSlotPosition;
  durationSec: number;
  nearestStandardSec: 5 | 10 | 15 | 20 | 30 | 45;
  timingDriftSec: number;
  timingVerdict: GridTimingVerdict;
  timingHumanLabel: string;
  meanRmsDb: number;
  peakDb: number;
  loudnessDeltaVsAirDb: number;
  recommendedMakeupGainDb: number;
  loudnessHumanLabel: string;
  clippedSampleRatio: number;
  stereoCorrelation: number | null;
  sampleRateHz: number;
  leadingSilenceSec: number;
  trailingSilenceSec: number;
  introContrastVerdict: IntroHookVerdict;
  introHumanLabel: string;
  outroRetentionVerdict: OutroRetentionVerdict;
  outroHumanLabel: string;
  overallReadiness: 'ready' | 'needs_tuning' | 'critical_issues';
  complianceChecklist: SpotComplianceCheckItem[];
  recommendationSummary: string;
}

const STANDARD_GRID_SECONDS: readonly (5 | 10 | 15 | 20 | 30 | 45)[] = [
  5, 10, 15, 20, 30, 45,
];
const REGIONAL_BROADCAST_REF_RMS_DB = -18.5;

function roundDb(val: number): number {
  return Math.round(val * 10) / 10;
}

/**
 * Комплексный акустический, технический и юридический (ФЗ-38 / ФАС / РАО-ВОИС)
 * аудит пользовательского ролика с учётом выбранного слота в рекламном блоке (№1–№5).
 */
export function analyzeUploadedSpotSamples(params: {
  fileName: string;
  samples: Float32Array | readonly number[];
  rightSamples?: Float32Array | readonly number[] | null;
  sampleRate: number;
  targetSlotIndex?: TargetSlotPosition;
}): UploadedSpotBroadcastDiagnostic {
  const safeRate = Math.max(8000, Math.round(params.sampleRate || 44100));
  const totalSamples = params.samples.length;
  const durationSec = roundSec(Math.max(0.5, totalSamples / safeRate));
  const targetSlotIndex = clampTargetSlotIndex(params.targetSlotIndex);

  let nearestStandardSec: 5 | 10 | 15 | 20 | 30 | 45 = 15;
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
    Math.abs(timingDriftSec) <= 0.45 && durationSec >= 4.5 && durationSec <= 46
      ? 'exact_grid'
      : 'non_standard_length';

  const timingHumanLabel =
    timingVerdict === 'exact_grid'
      ? `В сетке ${nearestStandardSec} сек (${durationSec.toFixed(1)} с)`
      : durationSec < 4.5
        ? `Слишком короткий (${durationSec.toFixed(1)} с) — станция поставит минимум 5 или 10 с`
        : durationSec > 46
          ? `Длинный формат (${durationSec.toFixed(1)} с) — превышает стандартный рекламный слот`
          : `${durationSec.toFixed(1)} с (отклонение ${timingDriftSec > 0 ? '+' : ''}${timingDriftSec.toFixed(1)} с от ${nearestStandardSec} с)`;

  let sumSq = 0;
  let peakAbs = 0;
  let clippedCount = 0;
  let corrSumLR = 0;
  let corrSumLL = 0;
  let corrSumRR = 0;
  const hasRight =
    Boolean(params.rightSamples) && (params.rightSamples?.length ?? 0) === totalSamples;

  const stride = Math.max(1, Math.floor(totalSamples / 120_000));
  let counted = 0;

  for (let i = 0; i < totalSamples; i += stride) {
    const l = params.samples[i] ?? 0;
    const v = Math.abs(l);
    if (v > peakAbs) peakAbs = v;
    if (v >= 0.985) clippedCount += 1;
    sumSq += v * v;
    counted += 1;

    if (hasRight && params.rightSamples) {
      const r = params.rightSamples[i] ?? 0;
      corrSumLR += l * r;
      corrSumLL += l * l;
      corrSumRR += r * r;
    }
  }

  const rms = counted > 0 ? Math.sqrt(sumSq / counted) : 0.0001;
  const meanRmsDb = roundDb(20 * Math.log10(Math.max(0.00003, rms)));
  const peakDb = roundDb(20 * Math.log10(Math.max(0.00003, peakAbs)));
  const loudnessDeltaVsAirDb = roundDb(meanRmsDb - REGIONAL_BROADCAST_REF_RMS_DB);
  const recommendedMakeupGainDb = roundDb(
    Math.max(-14, Math.min(18, REGIONAL_BROADCAST_REF_RMS_DB - meanRmsDb))
  );
  const clippedSampleRatio =
    counted > 0 ? Math.round((clippedCount / counted) * 10000) / 10000 : 0;

  let stereoCorrelation: number | null = null;
  if (hasRight && corrSumLL > 1e-9 && corrSumRR > 1e-9) {
    stereoCorrelation =
      Math.round((corrSumLR / Math.sqrt(corrSumLL * corrSumRR)) * 100) / 100;
  }

  const isSilentFile = peakDb < -46 || meanRmsDb < -52;

  let loudnessHumanLabel = 'В балансе с уровнем регионального эфира (-18.5 дБ RMS)';
  if (isSilentFile) {
    loudnessHumanLabel = 'Почти полная тишина в файле — проверьте экспорт дорожки';
  } else if (loudnessDeltaVsAirDb < -3.2) {
    loudnessHumanLabel = `Тише эфира на ${Math.abs(loudnessDeltaVsAirDb).toFixed(1)} дБ — риск провалиться за соседями и в дороге`;
  } else if (loudnessDeltaVsAirDb > 3.2) {
    loudnessHumanLabel = `Перегружен на +${loudnessDeltaVsAirDb.toFixed(1)} дБ (нарушение нормы ФАС / прижим лимитера станции)`;
  } else if (loudnessDeltaVsAirDb > 1.5) {
    loudnessHumanLabel = `Выше нормы ФАС на +${loudnessDeltaVsAirDb.toFixed(1)} дБ — станция ослабит или вернёт на сведение`;
  }

  // Измерение тишины на входе и выходе (по окнам 50 мс)
  const edgeWin = Math.max(64, Math.floor(safeRate * 0.05));
  let leadingSilenceSec = 0;
  for (let start = 0; start + edgeWin <= totalSamples; start += edgeWin) {
    let wSq = 0;
    for (let j = start; j < start + edgeWin; j += 8) {
      const sv = params.samples[j] ?? 0;
      wSq += sv * sv;
    }
    const wDb = 20 * Math.log10(Math.max(0.00003, Math.sqrt(wSq / Math.ceil(edgeWin / 8))));
    if (wDb < -44) {
      leadingSilenceSec += 0.05;
    } else {
      break;
    }
  }
  leadingSilenceSec = roundSec(leadingSilenceSec);

  let trailingSilenceSec = 0;
  for (let end = totalSamples; end - edgeWin >= 0; end -= edgeWin) {
    let wSq = 0;
    for (let j = end - edgeWin; j < end; j += 8) {
      const sv = params.samples[j] ?? 0;
      wSq += sv * sv;
    }
    const wDb = 20 * Math.log10(Math.max(0.00003, Math.sqrt(wSq / Math.ceil(edgeWin / 8))));
    if (wDb < -44) {
      trailingSilenceSec += 0.05;
    } else {
      break;
    }
  }
  trailingSilenceSec = roundSec(trailingSilenceSec);

  // 1. Вход после склейки (если слот 1) или после соседа №(slot - 1)
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

  const beforeActorLabel =
    targetSlotIndex === 1
      ? 'отбивки склейки'
      : `соседа №${targetSlotIndex - 1}`;

  let introContrastVerdict: IntroHookVerdict = 'moderate_contrast';
  let introHumanLabel = `Умеренное отделение после ${beforeActorLabel}`;

  if (hasAirPocketStart && crestDb >= 5.2) {
    introContrastVerdict = 'strong_contrast';
    introHumanLabel = `Чистая пауза и акцент — заметно отделяется после ${beforeActorLabel}`;
  } else if (!hasAirPocketStart && crestDb < 5.0) {
    introContrastVerdict = 'merges_with_stream';
    introHumanLabel =
      targetSlotIndex === 1
        ? 'Резкий старт впритык к отбивке — первые слова могут смазаться'
        : `Старт без паузы — риск слиться с соседним роликом №${targetSlotIndex - 1}`;
  }

  // 2. Финал перед следующими роликами или возвратом в эфир
  const afterCount = 5 - targetSlotIndex;
  const outroWindowStart = Math.max(0, totalSamples - Math.floor(safeRate * 2.2));
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
    ? afterCount === 0
      ? 'Финал с чистой точкой перед возвратом ведущих в эфир'
      : `Финал с точкой — бренд фиксируется до ${afterCount} следующих объявлений`
    : afterCount === 0
      ? 'Плотная концовка впритык — джингл возврата в эфир может накрыть финальное слово'
      : `Плотная скороговорка до конца — следующие ${afterCount} объявления перебьют бренд`;

  // 3. Построение структурированного технического + юридического чеклиста
  const checklist: SpotComplianceCheckItem[] = [];

  if (isSilentFile) {
    checklist.push({
      id: 'silence_or_corrupt',
      category: 'technical',
      severity: 'critical',
      title: 'Нет полезного аудиосигнала',
      detail:
        'Пиковый уровень ниже -46 дБ. Проверьте, не экспортирована ли пустая дорожка.',
    });
  }

  if (!isSilentFile) {
    if (loudnessDeltaVsAirDb > 3.2) {
      checklist.push({
        id: 'loudness_fas_level',
        category: 'legal',
        severity: 'critical',
        title: 'Превышение громкости по приказу ФАС к ФЗ-38',
        detail: `Ролик громче среднего эфира на +${loudnessDeltaVsAirDb.toFixed(1)} дБ (допуск ФАС до +1.5 дБ). Станция отклонит файл на модерации или принудительно прижмёт лимитером.`,
      });
    } else if (loudnessDeltaVsAirDb > 1.5) {
      checklist.push({
        id: 'loudness_fas_level',
        category: 'legal',
        severity: 'warning',
        title: 'На грани допуска ФАС по громкости',
        detail: `Уровень ${meanRmsDb} дБ превышает норму эфира на +${loudnessDeltaVsAirDb.toFixed(1)} дБ. Рекомендуется подравнять мастер до -18.5 дБ RMS.`,
      });
    } else if (loudnessDeltaVsAirDb < -3.2) {
      checklist.push({
        id: 'loudness_fas_level',
        category: 'technical',
        severity: 'warning',
        title: 'Недостаточная громкость для эфира в авто',
        detail: `Ролик тише соседей на ${Math.abs(loudnessDeltaVsAirDb).toFixed(1)} дБ — дорожный шум перекроет реплики.`,
      });
    } else {
      checklist.push({
        id: 'loudness_fas_level',
        category: 'technical',
        severity: 'pass',
        title: 'Громкость в допуске эфира и ФАС',
        detail: `Средняя плотность ${meanRmsDb} дБ соответствует уровню рекламного блока.`,
      });
    }
  }

  if (peakDb > -0.3 || clippedSampleRatio >= 0.002) {
    checklist.push({
      id: 'peak_clipping',
      category: 'technical',
      severity: 'critical',
      title: 'Цифровой клиппинг (True Peak > -0.3 dBFS)',
      detail:
        'Обнаружены пиковые перегрузки. На FM-передатчике такой ролик даст хрип и срез высоких частот. Нужен запас -1.0 dBFS True Peak.',
    });
  } else {
    checklist.push({
      id: 'peak_clipping',
      category: 'technical',
      severity: 'pass',
      title: 'Чистый запас по пикам',
      detail: `Пик ${peakDb} dBFS без цифровых искажений.`,
    });
  }

  if (stereoCorrelation !== null && stereoCorrelation < 0.15) {
    checklist.push({
      id: 'stereo_mono_phase',
      category: 'technical',
      severity: 'critical',
      title: 'Риск противофазы в моно-приёмниках',
      detail: `Корреляция каналов ${stereoCorrelation}. В моно-динамиках и части автомагнитол голос пропадёт или зазвучит пусто.`,
    });
  }

  if (safeRate < 32000) {
    checklist.push({
      id: 'sample_rate_quality',
      category: 'technical',
      severity: 'warning',
      title: 'Низкая частота дискретизации',
      detail: `Файл имеет ${Math.round(safeRate / 1000)} кГц; радиостанции принимают от 44.1 / 48 кГц без телефонного среза верхов.`,
    });
  }

  if (timingVerdict === 'non_standard_length') {
    checklist.push({
      id: 'grid_duration',
      category: 'technical',
      severity: durationSec < 4.5 || durationSec > 46 ? 'critical' : 'warning',
      title: 'Отклонение от секундной сетки станции',
      detail: timingHumanLabel,
    });
  } else {
    checklist.push({
      id: 'grid_duration',
      category: 'technical',
      severity: 'pass',
      title: 'Точное попадание в сетку эфира',
      detail: timingHumanLabel,
    });
  }

  if (leadingSilenceSec >= 1.1 || trailingSilenceSec >= 1.1) {
    checklist.push({
      id: 'edges_dead_air',
      category: 'technical',
      severity: 'warning',
      title: 'Лишняя пустота на краях файла',
      detail: `Обнаружена тишина (${leadingSilenceSec.toFixed(1)} с в начале, ${trailingSilenceSec.toFixed(1)} с в конце) — вы платите за пустой эфир и создаёте ощущение обрыва.`,
    });
  }

  if (outroRetentionVerdict === 'crowded_ending' && durationSec <= 21) {
    checklist.push({
      id: 'disclaimer_speed_fz38',
      category: 'legal',
      severity: 'warning',
      title: 'Риск по читаемости дисклеймера (ФЗ-38)',
      detail:
        'Плотный финал без микропауз: для акций, медицины, финансов и недвижимости юридический дисклеймер на концовке может быть признан нечитаемым — модерация радиосети попросит замедлить финал.',
    });
  }

  checklist.push({
    id: 'rao_vois_rights',
    category: 'legal',
    severity: 'warning',
    title: 'Проверка прав на музыку и голос (РАО / ВОИС)',
    detail:
      'Для постановки стороннего файла в эфир радиостанция потребует отчёт о правах на фонограмму и письменное согласие диктора.',
  });

  const hasCritical = checklist.some((c) => c.severity === 'critical');
  const hasWarning = checklist.some((c) => c.severity === 'warning');
  const overallReadiness: UploadedSpotBroadcastDiagnostic['overallReadiness'] =
    hasCritical ? 'critical_issues' : hasWarning ? 'needs_tuning' : 'ready';

  const issues: string[] = [];
  if (isSilentFile) {
    issues.push('проверить экспорт звуковой дорожки (обнаружена тишина)');
  }
  if (loudnessDeltaVsAirDb > 1.5) {
    issues.push('снизить громкость в допуск ФАС и убрать пиковый перегруз');
  } else if (loudnessDeltaVsAirDb < -3.2) {
    issues.push('поднять плотность голоса до -18.5 дБ RMS под шум дороги');
  }
  if (peakDb > -0.3 || clippedSampleRatio >= 0.002) {
    issues.push('снять цифровой клиппинг и выставить лимит -1.0 dBFS');
  }
  if (stereoCorrelation !== null && stereoCorrelation < 0.15) {
    issues.push('исправить противофазу для моно-совместимости в авто');
  }
  if (introContrastVerdict === 'merges_with_stream') {
    issues.push(`добавить 0.35–0.45 сек паузы отсечки после ${beforeActorLabel}`);
  }
  if (outroRetentionVerdict === 'crowded_ending') {
    issues.push('разгрузить концовку и проверить темп дисклеймера по ФЗ-38');
  }
  if (timingVerdict === 'non_standard_length') {
    issues.push(`выровнять хронометраж ровно под сетку ${nearestStandardSec}.0 сек`);
  }

  const recommendationSummary =
    issues.length > 0
      ? `Что поправить перед эфиром: ${issues.join('; ')}.`
      : 'Технические параметры и стыки в блоке чистые — осталось приложить паспорт прав РАО/ВОИС и финальный чек ФЗ-38.';

  return {
    fileName: params.fileName,
    targetSlotIndex,
    durationSec,
    nearestStandardSec,
    timingDriftSec,
    timingVerdict,
    timingHumanLabel,
    meanRmsDb,
    peakDb,
    loudnessDeltaVsAirDb,
    recommendedMakeupGainDb,
    loudnessHumanLabel,
    clippedSampleRatio,
    stereoCorrelation,
    sampleRateHz: safeRate,
    leadingSilenceSec,
    trailingSilenceSec,
    introContrastVerdict,
    introHumanLabel,
    outroRetentionVerdict,
    outroHumanLabel,
    overallReadiness,
    complianceChecklist: checklist,
    recommendationSummary,
  };
}

export function buildAircheckAuditBriefSummary(params: {
  clientName: string;
  sourceMode: BroadcastSourceMode;
  targetSlotIndex?: TargetSlotPosition;
  diagnostic: UploadedSpotBroadcastDiagnostic | null;
}): string {
  const slotNum = clampTargetSlotIndex(
    params.diagnostic?.targetSlotIndex ?? params.targetSlotIndex
  );
  const sourceLabel =
    params.sourceMode === 'live_regional_stream'
      ? 'живой поток регионального радио'
      : params.sourceMode === 'captured_story_program'
        ? 'длинный эфир радиопередачи с историей'
        : 'региональный эфир 91.0 FM';

  if (!params.diagnostic) {
    return `Запрос из стенда реального радиоэфира (${sourceLabel}, слот №${slotNum} из 5 среди реальной рекламы). Клиент: ${params.clientName.trim()}. Нужен расчёт и пример выделения бренда в рекламном блоке.`;
  }

  const d = params.diagnostic;
  return [
    `Проверка ролика в рекламном блоке (${sourceLabel}, позиция слот №${d.targetSlotIndex} из 5).`,
    `Клиент: ${params.clientName.trim()}.`,
    `Файл: ${d.fileName} (${d.durationSec} сек, ориентир ${d.nearestStandardSec} сек).`,
    `Стык на входе: ${d.introHumanLabel}.`,
    `Защита финала: ${d.outroHumanLabel}.`,
    `Громкость и пики: ${d.loudnessHumanLabel} (RMS ${d.meanRmsDb} дБ, пик ${d.peakDb} dBFS).`,
    d.recommendationSummary,
  ].join(' ');
}
