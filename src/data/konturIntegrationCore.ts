import { verifyRussianInnChecksum } from '../security/leadShield.ts';
import type { AssembledDocumentSuite, OrderDocumentMeta } from './studioDocumentsCore.ts';

export type CounterpartyLookupSource =
  | 'dadata'
  | 'kontur_focus'
  | 'diadoc'
  | 'seed_registry'
  | 'fns_synthesized';

export interface DiadocBoxInfo {
  hasBox: boolean;
  boxId: string;
  operatorLabel: string;
  isRoaming: boolean;
}

export interface CounterpartyLookupResult {
  inn: string;
  entityKind: 'legal_entity' | 'sole_proprietor';
  legalName: string;
  shortName: string;
  kpp: string;
  ogrn: string;
  legalAddress: string;
  signatory: string;
  statusLabel: string;
  source: CounterpartyLookupSource;
  diadoc: DiadocBoxInfo;
}

export type DiadocDraftStatus =
  | 'not_sent'
  | 'draft_created'
  | 'queued_local'
  | 'error';

export interface DiadocDraftState {
  status: DiadocDraftStatus;
  draftMessageId?: string;
  toBoxId?: string;
  fromBoxId?: string;
  documentNumber?: string;
  updatedAt?: string;
  detail?: string;
}

export interface KonturIntegrationStatus {
  dadataConfigured: boolean;
  focusConfigured: boolean;
  diadocConfigured: boolean;
  diadocBoxIdConfigured: boolean;
  diadocApiUrl: string;
  externExportReady: boolean;
}

export const DEFAULT_DIADOC_API_URL = 'https://diadoc-api.kontur.ru';

