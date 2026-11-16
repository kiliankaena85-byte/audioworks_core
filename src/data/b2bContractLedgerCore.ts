import type { CrmOrderRecord, CrmOrderStage } from './orderCrmTypes.ts';
import { getCrmStageMetaForOrder } from './orderCrmTypes.ts';
import {
  assembleProductionDocumentSuite,
  type StudioLegalProfilesConfig,
  TAX_REGIME_OPTIONS,
} from './studioDocumentsCore.ts';

export type B2bLedgerBucketId =
  | 'all'
  | 'intake_queue'
  | 'awaiting_payment'
  | 'paid_in_work'
  | 'closed_acts';

export type B2bRegulatoryCategoryId =
  | 'auto'
  | 'general_b2b'
  | 'real_estate_214fz'
  | 'finance_credit_28fz'
  | 'medicine_24fz'
  | 'promo_stim_9fz';

export type ResolvedRegulatoryCategoryId = Exclude<
  B2bRegulatoryCategoryId,
  'auto'
>;

export interface B2bLedgerKpiSummary {
  totalOrdersCount: number;
  totalPortfolioRub: number;
  intakeQueueCount: number;
  intakeQueueRub: number;
  verifiedInnInQueueCount: number;
  invoicedPendingCount: number;
  invoicedPendingRub: number;
  diadocDraftsCount: number;
  paidInProductionCount: number;
  paidInProductionRub: number;
  activeDeliverablesCount: number;
  closedActsCount: number;
  closedActsRub: number;
  rightsPassportsCount: number;
}

export interface B2bLedgerRowView {
  orderId: string;
  orderNumber: string;
  createdAtIso: string;
  bucket: Exclude<B2bLedgerBucketId, 'all'>;
  counterpartyTitle: string;
  inn: string;
  innDisplayLabel: string;
  innVerified: boolean;
  formatSummary: string;
  slotSeconds: number;
  effectivePayableRub: number;
  isNegotiablePrice: boolean;
  executorEntityShort: string;
  taxShortLabel: string;
  invoiceNumber: string;
  edoStatusLabel: string;
  edoStatusTone: 'ready' | 'active' | 'pending' | 'attention';
  stageCode: string;
  stageShortLabel: string;
  rightsStatusLabel: string;
  deliverablesCount: number;
  hasMasterAudio: boolean;
}

export interface B2bRegulatoryTimingAudit {
  resolvedCategory: ResolvedRegulatoryCategoryId;
  categoryTitle: string;
  legalNormReference: string;
  mandatoryDisclaimerSample: string;
  targetSlotSec: number;
  disclaimerRequiredSec: number;
  breathMarginSec: number;
  netCreativeBudgetSec: number;
  wordCount: number;
  recommendedMaxWords: number;
  estimatedCreativeSec: number;
  estimatedTotalSec: number;
  wordsDelta: number;
  suggestedUpgradeSlotSec: number | null;
  creativeSharePct: number;
  disclaimerSharePct: number;
  marginSharePct: number;
  verdictStatus: 'optimal' | 'tight' | 'overflow';
  verdictTitle: string;
  verdictAction: string;
}

const STANDARD_SLOTS_SEC = [10, 15, 20, 25, 30, 45, 60] as const;
const NATURAL_RUSSIAN_WORDS_PER_SEC = 2.2;

const CATEGORY_SPECS: Readonly<
  Record<
    ResolvedRegulatoryCategoryId,
    {
      title: string;
      legalNorm: string;
      disclaimerSec: number;
      sampleDisclaimer: string;
    }
  >
