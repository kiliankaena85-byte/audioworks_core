import {
  type DiadocDraftState,
  resolveOfflineCounterpartyByInn,
} from './konturIntegrationCore.ts';

export type StudioEntityKind = 'ip' | 'ooo';

export type StudioTaxRegimeId =
  | 'usn_no_vat'
  | 'usn_vat_5'
  | 'usn_vat_7'
  | 'osno_vat_20';

export type StudioVatCalculationMode = 'included' | 'on_top';

export type BrandedDocumentKind =
  | 'kp'
  | 'contract'
  | 'invoice'
  | 'act'
  | 'passport';

export type Fz38DisclaimerStatus =
  | 'included_in_spot'
  | 'not_required_for_category'
  | 'verified_by_advertiser';

export interface StudioLegalProfile {
  entityKind: StudioEntityKind;
  legalName: string;
  shortBrandTitle: string;
  inn: string;
  kpp: string;
  ogrnOrOgrnip: string;
  city: string;
  legalAddress: string;
  bankName: string;
  bik: string;
  correspondentAccount: string;
  checkingAccount: string;
  signatoryRoleTitle: string;
  signatoryFullName: string;
  signatoryShortName: string;
  chiefAccountantShortName: string;
  authorityBasis: string;
  edoOperatorLabel: string;
  edoParticipantId: string;
  websiteDomain: string;
  email: string;
  phone: string;
  taxRegime: StudioTaxRegimeId;
  vatMode: StudioVatCalculationMode;
}

export type StudioLegalOperatingMode = 'ooo_only' | 'ip_only' | 'both';

export interface StudioPrivacyPolicySettings {
  privacyEmail: string;
  rknRegistryNumber: string;
  policyVersionDate: string;
  hostingLocationLabel: string;
  showRequisitesInFooter: boolean;
  cookieBannerEnabled: boolean;
}

export interface StudioPublicContactsConfig {
  phone: string;
  phoneLabel: string;
  telegram: string;
  telegramLabel: string;
  email: string;
  workHoursLabel: string;
  taglineLine1: string;
  taglineLine2: string;
  showPhoneInFooter: boolean;
  showTelegramInFooter: boolean;
}

export interface StudioLegalProfilesConfig {
  activeEntityKind: StudioEntityKind;
  legalOperatingMode?: StudioLegalOperatingMode;
  ipProfile: StudioLegalProfile;
  oooProfile: StudioLegalProfile;
  privacyPolicy?: StudioPrivacyPolicySettings;
  publicContacts?: StudioPublicContactsConfig;
}

export interface OrderDocumentMeta {
  entityKindOverride?: 'default' | StudioEntityKind;
  taxRegimeOverride?: 'default' | StudioTaxRegimeId;
  frameworkContractNumber?: string;
  frameworkContractDate?: string;
  appendixNumber?: number;
  customPriceRub?: number | null;
  specialTechOverride?: string;
  spotWorkingTitle?: string;
  spotMasterFileName?: string;
  spotExactDurationSec?: number;
  scriptAuthorLine?: string;
  voiceTalentLine?: string;
  musicTitleAndComposer?: string;
  musicLicenseLine?: string;
  territoryAndTermLine?: string;
  fz38DisclaimerStatus?: Fz38DisclaimerStatus;
  customerLegalName?: string;
  customerInn?: string;
  customerKpp?: string;
  customerOgrn?: string;
  customerAddress?: string;
  customerSignatory?: string;
  customerEdoBoxId?: string;
  customerEdoOperator?: string;
  wantsDiadocDuplicate?: boolean;
  diadocDraftState?: DiadocDraftState;
}

export interface TaxCalculationSummary {
  taxRegime: StudioTaxRegimeId;
  vatMode: StudioVatCalculationMode;
  vatRatePercent: number;
  subtotalExclVatKopecks: number;
  vatAmountKopecks: number;
  totalPayableKopecks: number;
  totalPayableRubFloor: number;
  totalPayableKopeksPart: number;
  formattedSubtotalRub: string;
  formattedVatLine: string;
  formattedTotalRub: string;
  taxLegalLabel: string;
  totalInWordsRu: string;
}

export interface ParsedCustomerCounterparty {
  displayName: string;
  inn: string;
  kpp: string;
  ogrn: string;
  isIpByInn: boolean;
  address: string;
  signatory: string;
  edoBoxId: string;
  edoOperator: string;
  wantsDiadocDuplicate: boolean;
  contact: string;
  isPlaceholder: boolean;
}

export interface ProductionTierScopeSpec {
  tierTitle: string;
  conceptsCountLabel: string;
  voiceCastLabel: string;
  soundAndMusicLabel: string;
  revisionsIncludedLabel: string;
  turnaroundLabel: string;
  kpLineItems: readonly {
    code: string;
    title: string;
    turnaround: string;
    priceNote: string;
  }[];
}

export interface BroadcastTechStandardRow {
  parameter: string;
  specification: string;
}

export interface AssembledDocumentSuite {
  orderNumber: string;
  dealCode: string;
  issueDateRu: string;
  city: string;
  kpNumber: string;
  contractNumber: string;
  contractDateRu: string;
  appendixNumber: number;
  invoiceNumber: string;
  actNumber: string;
  passportNumber: string;
  isNegotiablePendingPrice: boolean;
  effectivePriceRub: number;
  spotDurationSec: number;
  spotDurationFormatted: string;
  spotWorkingTitle: string;
  spotMasterFileName: string;
  studio: StudioLegalProfile;
  customer: ParsedCustomerCounterparty;
  scope: ProductionTierScopeSpec;
  tax: TaxCalculationSummary;
  specialTechNote: string;
  passport: {
    scriptAuthorLine: string;
    voiceTalentLine: string;
    musicTitleAndComposer: string;
    musicLicenseLine: string;
    territoryAndTermLine: string;
    fz38StatusLabel: string;
    fz38StatusId: Fz38DisclaimerStatus;
  };
  paymentQrPayload: string;
}

export const TAX_REGIME_OPTIONS: readonly {
  id: StudioTaxRegimeId;
  shortLabel: string;
  fullLabel: string;
  ratePercent: number;
}[] = [
  {
    id: 'usn_no_vat',
    shortLabel: 'УСН · Без НДС',
    fullLabel: 'УСН — Без налога (НДС), ст. 346.11 НК РФ',
    ratePercent: 0,
  },
  {
    id: 'usn_vat_5',
    shortLabel: 'УСН · НДС 5%',
    fullLabel: 'УСН — В том числе НДС 5% (п. 8 ст. 164 НК РФ)',
    ratePercent: 5,
  },
  {
    id: 'usn_vat_7',
    shortLabel: 'УСН · НДС 7%',
    fullLabel: 'УСН — В том числе НДС 7% (п. 8 ст. 164 НК РФ)',
    ratePercent: 7,
  },
  {
    id: 'osno_vat_20',
    shortLabel: 'ОСНО · НДС 20%',
    fullLabel: 'ОСНО — В том числе НДС 20% (п. 3 ст. 164 НК РФ)',
    ratePercent: 20,
  },
] as const;

export const FZ38_DISCLAIMER_STATUS_OPTIONS: readonly {
  id: Fz38DisclaimerStatus;
  shortLabel: string;
  passportDescription: string;
}[] = [
  {
    id: 'included_in_spot',
    shortLabel: 'Обязательные сноски озвучены в ролике',
    passportDescription:
      'Обязательные предупреждения, возрастная маркировка и реквизиты рекламодателя озвучены разборчиво внутри хронометража аудиоролика согласно профильным статьям ФЗ-38 «О рекламе».',
  },
  {
    id: 'not_required_for_category',
    shortLabel: 'Спецдисклеймеры не требуются по категории',
    passportDescription:
      'Объект рекламирования не относится к специальным категориям ст. 24–28 ФЗ-38 «О рекламе»; скрытые вставки и превышение уровня громкости отсутствуют.',
  },
  {
    id: 'verified_by_advertiser',
    shortLabel: 'Формулировка подтверждена юротделом Заказчика',
    passportDescription:
      'Юридическая формулировка дисклеймера и реквизитов согласована и письменно подтверждена Рекламодателем до записи мастер-фонограммы (ст. 38 ФЗ-38 «О рекламе»).',
  },
] as const;