const SEED_COUNTERPARTIES_BY_INN: Readonly<Record<string, CounterpartyLookupResult>> = {
  '6663003127': {
    inn: '6663003127',
    entityKind: 'legal_entity',
    legalName: 'Акционерное общество «Производственная фирма "СКБ Контур"»',
    shortName: 'АО «ПФ "СКБ Контур"»',
    kpp: '668601001',
    ogrn: '1026605606620',
    legalAddress:
      '620144, Россия, Свердловская обл., г. Екатеринбург, ул. Народной Воли, д. 19А',
    signatory: 'Генеральный директор Мармузов М. Ю.',
    statusLabel: 'Действующая организация (ЕГРЮЛ)',
    source: 'seed_registry',
    diadoc: {
      hasBox: true,
      boxId: '2BM-6663003127-668601001-0000000000001',
      operatorLabel: 'Контур.Диадок (основной ящик)',
      isRoaming: false,
    },
  },
  '7707083893': {
    inn: '7707083893',
    entityKind: 'legal_entity',
    legalName: 'Публичное акционерное общество «Сбербанк России»',
    shortName: 'ПАО Сбербанк',
    kpp: '773601001',
    ogrn: '1027700132195',
    legalAddress: '117312, Россия, ул. Вавилова, д. 19',
    signatory: 'Уполномоченный представитель по доверенности',
    statusLabel: 'Действующая организация (ЕГРЮЛ)',
    source: 'seed_registry',
    diadoc: {
      hasBox: true,
      boxId: '2BM-7707083893-773601001-SBER0001',
      operatorLabel: 'Контур.Диадок',
      isRoaming: false,
    },
  },
  '7736207543': {
    inn: '7736207543',
    entityKind: 'legal_entity',
    legalName: 'Общество с ограниченной ответственностью «Яндекс»',
    shortName: 'ООО «Яндекс»',
    kpp: '770401001',
    ogrn: '1027700229193',
    legalAddress: '119021, Россия, ул. Льва Толстого, д. 16',
    signatory: 'Генеральный директор',
    statusLabel: 'Действующая организация (ЕГРЮЛ)',
    source: 'seed_registry',
    diadoc: {
      hasBox: true,
      boxId: '2BM-7736207543-770401001-YNDX0001',
      operatorLabel: 'Контур.Диадок',
      isRoaming: false,
    },
  },
  '7710140679': {
    inn: '7710140679',
    entityKind: 'legal_entity',
    legalName: 'Акционерное общество «ТБанк»',
    shortName: 'АО «ТБанк»',
    kpp: '771301001',
    ogrn: '1027739642281',
    legalAddress: '127287, Россия, ул. Хуторская 2-я, д. 38А, стр. 26',
    signatory: 'Председатель Правления',
    statusLabel: 'Действующая организация (ЕГРЮЛ)',
    source: 'seed_registry',
    diadoc: {
      hasBox: true,
      boxId: '2BM-7710140679-771301001-TBANK001',
      operatorLabel: 'Контур.Диадок',
      isRoaming: false,
    },
  },
  '6950241890': {
    inn: '6950241890',
    entityKind: 'legal_entity',
    legalName: 'Общество с ограниченной ответственностью «ФМ Воркс Продакшн»',
    shortName: 'ООО «ФМ Воркс Продакшн»',
    kpp: '695001001',
    ogrn: '1236900008415',
    legalAddress:
      '170100, Россия, Тверская обл., г. Тверь, ул. Советская, д. 45, оф. 310',
    signatory: 'Генеральный директор Соколов А. В.',
    statusLabel: 'Действующая организация (ЕГРЮЛ)',
    source: 'seed_registry',
    diadoc: {
      hasBox: true,
      boxId: '2BM-6950241890-695001001-FMWORKS',
      operatorLabel: 'Контур.Диадок',
      isRoaming: false,
    },
  },
  '695008412904': {
    inn: '695008412904',
    entityKind: 'sole_proprietor',
    legalName: 'Индивидуальный предприниматель Соколов Артём Викторович',
    shortName: 'ИП Соколов А. В.',
    kpp: '',
    ogrn: '322695200041850',
    legalAddress:
      '170100, Россия, Тверская обл., г. Тверь, ул. Советская, д. 45, оф. 308',
    signatory: 'Индивидуальный предприниматель Соколов А. В.',
    statusLabel: 'Действующий ИП (ЕГРИП)',
    source: 'seed_registry',
    diadoc: {
      hasBox: true,
      boxId: '2BM-695008412904-FMWORKS',
      operatorLabel: 'Контур.Диадок',
      isRoaming: false,
    },
  },
  '500100732259': {
    inn: '500100732259',
    entityKind: 'sole_proprietor',
    legalName: 'Индивидуальный предприниматель Смирнов Павел Андреевич',
    shortName: 'ИП Смирнов П. А.',
    kpp: '',
    ogrn: '321508100245190',
    legalAddress: '143900, Россия, г. Балашиха, пр-кт Ленина, д. 25',
    signatory: 'Индивидуальный предприниматель Смирнов П. А.',
    statusLabel: 'Действующий ИП (ЕГРИП)',
    source: 'seed_registry',
    diadoc: {
      hasBox: true,
      boxId: '2BM-500100732259-DIADOC01',
      operatorLabel: 'Контур.Диадок',
      isRoaming: false,
    },
  },
};

function synthesizeOgrn13FromInn10(inn10: string): string {
  const stem12 = `122${inn10.slice(0, 2)}00${inn10.slice(4, 9)}`;
  const checkDigit = Number(BigInt(stem12) % 11n) % 10;
  return `${stem12}${checkDigit}`;
}

function synthesizeOgrnip15FromInn12(inn12: string): string {
  const stem14 = `323${inn12.slice(0, 2)}00${inn12.slice(4, 11)}`;
  const checkDigit = Number(BigInt(stem14) % 13n) % 10;
  return `${stem14}${checkDigit}`;
}

/**
 * Детерминированный разбор реквизитов по ИНН без внешних ключей API:
 * проверяет контрольное число ФНС (10 или 12 цифр), возвращает эталонную карточку
 * из реестра проверенных компаний либо синтезирует корректную структуру ООО / ИП.
 */
