import type {
  ClientCabinetOrderSummary,
  DeliverableVersionStage,
  OrderDeliverableFile,
} from './clientCabinetHelpers.ts';

export type DeliverableVersionPreset =
  | 'auto'
  | 'v1'
  | 'v2'
  | 'v3'
  | 'v4'
  | 'master';

export const DELIVERABLE_VERSION_STAGE_LABELS: Record<
  DeliverableVersionStage,
  string
> = {
  draft: 'Черновая версия',
  revision: 'Правка',
  master: 'Финальный мастер',
};

export interface ResolvedAudioDeliverableVersion {
  file: OrderDeliverableFile;
  /** Канонический код итерации: 'v1', 'v2', 'v3', ..., 'master' */
  versionCode: string;
  /** Стадия версии ('draft' | 'revision' | 'master') */
  versionStage: DeliverableVersionStage;
  /** Человекочитаемая метка стадии */
  stageLabel: string;
  /** Комментарий продюсера об изменениях в этой итерации */
  versionNote: string;
  /** Является ли версия актуальной (финальный мастер или самая свежая версия на согласовании) */
  isCurrentLatest: boolean;
  /** Является ли версия утверждённым финальным эфирным мастером */
  isFinalMaster: boolean;
  /** Порядковый номер итерации в хронологической цепочке (1..N) */
  chronologicalIndex: number;
}

export interface OrderAudioVersionHistory {
  hasAudioVersions: boolean;
  totalVersionsCount: number;
  hasFinalMaster: boolean;
  latestVersion: ResolvedAudioDeliverableVersion | null;
  previousVersions: ResolvedAudioDeliverableVersion[];
  /** Список для отображения: актуальная / финальная версия сверху, далее прошлые итерации по убыванию */
  versionsNewestFirst: ResolvedAudioDeliverableVersion[];
  /** Список в хронологическом порядке создания: v1 -> v2 -> master */
  versionsChronological: ResolvedAudioDeliverableVersion[];
  /** Краткая сводка цепочки версий: например, 'v1 → v2 → master' */
  progressionChainText: string;
}

/**
 * Проверяет, относится ли файл выдачи к аудиороликам (черновой дубль, правка или финальный мастер).
 */
export function isAudioSpotDeliverable(
  file: Pick<OrderDeliverableFile, 'kind' | 'mimeType'>
): boolean {
  return (
    file.kind === 'audio_master' ||
    file.mimeType.trim().toLowerCase().startsWith('audio/')
  );
}

/**
 * Нормализует строковый код версии ('v1', 'v2', 'master' и т.д.).
 */
export function sanitizeDeliverableVersionCode(
  raw: unknown
): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const cleaned = raw
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .toLowerCase();
  if (!cleaned) return undefined;

  if (
    cleaned === 'master' ||
    cleaned === 'final' ||
    cleaned === 'мастер' ||
    cleaned === 'финал'
  ) {
    return 'master';
  }

  const numMatch = cleaned.match(/^v?\s*(\d{1,2})$/i);
  if (numMatch) {
    const num = Number(numMatch[1]);
    if (Number.isInteger(num) && num >= 1 && num <= 99) {
      return `v${num}`;
    }
  }

  const safeCustom = cleaned.match(/^(v\d{1,2}[a-z0-9-]{0,10}|master-[a-z0-9-]{1,10})$/);
  if (safeCustom) {
    return safeCustom[1];
  }

  return undefined;
}

/**
 * Санитизирует комментарий продюсера к версии файла.
 */
export function sanitizeDeliverableVersionNote(
  raw: unknown
): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const cleaned = raw
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
  return cleaned || undefined;
}

/**
 * Распознаёт код и стадию версии по названию или имени файла для записей без явного `versionCode`.
 */
