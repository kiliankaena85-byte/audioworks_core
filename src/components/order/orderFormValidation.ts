import {
  inspectBriefForSpamSignals,
  validateCompanyOrInnField,
  validateHumanLeadContact,
} from '../../security/leadShield.ts';
import { validateQuickOrder } from '../../data/pricingData.ts';
import {
  formatStructuredCompanyLine,
  inspectCompanyDetails,
  PaymentChannelKind,
} from './companyDetailsHelpers.ts';

export type OrderValidationFieldKey =
  | 'brief'
  | 'contact'
  | 'companyName'
  | 'companyInn'
  | 'companyLine'
  | 'consent'
  | 'rateLimit';

export interface ValidateOrderSubmissionInput {
  mode: 'production_only' | 'air_plus_production';
  paymentChannel: PaymentChannelKind;
  contactLine: string;
  companyName: string;
  companyInn: string;
  legacyCompanyLine: string;
  savedVipCompany?: string;
  briefText: string;
  hasVoiceRecording: boolean;
  hasAttachedFile: boolean;
  isReturningFastTrack: boolean;
  honeypotFilled: boolean;
  pdnConsentAccepted?: boolean;
}

export interface ValidateOrderSubmissionResult {
  valid: boolean;
  effectiveContact: string;
  effectiveCompany: string;
  taskError?: string;
  contactError?: string;
  companyNameError?: string;
  companyInnError?: string;
  companyError?: string;
  consentError?: string;
  firstErrorField: OrderValidationFieldKey | null;
}

/**
 * Единая полная проверка всех полей формы заказа за один проход (без «молчаливых»
 * ранних выходов), чтобы клиент сразу видел подсветку каждого незаполненного или
 * ошибочного поля и мог автоматически перейти к первому из них.
 */
export function validateOrderSubmissionFields(
  input: ValidateOrderSubmissionInput
): ValidateOrderSubmissionResult {
  const effectiveContact = input.contactLine.trim();
  const hasStructuredCompany = Boolean(
    input.companyName.trim() || input.companyInn.trim()
  );
  const effectiveCompany = hasStructuredCompany
    ? formatStructuredCompanyLine(input.companyName, input.companyInn)
    : input.legacyCompanyLine.trim() || input.savedVipCompany?.trim() || '';

  let taskError: string | undefined;
  let contactError: string | undefined;
  let companyNameError: string | undefined;
  let companyInnError: string | undefined;
  let companyError: string | undefined;
  let consentError: string | undefined;

  if (input.mode === 'production_only') {
    const quickCheck = validateQuickOrder({
      contactLine: effectiveContact,
      briefText: input.briefText,
      hasVoiceRecording: input.hasVoiceRecording,
      hasAttachedFile: input.hasAttachedFile,
      isReturningClientWithSavedProfile: input.isReturningFastTrack,
    });
    taskError = quickCheck.taskError;
    contactError = quickCheck.contactError;

    // Если клиент описал задачу текстом, сразу проверяем отсутствие явных спам/XSS-сигналов
    if (!taskError && input.briefText.trim()) {
      const briefInspection = inspectBriefForSpamSignals(input.briefText);
      if (briefInspection.isBotSpam && !input.honeypotFilled) {
        taskError =
          'Проверьте текст задачи: уберите множественные внешние ссылки и запрещённые фрагменты';
      }
    }
  } else {
    if (!input.isReturningFastTrack && effectiveContact.length < 4) {
      contactError = 'Укажите имя и телефон или @Telegram для подтверждения холда';
    }
  }

  // Детальная проверка контакта и реквизитов (если не сработала антибот-ловушка)
  if (!input.honeypotFilled) {
    if (!contactError) {
      const contactValidation = validateHumanLeadContact(effectiveContact, {
        isReturningFastTrack: input.isReturningFastTrack,
      });
      if (!contactValidation.valid && !contactValidation.isLikelyBotGarbage) {
        contactError = contactValidation.error;
      }
    }

    const effectivePaymentChannel: PaymentChannelKind =
      input.mode === 'air_plus_production' ? 'edo_invoice' : input.paymentChannel;

    const shouldValidateCompanyForm =
      !input.isReturningFastTrack ||
      hasStructuredCompany ||
      (effectivePaymentChannel === 'edo_invoice' && !input.savedVipCompany?.trim());

    if (shouldValidateCompanyForm) {
      const detailsValidation = inspectCompanyDetails({
        companyName: input.companyName,
        companyInn: input.companyInn,
        paymentChannel: effectivePaymentChannel,
      });
      if (!detailsValidation.valid) {
        companyNameError = detailsValidation.nameError;
        companyInnError = detailsValidation.innError;
      }
    }

    if (!companyNameError && !companyInnError) {
      const companyValidation = validateCompanyOrInnField(effectiveCompany);
      if (!companyValidation.valid) {
        companyError = companyValidation.error;
      }
    }

    if (input.pdnConsentAccepted === false && !input.isReturningFastTrack) {
      consentError =
        'Для отправки заявки подтвердите согласие на обработку персональных данных (152-ФЗ)';
    }
  }

  const orderedChecks: readonly [OrderValidationFieldKey, string | undefined][] =
    input.mode === 'production_only'
      ? [
          ['brief', taskError],
          ['contact', contactError],
          ['companyName', companyNameError],
          ['companyInn', companyInnError],
          ['companyLine', companyError],
          ['consent', consentError],
        ]
      : [
          ['contact', contactError],
          ['companyName', companyNameError],
          ['companyInn', companyInnError],
          ['companyLine', companyError],
          ['brief', taskError],
          ['consent', consentError],
        ];

  const firstErrorField =
    orderedChecks.find(([, message]) => Boolean(message))?.[0] ?? null;

  return {
    valid: firstErrorField === null,
    effectiveContact,
    effectiveCompany,
    taskError,
    contactError,
    companyNameError,
    companyInnError,
    companyError,
    consentError,
    firstErrorField,
  };
}
