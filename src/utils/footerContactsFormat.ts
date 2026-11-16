export interface NormalizedTelegramContact {
  displayHandle: string;
  href: string;
}

export interface TwoLineTaglineView {
  firstLine: string;
  secondLine: string;
  singleLine: string;
}

export interface AdminFooterContactsValidation {
  isValid: boolean;
  phoneError: string | null;
  telegramError: string | null;
}

/**
 * Форматирует телефонный номер РФ (+79040000911 / 89040000911) в читаемый вид
 * `+7 (904) 000-09-11` для отображения в интерфейсе. Если формат международный
 * или нестандартный, возвращает аккуратно очищенную исходную строку.
 */
export function formatDisplayPhoneRu(rawPhone: string): string {
  const trimmed = rawPhone.trim();
  if (!trimmed) return '';

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    const code = digits.slice(1, 4);
    const p1 = digits.slice(4, 7);
    const p2 = digits.slice(7, 9);
    const p3 = digits.slice(9, 11);
    return `+7 (${code}) ${p1}-${p2}-${p3}`;
  }
  if (digits.length === 10 && digits.startsWith('9')) {
    const code = digits.slice(0, 3);
    const p1 = digits.slice(3, 6);
    const p2 = digits.slice(6, 8);
    const p3 = digits.slice(8, 10);
    return `+7 (${code}) ${p1}-${p2}-${p3}`;
  }
  return trimmed.replace(/\s+/g, ' ');
}

/**
 * Формирует безопасную ссылку `tel:` из произвольной строки телефона.
 * Возвращает `null`, если телефон не содержит достаточного числа цифр (минимум 7).
 */
export function buildTelHref(rawPhone: string): string | null {
  const trimmed = rawPhone.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;

  if (digits.length === 11 && digits.startsWith('8')) {
    return `tel:+7${digits.slice(1)}`;
  }
  if (digits.length === 10 && digits.startsWith('9')) {
    return `tel:+7${digits}`;
  }
  if (trimmed.startsWith('+') || digits.length >= 11) {
    return `tel:+${digits}`;
  }
  return `tel:${digits}`;
}

/**
 * Нормализует контакт Telegram из любого удобного ввода администратора:
 * `@fmworks`, `fmworks`, `t.me/fmworks`, `https://t.me/fmworks`,
 * `https://t.me/+InviteHash`, `https://t.me/joinchat/InviteHash`,
 * `tg://resolve?domain=fmworks`.
 * Возвращает `null`, если поле пустое или содержит ссылку на посторонний домен.
 */
export function normalizeTelegramContact(
  rawTelegram: string
): NormalizedTelegramContact | null {
  const trimmed = rawTelegram.trim();
  if (!trimmed) return null;

  // Поддержка протокола tg://resolve?domain=username
  if (/^tg:\/\//i.test(trimmed)) {
    const domainMatch = trimmed.match(/[?&]domain=([a-zA-Z0-9_]{3,32})/i);
    if (!domainMatch) return null;
    const handle = domainMatch[1];
    return {
      displayHandle: `@${handle}`,
      href: `https://t.me/${handle}`,
    };
  }

  let pathPart = trimmed;

  // Если введён полный URL с протоколом — разрешаем только домены Telegram
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    const tgUrlMatch = trimmed.match(
      /^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me|telegram\.dog)\/(.+)$/i
    );
    if (!tgUrlMatch) return null;
    pathPart = tgUrlMatch[1];
  } else if (/^(?:www\.)?(?:t\.me|telegram\.me|telegram\.dog)\//i.test(trimmed)) {
    pathPart = trimmed.replace(
      /^(?:www\.)?(?:t\.me|telegram\.me|telegram\.dog)\//i,
      ''
    );
  } else if (trimmed.includes('/') || trimmed.includes('.')) {
    // Посторонний домен без протокола (например, vk.com/club) отклоняем
    return null;
  }

  // Закрытые инвайт-ссылки формата joinchat/<token>
  const joinchatMatch = pathPart.match(/^joinchat\/([a-zA-Z0-9_-]{4,64})/i);
  if (joinchatMatch) {
    return {
      displayHandle: 'Telegram-чат',
      href: `https://t.me/joinchat/${joinchatMatch[1]}`,
    };
  }

  const firstSegment = pathPart.replace(/[/?#].*$/, '').trim();
  if (!firstSegment) return null;

  // Инвайт-ссылки нового формата +<token>
  if (firstSegment.startsWith('+')) {
    const inviteToken = firstSegment.slice(1).replace(/[^a-zA-Z0-9_-]/g, '');
    if (inviteToken.length < 4) return null;
    return {
      displayHandle: 'Telegram-чат',
      href: `https://t.me/+${inviteToken}`,
    };
  }

  const rawHandle = firstSegment.replace(/^@+/, '');
  if (!/^[a-zA-Z0-9_]{3,32}$/.test(rawHandle)) {
    return null;
  }

  return {
    displayHandle: `@${rawHandle}`,
    href: `https://t.me/${rawHandle}`,
  };
}

/**
 * Проверяет корректность введённых контактов перед сохранением в админ-панели.
 * Если показ конкретного канала в подвале выключен, пустое поле допустимо.
 */
export function validateAdminFooterContacts(input: {
  phone: string;
  telegram: string;
  showPhoneInFooter: boolean;
  showTelegramInFooter: boolean;
}): AdminFooterContactsValidation {
  let phoneError: string | null = null;
  let telegramError: string | null = null;

  const trimmedPhone = input.phone.trim();
  if (input.showPhoneInFooter) {
    if (!trimmedPhone) {
      phoneError =
        'Введите номер телефона или снимите галочку «Показывать на сайте».';
    } else if (!buildTelHref(trimmedPhone)) {
      phoneError =
        'Укажите корректный номер телефона (от 7 до 15 цифр, например +7 (904) 000-09-11).';
    }
  } else if (trimmedPhone && !buildTelHref(trimmedPhone)) {
    phoneError =
      'Проверьте формат номера телефона (от 7 до 15 цифр) или очистите поле.';
  }

  const trimmedTelegram = input.telegram.trim();
  if (input.showTelegramInFooter) {
    if (!trimmedTelegram) {
      telegramError =
        'Укажите ссылку https://t.me/... или @username, либо снимите галочку «Показывать на сайте».';
    } else if (!normalizeTelegramContact(trimmedTelegram)) {
      telegramError =
        'Введите корректную ссылку Telegram (https://t.me/username) или никнейм (@username).';
    }
  } else if (trimmedTelegram && !normalizeTelegramContact(trimmedTelegram)) {
    telegramError =
      'Проверьте ссылку Telegram (https://t.me/username или @username) либо очистите поле.';
  }

  return {
    isValid: phoneError === null && telegramError === null,
    phoneError,
    telegramError,
  };
}

/**
 * Собирает двухстрочную и однострочную версии подписи бренда для адаптивного подвала.
 */
export function resolveAdaptiveBrandTagline(
  rawFirstLine?: string,
  rawSecondLine?: string
): TwoLineTaglineView {
  const firstLine = (rawFirstLine ?? '').trim() || 'Аудиореклама,';
  const secondLine = (rawSecondLine ?? '').trim() || 'которая работает';
  return {
    firstLine,
    secondLine,
    singleLine: `${firstLine} ${secondLine}`.replace(/\s+/g, ' ').trim(),
  };
}