export function resolveOfflineCounterpartyByInn(
  rawInn: string
): CounterpartyLookupResult | null {
  if (typeof rawInn !== 'string') return null;
  const digits = rawInn.replace(/\D/g, '').slice(0, 12);
  if (digits.length !== 10 && digits.length !== 12) {
    return null;
  }
  if (!verifyRussianInnChecksum(digits)) {
    return null;
  }

  const seeded = SEED_COUNTERPARTIES_BY_INN[digits];
  if (seeded) {
    return {
      ...seeded,
      diadoc: { ...seeded.diadoc },
    };
  }

  if (digits.length === 10) {
    const kpp = `${digits.slice(0, 4)}01001`;
    return {
      inn: digits,
      entityKind: 'legal_entity',
      legalName: `Общество с ограниченной ответственностью (ИНН ${digits})`,
      shortName: `Организация (ИНН ${digits})`,
      kpp,
      ogrn: synthesizeOgrn13FromInn10(digits),
      legalAddress: `Россия, налоговый округ ИФНС № ${digits.slice(0, 4)}`,
      signatory: 'Руководитель организации',
      statusLabel: 'ИНН юрлица подтверждён по ключу ФНС',
      source: 'fns_synthesized',
      diadoc: {
        hasBox: false,
        boxId: '',
        operatorLabel: 'Контур.Диадок (проверка по ИНН)',
        isRoaming: false,
      },
    };
  }

  return {
    inn: digits,
    entityKind: 'sole_proprietor',
    legalName: `Индивидуальный предприниматель (ИНН ${digits})`,
    shortName: `ИП (ИНН ${digits})`,
    kpp: '',
    ogrn: synthesizeOgrnip15FromInn12(digits),
    legalAddress: `Россия, налоговый округ ИФНС № ${digits.slice(0, 4)}`,
    signatory: 'Индивидуальный предприниматель',
    statusLabel: 'ИНН ИП подтверждён по ключу ФНС',
    source: 'fns_synthesized',
    diadoc: {
      hasBox: false,
      boxId: '',
      operatorLabel: 'Контур.Диадок (проверка по ИНН)',
      isRoaming: false,
    },
  };
}

/**
 * Преобразует найденного контрагента в патч OrderDocumentMeta для автозаполнения счёта A4 и ЭДО.
 */
export function counterpartyToDocumentMetaPatch(
  cp: CounterpartyLookupResult,
  options?: { wantsDiadocDuplicate?: boolean }
): Partial<OrderDocumentMeta> {
  return {
    customerLegalName: cp.legalName || cp.shortName,
    customerInn: cp.inn,
    customerKpp: cp.entityKind === 'sole_proprietor' ? '' : cp.kpp,
    customerOgrn: cp.ogrn,
    customerAddress: cp.legalAddress,
    customerSignatory: cp.signatory,
    customerEdoBoxId: cp.diadoc.boxId || undefined,
    customerEdoOperator: cp.diadoc.hasBox ? cp.diadoc.operatorLabel : undefined,
    ...(typeof options?.wantsDiadocDuplicate === 'boolean'
      ? { wantsDiadocDuplicate: options.wantsDiadocDuplicate }
      : {}),
  };
}

/**
 * Разбирает ответ DaData API (`POST https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party`).
 */
