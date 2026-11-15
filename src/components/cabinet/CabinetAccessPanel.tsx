import { KeyRound, Mail, Search } from 'lucide-react';
import { FormEvent } from 'react';
import { DEMO_CLIENT_CABINET_EMAIL } from '../../data/clientAuthShared';
import type { CabinetAccessTabId } from '../../data/clientCabinetArchitecture';
import type { MagicLinkDispatchPreview } from './useClientCabinetController';

export interface CabinetAccessPanelProps {
  accessTab: CabinetAccessTabId;
  onSelectTab: (tab: CabinetAccessTabId) => void;
  magicEmailInput: string;
  onChangeMagicEmailInput: (value: string) => void;
  revokeOtherSessionsOnReset: boolean;
  onChangeRevokeOtherSessionsOnReset: (checked: boolean) => void;
  isRequestingMagic: boolean;
  isVerifyingMagic: boolean;
  magicRequestError: string | null;
  magicDispatchResult: MagicLinkDispatchPreview | null;
  onSubmitMagicLink: (e: FormEvent) => void;
  onTriggerDemoMagicEmail: (email: string) => void;
  onOpenPreviewMagicLink: () => void;
  orderNumberInput: string;
  onChangeOrderNumberInput: (value: string) => void;
  verifierInput: string;
  onChangeVerifierInput: (value: string) => void;
  isLookingUp: boolean;
  lookupError: string | null;
  onSubmitLookup: (e: FormEvent) => void;
  onTriggerDemoOrderLookup: () => void;
}

