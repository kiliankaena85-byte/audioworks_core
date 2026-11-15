import type { LayaPersona } from '../engine/layaTypes.ts';
import { checkBannedForeignServiceUrl } from '../security/rfLegalCompliance.ts';
import {
  AUDIOWORKS_FOCUS_ENTRY_SEC,
  AUDIOWORKS_TOTAL_DURATION_SEC,
  AUDIOWORKS_WAV_URL,
  CRASH_TEST_CLUTTER_DURATION_SEC,
  CRASH_TEST_STOP_DURATION_SEC,
} from './audioworksCommercial.ts';
import type {
  DuelCmsConfig,
  PortfolioCaseRecord,
  StudioCmsSnapshot,
} from './studioCmsTypes.ts';

export type HeroClutterSourceMode = 'builtin_stream' | 'custom_upload';
export type HeroFocusSourceMode =
  | 'default_reel'
  | 'portfolio_case'
  | 'custom_upload';

export type HeroPersonaOverrideKey = 'real_estate' | 'fmcg';

export interface HeroPersonaTrackOverride {
  enabled: boolean;
  mode: 'portfolio_case' | 'custom_upload';
  linkedCaseId?: string;
  audioUrl?: string;
  audioFileName?: string;
  durationSec?: number;
  startSec?: number;
  customLabel?: string;
}

export interface HeroStageCmsConfig {
  /** Источник Фазы А (0:00..N): встроенный радийный поток или собственный загруженный файл */
  clutterSourceMode: HeroClutterSourceMode;
  clutterAudioUrl?: string;
  clutterAudioFileName?: string;
  clutterStartSec: number;
  clutterDurationSec: number;
  clutterRoadNoiseDefault: boolean;

  /** Длительность Фазы Б («Стоп · Пауза» перед раскрытием линзы), по умолчанию 0.5 сек */
  stopPauseDurationSec: number;

  /** Источник Фазы В (чистый выход FMWorks после раскрытия линзы) */
  focusSourceMode: HeroFocusSourceMode;
  /** ID кейса из портфолио или флагманского шоурила при focusSourceMode === 'portfolio_case' */
  linkedCaseId?: string;
  /** Прямой URL загруженного WAV/MP3 файла при focusSourceMode === 'custom_upload' */
  focusAudioUrl?: string;
  focusAudioFileName?: string;
  focusDurationSec: number;
  focusStartSec: number;
  focusEndSec?: number;
  /** Подпись активного ролика в раскрытой линзе Hero (необязательно) */
  focusCustomLabel?: string;

  /** Задел на Шаг 100: опциональная подмена ролика Hero под отраслевой профиль Laya AI */
  personaOverrides: Record<HeroPersonaOverrideKey, HeroPersonaTrackOverride>;
}

export interface ResolvedHeroClutterTrack {
  mode: HeroClutterSourceMode;
  audioUrl: string;
  fileName: string | null;
  startSec: number;
  durationSec: number;
  roadNoiseOnClutter: boolean;
}

export interface ResolvedHeroFocusTrack {
  sourceKind:
    | 'default_reel'
    | 'portfolio_case'
    | 'custom_upload'
    | 'persona_override';
  audioUrl: string;
  label: string;
  fileName: string | null;
  startSec: number;
  endSec: number | null;
  durationSec: number;
  linkedCaseId: string | null;
  activePersonaOverride: HeroPersonaOverrideKey | null;
}

export interface ResolvedHeroStagePlayback {
  clutter: ResolvedHeroClutterTrack;
  stopPauseDurationSec: number;
  totalIntroDurationSec: number;
  focus: ResolvedHeroFocusTrack;
  isCustomized: boolean;
}

export type ShowcaseAudioSceneId = 'hero_stage' | 'portfolio' | 'duel';

export interface ShowcaseAudioSceneMapItem {
  id: ShowcaseAudioSceneId;
  screenBadge: string;
  title: string;
  publicPlacement: string;
  anchorHash: '#top' | '#work' | '#duel';
  activeAudioSummary: string;
  timingSummary: string;
  isCustomized: boolean;
}

function cleanOptionalText(val: unknown, maxLen = 240): string | undefined {
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

function cleanSafeAudioUrl(val: unknown): string | undefined {
  const cleaned = cleanOptionalText(val, 1024);
  if (!cleaned) return undefined;
  if (checkBannedForeignServiceUrl(cleaned).matched) {
    return undefined;
  }
  return cleaned;
}

function clampRounded(
  val: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    return fallback;
  }
  const bounded = Math.min(max, Math.max(min, val));
  return Math.round(bounded * 100) / 100;
}

