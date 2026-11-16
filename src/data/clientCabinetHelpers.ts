import type { OrderDocumentMeta, StudioLegalProfilesConfig } from './studioDocumentsCore.ts';
import type { ClientApprovalWorkflowView } from './productionApprovalWorkflow.ts';

export type ClientDeliveryChannel =
  | 'messenger'
  | 'cloud'
  | 'email'
  | 'cabinet';

export type DeliveryMessengerId = 'telegram' | 'max' | 'other';
export type DeliveryCloudId = 'yandex_disk' | 'mailru_cloud' | 'other';

export type OrderDeliverableKind =
  | 'audio_master'
  | 'script'
  | 'invoice'
  | 'passport'
  | 'archive';

export type DeliverableVersionStage = 'draft' | 'revision' | 'master';

export interface OrderDeliverableFile {
  id: string;
  title: string;
  kind: OrderDeliverableKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  /** Код версии итерации аудиоролика: например, 'v1', 'v2', 'v3', 'master' */
  versionCode?: string;
  /** Стадия итерации: черновой дубль ('draft'), правка ('revision') или финальный мастер ('master') */
  versionStage?: DeliverableVersionStage;
  /** Комментарий продюсера к итерации (что изменилось относительно прошлой версии) */
  versionNote?: string;
  /** Имя сохранённого файла в закрытом хранилище сервера (если загружен через CRM) */
  storageKey?: string;
  /** Безопасный проверенный путь к демо-мастеру студии (для стартовых примеров) */
  staticAssetUrl?: string;
}

export interface ClientUploadedAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  note?: string;
  storageKey?: string;
}

export interface ClientCabinetOrderSummary {
  orderNumber: string;
  rescueToken: string;
  createdAt: string;
  updatedAt: string;
  stage:
    | 'new_hold'
    | 'quota_locked'
    | 'edo_invoice'
    | 'in_production'
    | 'on_air'
    | 'completed_ltv';
  formatLabel: string;
  totalBudgetRub: number;
  contact: string;
  clientEmail?: string | null;
  companyOrInn: string;
  innVerified: boolean;
  briefText: string;
  hasVoiceRecording: boolean;
  voiceDurationSec: number;
  attachedFileName: string | null;
  preferredDeliveryChannel: ClientDeliveryChannel;
  preferredDeliveryDetail?: string;
  cloudDiskUrl: string | null;
  deliverables: OrderDeliverableFile[];
  clientUploads: ClientUploadedAttachment[];
  documentMeta: OrderDocumentMeta | null;
  legalProfiles?: StudioLegalProfilesConfig | null;
  producerStatusNote?: string;
  approvalWorkflow?: ClientApprovalWorkflowView | null;
}

export interface ClientCabinetStoredEntry {
  orderNumber: string;
  rescueToken: string;
  contactLine: string;
  companyLine: string;
  addedAtMs: number;
}

export const CLIENT_CABINET_STORAGE_KEY = 'fmworks_client_cabinet_v1';

export const CLIENT_DELIVERY_CHANNEL_OPTIONS: readonly {
  id: ClientDeliveryChannel;
  shortLabel: string;
  fullLabel: string;
  hint: string;
}[] = [
  {
    id: 'messenger',
    shortLabel: 'Мессенджер',
    fullLabel: 'Мессенджер',
    hint: 'Отправим файлы и сценарий в выбранный мессенджер',
  },
  {
    id: 'cloud',
    shortLabel: 'Облачное хранилище',
    fullLabel: 'Облачное хранилище',
    hint: 'Дадим постоянную ссылку на удобный облачный диск',
  },
  {
    id: 'email',
    shortLabel: 'На почту',
    fullLabel: 'На почту (без кабинета)',
    hint: 'Пришлём ролик и документы сразу на указанный e-mail',
  },
  {
    id: 'cabinet',
    shortLabel: 'Личный кабинет',
    fullLabel: 'Личный кабинет',
    hint: 'Готовые файлы и счёт всегда доступны в кабинете',
  },
] as const;

export const DELIVERY_MESSENGER_OPTIONS: readonly {
  id: DeliveryMessengerId;
  label: string;
}[] = [
  { id: 'telegram', label: 'Telegram' },
  { id: 'max', label: 'Max' },
  { id: 'other', label: 'Другой' },
] as const;