/**
 * Раздел 3 основного Договора (ст. 721 ГК РФ):
 * Единый базовый технический стандарт сдачи рекламных аудиороликов
 * для служб технического контроля коммерческих радиостанций РФ.
 */
export const BROADCAST_TECH_STANDARD_ROWS: readonly BroadcastTechStandardRow[] = [
  {
    parameter: 'Формат и кодирование мастер-пакета',
    specification:
      'Основной эфирный мастер: WAV (Linear PCM), 44 100 Гц (44.1 kHz), 16 bit, Stereo + дублирующий контрольно-эфирный файл MP3 (CBR 320 kbps, 44.1 kHz, Stereo).',
  },
  {
    parameter: 'Интегральная громкость и пиковый потолок (ч. 11 ст. 15 ФЗ-38)',
    specification:
      'Интегральная громкость в эфирном коридоре -14 … -11 LUFS (рабочая плотность RMS -11 … -9 dB) согласно нормативу ФАС России о единстве громкости рекламы и радиопрограммы; истинный пиковый уровень True Peak ≤ -0.5 dBTP, 0% цифрового клиппинга.',
  },
  {
    parameter: 'Стереобаза, фаза и чистота сигнала',
    specification:
      'Сбалансированная стереопанорама с полной моносовместимостью речевого сигнала (коэффициент фазовой корреляции +0.5 … +1.0 без вычитания голоса); отсутствие щелчков, сетевых наводок и артефактов шумоподавления.',
  },
  {
    parameter: 'Точность хронометража и края файла для эфирной автоматики',
    specification:
      'Совпадение фактической длительности с хронометражем Приложения секунда в секунду (допуск не более ±0,05 сек); отсутствие пустых пауз цифровой тишины на старте и в финале файла свыше 0,1 сек; полное завершение затуханий (fade-out) внутри хронометража.',
  },
  {
    parameter: 'Разборчивость речи и оговорка для спецплощадок (п. 3.5)',
    specification:
      'Приоритет частотно-динамической разборчивости дикторского текста и обязательных сносок ФЗ-38 над музыкальным фоном. Специальные параметры отдельных площадок Заказчика (например, 48 000 Гц / 24 bit для ТВ и indoor-вещания) при необходимости указываются в Приложении и имеют приоритет без переделки Договора.',
  },
] as const;

export function createDefaultPrivacyPolicySettings(): StudioPrivacyPolicySettings {
  return {
    privacyEmail: 'art@artmspektr.ru',
    rknRegistryNumber: '',
    policyVersionDate: '16.11.2026',
    hostingLocationLabel: 'Российская Федерация (серверные мощности и СУБД на территории РФ)',
    showRequisitesInFooter: true,
    cookieBannerEnabled: true,
  };
}

export function createDefaultPublicContactsConfig(): StudioPublicContactsConfig {
  return {
    phone: '+79040000911',
    phoneLabel: 'Прямая линия продюсера',
    telegram: '@fmworks',
    telegramLabel: 'Написать в Telegram',
    email: 'art@artmspektr.ru',
    workHoursLabel: 'Пн–Пт 09:00–19:00',
    taglineLine1: 'Аудиореклама,',
    taglineLine2: 'которая работает',
    showPhoneInFooter: true,
    showTelegramInFooter: true,
  };
}

export function createDefaultStudioLegalProfiles(): StudioLegalProfilesConfig {
  return {
    activeEntityKind: 'ooo',
    legalOperatingMode: 'ooo_only',
    ipProfile: {
      entityKind: 'ip',
      legalName: 'Индивидуальный предприниматель Соколов Артём Викторович',
      shortBrandTitle: 'Аудиопродакшн-студия FMWorks® (ИП Соколов А. В.)',
      inn: '695008412904',
      kpp: '',
      ogrnOrOgrnip: '322695200041850',
      city: 'г. Тверь',
      legalAddress: '170100, Россия, Тверская обл., г. Тверь',
      bankName: 'АО «ТБанк»',
      bik: '044525974',
      correspondentAccount: '30101810145250000974',
      checkingAccount: '40802810900001482910',
      signatoryRoleTitle: 'Индивидуальный предприниматель',
      signatoryFullName: 'Соколов Артём Викторович',
      signatoryShortName: 'Соколов А. В.',
      chiefAccountantShortName: '',
      authorityBasis:
        'действующий на основании государственной регистрации (ОГРНИП 322695200041850)',
      edoOperatorLabel: 'Контур.Диадок (Учёт в Контур.Экстерне)',
      edoParticipantId: '2BM-695008412904-FMWORKS',
      websiteDomain: 'fmworks.ru',
      email: 'art@artmspektr.ru',
      phone: '+79040000911',
      taxRegime: 'usn_no_vat',
      vatMode: 'included',
    },
    oooProfile: {
      entityKind: 'ooo',
      legalName: 'Общество с ограниченной ответственностью «ФМ Воркс Продакшн»',
      shortBrandTitle: 'ООО «ФМ Воркс Продакшн» (студия FMWorks®)',
      inn: '6950241890',
      kpp: '695001001',
      ogrnOrOgrnip: '1236900008415',
      city: 'г. Тверь',
      legalAddress: '170100, Россия, Тверская обл., г. Тверь',
      bankName: 'АО «ТБанк»',
      bik: '044525974',
      correspondentAccount: '30101810145250000974',
      checkingAccount: '40702810400001954208',
      signatoryRoleTitle: 'Генеральный директор',
      signatoryFullName: 'Соколов Артём Викторович',
      signatoryShortName: 'Соколов А. В.',
      chiefAccountantShortName: 'Соколов А. В.',
      authorityBasis: 'действующего на основании Устава',
      edoOperatorLabel: 'Контур.Диадок (Учёт в Контур.Экстерне)',
      edoParticipantId: '2BM-6950241890-695001001-FMWORKS',
      websiteDomain: 'fmworks.ru',
      email: 'art@artmspektr.ru',
      phone: '+79040000911',
      taxRegime: 'osno_vat_20',
      vatMode: 'included',
    },
    privacyPolicy: createDefaultPrivacyPolicySettings(),
    publicContacts: createDefaultPublicContactsConfig(),
  };
}

function cleanText(
  raw: unknown,
  fallback: string,
  maxLen = 240,
  allowExplicitEmpty = false
): string {
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (!trimmed) {
    return allowExplicitEmpty ? '' : fallback;
  }
  return trimmed.slice(0, maxLen);
}

function cleanDigits(
  raw: unknown,
  fallback: string,
  maxLen: number,
  allowExplicitEmpty = false
): string {
  if (typeof raw !== 'string') return fallback;
  const digits = raw.replace(/\D/g, '').slice(0, maxLen);
  if (!digits) {
    return allowExplicitEmpty ? '' : fallback;
  }
  return digits;
}

export function sanitizePrivacyPolicySettings(
  raw: Partial<StudioPrivacyPolicySettings> | null | undefined,
  fallbackEmail = 'art@artmspektr.ru'
): StudioPrivacyPolicySettings {
  const base = createDefaultPrivacyPolicySettings();
  if (!raw || typeof raw !== 'object') {
    return {
      ...base,
      privacyEmail: fallbackEmail || base.privacyEmail,
    };
  }
  return {
    privacyEmail: cleanText(raw.privacyEmail, fallbackEmail || base.privacyEmail, 120, true),
    rknRegistryNumber: cleanText(raw.rknRegistryNumber, '', 80, true),
    policyVersionDate: cleanText(raw.policyVersionDate, base.policyVersionDate, 40, false),
    hostingLocationLabel: cleanText(
      raw.hostingLocationLabel,
      base.hostingLocationLabel,
      200,
      false
    ),
    showRequisitesInFooter:
      typeof raw.showRequisitesInFooter === 'boolean'
        ? raw.showRequisitesInFooter
        : base.showRequisitesInFooter,
    cookieBannerEnabled:
      typeof raw.cookieBannerEnabled === 'boolean'
        ? raw.cookieBannerEnabled
        : base.cookieBannerEnabled,
  };
}

