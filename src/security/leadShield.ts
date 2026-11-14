export {
  clientLeadRateLimiter,
  DEFAULT_LEAD_MAX_ATTEMPTS,
  DEFAULT_LEAD_MIN_INTERVAL_MS,
  DEFAULT_LEAD_WINDOW_MS,
  formatRateLimitBlockMessage,
  LEAD_RATE_LIMIT_STORAGE_KEY,
  RateLimiter,
  resolveLeadFormRateScope,
} from './rateLimiter.ts';
export type {
  LeadFormRateScope,
  RateLimitCheckResult,
  RateLimiterConfig,
  StorageLike,
} from './rateLimiter.ts';
export { createRateLimitController, useRateLimit } from './useRateLimit.ts';
export type { UseRateLimitOptions, UseRateLimitReturn } from './useRateLimit.ts';

export type ContactChannelKind = 'phone' | 'telegram' | 'email' | 'vip_saved';

export type LeadSecurityVerdict =
  | 'verified_human'
  | 'quarantined_bot'
  | 'validation_error';

export interface SecurityDefenseLayerSpec {
  id: string;
  code: string;
  title: string;
  roleTitle: string;
  summary: string;
}

export const SECURITY_DEFENSE_LAYERS: readonly SecurityDefenseLayerSpec[] = [
  {
    id: 'pow_hmac',
    code: 'L1 · Challenge + PoW',
    title: 'Подписанный одноразовый токен и браузерный микро-PoW',
    roleTitle: 'AppSec-инженер',
    summary:
      'Каждая форма получает криптографический HMAC-токен со сроком жизни и решает быструю вычислительную задачу в браузере, отсекая пакетные HTTP-боты и парсеры.',
  },
  {
    id: 'honeypot_timing',
    code: 'L2 · Honeypot + Моторика',
    title: 'Невидимая ловушка автозаполнения и контроль скорости отправки',
    roleTitle: 'Специалист по антибот-защите',
    summary:
      'Скрытое поле-приманка, замер времени на экране и сигналы фокуса выявляют скрипты мгновенной отправки без капчи и лишних шагов для живого клиента.',
  },
  {
    id: 'shadow_quarantine',
    code: 'L3 · Защита рекламного бюджета',
    title: 'Теневой карантин без обучения рекламных алгоритмов на ботах',
    roleTitle: 'Директор по платному трафику (Ad-Fraud)',
    summary:
      'Подозрительные отправки изолируются в карантин без возврата подсказок спамерам и получают флаг conversionAllowed: false, чтобы рекламные кабинеты не оптимизировались под клик-фермы.',
  },
  {
    id: 'contact_antigarbage',
    code: 'L4 · Верификация контакта',
    title: 'Фильтр фейковых телефонов, одноразовых почт и клавиатурного мусора',
    roleTitle: 'Руководитель отдела продаж',
    summary:
      'Блокирует одинаковые и последовательные цифры телефона, временные почтовые домены и тестовые заглушки до попадания заявки к продюсеру.',
  },
  {
    id: 'inn_checksum',
    code: 'L5 · Контроль ИНН ФНС',
    title: 'Математическая сверка контрольных разрядов ИНН (10 и 12 цифр)',
    roleTitle: 'Финансовый контролёр ЭДО',
    summary:
      'Проверяет контрольные суммы ИНН юрлиц и ИП по официальным весовым коэффициентам ФНС, исключая случайный набор цифр в реквизитах.',
  },
  {
    id: 'spam_xss_firewall',
    code: 'L6 · Контентный экран',
    title: 'Блокировка ссылочного спама, казино-рассылок и XSS-инъекций',
    roleTitle: 'Инженер веб-безопасности',
    summary:
      'Очищает управляющие символы, перехватывает HTML/JS-вставки, сокращатели ссылок и спам-лексику в текстовом брифе и описании продукта.',
  },
  {
    id: 'ip_rate_quota',
    code: 'L7 · Лимиты IP и квот API',
    title: 'Скользящие лимиты запросов, защита входа в CMS и квот нейросети',
    roleTitle: 'Инфраструктурный архитектор',
    summary:
      'Ограничивает частоту отправок с одного IP, защищает пароль кабинета от перебора, проверяет сигнатуры аудиофайлов и бережёт серверный лимит подбора.',
  },
] as const;

