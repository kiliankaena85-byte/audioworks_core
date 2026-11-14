import { AlertCircle, Building2, CheckCircle2, FileCheck2 } from 'lucide-react';
import { RefObject, useEffect, useRef, useState } from 'react';
import {
  counterpartyToDocumentMetaPatch,
  type CounterpartyLookupResult,
  resolveOfflineCounterpartyByInn,
} from '../../data/konturIntegrationCore';
import type { OrderDocumentMeta } from '../../data/studioDocumentsCore';
import {
  inspectInnDigits,
  normalizeInnDigits,
  PaymentChannelKind,
} from './companyDetailsHelpers';

export interface CompanyDetailsFormProps {
  companyName: string;
  companyInn: string;
  paymentChannel: PaymentChannelKind;
  wantsDiadocDuplicate?: boolean;
  onChangeWantsDiadocDuplicate?: (checked: boolean) => void;
  onResolvedCounterparty?: (
    metaPatch: Partial<OrderDocumentMeta>,
    resolvedShortName: string
  ) => void;
  hideCardSwitch?: boolean;
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
  wantsDiadocDuplicate = false,
  onChangeWantsDiadocDuplicate,
  onResolvedCounterparty,
  hideCardSwitch = false,
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

  const [resolvedCounterparty, setResolvedCounterparty] =
    useState<CounterpartyLookupResult | null>(() =>
      innInfo.isCompleteLength && innInfo.checksumValid
        ? resolveOfflineCounterpartyByInn(innInfo.digits)
        : null
    );
  const [isLookingUpInn, setIsLookingUpInn] = useState(false);

  const lastAutoFilledNameRef = useRef<string>('');
  const companyNameRef = useRef<string>(companyName);
  companyNameRef.current = companyName;
  const wantsDiadocRef = useRef<boolean>(wantsDiadocDuplicate);
  wantsDiadocRef.current = wantsDiadocDuplicate;
  const onChangeCompanyNameRef = useRef(onChangeCompanyName);
  onChangeCompanyNameRef.current = onChangeCompanyName;
  const onResolvedCounterpartyRef = useRef(onResolvedCounterparty);
  onResolvedCounterpartyRef.current = onResolvedCounterparty;

