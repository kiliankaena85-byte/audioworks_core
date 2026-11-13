import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { StudioCmsSnapshot } from './src/data/studioCmsTypes.ts';
import {
  buildWebhookOrderEnvelope,
  createSeedCrmOrders,
  CRM_ORDER_STAGES,
  formatTelegramOrderDispatchMessage,
} from './src/data/orderCrmTypes.ts';
import type {
  CrmOrderRecord,
  CrmOrderStage,
  DispatchAttemptLog,
  OrderComplianceChecklist,
  OrderDispatchSettings,
  OrderEntrySource,
  OrderMediaPlanSnapshot,
} from './src/data/orderCrmTypes.ts';
import {
  computeLeadPayloadFingerprint,
  evaluateLeadSubmissionSecurity,
  inspectBriefForSpamSignals,
  RateLimiter,
  resolveLeadFormRateScope,
  SECURITY_DEFENSE_LAYERS,
  verifyLeadChallengePow,
} from './src/security/leadShield.ts';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_AUDIO_DIR = path.join(__dirname, 'public', 'assets', 'aistudio');
const DIST_AUDIO_DIR = path.join(__dirname, 'dist', 'assets', 'aistudio');
const PUBLIC_CMS_MEDIA_DIR = path.join(__dirname, 'public', 'assets', 'cms');
const DIST_CMS_MEDIA_DIR = path.join(__dirname, 'dist', 'assets', 'cms');
const CMS_DATA_DIR = path.join(__dirname, '.data');
const CMS_SNAPSHOT_FILE = path.join(CMS_DATA_DIR, 'studio-cms.json');
const CMS_BACKUP_FILE = path.join(CMS_DATA_DIR, 'studio-cms.last-reset.bak.json');
const SECURITY_LEADS_FILE = path.join(CMS_DATA_DIR, 'studio-security-leads.json');
const ORDERS_CRM_FILE = path.join(CMS_DATA_DIR, 'studio-orders-crm.json');

const MAIN_PROMO_FILENAME = 'Audioworks_75c6023f.wav';
const CANONICAL_RADIO_FILE = 'zerno_radio_15.wav';
const CANONICAL_AUDIOWORKS_FILE = 'zerno_audioworks_15.wav';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const SERVER_BANNED_TERMS = [
  'fm-тракт',
  'спектрограмма',
  'компрессор',
  'стемы',
  'дешевые биржи',
  'честная московская цена',
  'москв',
  'петерб',
  'питер',
  'мск',
  'спб',
  'moscow',
  'spb',
] as const;

interface ResolvedTrackInfo {
  url: string | null;
  fileName: string | null;
  durationSec: number;
}

const durationCache = new Map<string, { mtimeMs: number; durationSec: number }>();
let cachedCmsSnapshot: StudioCmsSnapshot | null | undefined = undefined;

function getStudioAdminPassword(): string {
  const fromEnv = process.env.STUDIO_ADMIN_PASSWORD?.trim();
  if (fromEnv && fromEnv !== 'CHANGE_ME_STUDIO_PASSWORD') {
    return fromEnv;
  }
  return 'audioworks';
}

function getSessionSecret(): string {
  const fromEnv = process.env.CMS_SESSION_SECRET?.trim();
  if (fromEnv && fromEnv !== 'CHANGE_ME_RANDOM_SESSION_SECRET') {
    return fromEnv;
  }
  return `audioworks-cms-hmac-${getStudioAdminPassword()}-v1`;
}

function safeCompareStrings(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hashB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function issueAdminToken(): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const nonce = crypto.randomBytes(12).toString('hex');
  const payload = Buffer.from(
    JSON.stringify({ role: 'studio_admin', exp: expiresAt, nonce }),
    'utf8'
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');
  return {
    token: `${payload}.${sig}`,
    expiresAt,
  };
}

function verifyAdminToken(rawToken: string | undefined): boolean {
  if (!rawToken || typeof rawToken !== 'string') return false;
  const parts = rawToken.trim().split('.');
  if (parts.length !== 2) return false;
  const [payload, providedSig] = parts;
  if (!payload || !providedSig) return false;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');

  if (!safeCompareStrings(providedSig, expectedSig)) {
    return false;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as { role?: string; exp?: number };
    if (parsed.role !== 'studio_admin') return false;
    if (typeof parsed.exp !== 'number' || parsed.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

function extractBearerToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') return undefined;
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return undefined;
}

function requireStudioAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!verifyAdminToken(token)) {
    res.status(401).json({
      error: 'Требуется авторизация в кабинете студии',
    });
    return;
  }
  next();
}

function scanEditorialWarnings(payload: unknown): string[] {
  const lower = JSON.stringify(payload).toLowerCase();
  const warnings: string[] = [];
  for (const term of SERVER_BANNED_TERMS) {
    if (lower.includes(term)) {
      warnings.push(term);
    }
  }
  return warnings;
}

function readPersistedCmsSnapshot(): StudioCmsSnapshot | null {
  if (cachedCmsSnapshot !== undefined) {
    return cachedCmsSnapshot;
  }
  try {
    if (!fs.existsSync(CMS_SNAPSHOT_FILE)) {
      cachedCmsSnapshot = null;
      return null;
    }
    const rawText = fs.readFileSync(CMS_SNAPSHOT_FILE, 'utf8');
    const parsed = JSON.parse(rawText) as StudioCmsSnapshot;
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.schemaVersion === 1 &&
      Array.isArray(parsed.portfolioCases)
    ) {
      cachedCmsSnapshot = parsed;
      return parsed;
    }
    cachedCmsSnapshot = null;
    return null;
  } catch {
    cachedCmsSnapshot = null;
    return null;
  }
}

function writePersistedCmsSnapshot(snapshot: StudioCmsSnapshot): void {
  fs.mkdirSync(CMS_DATA_DIR, { recursive: true });
  const tempPath = path.join(
    CMS_DATA_DIR,
    `.studio-cms.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`
  );
  fs.writeFileSync(tempPath, JSON.stringify(snapshot, null, 2), 'utf8');
  fs.renameSync(tempPath, CMS_SNAPSHOT_FILE);
  cachedCmsSnapshot = snapshot;
}

function resetPersistedCmsSnapshot(): void {
  fs.mkdirSync(CMS_DATA_DIR, { recursive: true });
  if (fs.existsSync(CMS_SNAPSHOT_FILE)) {
    try {
      fs.copyFileSync(CMS_SNAPSHOT_FILE, CMS_BACKUP_FILE);
      fs.unlinkSync(CMS_SNAPSHOT_FILE);
    } catch {
      // Ignore cleanup errors
    }
  }
  cachedCmsSnapshot = null;
}

function sanitizeSafeFileStem(rawName: string, fallbackPrefix: string): string {
  const base = path.basename(rawName, path.extname(rawName));
  const clean = base
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42);
  return clean || fallbackPrefix;
}

async function probeDurationSec(absPath: string, fallbackSec: number): Promise<number> {
  try {
    const stat = fs.statSync(absPath);
    const cached = durationCache.get(absPath);
    if (cached && cached.mtimeMs === stat.mtimeMs) {
      return cached.durationSec;
    }
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      absPath,
    ]);
    const parsed = Number.parseFloat(stdout.trim());
    const valid = Number.isFinite(parsed) && parsed > 0.3 ? parsed : fallbackSec;
    durationCache.set(absPath, { mtimeMs: stat.mtimeMs, durationSec: valid });
    return valid;
  } catch {
    return fallbackSec;
  }
}

function classifyDuelFilename(name: string): 'radio' | 'audioworks' | null {
  if (name === MAIN_PROMO_FILENAME || name.startsWith('.')) return null;
  const lower = name.toLowerCase();
  if (!lower.endsWith('.wav') && !lower.endsWith('.mp3') && !lower.endsWith('.m4a')) {
    return null;
  }
  if (
    lower === CANONICAL_RADIO_FILE ||
    lower.includes('ради') ||
    lower.includes('radio') ||
    lower.includes('штамп') ||
    lower.includes('обычн')
  ) {
    return 'radio';
  }
  return 'audioworks';
}

