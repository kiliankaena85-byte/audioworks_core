import {
  containsDirectPersonalData,
  scrubPersonalDataFromText,
} from '../security/rfLegalCompliance.ts';
import type { CanonicalCaseId } from './casesData.ts';
import { INDUSTRY_SOLUTIONS } from './multiPageContentData.ts';
import type { IndustryVerticalSlug } from './platformRouter.ts';
import { isValidIndustrySlug } from './platformRouter.ts';
import { getStudioFormatDisplayMeta, type OrderFormatId } from './pricingData.ts';
import {
  assembleProductionDocumentSuite,
  createDefaultStudioLegalProfiles,
  type StudioLegalProfilesConfig,
} from './studioDocumentsCore.ts';
import {
  getVoiceArchetypeById,
  isValidVoiceArchetypeId,
  type VoiceArchetypeId,
} from './voiceCastingCatalog.ts';

export const SHARED_PROPOSAL_TTL_MS = 14 * 24 * 3600 * 1000; // 14 суток

export interface SharedB2bProposalRecord {
  shareId: string;
  token: string;
  kpNumber: string;
  orderNumber: string;
  createdAtIso: string;
  expiresAtIso: string;
  selectedFormatId: OrderFormatId;
  formatTitle: string;
  spotDurationSec: number;
  turnaroundLabel: string;
  isNegotiable: boolean;
  totalPayableRub: number;
  totalPayableFormatted: string;
  taxLegalLabel: string;
  paymentTermsLabel: string;
  selectedVoiceId: VoiceArchetypeId | null;
  selectedVoiceLabel: string | null;
  industrySlug: IndustryVerticalSlug | null;
  industryTitle: string | null;
  industryComplianceHint: string | null;
  demoCaseId: CanonicalCaseId;
  /** Обезличенное краткое описание задачи без телефонов, email, @telegram и ФИО (152-ФЗ) */
  scrubbedTaskSummary: string;
  /** Юридическое наименование компании (без ПДн физлица) или пустая строка */
  corporateEntityHint: string;
  deliverables: readonly string[];
  studioLegalName: string;
  studioInn: string;
  studioCity: string;
  studioEmail: string;
  studioPhone: string;
}

export type SharedB2bProposalPublicView = Omit<SharedB2bProposalRecord, 'token'>;

const VALID_FORMATS: readonly OrderFormatId[] = [
  'voice_style',
  'turnkey',
  'cinema',
  'adaptation',
  'custom_consult',
];