export function sanitizePublicContactsConfig(
  raw: Partial<StudioPublicContactsConfig> | null | undefined,
  fallbackPhone = '+79040000911',
  fallbackEmail = 'art@artmspektr.ru'
): StudioPublicContactsConfig {
  const base = createDefaultPublicContactsConfig();
  if (!raw || typeof raw !== 'object') {
    return {
      ...base,
      phone: fallbackPhone || base.phone,
      email: fallbackEmail || base.email,
    };
  }
  return {
    phone: cleanText(raw.phone, fallbackPhone || base.phone, 60, true),
    phoneLabel: cleanText(raw.phoneLabel, base.phoneLabel, 80, true),
    telegram: cleanText(raw.telegram, base.telegram, 120, true),
    telegramLabel: cleanText(raw.telegramLabel, base.telegramLabel, 80, true),
    email: cleanText(raw.email, fallbackEmail || base.email, 100, false),
    workHoursLabel: cleanText(raw.workHoursLabel, base.workHoursLabel, 80, true),
    taglineLine1: cleanText(raw.taglineLine1, base.taglineLine1, 80, false),
    taglineLine2: cleanText(raw.taglineLine2, base.taglineLine2, 80, false),
    showPhoneInFooter:
      typeof raw.showPhoneInFooter === 'boolean'
        ? raw.showPhoneInFooter
        : base.showPhoneInFooter,
    showTelegramInFooter:
      typeof raw.showTelegramInFooter === 'boolean'
        ? raw.showTelegramInFooter
        : base.showTelegramInFooter,
  };
}

export function sanitizeStudioLegalProfile(
  raw: Partial<StudioLegalProfile> | null | undefined,
  entityKind: StudioEntityKind
): StudioLegalProfile {
  const defaults = createDefaultStudioLegalProfiles();
  const base = entityKind === 'ip' ? defaults.ipProfile : defaults.oooProfile;
  if (!raw || typeof raw !== 'object') {
    return { ...base };
  }

  const validTaxIds = new Set(TAX_REGIME_OPTIONS.map((o) => o.id));
  const taxRegime: StudioTaxRegimeId =
    raw.taxRegime && validTaxIds.has(raw.taxRegime) ? raw.taxRegime : base.taxRegime;
  const vatMode: StudioVatCalculationMode =
    raw.vatMode === 'on_top' ? 'on_top' : 'included';

  return {
    entityKind,
    legalName: cleanText(raw.legalName, base.legalName, 220, false),
    shortBrandTitle: cleanText(raw.shortBrandTitle, base.shortBrandTitle, 160, false),
    inn: cleanDigits(raw.inn, base.inn, entityKind === 'ip' ? 12 : 10, true),
    // У ИП поле КПП юридически отсутствует — жёстко очищаем его
    kpp: entityKind === 'ip' ? '' : cleanDigits(raw.kpp, base.kpp, 9, true),
    ogrnOrOgrnip: cleanDigits(
      raw.ogrnOrOgrnip,
      base.ogrnOrOgrnip,
      entityKind === 'ip' ? 15 : 13,
      true
    ),
    city: cleanText(raw.city, 'г. Тверь', 80, false),
    legalAddress: cleanText(raw.legalAddress, base.legalAddress, 260, true),
    bankName: cleanText(raw.bankName, base.bankName, 160, true),
    bik: cleanDigits(raw.bik, base.bik, 9, true),
    correspondentAccount: cleanDigits(
      raw.correspondentAccount,
      base.correspondentAccount,
      20,
      true
    ),
    checkingAccount: cleanDigits(raw.checkingAccount, base.checkingAccount, 20, true),
    signatoryRoleTitle: cleanText(
      raw.signatoryRoleTitle,
      base.signatoryRoleTitle,
      100,
      true
    ),
    signatoryFullName: cleanText(raw.signatoryFullName, base.signatoryFullName, 140, true),
    signatoryShortName: cleanText(raw.signatoryShortName, base.signatoryShortName, 80, true),
    chiefAccountantShortName:
      entityKind === 'ip'
        ? ''
        : cleanText(raw.chiefAccountantShortName, base.chiefAccountantShortName, 80, true),
    authorityBasis: cleanText(raw.authorityBasis, base.authorityBasis, 200, true),
    edoOperatorLabel: (() => {
      const cleaned = cleanText(raw.edoOperatorLabel, base.edoOperatorLabel, 100, true);
      return cleaned === 'Контур.Диадок / СБИС' ? base.edoOperatorLabel : cleaned;
    })(),
    edoParticipantId: cleanText(raw.edoParticipantId, base.edoParticipantId, 100, true),
    websiteDomain: cleanText(raw.websiteDomain, 'fmworks.ru', 80, false),
    email: cleanText(raw.email, 'art@artmspektr.ru', 100, false),
    phone: cleanText(raw.phone, base.phone, 60, false),
    taxRegime,
    vatMode,
  };
}

export function sanitizeStudioLegalProfilesConfig(
  raw: Partial<StudioLegalProfilesConfig> | null | undefined
): StudioLegalProfilesConfig {
  const defaults = createDefaultStudioLegalProfiles();
  if (!raw || typeof raw !== 'object') return defaults;

  const ipProfile = sanitizeStudioLegalProfile(raw.ipProfile, 'ip');
  const oooProfile = sanitizeStudioLegalProfile(raw.oooProfile, 'ooo');

  let legalOperatingMode: StudioLegalOperatingMode;
  if (
    raw.legalOperatingMode === 'ooo_only' ||
    raw.legalOperatingMode === 'ip_only' ||
    raw.legalOperatingMode === 'both'
  ) {
    legalOperatingMode = raw.legalOperatingMode;
  } else if (raw.activeEntityKind === 'ip') {
    legalOperatingMode = 'both';
  } else {
    legalOperatingMode = 'ooo_only';
  }

  const activeEntityKind: StudioEntityKind =
    legalOperatingMode === 'ooo_only'
      ? 'ooo'
      : legalOperatingMode === 'ip_only'
        ? 'ip'
        : raw.activeEntityKind === 'ip'
          ? 'ip'
          : 'ooo';

  const primaryEmail =
    activeEntityKind === 'ooo' ? oooProfile.email : ipProfile.email;
  const primaryPhone =
    activeEntityKind === 'ooo' ? oooProfile.phone : ipProfile.phone;

  return {
    activeEntityKind,
    legalOperatingMode,
    ipProfile,
    oooProfile,
    privacyPolicy: sanitizePrivacyPolicySettings(raw.privacyPolicy, primaryEmail),
    publicContacts: sanitizePublicContactsConfig(
      raw.publicContacts,
      primaryPhone,
      primaryEmail
    ),
  };
}

export function resolveActiveStudioProfile(
  config?: Partial<StudioLegalProfilesConfig> | null
): StudioLegalProfile {
  const sanitized = sanitizeStudioLegalProfilesConfig(config);
  return sanitized.activeEntityKind === 'ooo'
    ? sanitized.oooProfile
    : sanitized.ipProfile;
}

export function resolveSecondaryStudioProfile(
  config?: Partial<StudioLegalProfilesConfig> | null
): StudioLegalProfile | null {
  const sanitized = sanitizeStudioLegalProfilesConfig(config);
  if (sanitized.legalOperatingMode !== 'both') {
    return null;
  }
  return sanitized.activeEntityKind === 'ooo'
    ? sanitized.ipProfile
    : sanitized.oooProfile;
}