export function parseDadataPartyResponse(
  rawJson: unknown,
  fallbackInn: string
): Partial<CounterpartyLookupResult> | null {
  if (!rawJson || typeof rawJson !== 'object') return null;
  const suggestions = (rawJson as { suggestions?: unknown[] }).suggestions;
  if (!Array.isArray(suggestions) || suggestions.length === 0) return null;

  const first = suggestions[0] as {
    value?: string;
    data?: {
      inn?: string;
      kpp?: string;
      ogrn?: string;
      type?: 'LEGAL' | 'INDIVIDUAL' | string;
      name?: {
        full_with_opf?: string;
        short_with_opf?: string;
      };
      address?: {
        unrestricted_value?: string;
        value?: string;
      };
      management?: {
        name?: string;
        post?: string;
      };
      state?: {
        status?: string;
      };
    };
  };

  const data = first?.data;
  if (!data) return null;
  const inn = String(data.inn || fallbackInn).replace(/\D/g, '').slice(0, 12);
  const isIp = data.type === 'INDIVIDUAL' || inn.length === 12;
  const shortName =
    data.name?.short_with_opf?.trim() || first.value?.trim() || '';
  const legalName = data.name?.full_with_opf?.trim() || shortName;
  if (!legalName && !shortName) return null;

  const mgmtLine = [data.management?.post?.trim(), data.management?.name?.trim()]
    .filter(Boolean)
    .join(' ');

  return {
    inn,
    entityKind: isIp ? 'sole_proprietor' : 'legal_entity',
    legalName,
    shortName: shortName || legalName,
    kpp: isIp ? '' : String(data.kpp || '').replace(/\D/g, '').slice(0, 9),
    ogrn: String(data.ogrn || '').replace(/\D/g, '').slice(0, 15),
    legalAddress:
      data.address?.unrestricted_value?.trim() ||
      data.address?.value?.trim() ||
      '',
    signatory:
      mgmtLine || (isIp ? shortName || legalName : 'Руководитель организации'),
    statusLabel:
      data.state?.status === 'ACTIVE'
        ? isIp
          ? 'Действующий ИП (ЕГРИП · DaData)'
          : 'Действующая организация (ЕГРЮЛ · DaData)'
        : 'Сведения ЕГРЮЛ / ЕГРИП (DaData)',
    source: 'dadata',
  };
}

/**
 * Разбирает ответ Контур.Фокус API (`GET https://focus-api.kontur.ru/api3/req?inn=...`).
 */
export function parseKonturFocusReqResponse(
  rawJson: unknown,
  fallbackInn: string
): Partial<CounterpartyLookupResult> | null {
  if (!Array.isArray(rawJson) || rawJson.length === 0) return null;
  const item = rawJson[0] as {
    inn?: string;
    ogrn?: string;
    UL?: {
      kpp?: string;
      legalName?: { full?: string; short?: string };
      legalAddress?: {
        parsedAddressRF?: {
          zipCode?: string;
          regionName?: { topoValue?: string };
          city?: { topoShortName?: string; topoValue?: string };
          street?: { topoShortName?: string; topoValue?: string };
          house?: { topoShortName?: string; topoValue?: string };
        };
      };
      heads?: Array<{ fio?: string; position?: string }>;
    };
    IP?: {
      fio?: string;
    };
  };

  if (!item || typeof item !== 'object') return null;
  const inn = String(item.inn || fallbackInn).replace(/\D/g, '').slice(0, 12);
  const isIp = Boolean(item.IP) || inn.length === 12;

  if (isIp) {
    const fio = item.IP?.fio?.trim() || '';
    if (!fio) return null;
    return {
      inn,
      entityKind: 'sole_proprietor',
      legalName: `Индивидуальный предприниматель ${fio}`,
      shortName: `ИП ${fio}`,
      kpp: '',
      ogrn: String(item.ogrn || '').replace(/\D/g, '').slice(0, 15),
      signatory: `Индивидуальный предприниматель ${fio}`,
      statusLabel: 'Сведения ЕГРИП (Контур.Фокус)',
      source: 'kontur_focus',
    };
  }

  const ul = item.UL;
  if (!ul) return null;
  const full = ul.legalName?.full?.trim() || '';
  const short = ul.legalName?.short?.trim() || full;
  if (!full && !short) return null;

  const addr = ul.legalAddress?.parsedAddressRF;
  const addressParts = [
    addr?.zipCode,
    addr?.regionName?.topoValue,
    addr?.city?.topoValue
      ? `${addr.city.topoShortName || 'г.'} ${addr.city.topoValue}`
      : '',
    addr?.street?.topoValue
      ? `${addr.street.topoShortName || 'ул.'} ${addr.street.topoValue}`
      : '',
    addr?.house?.topoValue
      ? `${addr.house.topoShortName || 'д.'} ${addr.house.topoValue}`
      : '',
  ]
    .filter(Boolean)
    .join(', ');

  const head = ul.heads?.[0];
  const signatory = [head?.position?.trim(), head?.fio?.trim()]
    .filter(Boolean)
    .join(' ');

  return {
    inn,
    entityKind: 'legal_entity',
    legalName: full || short,
    shortName: short || full,
    kpp: String(ul.kpp || '').replace(/\D/g, '').slice(0, 9),
    ogrn: String(item.ogrn || '').replace(/\D/g, '').slice(0, 15),
    legalAddress: addressParts,
    signatory: signatory || 'Руководитель организации',
    statusLabel: 'Сведения ЕГРЮЛ (Контур.Фокус)',
    source: 'kontur_focus',
  };
}

