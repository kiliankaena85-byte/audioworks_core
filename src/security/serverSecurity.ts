import net from 'node:net';

export const STUDIO_SESSION_COOKIE_NAME = 'fmworks_studio_session';

export interface OutboundWebhookValidationResult {
  ok: boolean;
  url?: URL;
  isInternalLoopbackSink: boolean;
  reason?: string;
}

export interface VerifiedImageFileType {
  ext: '.jpg' | '.png' | '.webp' | '.avif';
  mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif';
}

export type SecurityAuditEventKind =
  | 'auth_login_success'
  | 'auth_login_failure'
  | 'auth_rate_limited'
  | 'auth_logout'
  | 'auth_unauthorized_access'
  | 'cms_content_saved'
  | 'cms_content_reset'
  | 'duel_track_uploaded'
  | 'upload_rejected_magic_bytes'
  | 'ssrf_target_blocked'
  | 'webhook_settings_updated'
  | 'order_pdn_anonymized';

export interface SecurityAuditEvent {
  id: string;
  timestamp: string;
  kind: SecurityAuditEventKind;
  ipHash: string;
  detail: string;
}

/**
 * Нормализует IP-адрес (включая IPv4-mapped IPv6 вида `::ffff:127.0.0.1`).
 */
export function normalizeIpAddress(rawIp: string | undefined | null): string {
  if (!rawIp || typeof rawIp !== 'string') return '';
  let trimmed = rawIp.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    trimmed = trimmed.slice(1, -1);
  }
  const zoneIdx = trimmed.indexOf('%');
  if (zoneIdx !== -1) {
    trimmed = trimmed.slice(0, zoneIdx);
  }
  if (trimmed.toLowerCase().startsWith('::ffff:')) {
    const tail = trimmed.slice(7);
    if (net.isIPv4(tail)) {
      return tail;
    }
    // Hex-форма IPv4-mapped IPv6, например `::ffff:7f00:1` или `::ffff:7f00:0001`
    const hexMatch = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(tail);
    if (hexMatch) {
      const hi = parseInt(hexMatch[1], 16);
      const lo = parseInt(hexMatch[2], 16);
      return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    }
  }
  return trimmed.toLowerCase();
}

function ipv4ToUint32(ip: string): number | null {
  if (!net.isIPv4(ip)) return null;
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  return (
    ((parts[0] << 24) >>> 0) +
    ((parts[1] << 16) >>> 0) +
    ((parts[2] << 8) >>> 0) +
    (parts[3] >>> 0)
  );
}

function isIpv4InCidr(ipNum: number, baseIp: string, prefixLen: number): boolean {
  const baseNum = ipv4ToUint32(baseIp);
  if (baseNum === null) return false;
  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  return (ipNum & mask) === (baseNum & mask);
}

/**
 * Проверяет, принадлежит ли IP-адрес к loopback, приватным, link-local (включая cloud metadata 169.254.169.254),
 * CGNAT, multicast или иным немаршрутизируемым зарезервированным сетям.
 */
export function isPrivateOrReservedIp(rawIp: string): boolean {
  const ip = normalizeIpAddress(rawIp);
  if (!ip) return true;

  const ipNum = ipv4ToUint32(ip);
  if (ipNum !== null) {
    return (
      isIpv4InCidr(ipNum, '0.0.0.0', 8) || // Current network
      isIpv4InCidr(ipNum, '10.0.0.0', 8) || // RFC1918
      isIpv4InCidr(ipNum, '100.64.0.0', 10) || // CGNAT RFC6598
      isIpv4InCidr(ipNum, '127.0.0.0', 8) || // Loopback
      isIpv4InCidr(ipNum, '169.254.0.0', 16) || // Link-local & AWS/GCP metadata
      isIpv4InCidr(ipNum, '172.16.0.0', 12) || // RFC1918
      isIpv4InCidr(ipNum, '192.0.0.0', 24) || // IETF Protocol Assignments
      isIpv4InCidr(ipNum, '192.0.2.0', 24) || // TEST-NET-1
      isIpv4InCidr(ipNum, '192.88.99.0', 24) || // 6to4 relay
      isIpv4InCidr(ipNum, '192.168.0.0', 16) || // RFC1918
      isIpv4InCidr(ipNum, '198.18.0.0', 15) || // Benchmarking
      isIpv4InCidr(ipNum, '198.51.100.0', 24) || // TEST-NET-2
      isIpv4InCidr(ipNum, '203.0.113.0', 24) || // TEST-NET-3
      isIpv4InCidr(ipNum, '224.0.0.0', 4) || // Multicast
      isIpv4InCidr(ipNum, '240.0.0.0', 4) // Reserved / Broadcast
    );
  }

  if (net.isIPv6(ip)) {
    if (ip === '::' || ip === '::1') return true;
    const firstHextetStr = ip.split(':')[0] || '0';
    const firstHextet = parseInt(firstHextetStr, 16);
    if (Number.isNaN(firstHextet)) return true;
    // fc00::/7 (Unique Local IPv6)
    if ((firstHextet & 0xfe00) === 0xfc00) return true;
    // fe80::/10 (Link-Local)
    if ((firstHextet & 0xffc0) === 0xfe80) return true;
    // fec0::/10 (Deprecated Site-Local)
    if ((firstHextet & 0xffc0) === 0xfec0) return true;
    // ff00::/8 (Multicast)
    if ((firstHextet & 0xff00) === 0xff00) return true;
    // 2001:db8::/32 (Documentation)
    if (ip.startsWith('2001:db8:') || ip.startsWith('2001:0db8:')) return true;
    return false;
  }

  // Неизвестный формат адреса считаем небезопасным
  return true;
}

