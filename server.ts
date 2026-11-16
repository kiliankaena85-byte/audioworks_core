import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { AIRTIME_SALES_ENABLED } from './src/data/platformFeatures.ts';
import {
  parsePlatformRoute,
  resolveRouteSeoMeta,
} from './src/data/platformRouter.ts';
import {
  buildLlmsTxt,
  buildRobotsTxt,
  buildSitemapXml,
  injectRouteSeoIntoHtml,
  resolveServerRouteHttpStatus,
  resolveServerRouteLookup,
} from './src/data/seoServerTemplates.ts';
import { requestGeminiMediaAdvisorHint } from './src/server/geminiMediaAdvisor.ts';
import {
  renderOgPngForRoute,
  renderOgSvgForRoute,
} from './src/server/ogImageRenderer.ts';
import {
  evictExcessSseClients,
  MAX_CHALLENGE_NONCE_ENTRIES,
  MAX_CONCURRENT_CABINET_SSE_CLIENTS,
  MAX_RECENT_FINGERPRINT_ENTRIES,
  pruneExpiredTtlEntries,
  setBoundedTtlEntry,
} from './src/server/runtimeMemoryGuard.ts';
import { convertRasterFileToWebp } from './scripts/generate-webp.mjs';
import { buildTurboPagesXml } from './src/data/turboFeed.ts';
import {
  validateWebVitalsBeaconPayload,
  type WebVitalReportPayload,
} from './src/utils/performance.ts';
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
  ensureOrderStageHistory,
  formatEdoInvoiceSpecificationDocument,
  formatTelegramOrderDispatchMessage,
  getCrmStageMetaForOrder,
  recordOrderStageTransition,
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
  extractChatFromTelegramUpdates,
  parseTelegramBotApiError,
  resolveEffectiveTelegramSettings,
} from './src/data/telegramOrderNotifications.ts';
import type {
  DiscoveredTelegramChat,
  OrderStatusChangeContext,
} from './src/data/telegramOrderNotifications.ts';
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
import {
  appendSecurityAuditEvent,
  buildContentSecurityPolicy,
  buildSessionClearCookieHeader,
  buildSessionSetCookieHeader,
  createSessionRevocationRegistry,
  detectVerifiedImageType,
  hasValidAudioMagicBytes as verifyAudioMagicBytes,
  isCrossOriginBrowserRequest,
  isPrivateOrReservedIp,
  parseCookieHeader,
  resolveSafePublicOrigin,
  resolveTrustedClientIp,
  type SecurityAuditEvent,
  type SecurityAuditEventKind,
  STUDIO_SESSION_COOKIE_NAME,
  validateOutboundWebhookTarget,
} from './src/security/serverSecurity.ts';
import {
  createStudioSessionActivityTracker,
  DEFAULT_STUDIO_OPERATOR_NAME,
  sanitizeStudioOperatorName,
  STUDIO_SESSION_ABSOLUTE_TTL_MS,
  STUDIO_SESSION_IDLE_TIMEOUT_MS,
} from './src/security/adminSessionStandards.ts';
import { VERIFIED_LIVE_REGIONAL_STATIONS } from './src/data/broadcastAircheckData.ts';
import {
  assembleProductionDocumentSuite,
  createDefaultStudioLegalProfiles,
  formatProductionSuitePlainSummary,
  sanitizeOrderDocumentMeta,
  sanitizeStudioLegalProfilesConfig,
} from './src/data/studioDocumentsCore.ts';
import type {
  OrderDocumentMeta,
  StudioLegalProfilesConfig,
} from './src/data/studioDocumentsCore.ts';
import {
  formatStructuredCompanyLine,
  inspectInnDigits,
  parseCompanyNameAndInn,
} from './src/components/order/companyDetailsHelpers.ts';
import {
  buildDiadocDraftPostMessagePayload,
  counterpartyToDocumentMetaPatch,
  DEFAULT_DIADOC_API_URL,
  parseDadataPartyResponse,
  parseDiadocGetOrganizationsResponse,
  parseKonturFocusReqResponse,
  resolveOfflineCounterpartyByInn,
} from './src/data/konturIntegrationCore.ts';
import type {
  CounterpartyLookupResult,
  KonturIntegrationStatus,
} from './src/data/konturIntegrationCore.ts';
import {
  matchesOrderLookupVerifier,
  normalizeDeliveryPreferences,
  sanitizeCloudDiskUrl,
  sanitizeDeliveryDetail,
} from './src/data/clientCabinetHelpers.ts';
import type {
  ClientCabinetOrderSummary,
  ClientDeliveryChannel,
  ClientUploadedAttachment,
  OrderDeliverableFile,
  OrderDeliverableKind,
} from './src/data/clientCabinetHelpers.ts';
import {
  mergeSeedOrderDeliverablesWithVersions,
  resolveUploadedDeliverableVersionMeta,
} from './src/data/deliverableVersioning.ts';
import {
  buildApprovalWorkflowNotification,
  buildDeliverableUploadedNotification,
  buildStageChangedNotification,
  buildTestCabinetPushNotification,
  countUnreadNotifications,
  createDefaultClientNotificationPreferences,
  createSeedCabinetNotifications,
  filterNotificationsForAccessibleOrders,
  hydrateCabinetNotifications,
  isCabinetNotificationRead,
  isNotificationEnabledByPreferences,
  markNotificationsReadInPreferences,
  mergeNotificationEventIdempotently,
  sanitizeClientNotificationPreferences,
  type CabinetNotificationItem,
  type ClientNotificationPreferences,
} from './src/data/cabinetPushNotifications.ts';
import {
  applyClientScriptDecision,
  applyClientSpotDecision,
  applyProducerEscalationResolution,
  applyPublishEngineerTakeToClient,
  applyPublishScriptDraft,
  applyRecordEngineerTake,
  createDefaultSoundEngineerRoster,
  ensureOrderApprovalWorkflow,
  formatSoundEngineerProductionSheet,
  issueSoundDropTokenWithSigner,
  issueSoundEngineerEmailGrantWithSigner,
  parseWavExactDurationSec,
  type PublishScriptConceptInput,
  sanitizeSoundEngineerRoster,
  type SoundEngineerContact,
  type SoundEngineerEmailNotificationRecord,
  type SoundEngineerEmailTriggerReason,
  type SpotRevisionKind,
  toClientApprovalWorkflowView,
  toSoundDropTaskPublicView,
  verifySoundDropTokenWithSigner,
  verifySoundEngineerEmailGrantWithSigner,
} from './src/data/productionApprovalWorkflow.ts';
import { sanitizeClientAvatarPresetId } from './src/data/clientAvatarLogic.ts';
import {
  buildClientSessionClearCookieHeader,
  buildClientSessionSetCookieHeader,
  canDirectBindOrdersToEmailSession,
  canExposeMagicLinkLocalPreview,
  CLIENT_SESSION_COOKIE_NAME,
  CLIENT_SESSION_MAX_AGE_SEC,
  collectOrdersForClientEmail,
  createSeedClientAccounts,
  doesOrderBelongToClientEmail,
  issueClientMagicLinkToken,
  issueClientSessionToken,
  normalizeClientEmail,
  resolveOrderSubmissionClientEmail,
  sanitizeClientAccountRecord,
  toClientAccountPublicProfile,
  upsertClientAccountRecord,
  verifyClientMagicLinkToken,
  verifyClientSessionToken,
} from './src/data/clientAuthCore.ts';
import type { ClientAccountRecord } from './src/data/clientAuthCore.ts';
import { verifyClientAttachmentMagicBytes } from './src/data/clientCabinetArchitecture.ts';
import {
  createZeroPdnSharedProposalRecord,
  sanitizeSharedProposalToken,
  type SharedB2bProposalRecord,
  verifySharedProposalRecordToken,
} from './src/data/b2bSharedProposalCore.ts';

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
const SHARED_PROPOSALS_FILE = path.join(CMS_DATA_DIR, 'studio-shared-proposals.json');
const ORDER_DELIVERABLES_DIR = path.join(CMS_DATA_DIR, 'order-deliverables');
const ORDER_UPLOADS_DIR = path.join(CMS_DATA_DIR, 'order-uploads');

const MAIN_PROMO_FILENAME = 'Audioworks_75c6023f.mp3';
const CANONICAL_RADIO_FILE = 'zerno_radio_15.mp3';
const CANONICAL_AUDIOWORKS_FILE = 'zerno_audioworks_15.mp3';

const SESSION_TTL_MS = STUDIO_SESSION_ABSOLUTE_TTL_MS;

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

const SESSION_SECRET_FILE = path.join(CMS_DATA_DIR, '.cms-session-secret');
const REVOKED_SESSIONS_FILE = path.join(CMS_DATA_DIR, '.revoked-sessions.json');
const CLIENT_AUTH_NONCES_FILE = path.join(CMS_DATA_DIR, '.client-auth-nonces.json');
const sessionRevocationRegistry = createSessionRevocationRegistry();
const studioSessionActivityTracker = createStudioSessionActivityTracker(
  STUDIO_SESSION_IDLE_TIMEOUT_MS
);
const clientSessionRevocationRegistry = createSessionRevocationRegistry();
const consumedMagicLinkRegistry = createSessionRevocationRegistry();
let cachedRandomSessionSecret: string | null = null;
let cachedDevAutoPassword: string | null = null;

function hydratePersistedRevocations(): void {
  try {
    if (fs.existsSync(REVOKED_SESSIONS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(REVOKED_SESSIONS_FILE, 'utf8'));
      if (Array.isArray(raw)) {
        sessionRevocationRegistry.hydrate(raw as [string, number][]);
      }
    }
  } catch {
    // Ignore malformed revocation store
  }
  try {
    if (fs.existsSync(CLIENT_AUTH_NONCES_FILE)) {
      const rawClient = JSON.parse(fs.readFileSync(CLIENT_AUTH_NONCES_FILE, 'utf8')) as {
        revokedSessions?: [string, number][];
        consumedMagicLinks?: [string, number][];
      };
      if (Array.isArray(rawClient?.revokedSessions)) {
        clientSessionRevocationRegistry.hydrate(rawClient.revokedSessions);
      }
      if (Array.isArray(rawClient?.consumedMagicLinks)) {
        consumedMagicLinkRegistry.hydrate(rawClient.consumedMagicLinks);
      }
    }
  } catch {
    // Ignore malformed client auth nonce store
  }
}

function persistRevocations(): void {
  try {
    fs.mkdirSync(CMS_DATA_DIR, { recursive: true });
    fs.writeFileSync(
      REVOKED_SESSIONS_FILE,
      JSON.stringify(sessionRevocationRegistry.exportEntries()),
      { encoding: 'utf8', mode: 0o600 }
    );
  } catch {
    // Ignore read-only fs errors
  }
}

function persistClientAuthNonces(): void {
  try {
    fs.mkdirSync(CMS_DATA_DIR, { recursive: true });
    fs.writeFileSync(
      CLIENT_AUTH_NONCES_FILE,
      JSON.stringify({
        revokedSessions: clientSessionRevocationRegistry.exportEntries(),
        consumedMagicLinks: consumedMagicLinkRegistry.exportEntries(),
      }),
      { encoding: 'utf8', mode: 0o600 }
    );
  } catch {
    // Ignore read-only fs errors
  }
}

hydratePersistedRevocations();

function isAiStudioDevPreview(): boolean {
  const kService = (process.env.K_SERVICE ?? '').trim();
  const appUrl = (process.env.APP_URL ?? '').trim();
  return kService.startsWith('ais-dev-') || appUrl.includes('//ais-dev-');
}

function isStrictProductionDeployment(): boolean {
  if (process.env.npm_lifecycle_event === 'dev' || isAiStudioDevPreview()) {
    return false;
  }
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.npm_lifecycle_event === 'start'
  );
}

function getStudioAdminPassword(): string {
  const fromEnv = process.env.STUDIO_ADMIN_PASSWORD?.trim();
  if (fromEnv && fromEnv !== 'CHANGE_ME_STUDIO_PASSWORD') {
    return fromEnv;
  }
  if (isStrictProductionDeployment()) {
    if (!cachedDevAutoPassword) {
      cachedDevAutoPassword = crypto.randomBytes(24).toString('base64url');
      console.warn(
        '[SECURITY] STUDIO_ADMIN_PASSWORD is not set in production! Default password is disabled.'
      );
    }
    return cachedDevAutoPassword;
  }
  return 'audioworks';
}