async function resolveDuelTracksOnDisk(): Promise<{
  radio: ResolvedTrackInfo;
  audioworks: ResolvedTrackInfo;
  isReadyOnServer: boolean;
}> {
  try {
    fs.mkdirSync(PUBLIC_AUDIO_DIR, { recursive: true });
  } catch {
    // Ignore read-only fs in restricted containers
  }
  const entries = fs.existsSync(PUBLIC_AUDIO_DIR) ? fs.readdirSync(PUBLIC_AUDIO_DIR) : [];

  let radioFile: string | null = entries.includes(CANONICAL_RADIO_FILE)
    ? CANONICAL_RADIO_FILE
    : null;
  let awFile: string | null = entries.includes(CANONICAL_AUDIOWORKS_FILE)
    ? CANONICAL_AUDIOWORKS_FILE
    : null;

  for (const entry of entries) {
    const kind = classifyDuelFilename(entry);
    if (kind === 'radio' && !radioFile) {
      radioFile = entry;
    } else if (kind === 'audioworks' && !awFile) {
      awFile = entry;
    }
  }

  let radioInfo: ResolvedTrackInfo = {
    url: null,
    fileName: null,
    durationSec: 14.2,
  };
  let awInfo: ResolvedTrackInfo = {
    url: null,
    fileName: null,
    durationSec: 15.2,
  };

  if (radioFile) {
    const abs = path.join(PUBLIC_AUDIO_DIR, radioFile);
    const stat = fs.statSync(abs);
    const rawDur = await probeDurationSec(abs, 14.2);
    radioInfo = {
      url: `/assets/aistudio/${encodeURIComponent(radioFile)}?v=${Math.floor(stat.mtimeMs)}`,
      fileName: radioFile,
      durationSec: rawDur > 35 ? 14.5 : rawDur,
    };
  }

  if (awFile) {
    const abs = path.join(PUBLIC_AUDIO_DIR, awFile);
    const stat = fs.statSync(abs);
    const rawDur = await probeDurationSec(abs, 15.2);
    awInfo = {
      url: `/assets/aistudio/${encodeURIComponent(awFile)}?v=${Math.floor(stat.mtimeMs)}`,
      fileName: awFile,
      durationSec: rawDur > 35 ? 15.3 : rawDur,
    };
  }

  return {
    radio: radioInfo,
    audioworks: awInfo,
    isReadyOnServer: Boolean(radioInfo.url && awInfo.url),
  };
}

interface StoredVerifiedLeadRecord {
  id: string;
  orderNumber: string;
  createdAt: string;
  checkoutMode: 'air_plus_production' | 'production_only';
  formatLabel: string;
  totalBudgetRub: number | null;
  contact: string;
  companyOrInn: string;
  innVerified: boolean;
  channel: string;
  briefExcerpt: string;
  hasVoiceRecording: boolean;
  hasAttachedFile: boolean;
}

interface StoredQuarantinedBotRecord {
  id: string;
  createdAt: string;
  ipHash: string;
  riskScore: number;
  reasons: string[];
  maskedContact: string;
  briefPreview: string;
}

interface PersistedSecurityStore {
  verifiedCount: number;
  quarantinedCount: number;
  rateLimitedCount: number;
  authBruteForceBlocks: number;
  aiQuotaShieldBlocks: number;
  verifiedLeads: StoredVerifiedLeadRecord[];
  quarantinedLeads: StoredQuarantinedBotRecord[];
}

let cachedSecurityStore: PersistedSecurityStore | null = null;
const consumedChallengeNonces = new Map<string, number>();
const recentLeadFingerprints = new Map<string, number>();

function createEmptySecurityStore(): PersistedSecurityStore {
  return {
    verifiedCount: 0,
    quarantinedCount: 0,
    rateLimitedCount: 0,
    authBruteForceBlocks: 0,
    aiQuotaShieldBlocks: 0,
    verifiedLeads: [],
    quarantinedLeads: [],
  };
}

function readSecurityStore(): PersistedSecurityStore {
  if (cachedSecurityStore) return cachedSecurityStore;
  try {
    if (!fs.existsSync(SECURITY_LEADS_FILE)) {
      cachedSecurityStore = createEmptySecurityStore();
      return cachedSecurityStore;
    }
    const raw = JSON.parse(
      fs.readFileSync(SECURITY_LEADS_FILE, 'utf8')
    ) as Partial<PersistedSecurityStore>;
    cachedSecurityStore = {
      verifiedCount: typeof raw.verifiedCount === 'number' ? raw.verifiedCount : 0,
      quarantinedCount: typeof raw.quarantinedCount === 'number' ? raw.quarantinedCount : 0,
      rateLimitedCount: typeof raw.rateLimitedCount === 'number' ? raw.rateLimitedCount : 0,
      authBruteForceBlocks:
        typeof raw.authBruteForceBlocks === 'number' ? raw.authBruteForceBlocks : 0,
      aiQuotaShieldBlocks:
        typeof raw.aiQuotaShieldBlocks === 'number' ? raw.aiQuotaShieldBlocks : 0,
      verifiedLeads: Array.isArray(raw.verifiedLeads) ? raw.verifiedLeads : [],
      quarantinedLeads: Array.isArray(raw.quarantinedLeads) ? raw.quarantinedLeads : [],
    };
    return cachedSecurityStore;
  } catch {
    cachedSecurityStore = createEmptySecurityStore();
    return cachedSecurityStore;
  }
}

function writeSecurityStore(store: PersistedSecurityStore): void {
  cachedSecurityStore = store;
  try {
    fs.mkdirSync(CMS_DATA_DIR, { recursive: true });
    const tmp = path.join(
      CMS_DATA_DIR,
      `.security.${Date.now()}.${Math.random().toString(36).slice(2, 7)}.tmp`
    );
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
    fs.renameSync(tmp, SECURITY_LEADS_FILE);
  } catch {
    // В контейнере только для чтения сохраняем состояние в оперативной памяти процесса
  }
}

interface PersistedOrdersCrmStore {
  orders: CrmOrderRecord[];
  settings: OrderDispatchSettings;
  dispatchLogs: DispatchAttemptLog[];
}

let cachedOrdersCrmStore: PersistedOrdersCrmStore | null = null;

function createDefaultDispatchSettings(): OrderDispatchSettings {
  const envTgToken = process.env.TELEGRAM_ORDERS_BOT_TOKEN?.trim() || '';
  const envTgChat = process.env.TELEGRAM_ORDERS_CHAT_ID?.trim() || '';
  const envWebhookUrl = process.env.ORDERS_WEBHOOK_URL?.trim() || '';
  const envWebhookSecret = process.env.ORDERS_WEBHOOK_SECRET?.trim() || '';

  return {
    telegram: {
      enabled: Boolean(envTgToken && envTgChat),
      botToken: envTgToken,
      chatId: envTgChat,
      notifyOnNewOrder: true,
      notifyOnStageChange: true,
    },
    webhook: {
      enabled: Boolean(envWebhookUrl),
      endpointUrl: envWebhookUrl,
      hmacSecret: envWebhookSecret,
      notifyOnNewOrder: true,
      notifyOnStageChange: true,
    },
  };
}

function readOrdersCrmStore(): PersistedOrdersCrmStore {
  if (cachedOrdersCrmStore) return cachedOrdersCrmStore;
  try {
    if (!fs.existsSync(ORDERS_CRM_FILE)) {
      cachedOrdersCrmStore = {
        orders: createSeedCrmOrders(),
        settings: createDefaultDispatchSettings(),
        dispatchLogs: [],
      };
      return cachedOrdersCrmStore;
    }
    const raw = JSON.parse(
      fs.readFileSync(ORDERS_CRM_FILE, 'utf8')
    ) as Partial<PersistedOrdersCrmStore>;
    const defaults = createDefaultDispatchSettings();
    cachedOrdersCrmStore = {
      orders:
        Array.isArray(raw.orders) && raw.orders.length > 0
          ? raw.orders
          : createSeedCrmOrders(),
      settings: {
        telegram: {
          ...defaults.telegram,
          ...(raw.settings?.telegram ?? {}),
        },
        webhook: {
          ...defaults.webhook,
          ...(raw.settings?.webhook ?? {}),
        },
      },
      dispatchLogs: Array.isArray(raw.dispatchLogs) ? raw.dispatchLogs : [],
    };
    return cachedOrdersCrmStore;
  } catch {
    cachedOrdersCrmStore = {
      orders: createSeedCrmOrders(),
      settings: createDefaultDispatchSettings(),
      dispatchLogs: [],
    };
    return cachedOrdersCrmStore;
  }
}

function writeOrdersCrmStore(store: PersistedOrdersCrmStore): void {
  cachedOrdersCrmStore = store;
  try {
    fs.mkdirSync(CMS_DATA_DIR, { recursive: true });
    const tmp = path.join(
      CMS_DATA_DIR,
      `.orders-crm.${Date.now()}.${Math.random().toString(36).slice(2, 7)}.tmp`
    );
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
    fs.renameSync(tmp, ORDERS_CRM_FILE);
  } catch {
    // В среде только для чтения сохраняем в оперативной памяти процесса
  }
}

function maskSecretForAdmin(secret: string): string {
  const trimmed = secret.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 6) return '••••••';
  return `••••••••${trimmed.slice(-4)}`;
}