/**
 * Безопасно определяет IP-адрес клиента для rate-limiter и журнала аудита.
 * Заголовок `X-Forwarded-For` учитывается ТОЛЬКО когда явно включён `trustProxy`
 * И непосредственный peer TCP-соединения находится в доверенной локальной/прокси-сети.
 */
export function resolveTrustedClientIp(
  remoteAddress: string | undefined | null,
  xForwardedForHeader: string | string[] | undefined,
  trustProxy: boolean
): string {
  const peerIp = normalizeIpAddress(remoteAddress) || '127.0.0.1';
  if (!trustProxy || !isPrivateOrReservedIp(peerIp)) {
    return peerIp;
  }

  const rawXff = Array.isArray(xForwardedForHeader)
    ? xForwardedForHeader[0]
    : xForwardedForHeader;
  if (typeof rawXff === 'string' && rawXff.trim()) {
    const candidate = normalizeIpAddress(rawXff.split(',')[0]);
    if (candidate && net.isIP(candidate) !== 0) {
      return candidate;
    }
  }

  return peerIp;
}

/**
 * Проверяет целевой URL исходящего CRM-вебхука (защита от SSRF):
 * - разрешает только `http:` и `https:`;
 * - запрещает встроенные `username:password` в URL;
 * - блокирует приватные, loopback и metadata-диапазоны IPv4/IPv6 и `.local`/`.internal` домены;
 * - допускает локальный вызов ТОЛЬКО к собственному встроенному тест-приёмнику `/api/webhooks/loopback-crm-sink`.
 */
export function validateOutboundWebhookTarget(
  rawUrl: string,
  options: { allowInternalLoopbackSink?: boolean; localPort?: number } = {}
): OutboundWebhookValidationResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return {
      ok: false,
      isInternalLoopbackSink: false,
      reason: 'Пустой URL вебхука.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      ok: false,
      isInternalLoopbackSink: false,
      reason: 'Некорректный формат URL вебхука.',
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      ok: false,
      isInternalLoopbackSink: false,
      reason: `Протокол «${parsed.protocol}» запрещён: допустимы только https:// или http://.`,
    };
  }

  if (parsed.username || parsed.password) {
    return {
      ok: false,
      isInternalLoopbackSink: false,
      reason: 'Передача учётных данных (user:pass@) внутри URL вебхука запрещена.',
    };
  }

  const hostname = normalizeIpAddress(parsed.hostname);
  if (!hostname) {
    return {
      ok: false,
      isInternalLoopbackSink: false,
      reason: 'Не удалось определить хост приёмника вебхука.',
    };
  }

  // Разрешение строго для встроенного внутриконтейнерного loopback-теста
  const isLoopbackHostname =
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  if (
    options.allowInternalLoopbackSink !== false &&
    isLoopbackHostname &&
    parsed.pathname === '/api/webhooks/loopback-crm-sink'
  ) {
    const targetPort = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80;
    if (options.localPort === undefined || targetPort === options.localPort) {
      return {
        ok: true,
        url: parsed,
        isInternalLoopbackSink: true,
      };
    }
  }

  if (
    isLoopbackHostname ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.arpa')
  ) {
    return {
      ok: false,
      isInternalLoopbackSink: false,
      reason: `SSRF-блокировка: внутренний или loopback-хост «${hostname}» запрещён для исходящих вебхуков.`,
    };
  }

  if (net.isIP(hostname) !== 0 && isPrivateOrReservedIp(hostname)) {
    return {
      ok: false,
      isInternalLoopbackSink: false,
      reason: `SSRF-блокировка: приватный или зарезервированный IP «${hostname}» запрещён.`,
    };
  }

  return {
    ok: true,
    url: parsed,
    isInternalLoopbackSink: false,
  };
}