export function createDefaultHeroStageCmsConfig(): HeroStageCmsConfig {
  return {
    clutterSourceMode: 'builtin_stream',
    clutterStartSec: 1.6,
    clutterDurationSec: CRASH_TEST_CLUTTER_DURATION_SEC,
    clutterRoadNoiseDefault: true,
    stopPauseDurationSec: CRASH_TEST_STOP_DURATION_SEC,
    focusSourceMode: 'default_reel',
    focusDurationSec: Math.round(
      (AUDIOWORKS_TOTAL_DURATION_SEC - AUDIOWORKS_FOCUS_ENTRY_SEC) * 10
    ) / 10,
    focusStartSec: AUDIOWORKS_FOCUS_ENTRY_SEC,
    personaOverrides: {
      real_estate: {
        enabled: false,
        mode: 'portfolio_case',
        linkedCaseId: 'business-estate',
      },
      fmcg: {
        enabled: false,
        mode: 'portfolio_case',
        linkedCaseId: 'dmitrogorsky',
      },
    },
  };
}

function normalizePersonaOverride(
  raw: unknown,
  fallback: HeroPersonaTrackOverride
): HeroPersonaTrackOverride {
  const obj =
    raw && typeof raw === 'object'
      ? (raw as Partial<HeroPersonaTrackOverride>)
      : {};
  const mode =
    obj.mode === 'custom_upload' || obj.mode === 'portfolio_case'
      ? obj.mode
      : fallback.mode;
  const audioUrl = cleanSafeAudioUrl(obj.audioUrl);

  return {
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : fallback.enabled,
    mode: mode === 'custom_upload' && !audioUrl ? 'portfolio_case' : mode,
    linkedCaseId:
      cleanOptionalText(obj.linkedCaseId, 80) ?? fallback.linkedCaseId,
    audioUrl,
    audioFileName: cleanOptionalText(obj.audioFileName, 200),
    durationSec:
      typeof obj.durationSec === 'number' && Number.isFinite(obj.durationSec)
        ? clampRounded(obj.durationSec, 15, 1, 600)
        : undefined,
    startSec:
      typeof obj.startSec === 'number' && Number.isFinite(obj.startSec)
        ? clampRounded(obj.startSec, 0, 0, 590)
        : undefined,
    customLabel: cleanOptionalText(obj.customLabel, 160),
  };
}

/**
 * Нормализует и безопасно ограничивает конфигурацию звука первого экрана (Hero).
 * Поддерживает обратную совместимость со старыми снимками CMS без поля `heroStage`.
 */