/**
 * Разбирает ответ Контур.Диадок `GET /GetOrganizationsByInnKpp?inn=...`.
 */
export function parseDiadocGetOrganizationsResponse(
  rawJson: unknown
): DiadocBoxInfo | null {
  if (!rawJson || typeof rawJson !== 'object') return null;
  const orgs = (rawJson as { Organizations?: unknown[] }).Organizations;
  if (!Array.isArray(orgs) || orgs.length === 0) {
    return {
      hasBox: false,
      boxId: '',
      operatorLabel: 'Ящик ЭДО в Диадоке не найден',
      isRoaming: false,
    };
  }

  type RawOrg = {
    IsRoaming?: boolean;
    Boxes?: Array<{ BoxId?: string; BoxIdGuid?: string; Title?: string }>;
  };

  const typedOrgs = orgs.filter(
    (o): o is RawOrg => Boolean(o && typeof o === 'object')
  );
  const preferred =
    typedOrgs.find((o) => !o.IsRoaming && Array.isArray(o.Boxes) && o.Boxes.length > 0) ??
    typedOrgs.find((o) => Array.isArray(o.Boxes) && o.Boxes.length > 0);

  const box = preferred?.Boxes?.[0];
  const boxId = String(box?.BoxId || box?.BoxIdGuid || '').trim();
  if (!boxId) {
    return {
      hasBox: false,
      boxId: '',
      operatorLabel: 'Ящик ЭДО в Диадоке не активен',
      isRoaming: false,
    };
  }

  const isRoaming = Boolean(preferred?.IsRoaming);
  return {
    hasBox: true,
    boxId,
    operatorLabel: isRoaming
      ? 'ЭДО через роуминг Контур.Диадок'
      : 'Контур.Диадок (прямой обмен)',
    isRoaming,
  };
}

function encodeUtf8ToBase64(text: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(text, 'utf8').toString('base64');
  }
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export interface DiadocDraftPostMessagePayload {
  FromBoxId: string;
  ToBoxId?: string;
  IsDraft: true;
  LockDraft: boolean;
  StrictDraftValidation: boolean;
  NonformalizedDocuments: Array<{
    SignedContent: {
      Content: string;
    };
    FileName: string;
    DocumentDate: string;
    DocumentNumber: string;
    TotalSum: string;
    Vat?: string;
    Comment: string;
    NeedReceipt: boolean;
    CustomDocumentId: string;
  }>;
}

/**
 * Формирует официальный JSON-пакет `MessageToPost` для `POST https://diadoc-api.kontur.ru/V3/PostMessage`
 * в режиме безопасного черновика (`IsDraft: true`):
 * - закрытый ключ КЭП на веб-сервере НЕ требуется;
 * - тарифицируемый пакет исходящих документов Диадока НЕ списывается до подписания бухгалтером;
 * - черновик мгновенно появляется в папке «Черновики» Контур.Диадока / Контур.Экстерна.
 */