/**
 * Проверяет бинарную сигнатуру (magic bytes) изображения (JPEG, PNG, WebP, AVIF).
 * Исключает загрузку HTML, SVG, скриптов и произвольных файлов под видом обложки.
 */
export function detectVerifiedImageType(buf: Buffer): VerifiedImageFileType | null {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: '.jpg', mime: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { ext: '.png', mime: 'image/png' };
  }

  // WebP: RIFF....WEBP
  if (
    buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buf.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return { ext: '.webp', mime: 'image/webp' };
  }

  // AVIF: ....ftypavif / ftypavis / ftypmif1
  if (buf.length >= 16 && buf.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('latin1');
    if (brand === 'avif' || brand === 'avis' || brand === 'mif1') {
      return { ext: '.avif', mime: 'image/avif' };
    }
  }

  return null;
}

/**
 * Проверяет бинарную сигнатуру (magic bytes) поддерживаемых аудиоформатов (WAV, OGG, FLAC, MP3/ID3, M4A/MP4).
 */
export function hasValidAudioMagicBytes(buf: Buffer): boolean {
  if (!Buffer.isBuffer(buf) || buf.length < 16) return false;
  const head4 = buf.subarray(0, 4).toString('latin1');
  if (head4 === 'RIFF') {
    return buf.subarray(8, 12).toString('latin1') === 'WAVE';
  }
  if (head4 === 'OggS' || head4 === 'fLaC') return true;
  if (buf.subarray(0, 3).toString('latin1') === 'ID3') return true;
  if (buf.subarray(4, 8).toString('latin1') === 'ftyp') return true;
  // MPEG ADTS / MP3 frame sync (11 bits set, excluding invalid layer 00)
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0 && (buf[1] & 0x06) !== 0x00) {
    return true;
  }
  return false;
}

export function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return out;
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0) continue;
    const name = part.slice(0, eqIdx).trim();
    const rawVal = part.slice(eqIdx + 1).trim();
    if (!name) continue;
    try {
      out[name] = decodeURIComponent(rawVal);
    } catch {
      out[name] = rawVal;
    }
  }
  return out;
}