export function sanitizeOrderDocumentMeta(
  raw: Partial<OrderDocumentMeta> | null | undefined
): OrderDocumentMeta {
  if (!raw || typeof raw !== 'object') return {};
  const validTaxIds = new Set<string>(['default', ...TAX_REGIME_OPTIONS.map((t) => t.id)]);
  const validFz38 = new Set<string>(FZ38_DISCLAIMER_STATUS_OPTIONS.map((f) => f.id));

  return {
    entityKindOverride:
      raw.entityKindOverride === 'ip' ||
      raw.entityKindOverride === 'ooo' ||
      raw.entityKindOverride === 'default'
        ? raw.entityKindOverride
        : undefined,
    taxRegimeOverride:
      typeof raw.taxRegimeOverride === 'string' && validTaxIds.has(raw.taxRegimeOverride)
        ? (raw.taxRegimeOverride as OrderDocumentMeta['taxRegimeOverride'])
        : undefined,
    frameworkContractNumber:
      typeof raw.frameworkContractNumber === 'string'
        ? raw.frameworkContractNumber.trim().slice(0, 64)
        : undefined,
    frameworkContractDate:
      typeof raw.frameworkContractDate === 'string'
        ? raw.frameworkContractDate.trim().slice(0, 48)
        : undefined,
    appendixNumber:
      typeof raw.appendixNumber === 'number' && Number.isFinite(raw.appendixNumber)
        ? Math.max(1, Math.min(999, Math.round(raw.appendixNumber)))
        : undefined,
    customPriceRub:
      typeof raw.customPriceRub === 'number' && Number.isFinite(raw.customPriceRub)
        ? Math.max(0, Math.min(50_000_000, Math.round(raw.customPriceRub)))
        : raw.customPriceRub === null
          ? null
          : undefined,
    specialTechOverride:
      typeof raw.specialTechOverride === 'string'
        ? raw.specialTechOverride.trim().slice(0, 320)
        : undefined,
    spotWorkingTitle:
      typeof raw.spotWorkingTitle === 'string'
        ? raw.spotWorkingTitle.trim().slice(0, 160)
        : undefined,
    spotMasterFileName:
      typeof raw.spotMasterFileName === 'string'
        ? raw.spotMasterFileName.trim().slice(0, 140)
        : undefined,
    spotExactDurationSec:
      typeof raw.spotExactDurationSec === 'number' &&
      Number.isFinite(raw.spotExactDurationSec)
        ? Math.max(5, Math.min(120, Math.round(raw.spotExactDurationSec)))
        : undefined,
    scriptAuthorLine:
      typeof raw.scriptAuthorLine === 'string'
        ? raw.scriptAuthorLine.trim().slice(0, 220)
        : undefined,
    voiceTalentLine:
      typeof raw.voiceTalentLine === 'string'
        ? raw.voiceTalentLine.trim().slice(0, 220)
        : undefined,
    musicTitleAndComposer:
      typeof raw.musicTitleAndComposer === 'string'
        ? raw.musicTitleAndComposer.trim().slice(0, 240)
        : undefined,
    musicLicenseLine:
      typeof raw.musicLicenseLine === 'string'
        ? raw.musicLicenseLine.trim().slice(0, 260)
        : undefined,
    territoryAndTermLine:
      typeof raw.territoryAndTermLine === 'string'
        ? raw.territoryAndTermLine.trim().slice(0, 240)
        : undefined,
    fz38DisclaimerStatus:
      typeof raw.fz38DisclaimerStatus === 'string' &&
      validFz38.has(raw.fz38DisclaimerStatus)
        ? (raw.fz38DisclaimerStatus as Fz38DisclaimerStatus)
        : undefined,
    customerLegalName:
      typeof raw.customerLegalName === 'string'
        ? raw.customerLegalName.trim().slice(0, 200)
        : undefined,
    customerInn:
      typeof raw.customerInn === 'string'
        ? raw.customerInn.replace(/\D/g, '').slice(0, 12)
        : undefined,
    customerKpp:
      typeof raw.customerKpp === 'string'
        ? raw.customerKpp.replace(/\D/g, '').slice(0, 9)
        : undefined,
    customerOgrn:
      typeof raw.customerOgrn === 'string'
        ? raw.customerOgrn.replace(/\D/g, '').slice(0, 15)
        : undefined,
    customerAddress:
      typeof raw.customerAddress === 'string'
        ? raw.customerAddress.trim().slice(0, 260)
        : undefined,
    customerSignatory:
      typeof raw.customerSignatory === 'string'
        ? raw.customerSignatory.trim().slice(0, 160)
        : undefined,
    customerEdoBoxId:
      typeof raw.customerEdoBoxId === 'string'
        ? raw.customerEdoBoxId.trim().slice(0, 100)
        : undefined,
    customerEdoOperator:
      typeof raw.customerEdoOperator === 'string'
        ? raw.customerEdoOperator.trim().slice(0, 120)
        : undefined,
    wantsDiadocDuplicate:
      typeof raw.wantsDiadocDuplicate === 'boolean'
        ? raw.wantsDiadocDuplicate
        : undefined,
    diadocDraftState:
      raw.diadocDraftState && typeof raw.diadocDraftState === 'object'
        ? {
            status:
              raw.diadocDraftState.status === 'draft_created' ||
              raw.diadocDraftState.status === 'queued_local' ||
              raw.diadocDraftState.status === 'error'
                ? raw.diadocDraftState.status
                : 'not_sent',
            draftMessageId:
              typeof raw.diadocDraftState.draftMessageId === 'string'
                ? raw.diadocDraftState.draftMessageId.trim().slice(0, 120)
                : undefined,
            toBoxId:
              typeof raw.diadocDraftState.toBoxId === 'string'
                ? raw.diadocDraftState.toBoxId.trim().slice(0, 100)
                : undefined,
            fromBoxId:
              typeof raw.diadocDraftState.fromBoxId === 'string'
                ? raw.diadocDraftState.fromBoxId.trim().slice(0, 100)
                : undefined,
            documentNumber:
              typeof raw.diadocDraftState.documentNumber === 'string'
                ? raw.diadocDraftState.documentNumber.trim().slice(0, 64)
                : undefined,
            updatedAt:
              typeof raw.diadocDraftState.updatedAt === 'string'
                ? raw.diadocDraftState.updatedAt.trim().slice(0, 64)
                : undefined,
            detail:
              typeof raw.diadocDraftState.detail === 'string'
                ? raw.diadocDraftState.detail.trim().slice(0, 300)
                : undefined,
          }
        : undefined,
  };
}

export function formatKopecksRubDecimal(kopecks: number): string {
  const safe = Math.max(0, Math.round(Number.isFinite(kopecks) ? kopecks : 0));
  const rub = Math.floor(safe / 100);
  const kop = safe % 100;
  const rubGrouped = String(rub).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  return `${rubGrouped},${String(kop).padStart(2, '0')}\u00A0₽`;
}

const ONES_MASCULINE = [
  '',
  'один',
  'два',
  'три',
  'четыре',
  'пять',
  'шесть',
  'семь',
  'восемь',
  'девять',
] as const;

const ONES_FEMININE = [
  '',
  'одна',
  'две',
  'три',
  'четыре',
  'пять',
  'шесть',
  'семь',
  'восемь',
  'девять',
] as const;

const TEENS = [
  'десять',
  'одиннадцать',
  'двенадцать',
  'тринадцать',
  'четырнадцать',
  'пятнадцать',
  'шестнадцать',
  'семнадцать',
  'восемнадцать',
  'девятнадцать',
] as const;

const TENS = [
  '',
  '',
  'двадцать',
  'тридцать',
  'сорок',
  'пятьдесят',
  'шестьдесят',
  'семьдесят',
  'восемьдесят',
  'девяносто',
] as const;

const HUNDREDS = [
  '',
  'сто',
  'двести',
  'триста',
  'четыреста',
  'пятьсот',
  'шестьсот',
  'семьсот',
  'восемьсот',
  'девятьсот',
] as const;

function pluralizeRu(
  n: number,
  forms: readonly [string, string, string]
): string {
  const mod100 = Math.abs(n) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 19) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

function triadToWords(triad: number, feminine: boolean): string[] {
  const words: string[] = [];
  const h = Math.floor(triad / 100);
  const rem = triad % 100;
  if (h > 0) words.push(HUNDREDS[h]);

  if (rem >= 10 && rem <= 19) {
    words.push(TEENS[rem - 10]);
  } else {
    const t = Math.floor(rem / 10);
    const o = rem % 10;
    if (t > 0) words.push(TENS[t]);
    if (o > 0) words.push(feminine ? ONES_FEMININE[o] : ONES_MASCULINE[o]);
  }
  return words;
}

/**
 * Формирует точную бухгалтерскую сумму прописью на русском языке:
 * например: «Тридцать пять тысяч рублей 00 копеек» или «Двадцать одна тысяча рублей 50 копеек».
 */
