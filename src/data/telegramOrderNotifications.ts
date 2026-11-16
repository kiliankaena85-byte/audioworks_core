import { scrubPersonalDataFromText } from '../security/rfLegalCompliance.ts';
import type { CrmOrderStage } from './orderCrmTypes.ts';

export type OrderStatusChangeActor =
  | 'producer_crm'
  | 'client_cabinet'
  | 'sound_engineer'
  | 'system_sla';

export interface OrderStatusChangeContext {
  previousStage?: CrmOrderStage | null;
  nextStage?: CrmOrderStage | null;
  actor?: OrderStatusChangeActor;
  workflowStepLabel?: string | null;
  reasonSummary?: string | null;
  changedAtIso?: string;
}

export interface PersistedTelegramSettingsInput {
  enabled?: boolean;
  enabledExplicitlySet?: boolean;
  botToken?: string;
  chatId?: string;
  chatIdAutoDiscovered?: boolean;
  discoveredChatTitle?: string;
  notifyOnNewOrder?: boolean;
  notifyOnStageChange?: boolean;
  maskPdnInExternalAlerts?: boolean;
}

export type TelegramTokenSource = 'env' | 'legacy_store' | 'none';
export type TelegramChatIdSource = 'admin' | 'auto_discovered' | 'env' | 'none';

export interface ResolvedTelegramDispatchSettings {
  enabled: boolean;
  enabledExplicitlySet: boolean;
  botToken: string;
  hasBotToken: boolean;
  botTokenSource: TelegramTokenSource;
  envBotTokenConfigured: boolean;
  chatId: string;
  hasChatId: boolean;
  chatIdSource: TelegramChatIdSource;
  envChatIdConfigured: boolean;
  discoveredChatTitle: string;
  notifyOnNewOrder: boolean;
  notifyOnStageChange: boolean;
  maskPdnInExternalAlerts: boolean;
}

export interface DiscoveredTelegramChat {
  chatId: string;
  chatTitle: string;
  chatType: string;
}

const PLACEHOLDER_ENV_VALUES = new Set([
  'MY_TELEGRAM_BOT_TOKEN',
  'CHANGE_ME',
  'YOUR_BOT_TOKEN',
  'YOUR_CHAT_ID',
]);

function cleanEnvValue(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed || PLACEHOLDER_ENV_VALUES.has(trimmed)) {
    return '';
  }
  return trimmed;
}

/**
 * Разрешает эффективную конфигурацию Telegram-уведомлений студии с приоритетом
 * серверной переменной окружения TELEGRAM_ORDERS_BOT_TOKEN (и опциональной TELEGRAM_ORDERS_CHAT_ID).
 * Если TELEGRAM_ORDERS_BOT_TOKEN задан в окружении, канал включается автоматически,
 * даже если ранее на диске был сохранён пустой конфиг без токена (пока администратор явно не выключит тумблер).
 */
export function resolveEffectiveTelegramSettings(
  persisted?: PersistedTelegramSettingsInput | null,
  env: Record<string, string | undefined> = {}
): ResolvedTelegramDispatchSettings {
  const envBotToken = cleanEnvValue(env.TELEGRAM_ORDERS_BOT_TOKEN);
  const envChatId = cleanEnvValue(env.TELEGRAM_ORDERS_CHAT_ID);
  const legacyStoredToken = (persisted?.botToken ?? '').trim();
  const storedChatId = (persisted?.chatId ?? '').trim();

  const botToken = envBotToken || legacyStoredToken;
  const botTokenSource: TelegramTokenSource = envBotToken
    ? 'env'
    : legacyStoredToken
      ? 'legacy_store'
      : 'none';

  let chatId = '';
  let chatIdSource: TelegramChatIdSource = 'none';
  if (storedChatId) {
    chatId = storedChatId;
    chatIdSource = persisted?.chatIdAutoDiscovered ? 'auto_discovered' : 'admin';
  } else if (envChatId) {
    chatId = envChatId;
    chatIdSource = 'env';
  }

  const enabledExplicitlySet = persisted?.enabledExplicitlySet === true;
  const hasBotToken = Boolean(botToken);
  const enabled = enabledExplicitlySet
    ? Boolean(persisted?.enabled)
    : hasBotToken
      ? true
      : Boolean(persisted?.enabled);

  return {
    enabled,
    enabledExplicitlySet,
    botToken,
    hasBotToken,
    botTokenSource,
    envBotTokenConfigured: Boolean(envBotToken),
    chatId,
    hasChatId: Boolean(chatId),
    chatIdSource,
    envChatIdConfigured: Boolean(envChatId),
    discoveredChatTitle: (persisted?.discoveredChatTitle ?? '').trim(),
    notifyOnNewOrder: persisted?.notifyOnNewOrder !== false,
    notifyOnStageChange: persisted?.notifyOnStageChange !== false,
    maskPdnInExternalAlerts: true,
  };
}

/**
 * Извлекает последний активный чат/группу/канал из ответа Telegram Bot API getUpdates,
 * чтобы при наличии только TELEGRAM_ORDERS_BOT_TOKEN студия могла автоматически
 * определить Chat ID после команды /start или добавления бота в рабочую группу.
 */
