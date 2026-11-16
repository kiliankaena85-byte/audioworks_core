/**
 * Пошаговый конвейер согласования сценариев и аудиороликов (Вариант 10.3 — «Режиссёрский мандат»).
 *
 * Архитектурные инварианты:
 * 1. Внешний трек клиента состоит ровно из 3 этапов (без промежуточных кастингов голоса и музыки):
 *    01. Режиссёрский сценарий -> 02. Студийное производство -> 03. Готовый ролик и приёмка.
 * 2. В стоимость заказа зашит 1 сервисный раунд финальной доводки ролика после показа руководству
 *    (коррекция баланса/громкости/паузы по таймкоду ИЛИ до 1 замены музыкальной подложки — без доплат и микро-счетов).
 * 3. Изменение уже утверждённого текста (требующее перечитки диктора) или запросы сверх сервисного раунда
 *    направляются продюсеру для решения в 1 клик (лояльно в текущем счёте либо корректировка единого счёта).
 * 4. Звукорежиссёр никогда не входит в админ-панель и не видит цен, ИНН и контактов клиента:
 *    он получает стандартизированный техлист на почту / в Telegram с однокнопочной ссылкой прямой сдачи файла
 *    (/sound-drop?token=...) в буфер ОТК продюсера.
 */

import { scrubPersonalDataFromText } from '../security/rfLegalCompliance.ts';

export type ApprovalPipelinePhase =
  | 'script_drafting'
  | 'script_client_review'
  | 'studio_production'
  | 'spot_client_review'
  | 'revision_in_progress'
  | 'producer_escalation'
  | 'accepted';

export type ExternalClientStepId = '01_script' | '02_production' | '03_spot';

export type StudioKanbanColumnId =
  | 'col_script'
  | 'col_ready_for_sound'
  | 'col_with_engineer'
  | 'col_producer_qc'
  | 'col_client_acceptance';

export type WhoseTurnActor =
  | 'client'
  | 'producer'
  | 'sound_engineer'
  | 'completed';

export type SpotRevisionKind =
  | 'balance_timecode'
  | 'music_replacement'
  | 'text_change_escalation';

export type BroadcastSlotMatchStatus =
  | 'exact'
  | 'tolerance_warning'
  | 'out_of_slot'
  | 'unknown';

export interface ScriptConceptOption {
  id: string;
  label: string;
  title: string;
  bodyText: string;
  stressNotes: string;
  fz38Disclaimer: string;
  directorApproach: string;
  estimatedSec: number;
}

export interface ScriptDraftVersion {
  versionNumber: number;
  createdAt: string;
  targetSlotSec: number;
  concepts: ScriptConceptOption[];
  approvedConceptId: string | null;
  approvedAt: string | null;
  clientComment: string | null;
  clientCommentAt: string | null;
}

export interface LockedDirectorScript {
  versionNumber: number;
  conceptId: string;
  conceptTitle: string;
  bodyText: string;
  stressNotes: string;
  fz38Disclaimer: string;
  directorApproach: string;
  targetSlotSec: number;
  approvedAt: string;
}

export interface SpotRevisionRequest {
  id: string;
  createdAt: string;
  kind: SpotRevisionKind;
  timecodeSec: number | null;
  comment: string;
  usedIncludedServiceRound: boolean;
  status:
    | 'sent_to_engineer'
    | 'awaiting_producer'
    | 'approved_by_producer'
    | 'completed';
  producerResolutionMode?: 'loyal_included' | 'unified_invoice_adjusted' | null;
  producerResolutionNote?: string | null;
  resolvedAt?: string | null;
}

export interface SoundEngineerContact {
  id: string;
  name: string;
  specialization: string;
  email: string;
  telegramChatId: string;
  isDefault?: boolean;
}

export interface PendingEngineerTake {
  id: string;
  uploadedAt: string;
  engineerId: string;
  engineerName: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  measuredDurationSec: number | null;
  targetSlotSec: number;
  slotMatchStatus: BroadcastSlotMatchStatus;
  engineerNote: string;
  status: 'pending_qc' | 'published' | 'archived';
  publishedDeliverableId?: string | null;
  publishedVersionCode?: string | null;
  publishedAt?: string | null;
}

export interface OrderApprovalWorkflow {
  targetSlotSec: number;
  phase: ApprovalPipelinePhase;
  scriptVersions: ScriptDraftVersion[];
  lockedScript: LockedDirectorScript | null;
  serviceRoundUsed: boolean;
  serviceRoundUsedAt: string | null;
  serviceRoundSummary: string | null;
  spotRevisions: SpotRevisionRequest[];
  assignedEngineerId: string | null;
  lastDispatchedToEngineerAt: string | null;
  lastDispatchChannelSummary: string | null;
  dropTokenGeneration: number;
  pendingEngineerTakes: PendingEngineerTake[];
  acceptedAt: string | null;
  acceptedDeliverableId: string | null;
}

export interface ClientApprovalWorkflowView {
  targetSlotSec: number;
  phase: ApprovalPipelinePhase;
  externalStep: ExternalClientStepId;
  whoseTurnActor: WhoseTurnActor;
  whoseTurnLabel: string;
  scriptVersions: ScriptDraftVersion[];
  lockedScript: LockedDirectorScript | null;
  serviceRoundUsed: boolean;
  serviceRoundUsedAt: string | null;
  serviceRoundSummary: string | null;
  spotRevisions: SpotRevisionRequest[];
  hasPendingQcTake: boolean;
  acceptedAt: string | null;
  acceptedDeliverableId: string | null;
}

export interface SoundDropTaskPublicView {
  orderNumber: string;
  targetSlotSec: number;
  engineerId: string;
  engineerName: string;
  phase: ApprovalPipelinePhase;
  lockedScript: LockedDirectorScript | null;
  activeRevisions: Array<{
    id: string;
    createdAt: string;
    kind: SpotRevisionKind;
    kindLabel: string;
    timecodeSec: number | null;
    comment: string;
    producerNote: string | null;
  }>;
  pendingTakesCount: number;
  lastUploadedAt: string | null;
}

export interface SoundDropTokenPayload {
  v: 1;
  orderId: string;
  orderNumber: string;
  engineerId: string;
  engineerName: string;
  gen: number;
  expMs: number;
}

export interface SoundEngineerEmailGrantPayload {
  v: 1;
  orderId: string;
  orderNumber: string;
  engineerId: string;
  engineerName: string;
  gen: number;
  expMs: number;
}

export type SoundEngineerEmailTriggerReason =
  | 'stage_changed'
  | 'script_approved'
  | 'revision_requested'
  | 'escalation_resolved'
  | 'manual_dispatch';

export interface SoundEngineerEmailNotificationRecord {
  id: string;
  createdAt: string;
  orderId: string;
  orderNumber: string;
  engineerId: string;
  engineerName: string;
  engineerEmail: string;
  recipientEmail?: string;
  previousStageLabel: string | null;
  currentStageLabel: string;
  triggerReason: SoundEngineerEmailTriggerReason;
  triggerSummary?: string;
  subject: string;
  plainBody: string;
  htmlBody: string;
  buttonLabel: string;
  emailActionPath: string;
  emailActionUrl: string;
  directDropPath?: string;
  directDropUrl?: string;
  deliveryStatus: 'delivered_webhook' | 'queued_outbox';
  deliveryState?: 'sent_webhook' | 'logged_preview' | 'skipped_no_email';
  deliveryDetail: string;
  clickedCount: number;
  lastClickedAt: string | null;
  lastIssuedDropUrl: string | null;
}

export const STUDIO_KANBAN_COLUMNS: readonly {
  id: StudioKanbanColumnId;
  stepCode: string;
  shortTitle: string;
  title: string;
  subtitle: string;
}[] = [
  {
    id: 'col_script',
    stepCode: '01',
    shortTitle: 'Сценарий',
    title: 'Режиссёрский сценарий',
    subtitle: 'Подготовка или ожидание утверждения текста клиентом',
  },
  {
    id: 'col_ready_for_sound',
    stepCode: '02',
    shortTitle: 'В запуск',
    title: 'Готов к запуску в звук',
    subtitle: 'Сценарий утверждён · отправка техлиста звукорежиссёру',
  },
  {
    id: 'col_with_engineer',
    stepCode: '03',
    shortTitle: 'У звукорежиссёра',
    title: 'В работе звукорежиссёра',
    subtitle: 'Техлист отправлен · ждём сдачу WAV/MP3 по прямой ссылке',
  },
  {
    id: 'col_producer_qc',
    stepCode: '04',
    shortTitle: 'ОТК и запросы',
    title: 'ОТК продюсера и запросы',
    subtitle: 'Проверка сданного дубля или решение по нестандартной правке',
  },
  {
    id: 'col_client_acceptance',
    stepCode: '05',
    shortTitle: 'На приёмке',
    title: 'На приёмке и принятые',
    subtitle: 'Ролик передан в личный кабинет клиента или закрыт',
  },
] as const;