  useEffect(() => {
    const digits = normalizeInnDigits(companyInn);
    const check = inspectInnDigits(digits);
    if (!check.isCompleteLength || !check.checksumValid) {
      setResolvedCounterparty(null);
      setIsLookingUpInn(false);
      return;
    }

    const applyCounterparty = (cp: CounterpartyLookupResult) => {
      setResolvedCounterparty(cp);
      const currentTrimmed = companyNameRef.current.trim();
      const canAutoFillName =
        !currentTrimmed ||
        currentTrimmed === lastAutoFilledNameRef.current ||
        currentTrimmed.startsWith('Организация (ИНН ') ||
        currentTrimmed.startsWith('ИП (ИНН ');
      if (canAutoFillName && cp.shortName) {
        lastAutoFilledNameRef.current = cp.shortName;
        onChangeCompanyNameRef.current(cp.shortName);
      }
      onResolvedCounterpartyRef.current?.(
        counterpartyToDocumentMetaPatch(cp, {
          wantsDiadocDuplicate: wantsDiadocRef.current,
        }),
        cp.shortName
      );
    };

    const offline = resolveOfflineCounterpartyByInn(digits);
    if (offline) {
      applyCounterparty(offline);
    }

    if (typeof window === 'undefined' || typeof fetch !== 'function') {
      return;
    }

    const controller = new AbortController();
    setIsLookingUpInn(true);
    fetch(`/api/public/counterparty-by-inn?inn=${encodeURIComponent(digits)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          payload: {
            ok?: boolean;
            counterparty?: CounterpartyLookupResult;
          } | null
        ) => {
          if (!controller.signal.aborted && payload?.ok && payload.counterparty) {
            applyCounterparty(payload.counterparty);
          }
        }
      )
      .catch(() => {
        // Офлайн-карточка ФНС уже применена синхронно
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLookingUpInn(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [companyInn]);

  const effectiveDisplayName =
    companyName.trim() || resolvedCounterparty?.shortName || '';
  const hasValidName = effectiveDisplayName.length >= 2 && !companyNameError;
  const isReadyForAutoDocs =
    isEdoRequired && hasValidName && innInfo.isCompleteLength && innInfo.checksumValid;
  const hasAnyError = Boolean(companyNameError || companyInnError);

  const nameInputId = `${idPrefix}-name`;
  const innInputId = `${idPrefix}-inn`;
  const innStatusId = `${idPrefix}-inn-status`;
  const diadocCheckboxId = `${idPrefix}-wants-diadoc`;

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
                ? 'Реквизиты по ИНН для мгновенного счёта'
                : 'Реквизиты компании или ИП (по желанию)'}
            </p>
          </div>
          <p className="text-xs text-[#111111]/64 dark:text-[#F4F3EF]/64 leading-relaxed">
            Введите ИНН — название, КПП, ОГРН и юр. адрес подтянутся для счёта автоматически. Банк и р/с плательщика не требуются.
          </p>
        </div>

        {isEdoRequired && onSwitchToCardOnline && !hideCardSwitch && (
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
        {/* ИНН организации или ИП — первое главное поле */}
        <div className="sm:col-span-5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor={innInputId}
              className="block text-xs font-semibold text-[#111111]/76 dark:text-[#F4F3EF]/76"
            >
              ИНН {isEdoRequired ? '*' : ''}
            </label>
            <span className="text-[11px] font-medium tabular-nums text-[#111111]/48 dark:text-[#F4F3EF]/48">
              {isLookingUpInn
                ? 'Поиск ЕГРЮЛ…'
                : innInfo.digits.length > 0
                  ? `${innInfo.digits.length} / ${innInfo.digits.length > 10 ? 12 : 10}`
                  : '10 или 12 цифр'}
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
            placeholder="Например: 6663003127"
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

        {/* Название компании / ИП — заполняется автоматически по ИНН, доступно для правки */}
        <div className="sm:col-span-7 space-y-1.5">
          <label
            htmlFor={nameInputId}
            className="block text-xs font-semibold text-[#111111]/76 dark:text-[#F4F3EF]/76"
          >
            Название компании или ИП (авто по ИНН)
          </label>
          <input
            ref={nameInputRef}
            id={nameInputId}
            type="text"
            autoComplete="organization"
            data-testid="company-name-input"
            aria-label="Название компании или ИП"
            aria-invalid={Boolean(companyNameError)}
            value={companyName}
            onChange={(e) => onChangeCompanyName(e.target.value)}
            placeholder="Заполнится по ИНН (или укажите вручную)"
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
      </div>

      {/* Автоматическая сводка реквизитов ЕГРЮЛ / ЕГРИП + статус Контур.Диадок без визуального шума */}
      {resolvedCounterparty && innInfo.checksumValid && (
        <div
          data-testid="company-egrul-preview"
          className="pt-2 border-t border-[#111111]/10 dark:border-white/10 space-y-1 text-xs text-[#111111]/74 dark:text-[#F4F3EF]/74 tabular-nums leading-relaxed"
        >
          <p className="font-medium text-[#111111] dark:text-[#F4F3EF]">
            {resolvedCounterparty.legalName}
            {resolvedCounterparty.kpp ? ` · КПП ${resolvedCounterparty.kpp}` : ''}
            {resolvedCounterparty.ogrn
              ? ` · ${
                  resolvedCounterparty.entityKind === 'sole_proprietor'
                    ? 'ОГРНИП'
                    : 'ОГРН'
                } ${resolvedCounterparty.ogrn}`
              : ''}
          </p>
          <p className="text-[11px] text-[#111111]/58 dark:text-[#F4F3EF]/58">
            {resolvedCounterparty.legalAddress}
            {resolvedCounterparty.diadoc.hasBox
              ? ` · ЭДО Контур.Диадок: ${resolvedCounterparty.diadoc.boxId}`
              : ' · Счёт с QR-кодом для оплаты в любом банке РФ'}
          </p>
        </div>
      )}

      {/* Необязательная галочка дублирования счёта в Контур.Диадок */}
      {onChangeWantsDiadocDuplicate && (
        <label
          htmlFor={diadocCheckboxId}
          className="flex items-start gap-2.5 pt-1 cursor-pointer select-none text-xs text-[#111111]/82 dark:text-[#F4F3EF]/82"
        >
          <input
            id={diadocCheckboxId}
            type="checkbox"
            data-testid="company-wants-diadoc-checkbox"
            checked={wantsDiadocDuplicate}
            onChange={(e) => {
              const checked = e.target.checked;
              onChangeWantsDiadocDuplicate(checked);
              if (resolvedCounterparty) {
                onResolvedCounterparty?.(
                  counterpartyToDocumentMetaPatch(resolvedCounterparty, {
                    wantsDiadocDuplicate: checked,
                  }),
                  resolvedCounterparty.shortName
                );
              }
            }}
            className="mt-0.5 w-4 h-4 rounded border-[#111111]/30 accent-[#FF4820] shrink-0"
          />
          <span className="leading-snug">
            <strong className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
              Продублировать счёт в ЭДО (Контур.Диадок)
            </strong>{' '}
            <span className="text-[#111111]/58 dark:text-[#F4F3EF]/58">
              — скачайте PDF с QR-кодом сразу, а оригинал счёта и закрывающие придут в Диадок
            </span>
          </span>
        </label>
      )}

      {/* Статус готовности счёта показываем только если карточка ЕГРЮЛ выше не выведена */}
      {isReadyForAutoDocs && !resolvedCounterparty && (
        <div
          data-testid="company-details-ready-status"
          className="rounded-xl px-3.5 py-2.5 bg-emerald-600/10 border border-emerald-600/25 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 tabular-nums"
        >
          <FileCheck2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>
            Счёт A4 с реквизитами и QR-кодом для <strong>{effectiveDisplayName}</strong> (ИНН{' '}
            {innInfo.digits}) откроется сразу после отправки.
          </span>
        </div>
      )}
    </div>
  );
}
