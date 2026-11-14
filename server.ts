import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { AIRTIME_SALES_ENABLED } from './src/data/platformFeatures.ts';
import {
  buildRobotsTxt,
  buildSitemapXml,
  injectRouteSeoIntoHtml,
} from './src/data/seoServerTemplates.ts';
import {
  validateAndNormalizeCmsSnapshot,
  type StudioCmsSnapshot,
} from './src/data/studioCmsTypes.ts';
import {
  anonymizeCrmOrderPdnRecord,
  buildWebhookOrderEnvelope,
  createSeedCrmOrders,
  CRM_ORDER_STAGES,
  ensureCrmOrderSlaFields,
  formatEdoInvoiceSpecificationDocument,
  formatTelegramOrderDispatchMessage,
  SLA_BREACH_COMPENSATION_NOTE,
} from './src/data/orderCrmTypes.ts';
import type {
  CrmDispatchEvent,
  CrmOrderRecord,
  CrmOrderStage,
  DispatchAttemptLog,
  OrderComplianceChecklist,
  OrderDispatchSettings,
  OrderEntrySource,
  OrderMediaPlanSnapshot,
} from './src/data/orderCrmTypes.ts';
import {
  CALLBACK_PREFERENCE_OPTIONS,
  computeSlaDeadlineWindow,
  computeSmartHoldExpirationMs,
  DEFAULT_STUDIO_WORK_SCHEDULE,
  evaluateOrderSlaStatus,
  extendHoldByWorkingHoursMs,
  resolveStudioOperatingRegime,
  sanitizeWorkScheduleConfig,
} from './src/data/slaWorkCalendar.ts';
import type {
  ClientCallbackPreference,
  StudioWorkScheduleConfig,
} from './src/data/slaWorkCalendar.ts';
import {
  computeLeadPayloadFingerprint,
  evaluateLeadSubmissionSecurity,
  inspectBriefForSpamSignals,
  RateLimiter,
  resolveLeadFormRateScope,
  SECURITY_DEFENSE_LAYERS,
  verifyLeadChallengePow,
} from './src/security/leadShield.ts';
import {
  checkBannedForeignServiceUrl,
  containsDirectPersonalData,
  evaluateWebhookEndpointRfSafety,
} from './src/security/rfLegalCompliance.ts';
import { VERIFIED_LIVE_REGIONAL_STATIONS } from './src/data/broadcastAircheckData.ts';
import {
  createDefaultStudioLegalProfiles,
  sanitizeOrderDocumentMeta,
  sanitizeStudioLegalProfilesConfig,
} from './src/data/studioDocumentsCore.ts';
import type {
  OrderDocumentMeta,
  StudioLegalProfilesConfig,
} from './src/data/studioDocumentsCore.ts';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_AUDIO_DIR = path.join(__dirname, 'public', 'assets', 'aistudio');
const DIST_AUDIO_DIR = path.join(__dirname, 'dist', 'assets', 'aistudio');
const PUBLIC_CMS_MEDIA_DIR = path.join(__dirname, 'public', 'assets', 'cms');
const DIST_CMS_MEDIA_DIR = path.join(__dirname, 'dist', 'assets', 'cms');
function resolveWritableDataDir(): string {
  const localDir = path.join(__dirname, '.data');
  try {
    fs.mkdirSync(localDir, { recursive: true });
    fs.accessSync(localDir, fs.constants.W_OK);
    return localDir;
  } catch {
    const tmpFallback = path.join(os.tmpdir(), 'fmworks-studio-data');
    try {
      fs.mkdirSync(tmpFallback, { recursive: true });
    } catch {
      // Ignore if tmpdir creation fails
    }
    return tmpFallback;
  }
}

const CMS_DATA_DIR = resolveWritableDataDir();
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
      const normalized = validateAndNormalizeCmsSnapshot(parsed);
      const sanitized = normalized.ok ? normalized.data : parsed;
      if (rawText.includes('images.unsplash.com') && normalized.ok) {
        writePersistedCmsSnapshot(sanitized);
      } else {
        cachedCmsSnapshot = sanitized;
      }
      return sanitized;
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
  legalProfiles: StudioLegalProfilesConfig;
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
      maskPdnInExternalAlerts: true,
    },
    webhook: {
      enabled: Boolean(envWebhookUrl),
      endpointUrl: envWebhookUrl,
      hmacSecret: envWebhookSecret,
      notifyOnNewOrder: true,
      notifyOnStageChange: true,
    },
    workSchedule: sanitizeWorkScheduleConfig(DEFAULT_STUDIO_WORK_SCHEDULE),
  };
}