export const DELIVERY_CLOUD_OPTIONS: readonly {
  id: DeliveryCloudId;
  label: string;
}[] = [
  { id: 'yandex_disk', label: 'Яндекс Диск' },
  { id: 'mailru_cloud', label: 'Облако Mail.ru' },
  { id: 'other', label: 'Другое' },
] as const;

export function sanitizeDeliveryChannel(
  raw: unknown,
  fallback: ClientDeliveryChannel = 'messenger'
): ClientDeliveryChannel {
  if (
    raw === 'messenger' ||
    raw === 'cloud' ||
    raw === 'email' ||
    raw === 'cabinet'
  ) {
    return raw;
  }
  if (raw === 'yandex_disk' || raw === 'google_disk') {
    return 'cloud';
  }
  return fallback;
}

export function sanitizeDeliveryDetail(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 160);
}

export function normalizeDeliveryPreferences(
  rawChannel: unknown,
  rawDetail: unknown,
  fallbackChannel: ClientDeliveryChannel = 'messenger'
): { channel: ClientDeliveryChannel; detail: string } {
  const cleanDetail = sanitizeDeliveryDetail(rawDetail);
  const lowerDetail = cleanDetail.toLowerCase();
  if (rawChannel === 'yandex_disk' || rawChannel === 'google_disk') {
    return {
      channel: 'cloud',
      detail:
        cleanDetail &&
        lowerDetail !== 'google_disk' &&
        lowerDetail !== 'google диск'
          ? cleanDetail
          : 'Яндекс Диск',
    };
  }
  const channel = sanitizeDeliveryChannel(rawChannel, fallbackChannel);
  if (channel === 'messenger') {
    if (!cleanDetail) return { channel, detail: 'Telegram' };
    if (lowerDetail === 'telegram') return { channel, detail: 'Telegram' };
    if (lowerDetail === 'whatsapp') return { channel, detail: 'Telegram' };
    if (lowerDetail === 'max') return { channel, detail: 'Max' };
    if (lowerDetail === 'other' || lowerDetail === 'мессенджер') {
      return { channel, detail: '' };
    }
    return { channel, detail: cleanDetail };
  }
  if (channel === 'cloud') {
    if (!cleanDetail) return { channel, detail: 'Яндекс Диск' };
    if (lowerDetail === 'yandex_disk' || lowerDetail === 'яндекс диск') {
      return { channel, detail: 'Яндекс Диск' };
    }
    if (
      lowerDetail === 'mailru_cloud' ||
      lowerDetail === 'облако mail.ru' ||
      lowerDetail === 'облако mail'
    ) {
      return { channel, detail: 'Облако Mail.ru' };
    }
    if (
      lowerDetail === 'google_disk' ||
      lowerDetail === 'google диск' ||
      lowerDetail === 'dropbox'
    ) {
      return { channel, detail: 'Яндекс Диск' };
    }
    if (
      lowerDetail === 'other' ||
      lowerDetail === 'облачное хранилище' ||
      lowerDetail === 'облачный диск'
    ) {
      return { channel, detail: '' };
    }
    return { channel, detail: cleanDetail };
  }
  if (channel === 'email') {
    if (lowerDetail === 'на почту' || lowerDetail === 'email') {
      return { channel, detail: '' };
    }
    return { channel, detail: cleanDetail };
  }
  return { channel: 'cabinet', detail: '' };
}

export function validateDeliveryEmail(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length < 5 || trimmed.length > 160) return false;
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/i.test(trimmed);
}

export function buildCanonicalDeliveryDetail(params: {
  channel: ClientDeliveryChannel;
  messenger?: DeliveryMessengerId;
  messengerOther?: string;
  cloud?: DeliveryCloudId;
  cloudOther?: string;
  email?: string;
}): string {
  if (params.channel === 'messenger') {
    const m = params.messenger ?? 'telegram';
    if (m === 'other') {
      return sanitizeDeliveryDetail(params.messengerOther ?? '') || '';
    }
    return DELIVERY_MESSENGER_OPTIONS.find((o) => o.id === m)?.label ?? 'Telegram';
  }
  if (params.channel === 'cloud') {
    const c = params.cloud ?? 'yandex_disk';
    if (c === 'other') {
      return sanitizeDeliveryDetail(params.cloudOther ?? '') || '';
    }
    return DELIVERY_CLOUD_OPTIONS.find((o) => o.id === c)?.label ?? 'Яндекс Диск';
  }
  if (params.channel === 'email') {
    return sanitizeDeliveryDetail(params.email ?? '');
  }
  return '';
}