export const SPOT_REVISION_KIND_LABELS: Record<SpotRevisionKind, string> = {
  balance_timecode: 'Баланс громкости, пауза или акцент по таймкоду',
  music_replacement: 'Замена музыкальной подложки (пожелание руководства)',
  text_change_escalation: 'Изменение утверждённого текста или доп. запрос продюсеру',
};

export function createDefaultSoundEngineerRoster(): SoundEngineerContact[] {
  return [
    {
      id: 'eng-gromov',
      name: 'Илья Громов',
      specialization: 'Рекламный эфирный мастеринг (−14 LUFS) и инфо-ролики',
      email: 'sound.gromov@fmworks.ru',
      telegramChatId: '',
      isDefault: true,
    },
    {
      id: 'eng-vetrov',
      name: 'Павел Ветров',
      specialization: 'Игровые ролики, актёрские диалоги и саунд-дизайн (SFX)',
      email: 'sound.vetrov@fmworks.ru',
      telegramChatId: '',
      isDefault: false,
    },
    {
      id: 'eng-krylov',
      name: 'Денис Крылов',
      specialization: 'Оперативный поток 24ч и эфирные ресайзы 15/20/30 с',
      email: 'sound.krylov@fmworks.ru',
      telegramChatId: '',
      isDefault: false,
    },
  ];
}

export function sanitizeSoundEngineerRoster(
  raw: unknown
): SoundEngineerContact[] {
  const defaults = createDefaultSoundEngineerRoster();
  if (!Array.isArray(raw) || raw.length === 0) {
    return defaults;
  }
  const cleaned: SoundEngineerContact[] = [];
  const seenIds = new Set<string>();

  for (const item of raw.slice(0, 20)) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Partial<SoundEngineerContact>;
    const id = String(rec.id || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 48);
    const name = String(rec.name || '').trim().slice(0, 80);
    const email = String(rec.email || '').trim().toLowerCase().slice(0, 120);
    if (!id || !name || seenIds.has(id)) continue;
    seenIds.add(id);
    cleaned.push({
      id,
      name,
      specialization: String(rec.specialization || 'Звукорежиссёр эфирного продакшна')
        .trim()
        .slice(0, 140),
      email,
      telegramChatId: String(rec.telegramChatId || '')
        .trim()
        .replace(/[^0-9A-Za-z_@-]/g, '')
        .slice(0, 64),
      isDefault: Boolean(rec.isDefault),
    });
  }

  if (cleaned.length === 0) {
    return defaults;
  }
  if (!cleaned.some((e) => e.isDefault)) {
    const first = cleaned[0];
    if (first) first.isDefault = true;
  }
  return cleaned;
}

/**
 * Оценивает эфирный хронометраж русскоязычного рекламного текста:
 * - основной текст читается в разборчивом темпе ~2.15 слова/сек;
 * - юридический дисклеймер ФЗ-38 читается в ускоренном чётком темпе ~3.2 слова/сек.
 */