export function normalizeHeroStageCmsConfig(
  raw: unknown
): HeroStageCmsConfig {
  const defaults = createDefaultHeroStageCmsConfig();
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }

  const obj = raw as Partial<HeroStageCmsConfig>;

  const clutterAudioUrl = cleanSafeAudioUrl(obj.clutterAudioUrl);
  const requestedClutterMode: HeroClutterSourceMode =
    obj.clutterSourceMode === 'custom_upload'
      ? 'custom_upload'
      : 'builtin_stream';
  const clutterSourceMode: HeroClutterSourceMode =
    requestedClutterMode === 'custom_upload' && clutterAudioUrl
      ? 'custom_upload'
      : 'builtin_stream';

  const clutterStartSec = clampRounded(
    obj.clutterStartSec,
    clutterSourceMode === 'custom_upload' ? 0 : defaults.clutterStartSec,
    0,
    300
  );
  const clutterDurationSec = clampRounded(
    obj.clutterDurationSec,
    defaults.clutterDurationSec,
    2,
    8
  );
  const stopPauseDurationSec = clampRounded(
    obj.stopPauseDurationSec,
    defaults.stopPauseDurationSec,
    0.2,
    1.5
  );

  const focusAudioUrl = cleanSafeAudioUrl(obj.focusAudioUrl);
  const linkedCaseId = cleanOptionalText(obj.linkedCaseId, 80);

  let focusSourceMode: HeroFocusSourceMode = 'default_reel';
  if (obj.focusSourceMode === 'custom_upload' && focusAudioUrl) {
    focusSourceMode = 'custom_upload';
  } else if (obj.focusSourceMode === 'portfolio_case' && linkedCaseId) {
    focusSourceMode = 'portfolio_case';
  }

  const focusDurationSec = clampRounded(
    obj.focusDurationSec,
    defaults.focusDurationSec,
    1,
    600
  );

  const defaultFocusStart =
    focusSourceMode === 'default_reel' ? defaults.focusStartSec : 0;
  const focusStartSec = clampRounded(
    obj.focusStartSec,
    defaultFocusStart,
    0,
    595
  );

  const focusEndSec =
    typeof obj.focusEndSec === 'number' &&
    Number.isFinite(obj.focusEndSec) &&
    obj.focusEndSec > focusStartSec + 0.5
      ? clampRounded(obj.focusEndSec, focusStartSec + focusDurationSec, 0.5, 600)
      : undefined;

  const rawPersonas =
    obj.personaOverrides && typeof obj.personaOverrides === 'object'
      ? (obj.personaOverrides as Partial<
          Record<HeroPersonaOverrideKey, unknown>
        >)
      : {};

  return {
    clutterSourceMode,
    clutterAudioUrl,
    clutterAudioFileName: cleanOptionalText(obj.clutterAudioFileName, 200),
    clutterStartSec,
    clutterDurationSec,
    clutterRoadNoiseDefault:
      typeof obj.clutterRoadNoiseDefault === 'boolean'
        ? obj.clutterRoadNoiseDefault
        : defaults.clutterRoadNoiseDefault,
    stopPauseDurationSec,
    focusSourceMode,
    linkedCaseId,
    focusAudioUrl,
    focusAudioFileName: cleanOptionalText(obj.focusAudioFileName, 200),
    focusDurationSec,
    focusStartSec,
    focusEndSec,
    focusCustomLabel: cleanOptionalText(obj.focusCustomLabel, 160),
    personaOverrides: {
      real_estate: normalizePersonaOverride(
        rawPersonas.real_estate,
        defaults.personaOverrides.real_estate
      ),
      fmcg: normalizePersonaOverride(
        rawPersonas.fmcg,
        defaults.personaOverrides.fmcg
      ),
    },
  };
}

/**
 * Очищает временные `blob:` ссылки перед сериализацией в `sessionStorage`,
 * сохраняя постоянные серверные URL `/assets/cms/...`.
 */
export function sanitizeHeroStageForSessionStorage(
  hero: HeroStageCmsConfig,
  baseline: HeroStageCmsConfig
): HeroStageCmsConfig {
  const next: HeroStageCmsConfig = {
    ...hero,
    personaOverrides: {
      real_estate: { ...hero.personaOverrides.real_estate },
      fmcg: { ...hero.personaOverrides.fmcg },
    },
  };

  if (next.clutterAudioUrl?.startsWith('blob:')) {
    next.clutterAudioUrl = baseline.clutterAudioUrl;
    if (!next.clutterAudioUrl) {
      next.clutterSourceMode = 'builtin_stream';
    }
  }

  if (next.focusAudioUrl?.startsWith('blob:')) {
    next.focusAudioUrl = baseline.focusAudioUrl;
    if (!next.focusAudioUrl && next.focusSourceMode === 'custom_upload') {
      next.focusSourceMode = baseline.focusSourceMode;
    }
  }

  for (const key of ['real_estate', 'fmcg'] as const) {
    const ov = next.personaOverrides[key];
    if (ov.audioUrl?.startsWith('blob:')) {
      ov.audioUrl = baseline.personaOverrides[key].audioUrl;
      if (!ov.audioUrl && ov.mode === 'custom_upload') {
        ov.enabled = false;
        ov.mode = 'portfolio_case';
      }
    }
  }

  return next;
}

export function findCaseInSnapshot(
  snapshot: Pick<StudioCmsSnapshot, 'flagshipReel' | 'portfolioCases'>,
  caseId: string | undefined
): PortfolioCaseRecord | null {
  if (!caseId) return null;
  if (snapshot.flagshipReel.id === caseId) {
    return snapshot.flagshipReel;
  }
  return snapshot.portfolioCases.find((c) => c.id === caseId) ?? null;
}