export function CabinetAccessPanel({
  accessTab,
  onSelectTab,
  magicEmailInput,
  onChangeMagicEmailInput,
  revokeOtherSessionsOnReset,
  onChangeRevokeOtherSessionsOnReset,
  isRequestingMagic,
  isVerifyingMagic,
  magicRequestError,
  magicDispatchResult,
  onSubmitMagicLink,
  onTriggerDemoMagicEmail,
  onOpenPreviewMagicLink,
  orderNumberInput,
  onChangeOrderNumberInput,
  verifierInput,
  onChangeVerifierInput,
  isLookingUp,
  lookupError,
  onSubmitLookup,
  onTriggerDemoOrderLookup,
}: CabinetAccessPanelProps) {
  const isResetTab = accessTab === 'access_reset';
  const isEmailFlow = accessTab === 'magic_email' || accessTab === 'access_reset';

  return (
    <section
      data-testid="cabinet-lookup-card"
      aria-label="Автоматическая регистрация, сброс доступа по magic-ссылке и поиск заказа"
      className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 p-5 sm:p-7 space-y-5"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Способ доступа к личному кабинету"
          className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#EFECE5] dark:bg-[#0D0D0F] border border-[#111111]/8 dark:border-white/8 self-start"
        >
          <button
            type="button"
            role="tab"
            aria-selected={accessTab === 'magic_email'}
            data-testid="cabinet-tab-magic"
            onClick={() => onSelectTab('magic_email')}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              accessTab === 'magic_email'
                ? 'bg-white text-[#111111] dark:bg-[#1C1C22] dark:text-[#F4F3EF] shadow-xs'
                : 'text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
            }`}
          >
            По почте (авто-вход)
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={accessTab === 'access_reset'}
            data-testid="cabinet-tab-reset"
            onClick={() => onSelectTab('access_reset')}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              accessTab === 'access_reset'
                ? 'bg-white text-[#111111] dark:bg-[#1C1C22] dark:text-[#F4F3EF] shadow-xs'
                : 'text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
            }`}
          >
            Сброс доступа (magic-ссылка)
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={accessTab === 'order_number'}
            data-testid="cabinet-tab-lookup"
            onClick={() => onSelectTab('order_number')}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              accessTab === 'order_number'
                ? 'bg-white text-[#111111] dark:bg-[#1C1C22] dark:text-[#F4F3EF] shadow-xs'
                : 'text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
            }`}
          >
            По номеру заказа
          </button>
        </div>

        {isEmailFlow ? (
          <button
            type="button"
            data-testid="cabinet-demo-magic-btn"
            disabled={isRequestingMagic || isVerifyingMagic}
            onClick={() => onTriggerDemoMagicEmail(DEMO_CLIENT_CABINET_EMAIL)}
            className="min-h-[38px] px-3.5 py-2 rounded-xl border border-[#FF4820]/35 bg-[#FF4820]/8 hover:bg-[#FF4820]/14 text-xs font-semibold text-[#FF4820] transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start lg:self-auto"
          >
            Демо-почта ({DEMO_CLIENT_CABINET_EMAIL})
          </button>
        ) : (
          <button
            type="button"
            data-testid="cabinet-demo-order-btn"
            disabled={isLookingUp}
            onClick={onTriggerDemoOrderLookup}
            className="min-h-[38px] px-3.5 py-2 rounded-xl border border-[#FF4820]/35 bg-[#FF4820]/8 hover:bg-[#FF4820]/14 text-xs font-semibold text-[#FF4820] transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start lg:self-auto"
          >
            Открыть демо-заказ (FM-HOLD-2854)
          </button>
        )}
      </div>

      {isEmailFlow ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-[#111111] dark:text-[#F4F3EF]">
              {isResetTab
                ? 'Сброс и восстановление доступа по magic-ссылке'
                : 'Автоматическая регистрация и вход по почте без пароля'}
            </h2>
            <p className="text-xs sm:text-sm text-[#111111]/64 dark:text-[#F4F3EF]/64 leading-relaxed max-w-3xl">
              {isResetTab
                ? 'Если вы сменили ноутбук, очистили историю браузера или открывали кабинет на чужом компьютере — укажите вашу почту. Мы отправим одноразовую magic-ссылку (30 мин), восстановим все заказы и при необходимости завершим старые сессии.'
                : 'При оформлении заказа с почтой профиль создаётся автоматически, а вход выполняется сразу. Если вы входите впервые или с нового устройства — укажите почту, и мы подготовим одноразовую magic-ссылку.'}
            </p>
          </div>

          <form
            onSubmit={onSubmitMagicLink}
            className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
          >
            <div className="sm:col-span-8 space-y-1.5">
              <label
                htmlFor="cabinet-magic-email-input"
                className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
              >
                Рабочая или личная почта клиента
              </label>
              <input
                id="cabinet-magic-email-input"
                data-testid="cabinet-magic-email-input"
                type="email"
                value={magicEmailInput}
                onChange={(e) => onChangeMagicEmailInput(e.target.value)}
                placeholder="name@company.ru"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/16 dark:border-white/16 text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              />
            </div>

            <div className="sm:col-span-4">
              <button
                type="submit"
                data-testid="cabinet-magic-submit-btn"
                disabled={isRequestingMagic || isVerifyingMagic}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#111111] hover:bg-[#FF4820] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#FF4820] dark:hover:text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {isResetTab ? (
                  <KeyRound className="w-4 h-4 shrink-0" aria-hidden="true" />
                ) : (
                  <Mail className="w-4 h-4 shrink-0" aria-hidden="true" />
                )}
                <span>
                  {isRequestingMagic
                    ? 'Отправляем…'
                    : isResetTab
                      ? 'Сбросить доступ (magic-ссылка)'
                      : 'Получить magic-ссылку'}
                </span>
              </button>
            </div>
          </form>

          {isResetTab && (
            <label className="inline-flex items-start gap-2.5 text-xs text-[#111111]/75 dark:text-[#F4F3EF]/75 cursor-pointer select-none">
              <input
                type="checkbox"
                data-testid="cabinet-reset-revoke-checkbox"
                checked={revokeOtherSessionsOnReset}
                onChange={(e) =>
                  onChangeRevokeOtherSessionsOnReset(e.target.checked)
                }
                className="mt-0.5 w-4 h-4 rounded accent-[#FF4820] shrink-0"
              />
              <span>
                Завершить активные сессии на других устройствах и браузерах после перехода по новой magic-ссылке
              </span>
            </label>
          )}

          {magicRequestError && (
            <p
              role="alert"
              data-testid="cabinet-magic-error"
              className="text-xs font-medium text-[#DC2626] dark:text-[#F87171]"
            >
              {magicRequestError}
            </p>
          )}

          {magicDispatchResult && (
            <div
              data-testid="cabinet-magic-dispatch-panel"
              className="rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 p-4 space-y-3"
            >
              {magicDispatchResult.deliveryMode === 'email_gateway' ? (
                <p className="text-xs sm:text-sm text-[#111111] dark:text-[#F4F3EF]">
                  {magicDispatchResult.intent === 'reset'
                    ? 'Одноразовая magic-ссылка для сброса и восстановления доступа отправлена на '
                    : 'Одноразовая magic-ссылка для входа отправлена на '}
                  <strong>{magicDispatchResult.email}</strong> (действует 30 минут). Перейдите по ней из письма.
                </p>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]">
                      {magicDispatchResult.intent === 'reset'
                        ? 'Ссылка сброса доступа готова для '
                        : magicDispatchResult.isNewRegistration
                          ? 'Профиль создан · Magic-ссылка готова для '
                          : 'Одноразовая magic-ссылка готова для '}
                      <span>{magicDispatchResult.email}</span> (30 мин)
                    </p>
                    <p className="text-xs text-[#111111]/62 dark:text-[#F4F3EF]/62">
                      {magicDispatchResult.revokeOtherSessions
                        ? 'При переходе по ссылке восстановятся заказы и отзовутся старые сессии других браузеров (режим локального предпросмотра без внешнего SMTP):'
                        : 'В режиме предпросмотра (без внешнего SMTP) ссылка доступна сразу для мгновенной проверки входа:'}
                    </p>
                  </div>

                  {magicDispatchResult.magicLinkPath && (
                    <button
                      type="button"
                      disabled={isVerifyingMagic}
                      data-testid="cabinet-preview-magic-open-btn"
                      onClick={onOpenPreviewMagicLink}
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FF4820] hover:bg-[#E63D18] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                    >
                      {isVerifyingMagic
                        ? 'Проверяем ссылку…'
                        : magicDispatchResult.intent === 'reset'
                          ? 'Восстановить доступ по ссылке →'
                          : 'Войти по magic-ссылке →'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-[#111111] dark:text-[#F4F3EF]">
              Подключить отдельный заказ по номеру
            </h2>
            <p className="text-xs sm:text-sm text-[#111111]/62 dark:text-[#F4F3EF]/62">
              Если заказ оформлялся без почты, введите его номер и последние 4 цифры телефона, @Telegram или ИНН.
            </p>
          </div>

          <form
            onSubmit={onSubmitLookup}
            className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
          >
            <div className="sm:col-span-4 space-y-1.5">
              <label
                htmlFor="cabinet-lookup-order-num"
                className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
              >
                Номер заказа
              </label>
              <input
                id="cabinet-lookup-order-num"
                data-testid="cabinet-lookup-order-input"
                type="text"
                value={orderNumberInput}
                onChange={(e) => onChangeOrderNumberInput(e.target.value)}
                placeholder="Например, FM-2510"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/16 dark:border-white/16 text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              />
            </div>

            <div className="sm:col-span-5 space-y-1.5">
              <label
                htmlFor="cabinet-lookup-verifier"
                className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
              >
                Телефон (последние 4 цифры), @Telegram или ИНН
              </label>
              <input
                id="cabinet-lookup-verifier"
                data-testid="cabinet-lookup-verifier-input"
                type="text"
                value={verifierInput}
                onChange={(e) => onChangeVerifierInput(e.target.value)}
                placeholder="4510 или 7702070139"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/16 dark:border-white/16 text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              />
            </div>

            <div className="sm:col-span-3">
              <button
                type="submit"
                data-testid="cabinet-lookup-submit-btn"
                disabled={isLookingUp}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#111111] hover:bg-[#FF4820] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#FF4820] dark:hover:text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{isLookingUp ? 'Поиск…' : 'Открыть заказ'}</span>
              </button>
            </div>
          </form>

          {lookupError && (
            <p
              role="alert"
              className="text-xs font-medium text-[#DC2626] dark:text-[#F87171]"
            >
              {lookupError}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
