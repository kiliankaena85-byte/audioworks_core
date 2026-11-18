import { KeyRound, Mail, Search } from 'lucide-react';
import { FormEvent, KeyboardEvent, useRef } from 'react';
import { DEMO_CLIENT_CABINET_EMAIL } from '../../data/clientAuthShared';
import type { CabinetAccessTabId } from '../../data/clientCabinetArchitecture';
import type { MagicLinkDispatchPreview } from './useClientCabinetController';
import { PersonalDataConsentField } from '../legal/PersonalDataConsentField';

export interface CabinetAccessPanelProps {
  accessTab: CabinetAccessTabId;
  onSelectTab: (tab: CabinetAccessTabId) => void;
  magicEmailInput: string;
  onChangeMagicEmailInput: (value: string) => void;
  magicConsentAccepted: boolean;
  onChangeMagicConsentAccepted: (checked: boolean) => void;
  magicConsentError: string | null;
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

const PRIMARY_ACCESS_TABS: readonly {
  id: Exclude<CabinetAccessTabId, 'access_reset'>;
  testId: string;
  label: string;
}[] = [
  {
    id: 'magic_email',
    testId: 'cabinet-tab-magic',
    label: 'Вход по почте',
  },
  {
    id: 'order_number',
    testId: 'cabinet-tab-lookup',
    label: 'По номеру заказа',
  },
];

export function CabinetAccessPanel({
  accessTab,
  onSelectTab,
  magicEmailInput,
  onChangeMagicEmailInput,
  magicConsentAccepted,
  onChangeMagicConsentAccepted,
  magicConsentError,
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
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const isResetTab = accessTab === 'access_reset';
  const isEmailFlow = accessTab === 'magic_email' || accessTab === 'access_reset';
  const panelId = 'cabinet-access-tabpanel';

  const handleTabKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    currentIdx: number
  ) => {
    let nextIdx = -1;
    if (e.key === 'ArrowRight') {
      nextIdx = (currentIdx + 1) % PRIMARY_ACCESS_TABS.length;
    } else if (e.key === 'ArrowLeft') {
      nextIdx =
        (currentIdx - 1 + PRIMARY_ACCESS_TABS.length) %
        PRIMARY_ACCESS_TABS.length;
    } else if (e.key === 'Home') {
      nextIdx = 0;
    } else if (e.key === 'End') {
      nextIdx = PRIMARY_ACCESS_TABS.length - 1;
    }
    if (nextIdx >= 0) {
      e.preventDefault();
      const target = PRIMARY_ACCESS_TABS[nextIdx];
      onSelectTab(target.id);
      tabRefs.current[target.id]?.focus();
    }
  };

  return (
    <section
      data-testid="cabinet-lookup-card"
      aria-label="Вход по почте и поиск заказа"
      className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 p-5 sm:p-7 space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Способ доступа к личному кабинету"
          className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#EFECE5] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10 self-start"
        >
          {PRIMARY_ACCESS_TABS.map((tab, idx) => {
            const selected =
              accessTab === tab.id || (tab.id === 'magic_email' && isResetTab);
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[tab.id] = el;
                }}
                id={`cabinet-access-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                data-testid={tab.testId}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                onClick={() => onSelectTab(tab.id)}
                className={`min-h-[44px] sm:min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820] ${
                  selected
                    ? 'bg-white text-[#111111] dark:bg-[#1C1C22] dark:text-[#F4F3EF] shadow-xs'
                    : 'text-[#111111]/74 dark:text-[#F4F3EF]/74 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Быстрый вход в публичный демо-кабинет в 1 клик без ПДн-барьера */}
        {isEmailFlow ? (
          <button
            type="button"
            data-testid="cabinet-demo-magic-btn"
            disabled={isRequestingMagic || isVerifyingMagic}
            onClick={() => onTriggerDemoMagicEmail(DEMO_CLIENT_CABINET_EMAIL)}
            className="min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-xl border border-[#C83210]/30 hover:border-[#FF4820] bg-[#C83210]/[0.06] hover:bg-[#C83210]/[0.11] text-xs font-semibold text-[#C83210] dark:text-[#FF6B47] transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
          >
            {isRequestingMagic || isVerifyingMagic
              ? 'Открываем пример…'
              : 'Посмотреть пример кабинета →'}
          </button>
        ) : (
          <button
            type="button"
            data-testid="cabinet-demo-order-btn"
            disabled={isLookingUp}
            onClick={onTriggerDemoOrderLookup}
            className="min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-xl border border-[#C83210]/30 hover:border-[#FF4820] bg-[#C83210]/[0.06] hover:bg-[#C83210]/[0.11] text-xs font-semibold text-[#C83210] dark:text-[#FF6B47] transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
          >
            Открыть пример заказа (FM-HOLD-2854) →
          </button>
        )}
      </div>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`cabinet-access-tab-${isResetTab ? 'magic_email' : accessTab}`}
        tabIndex={0}
        className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
      >
        {isEmailFlow ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-[#111111] dark:text-[#F4F3EF]">
                  {isResetTab
                    ? 'Восстановление доступа и завершение старых сессий'
                    : 'Вход по почте без пароля'}
                </h2>
                {isResetTab && (
                  <button
                    type="button"
                    onClick={() => onSelectTab('magic_email')}
                    className="min-h-[36px] text-xs font-semibold text-[#C83210] dark:text-[#FF6B47] hover:underline cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                  >
                    ← Обычный вход по почте
                  </button>
                )}
              </div>
              <p className="text-xs sm:text-sm text-[#111111]/74 dark:text-[#F4F3EF]/74 leading-relaxed max-w-3xl">
                {isResetTab
                  ? 'Сменили ноутбук или открывали кабинет на чужом устройстве? Укажите почту — отправим одноразовую ссылку (30 мин), восстановим заказы и завершим старые сессии.'
                  : 'Укажите рабочую или личную почту — отправим одноразовую ссылку ко всем текущим и завершённым проектам вашей компании.'}
              </p>
            </div>

            <form
              onSubmit={onSubmitMagicLink}
              className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
            >
              <div className="sm:col-span-8 space-y-1.5">
                <label
                  htmlFor="cabinet-magic-email-input"
                  className="block text-xs font-semibold text-[#111111]/82 dark:text-[#F4F3EF]/82"
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
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#111111] hover:bg-[#C83210] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#FF4820] dark:hover:text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
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
                        ? 'Восстановить доступ'
                        : 'Получить ссылку входа'}
                  </span>
                </button>
              </div>

              <div className="sm:col-span-12 pt-1">
                <PersonalDataConsentField
                  id="cabinet-magic-pdn-consent"
                  checked={magicConsentAccepted}
                  onChange={onChangeMagicConsentAccepted}
                  error={magicConsentError ?? undefined}
                  compact
                  testIdPrefix="cabinet-magic-pdn-consent"
                />
              </div>
            </form>

            {isResetTab ? (
              <label className="inline-flex items-start gap-2.5 text-xs text-[#111111]/80 dark:text-[#F4F3EF]/80 cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="cabinet-reset-revoke-checkbox"
                  checked={revokeOtherSessionsOnReset}
                  onChange={(e) =>
                    onChangeRevokeOtherSessionsOnReset(e.target.checked)
                  }
                  className="mt-0.5 w-4 h-4 rounded accent-[#C83210] shrink-0"
                />
                <span>
                  Завершить активные сессии на других устройствах и браузерах после перехода по новой ссылке
                </span>
              </label>
            ) : (
              <div className="pt-0.5">
                <button
                  type="button"
                  data-testid="cabinet-tab-reset"
                  onClick={() => onSelectTab('access_reset')}
                  className="min-h-[36px] text-xs font-medium text-[#111111]/68 dark:text-[#F4F3EF]/68 hover:text-[#C83210] dark:hover:text-[#FF6B47] underline decoration-[#111111]/25 dark:decoration-white/25 underline-offset-3 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                >
                  Потеряли доступ или нужно завершить сессии на других устройствах?
                </button>
              </div>
            )}

            {magicRequestError && (
              <p
                role="alert"
                data-testid="cabinet-magic-error"
                className="text-xs font-medium text-[#B91C1C] dark:text-[#F87171]"
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
                      ? 'Одноразовая ссылка для восстановления доступа отправлена на '
                      : 'Одноразовая ссылка для входа отправлена на '}
                    <strong>{magicDispatchResult.email}</strong> (действует 30 минут). Перейдите по ней из письма.
                  </p>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]">
                        {magicDispatchResult.intent === 'reset'
                          ? 'Ссылка восстановления доступа готова для '
                          : magicDispatchResult.isNewRegistration
                            ? 'Профиль создан · Ссылка входа готова для '
                            : 'Одноразовая ссылка входа готова для '}
                        <span>{magicDispatchResult.email}</span> (30 мин)
                      </p>
                      <p className="text-xs text-[#111111]/74 dark:text-[#F4F3EF]/74">
                        {magicDispatchResult.revokeOtherSessions
                          ? 'При переходе восстановятся заказы и завершатся старые сессии других браузеров:'
                          : 'Нажмите кнопку справа для мгновенного входа в личный кабинет:'}
                      </p>
                    </div>

                    {magicDispatchResult.magicLinkPath && (
                      <button
                        type="button"
                        disabled={isVerifyingMagic}
                        data-testid="cabinet-preview-magic-open-btn"
                        onClick={onOpenPreviewMagicLink}
                        className="min-h-[44px] sm:min-h-[40px] px-4 py-2 rounded-xl bg-[#C83210] hover:bg-[#B02A0C] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                      >
                        {isVerifyingMagic
                          ? 'Проверяем ссылку…'
                          : magicDispatchResult.intent === 'reset'
                            ? 'Восстановить доступ →'
                            : 'Войти в кабинет →'}
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
              <p className="text-xs sm:text-sm text-[#111111]/74 dark:text-[#F4F3EF]/74">
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
                  className="block text-xs font-semibold text-[#111111]/82 dark:text-[#F4F3EF]/82"
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
                  className="block text-xs font-semibold text-[#111111]/82 dark:text-[#F4F3EF]/82"
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
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#111111] hover:bg-[#C83210] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#FF4820] dark:hover:text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                >
                  <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{isLookingUp ? 'Поиск…' : 'Открыть заказ'}</span>
                </button>
              </div>
            </form>

            {lookupError && (
              <p
                role="alert"
                className="text-xs font-medium text-[#B91C1C] dark:text-[#F87171]"
              >
                {lookupError}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