function resolveCaseTrackBounds(item: PortfolioCaseRecord, startOverride?: number): {
  audioUrl: string;
  startSec: number;
  endSec: number | null;
  durationSec: number;
  fileName: string | null;
} {
  const audioUrl = item.audioUrl?.trim() || AUDIOWORKS_WAV_URL;
  const baseStart =
    typeof startOverride === 'number' && Number.isFinite(startOverride)
      ? Math.max(0, startOverride)
      : Math.max(0, item.clipStartSec ?? 0);

  const explicitEnd =
    typeof item.clipEndSec === 'number' &&
    Number.isFinite(item.clipEndSec) &&
    item.clipEndSec > baseStart + 0.5
      ? item.clipEndSec
      : item.audioUrl && !item.clipEndSec
        ? null
        : baseStart + Math.max(1, item.durationSec);

  const durationSec =
    explicitEnd !== null
      ? Math.max(1, Math.round((explicitEnd - baseStart) * 10) / 10)
      : Math.max(1, item.durationSec);

  const fileName =
    item.customAudioFileName ||
    (item.audioUrl ? decodeURIComponent(item.audioUrl.split('/').pop() || '') : '') ||
    null;

  return {
    audioUrl,
    startSec: Math.round(baseStart * 100) / 100,
    endSec: explicitEnd !== null ? Math.round(explicitEnd * 100) / 100 : null,
    durationSec,
    fileName,
  };
}

/**
 * Вычисляет итоговые параметры воспроизведения краш-теста в Hero-блоке
 * с учётом выбранного источника (файл / кейс / эталон) и отраслевого профиля Laya AI.
 */