export function parseDeliveryDetailSelection(
  channel: ClientDeliveryChannel,
  rawDetail?: string | null
): {
  messenger: DeliveryMessengerId;
  messengerOther: string;
  cloud: DeliveryCloudId;
  cloudOther: string;
  email: string;
} {
  const detail = sanitizeDeliveryDetail(rawDetail);
  const lower = detail.toLowerCase();

  let messenger: DeliveryMessengerId = 'telegram';
  let messengerOther = '';
  let cloud: DeliveryCloudId = 'yandex_disk';
  let cloudOther = '';
  let email = '';

  if (channel === 'messenger' && detail) {
    if (lower === 'telegram' || lower === 'whatsapp') messenger = 'telegram';
    else if (lower === 'max') messenger = 'max';
    else {
      messenger = 'other';
      messengerOther = detail;
    }
  } else if (channel === 'cloud' && detail) {
    if (
      lower === 'яндекс диск' ||
      lower === 'yandex_disk' ||
      lower === 'google диск' ||
      lower === 'google_disk' ||
      lower === 'dropbox'
    ) {
      cloud = 'yandex_disk';
    } else if (
      lower === 'облако mail.ru' ||
      lower === 'облако mail' ||
      lower === 'mailru_cloud'
    ) {
      cloud = 'mailru_cloud';
    } else {
      cloud = 'other';
      cloudOther = detail;
    }
  } else if (channel === 'email' && detail) {
    email = detail;
  }

  return { messenger, messengerOther, cloud, cloudOther, email };
}

export function resolveDeliveryChannelLabel(
  channel: ClientDeliveryChannel | string | undefined,
  detail?: string | null
): string {
  const norm = normalizeDeliveryPreferences(channel, detail);
  const found = CLIENT_DELIVERY_CHANNEL_OPTIONS.find(
    (opt) => opt.id === norm.channel
  );
  const baseLabel = found
    ? found.shortLabel
    : CLIENT_DELIVERY_CHANNEL_OPTIONS[0].shortLabel;

  if (norm.channel === 'cabinet' || !norm.detail) {
    return found ? found.fullLabel : CLIENT_DELIVERY_CHANNEL_OPTIONS[0].fullLabel;
  }
  return `${baseLabel} · ${norm.detail}`;
}

/**
 * Разрешает только безопасные HTTP/HTTPS-ссылки на облачные диски (Яндекс Диск, Облако Mail.ru и др.)
 * для защиты от `javascript:` / фишинговых протоколов.
 */
export function sanitizeCloudDiskUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    return parsed.toString().slice(0, 500);
  } catch {
    return null;
  }
}

export function formatFileSizeReadable(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return '—';
  if (sizeBytes < 1024) return `${Math.round(sizeBytes)} Б`;
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} КБ`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1).replace('.', ',')} МБ`;
}

export interface ClientOrderProgressInfo {
  stepIndex: number;
  totalSteps: number;
  badgeLabel: string;
  summaryText: string;
  steps: readonly {
    key: string;
    label: string;
    done: boolean;
    active: boolean;
  }[];
}

export function mapCrmStageToClientProgress(
  stage: ClientCabinetOrderSummary['stage']
): ClientOrderProgressInfo {
  const stageIndexMap: Record<ClientCabinetOrderSummary['stage'], number> = {
    new_hold: 0,
    quota_locked: 1,
    edo_invoice: 1,
    in_production: 2,
    on_air: 3,
    completed_ltv: 4,
  };
  const stepIndex = stageIndexMap[stage] ?? 0;

  const stepDefs = [
    { key: 'accepted', label: 'Заявка принята' },
    { key: 'billing', label: 'Согласование и счёт' },
    { key: 'production', label: 'В работе' },
    { key: 'ready', label: 'Готов к выдаче' },
    { key: 'done', label: 'Завершён' },
  ] as const;

  const summaryByIndex = [
    'Заявка получена студией — продюсер скоро свяжется для уточнения деталей.',
    'Условия согласованы, счёт на оплату доступен для скачивания и оплаты.',
    'Готовим сценарий, записываем голос и сводим ролик.',
    'Готовые файлы загружены — можно прослушать, скачать или открыть ссылку на диск.',
    'Проект выполнен и закрыт, все файлы остаются доступными в архиве заказа.',
  ] as const;

  return {
    stepIndex,
    totalSteps: stepDefs.length,
    badgeLabel: stepDefs[stepIndex]?.label ?? 'В обработке',
    summaryText: summaryByIndex[stepIndex] ?? summaryByIndex[0],
    steps: stepDefs.map((s, idx) => ({
      key: s.key,
      label: s.label,
      done: idx < stepIndex || (stage === 'completed_ltv' && idx === stepIndex),
      active: idx === stepIndex && stage !== 'completed_ltv',
    })),
  };
}