export function inferAudioVersionFromText(
  title: string,
  fileName: string
): { versionCode?: string; versionStage?: DeliverableVersionStage } {
  const combined = `${fileName} ${title}`.toLowerCase();

  const vMatch = combined.match(/(?:^|[\s_.\-(])v(\d{1,2})(?:$|[\s_.\-)])/i);
  if (vMatch) {
    const n = Number(vMatch[1]);
    if (Number.isInteger(n) && n >= 1 && n <= 99) {
      return {
        versionCode: `v${n}`,
        versionStage: n === 1 ? 'draft' : 'revision',
      };
    }
  }

  if (
    /(?:^|[\s_.\-(])(master|final)(?:$|[\s_.\-)])/i.test(combined) ||
    combined.includes('мастер') ||
    combined.includes('финальн')
  ) {
    return {
      versionCode: 'master',
      versionStage: 'master',
    };
  }

  return {};
}

/**
 * Определяет стадию итерации аудиофайла ('draft', 'revision', 'master').
 * Для старых записей без явной разметки по умолчанию считается 'master' для обратной совместимости.
 */
export function resolveDeliverableVersionStage(
  file: Pick<
    OrderDeliverableFile,
    'versionCode' | 'versionStage' | 'title' | 'fileName'
  >
): DeliverableVersionStage {
  if (
    file.versionStage === 'draft' ||
    file.versionStage === 'revision' ||
    file.versionStage === 'master'
  ) {
    return file.versionStage;
  }

  const explicitCode = sanitizeDeliverableVersionCode(file.versionCode);
  if (explicitCode) {
    if (explicitCode === 'master' || explicitCode.startsWith('master-')) {
      return 'master';
    }
    if (explicitCode === 'v1') {
      return 'draft';
    }
    return 'revision';
  }

  const inferred = inferAudioVersionFromText(file.title, file.fileName);
  if (inferred.versionStage) {
    return inferred.versionStage;
  }

  return 'master';
}

/**
 * Проверяет, является ли аудиофайл финальным эфирным мастером (а не промежуточным черновиком v1/v2).
 */
export function isFinalMasterAudioDeliverable(
  file: Pick<
    OrderDeliverableFile,
    'kind' | 'mimeType' | 'versionCode' | 'versionStage' | 'title' | 'fileName'
  >
): boolean {
  if (!isAudioSpotDeliverable(file)) return false;
  return resolveDeliverableVersionStage(file) === 'master';
}

function parseVersionSortRank(versionCode: string, stage: DeliverableVersionStage): number {
  if (stage === 'master' || versionCode === 'master' || versionCode.startsWith('master-')) {
    return 10_000;
  }
  const match = versionCode.match(/^v(\d{1,2})/);
  if (match) {
    return Number(match[1]);
  }
  return stage === 'draft' ? 1 : 50;
}

/**
 * Предлагает следующий порядковый код версии ('v1', 'v2', 'v3', ...) при загрузке нового аудиофайла в CRM.
 */
export function suggestNextAudioVersionCode(
  existingDeliverables: readonly OrderDeliverableFile[]
): string {
  const audioFiles = existingDeliverables.filter(isAudioSpotDeliverable);
  if (audioFiles.length === 0) {
    return 'v1';
  }

  let maxVersionNum = 0;
  for (const f of audioFiles) {
    const code =
      sanitizeDeliverableVersionCode(f.versionCode) ??
      inferAudioVersionFromText(f.title, f.fileName).versionCode;
    const m = code?.match(/^v(\d{1,2})/);
    if (m) {
      maxVersionNum = Math.max(maxVersionNum, Number(m[1]));
    }
  }

  if (maxVersionNum >= 1) {
    return `v${Math.min(99, maxVersionNum + 1)}`;
  }

  return `v${Math.min(99, audioFiles.length + 1)}`;
}

/**
 * Вычисляет нормализованные `versionCode`, `versionStage` и `versionNote` для загружаемого продюсером файла выдачи.
 */
