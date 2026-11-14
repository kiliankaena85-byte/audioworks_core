import { AlertCircle, Building2, CheckCircle2, FileCheck2 } from 'lucide-react';
import { RefObject } from 'react';
import {
  inspectInnDigits,
  normalizeInnDigits,
  PaymentChannelKind,
} from './companyDetailsHelpers';

export interface CompanyDetailsFormProps {
  companyName: string;
  companyInn: string;
  paymentChannel: PaymentChannelKind;
  companyNameError?: string;
  companyInnError?: string;
  onChangeCompanyName: (value: string) => void;
  onChangeCompanyInn: (digits: string) => void;
  onSwitchToCardOnline?: () => void;
  idPrefix?: string;
  nameInputRef?: RefObject<HTMLInputElement | null>;
  innInputRef?: RefObject<HTMLInputElement | null>;
}

export function CompanyDetailsForm({
  companyName,
  companyInn,
  paymentChannel,
  companyNameError,
  companyInnError,
  onChangeCompanyName,
  onChangeCompanyInn,
  onSwitchToCardOnline,
  idPrefix = 'order-company',
  nameInputRef,
  innInputRef,
}: CompanyDetailsFormProps) {
  const isEdoRequired = paymentChannel === 'edo_invoice';
  const innInfo = inspectInnDigits(companyInn);
  const hasValidName = companyName.trim().length >= 2 && !companyNameError;
  const isReadyForAutoDocs =
    isEdoRequired && hasValidName && innInfo.isCompleteLength && innInfo.checksumValid;
  const hasAnyError = Boolean(companyNameError || companyInnError);

  const nameInputId = `${idPrefix}-name`;
  const innInputId = `${idPrefix}-inn`;
  const innStatusId = `${idPrefix}-inn-status`;

  return (
    <div
      data-testid="company-details-form"
      className={`rounded-2xl p-4 sm:p-5 bg-[#EFECE5]/65 dark:bg-[#15151A] border transition-colors space-y-3.5 ${
        hasAnyError
          ? 'border-[#FF4820]/50'
          : 'border-[#111111]/12 dark:border-white/12'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Building2
              className="w-4 h-4 text-[#FF4820] shrink-0"
              aria-hidden="true"
            />
            <p className="text-xs sm:text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
              {isEdoRequired
                ? 'Реквизиты компании для автоматического договора и счёта ЭДО'
                : 'Реквизиты компании или ИП (по желанию)'}
            </p>
          </div>
          <p className="text-xs text-[#111111]/64 dark:text-[#F4F3EF]/64 leading-relaxed">
            {isEdoRequired
              ? 'Укажите название организации и ИНН — сразу после подтверждения система сформирует готовый рамочный договор-оферту и счёт для Диадок / СБИС.'
              : 'Для оплаты картой физлица или по СБП (54-ФЗ) реквизиты не обязательны, но их можно добавить для договора и актов.'}
          </p>
        </div>

        {isEdoRequired && onSwitchToCardOnline && (
          <button
            type="button"
            data-testid="company-form-switch-card-btn"
            onClick={onSwitchToCardOnline}
            className="text-xs font-semibold text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#FF4820] underline underline-offset-4 transition-colors cursor-pointer shrink-0"
          >
            Оплатить без ИНН картой / СБП
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
        {/* Название компании / ИП */}
        <div className="sm:col-span-7 space-y-1.5">
          <label
            htmlFor={nameInputId}
            className="block text-xs font-semibold text-[#111111]/76 dark:text-[#F4F3EF]/76"
          >
            Название компании или ИП {isEdoRequired ? '*' : ''}
          </label>
          <input
            ref={nameInputRef}
            id={nameInputId}
            type="text"
            autoComplete="organization"
            data-testid="company-name-input"
            aria-label="Название компании или ИП"
            aria-required={isEdoRequired}
            aria-invalid={Boolean(companyNameError)}
            value={companyName}
            onChange={(e) => onChangeCompanyName(e.target.value)}
            placeholder="ООО «Альфа Медиа» или ИП Иванов А.С."
            className={`scroll-mt-24 w-full min-h-[48px] px-4 py-3 rounded-2xl border text-sm sm:text-base text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/40 dark:placeholder:text-[#F4F3EF]/40 focus:outline-none transition-all ${
              companyNameError
                ? 'border-[#FF4820] ring-2 ring-[#FF4820]/20 bg-[#FF4820]/[0.03]'
                : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] border-[#111111]/16 dark:border-[#F4F3EF]/16 focus:border-[#FF4820]'
            }`}
          />
          {companyNameError && (
            <p
              role="alert"
              data-testid="company-name-error"
              className="text-xs font-semibold text-[#FF4820] flex items-center gap-1.5"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{companyNameError}</span>
            </p>
          )}
        </div>

        {/* ИНН организации или ИП */}
        <div className="sm:col-span-5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor={innInputId}
              className="block text-xs font-semibold text-[#111111]/76 dark:text-[#F4F3EF]/76"
            >
              ИНН (10 или 12 цифр) {isEdoRequired ? '*' : ''}
            </label>
            <span className="text-[11px] font-medium tabular-nums text-[#111111]/48 dark:text-[#F4F3EF]/48">
              {innInfo.digits.length > 0
                ? `${innInfo.digits.length} / ${innInfo.digits.length > 10 ? 12 : 10}`
                : 'ФНС контроль'}
            </span>
          </div>
          <input
            ref={innInputRef}
            id={innInputId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            data-testid="company-inn-input"
            aria-label="ИНН компании или ИП"
            aria-required={isEdoRequired}
            aria-invalid={Boolean(
              companyInnError || (innInfo.isCompleteLength && !innInfo.checksumValid)
            )}
            aria-describedby={innInfo.statusMessage ? innStatusId : undefined}
            maxLength={12}
            value={companyInn}
            onChange={(e) => onChangeCompanyInn(normalizeInnDigits(e.target.value))}
            placeholder="7707083893"
            className={`scroll-mt-24 w-full min-h-[48px] px-4 py-3 rounded-2xl border text-sm sm:text-base tabular-nums tracking-wide text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/40 dark:placeholder:text-[#F4F3EF]/40 focus:outline-none transition-all ${
              companyInnError || (innInfo.isCompleteLength && !innInfo.checksumValid)
                ? 'border-[#FF4820] ring-2 ring-[#FF4820]/20 bg-[#FF4820]/[0.03]'
                : innInfo.checksumValid
                  ? 'bg-[#F7F6F2] dark:bg-[#0D0D0F] border-emerald-600/60 dark:border-emerald-400/60 focus:border-emerald-600'
                  : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] border-[#111111]/16 dark:border-[#F4F3EF]/16 focus:border-[#FF4820]'
            }`}
          />

          {companyInnError ? (
            <p
              id={innStatusId}
              role="alert"
              data-testid="company-inn-error"
              className="text-xs font-semibold text-[#FF4820] flex items-center gap-1.5"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{companyInnError}</span>
            </p>
          ) : (
            innInfo.statusMessage && (
              <p
                id={innStatusId}
                data-testid="company-inn-live-status"
                className={`text-xs font-medium flex items-center gap-1.5 tabular-nums ${
                  innInfo.checksumValid
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : innInfo.isCompleteLength
                      ? 'text-[#FF4820]'
                      : 'text-[#111111]/58 dark:text-[#F4F3EF]/58'
                }`}
              >
                {innInfo.checksumValid && (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                )}
                <span>{innInfo.statusMessage}</span>
              </p>
            )
          )}
        </div>
      </div>

      {/* Статус автоматической генерации договора и счёта перед подтверждением */}
      {isReadyForAutoDocs && (
        <div
          data-testid="company-details-ready-status"
          className="rounded-xl px-3.5 py-2.5 bg-emerald-600/10 border border-emerald-600/25 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 tabular-nums"
        >
          <FileCheck2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>
            Готово к автовыпуску: рамочный договор-оферта и счёт ЭДО для{' '}
            <strong>{companyName.trim()}</strong> (ИНН {innInfo.digits}) откроются сразу
            после отправки заявки.
          </span>
        </div>
      )}
    </div>
  );
}