const DISPOSABLE_EMAIL_DOMAINS = new Set<string>([
  'mailinator.com',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'guerrillamail.com',
  'yopmail.com',
  'trashmail.com',
  'sharklasers.com',
  'dispostable.com',
  'fakeinbox.com',
  'maildrop.cc',
  'getnada.com',
  'throwawaymail.com',
  'mohmal.com',
]);

const KEYBOARD_MASH_SUBSTRINGS = [
  'qwerty',
  'asdfgh',
  'zxcvbn',
  'йцукен',
  'фывапр',
  'ячсмит',
  'qazwsx',
] as const;

const EXACT_GARBAGE_TOKENS = new Set<string>([
  'test',
  'testing',
  'тест',
  'тестовый',
  'проверка',
  'asdf',
  'qwer',
  'bot',
  'spam',
  'admin',
  'null',
  'undefined',
  'none',
  'нет',
  'аааа',
  '1234',
  '12345',
  '123456',
]);

const SPAM_SHORTENER_PATTERNS = [
  'bit.ly/',
  'tinyurl.com/',
  'cutt.ly/',
  'clck.ru/',
  'goo.gl/',
  'is.gd/',
  't.me/+',
  'wa.me/',
] as const;

const BOT_SPAM_KEYWORDS = [
  'казино',
  'casino',
  '1win',
  '1xbet',
  'букмекер',
  'ставк на спорт',
  'прогон хрумером',
  'xrumer',
  'рассылка по базе',
  'базы email',
  'купить базу',
  'viagra',
  'cialis',
  'seed phrase',
  'airdrop token',
  'usdt раздача',
  'порно',
  'эскорт',
  'даркнет',
] as const;

const INJECTION_PATTERNS = [
  /<script[\s>]/i,
  /javascript\s*:/i,
  /onerror\s*=/i,
  /onload\s*=/i,
  /<iframe[\s>]/i,
  /\bunion\s+select\b/i,
  /\bdrop\s+table\b/i,
] as const;

export function sanitizePlainLeadText(raw: string, maxLen = 1200): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, maxLen);
}

export function fnv1a32Hex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function solveLeadChallengePow(
  salt: string,
  difficulty = 3,
  maxIterations = 250_000
): { solution: string; hashHex: string; iterations: number } {
  const safeDifficulty = Math.max(1, Math.min(4, Math.floor(difficulty)));
  const targetPrefix = '0'.repeat(safeDifficulty);

  for (let i = 0; i < maxIterations; i += 1) {
    const candidate = i.toString(36);
    const digest = fnv1a32Hex(`${salt}:${candidate}`);
    if (digest.startsWith(targetPrefix)) {
      return {
        solution: candidate,
        hashHex: digest,
        iterations: i + 1,
      };
    }
  }

  const fallback = 'fallback';
  return {
    solution: fallback,
    hashHex: fnv1a32Hex(`${salt}:${fallback}`),
    iterations: maxIterations,
  };
}

export function verifyLeadChallengePow(
  salt: string,
  solutionNonce: string,
  difficulty = 3
): boolean {
  if (!salt || typeof solutionNonce !== 'string' || solutionNonce.length === 0 || solutionNonce.length > 24) {
    return false;
  }
  const safeDifficulty = Math.max(1, Math.min(4, Math.floor(difficulty)));
  const targetPrefix = '0'.repeat(safeDifficulty);
  const digest = fnv1a32Hex(`${salt}:${solutionNonce}`);
  return digest.startsWith(targetPrefix);
}

function hasExcessiveRepeatedChars(value: string, runLen = 6): boolean {
  if (value.length < runLen) return false;
  let streak = 1;
  for (let i = 1; i < value.length; i += 1) {
    if (value[i] === value[i - 1]) {
      streak += 1;
      if (streak >= runLen) return true;
    } else {
      streak = 1;
    }
  }
  return false;
}

function containsKeyboardMash(value: string): boolean {
  const lower = value.toLowerCase();
  for (const seq of KEYBOARD_MASH_SUBSTRINGS) {
    if (lower.includes(seq)) return true;
  }
  return false;
}

function isSequentialDigits(digits: string): boolean {
  if (digits.length < 7) return false;
  const asc = '0123456789012345';
  const desc = '9876543210987654';
  return asc.includes(digits) || desc.includes(digits);
}