function getSessionSecret(): string {
  const fromEnv = process.env.CMS_SESSION_SECRET?.trim();
  if (fromEnv && fromEnv !== 'CHANGE_ME_RANDOM_SESSION_SECRET') {
    return fromEnv;
  }
  if (cachedRandomSessionSecret) {
    return cachedRandomSessionSecret;
  }
  try {
    if (fs.existsSync(SESSION_SECRET_FILE)) {
      const existing = fs.readFileSync(SESSION_SECRET_FILE, 'utf8').trim();
      if (existing.length >= 32) {
        cachedRandomSessionSecret = existing;
        return cachedRandomSessionSecret;
      }
    }
    fs.mkdirSync(CMS_DATA_DIR, { recursive: true });
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SESSION_SECRET_FILE, `${generated}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    cachedRandomSessionSecret = generated;
    return cachedRandomSessionSecret;
  } catch {
    cachedRandomSessionSecret = crypto.randomBytes(32).toString('hex');
    return cachedRandomSessionSecret;
  }
}

function safeCompareStrings(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hashB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function issueAdminToken(rawOperatorName?: unknown): {
  token: string;
  expiresAt: number;
  operatorName: string;
} {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const nonce = crypto.randomBytes(16).toString('hex');
  const operatorName = sanitizeStudioOperatorName(rawOperatorName);
  const payload = Buffer.from(
    JSON.stringify({
      role: 'studio_admin',
      exp: expiresAt,
      nonce,
      operatorName,
    }),
    'utf8'
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');
  studioSessionActivityTracker.registerSession(nonce, expiresAt, operatorName);
  return {
    token: `${payload}.${sig}`,
    expiresAt,
    operatorName,
  };
}

function parseVerifiedAdminToken(
  rawToken: string | undefined,
  options: { touchActivity?: boolean } = {}
): { role: string; exp: number; nonce: string; operatorName: string } | null {
  if (!rawToken || typeof rawToken !== 'string') return null;
  const parts = rawToken.trim().split('.');
  if (parts.length !== 2) return null;
  const [payload, providedSig] = parts;
  if (!payload || !providedSig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');

  if (!safeCompareStrings(providedSig, expectedSig)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as {
      role?: string;
      exp?: number;
      nonce?: string;
      operatorName?: string;
    };
    if (parsed.role !== 'studio_admin') return null;
    if (typeof parsed.exp !== 'number' || parsed.exp < Date.now()) return null;
    const nonce = typeof parsed.nonce === 'string' ? parsed.nonce : '';
    if (nonce && sessionRevocationRegistry.isRevoked(nonce)) return null;
    const operatorName = sanitizeStudioOperatorName(parsed.operatorName);
    if (nonce && options.touchActivity !== false) {
      const activity = studioSessionActivityTracker.verifyAndTouch(
        nonce,
        parsed.exp,
        operatorName
      );
      if (!activity.active) {
        if (activity.reason === 'expired_idle') {
          sessionRevocationRegistry.revoke(nonce, parsed.exp);
          persistRevocations();
        }
        return null;
      }
    }
    return {
      role: parsed.role,
      exp: parsed.exp,
      nonce,
      operatorName,
    };
  } catch {
    return null;
  }
}

function verifyAdminToken(rawToken: string | undefined): boolean {
  return parseVerifiedAdminToken(rawToken, { touchActivity: true }) !== null;
}

function resolveRequestOperatorName(req: Request): string {
  const token = extractStudioToken(req);
  const parsed = parseVerifiedAdminToken(token, { touchActivity: false });
  return parsed?.operatorName ?? DEFAULT_STUDIO_OPERATOR_NAME;
}

function extractStudioToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && typeof authHeader === 'string') {
    if (authHeader.toLowerCase().startsWith('bearer ')) {
      const bearer = authHeader.slice(7).trim();
      if (bearer) return bearer;
    }
  }
  const cookies = parseCookieHeader(req.headers.cookie);
  const fromCookie = cookies[STUDIO_SESSION_COOKIE_NAME];
  return fromCookie && fromCookie.trim() ? fromCookie.trim() : undefined;
}

function extractClientSessionCookieToken(req: Request): string | undefined {
  const cookies = parseCookieHeader(req.headers.cookie);
  const fromCookie = cookies[CLIENT_SESSION_COOKIE_NAME];
  return fromCookie && fromCookie.trim() ? fromCookie.trim() : undefined;
}

function getVerifiedClientSession(req: Request) {
  const rawToken = extractClientSessionCookieToken(req);
  if (!rawToken) return null;
  return verifyClientSessionToken(rawToken, getSessionSecret(), {
    isNonceRevoked: (nonce) => clientSessionRevocationRegistry.isRevoked(nonce),
    minValidEpoch: (email) => {
      const store = readOrdersCrmStore();
      const found = store.clientAccounts.find((a) => a.email === email);
      return found?.sessionEpoch ?? 1;
    },
  });
}

function isBlockedCrossOriginMutation(req: Request): boolean {
  return isCrossOriginBrowserRequest({
    originHeader: req.headers.origin,
    refererHeader: req.headers.referer,
    hostHeader:
      (process.env.TRUST_PROXY === 'true' ? req.headers['x-forwarded-host'] : undefined) ||
      req.headers.host,
  });
}

function isHttpsRequest(req: Request): boolean {
  if (req.secure) return true;
  const rawProto = req.headers['x-forwarded-proto'];
  if (typeof rawProto === 'string') {
    return rawProto.split(',')[0].trim().toLowerCase() === 'https';
  }
  return false;
}

function requireStudioAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractStudioToken(req);
  if (!verifyAdminToken(token)) {
    recordSecurityAudit('auth_unauthorized_access', req, `Отклонён доступ без сессии: ${req.method} ${req.path}`);
    res.status(401).json({
      error: 'Требуется авторизация в кабинете студии',
    });
    return;
  }
  // OWASP WSTG-SESS-05: дополнительная CSRF-проверка Origin/Referer для изменяющих cookie-запросов
  const isMutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());
  if (
    isMutating &&
    !req.headers.authorization &&
    isCrossOriginBrowserRequest({
      originHeader: req.headers.origin,
      refererHeader: req.headers.referer,
      hostHeader:
        (process.env.TRUST_PROXY === 'true' ? req.headers['x-forwarded-host'] : undefined) ||
        req.headers.host,
    })
  ) {
    recordSecurityAudit('auth_unauthorized_access', req, `CSRF-блокировка кросс-доменного запроса: ${req.method} ${req.path}`);
    res.status(403).json({
      error: 'Кросс-доменный изменяющий запрос отклонён политикой безопасности',
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
  auditEvents: SecurityAuditEvent[];
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
    auditEvents: [],
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
      auditEvents: Array.isArray(raw.auditEvents) ? raw.auditEvents : [],
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
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
    fs.renameSync(tmp, SECURITY_LEADS_FILE);
  } catch {
    // В контейнере только для чтения сохраняем состояние в оперативной памяти процесса
  }
}

function recordSecurityAudit(
  kind: SecurityAuditEventKind,
  reqOrIp: Request | string | null,
  detail: string
): void {
  const ip =
    reqOrIp && typeof reqOrIp === 'object'
      ? resolveClientIp(reqOrIp)
      : typeof reqOrIp === 'string'
        ? reqOrIp
        : 'system';
  const store = readSecurityStore();
  store.auditEvents = appendSecurityAuditEvent(store.auditEvents, {
    kind,
    ipHash: ip === 'system' ? 'system' : hashIpForAudit(ip),
    detail,
  });
  writeSecurityStore(store);
}

interface PersistedOrdersCrmStore {
  orders: CrmOrderRecord[];
  clientAccounts: ClientAccountRecord[];
  soundEngineers: SoundEngineerContact[];
  soundEngineerEmails: SoundEngineerEmailNotificationRecord[];
  settings: OrderDispatchSettings;
  dispatchLogs: DispatchAttemptLog[];
  legalProfiles: StudioLegalProfilesConfig;
  clientNotifications: CabinetNotificationItem[];
  clientNotificationPrefs: Record<string, ClientNotificationPreferences>;
}

let cachedOrdersCrmStore: PersistedOrdersCrmStore | null = null;

function createDefaultDispatchSettings(): OrderDispatchSettings {
  const envTg = resolveEffectiveTelegramSettings(null, process.env);
  const envWebhookUrl = process.env.ORDERS_WEBHOOK_URL?.trim() || '';
  const envWebhookSecret = process.env.ORDERS_WEBHOOK_SECRET?.trim() || '';

  return {
    telegram: {
      enabled: envTg.enabled,
      botToken: '',
      chatId: envTg.envChatIdConfigured ? envTg.chatId : '',
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

function hydratePersistedClientAccounts(rawAccounts: unknown): ClientAccountRecord[] {
  const seeds = createSeedClientAccounts();
  if (!Array.isArray(rawAccounts) || rawAccounts.length === 0) {
    return seeds;
  }
  const seedByEmail = new Map(seeds.map((s) => [s.email, s]));
  const sanitized = rawAccounts
    .map((item) => sanitizeClientAccountRecord(item))
    .filter((item): item is ClientAccountRecord => item !== null)
    .map((acc) => {
      const matchingSeed = seedByEmail.get(acc.email);
      if (!matchingSeed) return acc;
      return {
        ...acc,
        linkedOrderNumbers: Array.from(
          new Set([...acc.linkedOrderNumbers, ...matchingSeed.linkedOrderNumbers])
        ).slice(0, 200),
      };
    });
  const existingEmails = new Set(sanitized.map((a) => a.email));
  for (const seed of seeds) {
    if (!existingEmails.has(seed.email)) {
      sanitized.push(seed);
    }
  }
  return sanitized;
}

function readOrdersCrmStore(): PersistedOrdersCrmStore {
  if (cachedOrdersCrmStore) return cachedOrdersCrmStore;
  try {
    if (!fs.existsSync(ORDERS_CRM_FILE)) {
      const defaults = createDefaultDispatchSettings();
      cachedOrdersCrmStore = {
        orders: createSeedCrmOrders(),
        clientAccounts: createSeedClientAccounts(),
        soundEngineers: createDefaultSoundEngineerRoster(),
        soundEngineerEmails: [],
        settings: defaults,
        dispatchLogs: [],
        legalProfiles: createDefaultStudioLegalProfiles(),
        clientNotifications: createSeedCabinetNotifications(),
        clientNotificationPrefs: {},
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
    const seedOrders = createSeedCrmOrders();
    const seedById = new Map(seedOrders.map((s) => [s.id, s]));
    const persistedList =
      Array.isArray(raw.orders) && raw.orders.length > 0 ? raw.orders : [];
    const existingIds = new Set(persistedList.map((o) => o?.id));
    const existingNums = new Set(persistedList.map((o) => o?.orderNumber));
    const missingSeeds = seedOrders.filter(
      (s) => !existingIds.has(s.id) && !existingNums.has(s.orderNumber)
    );
    const rawOrders =
      persistedList.length > 0 ? [...persistedList, ...missingSeeds] : seedOrders;
    cachedOrdersCrmStore = {
      orders: rawOrders.map((ord) => {
        const withSla = ensureCrmOrderSlaFields(ord, workSchedule);
        const seedMatch = seedById.get(withSla.id);
        const normPref = normalizeDeliveryPreferences(
          withSla.preferredDeliveryChannel ?? seedMatch?.preferredDeliveryChannel,
          withSla.preferredDeliveryDetail ?? seedMatch?.preferredDeliveryDetail,
          'messenger'
        );
        const resolvedSeedEmail =
          withSla.pdnAnonymizedAt
            ? null
            : withSla.clientEmail !== undefined
              ? normalizeClientEmail(withSla.clientEmail)
              : normalizeClientEmail(seedMatch?.clientEmail);
        if (seedMatch) {
          const syncArchiveTimestamps =
            seedMatch.id === 'crm-seed-completed-2309' &&
            withSla.stage === 'completed_ltv';
          return ensureOrderStageHistory(
            ensureOrderApprovalWorkflow({
              ...withSla,
              createdAt: syncArchiveTimestamps ? seedMatch.createdAt : withSla.createdAt,
              updatedAt: syncArchiveTimestamps ? seedMatch.updatedAt : withSla.updatedAt,
              clientEmail: resolvedSeedEmail,
              preferredDeliveryChannel: normPref.channel,
              preferredDeliveryDetail: normPref.detail,
              cloudDiskUrl:
                withSla.cloudDiskUrl !== undefined
                  ? withSla.cloudDiskUrl
                  : seedMatch.cloudDiskUrl,
              deliverables: mergeSeedOrderDeliverablesWithVersions(
                withSla.deliverables,
                seedMatch.deliverables
              ),
              clientUploads:
                withSla.clientUploads ?? seedMatch.clientUploads ?? [],
            })
          );
        }
        return ensureOrderStageHistory(
          ensureOrderApprovalWorkflow({
            ...withSla,
            clientEmail: resolvedSeedEmail,
            preferredDeliveryChannel: normPref.channel,
            preferredDeliveryDetail: normPref.detail,
          })
        );
      }),
      clientAccounts: hydratePersistedClientAccounts(raw.clientAccounts),
      soundEngineers: sanitizeSoundEngineerRoster(raw.soundEngineers),
      soundEngineerEmails: Array.isArray(raw.soundEngineerEmails)
        ? raw.soundEngineerEmails.slice(0, 60)
        : [],
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
      clientNotifications: hydrateCabinetNotifications(raw.clientNotifications),
      clientNotificationPrefs: (() => {
        const out: Record<string, ClientNotificationPreferences> = {};
        if (
          raw.clientNotificationPrefs &&
          typeof raw.clientNotificationPrefs === 'object'
        ) {
          for (const [key, val] of Object.entries(raw.clientNotificationPrefs)) {
            if (!key.trim()) continue;
            const clean = sanitizeClientNotificationPreferences(val, key.trim());
            out[clean.subjectKey] = clean;
          }
        }
        return out;
      })(),
    };
    return cachedOrdersCrmStore;
  } catch {
    cachedOrdersCrmStore = {
      orders: createSeedCrmOrders(),
      clientAccounts: createSeedClientAccounts(),
      soundEngineers: createDefaultSoundEngineerRoster(),
      soundEngineerEmails: [],
      settings: createDefaultDispatchSettings(),
      dispatchLogs: [],
      legalProfiles: createDefaultStudioLegalProfiles(),
      clientNotifications: createSeedCabinetNotifications(),
      clientNotificationPrefs: {},
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

function canClientAccessOrder(
  req: Request,
  order: CrmOrderRecord,
  providedRescueToken: string | undefined | null,
  crmStore: PersistedOrdersCrmStore
): boolean {
  if (order.pdnAnonymizedAt) {
    return false;
  }
  if (verifyOrderRescueToken(order.orderNumber, providedRescueToken)) {
    return true;
  }
  const clientSession = getVerifiedClientSession(req);
  if (!clientSession) return false;
  const account = crmStore.clientAccounts.find((a) => a.email === clientSession.email);
  return doesOrderBelongToClientEmail(
    order,
    clientSession.email,
    account?.linkedOrderNumbers ?? []
  );
}

const clientMagicLinkIpLimiter = new RateLimiter({
  maxAttempts: 12,
  windowMs: 10 * 60 * 1000,
  minIntervalMs: 350,
});

const clientMagicLinkEmailLimiter = new RateLimiter({
  maxAttempts: 8,
  windowMs: 10 * 60 * 1000,
  minIntervalMs: 350,
});

const clientTestPushLimiter = new RateLimiter({
  maxAttempts: 12,
  windowMs: 5 * 60 * 1000,
  minIntervalMs: 400,
});

const clientOrderUploadLimiter = new RateLimiter({
  maxAttempts: 16,
  windowMs: 10 * 60 * 1000,
  minIntervalMs: 350,
});

const soundDropUploadLimiter = new RateLimiter({
  maxAttempts: 24,
  windowMs: 10 * 60 * 1000,
  minIntervalMs: 250,
});

function signSoundDropHmac(signingInput: string): string {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(signingInput)
    .digest('base64url')
    .slice(0, 32);
}

interface ActiveCabinetSseClient {
  id: string;
  res: Response;
  sessionEmail: string | null;
  verifiedRescueOrderNumbers: Set<string>;
  heartbeatTimer: ReturnType<typeof setInterval>;
}

const cabinetNotificationSseClients = new Map<string, ActiveCabinetSseClient>();

function parseInlineOrderRescueTokensParam(
  rawParam: unknown
): Array<{ orderNumber: string; rescueToken: string }> {
  if (typeof rawParam !== 'string' || !rawParam.trim()) return [];
  const pairs: Array<{ orderNumber: string; rescueToken: string }> = [];
  for (const part of rawParam.split(',').slice(0, 30)) {
    const colonIdx = part.indexOf(':');
    if (colonIdx <= 0) continue;
    const orderNumber = part.slice(0, colonIdx).trim();
    const rescueToken = part.slice(colonIdx + 1).trim();
    if (orderNumber && rescueToken) {
      pairs.push({ orderNumber, rescueToken });
    }
  }
  return pairs;
}

function computeCabinetNotificationSubjectKey(
  sessionEmail: string | null,
  accessibleOrderNumbers: readonly string[]
): string | null {
  if (sessionEmail) {
    return `email:${sessionEmail}`;
  }
  if (accessibleOrderNumbers.length === 0) {
    return null;
  }
  const canonical = [...accessibleOrderNumbers]
    .map((n) => n.trim().toUpperCase())
    .filter(Boolean)
    .sort()
    .join(',');
  if (!canonical) return null;
  const digest = crypto
    .createHmac('sha256', getSessionSecret())
    .update(`cabinet-notif-subject-v1:${canonical}`)
    .digest('base64url')
    .slice(0, 24);
  return `orders:${digest}`;
}

function resolveClientAccessibleNotificationScope(
  req: Request,
  rawItems: unknown,
  crmStore: PersistedOrdersCrmStore
): {
  sessionEmail: string | null;
  verifiedRescueOrderNumbers: Set<string>;
  accessibleOrderNumbers: string[];
  subjectKey: string | null;
  preferences: ClientNotificationPreferences;
} {
  const session = getVerifiedClientSession(req);
  const sessionEmail = session?.email ?? null;
  const accessibleSet = new Set<string>();
  const verifiedRescueSet = new Set<string>();

  if (sessionEmail) {
    const account = crmStore.clientAccounts.find((a) => a.email === sessionEmail);
    const matched = collectOrdersForClientEmail(
      crmStore.orders,
      sessionEmail,
      account
    );
    for (const ord of matched) {
      accessibleSet.add(ord.orderNumber.toUpperCase());
    }
  }

  const itemsList = Array.isArray(rawItems) ? rawItems.slice(0, 30) : [];
  for (const entry of itemsList) {
    if (!entry || typeof entry !== 'object') continue;
    const rec = entry as { orderNumber?: unknown; rescueToken?: unknown };
    const ordNum =
      typeof rec.orderNumber === 'string' ? rec.orderNumber.trim() : '';
    const token =
      typeof rec.rescueToken === 'string' ? rec.rescueToken.trim() : '';
    if (!ordNum || !token || !verifyOrderRescueToken(ordNum, token)) {
      continue;
    }
    const found = crmStore.orders.find(
      (o) =>
        o.orderNumber.toUpperCase() === ordNum.toUpperCase() &&
        !o.pdnAnonymizedAt
    );
    if (found) {
      const upper = found.orderNumber.toUpperCase();
      accessibleSet.add(upper);
      verifiedRescueSet.add(upper);
    }
  }

  const accessibleOrderNumbers = Array.from(accessibleSet);
  const subjectKey = computeCabinetNotificationSubjectKey(
    sessionEmail,
    accessibleOrderNumbers
  );
  const preferences = subjectKey
    ? sanitizeClientNotificationPreferences(
        crmStore.clientNotificationPrefs[subjectKey],
        subjectKey
      )
    : createDefaultClientNotificationPreferences('anonymous');

  return {
    sessionEmail,
    verifiedRescueOrderNumbers: verifiedRescueSet,
    accessibleOrderNumbers,
    subjectKey,
    preferences,
  };
}

function recordAndBroadcastCabinetNotification(
  notification: CabinetNotificationItem,
  crmStore: PersistedOrdersCrmStore
): void {
  crmStore.clientNotifications = mergeNotificationEventIdempotently(
    crmStore.clientNotifications ?? [],
    notification,
    300
  );
  writeOrdersCrmStore(crmStore);

  const upperOrderNum = notification.orderNumber.trim().toUpperCase();
  const targetOrder = crmStore.orders.find(
    (o) => o.orderNumber.toUpperCase() === upperOrderNum && !o.pdnAnonymizedAt
  );

  for (const client of cabinetNotificationSseClients.values()) {
    let hasAccess = client.verifiedRescueOrderNumbers.has(upperOrderNum);
    if (!hasAccess && client.sessionEmail && targetOrder) {
      const acc = crmStore.clientAccounts.find(
        (a) => a.email === client.sessionEmail
      );
      hasAccess = doesOrderBelongToClientEmail(
        targetOrder,
        client.sessionEmail,
        acc?.linkedOrderNumbers ?? []
      );
    }
    if (!hasAccess) continue;

    const clientOrderNums = Array.from(client.verifiedRescueOrderNumbers);
    const subjKey = computeCabinetNotificationSubjectKey(
      client.sessionEmail,
      clientOrderNums
    );
    const prefs = subjKey
      ? sanitizeClientNotificationPreferences(
          crmStore.clientNotificationPrefs[subjKey],
          subjKey
        )
      : createDefaultClientNotificationPreferences('anonymous');

    if (!isNotificationEnabledByPreferences(notification, prefs)) {
      continue;
    }

    const viewItem = {
      ...notification,
      isRead: isCabinetNotificationRead(notification, prefs),
    };
    try {
      client.res.write(
        `event: notification\ndata: ${JSON.stringify({ notification: viewItem })}\n\n`
      );
    } catch {
      clearInterval(client.heartbeatTimer);
      cabinetNotificationSseClients.delete(client.id);
    }
  }
}

const DELIVERABLE_ALLOWED_EXTS = new Set([
  '.wav',
  '.mp3',
  '.ogg',
  '.m4a',
  '.pdf',
  '.txt',
  '.doc',
  '.docx',
  '.zip',
]);

const CLIENT_UPLOAD_ALLOWED_EXTS = new Set([
  '.txt',
  '.pdf',
  '.doc',
  '.docx',
  '.rtf',
  '.jpg',
  '.jpeg',
  '.png',
  '.wav',
  '.mp3',
  '.ogg',
  '.m4a',
]);

function inferMimeTypeByExt(ext: string): string {
  switch (ext) {
    case '.wav':
      return 'audio/wav';
    case '.mp3':
      return 'audio/mpeg';
    case '.ogg':
      return 'audio/ogg';
    case '.m4a':
      return 'audio/mp4';
    case '.pdf':
      return 'application/pdf';
    case '.txt':
      return 'text/plain; charset=utf-8';
    case '.doc':
      return 'application/msword';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.rtf':
      return 'application/rtf';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.zip':
      return 'application/zip';
    default:
      return 'application/octet-stream';
  }
}

function resolveContainedStoragePath(
  storageDir: string,
  storageKey: string
): string | null {
  if (!storageKey || typeof storageKey !== 'string') return null;
  const cleanKey = path.basename(storageKey.trim());
  if (!cleanKey || cleanKey !== storageKey.trim() || cleanKey.includes('..')) {
    return null;
  }
  const baseResolved = path.resolve(storageDir);
  const fullResolved = path.resolve(storageDir, cleanKey);
  if (!fullResolved.startsWith(`${baseResolved}${path.sep}`)) {
    return null;
  }
  return fullResolved;
}

function resolveSeedPublicAudioPath(staticAssetUrl: string): string | null {
  if (!staticAssetUrl || typeof staticAssetUrl !== 'string') return null;
  const cleanName = path.basename(staticAssetUrl.trim());
  if (!cleanName || cleanName !== staticAssetUrl.trim()) return null;
  const nameVariants = [cleanName];
  if (/\.wav$/i.test(cleanName)) {
    nameVariants.push(cleanName.replace(/\.wav$/i, '.mp3'));
  }
  const candidates = [PUBLIC_AUDIO_DIR, DIST_AUDIO_DIR];
  for (const dir of candidates) {
    const resolvedDir = path.resolve(dir);
    for (const candidateName of nameVariants) {
      const resolvedFile = path.resolve(dir, candidateName);
      if (
        resolvedFile.startsWith(`${resolvedDir}${path.sep}`) &&
        fs.existsSync(resolvedFile)
      ) {
        return resolvedFile;
      }
    }
  }
  return null;
}

function decodeBase64FilePayload(
  rawDataUrlOrBase64: string
): { mimeFromHeader: string | null; buffer: Buffer } | null {
  if (!rawDataUrlOrBase64 || typeof rawDataUrlOrBase64 !== 'string') return null;
  const trimmed = rawDataUrlOrBase64.trim();
  let mimeFromHeader: string | null = null;
  let b64 = trimmed;
  const dataUrlMatch = trimmed.match(/^data:([^;]+);base64,(.+)$/i);
  if (dataUrlMatch) {
    mimeFromHeader = dataUrlMatch[1].toLowerCase().trim();
    b64 = dataUrlMatch[2];
  }
  if (!b64 || b64.length > 22_000_000) return null;
  try {
    const buffer = Buffer.from(b64, 'base64');
    if (buffer.length === 0) return null;
    return { mimeFromHeader, buffer };
  } catch {
    return null;
  }
}

function saveBase64OrderAttachment(params: {
  storageDir: string;
  orderNumber: string;
  rawFileName: string;
  dataBase64: string;
  allowedExts: Set<string>;
  maxBytes: number;
  fallbackPrefix: string;
}):
  | {
      ok: true;
      storageKey: string;
      safeFileName: string;
      mimeType: string;
      sizeBytes: number;
    }
  | { ok: false; error: string } {
  const originalBase = path.basename((params.rawFileName || '').trim()) || 'file';
  const ext = path.extname(originalBase).toLowerCase();
  if (!ext || !params.allowedExts.has(ext)) {
    return {
      ok: false,
      error: `Неподдерживаемый формат файла (${ext || 'без расширения'}). Разрешены: ${Array.from(
        params.allowedExts
      ).join(', ')}`,
    };
  }
  const decoded = decodeBase64FilePayload(params.dataBase64);
  if (!decoded) {
    return { ok: false, error: 'Не удалось декодировать файл для сохранения' };
  }
  if (decoded.buffer.length > params.maxBytes) {
    const maxMb = Math.round(params.maxBytes / (1024 * 1024));
    return {
      ok: false,
      error: `Размер файла превышает лимит ${maxMb} МБ`,
    };
  }
  const magicCheck = verifyClientAttachmentMagicBytes(decoded.buffer, ext);
  if (!magicCheck.ok) {
    return { ok: false, error: magicCheck.error };
  }
  const safeStem = sanitizeSafeFileStem(originalBase, params.fallbackPrefix);
  const safeFileName = `${safeStem}${ext}`;
  const orderStem = sanitizeSafeFileStem(params.orderNumber, 'order');
  const storageKey = `${orderStem}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}${ext}`;
  const targetPath = resolveContainedStoragePath(params.storageDir, storageKey);
  if (!targetPath) {
    return { ok: false, error: 'Небезопасное имя файла' };
  }

  fs.mkdirSync(params.storageDir, { recursive: true });
  fs.writeFileSync(targetPath, decoded.buffer);

  return {
    ok: true,
    storageKey,
    safeFileName,
    mimeType: decoded.mimeFromHeader || inferMimeTypeByExt(ext),
    sizeBytes: decoded.buffer.length,
  };
}

function toClientCabinetOrderSummary(
  order: CrmOrderRecord,
  rescueToken: string,
  legalProfiles?: StudioLegalProfilesConfig | null
): ClientCabinetOrderSummary {
  return {
    orderNumber: order.orderNumber,
    rescueToken,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    stage: order.stage,
    formatLabel: order.formatLabel,
    totalBudgetRub: order.totalBudgetRub,
    contact: order.contact,
    clientEmail: order.clientEmail ?? null,
    companyOrInn: order.companyOrInn,
    innVerified: order.innVerified,
    briefText: order.briefText,
    hasVoiceRecording: order.hasVoiceRecording,
    voiceDurationSec: order.voiceDurationSec,
    attachedFileName: order.attachedFileName,
    ...(() => {
      const norm = normalizeDeliveryPreferences(
        order.preferredDeliveryChannel,
        order.preferredDeliveryDetail,
        'messenger'
      );
      return {
        preferredDeliveryChannel: norm.channel,
        preferredDeliveryDetail: norm.detail,
      };
    })(),
    cloudDiskUrl: sanitizeCloudDiskUrl(order.cloudDiskUrl),
    deliverables: Array.isArray(order.deliverables) ? order.deliverables : [],
    clientUploads: Array.isArray(order.clientUploads) ? order.clientUploads : [],
    documentMeta: order.documentMeta ?? null,
    legalProfiles: legalProfiles ?? null,
    approvalWorkflow: toClientApprovalWorkflowView(
      ensureOrderApprovalWorkflow(order).approvalWorkflow
    ),
  };
}

function resolveTelegramBotApiBaseUrl(): string {
  const custom = (process.env.TELEGRAM_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
  if (custom) {
    try {
      const parsed = new URL(custom);
      if (
        (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost')
      ) {
        return custom;
      }
    } catch {
      // Ignore malformed custom loopback URL
    }
  }
  return 'https://api.telegram.org';
}

async function discoverAndPersistTelegramChatId(
  botToken: string,
  crmStore: PersistedOrdersCrmStore
): Promise<DiscoveredTelegramChat | null> {
  const cleanToken = botToken.trim();
  if (!cleanToken) return null;
  try {
    const allowedUpdates = encodeURIComponent(
      JSON.stringify([
        'message',
        'channel_post',
        'edited_message',
        'my_chat_member',
      ])
    );
    const updatesUrl = `${resolveTelegramBotApiBaseUrl()}/bot${cleanToken}/getUpdates?limit=25&allowed_updates=${allowedUpdates}`;
    const res = await fetch(updatesUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) {
      return null;
    }
    const payload = (await res.json()) as unknown;
    const discovered = extractChatFromTelegramUpdates(payload);
    if (!discovered) {
      return null;
    }
    crmStore.settings.telegram = {
      ...crmStore.settings.telegram,
      chatId: discovered.chatId,
      chatIdAutoDiscovered: true,
      discoveredChatTitle: discovered.chatTitle,
    };
    writeOrdersCrmStore(crmStore);
    return discovered;
  } catch {
    return null;
  }
}

async function dispatchOrderToExternalChannels(
  orderId: string,
  event: CrmDispatchEvent,
  options: {
    statusChange?: OrderStatusChangeContext;
    forceSend?: boolean;
  } = {}
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

  const { webhook } = crmStore.settings;
  let resolvedTg = resolveEffectiveTelegramSettings(
    crmStore.settings.telegram,
    process.env
  );
  const statusChange = options.statusChange;
  const forceSend = options.forceSend === true || event === 'dispatch.test';

  const prevStageMeta = statusChange?.previousStage
    ? getCrmStageMetaForOrder(statusChange.previousStage, targetOrder.checkoutMode)
    : null;
  const nextStageMeta = getCrmStageMetaForOrder(
    statusChange?.nextStage ?? targetOrder.stage,
    targetOrder.checkoutMode
  );
  const transitionLabel =
    prevStageMeta && prevStageMeta.id !== nextStageMeta.id
      ? `«${prevStageMeta.stepCode}. ${prevStageMeta.shortLabel}» → «${nextStageMeta.stepCode}. ${nextStageMeta.shortLabel}»`
      : statusChange?.workflowStepLabel?.trim() || undefined;

  // 1. Telegram Bot API Dispatch (TELEGRAM_ORDERS_BOT_TOKEN)
  const pushDispatchLog = (entry: DispatchAttemptLog) => {
    crmStore.dispatchLogs = [entry, ...crmStore.dispatchLogs].slice(0, 40);
  };

  let telegramResult: CrmOrderRecord['delivery']['telegram'];
  const isPriorityEscalation =
    event === 'order.sla_breached' || event === 'order.client_rescue';
  const shouldSendTg =
    forceSend ||
    (resolvedTg.enabled &&
      (isPriorityEscalation ||
        (event === 'order.created' && resolvedTg.notifyOnNewOrder) ||
        (event === 'order.stage_changed' && resolvedTg.notifyOnStageChange)));

  // Если задан TELEGRAM_ORDERS_BOT_TOKEN, но Chat ID ещё не указан — автоматически проверяем getUpdates
  if (shouldSendTg && resolvedTg.hasBotToken && !resolvedTg.hasChatId) {
    const discovered = await discoverAndPersistTelegramChatId(
      resolvedTg.botToken,
      crmStore
    );
    if (discovered) {
      resolvedTg = resolveEffectiveTelegramSettings(
        crmStore.settings.telegram,
        process.env
      );
    }
  }

  if (!shouldSendTg || !resolvedTg.hasBotToken || !resolvedTg.hasChatId) {
    const missingReason = !resolvedTg.hasBotToken
      ? 'Задайте серверную переменную TELEGRAM_ORDERS_BOT_TOKEN для мгновенных уведомлений в Telegram'
      : !resolvedTg.hasChatId
        ? 'Токен TELEGRAM_ORDERS_BOT_TOKEN подключён — отправьте боту /start в Telegram или укажите Chat ID рабочей группы'
        : 'Автоотправка этого события отключена в настройках Telegram';

    telegramResult = {
      state: 'not_configured',
      updatedAt: nowIso,
      httpStatus: null,
      detail: missingReason,
    };
    if (forceSend || event === 'order.stage_changed') {
      const simSummary = !resolvedTg.hasBotToken
        ? `${
            transitionLabel ? `${transitionLabel} · ` : ''
          }Шаблон сформирован (ожидает TELEGRAM_ORDERS_BOT_TOKEN в окружении сервера)`
        : !resolvedTg.hasChatId
          ? `${
              transitionLabel ? `${transitionLabel} · ` : ''
            }Токен TELEGRAM_ORDERS_BOT_TOKEN активен — отправьте боту /start или укажите Chat ID`
          : `${
              transitionLabel ? `${transitionLabel} · ` : ''
            }Отправка события отключена в настройках шлюза`;
      pushDispatchLog({
        id: `log-tg-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        timestamp: nowIso,
        orderNumber: targetOrder.orderNumber,
        channel: 'telegram',
        event,
        state: 'ready_simulated',
        httpStatus: null,
        latencyMs: 2,
        summary: simSummary,
        ...(statusChange?.previousStage
          ? { previousStage: statusChange.previousStage }
          : {}),
        nextStage: statusChange?.nextStage ?? targetOrder.stage,
        ...(transitionLabel ? { transitionLabel } : {}),
      });
    }
  } else {
    const started = Date.now();
    try {
      const maskPdn = true;
      const text = formatTelegramOrderDispatchMessage(targetOrder, event, {
        maskPdn,
        statusChange,
      });
      const tgUrl = `${resolveTelegramBotApiBaseUrl()}/bot${resolvedTg.botToken}/sendMessage`;
      const sendOnce = () =>
        fetch(tgUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: resolvedTg.chatId,
            text,
            disable_web_page_preview: true,
          }),
          signal: AbortSignal.timeout(5000),
        });

      let tgRes = await sendOnce();
      let rawErrText = tgRes.ok ? '' : await tgRes.text();
      if (!tgRes.ok && (tgRes.status >= 500 || tgRes.status === 429)) {
        const parsedFirst = parseTelegramBotApiError(tgRes.status, rawErrText);
        if (
          tgRes.status >= 500 ||
          (parsedFirst.retryAfterSec !== null && parsedFirst.retryAfterSec <= 2)
        ) {
          const delayMs = parsedFirst.retryAfterSec
            ? parsedFirst.retryAfterSec * 1000
            : 350;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          tgRes = await sendOnce();
          rawErrText = tgRes.ok ? '' : await tgRes.text();
        }
      }

      const latencyMs = Date.now() - started;
      if (tgRes.ok) {
        const prefix = transitionLabel ? `${transitionLabel} · ` : '';
        telegramResult = {
          state: 'delivered',
          updatedAt: new Date().toISOString(),
          httpStatus: tgRes.status,
          detail: `${prefix}Доставлено в Telegram за ${latencyMs} мс`,
        };
      } else {
        const parsedErr = parseTelegramBotApiError(tgRes.status, rawErrText);
        telegramResult = {
          state: 'failed',
          updatedAt: new Date().toISOString(),
          httpStatus: tgRes.status,
          detail: parsedErr.detail,
        };
      }
      pushDispatchLog({
        id: `log-tg-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        timestamp: new Date().toISOString(),
        orderNumber: targetOrder.orderNumber,
        channel: 'telegram',
        event,
        state: telegramResult.state,
        httpStatus: tgRes.status,
        latencyMs,
        summary: telegramResult.detail,
        ...(statusChange?.previousStage
          ? { previousStage: statusChange.previousStage }
          : {}),
        nextStage: statusChange?.nextStage ?? targetOrder.stage,
        ...(transitionLabel ? { transitionLabel } : {}),
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
        id: `log-tg-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        timestamp: new Date().toISOString(),
        orderNumber: targetOrder.orderNumber,
        channel: 'telegram',
        event,
        state: 'failed',
        httpStatus: null,
        latencyMs,
        summary: telegramResult.detail,
        ...(statusChange?.previousStage
          ? { previousStage: statusChange.previousStage }
          : {}),
        nextStage: statusChange?.nextStage ?? targetOrder.stage,
        ...(transitionLabel ? { transitionLabel } : {}),
      });
    }
  }

  // 2. Outbound Webhook Dispatch (HMAC-SHA256 signed JSON)
  let webhookResult: CrmOrderRecord['delivery']['webhook'];
  const shouldSendWh =
    forceSend ||
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
    if (forceSend) {
      pushDispatchLog({
        id: `log-wh-${Date.now() + 1}-${crypto.randomBytes(2).toString('hex')}`,
        timestamp: nowIso,
        orderNumber: targetOrder.orderNumber,
        channel: 'webhook',
        event,
        state: 'ready_simulated',
        httpStatus: null,
        latencyMs: 1,
        summary:
          'JSON-конверт и подпись HMAC-SHA256 сформированы корректно (URL не задан)',
        ...(transitionLabel ? { transitionLabel } : {}),
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
      const targetUrlRaw = webhook.endpointUrl.trim();
      const targetCheck = validateOutboundWebhookTarget(targetUrlRaw, {
        allowInternalLoopbackSink: true,
        localPort: PORT,
      });
      if (!targetCheck.ok || !targetCheck.url) {
        const reason = targetCheck.reason ?? 'Небезопасный адрес исходящего вебхука (SSRF).';
        recordSecurityAudit('ssrf_target_blocked', 'system', reason);
        throw new Error(reason);
      }

      if (!targetCheck.isInternalLoopbackSink) {
        const resolvedAddrs = await dns.lookup(targetCheck.url.hostname, { all: true });
        if (!resolvedAddrs.length || resolvedAddrs.some((a) => isPrivateOrReservedIp(a.address))) {
          const reason = `SSRF-блокировка DNS: хост «${targetCheck.url.hostname}» разрешается во внутренний или зарезервированный IP.`;
          recordSecurityAudit('ssrf_target_blocked', 'system', reason);
          throw new Error(reason);
        }
      }

      const envelope = buildWebhookOrderEnvelope(
        targetOrder,
        event,
        nowIso,
        statusChange
      );
      const rawJson = JSON.stringify(envelope);
      const signingSecret = webhook.hmacSecret.trim() || getSessionSecret();
      const signatureHex = crypto
        .createHmac('sha256', signingSecret)
        .update(rawJson)
        .digest('hex');

      const whRes = await fetch(targetCheck.url.toString(), {
        method: 'POST',
        redirect: 'error',
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
        id: `log-wh-${Date.now() + 1}-${crypto.randomBytes(2).toString('hex')}`,
        timestamp: new Date().toISOString(),
        orderNumber: targetOrder.orderNumber,
        channel: 'webhook',
        event,
        state: webhookResult.state,
        httpStatus: whRes.status,
        latencyMs,
        summary: webhookResult.detail,
        ...(transitionLabel ? { transitionLabel } : {}),
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
        id: `log-wh-${Date.now() + 1}-${crypto.randomBytes(2).toString('hex')}`,
        timestamp: new Date().toISOString(),
        orderNumber: targetOrder.orderNumber,
        channel: 'webhook',
        event,
        state: 'failed',
        httpStatus: null,
        latencyMs,
        summary: webhookResult.detail,
        ...(transitionLabel ? { transitionLabel } : {}),
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
  return resolveTrustedClientIp(
    req.socket.remoteAddress,
    req.headers['x-forwarded-for'],
    process.env.TRUST_PROXY === 'true'
  );
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
const clientCabinetLookupLimiter = createSlidingWindowRateLimiter(20, 10 * 60 * 1000, 300);
const aiRecommendLimiter = createSlidingWindowRateLimiter(15, 5 * 60 * 1000, 0);
const duelUploadLimiter = createSlidingWindowRateLimiter(12, 10 * 60 * 1000, 0);
const radioStreamLimiter = createSlidingWindowRateLimiter(40, 5 * 60 * 1000, 0);
const counterpartyLookupLimiter = createSlidingWindowRateLimiter(45, 5 * 60 * 1000, 0);

// =========================================================================
// Kontur.Extern («Учёт») + Kontur.Diadoc & EGRUL/EGRIP Server Connector
// =========================================================================

const counterpartyCache = new Map<
  string,
  { expiresAt: number; value: CounterpartyLookupResult }
>();
const COUNTERPARTY_CACHE_TTL_MS = 30 * 60 * 1000;

let cachedDiadocPasswordToken: { token: string; expiresAt: number } | null = null;

function getDiadocApiBaseUrl(): string {
  const custom = (process.env.DIADOC_API_URL ?? '').trim().replace(/\/+$/, '');
  if (!custom) return DEFAULT_DIADOC_API_URL;
  try {
    const parsed = new URL(custom);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return DEFAULT_DIADOC_API_URL;
    }
    const bannedCheck = checkBannedForeignServiceUrl(custom);
    if (bannedCheck.matched) {
      return DEFAULT_DIADOC_API_URL;
    }
    return custom;
  } catch {
    return DEFAULT_DIADOC_API_URL;
  }
}

function getKonturIntegrationStatus(): KonturIntegrationStatus {
  const dadataConfigured = Boolean((process.env.DADATA_API_KEY ?? '').trim());
  const focusConfigured = Boolean((process.env.KONTUR_FOCUS_API_KEY ?? '').trim());
  const diadocApiKey = (process.env.DIADOC_API_KEY ?? '').trim();
  const hasAuthToken = Boolean((process.env.DIADOC_AUTH_TOKEN ?? '').trim());
  const hasLoginPass = Boolean(
    (process.env.DIADOC_LOGIN ?? '').trim() &&
      (process.env.DIADOC_PASSWORD ?? '').trim()
  );
  const diadocConfigured = Boolean(diadocApiKey && (hasAuthToken || hasLoginPass));
  const diadocBoxIdConfigured = Boolean((process.env.DIADOC_BOX_ID ?? '').trim());

  return {
    dadataConfigured,
    focusConfigured,
    diadocConfigured,
    diadocBoxIdConfigured,
    diadocApiUrl: getDiadocApiBaseUrl(),
    externExportReady: true,
  };
}

async function resolveDiadocAuthHeader(): Promise<string | null> {
  const apiKey = (process.env.DIADOC_API_KEY ?? '').trim();
  if (!apiKey) return null;

  const explicitToken = (process.env.DIADOC_AUTH_TOKEN ?? '').trim();
  if (explicitToken) {
    return `DiadocAuth ddauth_api_client_id=${apiKey},ddauth_token=${explicitToken}`;
  }

  const login = (process.env.DIADOC_LOGIN ?? '').trim();
  const password = (process.env.DIADOC_PASSWORD ?? '').trim();
  if (!login || !password) return null;

  const now = Date.now();
  if (cachedDiadocPasswordToken && cachedDiadocPasswordToken.expiresAt > now) {
    return `DiadocAuth ddauth_api_client_id=${apiKey},ddauth_token=${cachedDiadocPasswordToken.token}`;
  }

  try {
    const authRes = await fetch(
      `${getDiadocApiBaseUrl()}/V3/Authenticate?type=password`,
      {
        method: 'POST',
        headers: {
          Authorization: `DiadocAuth ddauth_api_client_id=${apiKey}`,
          'Content-Type': 'application/json; charset=utf-8',
          Accept: 'text/plain',
        },
        body: JSON.stringify({ login, password }),
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!authRes.ok) return null;
    const tokenText = (await authRes.text()).trim();
    if (!tokenText) return null;
    cachedDiadocPasswordToken = {
      token: tokenText,
      expiresAt: now + 6 * 60 * 60 * 1000,
    };
    return `DiadocAuth ddauth_api_client_id=${apiKey},ddauth_token=${tokenText}`;
  } catch {
    return null;
  }
}

async function lookupCounterpartyServerSide(
  rawInn: string
): Promise<CounterpartyLookupResult | null> {
  const baseOffline = resolveOfflineCounterpartyByInn(rawInn);
  if (!baseOffline) return null;

  const inn = baseOffline.inn;
  const now = Date.now();
  const cached = counterpartyCache.get(inn);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  let resolved: CounterpartyLookupResult = {
    ...baseOffline,
    diadoc: { ...baseOffline.diadoc },
  };

  const dadataKey = (process.env.DADATA_API_KEY ?? '').trim();
  const focusKey = (process.env.KONTUR_FOCUS_API_KEY ?? '').trim();

  if (dadataKey) {
    try {
      const ddRes = await fetch(
        'https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Token ${dadataKey}`,
          },
          body: JSON.stringify({ query: inn, branch_type: 'MAIN' }),
          signal: AbortSignal.timeout(3500),
        }
      );
      if (ddRes.ok) {
        const parsed = parseDadataPartyResponse(await ddRes.json(), inn);
        if (parsed) {
          resolved = {
            ...resolved,
            ...parsed,
            legalAddress: parsed.legalAddress || resolved.legalAddress,
            ogrn: parsed.ogrn || resolved.ogrn,
            kpp:
              parsed.entityKind === 'sole_proprietor'
                ? ''
                : parsed.kpp || resolved.kpp,
            diadoc: resolved.diadoc,
          };
        }
      }
    } catch {
      // Fallback to deterministic seed / Focus lookup
    }
  } else if (focusKey) {
    try {
      const fcUrl = `https://focus-api.kontur.ru/api3/req?inn=${encodeURIComponent(inn)}&key=${encodeURIComponent(focusKey)}`;
      const fcRes = await fetch(fcUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(3500),
      });
      if (fcRes.ok) {
        const parsed = parseKonturFocusReqResponse(await fcRes.json(), inn);
        if (parsed) {
          resolved = {
            ...resolved,
            ...parsed,
            legalAddress: parsed.legalAddress || resolved.legalAddress,
            ogrn: parsed.ogrn || resolved.ogrn,
            kpp:
              parsed.entityKind === 'sole_proprietor'
                ? ''
                : parsed.kpp || resolved.kpp,
            diadoc: resolved.diadoc,
          };
        }
      }
    } catch {
      // Fallback to deterministic seed
    }
  }

  const diadocAuth = await resolveDiadocAuthHeader();
  if (diadocAuth) {
    try {
      const boxRes = await fetch(
        `${getDiadocApiBaseUrl()}/GetOrganizationsByInnKpp?inn=${encodeURIComponent(inn)}`,
        {
          headers: {
            Authorization: diadocAuth,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(3500),
        }
      );
      if (boxRes.ok) {
        const parsedBox = parseDiadocGetOrganizationsResponse(await boxRes.json());
        if (parsedBox) {
          resolved = {
            ...resolved,
            diadoc: parsedBox,
          };
        }
      }
    } catch {
      // Keep existing Diadoc box info
    }
  }

  counterpartyCache.set(inn, {
    expiresAt: now + COUNTERPARTY_CACHE_TTL_MS,
    value: resolved,
  });
  return resolved;
}

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
    pruneExpiredTtlEntries(consumedChallengeNonces, now);
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
  return verifyAudioMagicBytes(buf);
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

  const useProdDist =
    process.env.NODE_ENV === 'production' ||
    process.env.npm_lifecycle_event === 'start' ||
    Boolean(process.env.K_SERVICE);

  const isPreviewFrameContainer = Boolean(process.env.K_SERVICE);

  // Безопасные HTTP-заголовки (с защитой от clickjacking frame-ancestors и совместимостью с превью AI Studio)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    if (!isPreviewFrameContainer) {
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    }
    res.setHeader(
      'Content-Security-Policy',
      buildContentSecurityPolicy({
        allowDevInlineScripts: !useProdDist,
        allowPreviewFrames: isPreviewFrameContainer,
      })
    );
    if (isHttpsRequest(req)) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
    }
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
    const token = extractStudioToken(req);
    const verified = parseVerifiedAdminToken(token, { touchActivity: true });
    res.json({
      authenticated: verified !== null,
      operatorName: verified?.operatorName ?? null,
    });
  });

  app.post('/api/cms/auth/login', express.json({ limit: '64kb' }), (req, res) => {
    const clientIp = resolveClientIp(req);
    const rawPassword =
      req.body && typeof req.body.password === 'string'
        ? req.body.password.trim()
        : '';
    const rawOperatorName = req.body?.operatorName;

    if (!rawPassword) {
      res.status(400).json({ error: 'Введите пароль студии' });
      return;
    }

    const rateCheck = loginFailureLimiter.consume(clientIp);
    if (!rateCheck.allowed) {
      const store = readSecurityStore();
      store.authBruteForceBlocks += 1;
      writeSecurityStore(store);
      recordSecurityAudit(
        'auth_rate_limited',
        req,
        `Превышен лимит попыток входа (${rateCheck.retryAfterSec} сек)`
      );
      res.setHeader('Retry-After', String(rateCheck.retryAfterSec));
      res.status(429).json({
        error: `Слишком много попыток входа. Повторите через ${rateCheck.retryAfterSec} сек.`,
      });
      return;
    }

    if (!safeCompareStrings(rawPassword, getStudioAdminPassword())) {
      recordSecurityAudit('auth_login_failure', req, 'Неверный пароль кабинета студии');
      res.status(401).json({ error: 'Неверный пароль студии. Проверьте раскладку и попробуйте снова.' });
      return;
    }

    loginFailureLimiter.resetKey(clientIp);
    const session = issueAdminToken(rawOperatorName);
    const maxAgeSec = Math.floor(SESSION_TTL_MS / 1000);
    res.setHeader(
      'Set-Cookie',
      buildSessionSetCookieHeader(session.token, maxAgeSec, isHttpsRequest(req))
    );
    recordSecurityAudit(
      'auth_login_success',
      req,
      `Успешный вход в кабинет студии (${session.operatorName})`
    );
    res.json({
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt,
      operatorName: session.operatorName,
    });
  });

  app.post('/api/cms/auth/logout', (req, res) => {
    if (
      !req.headers.authorization &&
      isCrossOriginBrowserRequest({
        originHeader: req.headers.origin,
        refererHeader: req.headers.referer,
        hostHeader:
          (process.env.TRUST_PROXY === 'true' ? req.headers['x-forwarded-host'] : undefined) ||
          req.headers.host,
      })
    ) {
      res.status(403).json({ error: 'Кросс-доменный запрос выхода отклонён' });
      return;
    }
    const token = extractStudioToken(req);
    const parsed = parseVerifiedAdminToken(token, { touchActivity: false });
    if (parsed?.nonce) {
      studioSessionActivityTracker.remove(parsed.nonce);
      sessionRevocationRegistry.revoke(parsed.nonce, parsed.exp);
      persistRevocations();
    }
    res.setHeader('Set-Cookie', buildSessionClearCookieHeader(isHttpsRequest(req)));
    recordSecurityAudit(
      'auth_logout',
      req,
      `Выход из кабинета студии и отзыв токена${parsed?.operatorName ? ` (${parsed.operatorName})` : ''}`
    );
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

      const normalizedIncoming = validateAndNormalizeCmsSnapshot(incoming);
      if (!normalizedIncoming.ok) {
        res.status(400).json({
          error: normalizedIncoming.error,
        });
        return;
      }

      const stamped: StudioCmsSnapshot = {
        ...normalizedIncoming.data,
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
      };

      try {
        writePersistedCmsSnapshot(stamped);
        const editorialWarnings = scanEditorialWarnings(stamped);
        recordSecurityAudit('cms_content_saved', req, `Снимок CMS обновлён (${stamped.portfolioCases.length} кейсов)`);
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

  app.post('/api/cms/reset', requireStudioAuth, (req, res) => {
    try {
      resetPersistedCmsSnapshot();
      recordSecurityAudit('cms_content_reset', req, 'Сброс контента CMS к эталонным значениям');
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

      if (!hasValidAudioMagicBytes(bodyBuffer)) {
        recordSecurityAudit(
          'upload_rejected_magic_bytes',
          req,
          'Отклонён аудиофайл без валидной сигнатуры (magic bytes)'
        );
        res.status(400).json({
          error: 'Некорректная сигнатура аудиофайла (поддерживаются WAV, MP3, OGG, FLAC, M4A)',
        });
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
          await execFileAsync('ffmpeg', ['-y', '-i', tempAbs, targetAbs]);
          fs.unlinkSync(tempAbs);
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

      const verifiedImage = detectVerifiedImageType(bodyBuffer);
      if (!verifiedImage) {
        recordSecurityAudit(
          'upload_rejected_magic_bytes',
          req,
          'Отклонён файл изображения без валидной сигнатуры JPEG/PNG/WebP/AVIF'
        );
        res.status(400).json({
          error: 'Неподдерживаемая или поддельная сигнатура изображения (разрешены JPEG, PNG, WebP, AVIF)',
        });
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
          : `cover${verifiedImage.ext}`;

      const stem = sanitizeSafeFileStem(decodedName, 'case-cover');
      const finalFileName = `${stem}-${Date.now()}${verifiedImage.ext}`;

      fs.mkdirSync(PUBLIC_CMS_MEDIA_DIR, { recursive: true });
      const targetAbs = path.join(PUBLIC_CMS_MEDIA_DIR, finalFileName);

      try {
        fs.writeFileSync(targetAbs, bodyBuffer);

        let webpUrl: string | undefined;
        try {
          const webpRes = convertRasterFileToWebp(targetAbs);
          if (webpRes.webpPath && fs.existsSync(webpRes.webpPath)) {
            webpUrl = `/assets/cms/${encodeURIComponent(path.basename(webpRes.webpPath))}`;
            if (fs.existsSync(path.join(__dirname, 'dist'))) {
              fs.mkdirSync(DIST_CMS_MEDIA_DIR, { recursive: true });
              fs.copyFileSync(
                webpRes.webpPath,
                path.join(DIST_CMS_MEDIA_DIR, path.basename(webpRes.webpPath))
              );
            }
          }
        } catch {
          // Non-fatal: fallback to original uploaded format if encoder fails
        }

        if (fs.existsSync(path.join(__dirname, 'dist'))) {
          fs.mkdirSync(DIST_CMS_MEDIA_DIR, { recursive: true });
          fs.copyFileSync(targetAbs, path.join(DIST_CMS_MEDIA_DIR, finalFileName));
        }

        res.json({
          ok: true,
          url: `/assets/cms/${encodeURIComponent(finalFileName)}`,
          webpUrl,
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
  // Core Web Vitals Monitoring Gateway (CLS, LCP, FID, INP, FCP, TTFB)
  // =========================================================================

  const MAX_WEB_VITALS_SAMPLES = 200;
  const webVitalsSamples: WebVitalReportPayload[] = [];

  app.post(
    '/api/monitoring/web-vitals',
    express.json({ limit: '4kb' }),
    (req, res) => {
      const normalized = validateWebVitalsBeaconPayload(req.body);
      if (!normalized) {
        res.status(400).json({ error: 'Некорректный формат метрики Web Vitals' });
        return;
      }

      webVitalsSamples.push(normalized);
      if (webVitalsSamples.length > MAX_WEB_VITALS_SAMPLES) {
        webVitalsSamples.splice(
          0,
          webVitalsSamples.length - MAX_WEB_VITALS_SAMPLES
        );
      }

      res.status(202).json({
        ok: true,
        recorded: {
          name: normalized.name,
          value: normalized.value,
          rating: normalized.rating,
          route: normalized.route,
        },
      });
    }
  );

  app.get('/api/cms/monitoring/web-vitals', requireStudioAuth, (_req, res) => {
    const byMetric: Record<
      string,
      { count: number; p75: number; latest: WebVitalReportPayload | null }
    > = {};

    for (const metricName of ['CLS', 'LCP', 'FID', 'INP', 'FCP', 'TTFB']) {
      const matching = webVitalsSamples.filter((s) => s.name === metricName);
      if (matching.length === 0) {
        byMetric[metricName] = { count: 0, p75: 0, latest: null };
        continue;
      }
      const sorted = matching.map((s) => s.value).sort((a, b) => a - b);
      const p75Idx = Math.min(
        sorted.length - 1,
        Math.floor(sorted.length * 0.75)
      );
      byMetric[metricName] = {
        count: matching.length,
        p75: sorted[p75Idx],
        latest: matching[matching.length - 1],
      };
    }

    res.json({
      ok: true,
      totalSamples: webVitalsSamples.length,
      summary: byMetric,
      recent: webVitalsSamples.slice(-25).reverse(),
    });
  });

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

  app.get('/api/public/counterparty-by-inn', async (req, res) => {
    const clientIp = resolveClientIp(req);
    const rate = counterpartyLookupLimiter.consume(clientIp);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSec));
      res.status(429).json({
        ok: false,
        error: `Слишком частые запросы проверки ИНН. Подождите ${rate.retryAfterSec} сек.`,
      });
      return;
    }

    const rawInn = typeof req.query.inn === 'string' ? req.query.inn.trim() : '';
    const innInfo = inspectInnDigits(rawInn);
    if (!innInfo.isCompleteLength || !innInfo.checksumValid) {
      res.status(400).json({
        ok: false,
        error:
          innInfo.statusMessage ??
          'Укажите корректный ИНН организации (10 цифр) или ИП (12 цифр)',
      });
      return;
    }

    const counterparty = await lookupCounterpartyServerSide(innInfo.digits);
    if (!counterparty) {
      res.status(404).json({
        ok: false,
        error: 'По указанному ИНН сведения не найдены',
      });
      return;
    }

    res.json({
      ok: true,
      counterparty,
    });
  });

  app.post('/api/orders/submit', express.json({ limit: '64kb' }), async (req, res) => {
    const clientIp = resolveClientIp(req);
    const body = (req.body ?? {}) as {
      source?: OrderEntrySource;
      checkoutMode?: 'air_plus_production' | 'production_only';
      paymentChannel?: 'edo_invoice' | 'card_online';
      preferredDeliveryChannel?: ClientDeliveryChannel;
      preferredDeliveryDetail?: string;
      cabinetEmail?: string;
      orderNumberCandidate?: string;
      formatLabel?: string;
      totalBudgetRub?: number;
      contactLine?: string;
      companyLine?: string;
      wantsDiadocDuplicate?: boolean;
      documentMeta?: Partial<OrderDocumentMeta> | null;
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
          `Превышен лимит отправок с одного адреса. Подождите ${preRateCheck.retryAfterSec} сек. или напишите напрямую на art@artmspektr.ru.`,
        nextChallenge: issueLeadChallenge(),
      });
      return;
    }

    if (body.pdnConsentAccepted !== true) {
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
    pruneExpiredTtlEntries(recentLeadFingerprints, now);
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
      setBoundedTtlEntry(
        consumedChallengeNonces,
        tokenState.nonce,
        now + LEAD_CHALLENGE_TTL_MS,
        MAX_CHALLENGE_NONCE_ENTRIES,
        now
      );
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
    setBoundedTtlEntry(
      recentLeadFingerprints,
      fingerprint,
      now + 10 * 60 * 1000,
      MAX_RECENT_FINGERPRINT_ENTRIES,
      now
    );
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

    // Автообогащение реквизитов покупателя (ЕГРЮЛ/ЕГРИП + BoxId Диадока) по ИНН на стороне сервера
    const parsedSubmittedCompany = parseCompanyNameAndInn(evaluation.normalizedCompany);
    const candidateInnDigits = (
      body.documentMeta?.customerInn ??
      parsedSubmittedCompany.companyInn ??
      ''
    )
      .replace(/\D/g, '')
      .slice(0, 12);

    const lookedUpCounterparty =
      candidateInnDigits.length === 10 || candidateInnDigits.length === 12
        ? await lookupCounterpartyServerSide(candidateInnDigits)
        : null;

    let enrichedCompanyOrInn = evaluation.normalizedCompany;
    if (lookedUpCounterparty) {
      const customCompanyLabel = parsedSubmittedCompany.companyName.trim();
      const chosenName =
        customCompanyLabel && !/^\d+$/.test(customCompanyLabel)
          ? customCompanyLabel
          : lookedUpCounterparty.shortName;
      enrichedCompanyOrInn = formatStructuredCompanyLine(
        chosenName,
        lookedUpCounterparty.inn
      );
    }

    const wantsDiadocFlag =
      typeof body.wantsDiadocDuplicate === 'boolean'
        ? body.wantsDiadocDuplicate
        : Boolean(body.documentMeta?.wantsDiadocDuplicate);

    const hasIncomingDocMeta =
      Boolean(lookedUpCounterparty) ||
      wantsDiadocFlag ||
      Boolean(body.documentMeta && typeof body.documentMeta === 'object');

    const initialDocumentMeta: OrderDocumentMeta | undefined = hasIncomingDocMeta
      ? sanitizeOrderDocumentMeta({
          ...(lookedUpCounterparty
            ? counterpartyToDocumentMetaPatch(lookedUpCounterparty, {
                wantsDiadocDuplicate: wantsDiadocFlag,
              })
            : {}),
          ...(body.documentMeta && typeof body.documentMeta === 'object'
            ? body.documentMeta
            : {}),
          ...(wantsDiadocFlag ? { wantsDiadocDuplicate: true } : {}),
        })
      : undefined;

    const activeClientSession = getVerifiedClientSession(req);
    const resolvedClientEmail = resolveOrderSubmissionClientEmail({
      cabinetEmail: body.cabinetEmail,
      preferredDeliveryChannel: body.preferredDeliveryChannel,
      preferredDeliveryDetail: body.preferredDeliveryDetail,
      contactLine: evaluation.normalizedContact,
      sessionEmail: activeClientSession?.email ?? null,
    });

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
      clientEmail: resolvedClientEmail,
      detectedChannel: evaluation.detectedChannel ?? 'phone',
      callbackPreference: resolvedCallbackPref,
      companyOrInn: enrichedCompanyOrInn,
      innVerified: evaluation.innVerified || Boolean(lookedUpCounterparty),
      ...(initialDocumentMeta ? { documentMeta: initialDocumentMeta } : {}),
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
      ...(() => {
        const norm = normalizeDeliveryPreferences(
          body.preferredDeliveryChannel,
          body.preferredDeliveryDetail,
          'messenger'
        );
        return {
          preferredDeliveryChannel: norm.channel,
          preferredDeliveryDetail: norm.detail,
        };
      })(),
      cloudDiskUrl: null,
      deliverables: [],
      clientUploads: [],
      compliance: {
        trafficConfirmed: false,
        fz38Checked: false,
        rightsPassportIssued: sanitizedMediaSnap?.spotReadiness === 'ready_with_passport',
        edoAndOrdRegistered: false,
      },
      mediaPlanSnapshot: sanitizedMediaSnap,
      pdnConsentAcceptedAt: body.pdnConsentAccepted === true ? nowIso : null,
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

    let autoSignedInEmail: string | null = null;
    if (resolvedClientEmail) {
      const upserted = upsertClientAccountRecord(crmStore.clientAccounts, {
        email: resolvedClientEmail,
        orderNumbersToLink: [orderNumber],
        contactLine: evaluation.normalizedContact,
        companyOrInn: enrichedCompanyOrInn,
        markLoggedIn: true,
        nowIso,
      });
      crmStore.clientAccounts = upserted.accounts;
      const issuedClientSession = issueClientSessionToken(
        resolvedClientEmail,
        getSessionSecret(),
        {
          nowMs: now,
          epoch: upserted.account.sessionEpoch ?? 1,
        }
      );
      res.setHeader(
        'Set-Cookie',
        buildClientSessionSetCookieHeader(
          issuedClientSession.token,
          CLIENT_SESSION_MAX_AGE_SEC,
          isHttpsRequest(req)
        )
      );
      autoSignedInEmail = resolvedClientEmail;
    }

    const hydratedNewOrder = ensureOrderStageHistory(
      ensureOrderApprovalWorkflow(newCrmOrder)
    );
    crmStore.orders = [hydratedNewOrder, ...crmStore.orders].slice(0, 200);
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
      innVerified: newCrmOrder.innVerified,
      companyOrInn: newCrmOrder.companyOrInn,
      documentMeta: newCrmOrder.documentMeta ?? null,
      detectedChannel: evaluation.detectedChannel,
      holdExpiresAt: holdExpiresIso,
      slaWindowStartAt: slaWindowStartIso,
      slaDeadlineAt: slaDeadlineIso,
      promisedWindowLabel: slaWindow.promisedWindowLabel,
      operatingRegime: regimeAtCreation,
      rescueToken,
      preferredDeliveryChannel: newCrmOrder.preferredDeliveryChannel,
      preferredDeliveryDetail: newCrmOrder.preferredDeliveryDetail,
      clientEmail: resolvedClientEmail,
      clientSession: autoSignedInEmail
        ? { authenticated: true, email: autoSignedInEmail }
        : { authenticated: false, email: null },
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
  // Passwordless Client Auth (Auto-Registration by Email + Magic-Link Login)
  // =========================================================================

  app.get('/api/client-auth/session', (req, res) => {
    const crmStore = readOrdersCrmStore();
    const legalProfiles = sanitizeStudioLegalProfilesConfig(crmStore.legalProfiles);
    const session = getVerifiedClientSession(req);
    if (!session) {
      res.json({
        ok: true,
        authenticated: false,
        account: null,
        orders: [],
        legalProfiles,
      });
      return;
    }

    const existingAccount = crmStore.clientAccounts.find(
      (a) => a.email === session.email
    );
    const matchedOrders = collectOrdersForClientEmail(
      crmStore.orders,
      session.email,
      existingAccount
    );

    let activeAccount = existingAccount;
    if (!activeAccount) {
      const upserted = upsertClientAccountRecord(crmStore.clientAccounts, {
        email: session.email,
        orderNumbersToLink: matchedOrders.map((o) => o.orderNumber),
        contactLine: matchedOrders[0]?.contact ?? '',
        companyOrInn: matchedOrders[0]?.companyOrInn ?? '',
        markLoggedIn: false,
      });
      crmStore.clientAccounts = upserted.accounts;
      activeAccount = upserted.account;
      writeOrdersCrmStore(crmStore);
    }

    const summaries = matchedOrders.map((ord) =>
      toClientCabinetOrderSummary(
        ord,
        issueOrderRescueToken(ord.orderNumber),
        legalProfiles
      )
    );

    res.json({
      ok: true,
      authenticated: true,
      account: toClientAccountPublicProfile(activeAccount, summaries.length),
      orders: summaries,
      legalProfiles,
    });
  });

  app.post(
    '/api/client-auth/request-magic-link',
    express.json({ limit: '16kb' }),
    async (req, res) => {
      if (isBlockedCrossOriginMutation(req)) {
        res.status(403).json({
          ok: false,
          error: 'Кросс-доменный запрос отклонён политикой безопасности',
        });
        return;
      }

      const clientIp = resolveClientIp(req);
      const ipRate = clientMagicLinkIpLimiter.consume(clientIp);
      if (!ipRate.allowed) {
        res.setHeader('Retry-After', String(ipRate.retryAfterSec));
        res.status(429).json({
          ok: false,
          error: `Слишком много запросов ссылки входа. Подождите ${ipRate.retryAfterSec} сек.`,
        });
        return;
      }

      const body = (req.body ?? {}) as {
        email?: string;
        mode?: 'login' | 'reset';
        revokeOtherSessions?: boolean;
        pdnConsentAccepted?: boolean;
      };
      const email = normalizeClientEmail(body.email);
      if (!email) {
        res.status(400).json({
          ok: false,
          error: 'Укажите корректный адрес электронной почты (например, name@company.ru)',
        });
        return;
      }

      const activeSession = getVerifiedClientSession(req);
      const isAlreadyAuthenticatedForEmail = activeSession?.email === email;
      if (!isAlreadyAuthenticatedForEmail && body.pdnConsentAccepted !== true) {
        res.status(400).json({
          ok: false,
          error:
            'Для отправки ссылки подтвердите согласие на обработку персональных данных (ст. 9 Федерального закона № 152-ФЗ).',
        });
        return;
      }

      const emailRate = clientMagicLinkEmailLimiter.consume(email);
      if (!emailRate.allowed) {
        res.setHeader('Retry-After', String(emailRate.retryAfterSec));
        res.status(429).json({
          ok: false,
          error: `Ссылка на этот адрес уже запрашивалась недавно. Подождите ${emailRate.retryAfterSec} сек.`,
        });
        return;
      }

      const isResetMode = body.mode === 'reset';
      const revokeOtherSessions =
        typeof body.revokeOtherSessions === 'boolean'
          ? body.revokeOtherSessions
          : isResetMode;

      // Автоматически создаём профиль клиента по почте, если он входит впервые
      const crmStore = readOrdersCrmStore();
      const existingAccount = crmStore.clientAccounts.find((a) => a.email === email);
      const isNewRegistration = !existingAccount;
      const matchedOrders = collectOrdersForClientEmail(
        crmStore.orders,
        email,
        existingAccount
      );
      const upserted = upsertClientAccountRecord(crmStore.clientAccounts, {
        email,
        orderNumbersToLink: matchedOrders.map((o) => o.orderNumber),
        contactLine: matchedOrders[0]?.contact ?? '',
        companyOrInn: matchedOrders[0]?.companyOrInn ?? '',
        markLoggedIn: false,
      });
      crmStore.clientAccounts = upserted.accounts;
      writeOrdersCrmStore(crmStore);

      const magic = issueClientMagicLinkToken(email, getSessionSecret(), {
        revokeSessions: revokeOtherSessions,
      });
      const publicOrigin = resolveSafePublicOrigin({
        configuredOrigin: process.env.APP_URL,
        hostHeader: req.headers.host,
        forwardedHost: req.headers['x-forwarded-host'],
        protocol: req.protocol,
        forwardedProto: req.headers['x-forwarded-proto'],
        trustProxy: process.env.TRUST_PROXY === 'true',
        fallbackOrigin: `http://localhost:${PORT}`,
      });
      const baseRoutePath = isResetMode ? '/cabinet/reset' : '/cabinet';
      const magicLinkPath = `${baseRoutePath}?magic=${encodeURIComponent(magic.token)}`;
      const magicLinkUrl = `${publicOrigin}${magicLinkPath}`;

      const configuredGatewayUrl = process.env.MAGIC_LINK_WEBHOOK_URL?.trim() || '';
      let gatewayFailed = false;
      if (configuredGatewayUrl) {
        const targetCheck = validateOutboundWebhookTarget(configuredGatewayUrl, {
          allowInternalLoopbackSink: false,
          localPort: PORT,
        });
        const rfSafety = evaluateWebhookEndpointRfSafety(configuredGatewayUrl);
        if (
          targetCheck.ok &&
          rfSafety.isValidUrl &&
          !rfSafety.isBannedForeignService
        ) {
          try {
            const mailRes = await fetch(configuredGatewayUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: isResetMode ? 'client.magic_reset' : 'client.magic_link',
                to: email,
                subject: isResetMode
                  ? 'Сброс и восстановление доступа в личный кабинет FMWorks'
                  : 'Вход в личный кабинет заказов FMWorks (без пароля)',
                magicLinkUrl,
                revokeOtherSessions,
                expiresInMinutes: 30,
              }),
              signal: AbortSignal.timeout(5000),
            });
            if (mailRes.ok) {
              res.json({
                ok: true,
                email,
                intent: isResetMode ? 'reset' : 'login',
                revokeOtherSessions,
                isNewRegistration,
                deliveryMode: 'email_gateway',
                expiresAt: new Date(magic.expiresAt).toISOString(),
              });
              return;
            }
            gatewayFailed = true;
          } catch {
            gatewayFailed = true;
          }
        } else {
          gatewayFailed = true;
        }
      }

      const allowLocalPreview = canExposeMagicLinkLocalPreview({
        nodeEnv: process.env.NODE_ENV,
        email,
        hasConfiguredGateway: Boolean(configuredGatewayUrl),
        gatewayFailed,
        allowPreviewMagicLinks: process.env.ALLOW_PREVIEW_MAGIC_LINKS === 'true',
      });

      if (!allowLocalPreview) {
        res.status(503).json({
          ok: false,
          error: configuredGatewayUrl
            ? 'Почтовый сервис временно недоступен. Повторите отправку ссылки через минуту или войдите по номеру заказа.'
            : 'Отправка писем для этого адреса на сервере ещё не подключена. Воспользуйтесь входом по номеру заказа.',
        });
        return;
      }

      res.json({
        ok: true,
        email,
        intent: isResetMode ? 'reset' : 'login',
        revokeOtherSessions,
        isNewRegistration,
        deliveryMode: 'local_preview',
        magicLinkPath,
        magicLinkUrl,
        expiresAt: new Date(magic.expiresAt).toISOString(),
      });
    }
  );

  app.post(
    '/api/client-auth/verify-magic-link',
    express.json({ limit: '32kb' }),
    (req, res) => {
      if (isBlockedCrossOriginMutation(req)) {
        res.status(403).json({
          ok: false,
          error: 'Кросс-доменный запрос входа отклонён политикой безопасности',
        });
        return;
      }

      const body = (req.body ?? {}) as {
        token?: string;
        revokeOtherSessions?: boolean;
        localItems?: Array<{ orderNumber?: string; rescueToken?: string }>;
      };

      const check = verifyClientMagicLinkToken(body.token, getSessionSecret(), {
        isNonceConsumed: (nonce) => consumedMagicLinkRegistry.isRevoked(nonce),
      });

      if (!check.ok) {
        const errorText =
          check.reason === 'already_used'
            ? 'Эта одноразовая ссылка уже была использована. Запросите новую ссылку для входа.'
            : check.reason === 'expired'
              ? 'Срок действия ссылки истёк (30 минут). Запросите свежую ссылку.'
              : 'Ссылка для входа недействительна или повреждена.';
        res.status(400).json({
          ok: false,
          reason: check.reason,
          error: errorText,
        });
        return;
      }

      // Сразу погашаем одноразовый nonce
      consumedMagicLinkRegistry.revoke(check.payload.nonce, check.payload.exp);
      persistClientAuthNonces();

      const email = check.payload.email;
      const shouldRotateSessions = Boolean(
        check.payload.revokeSessions || body.revokeOtherSessions
      );
      const crmStore = readOrdersCrmStore();
      const legalProfiles = sanitizeStudioLegalProfilesConfig(crmStore.legalProfiles);
      const nowIso = new Date().toISOString();

      // Если на этом устройстве были локальные заказы с валидным rescueToken без почты — склеиваем их с профилем
      const verifiedDeviceOrders: string[] = [];
      const rawLocalItems = Array.isArray(body.localItems)
        ? body.localItems.slice(0, 30)
        : [];
      for (const item of rawLocalItems) {
        const ordNum =
          typeof item?.orderNumber === 'string' ? item.orderNumber.trim() : '';
        const tok =
          typeof item?.rescueToken === 'string' ? item.rescueToken.trim() : '';
        if (!ordNum || !tok || !verifyOrderRescueToken(ordNum, tok)) continue;
        const ordIdx = crmStore.orders.findIndex(
          (o) => o.orderNumber === ordNum && !o.pdnAnonymizedAt
        );
        if (ordIdx >= 0) {
          verifiedDeviceOrders.push(ordNum);
          if (!crmStore.orders[ordIdx].clientEmail) {
            crmStore.orders[ordIdx] = {
              ...crmStore.orders[ordIdx],
              clientEmail: email,
              updatedAt: nowIso,
            };
          }
        }
      }

      const preMatched = collectOrdersForClientEmail(
        crmStore.orders,
        email,
        crmStore.clientAccounts.find((a) => a.email === email)
      );
      const allOrderNums = Array.from(
        new Set([...verifiedDeviceOrders, ...preMatched.map((o) => o.orderNumber)])
      );

      const upserted = upsertClientAccountRecord(crmStore.clientAccounts, {
        email,
        orderNumbersToLink: allOrderNums,
        contactLine: preMatched[0]?.contact ?? '',
        companyOrInn: preMatched[0]?.companyOrInn ?? '',
        markLoggedIn: true,
        rotateSessionEpoch: shouldRotateSessions,
        nowIso,
      });
      crmStore.clientAccounts = upserted.accounts;
      writeOrdersCrmStore(crmStore);

      const matchedOrders = collectOrdersForClientEmail(
        crmStore.orders,
        email,
        upserted.account
      );

      const sessionToken = issueClientSessionToken(email, getSessionSecret(), {
        epoch: upserted.account.sessionEpoch ?? 1,
      });
      res.setHeader(
        'Set-Cookie',
        buildClientSessionSetCookieHeader(
          sessionToken.token,
          CLIENT_SESSION_MAX_AGE_SEC,
          isHttpsRequest(req)
        )
      );

      const summaries = matchedOrders.map((ord) =>
        toClientCabinetOrderSummary(
          ord,
          issueOrderRescueToken(ord.orderNumber),
          legalProfiles
        )
      );

      res.json({
        ok: true,
        authenticated: true,
        sessionsReset: shouldRotateSessions,
        account: toClientAccountPublicProfile(upserted.account, summaries.length),
        orders: summaries,
        legalProfiles,
      });
    }
  );

  app.post(
    '/api/client-auth/bind-email',
    express.json({ limit: '32kb' }),
    async (req, res) => {
      if (isBlockedCrossOriginMutation(req)) {
        res.status(403).json({
          ok: false,
          error: 'Кросс-доменный запрос отклонён политикой безопасности',
        });
        return;
      }

      const clientIp = resolveClientIp(req);
      const ipRate = clientMagicLinkIpLimiter.consume(clientIp);
      if (!ipRate.allowed) {
        res.setHeader('Retry-After', String(ipRate.retryAfterSec));
        res.status(429).json({
          ok: false,
          error: `Слишком много запросов привязки почты. Подождите ${ipRate.retryAfterSec} сек.`,
        });
        return;
      }

      const body = (req.body ?? {}) as {
        email?: string;
        orderNumber?: string;
        rescueToken?: string;
        pdnConsentAccepted?: boolean;
        items?: Array<{ orderNumber?: string; rescueToken?: string }>;
      };

      const email = normalizeClientEmail(body.email);
      if (!email) {
        res.status(400).json({
          ok: false,
          error: 'Укажите корректный адрес электронной почты (например, name@company.ru)',
        });
        return;
      }

      const candidateItems: Array<{ orderNumber?: string; rescueToken?: string }> = [];
      if (body.orderNumber && body.rescueToken) {
        candidateItems.push({
          orderNumber: body.orderNumber,
          rescueToken: body.rescueToken,
        });
      }
      if (Array.isArray(body.items)) {
        candidateItems.push(...body.items.slice(0, 30));
      }

      const crmStore = readOrdersCrmStore();
      const legalProfiles = sanitizeStudioLegalProfilesConfig(crmStore.legalProfiles);
      const nowIso = new Date().toISOString();
      const verifiedOrderIndices: number[] = [];

      for (const item of candidateItems) {
        const ordNum =
          typeof item?.orderNumber === 'string' ? item.orderNumber.trim() : '';
        const tok =
          typeof item?.rescueToken === 'string' ? item.rescueToken.trim() : '';
        if (!ordNum || !tok || !verifyOrderRescueToken(ordNum, tok)) continue;
        const idx = crmStore.orders.findIndex(
          (o) => o.orderNumber === ordNum && !o.pdnAnonymizedAt
        );
        if (idx >= 0 && !verifiedOrderIndices.includes(idx)) {
          verifiedOrderIndices.push(idx);
        }
      }

      if (verifiedOrderIndices.length === 0) {
        res.status(403).json({
          ok: false,
          error: 'Не удалось подтвердить ключ доступа к заказу для привязки почты',
        });
        return;
      }

      const activeSession = getVerifiedClientSession(req);
      const allowDirectBind = canDirectBindOrdersToEmailSession({
        verifiedSessionEmail: activeSession?.email ?? null,
        targetEmail: email,
      });

      if (!allowDirectBind && body.pdnConsentAccepted !== true) {
        res.status(400).json({
          ok: false,
          error:
            'Для привязки почты подтвердите согласие на обработку персональных данных (ст. 9 Федерального закона № 152-ФЗ).',
        });
        return;
      }

      // Защита P0: если владение e-mail ещё не подтверждено активной сессией —
      // НЕ выдаём чужую сессию, а отправляем одноразовую ссылку подтверждения (при переходе verify-magic-link склеит localItems).
      if (!allowDirectBind) {
        const emailRate = clientMagicLinkEmailLimiter.consume(email);
        if (!emailRate.allowed) {
          res.setHeader('Retry-After', String(emailRate.retryAfterSec));
          res.status(429).json({
            ok: false,
            error: `Ссылка подтверждения на этот адрес уже запрашивалась недавно. Подождите ${emailRate.retryAfterSec} сек.`,
          });
          return;
        }

        const magic = issueClientMagicLinkToken(email, getSessionSecret(), {
          revokeSessions: false,
        });
        const publicOrigin = resolveSafePublicOrigin({
          configuredOrigin: process.env.APP_URL,
          hostHeader: req.headers.host,
          forwardedHost: req.headers['x-forwarded-host'],
          protocol: req.protocol,
          forwardedProto: req.headers['x-forwarded-proto'],
          trustProxy: process.env.TRUST_PROXY === 'true',
          fallbackOrigin: `http://localhost:${PORT}`,
        });
        const magicLinkPath = `/cabinet?magic=${encodeURIComponent(magic.token)}`;
        const magicLinkUrl = `${publicOrigin}${magicLinkPath}`;

        const configuredGatewayUrl = process.env.MAGIC_LINK_WEBHOOK_URL?.trim() || '';
        let gatewayFailed = false;
        if (configuredGatewayUrl) {
          const targetCheck = validateOutboundWebhookTarget(configuredGatewayUrl, {
            allowInternalLoopbackSink: false,
            localPort: PORT,
          });
          const rfSafety = evaluateWebhookEndpointRfSafety(configuredGatewayUrl);
          if (
            targetCheck.ok &&
            rfSafety.isValidUrl &&
            !rfSafety.isBannedForeignService
          ) {
            try {
              const mailRes = await fetch(configuredGatewayUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  event: 'client.bind_email_confirm',
                  to: email,
                  subject: 'Подтверждение почты и привязка заказов в кабинете FMWorks',
                  magicLinkUrl,
                  revokeOtherSessions: false,
                  expiresInMinutes: 30,
                }),
                signal: AbortSignal.timeout(5000),
              });
              if (mailRes.ok) {
                res.json({
                  ok: true,
                  authenticated: false,
                  verificationRequired: true,
                  email,
                  deliveryMode: 'email_gateway',
                  expiresAt: new Date(magic.expiresAt).toISOString(),
                });
                return;
              }
              gatewayFailed = true;
            } catch {
              gatewayFailed = true;
            }
          } else {
            gatewayFailed = true;
          }
        }

        const allowLocalPreview = canExposeMagicLinkLocalPreview({
          nodeEnv: process.env.NODE_ENV,
          email,
          hasConfiguredGateway: Boolean(configuredGatewayUrl),
          gatewayFailed,
          allowPreviewMagicLinks: process.env.ALLOW_PREVIEW_MAGIC_LINKS === 'true',
        });

        if (!allowLocalPreview) {
          res.status(503).json({
            ok: false,
            error:
              'Не удалось отправить письмо подтверждения привязки почты. Попробуйте позже.',
          });
          return;
        }

        res.json({
          ok: true,
          authenticated: false,
          verificationRequired: true,
          email,
          deliveryMode: 'local_preview',
          magicLinkPath,
          magicLinkUrl,
          expiresAt: new Date(magic.expiresAt).toISOString(),
        });
        return;
      }

      const boundNumbers: string[] = [];
      let primaryContact = '';
      let primaryCompany = '';

      for (const idx of verifiedOrderIndices) {
        crmStore.orders[idx] = {
          ...crmStore.orders[idx],
          clientEmail: email,
          updatedAt: nowIso,
        };
        boundNumbers.push(crmStore.orders[idx].orderNumber);
        if (!primaryContact) primaryContact = crmStore.orders[idx].contact;
        if (!primaryCompany) primaryCompany = crmStore.orders[idx].companyOrInn;
      }

      const upserted = upsertClientAccountRecord(crmStore.clientAccounts, {
        email,
        orderNumbersToLink: boundNumbers,
        contactLine: primaryContact,
        companyOrInn: primaryCompany,
        markLoggedIn: true,
        nowIso,
      });
      crmStore.clientAccounts = upserted.accounts;
      writeOrdersCrmStore(crmStore);

      const matchedOrders = collectOrdersForClientEmail(
        crmStore.orders,
        email,
        upserted.account
      );

      const summaries = matchedOrders.map((ord) =>
        toClientCabinetOrderSummary(
          ord,
          issueOrderRescueToken(ord.orderNumber),
          legalProfiles
        )
      );

      res.json({
        ok: true,
        authenticated: true,
        account: toClientAccountPublicProfile(upserted.account, summaries.length),
        orders: summaries,
        legalProfiles,
      });
    }
  );

  app.post('/api/client-auth/logout', (req, res) => {
    if (isBlockedCrossOriginMutation(req)) {
      res.status(403).json({ ok: false, error: 'Кросс-доменный запрос выхода отклонён' });
      return;
    }
    const session = getVerifiedClientSession(req);
    if (session?.nonce) {
      clientSessionRevocationRegistry.revoke(session.nonce, session.exp);
      persistClientAuthNonces();
    }
    res.setHeader('Set-Cookie', buildClientSessionClearCookieHeader(isHttpsRequest(req)));
    res.json({ ok: true });
  });

  const removePreviousClientAvatarFile = (previousAvatarUrl: string | null | undefined) => {
    if (!previousAvatarUrl || !previousAvatarUrl.startsWith('/assets/cms/client-avatar-')) {
      return;
    }
    const baseName = path.basename(decodeURIComponent(previousAvatarUrl));
    if (!baseName.startsWith('client-avatar-') || baseName.includes('..')) {
      return;
    }
    const candidates = [
      path.join(PUBLIC_CMS_MEDIA_DIR, baseName),
      path.join(PUBLIC_CMS_MEDIA_DIR, baseName.replace(/\.(jpe?g|png|avif)$/i, '.webp')),
      path.join(DIST_CMS_MEDIA_DIR, baseName),
      path.join(DIST_CMS_MEDIA_DIR, baseName.replace(/\.(jpe?g|png|avif)$/i, '.webp')),
    ];
    for (const candidate of candidates) {
      try {
        if (fs.existsSync(candidate)) {
          fs.unlinkSync(candidate);
        }
      } catch {
        // Non-fatal cleanup
      }
    }
  };

  app.put(
    '/api/client-auth/avatar',
    express.json({ limit: '6mb' }),
    (req, res) => {
      if (isBlockedCrossOriginMutation(req)) {
        res.status(403).json({
          ok: false,
          error: 'Кросс-доменный запрос изменения профиля отклонён',
        });
        return;
      }

      const session = getVerifiedClientSession(req);
      if (!session) {
        res.status(401).json({
          ok: false,
          error: 'Войдите в личный кабинет по почте, чтобы сохранить фото в профиле',
        });
        return;
      }

      const body = (req.body ?? {}) as {
        dataBase64?: unknown;
        avatarPresetId?: unknown;
        clearPhoto?: unknown;
      };

      const crmStore = readOrdersCrmStore();
      const existingAccount = crmStore.clientAccounts.find(
        (a) => a.email === session.email
      );

      let nextAvatarUrl: string | null | undefined = undefined;
      let nextAvatarPresetId: string | null | undefined = undefined;

      if (body.avatarPresetId !== undefined) {
        if (body.avatarPresetId === null || body.avatarPresetId === '') {
          nextAvatarPresetId = null;
        } else {
          const validPreset = sanitizeClientAvatarPresetId(body.avatarPresetId);
          if (!validPreset) {
            res.status(400).json({
              ok: false,
              error: 'Неизвестный стиль абстрактного аватара',
            });
            return;
          }
          nextAvatarPresetId = validPreset;
        }
      }

      if (body.clearPhoto === true) {
        removePreviousClientAvatarFile(existingAccount?.avatarUrl);
        nextAvatarUrl = null;
      } else if (typeof body.dataBase64 === 'string' && body.dataBase64.trim()) {
        const rawB64 = body.dataBase64.trim();
        const commaIdx = rawB64.indexOf(',');
        const cleanB64 = commaIdx >= 0 ? rawB64.slice(commaIdx + 1) : rawB64;
        const imgBuffer = Buffer.from(cleanB64, 'base64');

        if (imgBuffer.length < 64 || imgBuffer.length > 4 * 1024 * 1024) {
          res.status(400).json({
            ok: false,
            error: 'Выберите изображение размером до 4 МБ (JPEG, PNG или WebP)',
          });
          return;
        }

        const verifiedImage = detectVerifiedImageType(imgBuffer);
        if (!verifiedImage) {
          recordSecurityAudit(
            'upload_rejected_magic_bytes',
            req,
            'Отклонено фото профиля клиента без валидной сигнатуры JPEG/PNG/WebP/AVIF'
          );
          res.status(400).json({
            ok: false,
            error: 'Поддерживаются только изображения JPEG, PNG, WebP или AVIF',
          });
          return;
        }

        const emailHash = crypto
          .createHash('sha256')
          .update(session.email, 'utf8')
          .digest('hex')
          .slice(0, 10);
        const finalFileName = `client-avatar-${emailHash}-${Date.now()}${verifiedImage.ext}`;

        try {
          fs.mkdirSync(PUBLIC_CMS_MEDIA_DIR, { recursive: true });
          const targetAbs = path.join(PUBLIC_CMS_MEDIA_DIR, finalFileName);
          fs.writeFileSync(targetAbs, imgBuffer);

          try {
            const webpRes = convertRasterFileToWebp(targetAbs);
            if (
              webpRes.webpPath &&
              fs.existsSync(webpRes.webpPath) &&
              fs.existsSync(path.join(__dirname, 'dist'))
            ) {
              fs.mkdirSync(DIST_CMS_MEDIA_DIR, { recursive: true });
              fs.copyFileSync(
                webpRes.webpPath,
                path.join(DIST_CMS_MEDIA_DIR, path.basename(webpRes.webpPath))
              );
            }
          } catch {
            // Non-fatal WebP optimization
          }

          if (fs.existsSync(path.join(__dirname, 'dist'))) {
            fs.mkdirSync(DIST_CMS_MEDIA_DIR, { recursive: true });
            fs.copyFileSync(targetAbs, path.join(DIST_CMS_MEDIA_DIR, finalFileName));
          }

          removePreviousClientAvatarFile(existingAccount?.avatarUrl);
          nextAvatarUrl = `/assets/cms/${encodeURIComponent(finalFileName)}`;
        } catch (err) {
          res.status(500).json({
            ok: false,
            error:
              err instanceof Error
                ? err.message
                : 'Не удалось сохранить фото профиля',
          });
          return;
        }
      }

      const matchedOrders = collectOrdersForClientEmail(
        crmStore.orders,
        session.email,
        existingAccount
      );
      const upserted = upsertClientAccountRecord(crmStore.clientAccounts, {
        email: session.email,
        orderNumbersToLink: matchedOrders.map((o) => o.orderNumber),
        contactLine: existingAccount ? undefined : matchedOrders[0]?.contact ?? '',
        companyOrInn: existingAccount
          ? undefined
          : matchedOrders[0]?.companyOrInn ?? '',
        ...(nextAvatarUrl !== undefined ? { avatarUrl: nextAvatarUrl } : {}),
        ...(nextAvatarPresetId !== undefined
          ? { avatarPresetId: nextAvatarPresetId }
          : {}),
      });

      crmStore.clientAccounts = upserted.accounts;
      writeOrdersCrmStore(crmStore);

      res.json({
        ok: true,
        account: toClientAccountPublicProfile(upserted.account, matchedOrders.length),
      });
    }
  );

  app.delete('/api/client-auth/avatar', (req, res) => {
    if (isBlockedCrossOriginMutation(req)) {
      res.status(403).json({
        ok: false,
        error: 'Кросс-доменный запрос удаления фото отклонён',
      });
      return;
    }

    const session = getVerifiedClientSession(req);
    if (!session) {
      res.status(401).json({
        ok: false,
        error: 'Сессия клиента не активна',
      });
      return;
    }

    const crmStore = readOrdersCrmStore();
    const existingAccount = crmStore.clientAccounts.find(
      (a) => a.email === session.email
    );
    removePreviousClientAvatarFile(existingAccount?.avatarUrl);

    const matchedOrders = collectOrdersForClientEmail(
      crmStore.orders,
      session.email,
      existingAccount
    );
    const upserted = upsertClientAccountRecord(crmStore.clientAccounts, {
      email: session.email,
      avatarUrl: null,
    });

    crmStore.clientAccounts = upserted.accounts;
    writeOrdersCrmStore(crmStore);

    res.json({
      ok: true,
      account: toClientAccountPublicProfile(upserted.account, matchedOrders.length),
    });
  });

  // =========================================================================
  // Personal Client Cabinet Endpoints (Lookup, Batch Status, Preferences & Files)
  // =========================================================================

  app.post(
    '/api/client-cabinet/lookup',
    express.json({ limit: '32kb' }),
    (req, res) => {
      const clientIp = resolveClientIp(req);
      const rate = clientCabinetLookupLimiter.consume(clientIp);
      if (!rate.allowed) {
        res.setHeader('Retry-After', String(rate.retryAfterSec));
        res.status(429).json({
          ok: false,
          error: `Слишком много попыток поиска заказа. Подождите ${rate.retryAfterSec} сек.`,
        });
        return;
      }

      const body = (req.body ?? {}) as {
        orderNumber?: string;
        verifier?: string;
      };
      const orderNumber =
        typeof body.orderNumber === 'string'
          ? body.orderNumber.trim().toUpperCase()
          : '';
      const verifier =
        typeof body.verifier === 'string' ? body.verifier.trim() : '';

      if (!/^FM-[A-Z0-9-]{2,20}$/.test(orderNumber)) {
        res.status(400).json({
          ok: false,
          error: 'Укажите номер заказа в формате FM-2510 или FM-HOLD-2854',
        });
        return;
      }
      if (verifier.length < 4) {
        res.status(400).json({
          ok: false,
          error:
            'Для проверки доступа укажите последние 4 цифры телефона, @Telegram или ИНН компании',
        });
        return;
      }

      const crmStore = readOrdersCrmStore();
      const found = crmStore.orders.find(
        (o) => o.orderNumber.toUpperCase() === orderNumber && !o.pdnAnonymizedAt
      );

      if (
        !found ||
        !matchesOrderLookupVerifier(found.contact, found.companyOrInn, verifier)
      ) {
        res.status(404).json({
          ok: false,
          error:
            'Заказ не найден или проверочные данные (телефон / ИНН / @Telegram) не совпали',
        });
        return;
      }

      const rescueToken = issueOrderRescueToken(found.orderNumber);
      res.json({
        ok: true,
        orderNumber: found.orderNumber,
        rescueToken,
        order: toClientCabinetOrderSummary(
          found,
          rescueToken,
          sanitizeStudioLegalProfilesConfig(crmStore.legalProfiles)
        ),
      });
    }
  );

  app.post(
    '/api/client-cabinet/batch-status',
    express.json({ limit: '64kb' }),
    (req, res) => {
      const body = (req.body ?? {}) as {
        items?: Array<{ orderNumber?: string; rescueToken?: string }>;
      };
      const rawItems = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
      const crmStore = readOrdersCrmStore();
      const legalProfiles = sanitizeStudioLegalProfilesConfig(crmStore.legalProfiles);
      const orders: ClientCabinetOrderSummary[] = [];

      for (const entry of rawItems) {
        const ordNum =
          typeof entry?.orderNumber === 'string' ? entry.orderNumber.trim() : '';
        const token =
          typeof entry?.rescueToken === 'string' ? entry.rescueToken.trim() : '';
        if (!ordNum || !token || !verifyOrderRescueToken(ordNum, token)) {
          continue;
        }
        const found = crmStore.orders.find(
          (o) => o.orderNumber === ordNum && !o.pdnAnonymizedAt
        );
        if (found) {
          orders.push(toClientCabinetOrderSummary(found, token, legalProfiles));
        }
      }

      res.json({
        ok: true,
        orders,
        legalProfiles,
      });
    }
  );

  // =========================================================================
  // Client Cabinet Real-Time Push Notifications & SSE Stream
  // =========================================================================

  app.get('/api/client-cabinet/notifications/stream', (req, res) => {
    const crmStore = readOrdersCrmStore();
    const inlineTokens = parseInlineOrderRescueTokensParam(req.query.tokens);
    const scope = resolveClientAccessibleNotificationScope(
      req,
      inlineTokens,
      crmStore
    );

    if (!scope.subjectKey) {
      res.status(401).json({
        ok: false,
        error: 'Требуется вход в личный кабинет или ключ доступа к заказу',
      });
      return;
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const initialItems = filterNotificationsForAccessibleOrders({
      allNotifications: crmStore.clientNotifications,
      accessibleOrderNumbers: scope.accessibleOrderNumbers,
      preferences: scope.preferences,
    });

    const clientId = `cab-sse-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const heartbeatTimer = setInterval(() => {
      try {
        res.write(`: heartbeat ${Date.now()}\n\n`);
      } catch {
        clearInterval(heartbeatTimer);
        cabinetNotificationSseClients.delete(clientId);
      }
    }, 20_000);
    if (typeof heartbeatTimer.unref === 'function') {
      heartbeatTimer.unref();
    }

    evictExcessSseClients(
      cabinetNotificationSseClients,
      MAX_CONCURRENT_CABINET_SSE_CLIENTS
    );
    cabinetNotificationSseClients.set(clientId, {
      id: clientId,
      res,
      sessionEmail: scope.sessionEmail,
      verifiedRescueOrderNumbers: scope.verifiedRescueOrderNumbers,
      heartbeatTimer,
    });

    res.write(
      `event: connected\ndata: ${JSON.stringify({
        ok: true,
        unreadCount: countUnreadNotifications(initialItems),
        serverTime: new Date().toISOString(),
      })}\n\n`
    );

    req.on('close', () => {
      clearInterval(heartbeatTimer);
      cabinetNotificationSseClients.delete(clientId);
    });
  });

  app.post(
    '/api/client-cabinet/notifications/query',
    express.json({ limit: '64kb' }),
    (req, res) => {
      const body = (req.body ?? {}) as {
        items?: Array<{ orderNumber?: string; rescueToken?: string }>;
      };
      const crmStore = readOrdersCrmStore();
      const scope = resolveClientAccessibleNotificationScope(
        req,
        body.items,
        crmStore
      );

      if (!scope.subjectKey || scope.accessibleOrderNumbers.length === 0) {
        res.json({
          ok: true,
          notifications: [],
          preferences: scope.preferences,
          unreadCount: 0,
        });
        return;
      }

      const notifications = filterNotificationsForAccessibleOrders({
        allNotifications: crmStore.clientNotifications,
        accessibleOrderNumbers: scope.accessibleOrderNumbers,
        preferences: scope.preferences,
      });

      res.json({
        ok: true,
        notifications,
        preferences: scope.preferences,
        unreadCount: countUnreadNotifications(notifications),
      });
    }
  );

  app.put(
    '/api/client-cabinet/notifications/preferences',
    express.json({ limit: '32kb' }),
    (req, res) => {
      if (isBlockedCrossOriginMutation(req)) {
        res.status(403).json({
          ok: false,
          error: 'Кросс-доменный запрос отклонён политикой безопасности',
        });
        return;
      }

      const body = (req.body ?? {}) as {
        items?: Array<{ orderNumber?: string; rescueToken?: string }>;
        browserPushEnabled?: boolean;
        notifyOnStageChange?: boolean;
        notifyOnNewVersion?: boolean;
        pushEndpoint?: string | null;
      };

      const crmStore = readOrdersCrmStore();
      const scope = resolveClientAccessibleNotificationScope(
        req,
        body.items,
        crmStore
      );

      if (!scope.subjectKey) {
        res.status(401).json({
          ok: false,
          error: 'Требуется активный заказ или вход в кабинет для сохранения настроек',
        });
        return;
      }

      const nextPrefs = sanitizeClientNotificationPreferences(
        {
          ...scope.preferences,
          subjectKey: scope.subjectKey,
          browserPushEnabled:
            typeof body.browserPushEnabled === 'boolean'
              ? body.browserPushEnabled
              : scope.preferences.browserPushEnabled,
          notifyOnStageChange:
            typeof body.notifyOnStageChange === 'boolean'
              ? body.notifyOnStageChange
              : scope.preferences.notifyOnStageChange,
          notifyOnNewVersion:
            typeof body.notifyOnNewVersion === 'boolean'
              ? body.notifyOnNewVersion
              : scope.preferences.notifyOnNewVersion,
          pushEndpoint:
            body.pushEndpoint !== undefined
              ? body.pushEndpoint
              : scope.preferences.pushEndpoint,
          updatedAt: new Date().toISOString(),
        },
        scope.subjectKey
      );

      crmStore.clientNotificationPrefs[scope.subjectKey] = nextPrefs;
      writeOrdersCrmStore(crmStore);

      const notifications = filterNotificationsForAccessibleOrders({
        allNotifications: crmStore.clientNotifications,
        accessibleOrderNumbers: scope.accessibleOrderNumbers,
        preferences: nextPrefs,
      });

      res.json({
        ok: true,
        preferences: nextPrefs,
        notifications,
        unreadCount: countUnreadNotifications(notifications),
      });
    }
  );

  app.post(
    '/api/client-cabinet/notifications/mark-read',
    express.json({ limit: '32kb' }),
    (req, res) => {
      if (isBlockedCrossOriginMutation(req)) {
        res.status(403).json({
          ok: false,
          error: 'Кросс-доменный запрос отклонён политикой безопасности',
        });
        return;
      }

      const body = (req.body ?? {}) as {
        items?: Array<{ orderNumber?: string; rescueToken?: string }>;
        notificationIds?: string[];
        markAll?: boolean;
      };

      const crmStore = readOrdersCrmStore();
      const scope = resolveClientAccessibleNotificationScope(
        req,
        body.items,
        crmStore
      );

      if (!scope.subjectKey) {
        res.status(401).json({
          ok: false,
          error: 'Требуется активный заказ или вход в кабинет',
        });
        return;
      }

      const nextPrefs = markNotificationsReadInPreferences(scope.preferences, {
        notificationIds: Array.isArray(body.notificationIds)
          ? body.notificationIds.slice(0, 100)
          : [],
        markAll: Boolean(body.markAll),
      });

      crmStore.clientNotificationPrefs[scope.subjectKey] = nextPrefs;
      writeOrdersCrmStore(crmStore);

      const notifications = filterNotificationsForAccessibleOrders({
        allNotifications: crmStore.clientNotifications,
        accessibleOrderNumbers: scope.accessibleOrderNumbers,
        preferences: nextPrefs,
      });

      res.json({
        ok: true,
        preferences: nextPrefs,
        notifications,
        unreadCount: countUnreadNotifications(notifications),
      });
    }
  );

  app.post(
    '/api/client-cabinet/notifications/test-push',
    express.json({ limit: '32kb' }),
    (req, res) => {
      if (isBlockedCrossOriginMutation(req)) {
        res.status(403).json({
          ok: false,
          error: 'Кросс-доменный запрос отклонён политикой безопасности',
        });
        return;
      }

      const clientIp = resolveClientIp(req);
      const rate = clientTestPushLimiter.consume(clientIp);
      if (!rate.allowed) {
        res.setHeader('Retry-After', String(rate.retryAfterSec));
        res.status(429).json({
          ok: false,
          error: `Слишком частая отправка тестовых оповещений. Подождите ${rate.retryAfterSec} сек.`,
        });
        return;
      }

      const body = (req.body ?? {}) as {
        items?: Array<{ orderNumber?: string; rescueToken?: string }>;
        orderNumber?: string;
      };

      const crmStore = readOrdersCrmStore();
      const scope = resolveClientAccessibleNotificationScope(
        req,
        body.items,
        crmStore
      );

      if (!scope.subjectKey || scope.accessibleOrderNumbers.length === 0) {
        res.status(401).json({
          ok: false,
          error: 'Нет доступных заказов для отправки тестового push-уведомления',
        });
        return;
      }

      const requestedUpper =
        typeof body.orderNumber === 'string'
          ? body.orderNumber.trim().toUpperCase()
          : '';
      const targetUpper = scope.accessibleOrderNumbers.includes(requestedUpper)
        ? requestedUpper
        : scope.accessibleOrderNumbers[0];
      const matchedOrder = crmStore.orders.find(
        (o) => o.orderNumber.toUpperCase() === targetUpper
      );
      const canonicalOrderNumber = matchedOrder?.orderNumber ?? targetUpper;

      const testNotif = buildTestCabinetPushNotification({
        id: `notif-test-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        orderNumber: canonicalOrderNumber,
      });

      recordAndBroadcastCabinetNotification(testNotif, crmStore);

      const notifications = filterNotificationsForAccessibleOrders({
        allNotifications: crmStore.clientNotifications,
        accessibleOrderNumbers: scope.accessibleOrderNumbers,
        preferences: scope.preferences,
      });

      res.json({
        ok: true,
        notification: {
          ...testNotif,
          isRead: false,
        },
        notifications,
        unreadCount: countUnreadNotifications(notifications),
      });
    }
  );

  app.patch(
    '/api/orders/:orderNumber/preferences',
    express.json({ limit: '32kb' }),
    async (req, res) => {
      if (isBlockedCrossOriginMutation(req)) {
        res.status(403).json({
          ok: false,
          error: 'Кросс-доменный запрос отклонён политикой безопасности',
        });
        return;
      }

      const orderNumber = String(req.params.orderNumber || '').trim();
      const body = (req.body ?? {}) as {
        rescueToken?: string;
        preferredDeliveryChannel?: ClientDeliveryChannel;
        preferredDeliveryDetail?: string;
        companyName?: string;
        companyInn?: string;
        companyOrInn?: string;
        wantsDiadocDuplicate?: boolean;
      };

      const crmStore = readOrdersCrmStore();
      const idx = crmStore.orders.findIndex((o) => o.orderNumber === orderNumber);
      if (idx === -1) {
        res.status(404).json({ ok: false, error: 'Заказ не найден в реестре' });
        return;
      }

      const existing = crmStore.orders[idx];
      if (!canClientAccessOrder(req, existing, body.rescueToken, crmStore)) {
        res.status(403).json({
          ok: false,
          error: 'Недействительный ключ доступа к заказу',
        });
        return;
      }
      let nextCompanyOrInn = existing.companyOrInn;
      let nextInnVerified = existing.innVerified;
      let nextDocumentMeta = existing.documentMeta;

      const hasCompanyUpdate =
        typeof body.companyName === 'string' ||
        typeof body.companyInn === 'string' ||
        typeof body.companyOrInn === 'string';

      if (hasCompanyUpdate) {
        const parsedFallback =
          typeof body.companyOrInn === 'string'
            ? parseCompanyNameAndInn(body.companyOrInn)
            : { companyName: '', companyInn: '' };

        const rawNameInput =
          typeof body.companyName === 'string'
            ? body.companyName
            : parsedFallback.companyName;
        const rawInnInput =
          typeof body.companyInn === 'string'
            ? body.companyInn
            : parsedFallback.companyInn || body.companyOrInn || '';

        const innInfo = inspectInnDigits(rawInnInput);
        if (!innInfo.isCompleteLength || !innInfo.checksumValid) {
          res.status(400).json({
            ok: false,
            error:
              innInfo.statusMessage ??
              'Укажите корректный ИНН (10 цифр для компании или 12 цифр для ИП)',
          });
          return;
        }

        const lookedUp = await lookupCounterpartyServerSide(innInfo.digits);
        const cleanName =
          rawNameInput.trim().slice(0, 120) ||
          lookedUp?.shortName ||
          lookedUp?.legalName ||
          '';

        if (!cleanName || cleanName.length < 2) {
          res.status(400).json({
            ok: false,
            error: 'Укажите название организации или ИП (от 2 символов)',
          });
          return;
        }

        nextCompanyOrInn = formatStructuredCompanyLine(cleanName, innInfo.digits);
        nextInnVerified = true;

        if (lookedUp) {
          nextDocumentMeta = sanitizeOrderDocumentMeta({
            ...(existing.documentMeta ?? {}),
            ...counterpartyToDocumentMetaPatch(lookedUp, {
              wantsDiadocDuplicate:
                typeof body.wantsDiadocDuplicate === 'boolean'
                  ? body.wantsDiadocDuplicate
                  : existing.documentMeta?.wantsDiadocDuplicate,
            }),
            customerLegalName:
              rawNameInput.trim().length >= 2
                ? rawNameInput.trim()
                : lookedUp.legalName || cleanName,
          });
        }
      } else if (typeof body.wantsDiadocDuplicate === 'boolean') {
        nextDocumentMeta = sanitizeOrderDocumentMeta({
          ...(existing.documentMeta ?? {}),
          wantsDiadocDuplicate: body.wantsDiadocDuplicate,
        });
      }

      const existingPrefs = normalizeDeliveryPreferences(
        existing.preferredDeliveryChannel,
        existing.preferredDeliveryDetail,
        'messenger'
      );
      const nextPrefs =
        body.preferredDeliveryChannel !== undefined ||
        body.preferredDeliveryDetail !== undefined
          ? normalizeDeliveryPreferences(
              body.preferredDeliveryChannel ?? existingPrefs.channel,
              body.preferredDeliveryDetail !== undefined
                ? sanitizeDeliveryDetail(body.preferredDeliveryDetail)
                : existingPrefs.channel === body.preferredDeliveryChannel
                  ? existingPrefs.detail
                  : undefined,
              existingPrefs.channel
            )
          : existingPrefs;

      const maybeEmailFromDelivery =
        nextPrefs.channel === 'email'
          ? normalizeClientEmail(nextPrefs.detail)
          : null;
      const nextClientEmail = existing.clientEmail || maybeEmailFromDelivery || null;

      const updated: CrmOrderRecord = {
        ...existing,
        updatedAt: new Date().toISOString(),
        clientEmail: nextClientEmail,
        preferredDeliveryChannel: nextPrefs.channel,
        preferredDeliveryDetail: nextPrefs.detail,
        companyOrInn: nextCompanyOrInn,
        innVerified: nextInnVerified,
        ...(nextDocumentMeta ? { documentMeta: nextDocumentMeta } : {}),
      };
      crmStore.orders[idx] = updated;
      if (nextClientEmail) {
        const upserted = upsertClientAccountRecord(crmStore.clientAccounts, {
          email: nextClientEmail,
          orderNumbersToLink: [updated.orderNumber],
          contactLine: updated.contact,
          companyOrInn: updated.companyOrInn,
          markLoggedIn: false,
        });
        crmStore.clientAccounts = upserted.accounts;
      }
      writeOrdersCrmStore(crmStore);

      const effectiveRescueToken = issueOrderRescueToken(updated.orderNumber);
      res.json({
        ok: true,
        documentMeta: updated.documentMeta ?? null,
        order: toClientCabinetOrderSummary(
          updated,
          effectiveRescueToken,
          sanitizeStudioLegalProfilesConfig(crmStore.legalProfiles)
        ),
      });
    }
  );

  app.post(
    '/api/orders/:orderNumber/client-upload',
    express.json({ limit: '12mb' }),
    (req, res) => {
      if (isBlockedCrossOriginMutation(req)) {
        res.status(403).json({
          ok: false,
          error: 'Кросс-доменный запрос загрузки файла отклонён политикой безопасности',
        });
        return;
      }

      const clientIp = resolveClientIp(req);
      const uploadRate = clientOrderUploadLimiter.consume(clientIp);
      if (!uploadRate.allowed) {
        res.setHeader('Retry-After', String(uploadRate.retryAfterSec));
        res.status(429).json({
          ok: false,
          error: `Слишком частая загрузка файлов. Подождите ${uploadRate.retryAfterSec} сек.`,
        });
        return;
      }

      const orderNumber = String(req.params.orderNumber || '').trim();
      const body = (req.body ?? {}) as {
        rescueToken?: string;
        fileName?: string;
        dataBase64?: string;
        note?: string;
      };

      const crmStore = readOrdersCrmStore();
      const idx = crmStore.orders.findIndex((o) => o.orderNumber === orderNumber);
      if (idx === -1) {
        res.status(404).json({ ok: false, error: 'Заказ не найден в реестре' });
        return;
      }

      const existing = crmStore.orders[idx];
      if (!orderNumber || !canClientAccessOrder(req, existing, body.rescueToken, crmStore)) {
        res.status(403).json({
          ok: false,
          error: 'Недействительный ключ доступа для загрузки файла в заказ',
        });
        return;
      }

      const saved = saveBase64OrderAttachment({
        storageDir: ORDER_UPLOADS_DIR,
        orderNumber,
        rawFileName: body.fileName || 'client-material.txt',
        dataBase64: body.dataBase64 || '',
        allowedExts: CLIENT_UPLOAD_ALLOWED_EXTS,
        maxBytes: 7 * 1024 * 1024,
        fallbackPrefix: 'client-file',
      });

      if (!saved.ok) {
        res.status(400).json({ ok: false, error: saved.error });
        return;
      }

      const attachment: ClientUploadedAttachment = {
        id: `cup-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        fileName: saved.safeFileName,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
        uploadedAt: new Date().toISOString(),
        note: typeof body.note === 'string' ? body.note.trim().slice(0, 240) : undefined,
        storageKey: saved.storageKey,
      };

      const nextUploads = [attachment, ...(existing.clientUploads ?? [])].slice(0, 20);
      const updated: CrmOrderRecord = {
        ...existing,
        updatedAt: attachment.uploadedAt,
        clientUploads: nextUploads,
      };
      crmStore.orders[idx] = updated;
      writeOrdersCrmStore(crmStore);

      const effectiveRescueToken = issueOrderRescueToken(updated.orderNumber);
      res.json({
        ok: true,
        attachment,
        order: toClientCabinetOrderSummary(
          updated,
          effectiveRescueToken,
          sanitizeStudioLegalProfilesConfig(crmStore.legalProfiles)
        ),
      });
    }
  );

  app.get('/api/orders/:orderNumber/deliverables/:fileId', (req, res) => {
    const orderNumber = String(req.params.orderNumber || '').trim();
    const fileId = String(req.params.fileId || '').trim();
    const token =
      typeof req.query.token === 'string' ? req.query.token.trim() : '';
    const isAdmin = verifyAdminToken(extractStudioToken(req));
    const crmStore = readOrdersCrmStore();
    const order = crmStore.orders.find((o) => o.orderNumber === orderNumber);
    const deliverable = order?.deliverables?.find((d) => d.id === fileId);
    if (!order || !deliverable) {
      res.status(404).json({ ok: false, error: 'Файл не найден' });
      return;
    }

    if (!isAdmin && !canClientAccessOrder(req, order, token, crmStore)) {
      res.status(403).json({ ok: false, error: 'Доступ к файлу заказа закрыт' });
      return;
    }

    const absPath = deliverable.storageKey
      ? resolveContainedStoragePath(ORDER_DELIVERABLES_DIR, deliverable.storageKey)
      : deliverable.staticAssetUrl
        ? resolveSeedPublicAudioPath(deliverable.staticAssetUrl)
        : null;

    if (!absPath || !fs.existsSync(absPath)) {
      res.status(404).json({ ok: false, error: 'Файл отсутствует на диске' });
      return;
    }

    const isAudioPreview =
      req.query.preview === '1' && deliverable.mimeType.startsWith('audio/');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', deliverable.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${isAudioPreview ? 'inline' : 'attachment'}; filename="${encodeURIComponent(
        path.basename(deliverable.fileName)
      )}"`
    );
    res.sendFile(absPath);
  });

  app.get('/api/orders/:orderNumber/client-uploads/:fileId', (req, res) => {
    const orderNumber = String(req.params.orderNumber || '').trim();
    const fileId = String(req.params.fileId || '').trim();
    const token =
      typeof req.query.token === 'string' ? req.query.token.trim() : '';
    const isAdmin = verifyAdminToken(extractStudioToken(req));
    const crmStore = readOrdersCrmStore();
    const order = crmStore.orders.find((o) => o.orderNumber === orderNumber);
    const attachment = order?.clientUploads?.find((u) => u.id === fileId);
    if (!order || !attachment || !attachment.storageKey) {
      res.status(404).json({ ok: false, error: 'Файл не найден' });
      return;
    }

    if (!isAdmin && !canClientAccessOrder(req, order, token, crmStore)) {
      res.status(403).json({ ok: false, error: 'Доступ к файлу клиента закрыт' });
      return;
    }

    const absPath = resolveContainedStoragePath(ORDER_UPLOADS_DIR, attachment.storageKey);
    if (!absPath || !fs.existsSync(absPath)) {
      res.status(404).json({ ok: false, error: 'Файл отсутствует на диске' });
      return;
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(path.basename(attachment.fileName))}"`
    );
    res.sendFile(absPath);
  });

  // =========================================================================
  // Studio CRM Orders Funnel & Outbox Dispatch Endpoints
  // =========================================================================

  // Встроенный локальный приёмник Webhook с обязательной проверкой HMAC-SHA256 подписи
  app.post(
    '/api/webhooks/loopback-crm-sink',
    express.raw({ type: 'application/json', limit: '128kb' }),
    (req, res) => {
      const sigHeader = req.headers['x-fmworks-signature'];
      const eventHeader = req.headers['x-fmworks-event'] || 'unknown';
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
      if (typeof sigHeader !== 'string' || !sigHeader.startsWith('sha256=')) {
        res.status(401).json({
          ok: false,
          error: 'Отсутствует или некорректна HMAC-подпись X-FMWorks-Signature',
        });
        return;
      }

      const crmStore = readOrdersCrmStore();
      const signingSecret = crmStore.settings.webhook.hmacSecret.trim() || getSessionSecret();
      const expectedHex = crypto
        .createHmac('sha256', signingSecret)
        .update(rawBody)
        .digest('hex');

      if (!safeCompareStrings(sigHeader.trim(), `sha256=${expectedHex}`)) {
        res.status(401).json({
          ok: false,
          error: 'Недействительная HMAC-подпись вебхука',
        });
        return;
      }

      res.status(200).json({
        ok: true,
        receivedEvent: eventHeader,
        signatureVerified: true,
        receivedAt: new Date().toISOString(),
      });
    }
  );

  function buildAdminTelegramSettingsView(crmStore: PersistedOrdersCrmStore) {
    const resolvedTg = resolveEffectiveTelegramSettings(
      crmStore.settings.telegram,
      process.env
    );
    return {
      enabled: resolvedTg.enabled,
      hasBotToken: resolvedTg.hasBotToken,
      botTokenSource: resolvedTg.botTokenSource,
      envBotTokenConfigured: resolvedTg.envBotTokenConfigured,
      maskedBotToken: maskSecretForAdmin(resolvedTg.botToken),
      chatId: resolvedTg.chatId,
      hasChatId: resolvedTg.hasChatId,
      chatIdSource: resolvedTg.chatIdSource,
      envChatIdConfigured: resolvedTg.envChatIdConfigured,
      discoveredChatTitle: resolvedTg.discoveredChatTitle,
      notifyOnNewOrder: resolvedTg.notifyOnNewOrder,
      notifyOnStageChange: resolvedTg.notifyOnStageChange,
      maskPdnInExternalAlerts: resolvedTg.maskPdnInExternalAlerts,
    };
  }

  app.get('/api/cms/orders', requireStudioAuth, (_req, res) => {
    runSlaEscalationSweep();
    const crmStore = readOrdersCrmStore();
    const { webhook } = crmStore.settings;
    const workSchedule = sanitizeWorkScheduleConfig(crmStore.settings.workSchedule);

    res.json({
      ok: true,
      orders: crmStore.orders.map((ord) => ensureOrderApprovalWorkflow(ord)),
      soundEngineers: sanitizeSoundEngineerRoster(crmStore.soundEngineers),
      soundEngineerEmails: (crmStore.soundEngineerEmails ?? []).slice(0, 30),
      dispatchLogs: crmStore.dispatchLogs.slice(0, 25),
      operatingRegime: resolveStudioOperatingRegime(Date.now(), workSchedule),
      legalProfiles: sanitizeStudioLegalProfilesConfig(crmStore.legalProfiles),
      konturStatus: getKonturIntegrationStatus(),
      settings: {
        telegram: buildAdminTelegramSettingsView(crmStore),
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

  app.get('/api/cms/kontur/status', requireStudioAuth, (_req, res) => {
    res.json({
      ok: true,
      konturStatus: getKonturIntegrationStatus(),
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
    async (req, res) => {
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
        preferredDeliveryChannel?: ClientDeliveryChannel;
        preferredDeliveryDetail?: string;
        cloudDiskUrl?: string | null;
        removeDeliverableId?: string;
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

      const nextCloudDiskUrl =
        body.cloudDiskUrl !== undefined
          ? sanitizeCloudDiskUrl(body.cloudDiskUrl)
          : existing.cloudDiskUrl ?? null;

      const nextDeliverables =
        typeof body.removeDeliverableId === 'string' && body.removeDeliverableId.trim()
          ? (existing.deliverables ?? []).filter(
              (d) => d.id !== body.removeDeliverableId?.trim()
            )
          : existing.deliverables ?? [];

      const activeOperatorName = resolveRequestOperatorName(req);
      const nextStageHistory = stageChanged
        ? recordOrderStageTransition(existing, {
            timestamp: nowIso,
            previousStage: existing.stage,
            nextStage,
            actor: 'producer_crm',
            actorName: activeOperatorName,
            workflowStepLabel: `Перевод заказа на этап «${
              getCrmStageMetaForOrder(nextStage, existing.checkoutMode).shortLabel
            }»`,
            note:
              typeof body.producerNotes === 'string' &&
              body.producerNotes.trim() &&
              body.producerNotes.trim() !== existing.producerNotes.trim()
                ? body.producerNotes.trim()
                : null,
          })
        : ensureOrderStageHistory(existing).stageHistory;

      const updatedOrder: CrmOrderRecord = {
        ...existing,
        stage: nextStage,
        stageHistory: nextStageHistory,
        updatedAt: nowIso,
        holdExpiresAt: nextHoldExpiresAt,
        callbackPreference: nextCallbackPref,
        ...(() => {
          const existingPrefs = normalizeDeliveryPreferences(
            existing.preferredDeliveryChannel,
            existing.preferredDeliveryDetail,
            'messenger'
          );
          if (
            body.preferredDeliveryChannel !== undefined ||
            body.preferredDeliveryDetail !== undefined
          ) {
            const norm = normalizeDeliveryPreferences(
              body.preferredDeliveryChannel ?? existingPrefs.channel,
              body.preferredDeliveryDetail,
              existingPrefs.channel
            );
            return {
              preferredDeliveryChannel: norm.channel,
              preferredDeliveryDetail: norm.detail,
            };
          }
          return {
            preferredDeliveryChannel: existingPrefs.channel,
            preferredDeliveryDetail: existingPrefs.detail,
          };
        })(),
        cloudDiskUrl: nextCloudDiskUrl,
        deliverables: nextDeliverables,
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

      let finalOrder: CrmOrderRecord = updatedOrder;
      let latestEngineerEmail: SoundEngineerEmailNotificationRecord | null = null;
      let dispatchResult: {
        telegramResult: CrmOrderRecord['delivery']['telegram'];
        webhookResult: CrmOrderRecord['delivery']['webhook'];
      } | null = null;

      if (stageChanged) {
        const stageNotif = buildStageChangedNotification({
          id: `notif-stage-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          orderNumber: updatedOrder.orderNumber,
          previousStage: existing.stage,
          nextStage: updatedOrder.stage,
          formatLabel: updatedOrder.formatLabel,
          createdAt: nowIso,
        });
        recordAndBroadcastCabinetNotification(stageNotif, crmStore);

        // Автоматическая отправка e-mail уведомления звукорежиссёру при смене статуса заказа с кнопкой «Сдать файл на проверку»
        const prevStageLabel = getCrmStageMetaForOrder(
          existing.stage,
          updatedOrder.checkoutMode
        ).shortLabel;
        const nextStageLabel = getCrmStageMetaForOrder(
          updatedOrder.stage,
          updatedOrder.checkoutMode
        ).shortLabel;
        const hydrated = ensureOrderApprovalWorkflow(updatedOrder);
        const roster = sanitizeSoundEngineerRoster(crmStore.soundEngineers);
        const engineer =
          roster.find((e) => e.id === hydrated.approvalWorkflow.assignedEngineerId) ??
          roster.find((e) => e.isDefault) ??
          roster[0];

        if (engineer) {
          const preDispatchedOrder: CrmOrderRecord = {
            ...hydrated,
            approvalWorkflow: {
              ...hydrated.approvalWorkflow,
              assignedEngineerId: engineer.id,
            },
          };
          const dispatched = await buildAndDispatchSoundEngineerSheet({
            req,
            order: preDispatchedOrder,
            engineer,
            crmStore,
            autoSendExternal: true,
            triggerReason: 'stage_changed',
            previousStageLabel: prevStageLabel,
            currentStageLabel: nextStageLabel,
            triggerSummary: `Статус заказа #${updatedOrder.orderNumber} изменён: «${prevStageLabel}» → «${nextStageLabel}».`,
          });
          latestEngineerEmail = dispatched.emailNotification;
          finalOrder = {
            ...preDispatchedOrder,
            approvalWorkflow: {
              ...preDispatchedOrder.approvalWorkflow!,
              lastDispatchedToEngineerAt: nowIso,
              lastDispatchChannelSummary: dispatched.channelSummary,
            },
          };
          crmStore.orders[idx] = finalOrder;
          writeOrdersCrmStore(crmStore);
        }

        dispatchResult = await dispatchOrderToExternalChannels(
          finalOrder.id,
          'order.stage_changed',
          {
            statusChange: {
              previousStage: existing.stage,
              nextStage: finalOrder.stage,
              actor: 'producer_crm',
              reasonSummary:
                typeof body.producerNotes === 'string' &&
                body.producerNotes.trim() &&
                body.producerNotes.trim() !== existing.producerNotes.trim()
                  ? `Обновлена заметка продюсера: ${body.producerNotes.trim()}`
                  : null,
              changedAtIso: nowIso,
            },
          }
        );
        finalOrder =
          crmStore.orders.find((o) => o.id === finalOrder.id) ?? finalOrder;
      }

      res.json({
        ok: true,
        order: finalOrder,
        dispatchResult,
        dispatchLogs: crmStore.dispatchLogs.slice(0, 25),
        soundEngineerEmail: latestEngineerEmail,
        soundEngineerEmails: (crmStore.soundEngineerEmails ?? []).slice(0, 30),
      });
    }
  );

  app.post(
    '/api/cms/orders/:orderId/diadoc-draft',
    requireStudioAuth,
    express.json({ limit: '32kb' }),
    async (req, res) => {
      const { orderId } = req.params;
      const crmStore = readOrdersCrmStore();
      const idx = crmStore.orders.findIndex((o) => o.id === orderId);
      if (idx === -1) {
        res.status(404).json({ ok: false, error: 'Заказ не найден в реестре CRM' });
        return;
      }

      const existing = crmStore.orders[idx];
      const legalProfiles = sanitizeStudioLegalProfilesConfig(crmStore.legalProfiles);
      const parsedComp = parseCompanyNameAndInn(existing.companyOrInn);
      const candidateInn = (
        existing.documentMeta?.customerInn ||
        parsedComp.companyInn ||
        ''
      )
        .replace(/\D/g, '')
        .slice(0, 12);

      let workingMeta: OrderDocumentMeta = sanitizeOrderDocumentMeta(
        existing.documentMeta ?? {}
      );
      if (candidateInn.length === 10 || candidateInn.length === 12) {
        const lookedUp = await lookupCounterpartyServerSide(candidateInn);
        if (lookedUp) {
          workingMeta = sanitizeOrderDocumentMeta({
            ...counterpartyToDocumentMetaPatch(lookedUp),
            ...workingMeta,
            customerEdoBoxId:
              workingMeta.customerEdoBoxId || lookedUp.diadoc.boxId || undefined,
            customerEdoOperator:
              workingMeta.customerEdoOperator ||
              (lookedUp.diadoc.hasBox ? lookedUp.diadoc.operatorLabel : undefined),
          });
        }
      }

      const suite = assembleProductionDocumentSuite({
        orderNumber: existing.orderNumber,
        createdAtIso: existing.createdAt,
        formatLabel: existing.formatLabel,
        baseBudgetRub: existing.totalBudgetRub,
        defaultDurationSec: existing.mediaPlanSnapshot?.spotDurationSec ?? 20,
        contact: existing.contact,
        companyOrInn: existing.companyOrInn,
        briefText: existing.briefText,
        legalProfiles,
        documentMeta: workingMeta,
      });

      if (suite.isNegotiablePendingPrice) {
        res.status(400).json({
          ok: false,
          error:
            'Для формирования счёта в Контур.Диадок сначала укажите согласованную сумму в карточке пакета документов A4.',
        });
        return;
      }

      const fromBoxId =
        (process.env.DIADOC_BOX_ID ?? '').trim() || suite.studio.edoParticipantId;
      const toBoxId = suite.customer.edoBoxId || undefined;
      const invoiceTextContent = formatProductionSuitePlainSummary(suite, 'invoice');
      const diadocPayload = buildDiadocDraftPostMessagePayload({
        suite,
        fromBoxId,
        toBoxId,
        invoiceTextContent,
      });

      const nowIso = new Date().toISOString();
      const diadocAuth = await resolveDiadocAuthHeader();

      let nextDraftState: NonNullable<OrderDocumentMeta['diadocDraftState']>;
      let responseMessage: string;
      let mode: 'draft_created' | 'queued_local' = 'queued_local';

      if (diadocAuth) {
        try {
          const postRes = await fetch(`${getDiadocApiBaseUrl()}/V3/PostMessage`, {
            method: 'POST',
            headers: {
              Authorization: diadocAuth,
              'Content-Type': 'application/json; charset=utf-8',
              Accept: 'application/json',
            },
            body: JSON.stringify(diadocPayload),
            signal: AbortSignal.timeout(6000),
          });

          if (!postRes.ok) {
            const errText = (await postRes.text()).slice(0, 240);
            res.status(502).json({
              ok: false,
              error: `Ответ шлюза Контур.Диадок HTTP ${postRes.status}: ${errText || 'не удалось сохранить черновик'}`,
            });
            return;
          }

          const respJson = (await postRes.json()) as { MessageId?: string };
          const msgId =
            String(respJson?.MessageId || '').trim() ||
            `DIADOC-${existing.orderNumber}`;
          mode = 'draft_created';
          nextDraftState = {
            status: 'draft_created',
            draftMessageId: msgId,
            toBoxId,
            fromBoxId,
            documentNumber: suite.invoiceNumber,
            updatedAt: nowIso,
            detail: `Черновик счёта № ${suite.invoiceNumber} помещён в папку «Черновики» Контур.Диадока (MessageId: ${msgId}) без списания пакета ЭДО.`,
          };
          responseMessage = nextDraftState.detail!;
        } catch (err) {
          res.status(502).json({
            ok: false,
            error:
              err instanceof Error
                ? `Сетевой сбой при обращении к API Контур.Диадок: ${err.message}`
                : 'Не удалось связаться с API Контур.Диадок',
          });
          return;
        }
      } else {
        const localDraftId = `DRAFT-${existing.orderNumber}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
        nextDraftState = {
          status: 'queued_local',
          draftMessageId: localDraftId,
          toBoxId,
          fromBoxId,
          documentNumber: suite.invoiceNumber,
          updatedAt: nowIso,
          detail: `Пакет PostMessage (IsDraft=true) для счёта № ${suite.invoiceNumber} подготовлен (${localDraftId}). Для прямой выгрузки в ящик укажите DIADOC_API_KEY в окружении сервера или импортируйте CSV в «Учёт Контур.Экстерна».`,
        };
        responseMessage = nextDraftState.detail!;
      }

      const updatedOrder: CrmOrderRecord = {
        ...existing,
        updatedAt: nowIso,
        documentMeta: sanitizeOrderDocumentMeta({
          ...workingMeta,
          diadocDraftState: nextDraftState,
        }),
      };

      crmStore.orders[idx] = updatedOrder;
      writeOrdersCrmStore(crmStore);

      res.json({
        ok: true,
        mode,
        order: updatedOrder,
        payloadPreview: diadocPayload,
        message: responseMessage,
      });
    }
  );

  app.post(
    '/api/cms/orders/:orderId/deliverables',
    requireStudioAuth,
    express.json({ limit: '16mb' }),
    (req, res) => {
      const { orderId } = req.params;
      const body = (req.body ?? {}) as {
        title?: string;
        kind?: OrderDeliverableKind;
        fileName?: string;
        dataBase64?: string;
        versionCode?: string;
        versionStage?: string;
        versionNote?: string;
      };

      const crmStore = readOrdersCrmStore();
      const idx = crmStore.orders.findIndex((o) => o.id === orderId);
      if (idx === -1) {
        res.status(404).json({ ok: false, error: 'Заказ не найден в реестре CRM' });
        return;
      }

      const existing = crmStore.orders[idx];
      const saved = saveBase64OrderAttachment({
        storageDir: ORDER_DELIVERABLES_DIR,
        orderNumber: existing.orderNumber,
        rawFileName: body.fileName || 'master-spot.wav',
        dataBase64: body.dataBase64 || '',
        allowedExts: DELIVERABLE_ALLOWED_EXTS,
        maxBytes: 10 * 1024 * 1024,
        fallbackPrefix: 'studio-deliverable',
      });

      if (!saved.ok) {
        res.status(400).json({ ok: false, error: saved.error });
        return;
      }

      const validKinds: readonly OrderDeliverableKind[] = [
        'audio_master',
        'script',
        'invoice',
        'passport',
        'archive',
      ];
      const kind: OrderDeliverableKind = validKinds.includes(
        body.kind as OrderDeliverableKind
      )
        ? (body.kind as OrderDeliverableKind)
        : saved.mimeType.startsWith('audio/')
          ? 'audio_master'
          : 'archive';

      const versionMeta = resolveUploadedDeliverableVersionMeta({
        kind,
        mimeType: saved.mimeType,
        requestedVersionCode: body.versionCode,
        requestedVersionStage: body.versionStage,
        requestedVersionNote: body.versionNote,
        existingDeliverables: existing.deliverables ?? [],
      });

      const deliverable: OrderDeliverableFile = {
        id: `deliv-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        title:
          typeof body.title === 'string' && body.title.trim()
            ? body.title.trim().slice(0, 140)
            : saved.safeFileName,
        kind,
        fileName: saved.safeFileName,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
        uploadedAt: new Date().toISOString(),
        ...versionMeta,
        storageKey: saved.storageKey,
      };

      const updated: CrmOrderRecord = {
        ...existing,
        updatedAt: deliverable.uploadedAt,
        deliverables: [deliverable, ...(existing.deliverables ?? [])].slice(0, 20),
      };
      crmStore.orders[idx] = updated;
      const deliverableNotif = buildDeliverableUploadedNotification({
        id: `notif-deliv-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        orderNumber: updated.orderNumber,
        deliverable,
        createdAt: deliverable.uploadedAt,
      });
      recordAndBroadcastCabinetNotification(deliverableNotif, crmStore);

      res.json({
        ok: true,
        order: updated,
        deliverable,
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

    const operatorWhoAnonymized = resolveRequestOperatorName(req);
    recordSecurityAudit(
      'order_pdn_anonymized',
      req,
      `Обезличены ПДн сделки #${anonymized.orderNumber} (ст. 21 152-ФЗ, оператор: ${operatorWhoAnonymized})`
    );

    res.json({
      ok: true,
      order: anonymized,
    });
  });

  // =========================================================================
  // Пошаговый конвейер согласования сценариев и роликов + Шлюз звукорежиссёра
  // =========================================================================

  async function buildAndDispatchSoundEngineerSheet(params: {
    req: Request;
    order: CrmOrderRecord;
    engineer: SoundEngineerContact;
    crmStore: PersistedOrdersCrmStore;
    autoSendExternal?: boolean;
    triggerReason?: SoundEngineerEmailTriggerReason;
    previousStageLabel?: string | null;
    currentStageLabel?: string | null;
    triggerSummary?: string | null;
  }): Promise<{
    dropToken: string;
    dropPath: string;
    dropUrl: string;
    emailGrant: string;
    emailActionPath: string;
    emailActionUrl: string;
    emailNotification: SoundEngineerEmailNotificationRecord;
    sheet: ReturnType<typeof formatSoundEngineerProductionSheet>;
    channelSummary: string;
  }> {
    const {
      req,
      order,
      engineer,
      crmStore,
      autoSendExternal = true,
      triggerReason = 'manual_dispatch',
      previousStageLabel = null,
      currentStageLabel = null,
      triggerSummary = null,
    } = params;
    const wf = ensureOrderApprovalWorkflow(order).approvalWorkflow;
    const expMs = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const dropToken = issueSoundDropTokenWithSigner(
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        engineerId: engineer.id,
        engineerName: engineer.name,
        gen: wf.dropTokenGeneration,
        expMs,
      },
      signSoundDropHmac
    );

    const emailGrant = issueSoundEngineerEmailGrantWithSigner(
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        engineerId: engineer.id,
        engineerName: engineer.name,
        gen: wf.dropTokenGeneration,
        expMs,
      },
      signSoundDropHmac
    );

    const dropPath = `/sound-drop?token=${encodeURIComponent(dropToken)}`;
    const emailActionPath = `/api/sound-drop/from-email?grant=${encodeURIComponent(emailGrant)}`;
    const origin = resolveSafePublicOrigin({
      configuredOrigin: process.env.PUBLIC_ORIGIN,
      hostHeader: req.headers.host,
      forwardedHost: req.headers['x-forwarded-host'],
      protocol: req.protocol,
      forwardedProto: req.headers['x-forwarded-proto'],
      trustProxy: process.env.TRUST_PROXY === 'true',
      fallbackOrigin: `http://localhost:${PORT}`,
    });
    const dropUrl = `${origin}${dropPath}`;
    const emailActionUrl = `${origin}${emailActionPath}`;

    const stageLabelResolved =
      currentStageLabel ||
      CRM_ORDER_STAGES.find((s) => s.id === order.stage)?.shortLabel ||
      order.stage;

    const sheet = formatSoundEngineerProductionSheet({
      orderNumber: order.orderNumber,
      engineer,
      workflow: wf,
      briefFallbackText: order.briefText,
      directDropUrl: dropUrl,
      emailActionUrl,
      previousStageLabel,
      currentStageLabel: stageLabelResolved,
      triggerSummary,
    });

    const deliveredVia: string[] = [];
    let mailGatewayDelivered = false;

    const resolvedEngineerTg = resolveEffectiveTelegramSettings(
      crmStore.settings.telegram,
      process.env
    );

    if (
      autoSendExternal &&
      resolvedEngineerTg.hasBotToken &&
      engineer.telegramChatId.trim()
    ) {
      try {
        const tgRes = await fetch(
          `${resolveTelegramBotApiBaseUrl()}/bot${resolvedEngineerTg.botToken}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: engineer.telegramChatId.trim(),
              text: sheet.telegramMessage.slice(0, 3900),
              disable_web_page_preview: true,
            }),
            signal: AbortSignal.timeout(4500),
          }
        );
        if (tgRes.ok) {
          deliveredVia.push('Telegram');
        }
      } catch {
        // Неблокирующий внешний канал
      }
    }

    const emailGatewayUrl = (
      process.env.SOUND_ENGINEER_EMAIL_WEBHOOK_URL ?? ''
    ).trim();
    if (autoSendExternal && emailGatewayUrl && engineer.email) {
      try {
        const check = validateOutboundWebhookTarget(emailGatewayUrl, {
          allowInternalLoopbackSink: true,
          localPort: PORT,
        });
        const rfSafety = evaluateWebhookEndpointRfSafety(emailGatewayUrl);
        if (check.ok && rfSafety.isValidUrl && !rfSafety.isBannedForeignService) {
          const mailRes = await fetch(emailGatewayUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: engineer.email,
              engineerName: engineer.name,
              orderNumber: order.orderNumber,
              subject: sheet.subject,
              text: sheet.plainBody,
              html: sheet.htmlBody,
              buttonLabel: sheet.buttonLabel,
              actionButtonUrl: sheet.actionButtonUrl,
              dropUrl,
            }),
            signal: AbortSignal.timeout(4500),
          });
          if (mailRes.ok) {
            mailGatewayDelivered = true;
            deliveredVia.push(`Почта (${engineer.email})`);
          }
        }
      } catch {
        // Неблокирующий внешний почтовый шлюз
      }
    }

    const nowIso = new Date().toISOString();
    const emailNotification: SoundEngineerEmailNotificationRecord = {
      id: `se-mail-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      engineerId: engineer.id,
      engineerName: engineer.name,
      engineerEmail: engineer.email || 'sound@fmworks.studio',
      triggerReason,
      previousStageLabel,
      currentStageLabel: stageLabelResolved,
      subject: sheet.subject,
      plainBody: sheet.plainBody,
      htmlBody: sheet.htmlBody,
      buttonLabel: sheet.buttonLabel,
      emailActionPath,
      emailActionUrl,
      deliveryStatus: mailGatewayDelivered
        ? 'delivered_webhook'
        : 'queued_outbox',
      deliveryDetail: mailGatewayDelivered
        ? `Отправлено на ${engineer.email} через почтовый шлюз`
        : `E-mail уведомление сформировано для ${engineer.email || engineer.name} · кнопка «${sheet.buttonLabel}» активна`,
      createdAt: nowIso,
      clickedCount: 0,
      lastClickedAt: null,
      lastIssuedDropUrl: dropUrl,
    };

    crmStore.soundEngineerEmails = [
      emailNotification,
      ...(Array.isArray(crmStore.soundEngineerEmails)
        ? crmStore.soundEngineerEmails
        : []),
    ].slice(0, 60);

    const channelSummary =
      deliveredVia.length > 0
        ? `Уведомление отправлено (${deliveredVia.join(' + ')})`
        : engineer.email
          ? `E-mail уведомление с кнопкой «${sheet.buttonLabel}» отправлено в почтовый журнал (${engineer.email})`
          : `Техлист и ссылка «${sheet.buttonLabel}» сформированы (${engineer.name})`;

    return {
      dropToken,
      dropPath,
      dropUrl,
      emailGrant,
      emailActionPath,
      emailActionUrl,
      emailNotification,
      sheet,
      channelSummary,
    };
  }

  app.put(
    '/api/cms/sound-engineers',
    requireStudioAuth,
    express.json({ limit: '32kb' }),
    (req, res) => {
      const body = (req.body ?? {}) as { soundEngineers?: unknown };
      const sanitized = sanitizeSoundEngineerRoster(body.soundEngineers);
      const serializedLower = JSON.stringify(sanitized).toLowerCase();
      const hitBanned = SERVER_BANNED_TERMS.find((term) =>
        serializedLower.includes(term)
      );
      if (hitBanned) {
        res.status(400).json({
          ok: false,
          error: `Список звукорежиссёров содержит запрещённый фрагмент («${hitBanned}»).`,
        });
        return;
      }

      const crmStore = readOrdersCrmStore();
      crmStore.soundEngineers = sanitized;
      writeOrdersCrmStore(crmStore);

      res.json({
        ok: true,
        soundEngineers: crmStore.soundEngineers,
      });
    }
  );

  app.post(
    '/api/cms/orders/:orderId/approval/publish-script',
    requireStudioAuth,
    express.json({ limit: '64kb' }),
    (req, res) => {
      const { orderId } = req.params;
      const body = (req.body ?? {}) as {
        targetSlotSec?: number;
        concepts?: PublishScriptConceptInput[];
      };

      const serializedLower = JSON.stringify(body.concepts ?? []).toLowerCase();
      const hitBanned = SERVER_BANNED_TERMS.find((term) =>
        serializedLower.includes(term)
      );
      if (hitBanned) {
        res.status(400).json({
          ok: false,
          error: `Текст сценария содержит стоп-фрагмент редакционной политики («${hitBanned}»).`,
        });
        return;
      }

      const crmStore = readOrdersCrmStore();
      const idx = crmStore.orders.findIndex((o) => o.id === orderId);
      if (idx === -1) {
        res.status(404).json({ ok: false, error: 'Заказ не найден в реестре CRM' });
        return;
      }

      const existing = ensureOrderApprovalWorkflow(crmStore.orders[idx]);
      const nowIso = new Date().toISOString();

      try {
        const nextWorkflow = applyPublishScriptDraft(
          existing.approvalWorkflow,
          {
            targetSlotSec: body.targetSlotSec,
            concepts: Array.isArray(body.concepts) ? body.concepts : [],
          },
          nowIso
        );

        const nextStage: CrmOrderStage =
          existing.stage === 'new_hold' ||
          existing.stage === 'quota_locked' ||
          existing.stage === 'edo_invoice'
            ? 'in_production'
            : existing.stage;

        const latestVer = nextWorkflow.scriptVersions[0]?.versionNumber ?? 1;
        const updatedOrder: CrmOrderRecord = {
          ...existing,
          stage: nextStage,
          stageHistory: recordOrderStageTransition(existing, {
            timestamp: nowIso,
            previousStage: existing.stage,
            nextStage,
            actor: 'producer_crm',
            workflowStepLabel: `Опубликован режиссёрский сценарий v${latestVer} (${nextWorkflow.targetSlotSec} сек) на утверждение клиенту`,
          }),
          updatedAt: nowIso,
          approvalWorkflow: nextWorkflow,
        };

        crmStore.orders[idx] = updatedOrder;
        const notif = buildApprovalWorkflowNotification({
          id: `notif-script-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          orderNumber: updatedOrder.orderNumber,
          title: `Заказ #${updatedOrder.orderNumber}: готов режиссёрский сценарий (v${latestVer})`,
          body: `Продюсер опубликовал режиссёрский сценарий (${nextWorkflow.targetSlotSec} сек). Утвердите текст в 1 клик в личном кабинете, чтобы запустить запись.`,
          createdAt: nowIso,
        });
        recordAndBroadcastCabinetNotification(notif, crmStore);
        void dispatchOrderToExternalChannels(
          updatedOrder.id,
          'order.stage_changed',
          {
            statusChange: {
              previousStage: existing.stage,
              nextStage: updatedOrder.stage,
              actor: 'producer_crm',
              workflowStepLabel: `Опубликован режиссёрский сценарий v${latestVer} (${nextWorkflow.targetSlotSec} сек) на утверждение клиенту`,
              changedAtIso: nowIso,
            },
          }
        );

        res.json({
          ok: true,
          order: updatedOrder,
        });
      } catch (err) {
        res.status(400).json({
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : 'Не удалось опубликовать режиссёрский сценарий',
        });
      }
    }
  );

  app.post(
    '/api/cms/orders/:orderId/approval/dispatch-engineer',
    requireStudioAuth,
    express.json({ limit: '32kb' }),
    async (req, res) => {
      const { orderId } = req.params;
      const body = (req.body ?? {}) as {
        engineerId?: string;
        rotateToken?: boolean;
      };

      const crmStore = readOrdersCrmStore();
      const idx = crmStore.orders.findIndex((o) => o.id === orderId);
      if (idx === -1) {
        res.status(404).json({ ok: false, error: 'Заказ не найден в реестре CRM' });
        return;
      }

      const roster = sanitizeSoundEngineerRoster(crmStore.soundEngineers);
      const existing = ensureOrderApprovalWorkflow(crmStore.orders[idx]);
      const wf = existing.approvalWorkflow;
      const requestedId = String(body.engineerId || wf.assignedEngineerId || '').trim();
      const engineer =
        roster.find((e) => e.id === requestedId) ??
        roster.find((e) => e.isDefault) ??
        roster[0];

      if (!engineer) {
        res.status(400).json({
          ok: false,
          error: 'В справочнике не настроен ни один звукорежиссёр',
        });
        return;
      }

      const engineerSwitched =
        Boolean(wf.assignedEngineerId) && wf.assignedEngineerId !== engineer.id;
      const nextGen =
        engineerSwitched || body.rotateToken === true
          ? wf.dropTokenGeneration + 1
          : wf.dropTokenGeneration;

      const nowIso = new Date().toISOString();
      const preUpdatedOrder: CrmOrderRecord = {
        ...existing,
        updatedAt: nowIso,
        approvalWorkflow: {
          ...wf,
          assignedEngineerId: engineer.id,
          dropTokenGeneration: nextGen,
        },
      };

      const stageLabel =
        CRM_ORDER_STAGES.find((s) => s.id === preUpdatedOrder.stage)?.shortLabel ??
        preUpdatedOrder.stage;

      const dispatched = await buildAndDispatchSoundEngineerSheet({
        req,
        order: preUpdatedOrder,
        engineer,
        crmStore,
        autoSendExternal: true,
        triggerReason: 'manual_dispatch',
        currentStageLabel: stageLabel,
        triggerSummary: engineerSwitched
          ? `Назначен звукорежиссёр ${engineer.name} по заказу #${preUpdatedOrder.orderNumber} (предыдущие ссылки отозваны).`
          : `Продюсер отправил актуальный техлист звукорежиссёру ${engineer.name}.`,
      });

      const finalOrder: CrmOrderRecord = {
        ...preUpdatedOrder,
        approvalWorkflow: {
          ...preUpdatedOrder.approvalWorkflow!,
          lastDispatchedToEngineerAt: nowIso,
          lastDispatchChannelSummary: dispatched.channelSummary,
        },
      };

      crmStore.orders[idx] = finalOrder;
      writeOrdersCrmStore(crmStore);

      res.json({
        ok: true,
        order: finalOrder,
        engineer,
        dropPath: dispatched.dropPath,
        dropUrl: dispatched.dropUrl,
        emailActionPath: dispatched.emailActionPath,
        emailActionUrl: dispatched.emailActionUrl,
        soundEngineerEmail: dispatched.emailNotification,
        soundEngineerEmails: (crmStore.soundEngineerEmails ?? []).slice(0, 30),
        sheet: dispatched.sheet,
        channelSummary: dispatched.channelSummary,
      });
    }
  );

  app.post(
    '/api/cms/orders/:orderId/approval/resolve-escalation',
    requireStudioAuth,
    express.json({ limit: '32kb' }),
    async (req, res) => {
      const { orderId } = req.params;
      const body = (req.body ?? {}) as {
        revisionId?: string;
        mode?: 'loyal_included' | 'unified_invoice_adjusted';
        note?: string;
        newTotalBudgetRub?: number;
      };

      const crmStore = readOrdersCrmStore();
      const idx = crmStore.orders.findIndex((o) => o.id === orderId);
      if (idx === -1) {
        res.status(404).json({ ok: false, error: 'Заказ не найден в реестре CRM' });
        return;
      }

      const existing = ensureOrderApprovalWorkflow(crmStore.orders[idx]);
      const mode =
        body.mode === 'unified_invoice_adjusted'
          ? 'unified_invoice_adjusted'
          : 'loyal_included';
      const nowIso = new Date().toISOString();

      const nextWorkflow = applyProducerEscalationResolution(
        existing.approvalWorkflow,
        {
          revisionId: body.revisionId,
          mode,
          note: body.note,
        },
        nowIso
      );

      let nextBudget = existing.totalBudgetRub;
      let nextDocMeta = existing.documentMeta;
      if (
        mode === 'unified_invoice_adjusted' &&
        typeof body.newTotalBudgetRub === 'number' &&
        Number.isFinite(body.newTotalBudgetRub) &&
        body.newTotalBudgetRub > 0
      ) {
        nextBudget = Math.round(body.newTotalBudgetRub);
        nextDocMeta = sanitizeOrderDocumentMeta({
          ...(existing.documentMeta ?? {}),
          customPriceRub: nextBudget,
        });
      }

      let updatedOrder: CrmOrderRecord = {
        ...existing,
        stageHistory: recordOrderStageTransition(existing, {
          timestamp: nowIso,
          previousStage: existing.stage,
          nextStage: existing.stage,
          actor: 'producer_crm',
          workflowStepLabel:
            mode === 'loyal_included'
              ? 'Эскалация закрыта (лояльный раунд без доплаты) · задача возвращена звукорежиссёру'
              : 'Эскалация согласована с обновлением единого счёта · задача передана в студию',
          note: typeof body.note === 'string' ? body.note : null,
        }),
        updatedAt: nowIso,
        totalBudgetRub: nextBudget,
        ...(nextDocMeta ? { documentMeta: nextDocMeta } : {}),
        approvalWorkflow: nextWorkflow,
      };

      // Автоматически отправляем звукорежиссёру e-mail уведомление о согласованной доработке с кнопкой «Сдать файл на проверку»
      const roster = sanitizeSoundEngineerRoster(crmStore.soundEngineers);
      const assignedEng =
        roster.find((e) => e.id === nextWorkflow.assignedEngineerId) ??
        roster.find((e) => e.isDefault) ??
        roster[0];
      let latestEngineerEmail: SoundEngineerEmailNotificationRecord | null = null;

      if (assignedEng) {
        const stageLabel =
          CRM_ORDER_STAGES.find((s) => s.id === updatedOrder.stage)?.shortLabel ??
          updatedOrder.stage;
        const dispatched = await buildAndDispatchSoundEngineerSheet({
          req,
          order: updatedOrder,
          engineer: assignedEng,
          crmStore,
          autoSendExternal: true,
          triggerReason: 'escalation_resolved',
          currentStageLabel: stageLabel,
          triggerSummary: `Продюсер согласовал доработку по заказу #${updatedOrder.orderNumber} и вернул задачу в студию звукорежиссёру.`,
        });
        latestEngineerEmail = dispatched.emailNotification;
        updatedOrder = {
          ...updatedOrder,
          approvalWorkflow: {
            ...updatedOrder.approvalWorkflow!,
            assignedEngineerId: assignedEng.id,
            lastDispatchedToEngineerAt: nowIso,
            lastDispatchChannelSummary: dispatched.channelSummary,
          },
        };
      }

      crmStore.orders[idx] = updatedOrder;
      const notif = buildApprovalWorkflowNotification({
        id: `notif-esc-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        orderNumber: updatedOrder.orderNumber,
        title: `Заказ #${updatedOrder.orderNumber}: запрос согласован продюсером`,
        body:
          mode === 'loyal_included'
            ? 'Продюсер подтвердил выполнение доработки без изменения стоимости заказа. Задача передана в студию.'
            : 'Продюсер подтвердил выполнение доработки с обновлением единого счёта без дополнительных мелких счетов. Задача в работе.',
        createdAt: nowIso,
      });
      recordAndBroadcastCabinetNotification(notif, crmStore);
      void dispatchOrderToExternalChannels(updatedOrder.id, 'order.stage_changed', {
        statusChange: {
          previousStage: existing.stage,
          nextStage: updatedOrder.stage,
          actor: 'producer_crm',
          workflowStepLabel:
            mode === 'loyal_included'
              ? 'Эскалация закрыта (лояльный раунд без доплаты) · задача возвращена звукорежиссёру'
              : 'Эскалация согласована с обновлением единого счёта · задача передана в студию',
          reasonSummary: typeof body.note === 'string' ? body.note : null,
          changedAtIso: nowIso,
        },
      });

      res.json({
        ok: true,
        order: updatedOrder,
        soundEngineerEmail: latestEngineerEmail,
        soundEngineerEmails: (crmStore.soundEngineerEmails ?? []).slice(0, 30),
      });
    }
  );

  app.get(
    '/api/cms/orders/:orderId/approval/takes/:takeId/audio',
    requireStudioAuth,
    (req, res) => {
      const { orderId, takeId } = req.params;
      const crmStore = readOrdersCrmStore();
      const found = crmStore.orders.find((o) => o.id === orderId);
      if (!found) {
        res.status(404).json({ ok: false, error: 'Заказ не найден' });
        return;
      }
      const wf = ensureOrderApprovalWorkflow(found).approvalWorkflow;
      const take = wf.pendingEngineerTakes.find((t) => t.id === takeId);
      if (!take) {
        res.status(404).json({ ok: false, error: 'Дубль звукорежиссёра не найден' });
        return;
      }
      const absPath = resolveContainedStoragePath(
        ORDER_DELIVERABLES_DIR,
        take.storageKey
      );
      if (!absPath || !fs.existsSync(absPath)) {
        res.status(404).json({ ok: false, error: 'Аудиофайл отсутствует на диске' });
        return;
      }
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Type', take.mimeType || 'audio/wav');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(path.basename(take.fileName))}"`
      );
      res.sendFile(absPath);
    }
  );

  app.post(
    '/api/cms/orders/:orderId/approval/publish-take',
    requireStudioAuth,
    express.json({ limit: '32kb' }),
    (req, res) => {
      const { orderId } = req.params;
      const body = (req.body ?? {}) as {
        takeId?: string;
        versionCode?: string;
        versionStage?: string;
        title?: string;
        versionNote?: string;
        markAccepted?: boolean;
      };

      const crmStore = readOrdersCrmStore();
      const idx = crmStore.orders.findIndex((o) => o.id === orderId);
      if (idx === -1) {
        res.status(404).json({ ok: false, error: 'Заказ не найден в реестре CRM' });
        return;
      }

      const existing = ensureOrderApprovalWorkflow(crmStore.orders[idx]);
      const wf = existing.approvalWorkflow;
      const take = wf.pendingEngineerTakes.find((t) => t.id === body.takeId);
      if (!take) {
        res.status(404).json({
          ok: false,
          error: 'Дубль звукорежиссёра не найден в буфере ОТК',
        });
        return;
      }

      const versionMeta = resolveUploadedDeliverableVersionMeta({
        kind: 'audio_master',
        mimeType: take.mimeType,
        requestedVersionCode: body.versionCode,
        requestedVersionStage: body.versionStage,
        requestedVersionNote:
          body.versionNote ||
          take.engineerNote ||
          `Проверено продюсером (${
            take.measuredDurationSec
              ? `${take.measuredDurationSec.toFixed(2)} с`
              : `${wf.targetSlotSec} с`
          })`,
        existingDeliverables: existing.deliverables ?? [],
      });

      const nowIso = new Date().toISOString();
      const deliverable: OrderDeliverableFile = {
        id: `deliv-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        title:
          typeof body.title === 'string' && body.title.trim()
            ? body.title.trim().slice(0, 140)
            : versionMeta.versionStage === 'master'
              ? `Финальный эфирный мастер (${wf.targetSlotSec} сек · −14 LUFS)`
              : `Готовый ролик ${versionMeta.versionCode ?? 'v1'} на приёмку (${wf.targetSlotSec} сек)`,
        kind: 'audio_master',
        fileName: take.fileName,
        mimeType: take.mimeType,
        sizeBytes: take.sizeBytes,
        uploadedAt: nowIso,
        ...versionMeta,
        storageKey: take.storageKey,
      };

      const nextWorkflow = applyPublishEngineerTakeToClient(
        wf,
        {
          takeId: take.id,
          deliverableId: deliverable.id,
          versionCode: versionMeta.versionCode ?? 'v1',
          markAccepted: Boolean(body.markAccepted),
        },
        nowIso
      );

      const nextStage: CrmOrderStage =
        body.markAccepted || versionMeta.versionStage === 'master'
          ? existing.stage === 'completed_ltv'
            ? 'completed_ltv'
            : 'on_air'
          : existing.stage === 'new_hold' ||
              existing.stage === 'quota_locked' ||
              existing.stage === 'edo_invoice'
            ? 'in_production'
            : existing.stage;

      const updatedOrder: CrmOrderRecord = {
        ...existing,
        stage: nextStage,
        stageHistory: recordOrderStageTransition(existing, {
          timestamp: nowIso,
          previousStage: existing.stage,
          nextStage,
          actor: 'producer_crm',
          workflowStepLabel: body.markAccepted
            ? `Мастер-дубль ${versionMeta.versionCode ?? 'v1'} утверждён продюсером и передан в выдачу`
            : `Ролик ${versionMeta.versionCode ?? 'v1'} проверен ОТК и направлен клиенту на приёмку`,
          note: deliverable.versionNote ?? null,
        }),
        updatedAt: nowIso,
        deliverables: [deliverable, ...(existing.deliverables ?? [])].slice(0, 20),
        approvalWorkflow: nextWorkflow,
      };

      crmStore.orders[idx] = updatedOrder;
      const deliverableNotif = buildDeliverableUploadedNotification({
        id: `notif-deliv-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        orderNumber: updatedOrder.orderNumber,
        deliverable,
        createdAt: nowIso,
      });
      recordAndBroadcastCabinetNotification(deliverableNotif, crmStore);
      void dispatchOrderToExternalChannels(updatedOrder.id, 'order.stage_changed', {
        statusChange: {
          previousStage: existing.stage,
          nextStage: updatedOrder.stage,
          actor: 'producer_crm',
          workflowStepLabel: body.markAccepted
            ? `Мастер-дубль ${versionMeta.versionCode ?? 'v1'} утверждён продюсером и передан в выдачу`
            : `Ролик ${versionMeta.versionCode ?? 'v1'} проверен ОТК и направлен клиенту на приёмку`,
          reasonSummary: deliverable.versionNote ?? null,
          changedAtIso: nowIso,
        },
      });

      res.json({
        ok: true,
        order: updatedOrder,
        deliverable,
      });
    }
  );

  // Решения клиента в Личном кабинете (Утверждение сценария / Сервисный раунд доводки / Приёмка ролика)
  app.post(
    '/api/orders/:orderNumber/approval/script-decision',
    express.json({ limit: '32kb' }),
    async (req, res) => {
      if (isBlockedCrossOriginMutation(req)) {
        res.status(403).json({
          ok: false,
          error: 'Кросс-доменный запрос отклонён политикой безопасности',
        });
        return;
      }

      const orderNumber = String(req.params.orderNumber || '').trim();
      const body = (req.body ?? {}) as {
        rescueToken?: string;
        action?: 'approve' | 'request_changes';
        conceptId?: string;
        comment?: string;
      };

      const crmStore = readOrdersCrmStore();
      const idx = crmStore.orders.findIndex((o) => o.orderNumber === orderNumber);
      if (idx === -1) {
        res.status(404).json({ ok: false, error: 'Заказ не найден' });
        return;
      }

      const existing = ensureOrderApprovalWorkflow(crmStore.orders[idx]);
      if (!canClientAccessOrder(req, existing, body.rescueToken, crmStore)) {
        res.status(403).json({
          ok: false,
          error: 'Недействительный ключ доступа к заказу',
        });
        return;
      }

      const nowIso = new Date().toISOString();
      try {
        const nextWorkflow =
          body.action === 'approve'
            ? applyClientScriptDecision(
                existing.approvalWorkflow,
                { action: 'approve', conceptId: body.conceptId },
                nowIso
              )
            : applyClientScriptDecision(
                existing.approvalWorkflow,
                {
                  action: 'request_changes',
                  comment: String(body.comment || ''),
                },
                nowIso
              );

        let finalWorkflow = nextWorkflow;
        const nextStage: CrmOrderStage =
          body.action === 'approve' &&
          (existing.stage === 'new_hold' ||
            existing.stage === 'quota_locked' ||
            existing.stage === 'edo_invoice')
            ? 'in_production'
            : existing.stage;

        let scriptApprovedEmail: SoundEngineerEmailNotificationRecord | null = null;
        // При утверждении сценария автоматически формируем и отправляем e-mail уведомление звукорежиссёру с кнопкой «Сдать файл на проверку»
        if (body.action === 'approve') {
          const roster = sanitizeSoundEngineerRoster(crmStore.soundEngineers);
          const assignedEng =
            roster.find((e) => e.id === nextWorkflow.assignedEngineerId) ??
            roster.find((e) => e.isDefault) ??
            roster[0];

          if (assignedEng) {
            const prevStageLabel =
              CRM_ORDER_STAGES.find((s) => s.id === existing.stage)?.shortLabel ??
              existing.stage;
            const nextStageLabel =
              CRM_ORDER_STAGES.find((s) => s.id === nextStage)?.shortLabel ??
              nextStage;
            const tempOrder: CrmOrderRecord = {
              ...existing,
              stage: nextStage,
              updatedAt: nowIso,
              approvalWorkflow: {
                ...nextWorkflow,
                assignedEngineerId: assignedEng.id,
              },
            };
            const autoSent = await buildAndDispatchSoundEngineerSheet({
              req,
              order: tempOrder,
              engineer: assignedEng,
              crmStore,
              autoSendExternal: true,
              triggerReason: 'script_approved',
              previousStageLabel: prevStageLabel,
              currentStageLabel: nextStageLabel,
              triggerSummary: `Клиент утвердил режиссёрский сценарий по заказу #${existing.orderNumber} — заказ переведён в студийное производство.`,
            });
            scriptApprovedEmail = autoSent.emailNotification;
            finalWorkflow = {
              ...nextWorkflow,
              assignedEngineerId: assignedEng.id,
              lastDispatchedToEngineerAt: nowIso,
              lastDispatchChannelSummary: autoSent.channelSummary,
            };
          }
        }

        const updatedOrder: CrmOrderRecord = {
          ...existing,
          stage: nextStage,
          stageHistory: recordOrderStageTransition(existing, {
            timestamp: nowIso,
            previousStage: existing.stage,
            nextStage,
            actor: 'client_cabinet',
            workflowStepLabel:
              body.action === 'approve'
                ? 'Клиент утвердил режиссёрский сценарий — запущена студийная запись'
                : 'Клиент направил комментарий к режиссёрскому сценарию',
            note:
              body.action === 'request_changes'
                ? String(body.comment || '')
                : null,
          }),
          updatedAt: nowIso,
          approvalWorkflow: finalWorkflow,
        };

        crmStore.orders[idx] = updatedOrder;
        writeOrdersCrmStore(crmStore);
        void dispatchOrderToExternalChannels(
          updatedOrder.id,
          'order.stage_changed',
          {
            statusChange: {
              previousStage: existing.stage,
              nextStage: updatedOrder.stage,
              actor: 'client_cabinet',
              workflowStepLabel:
                body.action === 'approve'
                  ? 'Клиент утвердил режиссёрский сценарий — запущена студийная запись'
                  : 'Клиент направил комментарий к режиссёрскому сценарию',
              reasonSummary:
                body.action === 'request_changes'
                  ? String(body.comment || '')
                  : null,
              changedAtIso: nowIso,
            },
          }
        );

        const effectiveRescueToken = issueOrderRescueToken(updatedOrder.orderNumber);
        res.json({
          ok: true,
          order: toClientCabinetOrderSummary(
            updatedOrder,
            effectiveRescueToken,
            sanitizeStudioLegalProfilesConfig(crmStore.legalProfiles)
          ),
          dispatchedToEngineer: Boolean(scriptApprovedEmail),
        });
      } catch (err) {
        res.status(400).json({
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : 'Не удалось сохранить решение по сценарию',
        });
      }
    }
  );

  app.post(
    '/api/orders/:orderNumber/approval/spot-decision',
    express.json({ limit: '32kb' }),
    async (req, res) => {
      if (isBlockedCrossOriginMutation(req)) {
        res.status(403).json({
          ok: false,
          error: 'Кросс-доменный запрос отклонён политикой безопасности',
        });
        return;
      }

      const orderNumber = String(req.params.orderNumber || '').trim();
      const body = (req.body ?? {}) as {
        rescueToken?: string;
        action?: 'accept' | 'request_revision';
        deliverableId?: string;
        kind?: SpotRevisionKind;
        timecodeSec?: number | null;
        comment?: string;
      };

      const crmStore = readOrdersCrmStore();
      const idx = crmStore.orders.findIndex((o) => o.orderNumber === orderNumber);
      if (idx === -1) {
        res.status(404).json({ ok: false, error: 'Заказ не найден' });
        return;
      }

      const existing = ensureOrderApprovalWorkflow(crmStore.orders[idx]);
      if (!canClientAccessOrder(req, existing, body.rescueToken, crmStore)) {
        res.status(403).json({
          ok: false,
          error: 'Недействительный ключ доступа к заказу',
        });
        return;
      }

      const validKinds: readonly SpotRevisionKind[] = [
        'balance_timecode',
        'music_replacement',
        'text_change_escalation',
      ];
      const kind: SpotRevisionKind = validKinds.includes(
        body.kind as SpotRevisionKind
      )
        ? (body.kind as SpotRevisionKind)
        : 'balance_timecode';

      const nowIso = new Date().toISOString();
      try {
        const result =
          body.action === 'accept'
            ? applyClientSpotDecision(
                existing.approvalWorkflow,
                {
                  action: 'accept',
                  deliverableId:
                    body.deliverableId ?? existing.deliverables?.[0]?.id ?? null,
                },
                nowIso
              )
            : applyClientSpotDecision(
                existing.approvalWorkflow,
                {
                  action: 'request_revision',
                  revisionId: `rev-${Date.now()}-${crypto
                    .randomBytes(3)
                    .toString('hex')}`,
                  kind,
                  timecodeSec:
                    typeof body.timecodeSec === 'number' ? body.timecodeSec : null,
                  comment: String(body.comment || ''),
                },
                nowIso
              );

        const nextStage: CrmOrderStage =
          result.routedTo === 'accepted'
            ? existing.stage === 'completed_ltv'
              ? 'completed_ltv'
              : 'on_air'
            : existing.stage;

        let finalWorkflow = result.workflow;
        let spotRevisionEmail: SoundEngineerEmailNotificationRecord | null = null;

        if (result.routedTo === 'sound_engineer_included_round') {
          const roster = sanitizeSoundEngineerRoster(crmStore.soundEngineers);
          const assignedEng =
            roster.find((e) => e.id === finalWorkflow.assignedEngineerId) ??
            roster.find((e) => e.isDefault) ??
            roster[0];
          if (assignedEng) {
            const stageLabel =
              CRM_ORDER_STAGES.find((s) => s.id === nextStage)?.shortLabel ??
              nextStage;
            const tempOrder: CrmOrderRecord = {
              ...existing,
              stage: nextStage,
              updatedAt: nowIso,
              approvalWorkflow: {
                ...finalWorkflow,
                assignedEngineerId: assignedEng.id,
              },
            };
            const autoSent = await buildAndDispatchSoundEngineerSheet({
              req,
              order: tempOrder,
              engineer: assignedEng,
              crmStore,
              autoSendExternal: true,
              triggerReason: 'revision_requested',
              currentStageLabel: stageLabel,
              triggerSummary: `Клиент запросил сервисный раунд доводки по заказу #${existing.orderNumber} — комментарий передан звукорежиссёру.`,
            });
            spotRevisionEmail = autoSent.emailNotification;
            finalWorkflow = {
              ...finalWorkflow,
              assignedEngineerId: assignedEng.id,
              lastDispatchedToEngineerAt: nowIso,
              lastDispatchChannelSummary: autoSent.channelSummary,
            };
          }
        }

        const updatedOrder: CrmOrderRecord = {
          ...existing,
          stage: nextStage,
          stageHistory: recordOrderStageTransition(existing, {
            timestamp: nowIso,
            previousStage: existing.stage,
            nextStage,
            actor: 'client_cabinet',
            workflowStepLabel:
              result.routedTo === 'accepted'
                ? 'Клиент принял готовый аудиоролик без замечаний'
                : result.routedTo === 'producer_escalation'
                  ? 'Клиент запросил изменение текста после записи — требуется решение продюсера'
                  : 'Клиент запросил сервисный раунд доводки сведения/музыки',
            note:
              body.action === 'request_revision'
                ? String(body.comment || '')
                : null,
          }),
          updatedAt: nowIso,
          compliance:
            result.routedTo === 'accepted'
              ? { ...existing.compliance, rightsPassportIssued: true }
              : existing.compliance,
          approvalWorkflow: finalWorkflow,
        };

        crmStore.orders[idx] = updatedOrder;
        writeOrdersCrmStore(crmStore);
        void dispatchOrderToExternalChannels(
          updatedOrder.id,
          'order.stage_changed',
          {
            statusChange: {
              previousStage: existing.stage,
              nextStage: updatedOrder.stage,
              actor: 'client_cabinet',
              workflowStepLabel:
                result.routedTo === 'accepted'
                  ? 'Клиент принял готовый аудиоролик без замечаний'
                  : result.routedTo === 'producer_escalation'
                    ? 'Клиент запросил изменение текста после записи — требуется решение продюсера'
                    : 'Клиент запросил сервисный раунд доводки сведения/музыки',
              reasonSummary:
                body.action === 'request_revision'
                  ? String(body.comment || '')
                  : null,
              changedAtIso: nowIso,
            },
          }
        );

        const effectiveRescueToken = issueOrderRescueToken(updatedOrder.orderNumber);
        res.json({
          ok: true,
          routedTo: result.routedTo,
          order: toClientCabinetOrderSummary(
            updatedOrder,
            effectiveRescueToken,
            sanitizeStudioLegalProfilesConfig(crmStore.legalProfiles)
          ),
          dispatchedToEngineer: Boolean(spotRevisionEmail),
        });
      } catch (err) {
        res.status(400).json({
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : 'Не удалось обработать решение по ролику',
        });
      }
    }
  );

  // Обработчик нажатия на кнопку «Сдать файл на проверку» в e-mail уведомлении звукорежиссёру:
  // При переходе генерирует свежую уникальную ссылку-токен (/sound-drop?token=...) для прямой сдачи мастер-файла без авторизации в админ-панели.
  const handleSoundDropFromEmailButton = (req: Request, res: Response) => {
    const rawGrant =
      typeof req.query.grant === 'string' && req.query.grant.trim()
        ? req.query.grant.trim()
        : typeof (req.body as { grant?: unknown } | undefined)?.grant === 'string'
          ? String((req.body as { grant?: string }).grant).trim()
          : '';

    const crmStore = readOrdersCrmStore();
    const prelimVerified = verifySoundEngineerEmailGrantWithSigner(
      rawGrant,
      signSoundDropHmac,
      Date.now()
    );
    if (!prelimVerified.ok) {
      res.status(403).json({
        ok: false,
        reason: prelimVerified.reason,
        error:
          prelimVerified.reason === 'expired'
            ? 'Срок действия кнопки из письма истёк — запросите свежее уведомление у продюсера.'
            : 'Недействительный токен кнопки из письма звукорежиссёра.',
      });
      return;
    }

    const found = crmStore.orders.find(
      (o) => o.id === prelimVerified.payload.orderId
    );
    if (!found) {
      res.status(404).json({ ok: false, error: 'Заказ не найден в студии' });
      return;
    }

    const hydrated = ensureOrderApprovalWorkflow(found);
    const verified = verifySoundEngineerEmailGrantWithSigner(
      rawGrant,
      signSoundDropHmac,
      Date.now(),
      { expectedGeneration: hydrated.approvalWorkflow.dropTokenGeneration }
    );
    if (!verified.ok) {
      res.status(403).json({
        ok: false,
        reason: verified.reason,
        error:
          'Эта ссылка из письма была отозвана при смене звукорежиссёра — используйте последнее письмо.',
      });
      return;
    }

    // Генерируем уникальную ссылку-токен специально для этого нажатия кнопки «Сдать файл на проверку»
    const uniqueExpMs =
      Date.now() + 7 * 24 * 60 * 60 * 1000 + crypto.randomInt(1, 999);
    const freshDropToken = issueSoundDropTokenWithSigner(
      {
        orderId: hydrated.id,
        orderNumber: hydrated.orderNumber,
        engineerId: verified.payload.engineerId,
        engineerName: verified.payload.engineerName,
        gen: hydrated.approvalWorkflow.dropTokenGeneration,
        expMs: uniqueExpMs,
      },
      signSoundDropHmac
    );

    const dropPath = `/sound-drop?token=${encodeURIComponent(freshDropToken)}`;
    const origin = resolveSafePublicOrigin({
      configuredOrigin: process.env.PUBLIC_ORIGIN,
      hostHeader: req.headers.host,
      forwardedHost: req.headers['x-forwarded-host'],
      protocol: req.protocol,
      forwardedProto: req.headers['x-forwarded-proto'],
      trustProxy: process.env.TRUST_PROXY === 'true',
      fallbackOrigin: `http://localhost:${PORT}`,
    });
    const dropUrl = `${origin}${dropPath}`;
    const nowIso = new Date().toISOString();

    if (Array.isArray(crmStore.soundEngineerEmails)) {
      const mailIdx = crmStore.soundEngineerEmails.findIndex(
        (m) =>
          m.orderId === hydrated.id &&
          m.engineerId === verified.payload.engineerId
      );
      if (mailIdx !== -1) {
        const rec = crmStore.soundEngineerEmails[mailIdx];
        crmStore.soundEngineerEmails[mailIdx] = {
          ...rec,
          clickedCount: (rec.clickedCount ?? 0) + 1,
          lastClickedAt: nowIso,
          lastIssuedDropUrl: dropUrl,
        };
        writeOrdersCrmStore(crmStore);
      }
    }

    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'POST' || req.query.format === 'json') {
      res.json({
        ok: true,
        orderNumber: hydrated.orderNumber,
        engineerName: verified.payload.engineerName,
        dropToken: freshDropToken,
        dropPath,
        dropUrl,
      });
      return;
    }

    res.redirect(302, dropPath);
  };

  app.get('/api/sound-drop/from-email', handleSoundDropFromEmailButton);
  app.post(
    '/api/sound-drop/from-email',
    express.json({ limit: '16kb' }),
    handleSoundDropFromEmailButton
  );

  const sharedProposalsCreateLimiter = new RateLimiter({
    maxAttempts: 15,
    windowMs: 60_000,
    minIntervalMs: 300,
  });
  let cachedSharedProposals: SharedB2bProposalRecord[] | null = null;

  const signSharedProposalHmac = (msg: string): string =>
    crypto
      .createHmac('sha256', `${getSessionSecret()}:shared_kp_v1`)
      .update(msg, 'utf8')
      .digest('hex');

  const readSharedProposalsList = (): SharedB2bProposalRecord[] => {
    if (cachedSharedProposals) return cachedSharedProposals;
    try {
      if (!fs.existsSync(SHARED_PROPOSALS_FILE)) {
        cachedSharedProposals = [];
        return cachedSharedProposals;
      }
      const raw = JSON.parse(fs.readFileSync(SHARED_PROPOSALS_FILE, 'utf8'));
      cachedSharedProposals = Array.isArray(raw)
        ? (raw as SharedB2bProposalRecord[])
        : [];
      return cachedSharedProposals;
    } catch {
      cachedSharedProposals = [];
      return cachedSharedProposals;
    }
  };

  const writeSharedProposalsList = (records: SharedB2bProposalRecord[]): void => {
    const nowMs = Date.now();
    const pruned = records
      .filter((r) => {
        const exp = Date.parse(r.expiresAtIso);
        return !Number.isFinite(exp) || exp > nowMs;
      })
      .slice(-500);
    cachedSharedProposals = pruned;
    try {
      fs.mkdirSync(CMS_DATA_DIR, { recursive: true });
      const tmp = path.join(
        CMS_DATA_DIR,
        `.shared-kp.${Date.now()}.${Math.random().toString(36).slice(2, 7)}.tmp`
      );
      fs.writeFileSync(tmp, JSON.stringify(pruned, null, 2), {
        encoding: 'utf8',
        mode: 0o600,
      });
      fs.renameSync(tmp, SHARED_PROPOSALS_FILE);
    } catch {
      // В контейнере только для чтения сохраняем в оперативной памяти процесса
    }
  };

  // Публичная генерация обезличенной ссылки КП для руководителя (строго 0 ПДн по 152-ФЗ)
  app.post(
    '/api/public/shared-proposals',
    express.json({ limit: '24kb' }),
    (req, res) => {
      if (isBlockedCrossOriginMutation(req)) {
        res.status(403).json({
          ok: false,
          error: 'Кросс-доменный запрос отклонён политикой безопасности',
        });
        return;
      }

      const rate = sharedProposalsCreateLimiter.consume(resolveClientIp(req));
      if (!rate.allowed) {
        res.setHeader('Retry-After', String(rate.retryAfterSec));
        res.status(429).json({
          ok: false,
          error: 'Слишком частое создание ссылок КП. Подождите минуту.',
        });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const crmStore = readOrdersCrmStore();
      const shareIdHex = crypto.randomBytes(8).toString('hex');

      const record = createZeroPdnSharedProposalRecord({
        input: {
          selectedFormatId:
            typeof body.selectedFormatId === 'string'
              ? body.selectedFormatId
              : null,
          spotDurationSec:
            typeof body.spotDurationSec === 'number'
              ? body.spotDurationSec
              : Number(body.spotDurationSec) || 20,
          selectedVoiceId:
            typeof body.selectedVoiceId === 'string'
              ? body.selectedVoiceId
              : null,
          industrySlug:
            typeof body.industrySlug === 'string' ? body.industrySlug : null,
          briefText: typeof body.briefText === 'string' ? body.briefText : '',
          companyName:
            typeof body.companyName === 'string' ? body.companyName : '',
          existingOrderNumber:
            typeof body.existingOrderNumber === 'string'
              ? body.existingOrderNumber
              : null,
          customBudgetRub:
            typeof body.customBudgetRub === 'number'
              ? body.customBudgetRub
              : null,
        },
        shareIdHex,
        signHmacHex: signSharedProposalHmac,
        legalProfiles: crmStore.legalProfiles,
      });

      const list = readSharedProposalsList();
      list.push(record);
      writeSharedProposalsList(list);

      const sharePath = `/proposal?token=${encodeURIComponent(record.token)}`;
      const origin = resolveSafePublicOrigin({
        configuredOrigin: process.env.PUBLIC_ORIGIN,
        hostHeader: req.headers.host,
        forwardedHost: req.headers['x-forwarded-host'],
        protocol: req.protocol,
        forwardedProto: req.headers['x-forwarded-proto'],
        trustProxy: process.env.TRUST_PROXY === 'true',
        fallbackOrigin: `http://localhost:${PORT}`,
      });
      const { token: _secretToken, ...publicView } = record;
      void _secretToken;

      res.setHeader('Cache-Control', 'no-store');
      res.status(201).json({
        ok: true,
        token: record.token,
        sharePath,
        shareUrl: `${origin}${sharePath}`,
        proposal: publicView,
      });
    }
  );

  app.get('/api/public/shared-proposals/:token', (req, res) => {
    const rawToken = sanitizeSharedProposalToken(req.params.token);
    if (!rawToken) {
      res.status(404).json({
        ok: false,
        reason: 'invalid_format',
        error: 'Ссылка коммерческого предложения недействительна или устарела.',
      });
      return;
    }

    const targetShareId = rawToken.split('.')[0];
    const list = readSharedProposalsList();
    const matched = list.find((item) => item.shareId === targetShareId) ?? null;

    const verified = verifySharedProposalRecordToken({
      rawToken,
      record: matched,
      signHmacHex: signSharedProposalHmac,
    });

    if (!verified.ok) {
      res.status(verified.reason === 'expired' ? 410 : 404).json({
        ok: false,
        reason: verified.reason,
        error:
          verified.reason === 'expired'
            ? 'Срок действия защищённой ссылки КП (14 дней) истёк. Сформируйте актуальное КП на странице заказа.'
            : 'Карточка коммерческого предложения не найдена или ссылка повреждена.',
      });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      proposal: verified.view,
    });
  });

  // Однокнопочный шлюз прямой сдачи файла для звукорежиссёра (/api/sound-drop/* — без админки и без ПДн клиента)
  app.get('/api/sound-drop/session', (req, res) => {
    const rawToken =
      typeof req.query.token === 'string' ? req.query.token.trim() : '';
    const verified = verifySoundDropTokenWithSigner(
      rawToken,
      signSoundDropHmac,
      Date.now()
    );
    if (!verified.ok) {
      res.status(403).json({
        ok: false,
        reason: verified.reason,
        error:
          verified.reason === 'expired'
            ? 'Срок действия ссылки сдачи файла истёк — запросите актуальную ссылку у продюсера.'
            : 'Ссылка прямой сдачи недействительна или была обновлена продюсером.',
      });
      return;
    }

    const crmStore = readOrdersCrmStore();
    const found = crmStore.orders.find((o) => o.id === verified.payload.orderId);
    if (!found) {
      res.status(404).json({ ok: false, error: 'Заказ не найден в студии' });
      return;
    }

    const hydrated = ensureOrderApprovalWorkflow(found);
    if (hydrated.approvalWorkflow.dropTokenGeneration !== verified.payload.gen) {
      res.status(403).json({
        ok: false,
        reason: 'revoked',
        error:
          'Эта ссылка сдачи была отозвана при смене исполнителя — используйте актуальное письмо от продюсера.',
      });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      task: toSoundDropTaskPublicView({
        orderNumber: hydrated.orderNumber,
        engineerId: verified.payload.engineerId,
        engineerName: verified.payload.engineerName,
        workflow: hydrated.approvalWorkflow,
      }),
    });
  });

  app.post(
    '/api/sound-drop/upload',
    express.raw({ type: () => true, limit: '60mb' }),
    (req, res) => {
      if (isBlockedCrossOriginMutation(req)) {
        res.status(403).json({
          ok: false,
          error: 'Кросс-доменная загрузка отклонена политикой безопасности',
        });
        return;
      }

      const rate = soundDropUploadLimiter.consume(resolveClientIp(req));
      if (!rate.allowed) {
        res.setHeader('Retry-After', String(rate.retryAfterSec));
        res.status(429).json({
          ok: false,
          error: 'Слишком частая отправка файлов. Подождите несколько секунд.',
        });
        return;
      }

      const rawToken = String(req.headers['x-drop-token'] || '').trim();
      const verified = verifySoundDropTokenWithSigner(
        rawToken,
        signSoundDropHmac,
        Date.now()
      );
      if (!verified.ok) {
        res.status(403).json({
          ok: false,
          error: 'Ссылка сдачи файла недействительна или просрочена.',
        });
        return;
      }

      const crmStore = readOrdersCrmStore();
      const idx = crmStore.orders.findIndex(
        (o) => o.id === verified.payload.orderId
      );
      if (idx === -1) {
        res.status(404).json({ ok: false, error: 'Заказ не найден' });
        return;
      }

      const existing = ensureOrderApprovalWorkflow(crmStore.orders[idx]);
      if (existing.approvalWorkflow.dropTokenGeneration !== verified.payload.gen) {
        res.status(403).json({
          ok: false,
          error: 'Ссылка сдачи была отозвана при смене звукорежиссёра.',
        });
        return;
      }

      const bodyBuf = Buffer.isBuffer(req.body) ? req.body : null;
      if (!bodyBuf || bodyBuf.length < 44) {
        res.status(400).json({
          ok: false,
          error: 'Передан пустой или повреждённый аудиофайл.',
        });
        return;
      }
      if (bodyBuf.length > 60 * 1024 * 1024) {
        res.status(413).json({
          ok: false,
          error: 'Размер файла превышает 60 МБ.',
        });
        return;
      }

      if (!verifyAudioMagicBytes(bodyBuf)) {
        res.status(400).json({
          ok: false,
          error:
            'Файл не прошёл проверку сигнатуры аудиоформата. Загрузите оригинальный WAV, MP3, OGG или M4A.',
        });
        return;
      }

      let rawFileName = 'master_take.wav';
      try {
        const hdrName = String(req.headers['x-file-name'] || '').trim();
        if (hdrName) {
          rawFileName = decodeURIComponent(hdrName);
        }
      } catch {
        rawFileName = 'master_take.wav';
      }

      let engineerNote = '';
      try {
        const hdrNote = String(req.headers['x-engineer-note'] || '').trim();
        if (hdrNote) {
          engineerNote = decodeURIComponent(hdrNote).slice(0, 500);
        }
      } catch {
        engineerNote = '';
      }

      const rawExt = path.extname(rawFileName).toLowerCase();
      const allowedAudioExts = new Set(['.wav', '.mp3', '.ogg', '.m4a']);
      const ext = allowedAudioExts.has(rawExt) ? rawExt : '.wav';
      const cleanStem =
        path
          .basename(rawFileName, rawExt)
          .replace(/[^a-zA-Z0-9А-Яа-яЁё_-]+/g, '_')
          .slice(0, 64) || 'spot_take';
      const safeFileName = `${cleanStem}${ext}`;
      const storageKey = `${existing.orderNumber.replace(/[^A-Za-z0-9_-]/g, '')}_take_${Date.now()}_${crypto
        .randomBytes(3)
        .toString('hex')}${ext}`;

      fs.mkdirSync(ORDER_DELIVERABLES_DIR, { recursive: true });
      const targetPath = resolveContainedStoragePath(
        ORDER_DELIVERABLES_DIR,
        storageKey
      );
      if (!targetPath) {
        res.status(400).json({ ok: false, error: 'Недопустимое имя файла' });
        return;
      }
      fs.writeFileSync(targetPath, bodyBuf);

      const serverWavSec = parseWavExactDurationSec(bodyBuf);
      const clientMeasuredRaw = Number.parseFloat(
        String(req.headers['x-measured-duration'] || '')
      );
      const measuredDurationSec =
        serverWavSec !== null
          ? serverWavSec
          : Number.isFinite(clientMeasuredRaw) &&
              clientMeasuredRaw > 0 &&
              clientMeasuredRaw <= 600
            ? Math.round(clientMeasuredRaw * 100) / 100
            : null;

      const nowIso = new Date().toISOString();
      const takeId = `take-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      const nextWorkflow = applyRecordEngineerTake(
        existing.approvalWorkflow,
        {
          id: takeId,
          engineerId: verified.payload.engineerId,
          engineerName: verified.payload.engineerName,
          fileName: safeFileName,
          mimeType: inferMimeTypeByExt(ext),
          sizeBytes: bodyBuf.length,
          storageKey,
          measuredDurationSec,
          engineerNote,
        },
        nowIso
      );

      const updatedOrder: CrmOrderRecord = {
        ...existing,
        stageHistory: recordOrderStageTransition(existing, {
          timestamp: nowIso,
          previousStage: existing.stage,
          nextStage: existing.stage,
          actor: 'sound_engineer',
          actorName: verified.payload.engineerName,
          workflowStepLabel: `Звукорежиссёр (${verified.payload.engineerName}) сдал дубль «${safeFileName}» на проверку продюсеру`,
          note: engineerNote || null,
        }),
        updatedAt: nowIso,
        approvalWorkflow: nextWorkflow,
      };
      crmStore.orders[idx] = updatedOrder;
      writeOrdersCrmStore(crmStore);
      void dispatchOrderToExternalChannels(updatedOrder.id, 'order.stage_changed', {
        statusChange: {
          previousStage: existing.stage,
          nextStage: updatedOrder.stage,
          actor: 'sound_engineer',
          workflowStepLabel: `Звукорежиссёр (${verified.payload.engineerName}) сдал дубль «${safeFileName}» на проверку продюсеру`,
          reasonSummary: engineerNote || null,
          changedAtIso: nowIso,
        },
      });

      const uploadedTake = nextWorkflow.pendingEngineerTakes[0]!;
      res.json({
        ok: true,
        take: {
          id: uploadedTake.id,
          fileName: uploadedTake.fileName,
          sizeBytes: uploadedTake.sizeBytes,
          measuredDurationSec: uploadedTake.measuredDurationSec,
          targetSlotSec: uploadedTake.targetSlotSec,
          slotMatchStatus: uploadedTake.slotMatchStatus,
          uploadedAt: uploadedTake.uploadedAt,
        },
        task: toSoundDropTaskPublicView({
          orderNumber: updatedOrder.orderNumber,
          engineerId: verified.payload.engineerId,
          engineerName: verified.payload.engineerName,
          workflow: nextWorkflow,
        }),
      });
    }
  );

  app.put(
    '/api/cms/orders-dispatch/settings',
    requireStudioAuth,
    express.json({ limit: '32kb' }),
    async (req, res) => {
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
        const ssrfCheck = validateOutboundWebhookTarget(incomingWebhookUrl, {
          allowInternalLoopbackSink: true,
          localPort: PORT,
        });
        if (!ssrfCheck.ok || !ssrfCheck.url) {
          recordSecurityAudit(
            'ssrf_target_blocked',
            req,
            `Заблокирован небезопасный Webhook URL: ${incomingWebhookUrl.slice(0, 80)}`
          );
          res.status(400).json({
            ok: false,
            error: ssrfCheck.reason ?? 'Указанный URL вебхука заблокирован политикой SSRF.',
          });
          return;
        }
        if (!ssrfCheck.isInternalLoopbackSink) {
          try {
            const addrs = await dns.lookup(ssrfCheck.url.hostname, { all: true });
            if (!addrs.length || addrs.some((a) => isPrivateOrReservedIp(a.address))) {
              recordSecurityAudit(
                'ssrf_target_blocked',
                req,
                `DNS Webhook разрешился во внутренний IP: ${ssrfCheck.url.hostname}`
              );
              res.status(400).json({
                ok: false,
                error: 'SSRF-блокировка: домен приёмника разрешается в приватный или loopback IP-адрес.',
              });
              return;
            }
          } catch {
            // Допускаем временную недоступность DNS на этапе сохранения настроек
          }
        }
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

      const incomingChatId =
        typeof body.telegram?.chatId === 'string'
          ? body.telegram.chatId.trim().slice(0, 90)
          : prevTg.chatId;
      const chatIdChangedManual =
        typeof body.telegram?.chatId === 'string' &&
        incomingChatId !== prevTg.chatId;

      crmStore.settings = {
        telegram: {
          enabled:
            typeof body.telegram?.enabled === 'boolean'
              ? body.telegram.enabled
              : prevTg.enabled,
          enabledExplicitlySet:
            typeof body.telegram?.enabled === 'boolean'
              ? true
              : prevTg.enabledExplicitlySet === true,
          botToken: nextBotToken,
          chatId: incomingChatId,
          chatIdAutoDiscovered: chatIdChangedManual
            ? false
            : Boolean(prevTg.chatIdAutoDiscovered && incomingChatId),
          discoveredChatTitle: chatIdChangedManual
            ? ''
            : prevTg.discoveredChatTitle ?? '',
          notifyOnNewOrder:
            typeof body.telegram?.notifyOnNewOrder === 'boolean'
              ? body.telegram.notifyOnNewOrder
              : prevTg.notifyOnNewOrder,
          notifyOnStageChange:
            typeof body.telegram?.notifyOnStageChange === 'boolean'
              ? body.telegram.notifyOnStageChange
              : prevTg.notifyOnStageChange,
          maskPdnInExternalAlerts: true,
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
          telegram: buildAdminTelegramSettingsView(crmStore),
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

  app.post(
    '/api/cms/orders-dispatch/detect-telegram-chat',
    requireStudioAuth,
    async (_req, res) => {
      const crmStore = readOrdersCrmStore();
      const resolvedTg = resolveEffectiveTelegramSettings(
        crmStore.settings.telegram,
        process.env
      );
      if (!resolvedTg.hasBotToken) {
        res.status(400).json({
          ok: false,
          error:
            'Переменная окружения TELEGRAM_ORDERS_BOT_TOKEN не задана на сервере. Добавьте токен бота в окружение и перезапустите сервер.',
        });
        return;
      }

      const discovered = await discoverAndPersistTelegramChatId(
        resolvedTg.botToken,
        crmStore
      );
      if (!discovered) {
        res.status(404).json({
          ok: false,
          error:
            'Входящих событий у бота не обнаружено. Отправьте боту /start в Telegram или напишите сообщение в рабочую группу с ботом, затем нажмите кнопку повторно.',
        });
        return;
      }

      res.json({
        ok: true,
        discovered,
        settings: {
          telegram: buildAdminTelegramSettingsView(crmStore),
          webhook: {
            enabled: crmStore.settings.webhook.enabled,
            endpointUrl: crmStore.settings.webhook.endpointUrl,
            hasHmacSecret: Boolean(crmStore.settings.webhook.hmacSecret.trim()),
            maskedHmacSecret: maskSecretForAdmin(
              crmStore.settings.webhook.hmacSecret
            ),
            notifyOnNewOrder: crmStore.settings.webhook.notifyOnNewOrder,
            notifyOnStageChange: crmStore.settings.webhook.notifyOnStageChange,
          },
          workSchedule: sanitizeWorkScheduleConfig(crmStore.settings.workSchedule),
        },
      });
    }
  );

  app.post(
    '/api/cms/orders-dispatch/test',
    requireStudioAuth,
    express.json({ limit: '16kb' }),
    async (req, res) => {
      const body = (req.body ?? {}) as {
        event?: 'dispatch.test' | 'order.stage_changed';
        orderId?: string;
      };
      const crmStore = readOrdersCrmStore();
      const sampleOrder =
        (body.orderId
          ? crmStore.orders.find((o) => o.id === body.orderId)
          : undefined) ?? crmStore.orders[0];
      if (!sampleOrder) {
        res
          .status(400)
          .json({ ok: false, error: 'Нет заказов для контрольной проверки' });
        return;
      }

      const testEvent: CrmDispatchEvent =
        body.event === 'order.stage_changed'
          ? 'order.stage_changed'
          : 'dispatch.test';
      const simulatedPrevStage: CrmOrderStage =
        sampleOrder.stage === 'new_hold' ? 'new_hold' : 'new_hold';
      const simulatedNextStage: CrmOrderStage =
        sampleOrder.stage === 'new_hold' ? 'quota_locked' : sampleOrder.stage;

      const result = await dispatchOrderToExternalChannels(
        sampleOrder.id,
        testEvent,
        {
          forceSend: true,
          statusChange:
            testEvent === 'order.stage_changed'
              ? {
                  previousStage: simulatedPrevStage,
                  nextStage: simulatedNextStage,
                  actor: 'producer_crm',
                  workflowStepLabel:
                    'Контрольная проверка мгновенного уведомления о смене статуса',
                  changedAtIso: new Date().toISOString(),
                }
              : undefined,
        }
      );
      const updated = readOrdersCrmStore();
      res.json({
        ok: true,
        event: testEvent,
        result,
        dispatchLogs: updated.dispatchLogs.slice(0, 25),
      });
    }
  );

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
      auditEvents: store.auditEvents.slice(0, 40),
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
        const hint = await requestGeminiMediaAdvisorHint(
          apiKey,
          {
            niche,
            segment,
            ageCore,
            listeningContext,
            budgetRub,
            spotSeconds,
            productNote,
          },
          (reason) => scanEditorialWarnings(reason).length === 0
        );

        res.json({
          ok: true,
          usedGeminiModel: true,
          hint,
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
    requireStudioAuth,
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
        recordSecurityAudit(
          'upload_rejected_magic_bytes',
          req,
          `Отклонена загрузка дуэльного трека (${kind}): некорректные magic bytes`
        );
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
        recordSecurityAudit('duel_track_uploaded', req, `Обновлён эталонный трек дуэли (${kind})`);
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
    app.get('/assets/aistudio/:legacyWavName', (req, res, next) => {
      const rawName = path.basename(String(req.params.legacyWavName || ''));
      if (!rawName || !/\.wav$/i.test(rawName)) {
        next();
        return;
      }
      const exactWav = path.join(publicAssetsRoot, 'aistudio', rawName);
      if (fs.existsSync(exactWav)) {
        next();
        return;
      }
      const migratedMp3 = path.join(
        publicAssetsRoot,
        'aistudio',
        rawName.replace(/\.wav$/i, '.mp3')
      );
      if (fs.existsSync(migratedMp3)) {
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.sendFile(migratedMp3);
        return;
      }
      next();
    });
    app.use('/assets', express.static(publicAssetsRoot, { maxAge: '1d' }));
  }

  const resolveRequestPublicOrigin = (req: Request): string =>
    resolveSafePublicOrigin({
      configuredOrigin: process.env.PUBLIC_ORIGIN,
      hostHeader: req.headers.host,
      forwardedHost: req.headers['x-forwarded-host'],
      protocol: req.protocol,
      forwardedProto: req.headers['x-forwarded-proto'],
      trustProxy: process.env.TRUST_PROXY === 'true',
      fallbackOrigin: 'https://fmworks.ru',
    });

  const sendCompressibleText = (
    req: Request,
    res: Response,
    contentType: string,
    payload: string,
    cacheControl?: string,
    statusCode = 200
  ) => {
    res.status(statusCode);
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
      buildRobotsTxt(resolveRequestPublicOrigin(req), {
        airtimeEnabled: AIRTIME_SALES_ENABLED,
      }),
      'public, max-age=3600'
    );
  });

  app.get('/llms.txt', (req, res) => {
    sendCompressibleText(
      req,
      res,
      'text/plain; charset=utf-8',
      buildLlmsTxt(resolveRequestPublicOrigin(req)),
      'public, max-age=3600'
    );
  });

  app.get('/sitemap.xml', (req, res) => {
    const cms = readPersistedCmsSnapshot();
    sendCompressibleText(
      req,
      res,
      'application/xml; charset=utf-8',
      buildSitemapXml(resolveRequestPublicOrigin(req), {
        airtimeEnabled: AIRTIME_SALES_ENABLED,
        cmsCases: cms?.portfolioCases,
        flagshipReel: cms?.flagshipReel,
        lastmodIsoDate: cms?.updatedAt,
      }),
      'public, max-age=3600'
    );
  });

  app.get(['/turbo-pages.xml', '/turbo.xml'], (req, res) => {
    const cms = readPersistedCmsSnapshot();
    sendCompressibleText(
      req,
      res,
      'application/rss+xml; charset=utf-8',
      buildTurboPagesXml(resolveRequestPublicOrigin(req), {
        cmsCases: cms?.portfolioCases,
      }),
      'public, max-age=3600'
    );
  });

  app.get('/cabinet-push-sw.js', (_req, res) => {
    const distSwPath = path.join(__dirname, 'dist', 'cabinet-push-sw.js');
    const publicSwPath = path.join(__dirname, 'public', 'cabinet-push-sw.js');
    const resolvedSwPath = fs.existsSync(distSwPath) ? distSwPath : publicSwPath;
    if (!fs.existsSync(resolvedSwPath)) {
      res.status(404).type('text/plain').send('Not Found');
      return;
    }
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(resolvedSwPath);
  });

  app.get('/api/og.png', (req, res) => {
    try {
      const requestedRoute =
        typeof req.query.route === 'string'
          ? req.query.route
          : typeof req.query.path === 'string'
            ? req.query.path
            : '/';
      const cms = readPersistedCmsSnapshot();
      const { png } = renderOgPngForRoute(__dirname, requestedRoute, {
        cmsCases: cms?.portfolioCases,
        flagshipReel: cms?.flagshipReel,
        cacheKeySuffix: cms?.updatedAt ?? 'static',
      });
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(png);
    } catch (err) {
      console.error('[OG PNG] Failed to render OpenGraph image:', err);
      res.status(500).type('text/plain').send('Failed to render OpenGraph image');
    }
  });

  app.get('/api/og.svg', (req, res) => {
    try {
      const requestedRoute =
        typeof req.query.route === 'string'
          ? req.query.route
          : typeof req.query.path === 'string'
            ? req.query.path
            : '/';
      const cms = readPersistedCmsSnapshot();
      const { svg } = renderOgSvgForRoute(__dirname, requestedRoute, {
        cmsCases: cms?.portfolioCases,
        flagshipReel: cms?.flagshipReel,
      });
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(svg);
    } catch (err) {
      console.error('[OG SVG] Failed to render OpenGraph SVG:', err);
      res.status(500).type('text/plain').send('Failed to render OpenGraph SVG');
    }
  });

  // OWASP WSTG-ERRH-01: все неизвестные /api/* маршруты возвращают 404 JSON, не доходя до SPA fallback
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ ok: false, error: 'Запрошенный API-метод не найден' });
  });

  const isProd =
    process.env.NODE_ENV === 'production' ||
    process.env.npm_lifecycle_event === 'start' ||
    Boolean(process.env.K_SERVICE);

  const isNonHtmlAssetPath = (reqPath: string): boolean => {
    if (
      reqPath.startsWith('/api/') ||
      reqPath.startsWith('/assets/') ||
      reqPath.startsWith('/fonts/') ||
      reqPath.startsWith('/src/') ||
      reqPath.startsWith('/@')
    ) {
      return true;
    }
    return path.extname(reqPath) !== '';
  };

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.get('*', async (req, res, next) => {
      const accept = String(req.headers.accept || '');
      if (
        isNonHtmlAssetPath(req.path) ||
        (accept !== '' &&
          !accept.includes('text/html') &&
          !accept.includes('*/*'))
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
        const cms = readPersistedCmsSnapshot();
        const httpStatus = resolveServerRouteHttpStatus(
          req.path,
          cms?.portfolioCases,
          { airtimeEnabled: AIRTIME_SALES_ENABLED }
        );
        const parsedRoute = parsePlatformRoute(req.path, search, '', {
          airtimeEnabled: AIRTIME_SALES_ENABLED,
        });
        const routeMeta = resolveRouteSeoMeta(
          parsedRoute,
          {},
          { airtimeEnabled: AIRTIME_SALES_ENABLED }
        );
        if (httpStatus === 404 || routeMeta.noindex) {
          res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        }
        const seoHtml = injectRouteSeoIntoHtml(
          transformed,
          req.path,
          resolveRequestPublicOrigin(req),
          {
            search,
            airtimeEnabled: AIRTIME_SALES_ENABLED,
            httpStatus,
            lookup: resolveServerRouteLookup(req.path, cms?.portfolioCases, {
              search,
              airtimeEnabled: AIRTIME_SALES_ENABLED,
            }),
          }
        );
        sendCompressibleText(
          req,
          res,
          'text/html; charset=utf-8',
          seoHtml,
          'no-store, no-cache, must-revalidate',
          httpStatus
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
      const compressedAssetCache = new Map<
        string,
        { mtimeMs: number; br: Buffer; gzip: Buffer }
      >();

      app.get('/assets/:assetFile', (req, res, next) => {
        const assetFile = path.basename(String(req.params.assetFile || ''));
        if (!/\.(?:js|css|svg)$/i.test(assetFile)) {
          next();
          return;
        }
        const acceptEncoding = String(req.headers['accept-encoding'] || '');
        const wantsBr = /\bbr\b/.test(acceptEncoding);
        const wantsGzip = /\bgzip\b/.test(acceptEncoding);
        if (!wantsBr && !wantsGzip) {
          next();
          return;
        }
        const resolvedAsset = path.resolve(distAssetsPath, assetFile);
        const resolvedRoot = path.resolve(distAssetsPath);
        if (
          !resolvedAsset.startsWith(`${resolvedRoot}${path.sep}`) ||
          !fs.existsSync(resolvedAsset)
        ) {
          next();
          return;
        }
        const stat = fs.statSync(resolvedAsset);
        if (!stat.isFile() || stat.size < 1024) {
          next();
          return;
        }
        let cached = compressedAssetCache.get(resolvedAsset);
        if (!cached || cached.mtimeMs !== stat.mtimeMs) {
          const rawBuf = fs.readFileSync(resolvedAsset);
          cached = {
            mtimeMs: stat.mtimeMs,
            br: zlib.brotliCompressSync(rawBuf, {
              params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 },
            }),
            gzip: zlib.gzipSync(rawBuf, { level: 6 }),
          };
          if (compressedAssetCache.size > 64) {
            const oldestKey = compressedAssetCache.keys().next().value;
            if (oldestKey) compressedAssetCache.delete(oldestKey);
          }
          compressedAssetCache.set(resolvedAsset, cached);
        }
        if (assetFile.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        } else if (assetFile.endsWith('.css')) {
          res.setHeader('Content-Type', 'text/css; charset=utf-8');
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        } else {
          res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
          res.setHeader('Cache-Control', 'public, max-age=86400');
        }
        res.setHeader('Vary', 'Accept-Encoding');
        if (wantsBr) {
          res.setHeader('Content-Encoding', 'br');
          res.send(cached.br);
          return;
        }
        res.setHeader('Content-Encoding', 'gzip');
        res.send(cached.gzip);
      });

      app.use(
        '/assets',
        express.static(distAssetsPath, {
          etag: true,
          lastModified: true,
          setHeaders: (res, filePath) => {
            if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            } else {
              res.setHeader('Cache-Control', 'public, max-age=86400');
            }
          },
        })
      );

      // Никогда не подменяем отсутствующий хэшированный JS-чанк другим билдом:
      // переименованные минифицированные экспорты неизбежно вызывают ESM SyntaxError.
      app.get('/assets/*.js', (_req, res) => {
        res.status(404).setHeader('Cache-Control', 'no-store').type('text/plain').send('Not Found');
      });
    }
    app.use(express.static(distPath, { index: false, maxAge: 0 }));

    const prodIndexPath = path.join(distPath, 'index.html');
    let cachedProdHtml: { mtimeMs: number; html: string } | null = null;
    const readFreshProdHtml = (): string => {
      const stats = fs.statSync(prodIndexPath);
      if (!cachedProdHtml || cachedProdHtml.mtimeMs !== stats.mtimeMs) {
        cachedProdHtml = {
          mtimeMs: stats.mtimeMs,
          html: fs.readFileSync(prodIndexPath, 'utf8'),
        };
      }
      return cachedProdHtml.html;
    };

    app.get('*', (req, res) => {
      if (isNonHtmlAssetPath(req.path)) {
        res.status(404).type('text/plain').send('Not Found');
        return;
      }

      const searchIdx = req.originalUrl.indexOf('?');
      const search = searchIdx >= 0 ? req.originalUrl.slice(searchIdx) : '';
      const cms = readPersistedCmsSnapshot();
      const httpStatus = resolveServerRouteHttpStatus(
        req.path,
        cms?.portfolioCases,
        { airtimeEnabled: AIRTIME_SALES_ENABLED }
      );
      const parsedRoute = parsePlatformRoute(req.path, search, '', {
        airtimeEnabled: AIRTIME_SALES_ENABLED,
      });
      const routeMeta = resolveRouteSeoMeta(
        parsedRoute,
        {},
        { airtimeEnabled: AIRTIME_SALES_ENABLED }
      );
      if (httpStatus === 404 || routeMeta.noindex) {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      }
      const seoHtml = injectRouteSeoIntoHtml(
        readFreshProdHtml(),
        req.path,
        resolveRequestPublicOrigin(req),
        {
          search,
          airtimeEnabled: AIRTIME_SALES_ENABLED,
          httpStatus,
          lookup: resolveServerRouteLookup(req.path, cms?.portfolioCases, {
            search,
            airtimeEnabled: AIRTIME_SALES_ENABLED,
          }),
        }
      );
      sendCompressibleText(
        req,
        res,
        'text/html; charset=utf-8',
        seoHtml,
        'no-store, no-cache, must-revalidate',
        httpStatus
      );
    });
  }

  // OWASP WSTG-ERRH-02: глобальный перехват системных ошибок Express без утечки stack trace
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) {
      return;
    }
    const status =
      typeof (err as { status?: unknown })?.status === 'number'
        ? (err as { status: number }).status
        : 500;
    if (req.path.startsWith('/api/')) {
      const safeMessage =
        status === 400
          ? 'Некорректный формат входного запроса'
          : status === 413
            ? 'Превышен допустимый размер тела запроса'
            : 'Внутренняя ошибка обработки запроса';
      res.status(status >= 400 && status < 600 ? status : 500).json({
        ok: false,
        error: safeMessage,
      });
      return;
    }
    res.status(status >= 400 && status < 600 ? status : 500).type('text/plain').send('Error');
  });

  // Фоновый сторожевой таймер SLA и очистки TTL-реестров в памяти (каждые 30 секунд)
  const slaSweepInterval = setInterval(() => {
    try {
      const nowMs = Date.now();
      pruneExpiredTtlEntries(consumedChallengeNonces, nowMs);
      pruneExpiredTtlEntries(recentLeadFingerprints, nowMs);
      sessionRevocationRegistry.exportEntries();
      clientSessionRevocationRegistry.exportEntries();
      consumedMagicLinkRegistry.exportEntries();
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