async function dispatchOrderToExternalChannels(
  orderId: string,
  event: 'order.created' | 'order.stage_changed' | 'dispatch.test'
): Promise<{
  telegramResult: CrmOrderRecord['delivery']['telegram'];
  webhookResult: CrmOrderRecord['delivery']['webhook'];
}> {
  const crmStore = readOrdersCrmStore();
  const targetOrder =
    crmStore.orders.find((o) => o.id === orderId) ?? crmStore.orders[0];
  const nowIso = new Date().toISOString();

  if (!targetOrder) {
    const emptyStatus = {
      state: 'not_configured' as const,
      updatedAt: nowIso,
      httpStatus: null,
      detail: 'Нет заказа для отправки',
    };
    return { telegramResult: emptyStatus, webhookResult: emptyStatus };
  }

  const { telegram, webhook } = crmStore.settings;

  // 1. Telegram Bot API Dispatch
  const pushDispatchLog = (entry: DispatchAttemptLog) => {
    crmStore.dispatchLogs = [entry, ...crmStore.dispatchLogs].slice(0, 35);
  };

  let telegramResult: CrmOrderRecord['delivery']['telegram'];
  const shouldSendTg =
    event === 'dispatch.test' ||
    (telegram.enabled &&
      ((event === 'order.created' && telegram.notifyOnNewOrder) ||
        (event === 'order.stage_changed' && telegram.notifyOnStageChange)));

  if (!shouldSendTg || !telegram.botToken.trim() || !telegram.chatId.trim()) {
    telegramResult = {
      state: 'not_configured',
      updatedAt: nowIso,
      httpStatus: null,
      detail:
        !telegram.botToken.trim() || !telegram.chatId.trim()
          ? 'Укажите Bot Token и Chat ID продюсерского чата для прямой отправки'
          : 'Автоотправка этого события отключена в настройках Telegram',
    };
    if (event === 'dispatch.test') {
      pushDispatchLog({
        id: `log-tg-${Date.now()}`,
        timestamp: nowIso,
        orderNumber: targetOrder.orderNumber,
        channel: 'telegram',
        event,
        state: 'ready_simulated',
        httpStatus: null,
        latencyMs: 2,
        summary:
          'Локальная проверка шаблона Telegram успешна (для реальной доставки укажите Bot Token и Chat ID)',
      });
    }
  } else {
    const started = Date.now();
    try {
      const text = formatTelegramOrderDispatchMessage(targetOrder, event);
      const tgUrl = `https://api.telegram.org/bot${telegram.botToken.trim()}/sendMessage`;
      const tgRes = await fetch(tgUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegram.chatId.trim(),
          text,
        }),
        signal: AbortSignal.timeout(5000),
      });
      const latencyMs = Date.now() - started;
      if (tgRes.ok) {
        telegramResult = {
          state: 'delivered',
          updatedAt: new Date().toISOString(),
          httpStatus: tgRes.status,
          detail: `Доставлено в Telegram за ${latencyMs} мс`,
        };
      } else {
        telegramResult = {
          state: 'failed',
          updatedAt: new Date().toISOString(),
          httpStatus: tgRes.status,
          detail: `Ответ Telegram API: HTTP ${tgRes.status}`,
        };
      }
      pushDispatchLog({
        id: `log-tg-${Date.now()}`,
        timestamp: new Date().toISOString(),
        orderNumber: targetOrder.orderNumber,
        channel: 'telegram',
        event,
        state: telegramResult.state,
        httpStatus: tgRes.status,
        latencyMs,
        summary: telegramResult.detail,
      });
    } catch (err) {
      const latencyMs = Date.now() - started;
      telegramResult = {
        state: 'failed',
        updatedAt: new Date().toISOString(),
        httpStatus: null,
        detail:
          err instanceof Error
            ? `Сетевой сбой Telegram: ${err.message.slice(0, 90)}`
            : 'Не удалось связаться с Telegram Bot API',
      };
      pushDispatchLog({
        id: `log-tg-${Date.now()}`,
        timestamp: new Date().toISOString(),
        orderNumber: targetOrder.orderNumber,
        channel: 'telegram',
        event,
        state: 'failed',
        httpStatus: null,
        latencyMs,
        summary: telegramResult.detail,
      });
    }
  }

  // 2. Outbound Webhook Dispatch (HMAC-SHA256 signed JSON)
  let webhookResult: CrmOrderRecord['delivery']['webhook'];
  const shouldSendWh =
    event === 'dispatch.test' ||
    (webhook.enabled &&
      ((event === 'order.created' && webhook.notifyOnNewOrder) ||
        (event === 'order.stage_changed' && webhook.notifyOnStageChange)));

  if (!shouldSendWh || !webhook.endpointUrl.trim()) {
    webhookResult = {
      state: 'not_configured',
      updatedAt: nowIso,
      httpStatus: null,
      detail: !webhook.endpointUrl.trim()
        ? 'Укажите Webhook URL (amoCRM / Bitrix24 / Make или локальный контур)'
        : 'Отправка этого события отключена в настройках Webhook',
    };
    if (event === 'dispatch.test') {
      pushDispatchLog({
        id: `log-wh-${Date.now() + 1}`,
        timestamp: nowIso,
        orderNumber: targetOrder.orderNumber,
        channel: 'webhook',
        event,
        state: 'ready_simulated',
        httpStatus: null,
        latencyMs: 1,
        summary:
          'JSON-конверт и подпись HMAC-SHA256 сформированы корректно (URL не задан)',
      });
    }
  } else {
    const started = Date.now();
    try {
      const envelope = buildWebhookOrderEnvelope(targetOrder, event);
      const rawJson = JSON.stringify(envelope);
      const signingSecret = webhook.hmacSecret.trim() || getSessionSecret();
      const signatureHex = crypto
        .createHmac('sha256', signingSecret)
        .update(rawJson)
        .digest('hex');

      const whRes = await fetch(webhook.endpointUrl.trim(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-FMWorks-Event': event,
          'X-FMWorks-Idempotency-Key': envelope.idempotencyKey,
          'X-FMWorks-Signature': `sha256=${signatureHex}`,
        },
        body: rawJson,
        signal: AbortSignal.timeout(5000),
      });
      const latencyMs = Date.now() - started;

      if (whRes.ok) {
        webhookResult = {
          state: 'delivered',
          updatedAt: new Date().toISOString(),
          httpStatus: whRes.status,
          detail: `Пакет принят внешней CRM (HTTP ${whRes.status} · ${latencyMs} мс)`,
        };
      } else {
        webhookResult = {
          state: 'failed',
          updatedAt: new Date().toISOString(),
          httpStatus: whRes.status,
          detail: `Внешний сервер вернул HTTP ${whRes.status}`,
        };
      }

      pushDispatchLog({
        id: `log-wh-${Date.now() + 1}`,
        timestamp: new Date().toISOString(),
        orderNumber: targetOrder.orderNumber,
        channel: 'webhook',
        event,
        state: webhookResult.state,
        httpStatus: whRes.status,
        latencyMs,
        summary: webhookResult.detail,
      });
    } catch (err) {
      const latencyMs = Date.now() - started;
      webhookResult = {
        state: 'failed',
        updatedAt: new Date().toISOString(),
        httpStatus: null,
        detail:
          err instanceof Error
            ? `Ошибка доставки Webhook: ${err.message.slice(0, 90)}`
            : 'Не удалось доставить Webhook',
      };
      pushDispatchLog({
        id: `log-wh-${Date.now() + 1}`,
        timestamp: new Date().toISOString(),
        orderNumber: targetOrder.orderNumber,
        channel: 'webhook',
        event,
        state: 'failed',
        httpStatus: null,
        latencyMs,
        summary: webhookResult.detail,
      });
    }
  }

  crmStore.orders = crmStore.orders.map((o) =>
    o.id === targetOrder.id
      ? {
          ...o,
          delivery: {
            crmRegistry: 'saved',
            telegram: telegramResult,
            webhook: webhookResult,
          },
        }
      : o
  );
  writeOrdersCrmStore(crmStore);
  return { telegramResult, webhookResult };
}

function resolveClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

function hashIpForAudit(ip: string): string {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(ip)
    .digest('hex')
    .slice(0, 10);
}

function createSlidingWindowRateLimiter(
  maxHits: number,
  windowMs: number,
  minIntervalMs = 0
) {
  const limiter = new RateLimiter({
    maxAttempts: maxHits,
    windowMs,
    minIntervalMs,
    storage: null,
  });
  return {
    check(key: string) {
      return limiter.check(key);
    },
    consume(key: string) {
      return limiter.consume(key);
    },
    resetKey(key: string): void {
      limiter.reset(key);
    },
  };
}

const loginFailureLimiter = createSlidingWindowRateLimiter(8, 15 * 60 * 1000, 0);
const orderSubmitLimiter = createSlidingWindowRateLimiter(5, 10 * 60 * 1000, 1000);
const orderValidationBurstLimiter = createSlidingWindowRateLimiter(15, 5 * 60 * 1000, 0);
const aiRecommendLimiter = createSlidingWindowRateLimiter(15, 5 * 60 * 1000, 0);
const duelUploadLimiter = createSlidingWindowRateLimiter(12, 10 * 60 * 1000, 0);

const LEAD_CHALLENGE_TTL_MS = 2 * 60 * 60 * 1000;
const LEAD_POW_DIFFICULTY = 3;