function validatePhoneDigitsCandidate(rawDigits: string, hadPlusPrefix: boolean): {
  valid: boolean;
  reason?: string;
} {
  if (rawDigits.length < 10 || rawDigits.length > 15) {
    return {
      valid: false,
      reason: 'Укажите полный номер телефона (например, +7 999 123-45-67)',
    };
  }

  let national10 = rawDigits;
  if (rawDigits.length === 11 && (rawDigits.startsWith('7') || rawDigits.startsWith('8'))) {
    national10 = rawDigits.slice(1);
  } else if (rawDigits.length === 10 && !hadPlusPrefix) {
    national10 = rawDigits;
  }

  if (/^(\d)\1+$/.test(national10)) {
    return {
      valid: false,
      reason: 'Похоже на тестовый набор одинаковых цифр — укажите рабочий телефон для связи',
    };
  }

  if (isSequentialDigits(national10)) {
    return {
      valid: false,
      reason: 'Номер выглядит как случайная последовательность цифр — проверьте телефон',
    };
  }

  if (
    (rawDigits.length === 11 && (rawDigits.startsWith('7') || rawDigits.startsWith('8'))) ||
    (rawDigits.length === 10 && !hadPlusPrefix)
  ) {
    if (national10.startsWith('0') || national10.startsWith('1') || national10.startsWith('2')) {
      return {
        valid: false,
        reason: 'Проверьте код оператора в номере телефона',
      };
    }
    const uniqueDigits = new Set(national10.split('')).size;
    if (uniqueDigits <= 2) {
      return {
        valid: false,
        reason: 'Проверьте номер телефона: слишком много повторяющихся цифр',
      };
    }
  }

  return { valid: true };
}

export interface ContactValidationResult {
  valid: boolean;
  channel?: ContactChannelKind;
  normalizedContact: string;
  error?: string;
  isLikelyBotGarbage?: boolean;
}

export function validateHumanLeadContact(
  rawContact: string,
  options?: { isReturningFastTrack?: boolean }
): ContactValidationResult {
  const cleaned = sanitizePlainLeadText(rawContact, 180);
  if (!cleaned || cleaned.length < 4) {
    return {
      valid: false,
      normalizedContact: cleaned,
      error: 'Укажите имя и рабочий телефон, @Telegram или корпоративную почту',
    };
  }

  const lower = cleaned.toLowerCase();

  for (const rx of INJECTION_PATTERNS) {
    if (rx.test(cleaned)) {
      return {
        valid: false,
        normalizedContact: cleaned,
        error: 'Некорректные символы в поле контакта',
        isLikelyBotGarbage: true,
      };
    }
  }

  if (/https?:\/\//i.test(cleaned) || /www\./i.test(cleaned)) {
    return {
      valid: false,
      normalizedContact: cleaned,
      error: 'В поле контакта укажите телефон, @Telegram или почту без веб-ссылок',
      isLikelyBotGarbage: true,
    };
  }

  if (EXACT_GARBAGE_TOKENS.has(lower) || containsKeyboardMash(lower) || hasExcessiveRepeatedChars(lower, 6)) {
    return {
      valid: false,
      normalizedContact: cleaned,
      error: 'Укажите реальный телефон, @Telegram или рабочую почту для связи с продюсером',
    };
  }

  // 1. Проверка электронной почты, если указана
  const emailMatch = cleaned.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,24})/);
  if (emailMatch) {
    const email = emailMatch[1].toLowerCase();
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain || localPart.length < 2) {
      return {
        valid: false,
        normalizedContact: cleaned,
        error: 'Проверьте адрес электронной почты',
      };
    }
    if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
      return {
        valid: false,
        normalizedContact: cleaned,
        error: 'Одноразовые почтовые ящики не поддерживаются — укажите рабочую почту или телефон',
      };
    }
    if (EXACT_GARBAGE_TOKENS.has(localPart) && domain === 'test.ru') {
      return {
        valid: false,
        normalizedContact: cleaned,
        error: 'Укажите действующую рабочую почту или телефон для выставления счёта',
      };
    }
    return {
      valid: true,
      channel: 'email',
      normalizedContact: cleaned,
    };
  }

  // 2. Проверка @Telegram-ника, если указан
  const tgMatch = cleaned.match(/(?:^|[\s,(])@([a-zA-Z0-9_]{3,32})(?:$|[\s,.)])/);
  const tMeMatch = cleaned.match(/(?:^|[\s,(])t\.me\/([a-zA-Z0-9_]{4,32})(?:$|[\s,.)/])/i);
  const handle = tgMatch?.[1] ?? tMeMatch?.[1];
  if (handle) {
    const handleLower = handle.toLowerCase();
    if (handle.length < 4 || EXACT_GARBAGE_TOKENS.has(handleLower) || containsKeyboardMash(handleLower)) {
      return {
        valid: false,
        normalizedContact: cleaned,
        error: 'Проверьте ник в Telegram (минимум 4 символа после @)',
      };
    }
    return {
      valid: true,
      channel: 'telegram',
      normalizedContact: cleaned,
    };
  }

  // 3. Проверка телефонного номера
  const digitsOnly = cleaned.replace(/\D/g, '');
  if (digitsOnly.length >= 6) {
    const hadPlus = cleaned.includes('+');
    const phoneCheck = validatePhoneDigitsCandidate(digitsOnly, hadPlus);
    if (!phoneCheck.valid) {
      return {
        valid: false,
        normalizedContact: cleaned,
        error: phoneCheck.reason,
      };
    }
    return {
      valid: true,
      channel: 'phone',
      normalizedContact: cleaned,
    };
  }

  if (options?.isReturningFastTrack && cleaned.length >= 4) {
    return {
      valid: true,
      channel: 'vip_saved',
      normalizedContact: cleaned,
    };
  }

  return {
    valid: false,
    normalizedContact: cleaned,
    error: 'Добавьте к имени номер телефона (+7...), @Telegram или рабочую почту',
  };
}