export function sanitizeSharedProposalToken(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (trimmed.length < 16 || trimmed.length > 256) return undefined;
  if (!/^kp_[a-zA-Z0-9_-]+\.[a-fA-F0-9]{16,64}$/.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

/**
 * Очищает название организации для публичной ссылки КП: оставляет только юрлицо (ООО / АО / ПАО)
 * и полностью исключает попадание ФИО физлица/ИП, телефонов, почт и ИНН.
 */
export function sanitizeCorporateTitleForZeroPdnShare(rawCompanyName: string): string {
  const cleaned = scrubPersonalDataFromText(rawCompanyName || '')
    .replace(/\[[^\]]*152-ФЗ[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  // Оставляем только явные наименования корпоративных юридических лиц (без ФИО ИП или физлиц)
  if (
    !/(?:^|[\s«"'(])(ооо|ао|пао|зао|нао|ано|фгуп|муп|гбу)(?=$|[\s»"').,])/i.test(
      cleaned
    )
  ) {
    return '';
  }
  return cleaned.slice(0, 120);
}

/**
 * Очищает краткое описание задачи от любых прямых идентификаторов ПДн (152-ФЗ).
 */
export function sanitizeTaskSummaryForZeroPdnShare(rawBrief: string): string {
  const normalized = (rawBrief || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return 'Производство рекламного аудиоролика со студийной записью диктора, мастерингом −14 LUFS и паспортом прав РАО/ВОИС.';
  }
  const scrubbed = scrubPersonalDataFromText(normalized)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 520);
  if (containsDirectPersonalData(scrubbed)) {
    return 'Производство коммерческого аудиоролика по техническому заданию заказчика с очисткой прав РАО/ВОИС.';
  }
  return scrubbed;
}

export function resolveDemoCaseForProposal(
  industrySlug: IndustryVerticalSlug | null
): CanonicalCaseId {
  if (industrySlug === 'real-estate') return 'business-estate';
  if (industrySlug === 'medicine') return 'medical-clinics';
  if (industrySlug === 'retail-fmcg') return 'dmitrogorsky';
  return 'audioworks-reel';
}

export interface CreateSharedProposalInput {
  selectedFormatId?: string | null;
  spotDurationSec?: number | null;
  selectedVoiceId?: string | null;
  industrySlug?: string | null;
  briefText?: string | null;
  companyName?: string | null;
  existingOrderNumber?: string | null;
  customBudgetRub?: number | null;
}

/**
 * Собирает криптографически подписанную карточку КП для руководителя без единого поля персональных данных.
 */
export function createZeroPdnSharedProposalRecord(params: {
  input: CreateSharedProposalInput;
  shareIdHex: string;
  signHmacHex: (message: string) => string;
  legalProfiles?: Partial<StudioLegalProfilesConfig> | null;
  nowMs?: number;
}): SharedB2bProposalRecord {
  const nowMs = params.nowMs ?? Date.now();
  const createdAtIso = new Date(nowMs).toISOString();
  const expiresAtIso = new Date(nowMs + SHARED_PROPOSAL_TTL_MS).toISOString();

  const rawFmt = params.input.selectedFormatId ?? 'turnkey';
  const selectedFormatId: OrderFormatId = VALID_FORMATS.includes(
    rawFmt as OrderFormatId
  )
    ? (rawFmt as OrderFormatId)
    : 'turnkey';

  const formatMeta = getStudioFormatDisplayMeta(selectedFormatId);
  const spotDurationSec = Math.max(
    5,
    Math.min(60, Math.round(Number(params.input.spotDurationSec) || 20))
  );

  const selectedVoiceId: VoiceArchetypeId | null = isValidVoiceArchetypeId(
    params.input.selectedVoiceId
  )
    ? params.input.selectedVoiceId
    : null;
  const voiceSpec = getVoiceArchetypeById(selectedVoiceId);

  const rawIndustry = (params.input.industrySlug ?? '').trim();
  const industrySlug: IndustryVerticalSlug | null = isValidIndustrySlug(
    rawIndustry
  )
    ? rawIndustry
    : voiceSpec?.mappedIndustrySlug ?? null;
  const industrySpec = industrySlug ? INDUSTRY_SOLUTIONS[industrySlug] : null;

  const cleanShareHex = params.shareIdHex
    .replace(/[^a-fA-F0-9]/g, '')
    .toLowerCase()
    .slice(0, 20);
  const shareId = `kp_${cleanShareHex || 'f00d1520a1b2c3d4'}`;
  const sigHex = params
    .signHmacHex(`${shareId}:${createdAtIso}:${selectedFormatId}:${spotDurationSec}`)
    .slice(0, 24)
    .toLowerCase();
  const token = `${shareId}.${sigHex}`;

  const dateCompact = createdAtIso.slice(2, 10).replace(/-/g, '');
  const cleanExistingOrder = (params.input.existingOrderNumber ?? '')
    .replace(/[^A-Za-zА-Яа-яЁё0-9_-]/g, '')
    .slice(0, 48);
  const orderNumber =
    cleanExistingOrder ||
    `FM-КП-${dateCompact}-${spotDurationSec}S-${cleanShareHex.slice(0, 4).toUpperCase()}`;

  const baseBudgetRub =
    typeof params.input.customBudgetRub === 'number' &&
    Number.isFinite(params.input.customBudgetRub) &&
    params.input.customBudgetRub >= 0
      ? Math.round(params.input.customBudgetRub)
      : formatMeta.priceRub;

  const corporateEntityHint = sanitizeCorporateTitleForZeroPdnShare(
    params.input.companyName ?? ''
  );
  const scrubbedTaskSummary = sanitizeTaskSummaryForZeroPdnShare(
    params.input.briefText ?? ''
  );

  const profiles =
    params.legalProfiles ?? createDefaultStudioLegalProfiles();
  const suite = assembleProductionDocumentSuite({
    orderNumber,
    createdAtIso,
    formatLabel: `${formatMeta.title} (${spotDurationSec} сек)`,
    baseBudgetRub,
    defaultDurationSec: spotDurationSec,
    contact: 'Согласование КП по защищённой ссылке (без ПДн)',
    companyOrInn: corporateEntityHint,
    briefText: scrubbedTaskSummary,
    legalProfiles: profiles,
  });

  const totalPayableRub = suite.isNegotiablePendingPrice
    ? 0
    : Math.round(suite.tax.totalPayableKopecks / 100);

  const deliverables: string[] = [
    `Эфирный мастер WAV (48 кГц / 24 бит, −14 LUFS) + MP3 320 кбит/с · точный хронометраж ${spotDurationSec} сек`,
    voiceSpec
      ? `Запись выбранного референса: ${voiceSpec.title} (${voiceSpec.code})`
      : `${suite.scope.voiceCastLabel} в студийном тракте`,
    'Паспорт рекламного аудиоролика для РАО / ВОИС и отчуждение исключительных прав по ст. 1234 ГК РФ',
    'Предварительная выверка текста и обязательных сносок по Федеральному закону «О рекламе» № 38-ФЗ',
    'Договор, счёт и закрывающий акт в ЭДО (Контур.Диадок / СБИС) либо оплата картой с чеком 54-ФЗ',
  ];

  return {
    shareId,
    token,
    kpNumber: suite.kpNumber,
    orderNumber,
    createdAtIso,
    expiresAtIso,
    selectedFormatId,
    formatTitle: formatMeta.title,
    spotDurationSec,
    turnaroundLabel: formatMeta.turnaround,
    isNegotiable: suite.isNegotiablePendingPrice,
    totalPayableRub,
    totalPayableFormatted: suite.isNegotiablePendingPrice
      ? selectedFormatId === 'adaptation'
        ? 'По оценке задачи'
        : 'Договорная цена'
      : suite.tax.formattedTotalRub,
    taxLegalLabel: suite.tax.taxLegalLabel,
    paymentTermsLabel: '100% предоплата по договору или банковской картой',
    selectedVoiceId,
    selectedVoiceLabel: voiceSpec
      ? `${voiceSpec.title} (${voiceSpec.genderLabel})`
      : null,
    industrySlug,
    industryTitle: industrySpec?.shortTitle ?? null,
    industryComplianceHint: industrySpec?.legalComplianceRules[0] ?? null,
    demoCaseId: resolveDemoCaseForProposal(industrySlug),
    scrubbedTaskSummary,
    corporateEntityHint,
    deliverables,
    studioLegalName: suite.studio.legalName,
    studioInn: suite.studio.inn,
    studioCity: suite.studio.city,
    studioEmail: suite.studio.email,
    studioPhone: suite.studio.phone,
  };
}

export function verifySharedProposalRecordToken(params: {
  rawToken: unknown;
  record: SharedB2bProposalRecord | undefined | null;
  signHmacHex: (message: string) => string;
  nowMs?: number;
}):
  | { ok: true; view: SharedB2bProposalPublicView }
  | { ok: false; reason: 'invalid_format' | 'not_found' | 'bad_signature' | 'expired' } {
  const cleanToken = sanitizeSharedProposalToken(params.rawToken);
  if (!cleanToken) {
    return { ok: false, reason: 'invalid_format' };
  }
  const record = params.record;
  if (!record || record.token.split('.')[0] !== cleanToken.split('.')[0]) {
    return { ok: false, reason: 'not_found' };
  }

  const expectedSig = params
    .signHmacHex(
      `${record.shareId}:${record.createdAtIso}:${record.selectedFormatId}:${record.spotDurationSec}`
    )
    .slice(0, 24)
    .toLowerCase();
  const actualSig = cleanToken.split('.')[1]?.toLowerCase() ?? '';
  if (!actualSig || actualSig !== expectedSig) {
    return { ok: false, reason: 'bad_signature' };
  }

  const nowMs = params.nowMs ?? Date.now();
  const expMs = Date.parse(record.expiresAtIso);
  if (Number.isFinite(expMs) && nowMs > expMs) {
    return { ok: false, reason: 'expired' };
  }

  const { token: _omitted, ...publicView } = record;
  void _omitted;
  return { ok: true, view: publicView };
}