function extractDigits(str: string): string {
  return str.replace(/\D+/g, '');
}

/**
 * Проверяет соответствие проверочного ключа (последние 4+ цифр телефона, ИНН или @Telegram / email)
 * для безопасного входа клиента в свой заказ с другого устройства.
 */
export function matchesOrderLookupVerifier(
  orderContact: string,
  orderCompanyOrInn: string,
  verifierInput: string
): boolean {
  const normalizedInput = verifierInput.trim().toLowerCase();
  if (normalizedInput.length < 4) return false;

  const inputDigits = extractDigits(normalizedInput);
  const contactDigits = extractDigits(orderContact);
  const companyDigits = extractDigits(orderCompanyOrInn);

  if (inputDigits.length >= 4) {
    if (contactDigits.endsWith(inputDigits) || contactDigits.includes(inputDigits)) {
      return true;
    }
    if (companyDigits && (companyDigits === inputDigits || companyDigits.includes(inputDigits))) {
      return true;
    }
  }

  const normalizedHandle = normalizedInput.replace(/^@/, '');
  if (normalizedHandle.length >= 3) {
    const contactLower = orderContact.toLowerCase();
    const companyLower = orderCompanyOrInn.toLowerCase();
    if (contactLower.includes(normalizedHandle) || companyLower.includes(normalizedHandle)) {
      return true;
    }
  }

  return false;
}

export function readClientCabinetEntries(
  storage?: Pick<Storage, 'getItem'>
): ClientCabinetStoredEntry[] {
  const store =
    storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!store) return [];
  try {
    const raw = store.getItem(CLIENT_CABINET_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is ClientCabinetStoredEntry =>
          Boolean(item) &&
          typeof item.orderNumber === 'string' &&
          item.orderNumber.trim().length > 0 &&
          typeof item.rescueToken === 'string' &&
          item.rescueToken.trim().length > 0
      )
      .slice(0, 30);
  } catch {
    return [];
  }
}

export function upsertClientCabinetEntry(
  entry: Omit<ClientCabinetStoredEntry, 'addedAtMs'> & { addedAtMs?: number },
  storage?: Pick<Storage, 'getItem' | 'setItem'>
): ClientCabinetStoredEntry[] {
  const store =
    storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  const cleanOrder = entry.orderNumber.trim();
  const cleanToken = entry.rescueToken.trim();
  if (!cleanOrder || !cleanToken) {
    return store ? readClientCabinetEntries(store) : [];
  }

  const existing = store ? readClientCabinetEntries(store) : [];
  const nextEntry: ClientCabinetStoredEntry = {
    orderNumber: cleanOrder,
    rescueToken: cleanToken,
    contactLine: entry.contactLine.trim(),
    companyLine: entry.companyLine.trim(),
    addedAtMs:
      typeof entry.addedAtMs === 'number' && Number.isFinite(entry.addedAtMs)
        ? entry.addedAtMs
        : Date.now(),
  };

  const merged = [
    nextEntry,
    ...existing.filter((item) => item.orderNumber !== cleanOrder),
  ].slice(0, 30);

  if (store) {
    try {
      store.setItem(CLIENT_CABINET_STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // Ignore storage quota errors
    }
  }
  return merged;
}

export function removeClientCabinetEntry(
  orderNumber: string,
  storage?: Pick<Storage, 'getItem' | 'setItem'>
): ClientCabinetStoredEntry[] {
  const store =
    storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!store) return [];
  const next = readClientCabinetEntries(store).filter(
    (item) => item.orderNumber !== orderNumber
  );
  try {
    store.setItem(CLIENT_CABINET_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}