> = {
  general_b2b: {
    title: 'Общая коммерческая реклама (без спецдисклеймера)',
    legalNorm: 'Общие требования ст. 5 ФЗ-38 «О рекламе»',
    disclaimerSec: 0,
    sampleDisclaimer: '',
  },
  real_estate_214fz: {
    title: 'Недвижимость, ЖК и долевое строительство',
    legalNorm: 'ч. 7 ст. 28 ФЗ-38 «О рекламе» (214-ФЗ)',
    disclaimerSec: 2.6,
    sampleDisclaimer:
      'Застройщик ООО СЗ Проект. Проектная декларация на сайте наш.дом.рф.',
  },
  finance_credit_28fz: {
    title: 'Банки, кредиты, ипотека, лизинг и финансовые услуги',
    legalNorm: 'ч. 1, 2, 3 ст. 28 ФЗ-38 «О рекламе»',
    disclaimerSec: 4.5,
    sampleDisclaimer:
      'Изучите все условия кредита на сайте. Оценивайте свои финансовые возможности и риски.',
  },
  medicine_24fz: {
    title: 'Медицинские клиники, услуги и препараты',
    legalNorm: 'ч. 7 ст. 24 ФЗ-38 «О рекламе» (не менее 3 сек)',
    disclaimerSec: 3.0,
    sampleDisclaimer:
      'Имеются противопоказания. Необходима консультация специалиста.',
  },
  promo_stim_9fz: {
    title: 'Акции, скидки с дедлайном и розыгрыши',
    legalNorm: 'ст. 9 ФЗ-38 «О рекламе» (сроки и организатор)',
    disclaimerSec: 2.7,
    sampleDisclaimer:
      'Сроки акции и подробности об организаторе уточняйте на сайте компании.',
  },
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function classifyOrderB2bBucket(
  stage: CrmOrderStage
): Exclude<B2bLedgerBucketId, 'all'> {
  if (stage === 'new_hold' || stage === 'quota_locked') {
    return 'intake_queue';
  }
  if (stage === 'edo_invoice') {
    return 'awaiting_payment';
  }
  if (stage === 'in_production') {
    return 'paid_in_work';
  }
  return 'closed_acts';
}

export function matchesB2bLedgerBucket(
  order: CrmOrderRecord,
  bucket: B2bLedgerBucketId
): boolean {
  if (bucket === 'all') return true;
  return classifyOrderB2bBucket(order.stage) === bucket;
}

export function resolveOrderTargetSlotSeconds(order: CrmOrderRecord): number {
  const exactDoc = order.documentMeta?.spotExactDurationSec;
  if (typeof exactDoc === 'number' && Number.isFinite(exactDoc) && exactDoc >= 5) {
    return Math.round(exactDoc);
  }
  const snapSec = order.mediaPlanSnapshot?.spotDurationSec;
  if (typeof snapSec === 'number' && Number.isFinite(snapSec) && snapSec >= 5) {
    return Math.round(snapSec);
  }
  const formatMatch = order.formatLabel.match(/(\d{1,2})\s*(?:сек|с\b)/i);
  if (formatMatch) {
    const parsed = Number(formatMatch[1]);
    if (Number.isFinite(parsed) && parsed >= 5 && parsed <= 90) {
      return parsed;
    }
  }
  return 20;
}

export function buildB2bLedgerRowView(
  order: CrmOrderRecord,
  legalProfiles: StudioLegalProfilesConfig
): B2bLedgerRowView {
  const slotSeconds = resolveOrderTargetSlotSeconds(order);
  const suite = assembleProductionDocumentSuite({
    orderNumber: order.orderNumber,
    createdAtIso: order.createdAt,
    formatLabel: order.formatLabel,
    baseBudgetRub: order.totalBudgetRub,
    defaultDurationSec: slotSeconds,
    contact: order.contact,
    companyOrInn: order.companyOrInn,
    briefText: order.briefText,
    legalProfiles,
    documentMeta: order.documentMeta ?? null,
  });

  const bucket = classifyOrderB2bBucket(order.stage);
  const stageMeta = getCrmStageMetaForOrder(order.stage, 'production_only');
  const taxOption = TAX_REGIME_OPTIONS.find(
    (opt) => opt.id === suite.studio.taxRegime
  );
  const executorEntityShort = suite.studio.entityKind === 'ooo' ? 'ООО' : 'ИП';
  const taxShortLabel = taxOption
    ? taxOption.ratePercent > 0
      ? `НДС ${taxOption.ratePercent}%`
      : 'Без НДС'
    : 'УСН';

  const draftState = order.documentMeta?.diadocDraftState;
  let edoStatusLabel = 'Требуется счёт';
  let edoStatusTone: B2bLedgerRowView['edoStatusTone'] = 'attention';

  if (order.stage === 'completed_ltv') {
    edoStatusLabel = 'Акт закрыт в ЭДО';
    edoStatusTone = 'ready';
  } else if (order.stage === 'on_air') {
    edoStatusLabel = order.compliance.edoAndOrdRegistered
      ? 'Акт на подписи ЭДО'
      : 'Мастер сдан · ждёт акт';
    edoStatusTone = 'active';
  } else if (order.paymentChannel === 'card_online') {
    edoStatusLabel =
      order.stage === 'in_production'
        ? 'Оплачено (СБП / 54-ФЗ)'
        : 'Счёт-ссылка (54-ФЗ)';
    edoStatusTone = order.stage === 'in_production' ? 'ready' : 'pending';
  } else if (draftState && draftState.status !== 'not_sent' && draftState.status !== 'error') {
    edoStatusLabel = `Черновик Диадока (${suite.invoiceNumber})`;
    edoStatusTone = 'active';
  } else if (order.stage === 'in_production') {
    edoStatusLabel = `Оплачен счёт ${suite.invoiceNumber}`;
    edoStatusTone = 'ready';
  } else if (order.stage === 'edo_invoice' || order.compliance.edoAndOrdRegistered) {
    edoStatusLabel = `Выставлен ${suite.invoiceNumber}`;
    edoStatusTone = 'pending';
  } else if (suite.isNegotiablePendingPrice) {
    edoStatusLabel = 'Расчёт сметы КП';
    edoStatusTone = 'attention';
  }

  const deliverables = order.deliverables ?? [];
  const hasMasterAudio = deliverables.some(
    (d) => d.kind === 'audio_master' && d.versionCode === 'master'
  );
  const rightsReady =
    order.compliance.rightsPassportIssued ||
    order.stage === 'on_air' ||
    order.stage === 'completed_ltv';

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    createdAtIso: order.createdAt,
    bucket,
    counterpartyTitle: suite.customer.displayName || order.companyOrInn || order.contact,
    inn: suite.customer.inn,
    innDisplayLabel: suite.customer.inn
      ? `ИНН ${suite.customer.inn}`
      : 'Реквизиты уточняются',
    innVerified: Boolean(order.innVerified && suite.customer.inn),
    formatSummary: order.formatLabel,
    slotSeconds,
    effectivePayableRub: suite.isNegotiablePendingPrice
      ? 0
      : suite.tax.totalPayableRubFloor,
    isNegotiablePrice: suite.isNegotiablePendingPrice,
    executorEntityShort,
    taxShortLabel,
    invoiceNumber: suite.invoiceNumber,
    edoStatusLabel,
    edoStatusTone,
    stageCode: stageMeta.stepCode,
    stageShortLabel: stageMeta.shortLabel,
    rightsStatusLabel: rightsReady ? 'Паспорт прав готов' : 'Паспорт в сборке',
    deliverablesCount: deliverables.length,
    hasMasterAudio,
  };
}