export function verifyRussianInnChecksum(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  if (/^0+$/.test(digits)) return false;

  const d = digits.split('').map((ch) => Number(ch));

  if (d.length === 10) {
    const weights10 = [2, 4, 10, 3, 5, 9, 4, 6, 8];
    const sum = weights10.reduce((acc, w, idx) => acc + w * d[idx], 0);
    const control = (sum % 11) % 10;
    return d[9] === control;
  }

  if (d.length === 12) {
    const weights11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    const weights12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    const sum11 = weights11.reduce((acc, w, idx) => acc + w * d[idx], 0);
    const n11 = (sum11 % 11) % 10;
    const sum12 = weights12.reduce((acc, w, idx) => acc + w * d[idx], 0);
    const n12 = (sum12 % 11) % 10;
    return d[10] === n11 && d[11] === n12;
  }

  return false;
}

export interface CompanyOrInnValidationResult {
  valid: boolean;
  normalizedValue: string;
  innVerified: boolean;
  error?: string;
  isLikelyBotGarbage?: boolean;
}

export function validateCompanyOrInnField(rawValue: string): CompanyOrInnValidationResult {
  const cleaned = sanitizePlainLeadText(rawValue, 160);
  if (!cleaned) {
    return {
      valid: true,
      normalizedValue: '',
      innVerified: false,
    };
  }

  for (const rx of INJECTION_PATTERNS) {
    if (rx.test(cleaned)) {
      return {
        valid: false,
        normalizedValue: cleaned,
        innVerified: false,
        error: 'Недопустимые символы в поле реквизитов',
        isLikelyBotGarbage: true,
      };
    }
  }

  if (/https?:\/\//i.test(cleaned)) {
    return {
      valid: false,
      normalizedValue: cleaned,
      innVerified: false,
      error: 'Укажите название юрлица или ИНН без внешних ссылок',
      isLikelyBotGarbage: true,
    };
  }

  const compactDigitsCandidate = cleaned.replace(/[\s-]/g, '');
  const innPrefixMatch = cleaned.match(/^инн[\s:№-]*(\d[\d\s-]*)$/i);

  if (/^\d+$/.test(compactDigitsCandidate) || innPrefixMatch) {
    const innDigits = (innPrefixMatch ? innPrefixMatch[1] : compactDigitsCandidate).replace(/\D/g, '');
    if (innDigits.length !== 10 && innDigits.length !== 12) {
      return {
        valid: false,
        normalizedValue: cleaned,
        innVerified: false,
        error: 'ИНН должен содержать 10 цифр (юрлицо) или 12 цифр (ИП), либо укажите название компании',
      };
    }
    if (!verifyRussianInnChecksum(innDigits)) {
      return {
        valid: false,
        normalizedValue: cleaned,
        innVerified: false,
        error: 'Контрольное число ИНН ФНС не совпадает — проверьте цифры ИНН или укажите название компании',
      };
    }
    return {
      valid: true,
      normalizedValue: innDigits,
      innVerified: true,
    };
  }

  if (containsKeyboardMash(cleaned) || hasExcessiveRepeatedChars(cleaned.toLowerCase(), 7)) {
    return {
      valid: false,
      normalizedValue: cleaned,
      innVerified: false,
      error: 'Проверьте название компании или ИНН',
    };
  }

  // Комбинированная строка вида «ООО "Альфа" · ИНН 7707083893»
  const embeddedInnMatch = cleaned.match(/(?:^|[\s·,;(/])инн[\s:№-]*(\d[\d\s-]{6,18}\d)/i);
  if (embeddedInnMatch) {
    const innDigits = embeddedInnMatch[1].replace(/\D/g, '');
    if (innDigits.length !== 10 && innDigits.length !== 12) {
      return {
        valid: false,
        normalizedValue: cleaned,
        innVerified: false,
        error: 'ИНН должен содержать 10 цифр (юрлицо) или 12 цифр (ИП)',
      };
    }
    if (!verifyRussianInnChecksum(innDigits)) {
      return {
        valid: false,
        normalizedValue: cleaned,
        innVerified: false,
        error: 'Контрольное число ИНН ФНС не совпадает — проверьте цифры ИНН',
      };
    }
    return {
      valid: true,
      normalizedValue: cleaned,
      innVerified: true,
    };
  }

  return {
    valid: true,
    normalizedValue: cleaned,
    innVerified: false,
  };
}

export interface BriefSpamInspection {
  sanitizedBrief: string;
  isBotSpam: boolean;
  reasons: string[];
}

export function inspectBriefForSpamSignals(rawBrief: string): BriefSpamInspection {
  const sanitizedBrief = sanitizePlainLeadText(rawBrief, 1800);
  if (!sanitizedBrief) {
    return {
      sanitizedBrief: '',
      isBotSpam: false,
      reasons: [],
    };
  }

  const reasons: string[] = [];
  const lower = sanitizedBrief.toLowerCase();

  for (const rx of INJECTION_PATTERNS) {
    if (rx.test(sanitizedBrief)) {
      reasons.push('xss_or_sql_injection_pattern');
      break;
    }
  }

  const urlMatches = sanitizedBrief.match(/https?:\/\/[^\s]+/gi) ?? [];
  if (urlMatches.length >= 2) {
    reasons.push('multiple_external_links');
  }

  for (const shortener of SPAM_SHORTENER_PATTERNS) {
    if (lower.includes(shortener)) {
      reasons.push('spam_url_shortener');
      break;
    }
  }

  for (const kw of BOT_SPAM_KEYWORDS) {
    if (lower.includes(kw)) {
      reasons.push('prohibited_spam_lexicon');
      break;
    }
  }

  return {
    sanitizedBrief,
    isBotSpam: reasons.length > 0,
    reasons,
  };
}

export function computeLeadPayloadFingerprint(
  contactLine: string,
  companyLine: string,
  briefText: string
): string {
  const norm = [
    contactLine.trim().toLowerCase().replace(/\s+/g, ' '),
    companyLine.trim().toLowerCase().replace(/\s+/g, ' '),
    briefText.trim().toLowerCase().replace(/\s+/g, ' '),
  ].join('|');
  return fnv1a32Hex(norm);
}

export interface LeadSecurityEvaluationInput {
  contactLine: string;
  companyLine: string;
  briefText: string;
  hasVoiceRecording: boolean;
  hasAttachedFile: boolean;
  isReturningFastTrack: boolean;
  requireBriefOrVoice: boolean;
  websiteTrap: string;
  dwellMs: number;
  pointerMoves: number;
  keystrokes: number;
  focusEvents: number;
  challengeValid: boolean;
  nonceAlreadyUsed: boolean;
  powValid: boolean;
  isDuplicateRecentPayload: boolean;
}

export interface LeadSecurityEvaluationResult {
  verdict: LeadSecurityVerdict;
  conversionAllowed: boolean;
  riskScore: number;
  reasons: string[];
  normalizedContact: string;
  normalizedCompany: string;
  sanitizedBrief: string;
  detectedChannel?: ContactChannelKind;
  innVerified: boolean;
  contactError?: string;
  companyError?: string;
  taskError?: string;
}

export function evaluateLeadSubmissionSecurity(
  input: LeadSecurityEvaluationInput
): LeadSecurityEvaluationResult {
  let riskScore = 0;
  const reasons: string[] = [];

  const trapTrimmed = typeof input.websiteTrap === 'string' ? input.websiteTrap.trim() : '';
  if (trapTrimmed.length > 0) {
    riskScore += 100;
    reasons.push('honeypot_filled');
  }

  if (!input.challengeValid) {
    riskScore += 85;
    reasons.push('invalid_challenge_signature');
  }

  if (input.nonceAlreadyUsed) {
    riskScore += 85;
    reasons.push('replayed_challenge_nonce');
  }

  if (!input.powValid) {
    riskScore += 80;
    reasons.push('invalid_pow_solution');
  }

  if (input.dwellMs >= 0 && input.dwellMs < 150) {
    riskScore += 65;
    reasons.push('instant_subsecond_submit');
  } else if (input.dwellMs >= 150 && input.dwellMs < 450) {
    riskScore += 35;
    reasons.push('fast_submit_timing');
  }

  const totalMotorSignals =
    Math.max(0, input.pointerMoves) +
    Math.max(0, input.keystrokes) +
    Math.max(0, input.focusEvents);

  if (totalMotorSignals === 0 && input.dwellMs < 2200 && !input.isReturningFastTrack) {
    riskScore += 45;
    reasons.push('zero_human_interaction');
  }

  if (input.isDuplicateRecentPayload) {
    riskScore += 70;
    reasons.push('duplicate_payload_flood');
  }

  const briefInspection = inspectBriefForSpamSignals(input.briefText);
  if (briefInspection.isBotSpam) {
    riskScore += 85;
    reasons.push(...briefInspection.reasons);
  }

  const contactCheck = validateHumanLeadContact(input.contactLine, {
    isReturningFastTrack: input.isReturningFastTrack,
  });
  if (contactCheck.isLikelyBotGarbage) {
    riskScore += 75;
    reasons.push('contact_injection_or_link');
  }

  const companyCheck = validateCompanyOrInnField(input.companyLine);
  if (companyCheck.isLikelyBotGarbage) {
    riskScore += 75;
    reasons.push('company_injection_or_link');
  }

  const clampedRisk = Math.min(100, riskScore);

  if (clampedRisk >= 60) {
    return {
      verdict: 'quarantined_bot',
      conversionAllowed: false,
      riskScore: clampedRisk,
      reasons,
      normalizedContact: contactCheck.normalizedContact,
      normalizedCompany: companyCheck.normalizedValue,
      sanitizedBrief: briefInspection.sanitizedBrief,
      innVerified: false,
    };
  }

  let taskError: string | undefined;
  if (
    input.requireBriefOrVoice &&
    !input.isReturningFastTrack &&
    !input.hasVoiceRecording &&
    !input.hasAttachedFile &&
    briefInspection.sanitizedBrief.length < 3
  ) {
    taskError = 'Надиктуйте задачу голосом, прикрепите файл или напишите пару слов о ролике';
  }

  if (!contactCheck.valid || !companyCheck.valid || taskError) {
    return {
      verdict: 'validation_error',
      conversionAllowed: false,
      riskScore: clampedRisk,
      reasons,
      normalizedContact: contactCheck.normalizedContact,
      normalizedCompany: companyCheck.normalizedValue,
      sanitizedBrief: briefInspection.sanitizedBrief,
      innVerified: false,
      contactError: contactCheck.error,
      companyError: companyCheck.error,
      taskError,
    };
  }

  return {
    verdict: 'verified_human',
    conversionAllowed: true,
    riskScore: clampedRisk,
    reasons,
    normalizedContact: contactCheck.normalizedContact,
    normalizedCompany: companyCheck.normalizedValue,
    sanitizedBrief: briefInspection.sanitizedBrief,
    detectedChannel: contactCheck.channel,
    innVerified: companyCheck.innVerified,
  };
}