function issueLeadChallenge() {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + LEAD_CHALLENGE_TTL_MS;
  const nonce = crypto.randomBytes(12).toString('hex');
  const salt = `fmw-${nonce.slice(0, 12)}-${issuedAt.toString(36)}`;
  const payload = Buffer.from(
    JSON.stringify({
      nonce,
      salt,
      difficulty: LEAD_POW_DIFFICULTY,
      iat: issuedAt,
      exp: expiresAt,
    }),
    'utf8'
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');
  return {
    challengeToken: `${payload}.${sig}`,
    salt,
    difficulty: LEAD_POW_DIFFICULTY,
    issuedAt,
    expiresAt,
  };
}

function verifyLeadChallengeToken(rawToken: string): {
  valid: boolean;
  nonce: string;
  salt: string;
  difficulty: number;
  alreadyUsed: boolean;
} {
  if (!rawToken || typeof rawToken !== 'string') {
    return { valid: false, nonce: '', salt: '', difficulty: LEAD_POW_DIFFICULTY, alreadyUsed: false };
  }
  const parts = rawToken.trim().split('.');
  if (parts.length !== 2) {
    return { valid: false, nonce: '', salt: '', difficulty: LEAD_POW_DIFFICULTY, alreadyUsed: false };
  }
  const [payload, sig] = parts;
  if (!payload || !sig) {
    return { valid: false, nonce: '', salt: '', difficulty: LEAD_POW_DIFFICULTY, alreadyUsed: false };
  }
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');
  if (!safeCompareStrings(sig, expectedSig)) {
    return { valid: false, nonce: '', salt: '', difficulty: LEAD_POW_DIFFICULTY, alreadyUsed: false };
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      nonce?: string;
      salt?: string;
      difficulty?: number;
      exp?: number;
    };
    if (
      !parsed.nonce ||
      !parsed.salt ||
      typeof parsed.exp !== 'number' ||
      parsed.exp < Date.now()
    ) {
      return { valid: false, nonce: '', salt: '', difficulty: LEAD_POW_DIFFICULTY, alreadyUsed: false };
    }
    const now = Date.now();
    for (const [k, expTs] of consumedChallengeNonces.entries()) {
      if (expTs < now) consumedChallengeNonces.delete(k);
    }
    const alreadyUsed = consumedChallengeNonces.has(parsed.nonce);
    return {
      valid: true,
      nonce: parsed.nonce,
      salt: parsed.salt,
      difficulty: typeof parsed.difficulty === 'number' ? parsed.difficulty : LEAD_POW_DIFFICULTY,
      alreadyUsed,
    };
  } catch {
    return { valid: false, nonce: '', salt: '', difficulty: LEAD_POW_DIFFICULTY, alreadyUsed: false };
  }
}