export function computeB2bLedgerSummary(
  orders: readonly CrmOrderRecord[],
  legalProfiles: StudioLegalProfilesConfig
): B2bLedgerKpiSummary {
  let totalPortfolioRub = 0;
  let intakeQueueCount = 0;
  let intakeQueueRub = 0;
  let verifiedInnInQueueCount = 0;
  let invoicedPendingCount = 0;
  let invoicedPendingRub = 0;
  let diadocDraftsCount = 0;
  let paidInProductionCount = 0;
  let paidInProductionRub = 0;
  let activeDeliverablesCount = 0;
  let closedActsCount = 0;
  let closedActsRub = 0;
  let rightsPassportsCount = 0;

  for (const order of orders) {
    const row = buildB2bLedgerRowView(order, legalProfiles);
    totalPortfolioRub += row.effectivePayableRub;

    const draftStatus = order.documentMeta?.diadocDraftState?.status;
    if (draftStatus && draftStatus !== 'not_sent' && draftStatus !== 'error') {
      diadocDraftsCount += 1;
    }

    if (
      order.compliance.rightsPassportIssued ||
      order.stage === 'on_air' ||
      order.stage === 'completed_ltv'
    ) {
      rightsPassportsCount += 1;
    }

    if (row.bucket === 'intake_queue') {
      intakeQueueCount += 1;
      intakeQueueRub += row.effectivePayableRub;
      if (row.innVerified) {
        verifiedInnInQueueCount += 1;
      }
    } else if (row.bucket === 'awaiting_payment') {
      invoicedPendingCount += 1;
      invoicedPendingRub += row.effectivePayableRub;
    } else if (row.bucket === 'paid_in_work') {
      paidInProductionCount += 1;
      paidInProductionRub += row.effectivePayableRub;
      activeDeliverablesCount += row.deliverablesCount;
    } else {
      closedActsCount += 1;
      closedActsRub += row.effectivePayableRub;
    }
  }

  return {
    totalOrdersCount: orders.length,
    totalPortfolioRub,
    intakeQueueCount,
    intakeQueueRub,
    verifiedInnInQueueCount,
    invoicedPendingCount,
    invoicedPendingRub,
    diadocDraftsCount,
    paidInProductionCount,
    paidInProductionRub,
    activeDeliverablesCount,
    closedActsCount,
    closedActsRub,
    rightsPassportsCount,
  };
}