export function resolveHeroStagePlayback(
  snapshot: Pick<
    StudioCmsSnapshot,
    'heroStage' | 'flagshipReel' | 'portfolioCases'
  >,
  persona: LayaPersona = 'default'
): ResolvedHeroStagePlayback {
  const hero = normalizeHeroStageCmsConfig(snapshot.heroStage);
  const defaults = createDefaultHeroStageCmsConfig();

  const clutter: ResolvedHeroClutterTrack =
    hero.clutterSourceMode === 'custom_upload' && hero.clutterAudioUrl
      ? {
          mode: 'custom_upload',
          audioUrl: hero.clutterAudioUrl,
          fileName:
            hero.clutterAudioFileName ||
            decodeURIComponent(hero.clutterAudioUrl.split('/').pop() || 'clutter.wav'),
          startSec: hero.clutterStartSec,
          durationSec: hero.clutterDurationSec,
          roadNoiseOnClutter: hero.clutterRoadNoiseDefault,
        }
      : {
          mode: 'builtin_stream',
          audioUrl: AUDIOWORKS_WAV_URL,
          fileName: null,
          startSec: 1.6,
          durationSec: hero.clutterDurationSec,
          roadNoiseOnClutter: hero.clutterRoadNoiseDefault,
        };

  let focus: ResolvedHeroFocusTrack | null = null;

  // 1. Проверяем активное отраслевое переопределение (Шаг 100: ЖК / FMCG)
  if (persona === 'real_estate' || persona === 'fmcg') {
    const ov = hero.personaOverrides[persona];
    if (ov && ov.enabled) {
      if (ov.mode === 'custom_upload' && ov.audioUrl) {
        const startSec = ov.startSec ?? 0;
        const dur = ov.durationSec ?? 15;
        const fName =
          ov.audioFileName ||
          decodeURIComponent(ov.audioUrl.split('/').pop() || 'persona-spot.wav');
        focus = {
          sourceKind: 'persona_override',
          audioUrl: ov.audioUrl,
          label: ov.customLabel || `Профильный спот · ${fName}`,
          fileName: fName,
          startSec,
          endSec: null,
          durationSec: dur,
          linkedCaseId: null,
          activePersonaOverride: persona,
        };
      } else if (ov.mode === 'portfolio_case' && ov.linkedCaseId) {
        const foundCase = findCaseInSnapshot(snapshot, ov.linkedCaseId);
        if (foundCase && foundCase.audioUrl) {
          const bounds = resolveCaseTrackBounds(foundCase, ov.startSec);
          focus = {
            sourceKind: 'persona_override',
            audioUrl: bounds.audioUrl,
            label: ov.customLabel || `${foundCase.client} · ${foundCase.tag}`,
            fileName: bounds.fileName,
            startSec: bounds.startSec,
            endSec: bounds.endSec,
            durationSec: bounds.durationSec,
            linkedCaseId: foundCase.id,
            activePersonaOverride: persona,
          };
        }
      }
    }
  }

  // 2. Основной источник Фазы В (FMWorks)
  if (!focus) {
    if (hero.focusSourceMode === 'custom_upload' && hero.focusAudioUrl) {
      const fileName =
        hero.focusAudioFileName ||
        decodeURIComponent(hero.focusAudioUrl.split('/').pop() || 'hero-master.wav');
      const endSec =
        typeof hero.focusEndSec === 'number' &&
        hero.focusEndSec > hero.focusStartSec + 0.5
          ? hero.focusEndSec
          : null;
      const effectiveDur =
        endSec !== null
          ? Math.max(1, Math.round((endSec - hero.focusStartSec) * 10) / 10)
          : hero.focusDurationSec;
      focus = {
        sourceKind: 'custom_upload',
        audioUrl: hero.focusAudioUrl,
        label: hero.focusCustomLabel || `Шоурил · ${fileName}`,
        fileName,
        startSec: hero.focusStartSec,
        endSec,
        durationSec: effectiveDur,
        linkedCaseId: null,
        activePersonaOverride: null,
      };
    } else if (hero.focusSourceMode === 'portfolio_case' && hero.linkedCaseId) {
      const linked = findCaseInSnapshot(snapshot, hero.linkedCaseId);
      if (linked && linked.audioUrl) {
        const bounds = resolveCaseTrackBounds(
          linked,
          hero.focusStartSec > 0 ? hero.focusStartSec : undefined
        );
        focus = {
          sourceKind: 'portfolio_case',
          audioUrl: bounds.audioUrl,
          label: hero.focusCustomLabel || `${linked.client} · ${linked.tag}`,
          fileName: bounds.fileName,
          startSec: bounds.startSec,
          endSec: bounds.endSec,
          durationSec: bounds.durationSec,
          linkedCaseId: linked.id,
          activePersonaOverride: null,
        };
      }
    }
  }

  // 3. Эталонный заводской шоурил FMWorks (фоллбэк по умолчанию)
  if (!focus) {
    const startSec =
      hero.focusSourceMode === 'default_reel'
        ? hero.focusStartSec
        : AUDIOWORKS_FOCUS_ENTRY_SEC;
    const endSec =
      hero.focusSourceMode === 'default_reel' &&
      typeof hero.focusEndSec === 'number' &&
      hero.focusEndSec > startSec + 0.5
        ? hero.focusEndSec
        : null;
    const dur =
      endSec !== null
        ? Math.max(1, Math.round((endSec - startSec) * 10) / 10)
        : Math.max(
            1,
            Math.round((AUDIOWORKS_TOTAL_DURATION_SEC - startSec) * 10) / 10
          );

    focus = {
      sourceKind: 'default_reel',
      audioUrl: AUDIOWORKS_WAV_URL,
      label: hero.focusCustomLabel || 'Эталонный шоурил FMWorks',
      fileName: 'Audioworks_75c6023f.mp3',
      startSec,
      endSec,
      durationSec: dur,
      linkedCaseId: null,
      activePersonaOverride: null,
    };
  }

  const isCustomized =
    JSON.stringify(hero) !== JSON.stringify(defaults);

  return {
    clutter,
    stopPauseDurationSec: hero.stopPauseDurationSec,
    totalIntroDurationSec:
      Math.round((clutter.durationSec + hero.stopPauseDurationSec) * 100) / 100,
    focus,
    isCustomized,
  };
}

/**
 * В 1 клик назначает выбранный кейс портфолио или флагманский шоурил главным роликом Hero.
 */
export function assignPortfolioCaseToHeroStage(
  currentHero: HeroStageCmsConfig,
  targetCase: PortfolioCaseRecord,
  slot: 'default' | HeroPersonaOverrideKey = 'default'
): HeroStageCmsConfig {
  const normalized = normalizeHeroStageCmsConfig(currentHero);

  if (slot === 'real_estate' || slot === 'fmcg') {
    return {
      ...normalized,
      personaOverrides: {
        ...normalized.personaOverrides,
        [slot]: {
          enabled: true,
          mode: 'portfolio_case',
          linkedCaseId: targetCase.id,
          startSec: targetCase.clipStartSec ?? 0,
          customLabel: `${targetCase.client} · ${targetCase.tag}`,
        },
      },
    };
  }

  return {
    ...normalized,
    focusSourceMode: 'portfolio_case',
    linkedCaseId: targetCase.id,
    focusStartSec: targetCase.clipStartSec ?? 0,
    focusEndSec: targetCase.clipEndSec,
    focusDurationSec: Math.max(1, targetCase.durationSec),
    focusCustomLabel: `${targetCase.client} · ${targetCase.tag}`,
  };
}