export function resolveUploadedDeliverableVersionMeta(params: {
  kind: OrderDeliverableFile['kind'];
  mimeType: string;
  requestedVersionCode?: unknown;
  requestedVersionStage?: unknown;
  requestedVersionNote?: unknown;
  existingDeliverables?: readonly OrderDeliverableFile[];
}): {
  versionCode?: string;
  versionStage?: DeliverableVersionStage;
  versionNote?: string;
} {
  const versionNote = sanitizeDeliverableVersionNote(params.requestedVersionNote);
  const isAudio = isAudioSpotDeliverable({
    kind: params.kind,
    mimeType: params.mimeType,
  });

  if (!isAudio) {
    return versionNote ? { versionNote } : {};
  }

  const rawRequested =
    typeof params.requestedVersionCode === 'string'
      ? params.requestedVersionCode.trim().toLowerCase()
      : '';

  const versionCode =
    !rawRequested || rawRequested === 'auto'
      ? suggestNextAudioVersionCode(params.existingDeliverables ?? [])
      : sanitizeDeliverableVersionCode(rawRequested) ??
        suggestNextAudioVersionCode(params.existingDeliverables ?? []);

  const explicitStage =
    params.requestedVersionStage === 'draft' ||
    params.requestedVersionStage === 'revision' ||
    params.requestedVersionStage === 'master'
      ? params.requestedVersionStage
      : undefined;

  const versionStage: DeliverableVersionStage =
    explicitStage ??
    (versionCode === 'master' || versionCode.startsWith('master-')
      ? 'master'
      : versionCode === 'v1'
        ? 'draft'
        : 'revision');

  return {
    versionCode,
    versionStage,
    ...(versionNote ? { versionNote } : {}),
  };
}

/**
 * Строит полную историю итераций аудиоролика (v1, v2, master) для карточки заказа в Личном кабинете.
 */