export function formatRublesInWordsRu(
  rubles: number,
  kopeks = 0
): string {
  const safeRub = Math.max(0, Math.floor(Number.isFinite(rubles) ? rubles : 0));
  const safeKop = Math.max(
    0,
    Math.min(99, Math.round(Number.isFinite(kopeks) ? kopeks : 0))
  );

  let rubWords: string;
  if (safeRub === 0) {
    rubWords = 'Ноль рублей';
  } else {
    const parts: string[] = [];
    const billions = Math.floor(safeRub / 1_000_000_000);
    const millions = Math.floor((safeRub % 1_000_000_000) / 1_000_000);
    const thousands = Math.floor((safeRub % 1_000_000) / 1_000);
    const units = safeRub % 1_000;

    if (billions > 0) {
      parts.push(
        ...triadToWords(billions, false),
        pluralizeRu(billions, ['миллиард', 'миллиарда', 'миллиардов'])
      );
    }
    if (millions > 0) {
      parts.push(
        ...triadToWords(millions, false),
        pluralizeRu(millions, ['миллион', 'миллиона', 'миллионов'])
      );
    }
    if (thousands > 0) {
      parts.push(
        ...triadToWords(thousands, true),
        pluralizeRu(thousands, ['тысяча', 'тысячи', 'тысяч'])
      );
    }
    if (units > 0) {
      parts.push(...triadToWords(units, false));
    }

    const rubNoun = pluralizeRu(safeRub, ['рубль', 'рубля', 'рублей']);
    const joined = [...parts, rubNoun].join(' ');
    rubWords = joined.charAt(0).toUpperCase() + joined.slice(1);
  }

  const kopStr = String(safeKop).padStart(2, '0');
  const kopNoun = pluralizeRu(safeKop, ['копейка', 'копейки', 'копеек']);
  return `${rubWords} ${kopStr} ${kopNoun}`;
}

export function computeVatBreakdown(
  baseAmountRub: number,
  taxRegime: StudioTaxRegimeId,
  vatMode: StudioVatCalculationMode = 'included'
): TaxCalculationSummary {
  const safeRub = Math.max(0, Math.round(Number.isFinite(baseAmountRub) ? baseAmountRub : 0));
  const baseKopecks = safeRub * 100;
  const regimeMeta =
    TAX_REGIME_OPTIONS.find((r) => r.id === taxRegime) ?? TAX_REGIME_OPTIONS[0];
  const rate = regimeMeta.ratePercent;

  let subtotalExclVatKopecks = baseKopecks;
  let vatAmountKopecks = 0;
  let totalPayableKopecks = baseKopecks;

  if (rate > 0 && baseKopecks > 0) {
    if (vatMode === 'included') {
      vatAmountKopecks = Math.round((baseKopecks * rate) / (100 + rate));
      subtotalExclVatKopecks = baseKopecks - vatAmountKopecks;
      totalPayableKopecks = baseKopecks;
    } else {
      vatAmountKopecks = Math.round((baseKopecks * rate) / 100);
      subtotalExclVatKopecks = baseKopecks;
      totalPayableKopecks = baseKopecks + vatAmountKopecks;
    }
  }

  const totalPayableRubFloor = Math.floor(totalPayableKopecks / 100);
  const totalPayableKopeksPart = totalPayableKopecks % 100;

  const formattedVatLine =
    rate === 0
      ? 'Без налога (НДС)'
      : `${formatKopecksRubDecimal(vatAmountKopecks)} (${rate}%)`;

  const taxLegalLabel =
    rate === 0
      ? 'НДС не облагается в связи с применением УСН (гл. 26.2, ст. 346.11 НК РФ)'
      : `В том числе НДС ${rate}% — ${formatKopecksRubDecimal(vatAmountKopecks)}`;

  return {
    taxRegime,
    vatMode,
    vatRatePercent: rate,
    subtotalExclVatKopecks,
    vatAmountKopecks,
    totalPayableKopecks,
    totalPayableRubFloor,
    totalPayableKopeksPart,
    formattedSubtotalRub: formatKopecksRubDecimal(subtotalExclVatKopecks),
    formattedVatLine,
    formattedTotalRub: formatKopecksRubDecimal(totalPayableKopecks),
    taxLegalLabel,
    totalInWordsRu: formatRublesInWordsRu(
      totalPayableRubFloor,
      totalPayableKopeksPart
    ),
  };
}

export function parseCustomerCounterparty(
  companyOrInnRaw: string,
  contactRaw: string,
  meta?: OrderDocumentMeta
): ParsedCustomerCounterparty {
  const trimmedRaw = (companyOrInnRaw || '').trim();
  const embeddedMatch = trimmedRaw.match(
    /^(.*?)[\s·,;(/|-]*инн[\s:№-]*(\d{10,12})[)\s]*$/i
  );
  const pureInnMatch = trimmedRaw.replace(/[\s-]/g, '').match(/^(\d{10,12})$/);

  const parsedName = embeddedMatch
    ? embeddedMatch[1].replace(/[·,;|\s-]+$/g, '').trim()
    : pureInnMatch
      ? ''
      : trimmedRaw;

  const parsedInn = embeddedMatch
    ? embeddedMatch[2]
    : pureInnMatch
      ? pureInnMatch[1]
      : '';

  const finalInn = (meta?.customerInn?.trim() || parsedInn).replace(/\D/g, '').slice(0, 12);
  const offlineFallback = finalInn ? resolveOfflineCounterpartyByInn(finalInn) : null;
  const isIpByInn = finalInn.length === 12;
  const finalName =
    meta?.customerLegalName?.trim() ||
    parsedName ||
    offlineFallback?.legalName ||
    (finalInn
      ? isIpByInn
        ? `Индивидуальный предприниматель (ИНН ${finalInn})`
        : `Организация Заказчика (ИНН ${finalInn})`
      : 'Реквизиты Заказчика уточняются перед подписанием');

  const finalKpp = isIpByInn
    ? ''
    : (meta?.customerKpp?.trim() || offlineFallback?.kpp || '')
        .replace(/\D/g, '')
        .slice(0, 9);

  const finalOgrn = (meta?.customerOgrn?.trim() || offlineFallback?.ogrn || '')
    .replace(/\D/g, '')
    .slice(0, 15);

  const finalAddress =
    meta?.customerAddress?.trim() || offlineFallback?.legalAddress || '';
  const finalSignatory =
    meta?.customerSignatory?.trim() || offlineFallback?.signatory || '';
  const finalEdoBoxId =
    meta?.customerEdoBoxId?.trim() || offlineFallback?.diadoc.boxId || '';
  const finalEdoOperator =
    meta?.customerEdoOperator?.trim() ||
    (offlineFallback?.diadoc.hasBox ? offlineFallback.diadoc.operatorLabel : '');

  return {
    displayName: finalName,
    inn: finalInn,
    kpp: finalKpp,
    ogrn: finalOgrn,
    isIpByInn,
    address: finalAddress,
    signatory: finalSignatory,
    edoBoxId: finalEdoBoxId,
    edoOperator: finalEdoOperator,
    wantsDiadocDuplicate: Boolean(meta?.wantsDiadocDuplicate),
    contact: (contactRaw || '').trim() || 'Контактное лицо Заказчика',
    isPlaceholder: !meta?.customerLegalName?.trim() && !parsedName && !finalInn,
  };
}