export function estimateRussianScriptDurationSec(
  bodyText: string,
  fz38Disclaimer = ''
): {
  wordsCount: number;
  disclaimerWordsCount: number;
  estimatedSec: number;
} {
  const countWords = (input: string): number => {
    const normalized = (input || '')
      .replace(/\u0301/g, '')
      .replace(/[«»"“”„()[\]{}—–―/\\|•·]/g, ' ')
      .trim();
    if (!normalized) return 0;
    return normalized
      .split(/\s+/)
      .filter((token) => /[0-9A-Za-zА-Яа-яЁё]/.test(token)).length;
  };

  const wordsCount = countWords(bodyText);
  const disclaimerWordsCount = countWords(fz38Disclaimer);
  if (wordsCount === 0 && disclaimerWordsCount === 0) {
    return { wordsCount: 0, disclaimerWordsCount: 0, estimatedSec: 0 };
  }

  const rawSec = wordsCount / 2.15 + disclaimerWordsCount / 3.2 + 0.6;
  const estimatedSec = Math.max(1, Math.round(rawSec * 2) / 2);
  return {
    wordsCount,
    disclaimerWordsCount,
    estimatedSec,
  };
}

/**
 * Извлекает точный хронометраж несжатого WAV-файла (RIFF/WAVE PCM или IEEE Float)
 * с обходом служебных чанков вещательных DAW (JUNK, bext, LIST, iXML и др.).
 */
export function parseWavExactDurationSec(bytes: Uint8Array): number | null {
  if (!bytes || bytes.length < 44) return null;
  const readAscii4 = (offset: number): string =>
    String.fromCharCode(
      bytes[offset] ?? 0,
      bytes[offset + 1] ?? 0,
      bytes[offset + 2] ?? 0,
      bytes[offset + 3] ?? 0
    );
  const readUint32LE = (offset: number): number => {
    if (offset + 4 > bytes.length) return 0;
    return (
      ((bytes[offset] ?? 0) |
        ((bytes[offset + 1] ?? 0) << 8) |
        ((bytes[offset + 2] ?? 0) << 16) |
        ((bytes[offset + 3] ?? 0) << 24)) >>>
      0
    );
  };
  const readUint16LE = (offset: number): number => {
    if (offset + 2 > bytes.length) return 0;
    return ((bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8)) >>> 0;
  };

  if (readAscii4(0) !== 'RIFF' || readAscii4(8) !== 'WAVE') {
    return null;
  }

  let byteRate = 0;
  let sampleRate = 0;
  let blockAlign = 0;
  let dataBytes = 0;
  let offset = 12;

  while (offset + 8 <= bytes.length) {
    const chunkId = readAscii4(offset);
    const chunkSize = readUint32LE(offset + 4);
    const dataStart = offset + 8;

    if (chunkId === 'fmt ' && chunkSize >= 16 && dataStart + 16 <= bytes.length) {
      sampleRate = readUint32LE(dataStart + 4);
      byteRate = readUint32LE(dataStart + 8);
      blockAlign = readUint16LE(dataStart + 12);
    } else if (chunkId === 'data') {
      const availableBytes = Math.max(0, bytes.length - dataStart);
      dataBytes =
        chunkSize > 0 && chunkSize <= availableBytes
          ? chunkSize
          : chunkSize > 0
            ? chunkSize
            : availableBytes;
      break;
    }

    const paddedChunkSize = chunkSize + (chunkSize % 2);
    const nextOffset = dataStart + paddedChunkSize;
    if (nextOffset <= offset) break;
    offset = nextOffset;
  }

  const effectiveByteRate =
    byteRate > 0 ? byteRate : sampleRate > 0 && blockAlign > 0 ? sampleRate * blockAlign : 0;
  if (effectiveByteRate <= 0 || dataBytes <= 0) {
    return null;
  }

  const seconds = dataBytes / effectiveByteRate;
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.round(seconds * 100) / 100;
}

/**
 * Генерирует минимальный валидный моно WAV PCM 16-bit (8 000 Гц по умолчанию)
 * заданной точной длительности (для модульных тестов и проверки контроля хронометража).
 */
export function buildSyntheticSilentWavBytes(
  durationSec: number,
  sampleRate = 8000
): Uint8Array {
  const totalSamples = Math.max(1, Math.round(durationSec * sampleRate));
  const bytesPerSample = 2;
  const dataSize = totalSamples * bytesPerSample;
  const buffer = new Uint8Array(44 + dataSize);
  const view = new DataView(buffer.buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) {
      buffer[offset + i] = str.charCodeAt(i);
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // byteRate
  view.setUint16(32, bytesPerSample, true); // blockAlign
  view.setUint16(34, 16, true); // bitsPerSample
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  return buffer;
}

export function evaluateBroadcastSlotFit(
  measuredDurationSec: number | null | undefined,
  targetSlotSec: number
): {
  status: BroadcastSlotMatchStatus;
  deltaSec: number | null;
  badgeText: string;
} {
  if (
    typeof measuredDurationSec !== 'number' ||
    !Number.isFinite(measuredDurationSec) ||
    measuredDurationSec <= 0
  ) {
    return {
      status: 'unknown',
      deltaSec: null,
      badgeText: `Целевой слот ${targetSlotSec} с · длительность уточняется`,
    };
  }

  const roundedMeasured = Math.round(measuredDurationSec * 100) / 100;
  const deltaSec = Math.round((roundedMeasured - targetSlotSec) * 100) / 100;
  const absDelta = Math.abs(deltaSec);
  const formattedMeasured = roundedMeasured.toFixed(2).replace('.', ',');
  const sign = deltaSec > 0 ? '+' : '';
  const formattedDelta = `${sign}${deltaSec.toFixed(2).replace('.', ',')} с`;

  if (absDelta <= 0.05) {
    return {
      status: 'exact',
      deltaSec,
      badgeText: `${formattedMeasured} с · точное попадание в эфирный слот ${targetSlotSec} с (±0,05 с)`,
    };
  }

  if (absDelta <= 0.25) {
    return {
      status: 'tolerance_warning',
      deltaSec,
      badgeText: `${formattedMeasured} с (${formattedDelta} от слота ${targetSlotSec} с) · проверьте края файла`,
    };
  }

  return {
    status: 'out_of_slot',
    deltaSec,
    badgeText: `${formattedMeasured} с (${formattedDelta} от слота ${targetSlotSec} с) · вне эфирного норматива`,
  };
}

export function inferTargetSlotSecFromOrder(params: {
  formatLabel?: string | null;
  mediaPlanDurationSec?: number | null;
}): number {
  if (
    typeof params.mediaPlanDurationSec === 'number' &&
    params.mediaPlanDurationSec >= 5 &&
    params.mediaPlanDurationSec <= 90
  ) {
    return Math.round(params.mediaPlanDurationSec);
  }
  const match = String(params.formatLabel || '').match(/(\d{1,2})\s*сек/i);
  if (match && match[1]) {
    const parsed = Number.parseInt(match[1], 10);
    if (parsed >= 5 && parsed <= 90) {
      return parsed;
    }
  }
  return 20;
}

export function hasPendingQcTakes(workflow: OrderApprovalWorkflow): boolean {
  return workflow.pendingEngineerTakes.some((t) => t.status === 'pending_qc');
}

export function resolveExternalClientStep(
  workflow: OrderApprovalWorkflow
): ExternalClientStepId {
  switch (workflow.phase) {
    case 'script_drafting':
    case 'script_client_review':
      return '01_script';
    case 'studio_production':
      return '02_production';
    case 'spot_client_review':
    case 'revision_in_progress':
    case 'producer_escalation':
    case 'accepted':
      return '03_spot';
  }
}

export function resolveWhoseTurn(workflow: OrderApprovalWorkflow): {
  actor: WhoseTurnActor;
  labelForClient: string;
  labelForProducer: string;
} {
  if (workflow.phase === 'accepted') {
    return {
      actor: 'completed',
      labelForClient: 'Ролик принят · мастер и документы доступны',
      labelForProducer: 'Принят клиентом',
    };
  }

  if (hasPendingQcTakes(workflow)) {
    return {
      actor: 'producer',
      labelForClient: 'Финальный техконтроль продюсера перед выдачей',
      labelForProducer: 'Ваш ход: проверить файл от звукорежиссёра',
    };
  }

  switch (workflow.phase) {
    case 'script_drafting': {
      const latest = workflow.scriptVersions[0];
      const hasClientComment = Boolean(latest?.clientComment);
      return {
        actor: 'producer',
        labelForClient: hasClientComment
          ? 'В работе у продюсера: обновляем сценарий по вашему комментарию'
          : 'В работе у продюсера: подготовка режиссёрского сценария',
        labelForProducer: hasClientComment
          ? 'Ваш ход: выпустить обновлённую версию сценария'
          : 'Ваш ход: опубликовать режиссёрский сценарий',
      };
    }
    case 'script_client_review':
      return {
        actor: 'client',
        labelForClient: 'Ждём ваше решение: утвердите сценарий в запись',
        labelForProducer: 'Ход клиента: согласование сценария',
      };
    case 'studio_production':
      if (!workflow.lastDispatchedToEngineerAt) {
        return {
          actor: 'producer',
          labelForClient:
            'В работе студии: запись диктора, музыка и эфирный мастеринг',
          labelForProducer:
            'Ваш ход: отправить техлист звукорежиссёру',
        };
      }
      return {
        actor: 'sound_engineer',
        labelForClient:
          'В работе студии: запись диктора, музыка и эфирный мастеринг',
        labelForProducer: 'Ход звукорежиссёра: ждём готовый файл по ссылке',
      };
    case 'spot_client_review':
      return {
        actor: 'client',
        labelForClient: 'Ждём ваше решение: прослушайте и примите ролик',
        labelForProducer: 'Ход клиента: приёмка готового ролика',
      };
    case 'revision_in_progress':
      return {
        actor: 'sound_engineer',
        labelForClient: 'Доводка ролика в работе студии',
        labelForProducer: 'Доводка в работе звукорежиссёра',
      };
    case 'producer_escalation':
      return {
        actor: 'producer',
        labelForClient: 'На согласовании у продюсера студии',
        labelForProducer: 'Ваш ход: решение по запросу клиента сверх раунда',
      };
  }
}

export function resolveStudioKanbanColumn(
  workflow: OrderApprovalWorkflow
): StudioKanbanColumnId {
  if (workflow.phase === 'accepted' || workflow.phase === 'spot_client_review') {
    return hasPendingQcTakes(workflow) ? 'col_producer_qc' : 'col_client_acceptance';
  }
  if (
    workflow.phase === 'producer_escalation' ||
    hasPendingQcTakes(workflow)
  ) {
    return 'col_producer_qc';
  }
  if (
    workflow.phase === 'script_drafting' ||
    workflow.phase === 'script_client_review'
  ) {
    return 'col_script';
  }
  if (workflow.phase === 'studio_production') {
    return workflow.lastDispatchedToEngineerAt
      ? 'col_with_engineer'
      : 'col_ready_for_sound';
  }
  return workflow.lastDispatchedToEngineerAt
    ? 'col_with_engineer'
    : 'col_ready_for_sound';
}

export function toClientApprovalWorkflowView(
  workflow: OrderApprovalWorkflow
): ClientApprovalWorkflowView {
  const turn = resolveWhoseTurn(workflow);
  return {
    targetSlotSec: workflow.targetSlotSec,
    phase: workflow.phase,
    externalStep: resolveExternalClientStep(workflow),
    whoseTurnActor: turn.actor,
    whoseTurnLabel: turn.labelForClient,
    scriptVersions: workflow.scriptVersions,
    lockedScript: workflow.lockedScript,
    serviceRoundUsed: workflow.serviceRoundUsed,
    serviceRoundUsedAt: workflow.serviceRoundUsedAt,
    serviceRoundSummary: workflow.serviceRoundSummary,
    spotRevisions: workflow.spotRevisions,
    hasPendingQcTake: hasPendingQcTakes(workflow),
    acceptedAt: workflow.acceptedAt,
    acceptedDeliverableId: workflow.acceptedDeliverableId,
  };
}

export function toSoundDropTaskPublicView(params: {
  orderNumber: string;
  engineerId: string;
  engineerName: string;
  workflow: OrderApprovalWorkflow;
}): SoundDropTaskPublicView {
  const { orderNumber, engineerId, engineerName, workflow } = params;
  const activeRevisions = workflow.spotRevisions
    .filter(
      (rev) =>
        rev.status === 'sent_to_engineer' || rev.status === 'approved_by_producer'
    )
    .map((rev) => ({
      id: rev.id,
      createdAt: rev.createdAt,
      kind: rev.kind,
      kindLabel: SPOT_REVISION_KIND_LABELS[rev.kind],
      timecodeSec: rev.timecodeSec,
      comment: rev.comment,
      producerNote: rev.producerResolutionNote ?? null,
    }));

  const latestTake = workflow.pendingEngineerTakes[0];

  return {
    orderNumber,
    targetSlotSec: workflow.targetSlotSec,
    engineerId,
    engineerName,
    phase: workflow.phase,
    lockedScript: workflow.lockedScript,
    activeRevisions,
    pendingTakesCount: workflow.pendingEngineerTakes.length,
    lastUploadedAt: latestTake?.uploadedAt ?? null,
  };
}

// ============================================================================
// Чистые переходы состояний конвейера согласования (State Reducers)
// ============================================================================

export interface PublishScriptConceptInput {
  id?: string;
  label?: string;
  title: string;
  bodyText: string;
  stressNotes?: string;
  fz38Disclaimer?: string;
  directorApproach: string;
}

export function applyPublishScriptDraft(
  workflow: OrderApprovalWorkflow,
  input: {
    targetSlotSec?: number;
    concepts: readonly PublishScriptConceptInput[];
  },
  nowIso: string
): OrderApprovalWorkflow {
  const targetSlotSec =
    typeof input.targetSlotSec === 'number' &&
    input.targetSlotSec >= 5 &&
    input.targetSlotSec <= 90
      ? Math.round(input.targetSlotSec)
      : workflow.targetSlotSec;

  const validConcepts: ScriptConceptOption[] = input.concepts
    .slice(0, 3)
    .map((raw, idx) => {
      const bodyText = String(raw.bodyText || '').trim().slice(0, 2400);
      const fz38Disclaimer = String(raw.fz38Disclaimer || '').trim().slice(0, 600);
      const est = estimateRussianScriptDurationSec(bodyText, fz38Disclaimer);
      const defaultLabel =
        input.concepts.length === 1
          ? 'Основная концепция'
          : `Вариант ${idx + 1}`;
      return {
        id:
          String(raw.id || '').trim() ||
          `concept-v${workflow.scriptVersions.length + 1}-${idx + 1}`,
        label: String(raw.label || defaultLabel).trim().slice(0, 48),
        title:
          String(raw.title || '').trim().slice(0, 140) ||
          `Режиссёрский сценарий (${targetSlotSec} сек)`,
        bodyText,
        stressNotes: String(raw.stressNotes || '').trim().slice(0, 400),
        fz38Disclaimer,
        directorApproach:
          String(raw.directorApproach || '').trim().slice(0, 800) ||
          'Подбор профильного диктора, коммерческой лицензионной фонограммы и мастеринг −14 LUFS по режиссёрскому решению студии.',
        estimatedSec: est.estimatedSec,
      };
    })
    .filter((c) => c.bodyText.length >= 5);

  if (validConcepts.length === 0) {
    throw new Error('Укажите текст режиссёрского сценария перед отправкой клиенту');
  }

  const nextVersionNumber =
    workflow.scriptVersions.reduce(
      (maxV, item) => Math.max(maxV, item.versionNumber),
      0
    ) + 1;

  const nextDraft: ScriptDraftVersion = {
    versionNumber: nextVersionNumber,
    createdAt: nowIso,
    targetSlotSec,
    concepts: validConcepts,
    approvedConceptId: null,
    approvedAt: null,
    clientComment: null,
    clientCommentAt: null,
  };

  return {
    ...workflow,
    targetSlotSec,
    phase: 'script_client_review',
    scriptVersions: [nextDraft, ...workflow.scriptVersions].slice(0, 12),
  };
}

export function applyClientScriptDecision(
  workflow: OrderApprovalWorkflow,
  decision:
    | { action: 'approve'; conceptId?: string }
    | { action: 'request_changes'; comment: string },
  nowIso: string
): OrderApprovalWorkflow {
  const latestVersion = workflow.scriptVersions[0];
  if (!latestVersion || latestVersion.concepts.length === 0) {
    throw new Error('Сценарий ещё готовится продюсером и пока не опубликован');
  }

  if (decision.action === 'approve') {
    const chosenConcept =
      (decision.conceptId
        ? latestVersion.concepts.find((c) => c.id === decision.conceptId)
        : undefined) ?? latestVersion.concepts[0];
    if (!chosenConcept) {
      throw new Error('Выбранный вариант сценария не найден');
    }

    const updatedLatest: ScriptDraftVersion = {
      ...latestVersion,
      approvedConceptId: chosenConcept.id,
      approvedAt: nowIso,
    };

    const lockedScript: LockedDirectorScript = {
      versionNumber: latestVersion.versionNumber,
      conceptId: chosenConcept.id,
      conceptTitle: chosenConcept.title,
      bodyText: chosenConcept.bodyText,
      stressNotes: chosenConcept.stressNotes,
      fz38Disclaimer: chosenConcept.fz38Disclaimer,
      directorApproach: chosenConcept.directorApproach,
      targetSlotSec: latestVersion.targetSlotSec,
      approvedAt: nowIso,
    };

    return {
      ...workflow,
      phase: 'studio_production',
      lockedScript,
      scriptVersions: [updatedLatest, ...workflow.scriptVersions.slice(1)],
    };
  }

  const cleanComment = String(decision.comment || '').trim().slice(0, 1200);
  if (cleanComment.length < 3) {
    throw new Error('Опишите замечание к тексту сценария (минимум 3 символа)');
  }

  const updatedLatest: ScriptDraftVersion = {
    ...latestVersion,
    clientComment: cleanComment,
    clientCommentAt: nowIso,
  };

  return {
    ...workflow,
    phase: 'script_drafting',
    scriptVersions: [updatedLatest, ...workflow.scriptVersions.slice(1)],
  };
}

export function applyClientSpotDecision(
  workflow: OrderApprovalWorkflow,
  decision:
    | { action: 'accept'; deliverableId?: string | null }
    | {
        action: 'request_revision';
        revisionId: string;
        kind: SpotRevisionKind;
        timecodeSec?: number | null;
        comment: string;
      },
  nowIso: string
): {
  workflow: OrderApprovalWorkflow;
  routedTo: 'accepted' | 'sound_engineer_included_round' | 'producer_escalation';
} {
  if (decision.action === 'accept') {
    const updatedRevisions = workflow.spotRevisions.map((r) =>
      r.status !== 'completed' ? { ...r, status: 'completed' as const } : r
    );
    return {
      workflow: {
        ...workflow,
        phase: 'accepted',
        acceptedAt: nowIso,
        acceptedDeliverableId:
          decision.deliverableId ?? workflow.acceptedDeliverableId ?? null,
        spotRevisions: updatedRevisions,
      },
      routedTo: 'accepted',
    };
  }

  const cleanComment = String(decision.comment || '').trim().slice(0, 1200);
  if (cleanComment.length < 3) {
    throw new Error('Уточните пожелание к ролику (минимум 3 символа)');
  }

  const timecodeSec =
    typeof decision.timecodeSec === 'number' &&
    Number.isFinite(decision.timecodeSec) &&
    decision.timecodeSec >= 0 &&
    decision.timecodeSec <= 180
      ? Math.round(decision.timecodeSec * 10) / 10
      : null;

  const isEligibleForIncludedServiceRound =
    !workflow.serviceRoundUsed &&
    (decision.kind === 'balance_timecode' ||
      decision.kind === 'music_replacement');

  if (isEligibleForIncludedServiceRound) {
    const rev: SpotRevisionRequest = {
      id: decision.revisionId,
      createdAt: nowIso,
      kind: decision.kind,
      timecodeSec,
      comment: cleanComment,
      usedIncludedServiceRound: true,
      status: 'sent_to_engineer',
      producerResolutionMode: null,
      producerResolutionNote: null,
      resolvedAt: null,
    };

    const summaryLabel =
      decision.kind === 'music_replacement'
        ? 'Использован включённый сервисный раунд: замена музыкальной подложки без доплат'
        : 'Использован включённый сервисный раунд: коррекция баланса и акцентов без доплат';

    return {
      workflow: {
        ...workflow,
        phase: 'revision_in_progress',
        serviceRoundUsed: true,
        serviceRoundUsedAt: nowIso,
        serviceRoundSummary: summaryLabel,
        spotRevisions: [rev, ...workflow.spotRevisions].slice(0, 20),
      },
      routedTo: 'sound_engineer_included_round',
    };
  }

  const escalatedRev: SpotRevisionRequest = {
    id: decision.revisionId,
    createdAt: nowIso,
    kind: decision.kind,
    timecodeSec,
    comment: cleanComment,
    usedIncludedServiceRound: false,
    status: 'awaiting_producer',
    producerResolutionMode: null,
    producerResolutionNote: null,
    resolvedAt: null,
  };

  return {
    workflow: {
      ...workflow,
      phase: 'producer_escalation',
      spotRevisions: [escalatedRev, ...workflow.spotRevisions].slice(0, 20),
    },
    routedTo: 'producer_escalation',
  };
}

export function applyProducerEscalationResolution(
  workflow: OrderApprovalWorkflow,
  params: {
    revisionId?: string;
    mode: 'loyal_included' | 'unified_invoice_adjusted';
    note?: string;
  },
  nowIso: string
): OrderApprovalWorkflow {
  const cleanNote = String(params.note || '').trim().slice(0, 600);
  const nextRevisions = workflow.spotRevisions.map((rev, idx) => {
    const matches = params.revisionId
      ? rev.id === params.revisionId
      : rev.status === 'awaiting_producer' || idx === 0;
    if (!matches || rev.status === 'completed') return rev;
    return {
      ...rev,
      status: 'approved_by_producer' as const,
      producerResolutionMode: params.mode,
      producerResolutionNote:
        cleanNote ||
        (params.mode === 'loyal_included'
          ? 'Согласовано продюсером без изменения стоимости заказа'
          : 'Согласовано продюсером с обновлением суммы единого счёта'),
      resolvedAt: nowIso,
    };
  });

  return {
    ...workflow,
    phase: 'revision_in_progress',
    spotRevisions: nextRevisions,
  };
}

export function applyRecordEngineerTake(
  workflow: OrderApprovalWorkflow,
  takeInput: {
    id: string;
    engineerId: string;
    engineerName: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
    measuredDurationSec: number | null;
    engineerNote?: string;
  },
  nowIso: string
): OrderApprovalWorkflow {
  const fit = evaluateBroadcastSlotFit(
    takeInput.measuredDurationSec,
    workflow.targetSlotSec
  );
  const take: PendingEngineerTake = {
    id: takeInput.id,
    uploadedAt: nowIso,
    engineerId: takeInput.engineerId,
    engineerName: takeInput.engineerName,
    fileName: takeInput.fileName,
    mimeType: takeInput.mimeType,
    sizeBytes: takeInput.sizeBytes,
    storageKey: takeInput.storageKey,
    measuredDurationSec: takeInput.measuredDurationSec,
    targetSlotSec: workflow.targetSlotSec,
    slotMatchStatus: fit.status,
    engineerNote: String(takeInput.engineerNote || '').trim().slice(0, 500),
    status: 'pending_qc',
    publishedDeliverableId: null,
    publishedVersionCode: null,
    publishedAt: null,
  };

  return {
    ...workflow,
    pendingEngineerTakes: [take, ...workflow.pendingEngineerTakes].slice(0, 15),
  };
}

export function applyPublishEngineerTakeToClient(
  workflow: OrderApprovalWorkflow,
  params: {
    takeId: string;
    deliverableId: string;
    versionCode: string;
    markAccepted?: boolean;
  },
  nowIso: string
): OrderApprovalWorkflow {
  const nextTakes = workflow.pendingEngineerTakes.map((t) =>
    t.id === params.takeId
      ? {
          ...t,
          status: 'published' as const,
          publishedDeliverableId: params.deliverableId,
          publishedVersionCode: params.versionCode,
          publishedAt: nowIso,
        }
      : t
  );

  const nextRevisions = workflow.spotRevisions.map((r) =>
    r.status === 'sent_to_engineer' || r.status === 'approved_by_producer'
      ? { ...r, status: 'completed' as const, resolvedAt: r.resolvedAt ?? nowIso }
      : r
  );

  return {
    ...workflow,
    phase: params.markAccepted ? 'accepted' : 'spot_client_review',
    acceptedAt: params.markAccepted ? nowIso : workflow.acceptedAt,
    acceptedDeliverableId: params.markAccepted
      ? params.deliverableId
      : workflow.acceptedDeliverableId,
    pendingEngineerTakes: nextTakes,
    spotRevisions: nextRevisions,
  };
}

// ============================================================================
// Криптографический токен прямой сдачи файла (/sound-drop?token=...) и Техлист
// ============================================================================

function encodeUtf8Base64Url(input: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(input, 'utf8').toString('base64url');
  }
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeUtf8Base64Url(encoded: string): string | null {
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(encoded, 'base64url').toString('utf8');
    }
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function issueSoundDropTokenWithSigner(
  payload: Omit<SoundDropTokenPayload, 'v'>,
  signHmacBase64Url: (signingInput: string) => string
): string {
  const fullPayload: SoundDropTokenPayload = {
    v: 1,
    orderId: payload.orderId,
    orderNumber: payload.orderNumber,
    engineerId: payload.engineerId,
    engineerName: payload.engineerName.slice(0, 64),
    gen: payload.gen,
    expMs: payload.expMs,
  };
  const bodyPart = encodeUtf8Base64Url(JSON.stringify(fullPayload));
  const sigPart = signHmacBase64Url(`sound-drop-v1:${bodyPart}`);
  return `${bodyPart}.${sigPart}`;
}

export function verifySoundDropTokenWithSigner(
  rawToken: string | null | undefined,
  signHmacBase64Url: (signingInput: string) => string,
  nowMs: number,
  options?: { expectedGeneration?: number }
):
  | { ok: true; payload: SoundDropTokenPayload }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' | 'revoked' } {
  if (!rawToken || typeof rawToken !== 'string') {
    return { ok: false, reason: 'malformed' };
  }
  const trimmed = rawToken.trim();
  const dotIdx = trimmed.indexOf('.');
  if (dotIdx <= 0 || dotIdx === trimmed.length - 1) {
    return { ok: false, reason: 'malformed' };
  }

  const bodyPart = trimmed.slice(0, dotIdx);
  const sigPart = trimmed.slice(dotIdx + 1);
  const expectedSig = signHmacBase64Url(`sound-drop-v1:${bodyPart}`);

  if (sigPart.length !== expectedSig.length) {
    return { ok: false, reason: 'bad_signature' };
  }
  let diff = 0;
  for (let i = 0; i < sigPart.length; i += 1) {
    diff |= sigPart.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }
  if (diff !== 0) {
    return { ok: false, reason: 'bad_signature' };
  }

  const jsonStr = decodeUtf8Base64Url(bodyPart);
  if (!jsonStr) {
    return { ok: false, reason: 'malformed' };
  }

  try {
    const parsed = JSON.parse(jsonStr) as Partial<SoundDropTokenPayload>;
    if (
      parsed.v !== 1 ||
      typeof parsed.orderId !== 'string' ||
      typeof parsed.orderNumber !== 'string' ||
      typeof parsed.engineerId !== 'string' ||
      typeof parsed.engineerName !== 'string' ||
      typeof parsed.gen !== 'number' ||
      typeof parsed.expMs !== 'number'
    ) {
      return { ok: false, reason: 'malformed' };
    }

    if (nowMs > parsed.expMs) {
      return { ok: false, reason: 'expired' };
    }

    if (
      typeof options?.expectedGeneration === 'number' &&
      parsed.gen !== options.expectedGeneration
    ) {
      return { ok: false, reason: 'revoked' };
    }

    return {
      ok: true,
      payload: parsed as SoundDropTokenPayload,
    };
  } catch {
    return { ok: false, reason: 'malformed' };
  }
}

export function issueSoundEngineerEmailGrantWithSigner(
  payload: Omit<SoundEngineerEmailGrantPayload, 'v'>,
  signHmacBase64Url: (signingInput: string) => string
): string {
  const fullPayload: SoundEngineerEmailGrantPayload = {
    v: 1,
    orderId: payload.orderId,
    orderNumber: payload.orderNumber,
    engineerId: payload.engineerId,
    engineerName: payload.engineerName.slice(0, 64),
    gen: payload.gen,
    expMs: payload.expMs,
  };
  const bodyPart = encodeUtf8Base64Url(JSON.stringify(fullPayload));
  const sigPart = signHmacBase64Url(`sound-email-grant-v1:${bodyPart}`);
  return `${bodyPart}.${sigPart}`;
}

export function verifySoundEngineerEmailGrantWithSigner(
  rawGrant: string | null | undefined,
  signHmacBase64Url: (signingInput: string) => string,
  nowMs: number,
  options?: { expectedGeneration?: number }
):
  | { ok: true; payload: SoundEngineerEmailGrantPayload }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' | 'revoked' } {
  if (!rawGrant || typeof rawGrant !== 'string') {
    return { ok: false, reason: 'malformed' };
  }
  const trimmed = rawGrant.trim();
  const dotIdx = trimmed.indexOf('.');
  if (dotIdx <= 0 || dotIdx === trimmed.length - 1) {
    return { ok: false, reason: 'malformed' };
  }

  const bodyPart = trimmed.slice(0, dotIdx);
  const sigPart = trimmed.slice(dotIdx + 1);
  const expectedSig = signHmacBase64Url(`sound-email-grant-v1:${bodyPart}`);

  if (sigPart.length !== expectedSig.length) {
    return { ok: false, reason: 'bad_signature' };
  }
  let diff = 0;
  for (let i = 0; i < sigPart.length; i += 1) {
    diff |= sigPart.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }
  if (diff !== 0) {
    return { ok: false, reason: 'bad_signature' };
  }

  const jsonStr = decodeUtf8Base64Url(bodyPart);
  if (!jsonStr) {
    return { ok: false, reason: 'malformed' };
  }

  try {
    const parsed = JSON.parse(jsonStr) as Partial<SoundEngineerEmailGrantPayload>;
    if (
      parsed.v !== 1 ||
      typeof parsed.orderId !== 'string' ||
      typeof parsed.orderNumber !== 'string' ||
      typeof parsed.engineerId !== 'string' ||
      typeof parsed.engineerName !== 'string' ||
      typeof parsed.gen !== 'number' ||
      typeof parsed.expMs !== 'number'
    ) {
      return { ok: false, reason: 'malformed' };
    }

    if (nowMs > parsed.expMs) {
      return { ok: false, reason: 'expired' };
    }

    if (
      typeof options?.expectedGeneration === 'number' &&
      parsed.gen !== options.expectedGeneration
    ) {
      return { ok: false, reason: 'revoked' };
    }

    return {
      ok: true,
      payload: parsed as SoundEngineerEmailGrantPayload,
    };
  } catch {
    return { ok: false, reason: 'malformed' };
  }
}

function escapeHtmlEmailText(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const SOUND_ENGINEER_EMAIL_CTA_LABEL = 'Сдать файл на проверку';

/**
 * Стандартизированный техлист и e-mail уведомление для звукорежиссёра (Почта / Telegram).
 * Строго без цен, сумм счёта, ИНН, телефона и почты клиента!
 * Содержит активную кнопку «Сдать файл на проверку», которая при нажатии генерирует
 * уникальный токен прямой загрузки мастер-файла без авторизации в админ-панели.
 */
export function formatSoundEngineerProductionSheet(params: {
  orderNumber: string;
  engineer: SoundEngineerContact;
  workflow: OrderApprovalWorkflow;
  briefFallbackText: string;
  directDropUrl: string;
  emailActionUrl?: string;
  previousStageLabel?: string | null;
  currentStageLabel?: string | null;
  triggerSummary?: string | null;
}): {
  subject: string;
  plainBody: string;
  htmlBody: string;
  buttonLabel: string;
  actionButtonUrl: string;
  telegramMessage: string;
  mailtoHref: string;
} {
  const {
    orderNumber,
    engineer,
    workflow,
    briefFallbackText,
    directDropUrl,
    emailActionUrl,
    previousStageLabel,
    currentStageLabel,
    triggerSummary,
  } = params;
  const activeRevs = workflow.spotRevisions.filter(
    (r) => r.status === 'sent_to_engineer' || r.status === 'approved_by_producer'
  );
  const isRevision = activeRevs.length > 0;
  const script =
    workflow.lockedScript ?? workflow.scriptVersions[0]?.concepts[0] ?? null;

  const buttonLabel = SOUND_ENGINEER_EMAIL_CTA_LABEL;
  const actionButtonUrl = (emailActionUrl || directDropUrl).trim();

  const stageSubjectSuffix = currentStageLabel
    ? ` · Статус: ${currentStageLabel}`
    : '';
  const subject = isRevision
    ? `[FMWorks · Правка] Заказ #${orderNumber} · Слот ровно ${workflow.targetSlotSec},00 с${stageSubjectSuffix}`
    : `[FMWorks · Статус заказа #${orderNumber}] Слот ровно ${workflow.targetSlotSec},00 с${stageSubjectSuffix}`;

  const statusTransitionLine =
    previousStageLabel &&
    currentStageLabel &&
    previousStageLabel !== currentStageLabel
      ? `Смена статуса заказа: ${previousStageLabel} → ${currentStageLabel}`
      : currentStageLabel
        ? `Актуальный статус заказа: ${currentStageLabel}`
        : `Этап конвейера: ${
            isRevision ? 'Доводка аудиоролика' : 'Студийное производство и мастеринг'
          }`;

  const lines: string[] = [
    `FMWorks Studio · E-mail уведомление звукорежиссёру`,
    `Исполнитель смены: ${engineer.name}`,
    `Заказ: #${orderNumber}`,
    statusTransitionLine,
  ];

  if (triggerSummary && triggerSummary.trim()) {
    lines.push(`Основание уведомления: ${triggerSummary.trim()}`);
  }

  lines.push(
    `Строгий эфирный хронометраж: ${workflow.targetSlotSec},00 сек (допуск ±0,05 сек)`,
    `Формат сдачи: WAV PCM 44.1/48 кГц, 16/24 bit, Stereo · громкость −14 LUFS, True Peak ≤ −0.5 dBTP`,
    ``
  );

  if (isRevision) {
    lines.push(`ЗАДАЧА НА ДОВОДКУ РОЛИКА:`);
    for (const rev of activeRevs) {
      const tc =
        typeof rev.timecodeSec === 'number'
          ? ` [таймкод ${rev.timecodeSec.toFixed(1)} с]`
          : '';
      lines.push(`• ${SPOT_REVISION_KIND_LABELS[rev.kind]}${tc}: ${rev.comment}`);
      if (rev.producerResolutionNote) {
        lines.push(`  Комментарий продюсера: ${rev.producerResolutionNote}`);
      }
    }
    lines.push(``);
  }

  const scriptTitleText = script
    ? 'conceptTitle' in script
      ? script.conceptTitle
      : script.title
    : '';
  const scriptBodyText = script
    ? script.bodyText
    : briefFallbackText ||
      'Подготовка эфирного рекламного ролика по стандарту студии.';

  if (script) {
    lines.push(`УТВЕРЖДЁННЫЙ ТЕКСТ СЦЕНАРИЯ (${scriptTitleText}):`);
    lines.push(script.bodyText);
    if (script.stressNotes) {
      lines.push(`Ударения и произношение: ${script.stressNotes}`);
    }
    if (script.fz38Disclaimer) {
      lines.push(
        `Обязательный дисклеймер ФЗ-38 (внутри слота): ${script.fz38Disclaimer}`
      );
    }
    lines.push(``);
    lines.push(`РЕЖИССЁРСКОЕ РЕШЕНИЕ СТУДИИ (ГОЛОС И МУЗЫКА):`);
    lines.push(script.directorApproach);
  } else {
    lines.push(`КРАТКАЯ ЗАДАЧА ПРОЕКТА:`);
    lines.push(scriptBodyText);
  }

  lines.push(
    ``,
    `АКТИВНАЯ КНОПКА В ПИСЬМЕ — «${buttonLabel.toUpperCase()}» (ПРЯМАЯ ЗАГРУЗКА МАСТЕР-ФАЙЛА БЕЗ АВТОРИЗАЦИИ В АДМИН-ПАНЕЛИ):`,
    actionButtonUrl
  );

  const tgLines: string[] = [
    `FMWorks Studio · Производственное задание звукорежиссёру (152-ФЗ)`,
    `Исполнитель смены: ${engineer.name}`,
    `Заказ: #${orderNumber}`,
    statusTransitionLine,
  ];
  if (triggerSummary && triggerSummary.trim()) {
    tgLines.push(
      `Основание уведомления: ${scrubPersonalDataFromText(triggerSummary.trim())}`
    );
  }
  tgLines.push(
    `Строгий эфирный хронометраж: ${workflow.targetSlotSec},00 сек (допуск ±0,05 сек)`,
    `Формат сдачи: WAV PCM 44.1/48 кГц, 16/24 bit, Stereo · громкость −14 LUFS, True Peak ≤ −0.5 dBTP`,
    ``
  );
  if (isRevision) {
    tgLines.push(`ЗАДАЧА НА ДОВОДКУ РОЛИКА:`);
    for (const rev of activeRevs) {
      const tc =
        typeof rev.timecodeSec === 'number'
          ? ` [таймкод ${rev.timecodeSec.toFixed(1)} с]`
          : '';
      tgLines.push(
        `• ${SPOT_REVISION_KIND_LABELS[rev.kind]}${tc}: ${scrubPersonalDataFromText(rev.comment)}`
      );
      if (rev.producerResolutionNote) {
        tgLines.push(
          `  Комментарий продюсера: ${scrubPersonalDataFromText(rev.producerResolutionNote)}`
        );
      }
    }
    tgLines.push(``);
  }
  if (script) {
    tgLines.push(`УТВЕРЖДЁННЫЙ ТЕКСТ СЦЕНАРИЯ (${scriptTitleText}):`);
    tgLines.push(script.bodyText);
    if (script.stressNotes) {
      tgLines.push(`Ударения и произношение: ${script.stressNotes}`);
    }
    if (script.fz38Disclaimer) {
      tgLines.push(
        `Обязательный дисклеймер ФЗ-38 (внутри слота): ${script.fz38Disclaimer}`
      );
    }
    tgLines.push(``);
    tgLines.push(`РЕЖИССЁРСКОЕ РЕШЕНИЕ СТУДИИ (ГОЛОС И МУЗЫКА):`);
    tgLines.push(script.directorApproach);
  } else {
    tgLines.push(`КРАТКАЯ ЗАДАЧА ПРОЕКТА:`);
    tgLines.push(scrubPersonalDataFromText(scriptBodyText));
  }
  tgLines.push(``, `Загрузить готовый мастер без входа в админку:`, actionButtonUrl);

  const plainBody = lines.join('\n');
  const telegramMessage = tgLines.join('\n');
  const mailtoHref = engineer.email
    ? `mailto:${encodeURIComponent(engineer.email)}?subject=${encodeURIComponent(
        subject
      )}&body=${encodeURIComponent(plainBody)}`
    : '';

  const revisionsHtmlBlock = isRevision
    ? `<div style="margin:16px 0;padding:14px 16px;background:#FFF7ED;border:1px solid #FDBA74;border-radius:10px;">
        <div style="font-size:12px;font-weight:700;color:#9A3412;margin-bottom:6px;">Поправки к ролику по таймкоду:</div>
        <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.5;color:#111111;">
          ${activeRevs
            .map((rev) => {
              const tc =
                typeof rev.timecodeSec === 'number'
                  ? ` <strong>[${rev.timecodeSec.toFixed(1)} с]</strong>`
                  : '';
              const note = rev.producerResolutionNote
                ? `<div style="font-size:12px;color:#57534E;margin-top:2px;">Продюсер: ${escapeHtmlEmailText(
                    rev.producerResolutionNote
                  )}</div>`
                : '';
              return `<li style="margin-bottom:6px;"><strong>${escapeHtmlEmailText(
                SPOT_REVISION_KIND_LABELS[rev.kind]
              )}</strong>${tc}: ${escapeHtmlEmailText(rev.comment)}${note}</li>`;
            })
            .join('')}
        </ul>
      </div>`
    : '';

  const htmlBody = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtmlEmailText(subject)}</title>
</head>
<body style="margin:0;padding:24px;background:#F7F6F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111111;">
  <div style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid rgba(17,17,17,0.12);border-radius:16px;padding:28px;">
    <div style="font-size:12px;color:#666666;margin-bottom:6px;">
      FMWorks Studio · Заказ <strong>#${escapeHtmlEmailText(orderNumber)}</strong> · Исполнитель: <strong>${escapeHtmlEmailText(engineer.name)}</strong>
    </div>
    <h1 style="margin:0 0 10px 0;font-size:20px;line-height:1.3;color:#111111;">
      ${escapeHtmlEmailText(statusTransitionLine)}
    </h1>
    ${
      triggerSummary
        ? `<p style="margin:0 0 14px 0;font-size:13px;line-height:1.5;color:#444444;">${escapeHtmlEmailText(
            triggerSummary
          )}</p>`
        : ''
    }
    <div style="padding:12px 14px;background:#F7F6F2;border-radius:10px;font-size:13px;line-height:1.55;color:#111111;margin-bottom:16px;">
      <div><strong>Строгий эфирный хронометраж:</strong> ${workflow.targetSlotSec},00 с (допуск ±0,05 с)</div>
      <div><strong>Технический стандарт:</strong> WAV PCM 44.1/48 кГц · −14 LUFS · True Peak ≤ −0.5 dBTP</div>
    </div>
    ${revisionsHtmlBlock}
    <div style="padding:16px;background:#F7F6F2;border-radius:12px;margin-bottom:20px;">
      <div style="font-size:12px;font-weight:700;color:#111111;margin-bottom:8px;">
        ${
          script
            ? `Утверждённый режиссёрский сценарий (${escapeHtmlEmailText(scriptTitleText)})`
            : 'Задача на производство аудиоролика'
        }
      </div>
      <div style="font-size:14px;line-height:1.6;color:#111111;font-weight:600;margin-bottom:10px;">
        ${escapeHtmlEmailText(scriptBodyText)}
      </div>
      ${
        script?.stressNotes
          ? `<div style="font-size:12px;color:#444444;margin-bottom:4px;"><strong>Ударения:</strong> ${escapeHtmlEmailText(
              script.stressNotes
            )}</div>`
          : ''
      }
      ${
        script?.fz38Disclaimer
          ? `<div style="font-size:12px;color:#444444;margin-bottom:4px;"><strong>Дисклеймер ФЗ-38 (внутри слота):</strong> ${escapeHtmlEmailText(
              script.fz38Disclaimer
            )}</div>`
          : ''
      }
      ${
        script?.directorApproach
          ? `<div style="font-size:12px;color:#444444;margin-top:8px;padding-top:8px;border-top:1px solid rgba(17,17,17,0.08);"><strong>Режиссёрское решение:</strong> ${escapeHtmlEmailText(
              script.directorApproach
            )}</div>`
          : ''
      }
    </div>
    <div style="margin:22px 0;text-align:left;">
      <a href="${escapeHtmlEmailText(actionButtonUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:13px 22px;background:#FF4820;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:700;border-radius:12px;">
        ${escapeHtmlEmailText(buttonLabel)} →
      </a>
      <div style="font-size:11px;color:#666666;margin-top:8px;">
        При нажатии на кнопку автоматически генерируется уникальная ссылка-токен для прямой загрузки мастер-файла в буфер ОТК продюсера без авторизации в админ-панели.
      </div>
    </div>
    <div style="padding-top:12px;border-top:1px solid rgba(17,17,17,0.08);font-size:11px;color:#777777;word-break:break-all;">
      Прямая ссылка кнопки: <a href="${escapeHtmlEmailText(actionButtonUrl)}" style="color:#FF4820;">${escapeHtmlEmailText(
        actionButtonUrl
      )}</a>
    </div>
  </div>
</body>
</html>`;

  return {
    subject,
    plainBody,
    htmlBody,
    buttonLabel,
    actionButtonUrl,
    telegramMessage,
    mailtoHref,
  };
}

// ============================================================================
// Детерминированная гидратация и seed-состояния для демонстрации всех сценариев
// ============================================================================

export function createSeedApprovalWorkflowForOrder(order: {
  orderNumber: string;
  createdAt: string;
  updatedAt: string;
  stage: string;
  formatLabel: string;
  briefText: string;
  mediaPlanDurationSec?: number | null;
  deliverables?: ReadonlyArray<{
    id: string;
    versionCode?: string;
    versionStage?: string;
  }>;
}): OrderApprovalWorkflow {
  const targetSlotSec = inferTargetSlotSecFromOrder({
    formatLabel: order.formatLabel,
    mediaPlanDurationSec: order.mediaPlanDurationSec,
  });

  const deliverables = order.deliverables ?? [];
  const masterDeliv = deliverables.find(
    (d) => d.versionStage === 'master' || d.versionCode === 'master'
  );
  const hasAnyAudio = deliverables.length > 0;

  // 1. Демо-заказ FM-2948: Режиссёрский сценарий опубликован и ждёт утверждения клиента в 1 клик
  if (order.orderNumber === 'FM-2948') {
    const bodyText =
      'Зимний рейс не ждёт весны. Седельные тягачи в лизинг от «ТрансФлот Лизинг» — зимний пакет и отсрочка первого платежа шестьдесят дней. Одобрение по ИНН за один день. «ТрансФлот Лизинг» — техника на линии сразу.';
    const fz38Disclaimer =
      'АО «ТрансФлот Лизинг». Подробности на сайте.';
    const est = estimateRussianScriptDurationSec(bodyText, fz38Disclaimer);

    return {
      targetSlotSec: 20,
      phase: 'script_client_review',
      scriptVersions: [
        {
          versionNumber: 1,
          createdAt: order.updatedAt,
          targetSlotSec: 20,
          concepts: [
            {
              id: 'concept-2948-main',
              label: 'Основная концепция',
              title: 'Деловой драйв · Отсрочка 60 дней на старте сезона',
              bodyText,
              stressNotes:
                'ли́зинг, седе́льные тягачи́, отсро́чка платежа́, по ИНН [и-эн-эн]',
              fz38Disclaimer,
              directorApproach:
                'Уверенный низкий мужской баритон без рекламного крика, упругий современный ритм с акустическим стартом двигателя на первой секунде, сведение −14 LUFS с приоритетом разборчивости цифр.',
              estimatedSec: est.estimatedSec,
            },
          ],
          approvedConceptId: null,
          approvedAt: null,
          clientComment: null,
          clientCommentAt: null,
        },
      ],
      lockedScript: null,
      serviceRoundUsed: false,
      serviceRoundUsedAt: null,
      serviceRoundSummary: null,
      spotRevisions: [],
      assignedEngineerId: 'eng-gromov',
      lastDispatchedToEngineerAt: null,
      lastDispatchChannelSummary: null,
      dropTokenGeneration: 1,
      pendingEngineerTakes: [],
      acceptedAt: null,
      acceptedDeliverableId: null,
    };
  }

  // 2. Демо-заказ FM-2926: Готовый ролик v2 ждёт приёмки клиента (доступен 1 включённый сервисный раунд!)
  if (order.orderNumber === 'FM-2926') {
    const bodyText =
      '— Шеф, партия охлаждёнки уходит в пять утра, а старый фургон снова встал? — Уже решили: берём новые рефрижераторы в «ТрансФлот Лизинг». Температурный контроль от минус двадцати, решение по ИНН за один день! «ТрансФлот Лизинг» — холод держит маршрут.';
    const fz38Disclaimer =
      'АО «ТрансФлот Лизинг». Условия лизинга для юридических лиц уточняйте у специалистов компании.';
    const est = estimateRussianScriptDurationSec(bodyText, fz38Disclaimer);

    return {
      targetSlotSec: 30,
      phase: 'spot_client_review',
      scriptVersions: [
        {
          versionNumber: 1,
          createdAt: order.createdAt,
          targetSlotSec: 30,
          concepts: [
            {
              id: 'concept-2926-main',
              label: 'Основная концепция',
              title: 'Игровой диалог логиста и руководителя (30 сек)',
              bodyText,
              stressNotes: 'рефрижера́торы, охлаждёнка, «ТрансФло́т Ли́зинг»',
              fz38Disclaimer,
              directorApproach:
                'Два контрастных актёрских голоса кинодубляжа, короткий интершум погрузочного терминала, собранная динамичная лицензионная подложка Royalty-Free.',
              estimatedSec: est.estimatedSec,
            },
          ],
          approvedConceptId: 'concept-2926-main',
          approvedAt: order.createdAt,
          clientComment: null,
          clientCommentAt: null,
        },
      ],
      lockedScript: {
        versionNumber: 1,
        conceptId: 'concept-2926-main',
        conceptTitle: 'Игровой диалог логиста и руководителя (30 сек)',
        bodyText,
        stressNotes: 'рефрижера́торы, охлаждёнка, «ТрансФло́т Ли́зинг»',
        fz38Disclaimer,
        directorApproach:
          'Два контрастных актёрских голоса кинодубляжа, короткий интершум погрузочного терминала, собранная динамичная лицензионная подложка Royalty-Free.',
        targetSlotSec: 30,
        approvedAt: order.createdAt,
      },
      serviceRoundUsed: false,
      serviceRoundUsedAt: null,
      serviceRoundSummary: null,
      spotRevisions: [],
      assignedEngineerId: 'eng-vetrov',
      lastDispatchedToEngineerAt: order.createdAt,
      lastDispatchChannelSummary: 'Техлист отправлен на почту звукорежиссёра',
      dropTokenGeneration: 1,
      pendingEngineerTakes: [],
      acceptedAt: null,
      acceptedDeliverableId: null,
    };
  }

  // 3. Завершённые заказы с готовым мастером
  if (
    masterDeliv ||
    order.stage === 'on_air' ||
    order.stage === 'completed_ltv'
  ) {
    const fallbackBody =
      order.briefText ||
      'Коммерческий аудиоролик по утверждённому режиссёрскому сценарию студии.';
    const est = estimateRussianScriptDurationSec(fallbackBody, '');
    return {
      targetSlotSec,
      phase: 'accepted',
      scriptVersions: [
        {
          versionNumber: 1,
          createdAt: order.createdAt,
          targetSlotSec,
          concepts: [
            {
              id: `concept-${order.orderNumber}-1`,
              label: 'Основная концепция',
              title: `Утверждённый сценарий (${targetSlotSec} сек)`,
              bodyText: fallbackBody,
              stressNotes: 'Ударения сверены перед записью мастера',
              fz38Disclaimer: 'Юридические реквизиты озвучены по нормам ФЗ-38',
              directorApproach:
                'Фирменный диктор FMWorks, лицензионная музыкальная подложка и мастеринг −14 LUFS.',
              estimatedSec: est.estimatedSec,
            },
          ],
          approvedConceptId: `concept-${order.orderNumber}-1`,
          approvedAt: order.createdAt,
          clientComment: null,
          clientCommentAt: null,
        },
      ],
      lockedScript: {
        versionNumber: 1,
        conceptId: `concept-${order.orderNumber}-1`,
        conceptTitle: `Утверждённый сценарий (${targetSlotSec} сек)`,
        bodyText: fallbackBody,
        stressNotes: 'Ударения сверены перед записью мастера',
        fz38Disclaimer: 'Юридические реквизиты озвучены по нормам ФЗ-38',
        directorApproach:
          'Фирменный диктор FMWorks, лицензионная музыкальная подложка и мастеринг −14 LUFS.',
        targetSlotSec,
        approvedAt: order.createdAt,
      },
      serviceRoundUsed: false,
      serviceRoundUsedAt: null,
      serviceRoundSummary: null,
      spotRevisions: [],
      assignedEngineerId: 'eng-gromov',
      lastDispatchedToEngineerAt: order.createdAt,
      lastDispatchChannelSummary: 'Мастер сдан и проверен продюсером',
      dropTokenGeneration: 1,
      pendingEngineerTakes: [],
      acceptedAt: order.updatedAt,
      acceptedDeliverableId: masterDeliv?.id ?? deliverables[0]?.id ?? null,
    };
  }

  // 4. Если уже есть черновые аудио-версии (v1/v2), но нет master
  if (hasAnyAudio) {
    return {
      targetSlotSec,
      phase: 'spot_client_review',
      scriptVersions: [],
      lockedScript: null,
      serviceRoundUsed: false,
      serviceRoundUsedAt: null,
      serviceRoundSummary: null,
      spotRevisions: [],
      assignedEngineerId: 'eng-gromov',
      lastDispatchedToEngineerAt: order.updatedAt,
      lastDispatchChannelSummary: null,
      dropTokenGeneration: 1,
      pendingEngineerTakes: [],
      acceptedAt: null,
      acceptedDeliverableId: null,
    };
  }

  // 5. Новые заказы по умолчанию начинают с подготовки режиссёрского сценария продюсером
  return {
    targetSlotSec,
    phase: 'script_drafting',
    scriptVersions: [],
    lockedScript: null,
    serviceRoundUsed: false,
    serviceRoundUsedAt: null,
    serviceRoundSummary: null,
    spotRevisions: [],
    assignedEngineerId: 'eng-gromov',
    lastDispatchedToEngineerAt: null,
    lastDispatchChannelSummary: null,
    dropTokenGeneration: 1,
    pendingEngineerTakes: [],
    acceptedAt: null,
    acceptedDeliverableId: null,
  };
}

export function ensureOrderApprovalWorkflow<
  T extends {
    orderNumber: string;
    createdAt: string;
    updatedAt: string;
    stage: string;
    formatLabel: string;
    briefText: string;
    mediaPlanSnapshot?: { spotDurationSec?: number } | null;
    deliverables?: ReadonlyArray<{
      id: string;
      versionCode?: string;
      versionStage?: string;
    }>;
    approvalWorkflow?: OrderApprovalWorkflow | null;
  },
>(order: T): T & { approvalWorkflow: OrderApprovalWorkflow } {
  if (order.approvalWorkflow && typeof order.approvalWorkflow === 'object') {
    const wf = order.approvalWorkflow;
    const validPhases = new Set<ApprovalPipelinePhase>([
      'script_drafting',
      'script_client_review',
      'studio_production',
      'spot_client_review',
      'revision_in_progress',
      'producer_escalation',
      'accepted',
    ]);
    const phase: ApprovalPipelinePhase = validPhases.has(wf.phase)
      ? wf.phase
      : 'script_drafting';

    return {
      ...order,
      approvalWorkflow: {
        targetSlotSec:
          typeof wf.targetSlotSec === 'number' && wf.targetSlotSec >= 5
            ? Math.round(wf.targetSlotSec)
            : inferTargetSlotSecFromOrder({
                formatLabel: order.formatLabel,
                mediaPlanDurationSec: order.mediaPlanSnapshot?.spotDurationSec,
              }),
        phase,
        scriptVersions: Array.isArray(wf.scriptVersions) ? wf.scriptVersions : [],
        lockedScript: wf.lockedScript ?? null,
        serviceRoundUsed: Boolean(wf.serviceRoundUsed),
        serviceRoundUsedAt: wf.serviceRoundUsedAt ?? null,
        serviceRoundSummary: wf.serviceRoundSummary ?? null,
        spotRevisions: Array.isArray(wf.spotRevisions) ? wf.spotRevisions : [],
        assignedEngineerId: wf.assignedEngineerId ?? 'eng-gromov',
        lastDispatchedToEngineerAt: wf.lastDispatchedToEngineerAt ?? null,
        lastDispatchChannelSummary: wf.lastDispatchChannelSummary ?? null,
        dropTokenGeneration:
          typeof wf.dropTokenGeneration === 'number' && wf.dropTokenGeneration >= 1
            ? Math.floor(wf.dropTokenGeneration)
            : 1,
        pendingEngineerTakes: Array.isArray(wf.pendingEngineerTakes)
          ? wf.pendingEngineerTakes
          : [],
        acceptedAt: wf.acceptedAt ?? null,
        acceptedDeliverableId: wf.acceptedDeliverableId ?? null,
      },
    };
  }

  return {
    ...order,
    approvalWorkflow: createSeedApprovalWorkflowForOrder({
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      stage: order.stage,
      formatLabel: order.formatLabel,
      briefText: order.briefText,
      mediaPlanDurationSec: order.mediaPlanSnapshot?.spotDurationSec ?? null,
      deliverables: order.deliverables,
    }),
  };
}