export function buildOrderAudioVersionHistory(
  order: Pick<ClientCabinetOrderSummary, 'deliverables'>
): OrderAudioVersionHistory {
  const audioDeliverables = order.deliverables.filter(isAudioSpotDeliverable);
  if (audioDeliverables.length === 0) {
    return {
      hasAudioVersions: false,
      totalVersionsCount: 0,
      hasFinalMaster: false,
      latestVersion: null,
      previousVersions: [],
      versionsNewestFirst: [],
      versionsChronological: [],
      progressionChainText: '',
    };
  }

  // Сортируем от ранних к поздним по времени загрузки и рангу версии
  const prelim = audioDeliverables.map((file, rawIdx) => {
    const explicitCode = sanitizeDeliverableVersionCode(file.versionCode);
    const inferred = inferAudioVersionFromText(file.title, file.fileName);
    const prelimCode = explicitCode ?? inferred.versionCode;
    const prelimStage = resolveDeliverableVersionStage(file);
    const ts = Date.parse(file.uploadedAt);
    return {
      file,
      rawIdx,
      explicitCode,
      prelimCode,
      prelimStage,
      ts: Number.isFinite(ts) ? ts : 0,
    };
  });

  prelim.sort((a, b) => {
    if (a.ts !== b.ts) return a.ts - b.ts;
    const rankDiff =
      parseVersionSortRank(a.prelimCode ?? '', a.prelimStage) -
      parseVersionSortRank(b.prelimCode ?? '', b.prelimStage);
    if (rankDiff !== 0) return rankDiff;
    return b.rawIdx - a.rawIdx;
  });

  const usedCodes = new Set<string>();
  const chronological: ResolvedAudioDeliverableVersion[] = prelim.map(
    (item, idx) => {
      let code = item.prelimCode;
      let stage = item.prelimStage;

      if (!code) {
        if (prelim.length === 1) {
          code = 'master';
          stage = 'master';
        } else if (idx === prelim.length - 1 && stage === 'master') {
          code = 'master';
        } else {
          code = `v${idx + 1}`;
          stage = idx === 0 ? 'draft' : 'revision';
        }
      }

      // Предотвращаем дубликаты кодов (например, если в старом заказе два неразмеченных WAV-файла)
      if (usedCodes.has(code)) {
        if (code === 'master') {
          let altIdx = 2;
          while (usedCodes.has(`master-${altIdx}`)) {
            altIdx += 1;
          }
          code = `master-${altIdx}`;
        } else {
          let vNum = idx + 1;
          while (usedCodes.has(`v${vNum}`)) {
            vNum += 1;
          }
          code = `v${vNum}`;
        }
      }
      usedCodes.add(code);

      if (!item.file.versionStage && !item.explicitCode) {
        if (code === 'v1') stage = 'draft';
        else if (code.startsWith('v')) stage = 'revision';
        else stage = 'master';
      }

      return {
        file: item.file,
        versionCode: code,
        versionStage: stage,
        stageLabel: DELIVERABLE_VERSION_STAGE_LABELS[stage],
        versionNote: sanitizeDeliverableVersionNote(item.file.versionNote) ?? '',
        isCurrentLatest: false,
        isFinalMaster: stage === 'master',
        chronologicalIndex: idx + 1,
      };
    }
  );

  // Финальный мастер имеет приоритет как основная версия; если мастера ещё нет — последняя по хронологии vN
  let primaryIdx = chronological.length - 1;
  for (let i = chronological.length - 1; i >= 0; i -= 1) {
    if (chronological[i].isFinalMaster) {
      primaryIdx = i;
      break;
    }
  }

  const withLatestFlag = chronological.map((ver, idx) => ({
    ...ver,
    isCurrentLatest: idx === primaryIdx,
  }));

  const latestVersion = withLatestFlag[primaryIdx] ?? null;
  const previousVersions = withLatestFlag
    .filter((_, idx) => idx !== primaryIdx)
    .reverse();

  const versionsNewestFirst = latestVersion
    ? [latestVersion, ...previousVersions]
    : [];

  return {
    hasAudioVersions: withLatestFlag.length > 0,
    totalVersionsCount: withLatestFlag.length,
    hasFinalMaster: withLatestFlag.some((v) => v.isFinalMaster),
    latestVersion,
    previousVersions,
    versionsNewestFirst,
    versionsChronological: withLatestFlag,
    progressionChainText: withLatestFlag.map((v) => v.versionCode).join(' → '),
  };
}

/**
 * При чтении `.data/orders-crm.json` обновляет стартовые seed-заказы версионированными файлами (`v1`, `v2`, `master`),
 * если в сохранённой копии остались неразмеченные демо-файлы предыдущей схемы, сохраняя любые загруженные продюсером файлы.
 */
export function mergeSeedOrderDeliverablesWithVersions(
  persistedDeliverables: readonly OrderDeliverableFile[] | undefined,
  seedDeliverables: readonly OrderDeliverableFile[] | undefined
): OrderDeliverableFile[] {
  const seedList = seedDeliverables ? [...seedDeliverables] : [];
  if (persistedDeliverables === undefined) {
    return seedList;
  }

  const persistedList = [...persistedDeliverables];
  if (seedList.length === 0) {
    return persistedList;
  }

  const seedHasExplicitVersions = seedList.some((d) => Boolean(d.versionCode));
  if (!seedHasExplicitVersions) {
    return persistedList;
  }

  const persistedSeedItems = persistedList.filter((d) =>
    d.id.startsWith('deliv-seed-')
  );
  const customUploadedItems = persistedList.filter(
    (d) => !d.id.startsWith('deliv-seed-')
  );

  // Если ни у одного сохранённого seed-файла ещё нет versionCode (или список был пуст до добавления демо-версий v1/v2),
  // подставляем актуальные seed-итерации, не теряя пользовательские загрузки продюсера.
  const alreadyMigratedToVersions = persistedSeedItems.some((d) =>
    Boolean(d.versionCode)
  );
  if (!alreadyMigratedToVersions) {
    return [...customUploadedItems, ...seedList];
  }

  return persistedList;
}