export function buildSessionSetCookieHeader(
  token: string,
  maxAgeSec: number,
  isSecure: boolean
): string {
  const parts = [
    `${STUDIO_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/api',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSec))}`,
  ];
  if (isSecure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function buildSessionClearCookieHeader(isSecure: boolean): string {
  const parts = [
    `${STUDIO_SESSION_COOKIE_NAME}=`,
    'Path=/api',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isSecure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function createSessionRevocationRegistry(
  initialEntries: readonly [string, number][] = []
) {
  const revokedNonces = new Map<string, number>();

  const prune = (nowMs = Date.now()) => {
    for (const [nonce, exp] of revokedNonces.entries()) {
      if (exp < nowMs) {
        revokedNonces.delete(nonce);
      }
    }
  };

  const hydrate = (entries: readonly [string, number][], nowMs = Date.now()) => {
    for (const entry of entries) {
      if (
        Array.isArray(entry) &&
        entry.length === 2 &&
        typeof entry[0] === 'string' &&
        entry[0] &&
        typeof entry[1] === 'number' &&
        entry[1] >= nowMs
      ) {
        revokedNonces.set(entry[0], entry[1]);
      }
    }
    prune(nowMs);
  };

  hydrate(initialEntries);

  return {
    revoke(nonce: string, expiresAtMs: number): void {
      if (!nonce) return;
      prune();
      revokedNonces.set(nonce, expiresAtMs);
    },
    isRevoked(nonce: string | undefined): boolean {
      if (!nonce) return false;
      prune();
      return revokedNonces.has(nonce);
    },
    exportEntries(): [string, number][] {
      prune();
      return Array.from(revokedNonces.entries());
    },
    hydrate,
    size(): number {
      prune();
      return revokedNonces.size;
    },
  };
}

/**
 * Формирует строгую политику Content-Security-Policy, совместимую с локальными шрифтами (@fontsource),
 * аудиопотоками, blob/data превью и без внешних трекеров/скриптов (152-ФЗ + OWASP A05 / WSTG-CLNT-09).
 */
export function buildContentSecurityPolicy(
  options: { allowDevInlineScripts?: boolean; allowPreviewFrames?: boolean } = {}
): string {
  const scriptSrc = options.allowDevInlineScripts
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self'";
  const frameAncestors = options.allowPreviewFrames
    ? "frame-ancestors 'self' https://aistudio.google.com https://makersuite.google.com https://*.google.com https://*.googleusercontent.com"
    : "frame-ancestors 'self'";
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    frameAncestors,
  ].join('; ');
}

export function appendSecurityAuditEvent(
  events: readonly SecurityAuditEvent[],
  entry: Omit<SecurityAuditEvent, 'id' | 'timestamp'>,
  maxEntries = 150
): SecurityAuditEvent[] {
  const now = new Date().toISOString();
  const next: SecurityAuditEvent = {
    id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now,
    kind: entry.kind,
    ipHash: entry.ipHash.slice(0, 16),
    detail: entry.detail.slice(0, 220),
  };
  return [next, ...events].slice(0, maxEntries);
}

const SAFE_HOST_HEADER_REGEX =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*|\[[0-9a-f:]+\])(?::\d{1,5})?$/i;

/**
 * Безопасно вычисляет канонический Origin для robots.txt, sitemap.xml и meta canonical (OWASP WSTG-INPV / Host Header Injection).
 * Отклоняет поддельные символы, userinfo (`@`), слэши и игнорирует `X-Forwarded-Host` при отключённом `trustProxy`.
 */
export function resolveSafePublicOrigin(params: {
  configuredOrigin?: string;
  hostHeader?: string | string[];
  forwardedHost?: string | string[];
  protocol?: string;
  forwardedProto?: string | string[];
  trustProxy?: boolean;
  fallbackOrigin?: string;
}): string {
  const fallback = params.fallbackOrigin ?? 'https://fmworks.ru';
  if (params.configuredOrigin) {
    try {
      const parsed = new URL(params.configuredOrigin.trim());
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.origin;
      }
    } catch {
      // Ignore malformed env origin
    }
  }

  const pickFirst = (val: string | string[] | undefined): string => {
    const raw = Array.isArray(val) ? val[0] : val;
    return typeof raw === 'string' ? raw.split(',')[0].trim() : '';
  };

  const hostCandidate = params.trustProxy
    ? pickFirst(params.forwardedHost) || pickFirst(params.hostHeader)
    : pickFirst(params.hostHeader);

  if (!hostCandidate || !SAFE_HOST_HEADER_REGEX.test(hostCandidate)) {
    return fallback;
  }

  const protoCandidate = params.trustProxy
    ? (pickFirst(params.forwardedProto) || params.protocol || 'https').toLowerCase()
    : (params.protocol || 'https').toLowerCase();
  const safeProto = protoCandidate === 'http' ? 'http' : 'https';
  return `${safeProto}://${hostCandidate}`;
}

/**
 * Дополнительная защита от CSRF (OWASP WSTG-SESS-05) для cookie-запросов:
 * если браузер передал заголовок `Origin` или `Referer`, он должен совпадать с разрешённым host.
 */
export function isCrossOriginBrowserRequest(params: {
  originHeader?: string | string[];
  refererHeader?: string | string[];
  hostHeader?: string | string[];
}): boolean {
  const hostRaw = Array.isArray(params.hostHeader) ? params.hostHeader[0] : params.hostHeader;
  const host = typeof hostRaw === 'string' ? hostRaw.trim().toLowerCase() : '';
  if (!host) return false;

  const rawOrigin = Array.isArray(params.originHeader)
    ? params.originHeader[0]
    : params.originHeader;
  const rawReferer = Array.isArray(params.refererHeader)
    ? params.refererHeader[0]
    : params.refererHeader;

  const sourceUrl =
    (typeof rawOrigin === 'string' && rawOrigin.trim() && rawOrigin.trim() !== 'null'
      ? rawOrigin.trim()
      : '') || (typeof rawReferer === 'string' ? rawReferer.trim() : '');

  if (!sourceUrl) return false;
  try {
    const parsed = new URL(sourceUrl);
    return parsed.host.toLowerCase() !== host;
  } catch {
    return true;
  }
}