export function resolveProductionTierScope(
  formatLabelRaw: string,
  effectivePriceRub: number,
  spotDurationSec: number,
  formattedPayableRubOverride?: string
): ProductionTierScopeSpec {
  const lower = (formatLabelRaw || '').toLowerCase();
  const isNegotiable =
    effectivePriceRub <= 0 ||
    (!formattedPayableRubOverride && (lower.includes('договорн') || lower.includes('индивидуальн')));
  const formattedPrice =
    formattedPayableRubOverride || `${formatKopecksRubDecimal(effectivePriceRub * 100)}`;

  const explicitCinema = lower.includes('игров') || lower.includes('кино') || lower.includes('cinema');
  const explicitVoice = lower.includes('голос') || lower.includes('voice');
  const explicitAdapt = lower.includes('адаптац') || lower.includes('ресайз');
  const explicitTurnkey =
    lower.includes('под ключ') || lower.includes('turnkey') || lower.includes('эфирн');
  const explicitCustom = lower.includes('индивидуальн') || lower.includes('договорн');

  if (
    explicitCinema ||
    (!explicitVoice &&
      !explicitAdapt &&
      !explicitTurnkey &&
      !explicitCustom &&
      effectivePriceRub >= 33_000)
  ) {
    return {
      tierTitle: 'Игровой аудиоролик / Мини-кино',
      conceptsCountLabel: 'До 3 драматургических концепций сценария с посекундным таймингом',
      voiceCastLabel:
        'Режиссёрский подбор и запись до 2 профессиональных актёров / дикторов в студии',
      soundAndMusicLabel:
        'Лицензионная музыкальная фонограмма (Royalty-Free) + многослойный саунд-дизайн (SFX)',
      revisionsIncludedLabel:
        '1 сервисный раунд финальной доводки (коррекция баланса либо до 1 замены музыкальной подложки без доплат)',
      turnaroundLabel: '4–5 рабочих дней с даты поступления 100% предоплаты',
      kpLineItems: [
        {
          code: '01',
          title: `Разработка до 3 концепций игрового сценария (хронометраж ${spotDurationSec} сек) и пре-чек ФЗ-38`,
          turnaround: '1–2 раб. дня',
          priceNote: 'Включено',
        },
        {
          code: '02',
          title: 'Кастинг голосов кинодубляжа и студийная запись актёрского диалога / дикторов',
          turnaround: '1 раб. день',
          priceNote: 'Включено',
        },
        {
          code: '03',
          title: 'Лицензионное музыкальное оформление, интершумы (SFX) и эфирный мастеринг по Разделу 3 Договора',
          turnaround: '1–2 раб. дня',
          priceNote: isNegotiable ? 'По оценке' : formattedPrice,
        },
        {
          code: '04',
          title: 'Оформление Паспорта рекламного аудиоролика (сведения РАО / ВОИС для радиостанций)',
          turnaround: 'В день сдачи',
          priceNote: 'Включено',
        },
      ],
    };
  }

  if (
    explicitVoice ||
    (!explicitAdapt &&
      !explicitTurnkey &&
      !explicitCustom &&
      effectivePriceRub > 0 &&
      effectivePriceRub <= 17_000)
  ) {
    return {
      tierTitle: 'Голос и стиль (информационный ролик)',
      conceptsCountLabel: 'До 2 лаконичных вариантов сценария под точный хронометраж',
      voiceCastLabel: 'Режиссёрский подбор и запись 1 фирменного диктора из студийной базы FMWorks',
      soundAndMusicLabel:
        'Подбор лицензионной музыкальной подложки (Royalty-Free) и чистовое сведение',
      revisionsIncludedLabel:
        '1 сервисный раунд финальной доводки (коррекция баланса либо до 1 замены музыкальной подложки без доплат)',
      turnaroundLabel: '1–2 рабочих дня (24–48 ч) с даты поступления 100% предоплаты',
      kpLineItems: [
        {
          code: '01',
          title: `Редактура / разработка текста аудиоролика под хронометраж ${spotDurationSec} сек и пре-чек ФЗ-38`,
          turnaround: 'До 24 ч',
          priceNote: 'Включено',
        },
        {
          code: '02',
          title: 'Студийная запись 1 диктора, лицензионная подложка и мастеринг под эфирный стандарт РФ',
          turnaround: '24 ч',
          priceNote: isNegotiable ? 'По оценке' : formattedPrice,
        },
        {
          code: '03',
          title: 'Выпуск Паспорта рекламного аудиоролика (РАО / ВОИС) для юридической службы радиостанции',
          turnaround: 'В день сдачи',
          priceNote: 'Включено',
        },
      ],
    };
  }

  if (explicitAdapt) {
    return {
      tierTitle: 'Эфирная адаптация и ресайз аудиоролика',
      conceptsCountLabel: 'Выверка сокращённой редакции текста и юридических дисклеймеров',
      voiceCastLabel: 'Монтаж утверждённой начитки либо дозапись изменённой концовки (по задаче)',
      soundAndMusicLabel: 'Пересборка музыкальной формы и выравнивание громкости под эфирный стандарт РФ',
      revisionsIncludedLabel: 'До 2 итераций точной подгонки хронометража и баланса',
      turnaroundLabel: '1–2 рабочих дня с даты поступления 100% предоплаты',
      kpLineItems: [
        {
          code: '01',
          title: `Адаптация хронометража до ${spotDurationSec} сек, сведение и мастеринг по эфирному стандарту РФ`,
          turnaround: '1–2 раб. дня',
          priceNote: isNegotiable ? 'По оценке' : formattedPrice,
        },
        {
          code: '02',
          title: 'Актуализация Паспорта рекламного аудиоролика (РАО / ВОИС)',
          turnaround: 'В день сдачи',
          priceNote: 'Включено',
        },
      ],
    };
  }

  if (isNegotiable) {
    return {
      tierTitle: 'Индивидуальный студийный проект (по оценке продюсера)',
      conceptsCountLabel: 'Индивидуальная разработка креативной концепции и сценариев по брифу',
      voiceCastLabel: 'Подбор дикторов / актёров дубляжа под задачу проекта',
      soundAndMusicLabel: 'Музыкальное лицензирование, саунд-дизайн и эфирный мастеринг',
      revisionsIncludedLabel: 'Фиксируется в Приложении № 1 после согласования объёма задачи',
      turnaroundLabel: 'Фиксируется в Приложении № 1 после утверждения сметы с продюсером',
      kpLineItems: [
        {
          code: '01',
          title: `Анализ задачи Заказчика, расчёт хронометража (${spotDurationSec} сек) и формирование сметы`,
          turnaround: 'В течение 2 раб. ч',
          priceNote: 'Бесплатно',
        },
        {
          code: '02',
          title: 'Полный цикл студийного аудиопродакшна и передача прав по Приложению № 1 к Договору',
          turnaround: 'По согласованию',
          priceNote: 'Расчёт продюсером',
        },
      ],
    };
  }

  return {
    tierTitle: 'Продакшн под ключ',
    conceptsCountLabel: 'До 3 авторских концепций сценария с расчётом хронометража',
    voiceCastLabel:
      'Режиссёрский подбор голоса студией и запись 1 профильного диктора по утверждённому сценарию',
    soundAndMusicLabel:
      'Коммерческая лицензионная музыка (Royalty-Free), звуковые акценты и эфирный мастеринг',
    revisionsIncludedLabel:
      '1 сервисный раунд финальной доводки (коррекция баланса либо до 1 замены музыкальной подложки без доплат)',
    turnaroundLabel: '3–4 рабочих дня с даты поступления 100% предоплаты',
    kpLineItems: [
      {
        code: '01',
        title: `Разработка 3 концепций сценария под хронометраж ${spotDurationSec} сек и пре-чек ФЗ-38`,
        turnaround: '1–2 раб. дня',
        priceNote: 'Включено',
      },
      {
        code: '02',
        title: 'Кастинг голосов, студийная запись диктора, музыкальная лицензия и мастеринг',
        turnaround: '1–2 раб. дня',
        priceNote: formattedPrice,
      },
      {
        code: '03',
        title: 'Оформление Паспорта рекламного аудиоролика (РАО / ВОИС) для радиостанций РФ',
        turnaround: 'В день сдачи',
        priceNote: 'Включено',
      },
    ],
  };
}

function buildDealShortCode(orderNumber: string, createdAtIso: string): string {
  const digits = (orderNumber || '').replace(/\D/g, '');
  const year = (() => {
    const parsed = new Date(createdAtIso);
    return Number.isNaN(parsed.getTime()) ? '2026' : String(parsed.getFullYear());
  })();
  const suffix = digits ? digits.slice(-4) : '0104';
  return `${year}/${suffix}`;
}

function formatRussianDateHuman(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '18.04.2026';
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '18.04.2026';
  }
}

function slugifyMasterFileName(title: string, durationSec: number, dealCode: string): string {
  const cleanSuffix = dealCode.replace('/', '_');
  const ascii = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 22);
  const stem = /[a-z]{3,}/.test(ascii) ? ascii : `FMWorks_Spot_${cleanSuffix}`;
  return `${stem}_${durationSec}s.wav`;
}

export interface AssembleDocumentSuiteInput {
  orderNumber: string;
  createdAtIso: string;
  formatLabel: string;
  baseBudgetRub: number;
  defaultDurationSec?: number;
  contact: string;
  companyOrInn: string;
  briefText: string;
  legalProfiles?: Partial<StudioLegalProfilesConfig> | null;
  documentMeta?: OrderDocumentMeta | null;
}