export function extractChatFromTelegramUpdates(
  updatesPayload: unknown
): DiscoveredTelegramChat | null {
  if (!updatesPayload || typeof updatesPayload !== 'object') {
    return null;
  }
  const envelope = updatesPayload as {
    ok?: unknown;
    result?: unknown;
  };
  if (envelope.ok !== true || !Array.isArray(envelope.result)) {
    return null;
  }

  for (let i = envelope.result.length - 1; i >= 0; i -= 1) {
    const update = envelope.result[i];
    if (!update || typeof update !== 'object') continue;
    const rec = update as Record<string, unknown>;
    const candidateNodes = [
      rec.message,
      rec.channel_post,
      rec.edited_message,
      rec.edited_channel_post,
      rec.my_chat_member,
      rec.chat_member,
    ];

    for (const node of candidateNodes) {
      if (!node || typeof node !== 'object') continue;
      const chat = (node as Record<string, unknown>).chat;
      if (!chat || typeof chat !== 'object') continue;
      const chatObj = chat as Record<string, unknown>;
      const rawId = chatObj.id;
      if (typeof rawId !== 'number' && typeof rawId !== 'string') continue;
      const chatId = String(rawId).trim();
      if (!chatId) continue;

      const chatType =
        typeof chatObj.type === 'string' && chatObj.type.trim()
          ? chatObj.type.trim()
          : 'private';
      const titleParts = [
        typeof chatObj.title === 'string' ? chatObj.title.trim() : '',
        typeof chatObj.first_name === 'string' ? chatObj.first_name.trim() : '',
        typeof chatObj.last_name === 'string' ? chatObj.last_name.trim() : '',
      ].filter(Boolean);
      const username =
        typeof chatObj.username === 'string' && chatObj.username.trim()
          ? `@${chatObj.username.trim()}`
          : '';
      const chatTitle =
        titleParts.join(' ').trim() || username || `Чат ${chatId}`;

      return {
        chatId,
        chatTitle,
        chatType,
      };
    }
  }

  return null;
}

export function parseTelegramBotApiError(
  httpStatus: number,
  rawBody: unknown
): { detail: string; retryAfterSec: number | null } {
  let apiDescription = '';
  let retryAfterSec: number | null = null;

  if (rawBody && typeof rawBody === 'object') {
    const obj = rawBody as Record<string, unknown>;
    if (typeof obj.description === 'string') {
      apiDescription = obj.description.trim();
    }
    if (obj.parameters && typeof obj.parameters === 'object') {
      const retryRaw = (obj.parameters as Record<string, unknown>).retry_after;
      if (typeof retryRaw === 'number' && Number.isFinite(retryRaw) && retryRaw > 0) {
        retryAfterSec = Math.ceil(retryRaw);
      }
    }
  } else if (typeof rawBody === 'string' && rawBody.trim()) {
    try {
      const parsed = JSON.parse(rawBody) as Record<string, unknown>;
      if (typeof parsed.description === 'string') {
        apiDescription = parsed.description.trim();
      }
      if (parsed.parameters && typeof parsed.parameters === 'object') {
        const retryRaw = (parsed.parameters as Record<string, unknown>).retry_after;
        if (typeof retryRaw === 'number' && Number.isFinite(retryRaw) && retryRaw > 0) {
          retryAfterSec = Math.ceil(retryRaw);
        }
      }
    } catch {
      apiDescription = rawBody.trim().slice(0, 140);
    }
  }

  const lowerDesc = apiDescription.toLowerCase();
  if (httpStatus === 401 || lowerDesc.includes('unauthorized')) {
    return {
      detail:
        'Telegram API отклонил TELEGRAM_ORDERS_BOT_TOKEN (HTTP 401 Unauthorized) — проверьте актуальность токена бота в окружении сервера',
      retryAfterSec: null,
    };
  }
  if (httpStatus === 400 && lowerDesc.includes('chat not found')) {
    return {
      detail:
        'Чат студии не найден (HTTP 400 chat not found) — отправьте боту /start или проверьте Chat ID рабочей группы',
      retryAfterSec: null,
    };
  }
  if (httpStatus === 403) {
    return {
      detail:
        'Бот заблокирован или исключён из рабочей группы студии (HTTP 403 Forbidden)',
      retryAfterSec: null,
    };
  }
  if (httpStatus === 429) {
    return {
      detail: retryAfterSec
        ? `Лимит частоты Telegram API (HTTP 429 · повтор через ${retryAfterSec} с)`
        : 'Лимит частоты Telegram API (HTTP 429 Too Many Requests)',
      retryAfterSec,
    };
  }

  return {
    detail: apiDescription
      ? `Ответ Telegram API (HTTP ${httpStatus}): ${apiDescription.slice(0, 140)}`
      : `Ответ Telegram API: HTTP ${httpStatus}`,
    retryAfterSec,
  };
}

export function formatStatusChangeActorLabel(
  actor?: OrderStatusChangeActor
): string {
  switch (actor) {
    case 'client_cabinet':
      return 'Клиент (личный кабинет заказа)';
    case 'sound_engineer':
      return 'Звукорежиссёр (шлюз сдачи мастера)';
    case 'system_sla':
      return 'Автоматический контроль SLA';
    case 'producer_crm':
    default:
      return 'Продюсер студии (CRM-пульт)';
  }
}

export function formatStatusTimestampUtcPlus3(iso?: string): string {
  const ts = iso && Number.isFinite(Date.parse(iso)) ? new Date(iso) : new Date();
  try {
    const formatted = ts.toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${formatted} (UTC+3)`;
  } catch {
    return `${ts.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
  }
}

export function sanitizeStatusChangeReason(
  rawReason: string | null | undefined,
  maskPdn = true
): string {
  const normalized = (rawReason ?? '').replace(/\s+/g, ' ').trim().slice(0, 280);
  if (!normalized) return '';
  return maskPdn ? scrubPersonalDataFromText(normalized) : normalized;
}
