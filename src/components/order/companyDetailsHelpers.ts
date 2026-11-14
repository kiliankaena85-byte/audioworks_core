import { resolveOfflineCounterpartyByInn } from '../../data/konturIntegrationCore.ts';
import {
  sanitizePlainLeadText,
  validateCompanyOrInnField,
  verifyRussianInnChecksum,
} from '../../security/leadShield.ts';

export type PaymentChannelKind = 'edo_invoice' | 'card_online';
export type InnEntityKind = 'legal_entity' | 'sole_proprietor' | null;

export interface ParsedCompanyDetails {
  companyName: string;
  companyInn: string;
}

export interface CompanyDetailsInspection {
  valid: boolean;
  normalizedName: string;
  normalizedInn: string;
  innVerified: boolean;
  innEntityKind: InnEntityKind;
  combinedCompanyLine: string;
  nameError?: string;
  innError?: string;
}

/**
 * Оставляет только цифры ИНН (максимум 12 для ИП / самозанятых, 10 для ООО/АО).
 */
export function normalizeInnDigits(raw: string): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/\D/g, '').slice(0, 12);
}

/**
 * Определяет тип контрагента и валидность контрольного числа ФНС по цифрам ИНН.
 */
export function inspectInnDigits(rawInn: string): {
  digits: string;
  entityKind: InnEntityKind;
  isCompleteLength: boolean;
  checksumValid: boolean;
  statusMessage?: string;
} {
  const digits = normalizeInnDigits(rawInn);
  if (!digits) {
    return {
      digits: '',
      entityKind: null,
      isCompleteLength: false,
      checksumValid: false,
    };
  }

  if (digits.length === 10) {
    const ok = verifyRussianInnChecksum(digits);
    return {
      digits,
      entityKind: 'legal_entity',
      isCompleteLength: true,
      checksumValid: ok,
      statusMessage: ok
        ? 'ИНН юрлица (10 цифр) подтверждён по ключу ФНС'
        : 'Контрольное число ИНН (10 цифр) не совпадает — проверьте опечатку',
    };
  }

  if (digits.length === 12) {
    const ok = verifyRussianInnChecksum(digits);
    return {
      digits,
      entityKind: 'sole_proprietor',
      isCompleteLength: true,
      checksumValid: ok,
      statusMessage: ok
        ? 'ИНН ИП / физлица (12 цифр) подтверждён по ключу ФНС'
        : 'Контрольное число ИНН (12 цифр) не совпадает — проверьте опечатку',
    };
  }

  return {
    digits,
    entityKind: null,
    isCompleteLength: false,
    checksumValid: false,
    statusMessage: `Введено ${digits.length} цифр · нужно 10 (ООО/АО) или 12 (ИП)`,
  };
}

/**
 * Собирает единую строку контрагента для ЭДО, счёта-оферты и CRM.
 */
export function formatStructuredCompanyLine(
  companyName: string,
  companyInn: string
): string {
  const cleanName = sanitizePlainLeadText(companyName, 120);
  const cleanInn = normalizeInnDigits(companyInn);

  if (cleanName && cleanInn) {
    return `${cleanName} · ИНН ${cleanInn}`;
  }
  if (cleanName) {
    return cleanName;
  }
  if (cleanInn) {
    return cleanInn;
  }
  return '';
}

/**
 * Разбирает объединённую строку вида «ООО "Квартал" · ИНН 7707083893» на два поля формы.
 */
export function parseCompanyNameAndInn(companyLine: string): ParsedCompanyDetails {
  const cleaned = sanitizePlainLeadText(companyLine, 180);
  if (!cleaned) {
    return { companyName: '', companyInn: '' };
  }

  const pureDigits = cleaned.replace(/[\s-]/g, '');
  const pureInnPrefix = cleaned.match(/^инн[\s:№-]*(\d[\d\s-]*)$/i);
  if (/^\d{10,12}$/.test(pureDigits) || pureInnPrefix) {
    return {
      companyName: '',
      companyInn: normalizeInnDigits(pureInnPrefix ? pureInnPrefix[1] : pureDigits),
    };
  }

  const embeddedInn = cleaned.match(
    /^(.*?)[\s·,;(/|-]*инн[\s:№-]*(\d{10,12})[)\s]*$/i
  );
  if (embeddedInn) {
    return {
      companyName: embeddedInn[1].replace(/[·,;|\s-]+$/g, '').trim(),
      companyInn: normalizeInnDigits(embeddedInn[2]),
    };
  }

  return {
    companyName: cleaned,
    companyInn: '',
  };
}

/**
 * Проверяет форму реквизитов компании (ИНН + Название) перед отправкой заявки.
 * Если клиент ввёл только валидный ИНН (10/12 цифр по ключу ФНС), название подтягивается автоматически.
 * Если и название, и ИНН пусты (или ИНН невалиден), в режиме счёта выводятся понятные подсказки.
 */
export function inspectCompanyDetails(params: {
  companyName: string;
  companyInn: string;
  paymentChannel: PaymentChannelKind;
}): CompanyDetailsInspection {
  let normalizedName = sanitizePlainLeadText(params.companyName, 120);
  const normalizedInn = normalizeInnDigits(params.companyInn);
  const isEdo = params.paymentChannel === 'edo_invoice';

  let nameError: string | undefined;
  let innError: string | undefined;

  const innInfo = inspectInnDigits(normalizedInn);
  if (normalizedInn) {
    if (!innInfo.isCompleteLength) {
      innError = 'ИНН должен содержать ровно 10 цифр (юрлицо) или 12 цифр (ИП)';
    } else if (!innInfo.checksumValid) {
      innError =
        'Контрольное число ИНН ФНС не совпадает — проверьте правильность цифр ИНН';
    }
  } else if (isEdo) {
    innError = 'Укажите ИНН (10 или 12 цифр) для автоматического формирования договора и счёта';
  }

  const innVerified = Boolean(
    normalizedInn && innInfo.isCompleteLength && innInfo.checksumValid
  );

  if (!normalizedName && innVerified) {
    const resolved = resolveOfflineCounterpartyByInn(normalizedInn);
    if (resolved?.shortName) {
      normalizedName = sanitizePlainLeadText(resolved.shortName, 120);
    }
  }

  if (normalizedName) {
    if (normalizedName.length < 2) {
      nameError = 'Укажите полное или краткое название компании / ИП (от 2 символов)';
    } else if (/^\d+$/.test(normalizedName.replace(/[\s-]/g, ''))) {
      nameError = 'В поле названия укажите наименование организации или ИП, а цифры — в поле ИНН';
    } else {
      const nameShield = validateCompanyOrInnField(normalizedName);
      if (!nameShield.valid) {
        nameError = nameShield.error ?? 'Проверьте название компании';
      }
    }
  } else if (isEdo) {
    nameError = 'Укажите название компании или ИП для автоматического договора и счёта ЭДО';
  }

  return {
    valid: !nameError && !innError,
    normalizedName,
    normalizedInn,
    innVerified,
    innEntityKind: innVerified ? innInfo.entityKind : null,
    combinedCompanyLine: formatStructuredCompanyLine(normalizedName, normalizedInn),
    nameError,
    innError,
  };
}

