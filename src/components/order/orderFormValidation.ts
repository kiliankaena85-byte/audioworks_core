import {
  ClientDeliveryChannel,
  DeliveryCloudId,
  DeliveryMessengerId,
  validateDeliveryEmail,
} from '../../data/clientCabinetHelpers.ts';
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
  | 'delivery'
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
  /**
   * В Варианте 2 («быстрый лид + счёт по желанию») реквизиты компании
   * проверяются только если клиент явно раскрыл блок счёта или начал вводить ИНН/название.
   * Если параметр не передан, сохраняется строгая проверка для канала `edo_invoice`.
   */
  requireCompanyDetails?: boolean;
  preferredDeliveryChannel?: ClientDeliveryChannel;
  deliveryMessenger?: DeliveryMessengerId;
  deliveryMessengerOther?: string;
  deliveryCloud?: DeliveryCloudId;
  deliveryCloudOther?: string;
  deliveryEmail?: string;
}

export interface ValidateOrderSubmissionResult {
  valid: boolean;
  effectiveContact: string;
  effectiveCompany: string;
  taskError?: string;
  contactError?: string;
  deliveryError?: string;
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
  let effectiveCompany = hasStructuredCompany
    ? formatStructuredCompanyLine(input.companyName, input.companyInn)
    : input.legacyCompanyLine.trim() || input.savedVipCompany?.trim() || '';

  let taskError: string | undefined;
  let contactError: string | undefined;
  let deliveryError: string | undefined;
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

    if (input.preferredDeliveryChannel === 'email') {
      if (!validateDeliveryEmail(input.deliveryEmail ?? '')) {
        deliveryError =
          'Укажите корректный e-mail для отправки готового ролика';
      }
    } else if (
      input.preferredDeliveryChannel === 'messenger' &&
      input.deliveryMessenger === 'other' &&
      !(input.deliveryMessengerOther ?? '').trim()
    ) {
      deliveryError =
        'Укажите название мессенджера (например, Viber или VK Мессенджер)';
    } else if (
      input.preferredDeliveryChannel === 'cloud' &&
      input.deliveryCloud === 'other' &&
      !(input.deliveryCloudOther ?? '').trim()
    ) {
      deliveryError =
        'Укажите удобное облачное хранилище (например, Облако Mail или Nextcloud)';
    }

    const effectivePaymentChannel: PaymentChannelKind =
      input.mode === 'air_plus_production' ? 'edo_invoice' : input.paymentChannel;

    const shouldValidateCompanyForm =
      input.mode === 'air_plus_production'
        ? !input.isReturningFastTrack ||
          hasStructuredCompany ||
          !input.savedVipCompany?.trim()
        : input.requireCompanyDetails !== undefined
          ? input.requireCompanyDetails || hasStructuredCompany
          : !input.isReturningFastTrack ||
            hasStructuredCompany ||
            (effectivePaymentChannel === 'edo_invoice' && !input.savedVipCompany?.trim());

    if (shouldValidateCompanyForm) {
      const detailsValidation = inspectCompanyDetails({
        companyName: input.companyName,
        companyInn: input.companyInn,
        paymentChannel:
          input.requireCompanyDetails === false && !hasStructuredCompany
            ? 'card_online'
            : input.requireCompanyDetails === true
              ? 'edo_invoice'
              : effectivePaymentChannel,
      });
      if (!detailsValidation.valid) {
        companyNameError = detailsValidation.nameError;
        companyInnError = detailsValidation.innError;
      } else if (hasStructuredCompany && detailsValidation.combinedCompanyLine) {
        effectiveCompany = detailsValidation.combinedCompanyLine;
      }
    }

    if (!companyNameError && !companyInnError && effectiveCompany) {
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
          ['delivery', deliveryError],
          ['companyName', companyNameError],
          ['companyInn', companyInnError],
          ['companyLine', companyError],
          ['consent', consentError],
        ]
      : [
          ['contact', contactError],
          ['delivery', deliveryError],
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
    deliveryError,
    companyNameError,
    companyInnError,
    companyError,
    consentError,
    firstErrorField,
  };
}