export function assembleProductionDocumentSuite(
  input: AssembleDocumentSuiteInput
): AssembledDocumentSuite {
  const profiles = sanitizeStudioLegalProfilesConfig(input.legalProfiles);
  const meta = sanitizeOrderDocumentMeta(input.documentMeta);

  const chosenEntityKind: StudioEntityKind =
    meta.entityKindOverride === 'ip' || meta.entityKindOverride === 'ooo'
      ? meta.entityKindOverride
      : profiles.activeEntityKind;

  const baseProfile =
    chosenEntityKind === 'ooo' ? profiles.oooProfile : profiles.ipProfile;

  const effectiveTaxRegime: StudioTaxRegimeId =
    meta.taxRegimeOverride && meta.taxRegimeOverride !== 'default'
      ? meta.taxRegimeOverride
      : baseProfile.taxRegime;

  const studio: StudioLegalProfile = {
    ...baseProfile,
    taxRegime: effectiveTaxRegime,
  };

  // Извлекаем длительность из метаданных, строки формата (например "(20 сек)") или дефолта
  const durationInLabelMatch = (input.formatLabel || '').match(/(\d{1,2})\s*сек/i);
  const resolvedDurationSec =
    meta.spotExactDurationSec ??
    (durationInLabelMatch ? Number(durationInLabelMatch[1]) : undefined) ??
    input.defaultDurationSec ??
    30;
  const spotDurationSec = Math.max(5, Math.min(120, Math.round(resolvedDurationSec)));
  const spotDurationFormatted = `00:${String(spotDurationSec).padStart(2, '0')}`;

  // Если заказ был с "Договорной ценой" (0 ₽), но продюсер указал customPriceRub > 0 — разблокируем цену!
  const effectivePriceRub =
    typeof meta.customPriceRub === 'number' && meta.customPriceRub >= 0
      ? meta.customPriceRub
      : Math.max(0, Math.round(input.baseBudgetRub || 0));

  const isNegotiablePendingPrice = effectivePriceRub <= 0;

  const dealCode = buildDealShortCode(input.orderNumber, input.createdAtIso);
  const issueDateRu = formatRussianDateHuman(input.createdAtIso);
  const appendixNumber = meta.appendixNumber ?? 1;
  const contractNumber = meta.frameworkContractNumber || `ДП-${dealCode}`;
  const contractDateRu = meta.frameworkContractDate || issueDateRu;
  const kpNumber = `КП-${dealCode}`;
  const invoiceNumber = `СЧ-${dealCode}-${appendixNumber}`;
  const actNumber = `АКТ-${dealCode}-${appendixNumber}`;
  const passportNumber = `ПР-${dealCode}-${appendixNumber}`;

  const customer = parseCustomerCounterparty(
    input.companyOrInn,
    input.contact,
    meta
  );

  const tax = computeVatBreakdown(
    effectivePriceRub,
    studio.taxRegime,
    studio.vatMode
  );

  const scope = resolveProductionTierScope(
    input.formatLabel,
    effectivePriceRub,
    spotDurationSec,
    isNegotiablePendingPrice ? undefined : tax.formattedTotalRub
  );

  const autoSpotTitle =
    meta.spotWorkingTitle ||
    (customer.isPlaceholder
      ? `Рекламный аудиоролик (${spotDurationSec} сек)`
      : `${customer.displayName} — Аудиоролик (${spotDurationSec} сек)`);

  const spotMasterFileName =
    meta.spotMasterFileName ||
    slugifyMasterFileName(autoSpotTitle, spotDurationSec, dealCode);

  const fz38StatusId: Fz38DisclaimerStatus =
    meta.fz38DisclaimerStatus ?? 'included_in_spot';
  const fz38Meta =
    FZ38_DISCLAIMER_STATUS_OPTIONS.find((f) => f.id === fz38StatusId) ??
    FZ38_DISCLAIMER_STATUS_OPTIONS[0];

  const purposeText = `Оплата по Счёту № ${invoiceNumber} от ${issueDateRu} (Приложение № ${appendixNumber} к Договору № ${contractNumber}). ${
    tax.vatRatePercent === 0 ? 'Без НДС.' : `В т.ч. НДС ${tax.vatRatePercent}%.`
  }`;

  // Строка платёжных реквизитов по ГОСТ Р 56042-2014 (ST00012) для импорта в банк-клиент РФ
  const paymentQrPayload = [
    'ST00012',
    `Name=${studio.legalName}`,
    `PersonalAcc=${studio.checkingAccount}`,
    `BankName=${studio.bankName}`,
    `BIC=${studio.bik}`,
    `CorrespAcc=${studio.correspondentAccount}`,
    `PayeeINN=${studio.inn}`,
    ...(studio.entityKind === 'ooo' && studio.kpp ? [`KPP=${studio.kpp}`] : []),
    `Sum=${tax.totalPayableKopecks}`,
    `Purpose=${purposeText}`,
  ].join('|');

  return {
    orderNumber: input.orderNumber,
    dealCode,
    issueDateRu,
    city: studio.city,
    kpNumber,
    contractNumber,
    contractDateRu,
    appendixNumber,
    invoiceNumber,
    actNumber,
    passportNumber,
    isNegotiablePendingPrice,
    effectivePriceRub,
    spotDurationSec,
    spotDurationFormatted,
    spotWorkingTitle: autoSpotTitle,
    spotMasterFileName,
    studio,
    customer,
    scope,
    tax,
    specialTechNote:
      meta.specialTechOverride ||
      'Базовый эфирный стандарт радиостанций РФ согласно Разделу 3 Договора (WAV PCM 44 100 Гц / 16 bit Stereo + MP3 320 kbps, -14…-11 LUFS, пики ≤ -0.5 dBTP).',
    passport: {
      scriptAuthorLine:
        meta.scriptAuthorLine ||
        `Штатный сценарист студии FMWorks® (служебное произведение, отчуждение прав по Приложению № ${appendixNumber} к Договору № ${contractNumber})`,
      voiceTalentLine:
        meta.voiceTalentLine ||
        'Профессиональный диктор базы FMWorks® (разрешение на коммерческое обнародование и вещание урегулировано Изготовителем, ст. 1317 ГК РФ)',
      musicTitleAndComposer:
        meta.musicTitleAndComposer ||
        'Лицензионная фонограмма из коммерческого каталога Production Music Library (автор и ID трека фиксируются при выпуске мастера)',
      musicLicenseLine:
        meta.musicLicenseLine ||
        `Коммерческая лицензия студии FMWorks® (Royalty-Free, не состоит в реестре управления РАО / ВОИС, доп. отчисления вещателя не требуются)`,
      territoryAndTermLine:
        meta.territoryAndTermLine ||
        'Российская Федерация; эфирное, кабельное и цифровое радиовещание; бессрочно в пределах условий лицензии без ограничений числа выходов',
      fz38StatusLabel: fz38Meta.passportDescription,
      fz38StatusId,
    },
    paymentQrPayload,
  };
}

/**
 * Формирует лаконичную текстовую выжимку пакета документов для буфера обмена / ЭДО / мессенджера
 * (строго продакшн, г. Тверь, реквизиты FMWorks®, без запрещённых терминов).
 */