function readOrdersCrmStore(): PersistedOrdersCrmStore {
  if (cachedOrdersCrmStore) return cachedOrdersCrmStore;
  try {
    if (!fs.existsSync(ORDERS_CRM_FILE)) {
      const defaults = createDefaultDispatchSettings();
      cachedOrdersCrmStore = {
        orders: createSeedCrmOrders(),
        settings: defaults,
        dispatchLogs: [],
        legalProfiles: createDefaultStudioLegalProfiles(),
      };
      return cachedOrdersCrmStore;
    }
    const raw = JSON.parse(
      fs.readFileSync(ORDERS_CRM_FILE, 'utf8')
    ) as Partial<PersistedOrdersCrmStore>;
    const defaults = createDefaultDispatchSettings();
    const workSchedule = sanitizeWorkScheduleConfig(
      raw.settings?.workSchedule ?? defaults.workSchedule
    );
    const rawOrders =
      Array.isArray(raw.orders) && raw.orders.length > 0
        ? raw.orders
        : createSeedCrmOrders();
    cachedOrdersCrmStore = {
      orders: rawOrders.map((ord) => ensureCrmOrderSlaFields(ord, workSchedule)),
      settings: {
        telegram: {
          ...defaults.telegram,
          ...(raw.settings?.telegram ?? {}),
        },
        webhook: {
          ...defaults.webhook,
          ...(raw.settings?.webhook ?? {}),
        },
        workSchedule,
      },
      dispatchLogs: Array.isArray(raw.dispatchLogs) ? raw.dispatchLogs : [],
      legalProfiles: sanitizeStudioLegalProfilesConfig(raw.legalProfiles),
    };
    return cachedOrdersCrmStore;
  } catch {
    cachedOrdersCrmStore = {
      orders: createSeedCrmOrders(),
      settings: createDefaultDispatchSettings(),
      dispatchLogs: [],
      legalProfiles: createDefaultStudioLegalProfiles(),
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

function issueOrderRescueToken(orderNumber: string): string {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(`client-rescue-v1:${orderNumber}`)
    .digest('base64url')
    .slice(0, 28);
}

function verifyOrderRescueToken(
  orderNumber: string,
  providedToken: string | undefined | null
): boolean {
  if (!providedToken || typeof providedToken !== 'string') return false;
  const expected = issueOrderRescueToken(orderNumber);
  return safeCompareStrings(providedToken.trim(), expected);
}

async function dispatchOrderToExternalChannels(
  orderId: string,
  event: CrmDispatchEvent
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
  const isPriorityEscalation =
    event === 'order.sla_breached' || event === 'order.client_rescue';
  const shouldSendTg =
    event === 'dispatch.test' ||
    (telegram.enabled &&
      (isPriorityEscalation ||
        (event === 'order.created' && telegram.notifyOnNewOrder) ||
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
      const maskPdn = telegram.maskPdnInExternalAlerts !== false;
      const text = formatTelegramOrderDispatchMessage(targetOrder, event, {
        maskPdn,
      });
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
      (isPriorityEscalation ||
        (event === 'order.created' && webhook.notifyOnNewOrder) ||
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
  } else if (checkBannedForeignServiceUrl(webhook.endpointUrl).matched) {
    const blockedMatch = checkBannedForeignServiceUrl(webhook.endpointUrl);
    webhookResult = {
      state: 'failed',
      updatedAt: nowIso,
      httpStatus: null,
      detail: blockedMatch.reason ?? 'Домен приёмника запрещён политикой 152-ФЗ / РФ.',
    };
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

function runSlaEscalationSweep(nowMs = Date.now()): CrmOrderRecord[] {
  const crmStore = readOrdersCrmStore();
  const schedule = sanitizeWorkScheduleConfig(crmStore.settings.workSchedule);
  const escalatedIds: string[] = [];
  const nowIso = new Date(nowMs).toISOString();

  crmStore.orders = crmStore.orders.map((rawOrd) => {
    const ord = ensureCrmOrderSlaFields(rawOrd, schedule);
    if (
      ord.stage !== 'new_hold' ||
      ord.slaState?.firstContactedAt ||
      ord.slaState?.escalatedAt
    ) {
      return ord;
    }

    const evalRes = evaluateOrderSlaStatus(
      {
        stage: ord.stage,
        createdAtIso: ord.createdAt,
        callbackPreference: ord.callbackPreference,
        slaWindowStartIso: ord.slaState?.slaWindowStartAt,
        slaDeadlineIso: ord.slaState?.slaDeadlineAt,
        firstContactedAtIso: ord.slaState?.firstContactedAt,
        escalatedAtIso: ord.slaState?.escalatedAt,
      },
      nowMs,
      schedule
    );

    if (evalRes.state !== 'breached_late') {
      return ord;
    }

    escalatedIds.push(ord.id);
    const currentHoldExpMs = Date.parse(ord.holdExpiresAt);
    const safeHoldExpMs =
      !Number.isFinite(currentHoldExpMs) || currentHoldExpMs - nowMs < 2 * 3600_000
        ? extendHoldByWorkingHoursMs(currentHoldExpMs, nowMs, 2, schedule)
        : currentHoldExpMs;

    return {
      ...ord,
      updatedAt: nowIso,
      holdExpiresAt: new Date(safeHoldExpMs).toISOString(),
      slaState: {
        ...ord.slaState!,
        escalatedAt: nowIso,
        compensationNote:
          ord.slaState?.compensationNote ?? SLA_BREACH_COMPENSATION_NOTE,
      },
    };
  });

  if (escalatedIds.length > 0) {
    writeOrdersCrmStore(crmStore);
    for (const id of escalatedIds) {
      const slaLog: DispatchAttemptLog = {
        id: `log-sla-${nowMs}-${id.slice(-4)}`,
        timestamp: nowIso,
        orderNumber:
          crmStore.orders.find((o) => o.id === id)?.orderNumber ?? id,
        channel: 'telegram',
        event: 'order.sla_breached',
        state: 'ready_simulated',
        httpStatus: null,
        latencyMs: 1,
        summary:
          'Автоматический сторожевой таймер SLA: зафиксировано опоздание контакта, сделка эскалирована старшему продюсеру',
      };
      crmStore.dispatchLogs = [slaLog, ...crmStore.dispatchLogs].slice(0, 35);
      writeOrdersCrmStore(crmStore);
      void dispatchOrderToExternalChannels(id, 'order.sla_breached');
    }
  }

  return crmStore.orders;
}

const loginFailureLimiter = createSlidingWindowRateLimiter(8, 15 * 60 * 1000, 0);
const orderSubmitLimiter = createSlidingWindowRateLimiter(5, 10 * 60 * 1000, 1000);
const orderValidationBurstLimiter = createSlidingWindowRateLimiter(15, 5 * 60 * 1000, 0);
const clientRescueLimiter = createSlidingWindowRateLimiter(8, 10 * 60 * 1000, 500);
const aiRecommendLimiter = createSlidingWindowRateLimiter(15, 5 * 60 * 1000, 0);
const duelUploadLimiter = createSlidingWindowRateLimiter(12, 10 * 60 * 1000, 0);
const radioStreamLimiter = createSlidingWindowRateLimiter(40, 5 * 60 * 1000, 0);

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

  app.get('/api/public/work-schedule', (_req, res) => {
    const crmStore = readOrdersCrmStore();
    const workSchedule = sanitizeWorkScheduleConfig(crmStore.settings.workSchedule);
    res.json({
      ok: true,
      workSchedule,
      operatingRegime: resolveStudioOperatingRegime(Date.now(), workSchedule),
    });
  });

  app.get('/api/public/legal-profile', (_req, res) => {
    const crmStore = readOrdersCrmStore();
    res.json({
      ok: true,
      legalProfiles: sanitizeStudioLegalProfilesConfig(crmStore.legalProfiles),
    });
  });

  app.post('/api/orders/submit', express.json({ limit: '64kb' }), (req, res) => {
    const clientIp = resolveClientIp(req);
    const body = (req.body ?? {}) as {
      source?: OrderEntrySource;
      checkoutMode?: 'air_plus_production' | 'production_only';
      paymentChannel?: 'edo_invoice' | 'card_online';
      orderNumberCandidate?: string;
      formatLabel?: string;
      totalBudgetRub?: number;
      contactLine?: string;
      companyLine?: string;
      callbackPreference?: ClientCallbackPreference;
      briefText?: string;
      hasVoiceRecording?: boolean;
      voiceDurationSec?: number;
      hasAttachedFile?: boolean;
      attachedFileName?: string | null;
      mediaPlanSnapshot?: OrderMediaPlanSnapshot | null;
      isReturningFastTrack?: boolean;
      requireBriefOrVoice?: boolean;
      pdnConsentAccepted?: boolean;
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

    if (body.pdnConsentAccepted === false && !body.isReturningFastTrack) {
      res.status(400).json({
        ok: false,
        verdict: 'validation_error',
        conversionAllowed: false,
        consentError:
          'Для отправки заявки подтвердите согласие на обработку персональных данных (ст. 9 Федерального закона № 152-ФЗ).',
        rateLimit: {
          remainingAttempts: preRateCheck.remainingAttempts,
          maxAttempts: preRateCheck.maxAttempts,
          retryAfterSec: 0,
        },
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

    // Атомарная регистрация сделки в CRM-пульте продюсеров + умный расчёт 4ч рабочего холда и SLA
    const crmStore = readOrdersCrmStore();
    const workSchedule = sanitizeWorkScheduleConfig(crmStore.settings.workSchedule);
    const nowIso = new Date(now).toISOString();

    const validCallbackPrefs = new Set(CALLBACK_PREFERENCE_OPTIONS.map((o) => o.id));
    const resolvedCallbackPref: ClientCallbackPreference =
      body.callbackPreference && validCallbackPrefs.has(body.callbackPreference)
        ? body.callbackPreference
        : 'call_15m';

    const smartHoldExpiresMs = computeSmartHoldExpirationMs(now, workSchedule);
    const holdExpiresIso = new Date(smartHoldExpiresMs).toISOString();
    const regimeAtCreation = resolveStudioOperatingRegime(now, workSchedule);
    const slaWindow = computeSlaDeadlineWindow(now, resolvedCallbackPref, workSchedule);
    const slaWindowStartIso = new Date(slaWindow.slaWindowStartMs).toISOString();
    const slaDeadlineIso = new Date(slaWindow.slaDeadlineMs).toISOString();

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

    const resolvedPaymentChannel: 'edo_invoice' | 'card_online' =
      body.paymentChannel === 'card_online' ? 'card_online' : 'edo_invoice';

    const newCrmOrder: CrmOrderRecord = {
      id: `crm-${now}-${crypto.randomBytes(3).toString('hex')}`,
      orderNumber,
      createdAt: nowIso,
      updatedAt: nowIso,
      holdExpiresAt: holdExpiresIso,
      source: resolvedSource,
      checkoutMode,
      paymentChannel: resolvedPaymentChannel,
      stage: 'new_hold',
      formatLabel: newVerifiedRecord.formatLabel,
      totalBudgetRub: resolvedBudgetRub,
      contact: evaluation.normalizedContact,
      detectedChannel: evaluation.detectedChannel ?? 'phone',
      callbackPreference: resolvedCallbackPref,
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
      pdnConsentAcceptedAt: body.pdnConsentAccepted !== false ? nowIso : null,
      slaState: {
        createdRegime: regimeAtCreation.regime,
        slaWindowStartAt: slaWindowStartIso,
        slaDeadlineAt: slaDeadlineIso,
        promisedWindowLabel: slaWindow.promisedWindowLabel,
        firstContactedAt: null,
        escalatedAt: null,
        clientRescueCount: 0,
        compensationNote: null,
      },
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
    const rescueToken = issueOrderRescueToken(orderNumber);

    res.json({
      ok: true,
      verdict: 'verified_human',
      orderNumber,
      crmOrderId: newCrmOrder.id,
      conversionAllowed: true,
      verifiedConversionSeal,
      innVerified: evaluation.innVerified,
      detectedChannel: evaluation.detectedChannel,
      holdExpiresAt: holdExpiresIso,
      slaWindowStartAt: slaWindowStartIso,
      slaDeadlineAt: slaDeadlineIso,
      promisedWindowLabel: slaWindow.promisedWindowLabel,
      operatingRegime: regimeAtCreation,
      rescueToken,
      rateLimit: {
        remainingAttempts: rate.remainingAttempts,
        maxAttempts: rate.maxAttempts,
        retryAfterSec: 0,
      },
      nextChallenge: issueLeadChallenge(),
    });
  });

  // =========================================================================
  // Client Live SLA Tracker, Autonomous EDO Specification & Rescue Protocol
  // =========================================================================

  app.get('/api/orders/:orderNumber/status', (req, res) => {
    const orderNumber = String(req.params.orderNumber || '').trim();
    const token =
      typeof req.query.token === 'string' ? req.query.token.trim() : '';

    if (!orderNumber || !verifyOrderRescueToken(orderNumber, token)) {
      res.status(403).json({
        ok: false,
        error: 'Недействительный токен доступа к карточке статуса заказа',
      });
      return;
    }

    runSlaEscalationSweep();
    const crmStore = readOrdersCrmStore();
    const workSchedule = sanitizeWorkScheduleConfig(crmStore.settings.workSchedule);
    const found = crmStore.orders.find((o) => o.orderNumber === orderNumber);

    if (!found) {
      res.status(404).json({ ok: false, error: 'Заказ не найден в реестре' });
      return;
    }

    const slaEval = evaluateOrderSlaStatus(
      {
        stage: found.stage,
        createdAtIso: found.createdAt,
        callbackPreference: found.callbackPreference,
        slaWindowStartIso: found.slaState?.slaWindowStartAt,
        slaDeadlineIso: found.slaState?.slaDeadlineAt,
        firstContactedAtIso: found.slaState?.firstContactedAt,
        escalatedAtIso: found.slaState?.escalatedAt,
      },
      Date.now(),
      workSchedule
    );

    res.json({
      ok: true,
      orderNumber: found.orderNumber,
      stage: found.stage,
      holdExpiresAt: found.holdExpiresAt,
      callbackPreference: found.callbackPreference ?? 'call_15m',
      slaState: found.slaState ?? null,
      slaEvaluation: slaEval,
      operatingRegime: resolveStudioOperatingRegime(Date.now(), workSchedule),
      edoSpecificationText: formatEdoInvoiceSpecificationDocument(found),
      documentMeta: found.documentMeta ?? null,
      legalProfiles: sanitizeStudioLegalProfilesConfig(crmStore.legalProfiles),
    });
  });

  app.post(
    '/api/orders/:orderNumber/rescue',
    express.json({ limit: '32kb' }),
    (req, res) => {
      const clientIp = resolveClientIp(req);
      const orderNumber = String(req.params.orderNumber || '').trim();
      const body = (req.body ?? {}) as {
        rescueToken?: string;
        action?:
          | 'extend_hold_and_escalate'
          | 'switch_to_async'
          | 'reschedule_callback';
        callbackPreference?: ClientCallbackPreference;
      };

      if (!orderNumber || !verifyOrderRescueToken(orderNumber, body.rescueToken)) {
        res.status(403).json({
          ok: false,
          error: 'Недействительный ключ подтверждения брони',
        });
        return;
      }

      const rescueRate = clientRescueLimiter.consume(`${clientIp}:${orderNumber}`);
      if (!rescueRate.allowed) {
        res.status(429).json({
          ok: false,
          error: `Слишком частые запросы обновления. Подождите ${rescueRate.retryAfterSec} сек.`,
        });
        return;
      }

      const crmStore = readOrdersCrmStore();
      const workSchedule = sanitizeWorkScheduleConfig(crmStore.settings.workSchedule);
      const idx = crmStore.orders.findIndex((o) => o.orderNumber === orderNumber);

      if (idx === -1) {
        res.status(404).json({ ok: false, error: 'Заказ не найден в реестре CRM' });
        return;
      }

      const existing = ensureCrmOrderSlaFields(crmStore.orders[idx], workSchedule);
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      const action = body.action ?? 'extend_hold_and_escalate';

      let nextHoldExpiresAt = existing.holdExpiresAt;
      let nextCallbackPref: ClientCallbackPreference =
        existing.callbackPreference ?? 'call_15m';
      let nextSlaState = { ...existing.slaState! };
      let noteAppend = '';

      if (action === 'extend_hold_and_escalate') {
        const currentExpMs = Date.parse(existing.holdExpiresAt);
        const extendedMs = extendHoldByWorkingHoursMs(
          currentExpMs,
          nowMs,
          4,
          workSchedule
        );
        nextHoldExpiresAt = new Date(extendedMs).toISOString();
        nextSlaState = {
          ...nextSlaState,
          escalatedAt: nextSlaState.escalatedAt ?? nowIso,
          clientRescueCount: (nextSlaState.clientRescueCount ?? 0) + 1,
          compensationNote:
            nextSlaState.compensationNote ?? SLA_BREACH_COMPENSATION_NOTE,
        };
        noteAppend = `[Клиент активировал защиту SLA: холд продлён +4 рабочих часа, запрос передан старшему продюсеру]`;
      } else if (action === 'switch_to_async') {
        nextCallbackPref = 'async_no_call';
        const recomputed = computeSlaDeadlineWindow(nowMs, 'async_no_call', workSchedule);
        nextSlaState = {
          ...nextSlaState,
          slaWindowStartAt: new Date(recomputed.slaWindowStartMs).toISOString(),
          slaDeadlineAt: new Date(recomputed.slaDeadlineMs).toISOString(),
          promisedWindowLabel: recomputed.promisedWindowLabel,
          clientRescueCount: (nextSlaState.clientRescueCount ?? 0) + 1,
        };
        noteAppend = `[Клиент выбрал режим без звонка: отправить расписание и счёт письменно]`;
      } else if (action === 'reschedule_callback') {
        const validPrefs = new Set(CALLBACK_PREFERENCE_OPTIONS.map((p) => p.id));
        nextCallbackPref =
          body.callbackPreference && validPrefs.has(body.callbackPreference)
            ? body.callbackPreference
            : 'morning_0930';
        const recomputed = computeSlaDeadlineWindow(nowMs, nextCallbackPref, workSchedule);
        const ensuredHoldMs = Math.max(
          Date.parse(existing.holdExpiresAt) || nowMs,
          recomputed.slaDeadlineMs + 2 * 3600_000
        );
        nextHoldExpiresAt = new Date(ensuredHoldMs).toISOString();
        nextSlaState = {
          ...nextSlaState,
          slaWindowStartAt: new Date(recomputed.slaWindowStartMs).toISOString(),
          slaDeadlineAt: new Date(recomputed.slaDeadlineMs).toISOString(),
          promisedWindowLabel: recomputed.promisedWindowLabel,
        };
        noteAppend = `[Клиент перенёс удобное окно связи: ${recomputed.promisedWindowLabel}]`;
      }

      const updatedOrder: CrmOrderRecord = {
        ...existing,
        updatedAt: nowIso,
        holdExpiresAt: nextHoldExpiresAt,
        callbackPreference: nextCallbackPref,
        slaState: nextSlaState,
        producerNotes: existing.producerNotes
          ? `${existing.producerNotes}\n${noteAppend}`.slice(0, 2000)
          : noteAppend,
      };

      crmStore.orders[idx] = updatedOrder;
      const rescueLog: DispatchAttemptLog = {
        id: `log-rescue-${nowMs}`,
        timestamp: nowIso,
        orderNumber: updatedOrder.orderNumber,
        channel: 'telegram',
        event: 'order.client_rescue',
        state: 'ready_simulated',
        httpStatus: null,
        latencyMs: 1,
        summary: noteAppend,
      };
      crmStore.dispatchLogs = [rescueLog, ...crmStore.dispatchLogs].slice(0, 35);
      writeOrdersCrmStore(crmStore);

      void dispatchOrderToExternalChannels(updatedOrder.id, 'order.client_rescue');

      const slaEval = evaluateOrderSlaStatus(
        {
          stage: updatedOrder.stage,
          createdAtIso: updatedOrder.createdAt,
          callbackPreference: updatedOrder.callbackPreference,
          slaWindowStartIso: updatedOrder.slaState?.slaWindowStartAt,
          slaDeadlineIso: updatedOrder.slaState?.slaDeadlineAt,
          firstContactedAtIso: updatedOrder.slaState?.firstContactedAt,
          escalatedAtIso: updatedOrder.slaState?.escalatedAt,
        },
        nowMs,
        workSchedule
      );

      res.json({
        ok: true,
        orderNumber: updatedOrder.orderNumber,
        holdExpiresAt: updatedOrder.holdExpiresAt,
        callbackPreference: updatedOrder.callbackPreference,
        slaState: updatedOrder.slaState,
        slaEvaluation: slaEval,
        edoSpecificationText: formatEdoInvoiceSpecificationDocument(updatedOrder),
      });
    }
  );

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
    runSlaEscalationSweep();
    const crmStore = readOrdersCrmStore();
    const { telegram, webhook } = crmStore.settings;
    const workSchedule = sanitizeWorkScheduleConfig(crmStore.settings.workSchedule);

    res.json({
      ok: true,
      orders: crmStore.orders,
      dispatchLogs: crmStore.dispatchLogs.slice(0, 25),
      operatingRegime: resolveStudioOperatingRegime(Date.now(), workSchedule),
      legalProfiles: sanitizeStudioLegalProfilesConfig(crmStore.legalProfiles),
      settings: {
        telegram: {
          enabled: telegram.enabled,
          hasBotToken: Boolean(telegram.botToken.trim()),
          maskedBotToken: maskSecretForAdmin(telegram.botToken),
          chatId: telegram.chatId,
          notifyOnNewOrder: telegram.notifyOnNewOrder,
          notifyOnStageChange: telegram.notifyOnStageChange,
          maskPdnInExternalAlerts: telegram.maskPdnInExternalAlerts !== false,
        },
        webhook: {
          enabled: webhook.enabled,
          endpointUrl: webhook.endpointUrl,
          hasHmacSecret: Boolean(webhook.hmacSecret.trim()),
          maskedHmacSecret: maskSecretForAdmin(webhook.hmacSecret),
          notifyOnNewOrder: webhook.notifyOnNewOrder,
          notifyOnStageChange: webhook.notifyOnStageChange,
        },
        workSchedule,
      },
    });
  });

  app.put(
    '/api/cms/legal-profiles',
    requireStudioAuth,
    express.json({ limit: '64kb' }),
    (req, res) => {
      const incoming = (req.body ?? {}) as Partial<StudioLegalProfilesConfig>;
      const sanitized = sanitizeStudioLegalProfilesConfig(incoming);
      const serializedLower = JSON.stringify(sanitized).toLowerCase();
      const hitBanned = SERVER_BANNED_TERMS.find((term) =>
        serializedLower.includes(term)
      );
      if (hitBanned) {
        res.status(400).json({
          ok: false,
          error: `Реквизиты содержат стоп-фрагмент редакционной политики («${hitBanned}»). Укажите нейтральные региональные данные (например, г. Тверь).`,
        });
        return;
      }

      const crmStore = readOrdersCrmStore();
      crmStore.legalProfiles = sanitized;
      writeOrdersCrmStore(crmStore);

      res.json({
        ok: true,
        legalProfiles: crmStore.legalProfiles,
      });
    }
  );

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
        documentMeta?: Partial<OrderDocumentMeta>;
        totalBudgetRub?: number;
        markContacted?: boolean;
        extendHoldHours?: number;
        callbackPreference?: ClientCallbackPreference;
      };

      const crmStore = readOrdersCrmStore();
      const workSchedule = sanitizeWorkScheduleConfig(crmStore.settings.workSchedule);
      const idx = crmStore.orders.findIndex((o) => o.id === orderId);
      if (idx === -1) {
        res.status(404).json({ ok: false, error: 'Заказ не найден в реестре CRM' });
        return;
      }

      const existing = ensureCrmOrderSlaFields(crmStore.orders[idx], workSchedule);
      const validStageIds = new Set(CRM_ORDER_STAGES.map((s) => s.id));
      const nextStage: CrmOrderStage =
        body.stage && validStageIds.has(body.stage) ? body.stage : existing.stage;
      const stageChanged = nextStage !== existing.stage;
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();

      let nextHoldExpiresAt = existing.holdExpiresAt;
      if (
        typeof body.extendHoldHours === 'number' &&
        Number.isFinite(body.extendHoldHours) &&
        body.extendHoldHours > 0
      ) {
        const clampedHours = Math.min(24, Math.max(1, Math.round(body.extendHoldHours)));
        const extendedMs = extendHoldByWorkingHoursMs(
          Date.parse(existing.holdExpiresAt),
          nowMs,
          clampedHours,
          workSchedule
        );
        nextHoldExpiresAt = new Date(extendedMs).toISOString();
      }

      const validPrefs = new Set(CALLBACK_PREFERENCE_OPTIONS.map((p) => p.id));
      const nextCallbackPref: ClientCallbackPreference =
        body.callbackPreference && validPrefs.has(body.callbackPreference)
          ? body.callbackPreference
          : existing.callbackPreference ?? 'call_15m';

      const shouldCloseSlaContact =
        body.markContacted === true ||
        (stageChanged && nextStage !== 'new_hold');

      const nextSlaState = {
        ...existing.slaState!,
        firstContactedAt:
          existing.slaState?.firstContactedAt ??
          (shouldCloseSlaContact ? nowIso : null),
      };

      const nextDocumentMeta: OrderDocumentMeta | undefined = body.documentMeta
        ? sanitizeOrderDocumentMeta({
            ...(existing.documentMeta ?? {}),
            ...body.documentMeta,
          })
        : existing.documentMeta;

      const nextTotalBudgetRub =
        typeof body.totalBudgetRub === 'number' &&
        Number.isFinite(body.totalBudgetRub) &&
        body.totalBudgetRub >= 0
          ? Math.round(body.totalBudgetRub)
          : typeof nextDocumentMeta?.customPriceRub === 'number' &&
              nextDocumentMeta.customPriceRub > 0
            ? nextDocumentMeta.customPriceRub
            : existing.totalBudgetRub;

      const updatedOrder: CrmOrderRecord = {
        ...existing,
        stage: nextStage,
        updatedAt: nowIso,
        holdExpiresAt: nextHoldExpiresAt,
        callbackPreference: nextCallbackPref,
        slaState: nextSlaState,
        totalBudgetRub: nextTotalBudgetRub,
        documentMeta: nextDocumentMeta,
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

  app.post('/api/cms/orders/:orderId/anonymize-pdn', requireStudioAuth, (req, res) => {
    const { orderId } = req.params;
    const crmStore = readOrdersCrmStore();
    const idx = crmStore.orders.findIndex((o) => o.id === orderId);
    if (idx === -1) {
      res.status(404).json({ ok: false, error: 'Заказ не найден в реестре CRM' });
      return;
    }

    const nowIso = new Date().toISOString();
    const anonymized = anonymizeCrmOrderPdnRecord(crmStore.orders[idx], nowIso);
    crmStore.orders[idx] = anonymized;
    writeOrdersCrmStore(crmStore);

    // Синхронное обезличивание ПДн в журнале заявок безопасности (ч. 5 ст. 21 152-ФЗ)
    const secStore = readSecurityStore();
    let touchedSec = false;
    secStore.verifiedLeads = secStore.verifiedLeads.map((lead) => {
      if (lead.orderNumber !== anonymized.orderNumber) return lead;
      touchedSec = true;
      return {
        ...lead,
        contact: '[ПДН УДАЛЕНЫ ПО 152-ФЗ]',
        companyOrInn: '[ОБЕЗЛИЧЕНО ПО 152-ФЗ]',
        innVerified: false,
        briefExcerpt: `ПДн обезличены по ст. 21 152-ФЗ (${nowIso.slice(0, 10)})`,
      };
    });
    if (touchedSec) {
      writeSecurityStore(secStore);
    }

    res.json({
      ok: true,
      order: anonymized,
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
          maskPdnInExternalAlerts?: boolean;
        };
        webhook?: {
          enabled?: boolean;
          endpointUrl?: string;
          hmacSecret?: string;
          notifyOnNewOrder?: boolean;
          notifyOnStageChange?: boolean;
        };
        workSchedule?: Partial<StudioWorkScheduleConfig>;
      };

      const incomingWebhookUrl =
        typeof body.webhook?.endpointUrl === 'string'
          ? body.webhook.endpointUrl.trim().slice(0, 320)
          : '';
      if (incomingWebhookUrl) {
        const whSafety = evaluateWebhookEndpointRfSafety(incomingWebhookUrl);
        if (whSafety.isBannedForeignService) {
          res.status(400).json({
            ok: false,
            error:
              whSafety.warning ??
              'Указанный домен приёмника Webhook запрещён политикой 152-ФЗ / РФ.',
          });
          return;
        }
      }

      const crmStore = readOrdersCrmStore();
      const prevTg = crmStore.settings.telegram;
      const prevWh = crmStore.settings.webhook;
      const prevSchedule = sanitizeWorkScheduleConfig(crmStore.settings.workSchedule);

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

      const nextWorkSchedule = body.workSchedule
        ? sanitizeWorkScheduleConfig({
            ...prevSchedule,
            ...body.workSchedule,
          })
        : prevSchedule;

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
          maskPdnInExternalAlerts:
            typeof body.telegram?.maskPdnInExternalAlerts === 'boolean'
              ? body.telegram.maskPdnInExternalAlerts
              : prevTg.maskPdnInExternalAlerts !== false,
        },
        webhook: {
          enabled:
            typeof body.webhook?.enabled === 'boolean'
              ? body.webhook.enabled
              : prevWh.enabled,
          endpointUrl:
            typeof body.webhook?.endpointUrl === 'string'
              ? incomingWebhookUrl
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
        workSchedule: nextWorkSchedule,
      };

      writeOrdersCrmStore(crmStore);

      res.json({
        ok: true,
        operatingRegime: resolveStudioOperatingRegime(Date.now(), nextWorkSchedule),
        settings: {
          telegram: {
            enabled: crmStore.settings.telegram.enabled,
            hasBotToken: Boolean(crmStore.settings.telegram.botToken.trim()),
            maskedBotToken: maskSecretForAdmin(crmStore.settings.telegram.botToken),
            chatId: crmStore.settings.telegram.chatId,
            notifyOnNewOrder: crmStore.settings.telegram.notifyOnNewOrder,
            notifyOnStageChange: crmStore.settings.telegram.notifyOnStageChange,
            maskPdnInExternalAlerts:
              crmStore.settings.telegram.maskPdnInExternalAlerts !== false,
          },
          webhook: {
            enabled: crmStore.settings.webhook.enabled,
            endpointUrl: crmStore.settings.webhook.endpointUrl,
            hasHmacSecret: Boolean(crmStore.settings.webhook.hmacSecret.trim()),
            maskedHmacSecret: maskSecretForAdmin(crmStore.settings.webhook.hmacSecret),
            notifyOnNewOrder: crmStore.settings.webhook.notifyOnNewOrder,
            notifyOnStageChange: crmStore.settings.webhook.notifyOnStageChange,
          },
          workSchedule: nextWorkSchedule,
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

      const allowForeignGeminiApi =
        AIRTIME_SALES_ENABLED && process.env.ALLOW_FOREIGN_GEMINI_API === 'true';
      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!allowForeignGeminiApi || !apiKey) {
        res.json({
          ok: true,
          usedGeminiModel: false,
          complianceMode: 'rf_local_deterministic',
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
      if (containsDirectPersonalData(rawProductNote)) {
        res.json({
          ok: true,
          usedGeminiModel: false,
          complianceMode: 'rf_pdn_shield_blocked',
          hint: null,
        });
        return;
      }
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
  // Live Regional FM Broadcast Proxy & Curated Station Directory
  // =========================================================================

  app.get('/api/radio/stations', (_req, res) => {
    res.json({
      ok: true,
      stations: VERIFIED_LIVE_REGIONAL_STATIONS.map((st) => ({
        id: st.id,
        title: st.title,
        frequencyBadge: st.frequencyBadge,
        formatSummary: st.formatSummary,
        liveProxyUrl: `/api/radio/live-stream?station=${encodeURIComponent(st.id)}`,
        fallbackAircheckUrl: st.fallbackAircheckUrl,
      })),
    });
  });

  app.get('/api/radio/live-stream', async (req, res) => {
    const rate = radioStreamLimiter.consume(resolveClientIp(req));
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSec));
      res.status(429).json({ error: 'Слишком частые подключения к эфиру. Подождите немного.' });
      return;
    }

    const requestedId =
      typeof req.query.station === 'string' ? req.query.station.trim() : 'kp_reg_91';
    const station =
      VERIFIED_LIVE_REGIONAL_STATIONS.find((s) => s.id === requestedId) ??
      VERIFIED_LIVE_REGIONAL_STATIONS[0];

    const serveFallbackAircheck = () => {
      if (res.headersSent) return;
      const relPath = station.fallbackAircheckUrl.replace(/^\//, '');
      const absPublic = path.join(__dirname, 'public', relPath);
      const absDist = path.join(__dirname, 'dist', relPath);
      const targetFile = fs.existsSync(absPublic)
        ? absPublic
        : fs.existsSync(absDist)
          ? absDist
          : null;
      if (targetFile) {
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-FMWorks-Radio-Mode', 'fallback-aircheck');
        fs.createReadStream(targetFile).pipe(res);
      } else {
        res.status(502).end();
      }
    };

    const ac = new AbortController();
    const connectTimeout = setTimeout(() => ac.abort(), 5500);
    const maxSessionTimer = setTimeout(() => ac.abort(), 45_000);

    const cleanup = () => {
      clearTimeout(connectTimeout);
      clearTimeout(maxSessionTimer);
      ac.abort();
    };
    req.on('close', cleanup);

    try {
      const upstream = await fetch(station.streamUrl, {
        headers: {
          'User-Agent': 'FMWorksBroadcastBench/1.0',
          Accept: 'audio/mpeg, audio/*;q=0.9, */*;q=0.5',
        },
        signal: ac.signal,
      });
      clearTimeout(connectTimeout);

      if (!upstream.ok || !upstream.body) {
        cleanup();
        serveFallbackAircheck();
        return;
      }

      const contentType = upstream.headers.get('content-type') || 'audio/mpeg';
      res.status(200);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-store, no-transform');
      res.setHeader('X-FMWorks-Radio-Mode', 'live-regional-stream');

      const reader = upstream.body.getReader();
      while (!ac.signal.aborted) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        if (res.writableEnded || res.destroyed) break;
        const canContinue = res.write(Buffer.from(value));
        if (!canContinue) {
          await new Promise<void>((resolve) => res.once('drain', resolve));
        }
      }
      if (!res.writableEnded) {
        res.end();
      }
    } catch {
      if (!res.headersSent) {
        serveFallbackAircheck();
      } else if (!res.writableEnded) {
        res.end();
      }
    } finally {
      cleanup();
    }
  });

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

  const srcAssetsImagesPath = path.join(__dirname, 'src', 'assets', 'images');
  if (fs.existsSync(srcAssetsImagesPath)) {
    app.use(
      '/src/assets/images',
      express.static(srcAssetsImagesPath, { maxAge: '7d', fallthrough: false })
    );
  }

  const publicAssetsRoot = path.join(__dirname, 'public', 'assets');
  if (fs.existsSync(publicAssetsRoot)) {
    app.use('/assets', express.static(publicAssetsRoot, { maxAge: '1d' }));
  }

  const resolveRequestPublicOrigin = (req: Request): string => {
    const rawProto = req.headers['x-forwarded-proto'];
    const proto =
      typeof rawProto === 'string' && rawProto.trim()
        ? rawProto.split(',')[0].trim()
        : req.protocol || 'https';
    const rawHost = req.headers['x-forwarded-host'] || req.headers.host;
    const host =
      typeof rawHost === 'string' && rawHost.trim()
        ? rawHost.split(',')[0].trim()
        : '';
    return host ? `${proto}://${host}` : 'https://fmworks.ru';
  };

  const sendCompressibleText = (
    req: Request,
    res: Response,
    contentType: string,
    payload: string,
    cacheControl?: string
  ) => {
    res.setHeader('Content-Type', contentType);
    if (cacheControl) {
      res.setHeader('Cache-Control', cacheControl);
    }
    res.setHeader('Vary', 'Accept-Encoding');
    const acceptEncoding = String(req.headers['accept-encoding'] || '');
    if (
      Buffer.byteLength(payload, 'utf8') > 1024 &&
      acceptEncoding.includes('gzip')
    ) {
      res.setHeader('Content-Encoding', 'gzip');
      res.send(zlib.gzipSync(payload));
      return;
    }
    res.send(payload);
  };

  app.get('/robots.txt', (req, res) => {
    sendCompressibleText(
      req,
      res,
      'text/plain; charset=utf-8',
      buildRobotsTxt(resolveRequestPublicOrigin(req)),
      'public, max-age=3600'
    );
  });

  app.get('/sitemap.xml', (req, res) => {
    const cms = readPersistedCmsSnapshot();
    const caseSlugs = cms?.portfolioCases
      ?.filter((c) => c.published !== false)
      .map((c) => c.id);
    sendCompressibleText(
      req,
      res,
      'application/xml; charset=utf-8',
      buildSitemapXml(resolveRequestPublicOrigin(req), {
        airtimeEnabled: AIRTIME_SALES_ENABLED,
        caseSlugs,
      }),
      'public, max-age=3600'
    );
  });

  const isProd =
    process.env.NODE_ENV === 'production' ||
    process.env.npm_lifecycle_event === 'start' ||
    Boolean(process.env.K_SERVICE);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.get('*', async (req, res, next) => {
      const accept = String(req.headers.accept || '');
      if (
        !accept.includes('text/html') ||
        req.path.startsWith('/api/') ||
        req.path.startsWith('/assets/') ||
        req.path.startsWith('/src/') ||
        req.path.startsWith('/@') ||
        path.extname(req.path) !== ''
      ) {
        next();
        return;
      }

      try {
        const templatePath = path.join(__dirname, 'index.html');
        const rawTemplate = fs.readFileSync(templatePath, 'utf8');
        const transformed = await vite.transformIndexHtml(
          req.originalUrl,
          rawTemplate
        );
        const searchIdx = req.originalUrl.indexOf('?');
        const search = searchIdx >= 0 ? req.originalUrl.slice(searchIdx) : '';
        const seoHtml = injectRouteSeoIntoHtml(
          transformed,
          req.path,
          resolveRequestPublicOrigin(req),
          {
            search,
            airtimeEnabled: AIRTIME_SALES_ENABLED,
          }
        );
        sendCompressibleText(
          req,
          res,
          'text/html; charset=utf-8',
          seoHtml,
          'no-cache'
        );
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        next(err);
      }
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    const distAssetsPath = path.join(distPath, 'assets');
    if (fs.existsSync(distAssetsPath)) {
      app.use(
        '/assets',
        express.static(distAssetsPath, { maxAge: '365d', immutable: true })
      );
    }
    app.use(express.static(distPath, { index: false, maxAge: '1h' }));
    let cachedProdHtml: string | null = null;
    app.get('*', (req, res) => {
      if (!cachedProdHtml) {
        cachedProdHtml = fs.readFileSync(
          path.join(distPath, 'index.html'),
          'utf8'
        );
      }
      const searchIdx = req.originalUrl.indexOf('?');
      const search = searchIdx >= 0 ? req.originalUrl.slice(searchIdx) : '';
      const seoHtml = injectRouteSeoIntoHtml(
        cachedProdHtml,
        req.path,
        resolveRequestPublicOrigin(req),
        {
          search,
          airtimeEnabled: AIRTIME_SALES_ENABLED,
        }
      );
      sendCompressibleText(
        req,
        res,
        'text/html; charset=utf-8',
        seoHtml,
        'no-cache'
      );
    });
  }

  // Фоновый сторожевой таймер SLA (проверка опозданий звонка каждые 30 секунд)
  const slaSweepInterval = setInterval(() => {
    try {
      runSlaEscalationSweep();
    } catch {
      // Не прерываем цикл сервера при фоновой сверке SLA
    }
  }, 30_000);
  if (typeof slaSweepInterval.unref === 'function') {
    slaSweepInterval.unref();
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FMWorks server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start FMWorks server:', err);
  process.exit(1);
});