function summarizeDuelAudioLabel(duel: DuelCmsConfig): string {
  const sideA =
    duel.radioSpot.audioFileName ||
    (duel.radioSpot.audioUrl
      ? decodeURIComponent(duel.radioSpot.audioUrl.split('/').pop() || 'radio.wav')
      : 'эталон А');
  const sideB =
    duel.audioworksSpot.audioFileName ||
    (duel.audioworksSpot.audioUrl
      ? decodeURIComponent(
          duel.audioworksSpot.audioUrl.split('/').pop() || 'fmworks.wav'
        )
      : 'эталон Б');
  return `А: ${sideA} · Б: ${sideB}`;
}

/**
 * Строит наглядную 3-зонную карту звуковых сцен главной страницы для Кабинета студии (`/admin`),
 * чтобы владелец сразу видел, какой файл на каком экране звучит.
 */
export function buildShowcaseScenesMap(
  snapshot: Pick<
    StudioCmsSnapshot,
    'heroStage' | 'flagshipReel' | 'portfolioCases' | 'duel'
  >
): ShowcaseAudioSceneMapItem[] {
  const heroResolved = resolveHeroStagePlayback(snapshot, 'default');
  const publishedCasesCount = snapshot.portfolioCases.filter(
    (c) => c.published !== false
  ).length;

  const flagshipFile =
    snapshot.flagshipReel.customAudioFileName ||
    (snapshot.flagshipReel.audioUrl
      ? decodeURIComponent(
          snapshot.flagshipReel.audioUrl.split('/').pop() || 'studio-reel.wav'
        )
      : 'синтез');

  const duelCustomized = Boolean(
    snapshot.duel.radioSpot.audioUrl || snapshot.duel.audioworksSpot.audioUrl
  );

  const flagshipCustomized = Boolean(snapshot.flagshipReel.customAudioFileName);

  return [
    {
      id: 'hero_stage',
      screenBadge: 'Экран 1 · Первый экран',
      title: 'Hero «Краш-тест в эфире»',
      publicPlacement: 'Кнопка «Краш-тест в эфире» и тумблер «Обычный эфир / FMWorks»',
      anchorHash: '#top',
      activeAudioSummary:
        heroResolved.focus.sourceKind === 'portfolio_case'
          ? `Кейс: ${heroResolved.focus.label}`
          : heroResolved.focus.sourceKind === 'custom_upload'
            ? `Файл: ${heroResolved.focus.fileName ?? heroResolved.focus.label}`
            : 'Эталонный шоурил студии',
      timingSummary: `${heroResolved.clutter.durationSec.toFixed(1)} с эфир → ${heroResolved.stopPauseDurationSec.toFixed(1)} с пауза → ${Math.round(heroResolved.focus.durationSec)} с FMWorks`,
      isCustomized: heroResolved.isCustomized,
    },
    {
      id: 'portfolio',
      screenBadge: 'Экран 3 · Секция «Наши работы»',
      title: 'Портфолио и флагманская полоса',
      publicPlacement: 'Широкая плашка «Слушать шоурил» + сетка карточек и раздел /cases',
      anchorHash: '#work',
      activeAudioSummary: `Полоса: ${flagshipFile} · В сетке: ${publishedCasesCount} раб.`,
      timingSummary: `Шоурил ${Math.round(snapshot.flagshipReel.durationSec)} с · превью карточек 3–5 с`,
      isCustomized: flagshipCustomized,
    },
    {
      id: 'duel',
      screenBadge: 'Экран 4 · Слепое сравнение',
      title: 'Дуэль 15 секунд (А против Б)',
      publicPlacement: 'Блок «Один бриф на 15 секунд. Два разных результата»',
      anchorHash: '#duel',
      activeAudioSummary: summarizeDuelAudioLabel(snapshot.duel),
      timingSummary: `Сторона А: ${snapshot.duel.radioSpot.durationSec} с · Сторона Б: ${snapshot.duel.audioworksSpot.durationSec} с`,
      isCustomized: duelCustomized,
    },
  ];
}