export function formatProductionSuitePlainSummary(
  suite: AssembledDocumentSuite,
  activeDoc: BrandedDocumentKind = 'invoice'
): string {
  const { studio, customer, tax, scope } = suite;
  const kppPart = studio.entityKind === 'ooo' && studio.kpp ? `, КПП ${studio.kpp}` : '';
  const ogrnLabel = studio.entityKind === 'ip' ? 'ОГРНИП' : 'ОГРН';

  const headerLines = [
    `FMWorks® — Студийный аудиопродакшн полного цикла (${studio.city})`,
    `Официальный сайт: https://${studio.websiteDomain} · Почта: ${studio.email} · Тел.: ${studio.phone}`,
    `──────────────────────────────────────────────────────────────────────`,
  ];

  if (activeDoc === 'kp') {
    return [
      ...headerLines,
      `КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ № ${suite.kpNumber} от ${suite.issueDateRu}`,
      `Заказчик: ${customer.displayName}${customer.inn ? ` (ИНН ${customer.inn})` : ''}`,
      `Проект: ${suite.spotWorkingTitle} · Хронометраж: ${suite.spotDurationSec} сек (${suite.spotDurationFormatted})`,
      `Тариф продакшна: ${scope.tierTitle}`,
      ``,
      `СОСТАВ СТУДИЙНЫХ РАБОТ:`,
      ...scope.kpLineItems.map(
        (item) => `${item.code}. ${item.title} [${item.turnaround}] — ${item.priceNote}`
      ),
      ``,
      suite.isNegotiablePendingPrice
        ? `СТОИМОСТЬ: Договорная цена (расчёт сметы продюсером в Приложении № ${suite.appendixNumber})`
        : `ИТОГО: ${tax.formattedTotalRub} (${tax.totalInWordsRu}). ${tax.taxLegalLabel}.`,
      `Условия запуска: 100% предоплата до начала разработки сценариев и записи.`,
      `Техстандарт сдачи: WAV PCM 44 100 Гц / 16 bit Stereo + MP3 320 kbps, -14…-11 LUFS, пики ≤ -0.5 dBTP + Паспорт ролика (РАО / ВОИС).`,
    ].join('\n');
  }

  if (activeDoc === 'passport') {
    return [
      ...headerLines,
      `ПАСПОРТ РЕКЛАМНОГО АУДИОРОЛИКА № ${suite.passportNumber} от ${suite.issueDateRu} (${studio.city})`,
      `Сведения об авторских и смежных правах для радиовещателей, РАО и ВОИС`,
      `1. Название аудиоролика (файл): ${suite.spotMasterFileName} («${suite.spotWorkingTitle}»)`,
      `2. Точный хронометраж: ${suite.spotDurationFormatted} (${suite.spotDurationSec} сек ровно)`,
      `3. Рекламодатель: ${customer.displayName}${customer.inn ? `, ИНН ${customer.inn}` : ''}`,
      `4. Изготовитель: ${studio.legalName}, ИНН ${studio.inn}${kppPart}, ${studio.city}, ${studio.websiteDomain}`,
      `5. Автор текста (сценария): ${suite.passport.scriptAuthorLine}`,
      `6. Исполнители (дикторы, ст. 1317 ГК РФ): ${suite.passport.voiceTalentLine}`,
      `7. Музыкальное оформление и лицензия: ${suite.passport.musicTitleAndComposer} · ${suite.passport.musicLicenseLine}`,
      `8. Территория и срок вещания: ${suite.passport.territoryAndTermLine}`,
      `Соответствие ФЗ-38 «О рекламе»: ч. 11 ст. 15 (уровень громкости -14…-11 LUFS) соблюдена. ${suite.passport.fz38StatusLabel}`,
    ].join('\n');
  }

  if (activeDoc === 'contract') {
    return [
      ...headerLines,
      `ДОГОВОР № ${suite.contractNumber} от ${suite.contractDateRu} (${studio.city})`,
      `+ ПРИЛОЖЕНИЕ № ${suite.appendixNumber} (ЗАКАЗ-СПЕЦИФИКАЦИЯ)`,
      `Исполнитель: ${studio.legalName} (ИНН ${studio.inn}${kppPart}, ${ogrnLabel} ${studio.ogrnOrOgrnip})`,
      `Заказчик: ${customer.displayName}${customer.inn ? ` (ИНН ${customer.inn})` : ''}`,
      `• Принцип: Единый договор на производство аудиопродукции (100% предоплата по договору или банковской картой); цена и объём в Приложении № ${suite.appendixNumber}.`,
      `• Раздел 3 Договора (ст. 721 ГК РФ): Базовый эфирный техстандарт радиостанций РФ — WAV 44 100 Гц / 16 bit Stereo + MP3 320 kbps, -14…-11 LUFS (ч. 11 ст. 15 ФЗ-38), пики ≤ -0.5 dBTP, моносовместимость, отсутствие пустых пауз > 0,1 сек.`,
      `• Раздел 5 Договора: Двусторонняя ответственность (ст. 431.2, 1285, 1301, 1311, 400 ГК РФ, ст. 38 ФЗ-38), подсудность — Арбитражный суд Тверской области (${studio.city}).`,
      `• Приложение № ${suite.appendixNumber}: «${suite.spotWorkingTitle}», ${suite.spotDurationSec} сек, тариф «${scope.tierTitle}», ${
        suite.isNegotiablePendingPrice
          ? 'стоимость определяется после оценки продюсером'
          : `стоимость ${tax.formattedTotalRub} (${tax.taxLegalLabel})`
      }.`,
    ].join('\n');
  }

  if (activeDoc === 'act') {
    return [
      ...headerLines,
      `АКТ СДАЧИ-ПРИЁМКИ ОКАЗАННЫХ УСЛУГ № ${suite.actNumber} от ${suite.issueDateRu}`,
      `Основание: Приложение № ${suite.appendixNumber} к Договору № ${suite.contractNumber} от ${suite.contractDateRu}`,
      `Исполнитель: ${studio.legalName} (ИНН ${studio.inn}${kppPart}, ${ogrnLabel} ${studio.ogrnOrOgrnip})`,
      `Заказчик: ${customer.displayName}${customer.inn ? ` (ИНН ${customer.inn}${customer.kpp ? `, КПП ${customer.kpp}` : ''})` : ''}`,
      ``,
      `1. Наименование выполненной работы: Производство рекламного аудиоролика «${suite.spotWorkingTitle}» (файл ${suite.spotMasterFileName}, хронометраж ${suite.spotDurationSec} сек, тариф «${scope.tierTitle}») и отчуждение исключительных прав на готовую фонограмму (ст. 1234, 1285 ГК РФ).`,
      `2. Технический контроль и Паспорт прав: Мастер-файл соответствует Разделу 3 Договора (WAV PCM + MP3 320 kbps, -14…-11 LUFS, пики ≤ -0.5 dBTP). Паспорт рекламного аудиоролика № ${suite.passportNumber} передан Заказчику.`,
      suite.isNegotiablePendingPrice
        ? `3. Стоимость работ: Фиксируется по согласованной смете в Приложении № ${suite.appendixNumber}.`
        : `3. Всего оказано услуг на сумму: ${tax.formattedTotalRub} (${tax.totalInWordsRu}). ${tax.taxLegalLabel}.`,
      `4. Работы выполнены в полном объёме, в установленный срок и надлежащего качества. Стороны взаимных претензий не имеют.`,
    ].join('\n');
  }

  return [
    ...headerLines,
    `СЧЁТ НА ОПЛАТУ № ${suite.invoiceNumber} от ${suite.issueDateRu}`,
    `Основание: Приложение № ${suite.appendixNumber} к Договору № ${suite.contractNumber} от ${suite.contractDateRu}`,
    `Получатель: ${studio.legalName}`,
    `ИНН ${studio.inn}${kppPart} · ${ogrnLabel} ${studio.ogrnOrOgrnip}`,
    `Банк: ${studio.bankName} · БИК ${studio.bik}`,
    `Р/с: ${studio.checkingAccount} · К/с: ${studio.correspondentAccount}`,
    `ЭДО Поставщика: ${studio.edoOperatorLabel} (ID: ${studio.edoParticipantId})`,
    `Заказчик: ${customer.displayName}${customer.inn ? `, ИНН ${customer.inn}` : ''}${
      customer.kpp ? `, КПП ${customer.kpp}` : ''
    }${
      customer.ogrn
        ? `, ${customer.isIpByInn ? 'ОГРНИП' : 'ОГРН'} ${customer.ogrn}`
        : ''
    }`,
    ...(customer.address ? [`Юр. адрес Заказчика: ${customer.address}`] : []),
    ...(customer.edoBoxId
      ? [`ЭДО Заказчика (Диадок): ${customer.edoBoxId}`]
      : []),
    ``,
    `Позиция 1: Создание рекламного аудиоролика и передача прав по Приложению № ${suite.appendixNumber} («${suite.spotWorkingTitle}», ${suite.spotDurationSec} сек, тариф «${scope.tierTitle}»)`,
    suite.isNegotiablePendingPrice
      ? `Сумма: Договорная цена — счёт к оплате выставляется после утверждения сметы продюсером.`
      : `Итого к оплате: ${tax.formattedTotalRub} (${tax.totalInWordsRu})\nНалог: ${tax.taxLegalLabel}`,
  ].join('\n');
}