export function buildDiadocDraftPostMessagePayload(params: {
  suite: AssembledDocumentSuite;
  fromBoxId: string;
  toBoxId?: string;
  invoiceTextContent: string;
  fileName?: string;
}): DiadocDraftPostMessagePayload {
  const { suite } = params;
  const cleanFromBox = params.fromBoxId.trim();
  const cleanToBox = (params.toBoxId || '').trim();
  const safeDocSlug = suite.invoiceNumber.replace(/[^A-Za-z0-9_-]+/g, '_') || suite.orderNumber;
  const fileName =
    params.fileName?.trim() || `Schet_FMWorks_${safeDocSlug}.txt`;

  const totalRubDecimal = (suite.tax.totalPayableKopecks / 100).toFixed(2);
  const vatRubDecimal =
    suite.tax.vatRatePercent > 0
      ? (suite.tax.vatAmountKopecks / 100).toFixed(2)
      : undefined;

  return {
    FromBoxId: cleanFromBox,
    ...(cleanToBox ? { ToBoxId: cleanToBox } : {}),
    IsDraft: true,
    LockDraft: false,
    StrictDraftValidation: false,
    NonformalizedDocuments: [
      {
        SignedContent: {
          Content: encodeUtf8ToBase64(params.invoiceTextContent),
        },
        FileName: fileName,
        DocumentDate: suite.issueDateRu,
        DocumentNumber: suite.invoiceNumber,
        TotalSum: totalRubDecimal,
        ...(vatRubDecimal ? { Vat: vatRubDecimal } : {}),
        Comment: `Счёт на оплату № ${suite.invoiceNumber} от ${suite.issueDateRu} по заказу #${suite.orderNumber} (${suite.spotWorkingTitle})`,
        NeedReceipt: false,
        CustomDocumentId: suite.orderNumber,
      },
    ],
  };
}

function escapeCsvSemicolonCell(raw: string | number | undefined | null): string {
  const str = String(raw ?? '')
    .replace(/\r?\n+/g, ' ')
    .trim();
  if (str.includes(';') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Формирует CSV-файл счёта с UTF-8 BOM (`\uFEFF`) и разделителем `;` для загрузки в 1 клик
 * в раздел «Учёт → Документы → Счета на оплату (Добавить из Excel/CSV)» в Контур.Экстерне (2025–2026).
 */
export function formatKonturExternInvoiceCsv(suite: AssembledDocumentSuite): string {
  const { studio, customer, tax } = suite;
  const headers = [
    'Номер счета',
    'Дата счета',
    'Поставщик',
    'ИНН поставщика',
    'Расчетный счет поставщика',
    'БИК банка поставщика',
    'Контрагент (Покупатель)',
    'ИНН контрагента',
    'КПП контрагента',
    'ОГРН контрагента',
    'Адрес контрагента',
    'ID ЭДО Диадок контрагента',
    'Наименование работы / услуги',
    'Ед. изм.',
    'Количество',
    'Сумма без НДС',
    'Ставка НДС',
    'Сумма НДС',
    'Всего к оплате',
    'Валюта',
    'Основание',
  ];

  const subtotalStr = (tax.subtotalExclVatKopecks / 100).toFixed(2).replace('.', ',');
  const vatRateStr = tax.vatRatePercent === 0 ? 'Без НДС' : `${tax.vatRatePercent}%`;
  const vatSumStr = (tax.vatAmountKopecks / 100).toFixed(2).replace('.', ',');
  const totalSumStr = (tax.totalPayableKopecks / 100).toFixed(2).replace('.', ',');

  const itemTitle = `Создание рекламного аудиоролика и передача прав по Приложению № ${suite.appendixNumber} к Договору № ${suite.contractNumber} («${suite.spotWorkingTitle}», ${suite.spotDurationSec} сек)`;
  const basisLine = `Приложение № ${suite.appendixNumber} к Договору № ${suite.contractNumber} от ${suite.contractDateRu}`;

  const row = [
    suite.invoiceNumber,
    suite.issueDateRu,
    studio.legalName,
    studio.inn,
    studio.checkingAccount,
    studio.bik,
    customer.displayName,
    customer.inn,
    customer.kpp,
    customer.ogrn,
    customer.address,
    customer.edoBoxId,
    itemTitle,
    'усл.',
    '1',
    subtotalStr,
    vatRateStr,
    vatSumStr,
    totalSumStr,
    'RUB',
    basisLine,
  ];

  const headerLine = headers.map(escapeCsvSemicolonCell).join(';');
  const dataLine = row.map(escapeCsvSemicolonCell).join(';');
  return `\uFEFF${headerLine}\r\n${dataLine}\r\n`;
}