export function detectRegulatoryCategoryFromOrderText(
  text: string,
  nicheHint?: string | null
): ResolvedRegulatoryCategoryId {
  if (nicheHint === 'medicine') return 'medicine_24fz';
  if (nicheHint === 'real_estate') return 'real_estate_214fz';
  if (nicheHint === 'b2b_finance') return 'finance_credit_28fz';

  const normalized = text.toLowerCase();

  if (
    /(клиник|стоматолог|медицин|врач|лечени|диагностик|анализ|препарат|аптек|здоровь)/.test(
      normalized
    )
  ) {
    return 'medicine_24fz';
  }

  if (
    /(ипотек|кредит|займ|вклад|лизинг|банк|ставк[аи]\s+от|рассрочк[аи]\s+от\s+банка|пск)/.test(
      normalized
    )
  ) {
    return 'finance_credit_28fz';
  }

  if (
    /(квартир|застройщик|жилой комплекс|\bжк\b|апартамент|коттедж|таунхаус|дом\.рф|террас)/.test(
      normalized
    )
  ) {
    return 'real_estate_214fz';
  }

  if (
    /(акци[яи]|розыгрыш|скидк[аи]\s+до|подарок\s+при|промокод|купон|распродаж)/.test(
      normalized
    )
  ) {
    return 'promo_stim_9fz';
  }

  return 'general_b2b';
}