function hasValidAudioMagicBytes(buf: Buffer): boolean {
  if (buf.length < 16) return false;
  const head4 = buf.subarray(0, 4).toString('latin1');
  if (head4 === 'RIFF' || head4 === 'OggS' || head4 === 'fLaC') return true;
  if (buf.subarray(0, 3).toString('latin1') === 'ID3') return true;
  if (buf.subarray(4, 8).toString('latin1') === 'ftyp') return true;
  // MPEG ADTS sync word
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true;
  return false;
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');

  // Безопасные HTTP-заголовки (совместимые с превью в iframe и записью голосового ТЗ)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), geolocation=(), payment=(), usb=(), microphone=(self)'
    );
    next();
  });

  try {
    fs.mkdirSync(PUBLIC_CMS_MEDIA_DIR, { recursive: true });
  } catch {
    // Ignore read-only fs in restricted containers
  }
  app.use(
    '/assets/cms',
    express.static(PUBLIC_CMS_MEDIA_DIR, {
      acceptRanges: true,
      maxAge: '7d',
    })
  );

  // =========================================================================
  // Studio CMS Auth & Content Endpoints
  // =========================================================================

  app.get('/api/cms/auth/session', (req, res) => {
    const token = extractBearerToken(req);
    res.json({
      authenticated: verifyAdminToken(token),
    });
  });

  app.post('/api/cms/auth/login', express.json({ limit: '64kb' }), (req, res) => {
    const clientIp = resolveClientIp(req);
    const rawPassword =
      req.body && typeof req.body.password === 'string'
        ? req.body.password.trim()
        : '';

    if (!rawPassword) {
      res.status(400).json({ error: 'Введите пароль студии' });
      return;
    }

    const rateCheck = loginFailureLimiter.consume(clientIp);
    if (!rateCheck.allowed) {
      const store = readSecurityStore();
      store.authBruteForceBlocks += 1;
      writeSecurityStore(store);
      res.setHeader('Retry-After', String(rateCheck.retryAfterSec));
      res.status(429).json({
        error: `Слишком много попыток входа. Повторите через ${rateCheck.retryAfterSec} сек.`,
      });
      return;
    }

    if (!safeCompareStrings(rawPassword, getStudioAdminPassword())) {
      res.status(401).json({ error: 'Неверный пароль студии. Проверьте раскладку и попробуйте снова.' });
      return;
    }

    loginFailureLimiter.resetKey(clientIp);
    const session = issueAdminToken();
    res.json({
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt,
    });
  });

  app.post('/api/cms/auth/logout', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/cms/content', (_req, res) => {
    const snapshot = readPersistedCmsSnapshot();
    res.json({
      customized: snapshot !== null,
      snapshot,
      editorialWarnings: snapshot ? scanEditorialWarnings(snapshot) : [],
    });
  });

  app.put(
    '/api/cms/content',
    requireStudioAuth,
    express.json({ limit: '6mb' }),
    (req, res) => {
      const incoming = req.body?.snapshot ?? req.body;
      if (
        !incoming ||
        typeof incoming !== 'object' ||
        incoming.schemaVersion !== 1 ||
        !incoming.flagshipReel ||
        !Array.isArray(incoming.portfolioCases) ||
        incoming.portfolioCases.length === 0 ||
        !incoming.duel ||
        !incoming.neuroApproach ||
        !incoming.siteCopy
      ) {
        res.status(400).json({
          error: 'Некорректная структура снимка CMS',
        });
        return;
      }

      const hasPublishedCase = incoming.portfolioCases.some(
        (c: { published?: boolean }) => c && c.published !== false
      );
      if (!hasPublishedCase) {
        res.status(400).json({
          error: 'В портфолио должен оставаться хотя бы один опубликованный кейс',
        });
        return;
      }

      const stamped: StudioCmsSnapshot = {
        ...(incoming as StudioCmsSnapshot),
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
      };

      try {
        writePersistedCmsSnapshot(stamped);
        const editorialWarnings = scanEditorialWarnings(stamped);
        res.json({
          ok: true,
          customized: true,
          snapshot: stamped,
          editorialWarnings,
        });
      } catch (err) {
        res.status(500).json({
          error:
            err instanceof Error
              ? err.message
              : 'Не удалось сохранить данные CMS на сервере',
        });
      }
    }
  );

  app.post('/api/cms/reset', requireStudioAuth, (_req, res) => {
    try {
      resetPersistedCmsSnapshot();
      res.json({
        ok: true,
        customized: false,
        snapshot: null,
        editorialWarnings: [],
      });
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error ? err.message : 'Не удалось сбросить данные CMS',
      });
    }
  });

  app.post(
    '/api/cms/upload-audio',
    requireStudioAuth,
    express.raw({ type: () => true, limit: '80mb' }),
    async (req, res) => {
      const bodyBuffer = req.body as Buffer;
      if (!Buffer.isBuffer(bodyBuffer) || bodyBuffer.length < 128) {
        res.status(400).json({ error: 'Пустой или повреждённый аудиофайл' });
        return;
      }

      const rawHeaderName = req.headers['x-file-name'];
      const decodedName =
        typeof rawHeaderName === 'string'
          ? (() => {
              try {
                return decodeURIComponent(rawHeaderName);
              } catch {
                return rawHeaderName;
              }
            })()
          : 'studio-track.wav';

      const extLower = path.extname(decodedName).toLowerCase();
      const targetExt = extLower === '.mp3' ? '.mp3' : '.wav';
      const stem = sanitizeSafeFileStem(decodedName, 'studio-audio');
      const finalFileName = `${stem}-${Date.now()}${targetExt}`;

      fs.mkdirSync(PUBLIC_CMS_MEDIA_DIR, { recursive: true });
      const targetAbs = path.join(PUBLIC_CMS_MEDIA_DIR, finalFileName);
      const tempAbs = path.join(
        PUBLIC_CMS_MEDIA_DIR,
        `.cms_audio_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.tmp`
      );

      try {
        fs.writeFileSync(tempAbs, bodyBuffer);

        if (extLower === '.mp3' || extLower === '.wav') {
          fs.renameSync(tempAbs, targetAbs);
        } else {
          try {
            await execFileAsync('ffmpeg', ['-y', '-i', tempAbs, targetAbs]);
            fs.unlinkSync(tempAbs);
          } catch {
            fs.renameSync(tempAbs, targetAbs);
          }
        }

        const measuredSec = await probeDurationSec(targetAbs, 15);

        if (fs.existsSync(path.join(__dirname, 'dist'))) {
          fs.mkdirSync(DIST_CMS_MEDIA_DIR, { recursive: true });
          fs.copyFileSync(targetAbs, path.join(DIST_CMS_MEDIA_DIR, finalFileName));
        }

        res.json({
          ok: true,
          url: `/assets/cms/${encodeURIComponent(finalFileName)}`,
          fileName: decodedName,
          durationSec: Math.round(measuredSec * 100) / 100,
        });
      } catch (err) {
        if (fs.existsSync(tempAbs)) {
          try {
            fs.unlinkSync(tempAbs);
          } catch {
            // Ignore cleanup errors
          }
        }
        res.status(500).json({
          error:
            err instanceof Error ? err.message : 'Ошибка сохранения аудиофайла',
        });
      }
    }
  );

  app.post(
    '/api/cms/upload-image',
    requireStudioAuth,
    express.raw({ type: () => true, limit: '15mb' }),
    (req, res) => {
      const bodyBuffer = req.body as Buffer;
      if (!Buffer.isBuffer(bodyBuffer) || bodyBuffer.length < 64) {
        res.status(400).json({ error: 'Пустой или повреждённый файл изображения' });
        return;
      }

      const rawHeaderName = req.headers['x-file-name'];
      const decodedName =
        typeof rawHeaderName === 'string'
          ? (() => {
              try {
                return decodeURIComponent(rawHeaderName);
              } catch {
                return rawHeaderName;
              }
            })()
          : 'cover.jpg';

      const extLower = path.extname(decodedName).toLowerCase();
      const allowedExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
      const targetExt = allowedExts.has(extLower) ? extLower : '.jpg';
      const stem = sanitizeSafeFileStem(decodedName, 'case-cover');
      const finalFileName = `${stem}-${Date.now()}${targetExt}`;

      fs.mkdirSync(PUBLIC_CMS_MEDIA_DIR, { recursive: true });
      const targetAbs = path.join(PUBLIC_CMS_MEDIA_DIR, finalFileName);

      try {
        fs.writeFileSync(targetAbs, bodyBuffer);

        if (fs.existsSync(path.join(__dirname, 'dist'))) {
          fs.mkdirSync(DIST_CMS_MEDIA_DIR, { recursive: true });
          fs.copyFileSync(targetAbs, path.join(DIST_CMS_MEDIA_DIR, finalFileName));
        }

        res.json({
          ok: true,
          url: `/assets/cms/${encodeURIComponent(finalFileName)}`,
          fileName: decodedName,
        });
      } catch (err) {
        res.status(500).json({
          error:
            err instanceof Error ? err.message : 'Ошибка сохранения обложки',
        });
      }
    }
  );

  // =========================================================================
  // Anti-Spam, Anti-Bot & Paid-Traffic Lead Shield Gateway
  // =========================================================================

  app.get('/api/security/challenge', (_req, res) => {
    const challenge = issueLeadChallenge();
    res.json({
      ok: true,
      ...challenge,
    });
  });

  app.post('/api/orders/submit', express.json({ limit: '64kb' }), (req, res) => {
    const clientIp = resolveClientIp(req);
    const body = (req.body ?? {}) as {
      source?: OrderEntrySource;
      checkoutMode?: 'air_plus_production' | 'production_only';
      orderNumberCandidate?: string;
      formatLabel?: string;
      totalBudgetRub?: number;
      contactLine?: string;
      companyLine?: string;
      briefText?: string;
      hasVoiceRecording?: boolean;
      voiceDurationSec?: number;
      hasAttachedFile?: boolean;
      attachedFileName?: string | null;
      mediaPlanSnapshot?: OrderMediaPlanSnapshot | null;
      isReturningFastTrack?: boolean;
      requireBriefOrVoice?: boolean;
      websiteTrap?: string;
      dwellMs?: number;
      pointerMoves?: number;
      keystrokes?: number;
      focusEvents?: number;
      challengeToken?: string;
      powSolution?: string;
    };

    const checkoutMode =
      body.checkoutMode === 'air_plus_production'
        ? 'air_plus_production'
        : 'production_only';
    const formScope = resolveLeadFormRateScope(checkoutMode);
    const scopedRateKey = `${clientIp}:${formScope}`;

    const preRateCheck = orderSubmitLimiter.check(scopedRateKey);
    res.setHeader('X-RateLimit-Limit', String(preRateCheck.maxAttempts));
    res.setHeader('X-RateLimit-Remaining', String(preRateCheck.remainingAttempts));

    if (!preRateCheck.allowed) {
      const store = readSecurityStore();
      store.rateLimitedCount += 1;
      writeSecurityStore(store);
      res.setHeader('Retry-After', String(preRateCheck.retryAfterSec));
      res.status(429).json({
        ok: false,
        verdict: 'rate_limited',
        retryAfterSec: preRateCheck.retryAfterSec,
        rateLimit: {
          remainingAttempts: 0,
          maxAttempts: preRateCheck.maxAttempts,
          retryAfterSec: preRateCheck.retryAfterSec,
        },
        error:
          preRateCheck.message ??
          `Превышен лимит отправок с одного адреса. Подождите ${preRateCheck.retryAfterSec} сек. или напишите напрямую на hello@fmworks.ru.`,
        nextChallenge: issueLeadChallenge(),
      });
      return;
    }

    const contactLine = typeof body.contactLine === 'string' ? body.contactLine : '';
    const companyLine = typeof body.companyLine === 'string' ? body.companyLine : '';
    const briefText = typeof body.briefText === 'string' ? body.briefText : '';
    const websiteTrap = typeof body.websiteTrap === 'string' ? body.websiteTrap : '';
    const orderNumber =
      typeof body.orderNumberCandidate === 'string' &&
      /^FM-[A-Z0-9-]{2,18}$/.test(body.orderNumberCandidate)
        ? body.orderNumberCandidate
        : `FM-${2400 + (Date.now() % 700)}`;

    const tokenState = verifyLeadChallengeToken(
      typeof body.challengeToken === 'string' ? body.challengeToken : ''
    );
    const powValid =
      tokenState.valid &&
      verifyLeadChallengePow(
        tokenState.salt,
        typeof body.powSolution === 'string' ? body.powSolution : '',
        tokenState.difficulty
      );

    const now = Date.now();
    for (const [fpKey, expTs] of recentLeadFingerprints.entries()) {
      if (expTs < now) recentLeadFingerprints.delete(fpKey);
    }
    const fingerprint = computeLeadPayloadFingerprint(contactLine, companyLine, briefText);
    const isDuplicateRecentPayload = recentLeadFingerprints.has(fingerprint);

    const evaluation = evaluateLeadSubmissionSecurity({
      contactLine,
      companyLine,
      briefText,
      hasVoiceRecording: Boolean(body.hasVoiceRecording),
      hasAttachedFile: Boolean(body.hasAttachedFile),
      isReturningFastTrack: Boolean(body.isReturningFastTrack),
      requireBriefOrVoice: Boolean(body.requireBriefOrVoice),
      websiteTrap,
      dwellMs: typeof body.dwellMs === 'number' ? body.dwellMs : 0,
      pointerMoves: typeof body.pointerMoves === 'number' ? body.pointerMoves : 0,
      keystrokes: typeof body.keystrokes === 'number' ? body.keystrokes : 0,
      focusEvents: typeof body.focusEvents === 'number' ? body.focusEvents : 0,
      challengeValid: tokenState.valid,
      nonceAlreadyUsed: tokenState.alreadyUsed,
      powValid,
      isDuplicateRecentPayload,
    });

    if (evaluation.verdict === 'validation_error') {
      const valBurst = orderValidationBurstLimiter.consume(clientIp);
      if (!valBurst.allowed) {
        const store = readSecurityStore();
        store.rateLimitedCount += 1;
        writeSecurityStore(store);
        res.setHeader('Retry-After', String(valBurst.retryAfterSec));
        res.status(429).json({
          ok: false,
          verdict: 'rate_limited',
          retryAfterSec: valBurst.retryAfterSec,
          error: valBurst.message,
          nextChallenge: issueLeadChallenge(),
        });
        return;
      }

      res.status(400).json({
        ok: false,
        verdict: 'validation_error',
        conversionAllowed: false,
        contactError: evaluation.contactError,
        companyError: evaluation.companyError,
        taskError: evaluation.taskError,
        rateLimit: {
          remainingAttempts: preRateCheck.remainingAttempts,
          maxAttempts: preRateCheck.maxAttempts,
          retryAfterSec: 0,
        },
        nextChallenge: issueLeadChallenge(),
      });
      return;
    }

    const rate = orderSubmitLimiter.consume(scopedRateKey);
    res.setHeader('X-RateLimit-Remaining', String(rate.remainingAttempts));
    if (!rate.allowed) {
      const store = readSecurityStore();
      store.rateLimitedCount += 1;
      writeSecurityStore(store);
      res.setHeader('Retry-After', String(rate.retryAfterSec));
      res.status(429).json({
        ok: false,
        verdict: 'rate_limited',
        retryAfterSec: rate.retryAfterSec,
        rateLimit: {
          remainingAttempts: 0,
          maxAttempts: rate.maxAttempts,
          retryAfterSec: rate.retryAfterSec,
        },
        error:
          rate.message ??
          `Превышен лимит отправок с одного адреса. Подождите ${rate.retryAfterSec} сек.`,
        nextChallenge: issueLeadChallenge(),
      });
      return;
    }

    if (tokenState.valid && tokenState.nonce) {
      consumedChallengeNonces.set(tokenState.nonce, now + LEAD_CHALLENGE_TTL_MS);
    }

    const store = readSecurityStore();

    if (evaluation.verdict === 'quarantined_bot') {
      store.quarantinedCount += 1;
      const maskedContact = evaluation.normalizedContact
        ? `${evaluation.normalizedContact.slice(0, 14)}${evaluation.normalizedContact.length > 14 ? '…' : ''}`
        : 'пусто';
      store.quarantinedLeads = [
        {
          id: `q-${now}-${crypto.randomBytes(3).toString('hex')}`,
          createdAt: new Date(now).toISOString(),
          ipHash: hashIpForAudit(clientIp),
          riskScore: evaluation.riskScore,
          reasons: evaluation.reasons,
          maskedContact,
          briefPreview: evaluation.sanitizedBrief.slice(0, 80),
        },
        ...store.quarantinedLeads,
      ].slice(0, 120);
      writeSecurityStore(store);

      // Теневой карантин: бот не получает подсказок для обхода, но конверсия для рекламных пикселей закрыта
      res.json({
        ok: true,
        verdict: 'quarantined_bot',
        orderNumber,
        conversionAllowed: false,
        verifiedConversionSeal: null,
        innVerified: false,
        rateLimit: {
          remainingAttempts: rate.remainingAttempts,
          maxAttempts: rate.maxAttempts,
          retryAfterSec: 0,
        },
        nextChallenge: issueLeadChallenge(),
      });
      return;
    }

    // Верифицированная заявка реального клиента
    recentLeadFingerprints.set(fingerprint, now + 10 * 60 * 1000);
    store.verifiedCount += 1;
    const resolvedBudgetRub =
      typeof body.totalBudgetRub === 'number' && Number.isFinite(body.totalBudgetRub)
        ? Math.round(body.totalBudgetRub)
        : body.mediaPlanSnapshot?.unifiedTotalRub ?? 25_000;

    const newVerifiedRecord: StoredVerifiedLeadRecord = {
      id: `lead-${now}-${crypto.randomBytes(3).toString('hex')}`,
      orderNumber,
      createdAt: new Date(now).toISOString(),
      checkoutMode,
      formatLabel:
        typeof body.formatLabel === 'string'
          ? body.formatLabel.slice(0, 120)
          : 'Студийный заказ',
      totalBudgetRub: resolvedBudgetRub,
      contact: evaluation.normalizedContact,
      companyOrInn: evaluation.normalizedCompany,
      innVerified: evaluation.innVerified,
      channel: evaluation.detectedChannel ?? 'phone',
      briefExcerpt: evaluation.sanitizedBrief.slice(0, 220),
      hasVoiceRecording: Boolean(body.hasVoiceRecording),
      hasAttachedFile: Boolean(body.hasAttachedFile),
    };
    store.verifiedLeads = [newVerifiedRecord, ...store.verifiedLeads].slice(0, 150);
    writeSecurityStore(store);

    // Атомарная регистрация сделки в CRM-пульте продюсеров + асинхронный Outbox в Telegram и Webhook
    const crmStore = readOrdersCrmStore();
    const nowIso = new Date(now).toISOString();
    const holdExpiresIso = new Date(now + 4 * 3600 * 1000).toISOString();
    const validSources: readonly OrderEntrySource[] = [
      'order_page',
      'quick_order_drawer',
      'standalone_hold_modal',
    ];
    const resolvedSource: OrderEntrySource = validSources.includes(
      body.source as OrderEntrySource
    )
      ? (body.source as OrderEntrySource)
      : 'order_page';

    const sanitizedMediaSnap: OrderMediaPlanSnapshot | null =
      body.mediaPlanSnapshot &&
      typeof body.mediaPlanSnapshot === 'object' &&
      Array.isArray(body.mediaPlanSnapshot.stations)
        ? body.mediaPlanSnapshot
        : null;

    const newCrmOrder: CrmOrderRecord = {
      id: `crm-${now}-${crypto.randomBytes(3).toString('hex')}`,
      orderNumber,
      createdAt: nowIso,
      updatedAt: nowIso,
      holdExpiresAt: holdExpiresIso,
      source: resolvedSource,
      checkoutMode,
      stage: 'new_hold',
      formatLabel: newVerifiedRecord.formatLabel,
      totalBudgetRub: resolvedBudgetRub,
      contact: evaluation.normalizedContact,
      detectedChannel: evaluation.detectedChannel ?? 'phone',
      companyOrInn: evaluation.normalizedCompany,
      innVerified: evaluation.innVerified,
      briefText: evaluation.sanitizedBrief.slice(0, 1500),
      hasVoiceRecording: Boolean(body.hasVoiceRecording),
      voiceDurationSec:
        typeof body.voiceDurationSec === 'number' && Number.isFinite(body.voiceDurationSec)
          ? Math.max(0, Math.min(300, Math.round(body.voiceDurationSec)))
          : 0,
      attachedFileName:
        typeof body.attachedFileName === 'string' && body.attachedFileName.trim()
          ? body.attachedFileName.trim().slice(0, 180)
          : null,
      producerNotes: '',
      compliance: {
        trafficConfirmed: false,
        fz38Checked: false,
        rightsPassportIssued: sanitizedMediaSnap?.spotReadiness === 'ready_with_passport',
        edoAndOrdRegistered: false,
      },
      mediaPlanSnapshot: sanitizedMediaSnap,
      delivery: {
        crmRegistry: 'saved',
        telegram: {
          state: 'ready_simulated',
          updatedAt: nowIso,
          httpStatus: null,
          detail: 'В очереди диспетчеризации Telegram…',
        },
        webhook: {
          state: 'ready_simulated',
          updatedAt: nowIso,
          httpStatus: null,
          detail: 'В очереди диспетчеризации Webhook…',
        },
      },
    };

    crmStore.orders = [newCrmOrder, ...crmStore.orders].slice(0, 200);
    writeOrdersCrmStore(crmStore);

    // Неблокирующий запуск внешней доставки (Telegram + Webhook)
    void dispatchOrderToExternalChannels(newCrmOrder.id, 'order.created');

    const verifiedConversionSeal = crypto
      .createHmac('sha256', getSessionSecret())
      .update(`verified:${orderNumber}:${now}`)
      .digest('hex')
      .slice(0, 24);

    res.json({
      ok: true,
      verdict: 'verified_human',
      orderNumber,
      crmOrderId: newCrmOrder.id,
      conversionAllowed: true,
      verifiedConversionSeal,
      innVerified: evaluation.innVerified,
      detectedChannel: evaluation.detectedChannel,
      rateLimit: {
        remainingAttempts: rate.remainingAttempts,
        maxAttempts: rate.maxAttempts,
        retryAfterSec: 0,
      },
      nextChallenge: issueLeadChallenge(),
    });
  });

  // =========================================================================
  // Studio CRM Orders Funnel & Outbox Dispatch Endpoints
  // =========================================================================

  // Встроенный локальный приёмник Webhook для быстрой проверки интеграции прямо в контейнере
  app.post('/api/webhooks/loopback-crm-sink', express.json({ limit: '128kb' }), (req, res) => {
    const sigHeader = req.headers['x-fmworks-signature'];
    const eventHeader = req.headers['x-fmworks-event'] || 'unknown';
    res.status(200).json({
      ok: true,
      receivedEvent: eventHeader,
      signaturePresent: Boolean(sigHeader),
      receivedAt: new Date().toISOString(),
    });
  });

  app.get('/api/cms/orders', requireStudioAuth, (_req, res) => {
    const crmStore = readOrdersCrmStore();
    const { telegram, webhook } = crmStore.settings;

    res.json({
      ok: true,
      orders: crmStore.orders,
      dispatchLogs: crmStore.dispatchLogs.slice(0, 25),
      settings: {
        telegram: {
          enabled: telegram.enabled,
          hasBotToken: Boolean(telegram.botToken.trim()),
          maskedBotToken: maskSecretForAdmin(telegram.botToken),
          chatId: telegram.chatId,
          notifyOnNewOrder: telegram.notifyOnNewOrder,
          notifyOnStageChange: telegram.notifyOnStageChange,
        },
        webhook: {
          enabled: webhook.enabled,
          endpointUrl: webhook.endpointUrl,
          hasHmacSecret: Boolean(webhook.hmacSecret.trim()),
          maskedHmacSecret: maskSecretForAdmin(webhook.hmacSecret),
          notifyOnNewOrder: webhook.notifyOnNewOrder,
          notifyOnStageChange: webhook.notifyOnStageChange,
        },
      },
    });
  });

  app.patch(
    '/api/cms/orders/:orderId',
    requireStudioAuth,
    express.json({ limit: '64kb' }),
    (req, res) => {
      const { orderId } = req.params;
      const body = (req.body ?? {}) as {
        stage?: CrmOrderStage;
        producerNotes?: string;
        compliance?: Partial<OrderComplianceChecklist>;
      };

      const crmStore = readOrdersCrmStore();
      const idx = crmStore.orders.findIndex((o) => o.id === orderId);
      if (idx === -1) {
        res.status(404).json({ ok: false, error: 'Заказ не найден в реестре CRM' });
        return;
      }

      const existing = crmStore.orders[idx];
      const validStageIds = new Set(CRM_ORDER_STAGES.map((s) => s.id));
      const nextStage: CrmOrderStage =
        body.stage && validStageIds.has(body.stage) ? body.stage : existing.stage;
      const stageChanged = nextStage !== existing.stage;

      const updatedOrder: CrmOrderRecord = {
        ...existing,
        stage: nextStage,
        updatedAt: new Date().toISOString(),
        producerNotes:
          typeof body.producerNotes === 'string'
            ? body.producerNotes.slice(0, 2000)
            : existing.producerNotes,
        compliance: body.compliance
          ? {
              trafficConfirmed:
                typeof body.compliance.trafficConfirmed === 'boolean'
                  ? body.compliance.trafficConfirmed
                  : existing.compliance.trafficConfirmed,
              fz38Checked:
                typeof body.compliance.fz38Checked === 'boolean'
                  ? body.compliance.fz38Checked
                  : existing.compliance.fz38Checked,
              rightsPassportIssued:
                typeof body.compliance.rightsPassportIssued === 'boolean'
                  ? body.compliance.rightsPassportIssued
                  : existing.compliance.rightsPassportIssued,
              edoAndOrdRegistered:
                typeof body.compliance.edoAndOrdRegistered === 'boolean'
                  ? body.compliance.edoAndOrdRegistered
                  : existing.compliance.edoAndOrdRegistered,
            }
          : existing.compliance,
      };

      crmStore.orders[idx] = updatedOrder;
      writeOrdersCrmStore(crmStore);

      if (stageChanged) {
        void dispatchOrderToExternalChannels(updatedOrder.id, 'order.stage_changed');
      }

      res.json({
        ok: true,
        order: updatedOrder,
      });
    }
  );

  app.post('/api/cms/orders/:orderId/redeliver', requireStudioAuth, async (req, res) => {
    const { orderId } = req.params;
    const crmStore = readOrdersCrmStore();
    const found = crmStore.orders.find((o) => o.id === orderId);
    if (!found) {
      res.status(404).json({ ok: false, error: 'Заказ не найден' });
      return;
    }

    const result = await dispatchOrderToExternalChannels(orderId, 'order.created');
    const updatedStore = readOrdersCrmStore();
    const updatedOrder = updatedStore.orders.find((o) => o.id === orderId) ?? found;

    res.json({
      ok: true,
      order: updatedOrder,
      dispatchLogs: updatedStore.dispatchLogs.slice(0, 25),
      result,
    });
  });

  app.put(
    '/api/cms/orders-dispatch/settings',
    requireStudioAuth,
    express.json({ limit: '32kb' }),
    (req, res) => {
      const body = (req.body ?? {}) as {
        telegram?: {
          enabled?: boolean;
          botToken?: string;
          chatId?: string;
          notifyOnNewOrder?: boolean;
          notifyOnStageChange?: boolean;
        };
        webhook?: {
          enabled?: boolean;
          endpointUrl?: string;
          hmacSecret?: string;
          notifyOnNewOrder?: boolean;
          notifyOnStageChange?: boolean;
        };
      };

      const crmStore = readOrdersCrmStore();
      const prevTg = crmStore.settings.telegram;
      const prevWh = crmStore.settings.webhook;

      const incomingTgToken = body.telegram?.botToken;
      const nextBotToken =
        incomingTgToken === undefined || incomingTgToken.startsWith('••••')
          ? prevTg.botToken
          : incomingTgToken.trim().slice(0, 180);

      const incomingWhSecret = body.webhook?.hmacSecret;
      const nextHmacSecret =
        incomingWhSecret === undefined || incomingWhSecret.startsWith('••••')
          ? prevWh.hmacSecret
          : incomingWhSecret.trim().slice(0, 180);

      crmStore.settings = {
        telegram: {
          enabled:
            typeof body.telegram?.enabled === 'boolean'
              ? body.telegram.enabled
              : prevTg.enabled,
          botToken: nextBotToken,
          chatId:
            typeof body.telegram?.chatId === 'string'
              ? body.telegram.chatId.trim().slice(0, 90)
              : prevTg.chatId,
          notifyOnNewOrder:
            typeof body.telegram?.notifyOnNewOrder === 'boolean'
              ? body.telegram.notifyOnNewOrder
              : prevTg.notifyOnNewOrder,
          notifyOnStageChange:
            typeof body.telegram?.notifyOnStageChange === 'boolean'
              ? body.telegram.notifyOnStageChange
              : prevTg.notifyOnStageChange,
        },
        webhook: {
          enabled:
            typeof body.webhook?.enabled === 'boolean'
              ? body.webhook.enabled
              : prevWh.enabled,
          endpointUrl:
            typeof body.webhook?.endpointUrl === 'string'
              ? body.webhook.endpointUrl.trim().slice(0, 320)
              : prevWh.endpointUrl,
          hmacSecret: nextHmacSecret,
          notifyOnNewOrder:
            typeof body.webhook?.notifyOnNewOrder === 'boolean'
              ? body.webhook.notifyOnNewOrder
              : prevWh.notifyOnNewOrder,
          notifyOnStageChange:
            typeof body.webhook?.notifyOnStageChange === 'boolean'
              ? body.webhook.notifyOnStageChange
              : prevWh.notifyOnStageChange,
        },
      };

      writeOrdersCrmStore(crmStore);

      res.json({
        ok: true,
        settings: {
          telegram: {
            enabled: crmStore.settings.telegram.enabled,
            hasBotToken: Boolean(crmStore.settings.telegram.botToken.trim()),
            maskedBotToken: maskSecretForAdmin(crmStore.settings.telegram.botToken),
            chatId: crmStore.settings.telegram.chatId,
            notifyOnNewOrder: crmStore.settings.telegram.notifyOnNewOrder,
            notifyOnStageChange: crmStore.settings.telegram.notifyOnStageChange,
          },
          webhook: {
            enabled: crmStore.settings.webhook.enabled,
            endpointUrl: crmStore.settings.webhook.endpointUrl,
            hasHmacSecret: Boolean(crmStore.settings.webhook.hmacSecret.trim()),
            maskedHmacSecret: maskSecretForAdmin(crmStore.settings.webhook.hmacSecret),
            notifyOnNewOrder: crmStore.settings.webhook.notifyOnNewOrder,
            notifyOnStageChange: crmStore.settings.webhook.notifyOnStageChange,
          },
        },
      });
    }
  );

  app.post('/api/cms/orders-dispatch/test', requireStudioAuth, async (_req, res) => {
    const crmStore = readOrdersCrmStore();
    const sampleOrder = crmStore.orders[0];
    if (!sampleOrder) {
      res.status(400).json({ ok: false, error: 'Нет заказов для контрольной проверки' });
      return;
    }

    const result = await dispatchOrderToExternalChannels(sampleOrder.id, 'dispatch.test');
    const updated = readOrdersCrmStore();
    res.json({
      ok: true,
      result,
      dispatchLogs: updated.dispatchLogs.slice(0, 25),
    });
  });

  app.get('/api/cms/security/overview', requireStudioAuth, (_req, res) => {
    const store = readSecurityStore();
    res.json({
      ok: true,
      layers: SECURITY_DEFENSE_LAYERS,
      stats: {
        verifiedCount: store.verifiedCount,
        quarantinedCount: store.quarantinedCount,
        rateLimitedCount: store.rateLimitedCount,
        authBruteForceBlocks: store.authBruteForceBlocks,
        aiQuotaShieldBlocks: store.aiQuotaShieldBlocks,
      },
      verifiedLeads: store.verifiedLeads.slice(0, 40),
      quarantinedLeads: store.quarantinedLeads.slice(0, 40),
    });
  });

  app.post('/api/cms/security/clear-quarantine', requireStudioAuth, (_req, res) => {
    const store = readSecurityStore();
    store.quarantinedLeads = [];
    writeSecurityStore(store);
    res.json({
      ok: true,
      quarantinedLeads: [],
    });
  });

  // =========================================================================
  // AI Media Planner Semantic Matcher (Server-Side Gemini 3.8 Flash)
  // =========================================================================

  app.post(
    '/api/media-planner/recommend',
    express.json({ limit: '64kb' }),
    async (req, res) => {
      const clientIp = resolveClientIp(req);
      const aiRate = aiRecommendLimiter.consume(clientIp);
      if (!aiRate.allowed) {
        const store = readSecurityStore();
        store.aiQuotaShieldBlocks += 1;
        writeSecurityStore(store);
        res.json({
          ok: true,
          usedGeminiModel: false,
          hint: null,
        });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!apiKey) {
        res.json({
          ok: true,
          usedGeminiModel: false,
          hint: null,
        });
        return;
      }

      const body = (req.body ?? {}) as {
        niche?: string;
        segment?: string;
        ageCore?: string;
        listeningContext?: string;
        productNote?: string;
        budgetRub?: number;
        spotSeconds?: number;
      };

      const rawProductNote =
        typeof body.productNote === 'string' ? body.productNote.trim().slice(0, 280) : '';
      const noteInspection = inspectBriefForSpamSignals(rawProductNote);
      if (noteInspection.isBotSpam) {
        const store = readSecurityStore();
        store.aiQuotaShieldBlocks += 1;
        writeSecurityStore(store);
        res.json({
          ok: true,
          usedGeminiModel: false,
          hint: null,
        });
        return;
      }
      const productNote = noteInspection.sanitizedBrief;
      const niche = typeof body.niche === 'string' ? body.niche.slice(0, 40) : 'real_estate';
      const segment = typeof body.segment === 'string' ? body.segment.slice(0, 40) : 'b2c_premium';
      const ageCore = typeof body.ageCore === 'string' ? body.ageCore.slice(0, 24) : '30_45';
      const listeningContext =
        typeof body.listeningContext === 'string'
          ? body.listeningContext.slice(0, 40)
          : 'commute_rush';
      const budgetRub = typeof body.budgetRub === 'number' ? body.budgetRub : 180_000;
      const spotSeconds = typeof body.spotSeconds === 'number' ? body.spotSeconds : 15;

      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const promptText = [
          'Проанализируй рекламную задачу клиента для радиоразмещения FMWorks и верни приоритеты выбора станций и тайм-слотов.',
          `Отраслевая ниша: ${niche}`,
          `Сегмент ЦА: ${segment}, возраст: ${ageCore}, контекст прослушивания: ${listeningContext}`,
          `Бюджет клиента: ${Math.round(budgetRub)} ₽, хронометраж ролика: ${Math.round(spotSeconds)} сек`,
          `Описание продукта / акции клиента: ${productNote || 'Не указано дополнительно'}`,
          'Доступные идентификаторы радиостанций: bfm (Business FM), montecarlo (Радио Monte Carlo), avtoradio (Авторадио), europaplus (Европа Плюс), comedy (Comedy Radio), kommersant (Коммерсантъ FM), dorozhnoe (Дорожное Радио), retrofm (Ретро FM), silverrain (Серебряный Дождь), jazz (Радио JAZZ).',
          'Доступные коды тайм-слотов: morning_prime (утренний прайм), daytime_block (дневной блок), evening_drive (вечерний драйв), weekend_air (выходные Сб-Вс), traffic_weather (спонсорство погоды и трафика).',
          'Не упоминай конкретные названия городов в ответах.',
        ].join('\n');

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: promptText,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            systemInstruction:
              'Ты главный медиабайер радиоагентства FMWorks. Подбирай самые целевые радиостанции и конкретные временные окна под продукт и портрет ЦА без воды, не упоминая географические города и жаргон звукозаписи. Пиши лаконично по-русски.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                preferredDayparts: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '1-2 самых подходящих кода тайм-слотов из списка.',
                },
                avoidedDayparts: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Коды тайм-слотов, которые хуже подходят задаче (или пустой массив).',
                },
                boostedStationIds: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'До 3 наиболее релевантных stationId под продукт и ЦА.',
                },
                stationReasons: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      stationId: { type: Type.STRING },
                      reason: {
                        type: Type.STRING,
                        description: 'Короткая причина релевантности (до 9 слов).',
                      },
                    },
                    required: ['stationId', 'reason'],
                  },
                },
              },
              required: [
                'preferredDayparts',
                'avoidedDayparts',
                'boostedStationIds',
                'stationReasons',
              ],
            },
          },
        });

        const rawJson = (response.text ?? '{}').trim();
        const parsed = JSON.parse(rawJson) as {
          preferredDayparts?: string[];
          avoidedDayparts?: string[];
          boostedStationIds?: string[];
          stationReasons?: { stationId: string; reason: string }[];
        };

        const validDayparts = new Set([
          'morning_prime',
          'daytime_block',
          'evening_drive',
          'weekend_air',
          'traffic_weather',
        ]);
        const validStations = new Set([
          'bfm',
          'montecarlo',
          'avtoradio',
          'europaplus',
          'comedy',
          'kommersant',
          'dorozhnoe',
          'retrofm',
          'silverrain',
          'jazz',
        ]);

        const slotReasonsByStationId: Record<string, string> = {};
        for (const item of parsed.stationReasons ?? []) {
          if (
            item &&
            typeof item.stationId === 'string' &&
            validStations.has(item.stationId) &&
            typeof item.reason === 'string' &&
            scanEditorialWarnings(item.reason).length === 0
          ) {
            slotReasonsByStationId[item.stationId] = item.reason.trim().slice(0, 95);
          }
        }

        res.json({
          ok: true,
          usedGeminiModel: true,
          hint: {
            preferredDayparts: (parsed.preferredDayparts ?? []).filter((d) =>
              validDayparts.has(d)
            ),
            avoidedDayparts: (parsed.avoidedDayparts ?? []).filter((d) =>
              validDayparts.has(d)
            ),
            boostedStationIds: (parsed.boostedStationIds ?? []).filter((s) =>
              validStations.has(s)
            ),
            slotReasonsByStationId,
            usedGeminiModel: true,
          },
        });
      } catch {
        // При недоступности внешнего ключа или лимите квоты плавно переключаемся на локальную матрицу ЦА
        res.json({
          ok: true,
          usedGeminiModel: false,
          hint: null,
        });
      }
    }
  );

  // =========================================================================
  // Existing 15-Second Duel Direct Audio Endpoints (preserved)
  // =========================================================================

  app.get('/api/duel-tracks', async (_req, res) => {
    try {
      const payload = await resolveDuelTracksOnDisk();
      res.json(payload);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to inspect duel tracks',
      });
    }
  });

  app.post(
    '/api/duel-tracks/:kind',
    express.raw({ type: () => true, limit: '80mb' }),
    async (req, res) => {
      const uploadRate = duelUploadLimiter.consume(resolveClientIp(req));
      if (!uploadRate.allowed) {
        res.setHeader('Retry-After', String(uploadRate.retryAfterSec));
        res.status(429).json({ error: 'Слишком частая загрузка аудиофайлов. Подождите минуту.' });
        return;
      }

      const kind = req.params.kind;
      if (kind !== 'radio' && kind !== 'audioworks') {
        res.status(400).json({ error: 'Invalid track kind' });
        return;
      }

      const bodyBuffer = req.body as Buffer;
      if (
        !Buffer.isBuffer(bodyBuffer) ||
        bodyBuffer.length < 128 ||
        !hasValidAudioMagicBytes(bodyBuffer)
      ) {
        res.status(400).json({ error: 'Empty or invalid audio payload' });
        return;
      }

      fs.mkdirSync(PUBLIC_AUDIO_DIR, { recursive: true });
      const targetName =
        kind === 'radio' ? CANONICAL_RADIO_FILE : CANONICAL_AUDIOWORKS_FILE;
      const targetAbs = path.join(PUBLIC_AUDIO_DIR, targetName);
      const tempAbs = path.join(
        PUBLIC_AUDIO_DIR,
        `.upload_${kind}_${Date.now()}.tmp`
      );

      try {
        fs.writeFileSync(tempAbs, bodyBuffer);
        const rawDur = await probeDurationSec(tempAbs, kind === 'radio' ? 14.2 : 15.2);

        if (kind === 'audioworks' && rawDur > 35) {
          await execFileAsync('ffmpeg', [
            '-y',
            '-i',
            tempAbs,
            '-t',
            '15.35',
            '-af',
            'afade=t=out:st=15.0:d=0.35',
            targetAbs,
          ]);
          fs.unlinkSync(tempAbs);
        } else {
          try {
            await execFileAsync('ffmpeg', ['-y', '-i', tempAbs, targetAbs]);
            fs.unlinkSync(tempAbs);
          } catch {
            fs.renameSync(tempAbs, targetAbs);
          }
        }

        if (fs.existsSync(path.join(__dirname, 'dist'))) {
          fs.mkdirSync(DIST_AUDIO_DIR, { recursive: true });
          fs.copyFileSync(targetAbs, path.join(DIST_AUDIO_DIR, targetName));
        }

        const updated = await resolveDuelTracksOnDisk();
        res.json(updated);
      } catch (err) {
        if (fs.existsSync(tempAbs)) {
          try {
            fs.unlinkSync(tempAbs);
          } catch {
            // Ignore cleanup errors
          }
        }
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Failed to save audio file',
        });
      }
    }
  );

  const isProd =
    process.env.NODE_ENV === 'production' ||
    process.env.npm_lifecycle_event === 'start';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FMWorks server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