export function countSpokenRussianWords(scriptOrBriefText: string): number {
  const cleaned = scriptOrBriefText
    .replace(/https?:\/\/\S+/gi, ' сайт ')
    .replace(/[«»"“”„()[\]{}—–−/\\|•·,;:.!?]+/g, ' ')
    .trim();
  if (!cleaned) return 0;
  return cleaned
    .split(/\s+/)
    .filter((token) => /[а-яёa-z0-9]/i.test(token)).length;
}

/**
 * Нормативно-хронометражная экспертиза рекламного ролика (ФЗ-38 «О рекламе» + темп диктора).
 * Объясняет простым инженерно-юридическим языком, помещается ли рекламное сообщение
 * вместе с обязательным отраслевым дисклеймером в оплаченный хронометраж ролика.
 */
export function evaluateB2bSpotRegulatoryTimingAudit(params: {
  text: string;
  targetSlotSec: number;
  categoryOverride?: B2bRegulatoryCategoryId;
  nicheHint?: string | null;
}): B2bRegulatoryTimingAudit {
  const slotSec = Math.max(5, Math.min(90, Math.round(params.targetSlotSec || 20)));
  const resolvedCategory: ResolvedRegulatoryCategoryId =
    params.categoryOverride && params.categoryOverride !== 'auto'
      ? params.categoryOverride
      : detectRegulatoryCategoryFromOrderText(params.text, params.nicheHint);

  const spec = CATEGORY_SPECS[resolvedCategory];
  const disclaimerRequiredSec =
    spec.disclaimerSec > 0 ? Math.min(slotSec - 2, spec.disclaimerSec) : 0;
  const breathMarginSec = 0.6;
  const netCreativeBudgetSec = Math.max(
    1,
    round1(slotSec - disclaimerRequiredSec - breathMarginSec)
  );

  const wordCount = countSpokenRussianWords(params.text);
  const recommendedMaxWords = Math.max(
    3,
    Math.floor(netCreativeBudgetSec * NATURAL_RUSSIAN_WORDS_PER_SEC)
  );
  const estimatedCreativeSec = round1(
    wordCount / NATURAL_RUSSIAN_WORDS_PER_SEC
  );
  const estimatedTotalSec = round1(
    estimatedCreativeSec + disclaimerRequiredSec + (wordCount > 0 ? breathMarginSec : 0)
  );
  const wordsDelta = wordCount - recommendedMaxWords;

  const suggestedUpgradeSlotSec =
    estimatedTotalSec > slotSec
      ? STANDARD_SLOTS_SEC.find((candidate) => candidate >= estimatedTotalSec + 0.4) ??
        60
      : null;

  const denomSec = Math.max(slotSec, estimatedTotalSec, 1);
  const creativeSharePct = Math.min(
    100,
    Math.round((estimatedCreativeSec / denomSec) * 100)
  );
  const disclaimerSharePct = Math.min(
    100 - creativeSharePct,
    Math.round((disclaimerRequiredSec / denomSec) * 100)
  );
  const marginSharePct = Math.max(
    0,
    100 - creativeSharePct - disclaimerSharePct
  );

  let verdictStatus: B2bRegulatoryTimingAudit['verdictStatus'] = 'optimal';
  let verdictTitle = 'Хронометраж в норме — диктор прочитает текст разборчиво';
  let verdictAction =
    disclaimerRequiredSec > 0
      ? `Текст (${wordCount} сл., ~${estimatedCreativeSec} сек) и обязательный дисклеймер (${disclaimerRequiredSec} сек) свободно укладываются в слот ${slotSec} сек.`
      : `Текст (${wordCount} сл., ~${estimatedCreativeSec} сек) комфортно ложится в оплаченный слот ${slotSec} сек с запасом под паузы и звуковой акцент.`;

  if (wordCount === 0) {
    verdictStatus = 'optimal';
    verdictTitle = `Лимит текста для слота ${slotSec} сек: до ${recommendedMaxWords} слов`;
    verdictAction =
      disclaimerRequiredSec > 0
        ? `С учётом обязательного предупреждения по ${spec.legalNorm} (${disclaimerRequiredSec} сек) на основной рекламный текст остаётся ${netCreativeBudgetSec} сек (не более ${recommendedMaxWords} слов).`
        : `При естественном темпе диктора (2,2 слова/сек) в ролик ${slotSec} сек оптимально закладывать до ${recommendedMaxWords} слов.`;
  } else if (estimatedTotalSec > slotSec + 0.5) {
    verdictStatus = 'overflow';
    const excessWords = Math.max(1, wordsDelta);
    verdictTitle = `Перегруз слота ${slotSec} сек: оценка ${estimatedTotalSec} сек (+${excessWords} сл. сверх нормы)`;
    verdictAction = suggestedUpgradeSlotSec
      ? `Сократите текст минимум на ${excessWords} сл. (до ${recommendedMaxWords} сл.) либо согласуйте с заказчиком в счёте переход на хронометраж ${suggestedUpgradeSlotSec} сек.`
      : `Сократите объём текста минимум на ${excessWords} сл. (до ${recommendedMaxWords} сл.), иначе диктор перейдёт на неразборчивую скороговорку.`;
  } else if (estimatedTotalSec > slotSec - 0.8) {
    verdictStatus = 'tight';
    verdictTitle = `Плотная посадка в слот ${slotSec} сек (оценка ${estimatedTotalSec} сек)`;
    verdictAction = `Текст проходит по верхней границе (${wordCount} из ${recommendedMaxWords} доп. слов). При записи потребуется плотная подача без длинных музыкальных пауз.`;
  }

  return {
    resolvedCategory,
    categoryTitle: spec.title,
    legalNormReference: spec.legalNorm,
    mandatoryDisclaimerSample: spec.sampleDisclaimer,
    targetSlotSec: slotSec,
    disclaimerRequiredSec,
    breathMarginSec,
    netCreativeBudgetSec,
    wordCount,
    recommendedMaxWords,
    estimatedCreativeSec,
    estimatedTotalSec,
    wordsDelta,
    suggestedUpgradeSlotSec,
    creativeSharePct,
    disclaimerSharePct,
    marginSharePct,
    verdictStatus,
    verdictTitle,
    verdictAction,
  };
}
