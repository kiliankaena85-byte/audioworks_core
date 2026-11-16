import { CheckCircle2, Copy, Printer, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { FormEvent, useRef, useState } from 'react';
import {
  FlexibleMediaPlanResult,
  formatAudienceSummaryLine,
} from '../data/mediaPlannerCore';
import { buildMediaPlanSnapshotFromFlexiblePlan } from '../data/orderCrmTypes';
import {
  formatNumberSpaced,
  formatRubCompact,
  MEDIA_NICHE_OPTIONS,
  TURNKEY_30S_PRODUCTION_RUB,
  validateMediaHoldReservation,
} from '../data/radioInventory';
import { useLeadShieldForm } from '../security/useLeadShieldForm';
import { PersonalDataConsentField } from './legal/PersonalDataConsentField';

export function buildFlexibleExecutiveProposalText(
  plan: FlexibleMediaPlanResult
): string {
  const nicheLabel =
    MEDIA_NICHE_OPTIONS.find((n) => n.id === plan.niche)?.label ?? 'Бизнес-сегмент';
  const dateLabel = new Date().toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const lines = [
    `КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ · ЭФИРНЫЙ МЕДИАПЛАН FMWORKS.RU`,
    `Дата расчёта: ${dateLabel} · Резерв горящих квот: 4 часа`,
    `Отрасль: ${nicheLabel}${plan.productNote.trim() ? ` (${plan.productNote.trim()})` : ''}`,
    `Целевая аудитория: ${formatAudienceSummaryLine(plan.audience)}`,
    `Хронометраж ролика: ${plan.spotSeconds} сек (честный посекундный расчёт)`,
    `Захват целевой радиоаудитории: до ${plan.targetAudienceSharePct}% · Прогноз контактов: ${formatNumberSpaced(plan.totalReachOTS)} OTS`,
    ``,
    `ЭКСПЕРТНОЕ ОБОСНОВАНИЕ МЕДИАПЛАНА:`,
    plan.buyerRationale,
    ``,
    `ВЕДОМОСТЬ ВЫБРАННЫХ ЭФИРНЫХ ОКОН (${plan.selectedStationsCount} ст. · ${plan.selectedQuotes.length} тайм-слотов · ${plan.totalSpots} выходов):`,
    ...plan.selectedQuotes.map((q, idx) => {
      return `${idx + 1}. ${q.stationItem.station} (${q.stationItem.frequencyFm}) — ${q.variation.label} (${q.variation.hoursWindow}), ${q.variation.daysPattern} [окна: ${q.variation.sampleTimeSlots.join(', ')}] — ${q.spotsCount} выходов × ${q.spotSeconds} сек (ставка ${q.variation.hotRatePerSec} ₽/сек), ${formatNumberSpaced(q.reachOTS)} OTS — ${formatRubCompact(q.hotPriceRub)} (прайс ${formatRubCompact(q.officialPriceRub)}, −${q.discountPercent}%)`;
    }),
    ``,
    `ФИНАНСОВАЯ СВОДКА ПРОЕКТА («ЕДИНОЕ ОКНО ЗАПУСКА»):`,
    `• Стоимость эфира по официальному прайсу станций: ${formatRubCompact(plan.officialAirTotalRub)}`,
    `• Стоимость эфира по горящим квотам FMWorks: ${formatRubCompact(plan.hotAirTotalRub)}`,
    `• Аудиоролик (${plan.spotSeconds} сек) и паспорт прав: ${
      plan.production.isBonusUnlocked
        ? `0 ₽ • БОНУС КВОТЫ (вместо ${formatRubCompact(plan.production.originalValueRub || TURNKEY_30S_PRODUCTION_RUB)})`
        : formatRubCompact(plan.production.effectivePriceRub)
    }`,
    `• Суммарная экономия компании: +${formatRubCompact(plan.totalSavingsRub)}`,
    `• ИТОГО К СОГЛАСОВАНИЮ (по договору и ЭДО): ${formatRubCompact(plan.totalClientCostRub)}`,
    ``,
    `Контакты отдела медиабаинга: art@artmspektr.ru · https://fmworks.ru`,
  ];

  return lines.join('\n');
}

interface MediaProposalModalProps {
  isOpen: boolean;
  plan: FlexibleMediaPlanResult;
  onClose: () => void;
  onReserveFromProposal: () => void;
}

export function MediaProposalModal({
  isOpen,
  plan,
  onClose,
  onReserveFromProposal,
}: MediaProposalModalProps) {
  const [copiedProposal, setCopiedProposal] = useState(false);

  const nicheLabel =
    MEDIA_NICHE_OPTIONS.find((n) => n.id === plan.niche)?.label ?? 'Бизнес-сегмент';
  const proposalDocNumber = `КП-${new Date().getFullYear()}-${104 + plan.totalSpots}`;
  const proposalDateText = new Date().toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const handleCopy = async () => {
    const text = buildFlexibleExecutiveProposalText(plan);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedProposal(true);
      window.setTimeout(() => setCopiedProposal(false), 2500);
    } catch {
      setCopiedProposal(true);
      window.setTimeout(() => setCopiedProposal(false), 2500);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#111111]/60 dark:bg-black/75 overflow-y-auto print:static print:bg-transparent print:p-0"
          role="dialog"
          aria-modal="true"
          aria-labelledby="executive-kp-title"
          data-testid="kp-proposal-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-3xl my-auto rounded-3xl bg-[#FFFFFF] text-[#111111] border border-[#111111]/12 p-6 sm:p-10 space-y-6 max-h-[92vh] overflow-y-auto subtle-scrollbar print:max-h-none print:border-0 print:rounded-none print:p-0"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#111111]/10 print:hidden">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="copy-kp-text-btn"
                  onClick={handleCopy}
                  className="min-h-[40px] px-4 py-2 rounded-full bg-[#111111] hover:bg-[#27272A] text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {copiedProposal
                      ? 'Скопировано для отправки'
                      : 'Скопировать текст руководителю'}
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="print-kp-btn"
                  onClick={() => window.print()}
                  className="min-h-[40px] px-4 py-2 rounded-full bg-[#F7F6F2] hover:bg-[#EFECE5] border border-[#111111]/14 text-[#111111] text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Printer className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Печать / Сохранить в PDF</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть коммерческое предложение"
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#111111]/8 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6 tabular-nums">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[#111111]/12">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-[#FF4820] text-white font-bold text-xs inline-flex items-center justify-center">
                      W
                    </span>
                    <span className="text-lg font-extrabold tracking-tight text-[#111111]">
                      FMWorks®
                    </span>
                    <span className="text-xs text-[#111111]/55">
                      · Отдел радиомедиабаинга и аудиопродакшна
                    </span>
                  </div>
                  <h2
                    id="executive-kp-title"
                    className="text-2xl sm:text-3xl font-bold tracking-tight pt-1"
                  >
                    Коммерческое предложение · Эфирный медиаплан
                  </h2>
                  <p className="text-xs text-[#111111]/62">
                    Отрасль: <strong>{nicheLabel}</strong> · ЦА:{' '}
                    <strong>{formatAudienceSummaryLine(plan.audience)}</strong> · Хронометраж:{' '}
                    <strong>{plan.spotSeconds} сек</strong>
                  </p>
                </div>

                <div className="text-left sm:text-right text-xs text-[#111111]/62 shrink-0 space-y-0.5">
                  <div className="font-bold text-[#111111]">{proposalDocNumber}</div>
                  <div>от {proposalDateText}</div>
                  <div className="text-[#FF4820] font-semibold">Приоритет квот: 4 часа</div>
                </div>
              </div>

              <div className="rounded-2xl bg-[#F7F6F2] border border-[#111111]/10 p-4 sm:p-5 space-y-1.5">
                <p className="text-xs font-bold text-[#111111]">
                  Обоснование выбора станций и тайм-слотов (захват до {plan.targetAudienceSharePct}% ядра ЦА)
                </p>
                <p className="text-xs sm:text-sm leading-relaxed text-[#111111]/82">
                  {plan.buyerRationale}
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-bold text-[#111111]">
                  Спецификация выбранных эфирных окон ({plan.selectedStationsCount} ст. ·{' '}
                  {plan.totalSpots} выходов · {plan.spotSeconds} сек)
                </h3>
                <div className="overflow-x-auto border border-[#111111]/12 rounded-2xl">
                  <table className="w-full min-w-[580px] text-xs border-collapse text-left">
                    <thead>
                      <tr className="bg-[#F7F6F2] border-b border-[#111111]/10 text-[#111111]/65">
                        <th className="py-2.5 px-3 font-semibold">Радиостанция и слот</th>
                        <th className="py-2.5 px-3 font-semibold">Дни и часы</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Выходы</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Охват OTS</th>
                        <th className="py-2.5 px-3 font-semibold text-right">По квоте</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#111111]/8">
                      {plan.selectedQuotes.map((q) => (
                        <tr key={q.variation.id}>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-[#111111]">
                              {q.stationItem.station}{' '}
                              <span className="font-normal text-[#111111]/55">
                                ({q.stationItem.frequencyFm})
                              </span>
                            </div>
                            <div className="text-[11px] text-[#111111]/65">
                              {q.variation.label} · {q.variation.hotRatePerSec} ₽/сек
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-[#111111]/78">
                            <div>
                              {q.variation.daysPattern} · {q.variation.hoursWindow}
                            </div>
                            <div className="text-[11px] text-[#111111]/52">
                              окна {q.variation.sampleTimeSlots.join(', ')}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold">
                            {q.spotsCount} × {q.spotSeconds}с
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {formatNumberSpaced(q.reachOTS)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="font-bold text-[#111111]">
                              {formatRubCompact(q.hotPriceRub)}
                            </div>
                            <div className="text-[10px] text-[#FF4820] font-semibold">
                              прайс {formatRubCompact(q.officialPriceRub)} (−{q.discountPercent}%)
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl bg-[#111114] text-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 text-xs text-white/75">
                  <div>
                    Официальный прайс радиостанций:{' '}
                    <span className="line-through text-white/50">
                      {formatRubCompact(plan.officialAirTotalRub)}
                    </span>
                  </div>
                  <div>
                    Производство ролика ({plan.spotSeconds} сек) и паспорт прав:{' '}
                    <strong className="text-white">
                      {plan.production.isBonusUnlocked
                        ? '0 ₽ (бонус агентской квоты)'
                        : formatRubCompact(plan.production.effectivePriceRub)}
                    </strong>
                  </div>
                  <div className="text-[#FFB36B] font-semibold">
                    Прямая экономия бюджета: +{formatRubCompact(plan.totalSavingsRub)}
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <div className="text-xs text-white/60">Итого по единому договору (ЭДО)</div>
                  <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                    {formatRubCompact(plan.totalClientCostRub)}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 print:hidden">
                <p className="text-xs text-[#111111]/55">
                  art@artmspektr.ru · Все закрывающие документы и регистрация ОРД включены
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onReserveFromProposal();
                  }}
                  className="w-full sm:w-auto max-w-full min-h-[42px] px-4 sm:px-5 py-2.5 rounded-full bg-[#FF4820] hover:bg-[#E63E19] text-white text-xs font-semibold transition-colors cursor-pointer text-center leading-snug inline-flex items-center justify-center shrink-0"
                >
                  Поставить этот медиаплан в резерв на 4 часа
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface StandaloneHoldModalProps {
  isOpen: boolean;
  plan: FlexibleMediaPlanResult;
  onClose: () => void;
}

export function StandaloneHoldModal({ isOpen, plan, onClose }: StandaloneHoldModalProps) {
  const [holdContact, setHoldContact] = useState('');
  const [holdCompany, setHoldCompany] = useState('');
  const [pdnConsentAccepted, setPdnConsentAccepted] = useState(false);
  const [consentError, setConsentError] = useState<string | undefined>();
  const [holdError, setHoldError] = useState<string | undefined>();
  const [confirmed, setConfirmed] = useState<{
    code: string;
    contact: string;
  } | null>(null);
  const consentInputRef = useRef<HTMLInputElement | null>(null);

  const {
    websiteTrap,
    setWebsiteTrap,
    isSubmittingLead,
    rateLimitCountdownSec,
    registerPointerActivity,
    registerKeyActivity,
    registerFocusActivity,
    submitProtectedLead,
  } = useLeadShieldForm('air_plus_production');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmittingLead) return;

    const res = validateMediaHoldReservation({
      contactLine: holdContact,
      companyName: holdCompany,
      selectedCount: plan.selectedQuotes.length,
    });
    if (!res.valid) {
      setHoldError(res.contactError ?? res.slotsError);
      return;
    }

    if (!pdnConsentAccepted) {
      setConsentError(
        'Подтвердите согласие на обработку персональных данных согласно 152-ФЗ.'
      );
      consentInputRef.current?.focus();
      return;
    }

    const codeCandidate = `FM-HOLD-${420 + (plan.totalSpots % 500)}`;
    const shieldRes = await submitProtectedLead({
      source: 'standalone_hold_modal',
      checkoutMode: 'air_plus_production',
      orderNumberCandidate: codeCandidate,
      formatLabel: `Резерв медиаплана (${plan.selectedStationsCount} ст., ${plan.totalSpots} вых.)`,
      totalBudgetRub: plan.totalClientCostRub,
      contactLine: holdContact,
      companyLine: holdCompany,
      briefText: plan.productNote,
      hasVoiceRecording: false,
      hasAttachedFile: false,
      mediaPlanSnapshot: buildMediaPlanSnapshotFromFlexiblePlan(plan),
      isReturningFastTrack: false,
      requireBriefOrVoice: false,
      pdnConsentAccepted,
    });

    if (!shieldRes.ok) {
      setHoldError(
        shieldRes.contactError ??
          shieldRes.companyError ??
          shieldRes.rateLimitError ??
          'Проверьте контактные данные'
      );
      return;
    }

    setHoldError(undefined);
    setConsentError(undefined);
    setConfirmed({
      code: shieldRes.orderNumber,
      contact: holdContact.trim(),
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111111]/55"
          role="dialog"
          aria-modal="true"
          aria-labelledby="standalone-hold-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div className="w-full max-w-md rounded-3xl bg-[#F7F6F2] text-[#111111] p-6 space-y-4 border border-[#111111]/12">
            <div className="flex items-center justify-between">
              <h3 id="standalone-hold-title" className="text-lg font-bold">
                Приоритетный резерв на 4 часа
              </h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть окно резерва"
                className="w-9 h-9 rounded-full inline-flex items-center justify-center hover:bg-[#111111]/8 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {confirmed ? (
              <div className="space-y-3 py-2">
                <div className="inline-flex items-center gap-2 text-[#FF4820] font-semibold text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Резерв #{confirmed.code} зафиксирован</span>
                </div>
                <p className="text-xs text-[#111111]/75">
                  Продюсер свяжется по контакту <strong>{confirmed.contact}</strong> в течение 20 минут.
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                onPointerMove={registerPointerActivity}
                onKeyDown={registerKeyActivity}
                onFocusCapture={registerFocusActivity}
                className="space-y-3"
              >
                <div aria-hidden="true" className="sr-only">
                  <label htmlFor="hold-modal-website-trap">Сайт (не заполнять)</label>
                  <input
                    id="hold-modal-website-trap"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={websiteTrap}
                    onChange={(e) => setWebsiteTrap(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="hold-contact-input" className="block text-xs font-semibold mb-1">
                    Телефон, @Telegram или рабочая почта
                  </label>
                  <input
                    id="hold-contact-input"
                    type="text"
                    value={holdContact}
                    onChange={(e) => setHoldContact(e.target.value)}
                    placeholder="+7 999 000-00-00 или @telegram"
                    className="w-full h-10 px-3.5 rounded-xl bg-white border border-[#111111]/15 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="hold-company-input" className="block text-xs font-semibold mb-1">
                    Компания или ИНН 10 / 12 цифр (по желанию)
                  </label>
                  <input
                    id="hold-company-input"
                    type="text"
                    value={holdCompany}
                    onChange={(e) => setHoldCompany(e.target.value)}
                    placeholder="ООО или ИНН для ЭДО"
                    className="w-full h-10 px-3.5 rounded-xl bg-white border border-[#111111]/15 text-sm"
                  />
                </div>
                <PersonalDataConsentField
                  id="hold-modal-pdn-consent"
                  inputRef={consentInputRef}
                  checked={pdnConsentAccepted}
                  onChange={(next) => {
                    setPdnConsentAccepted(next);
                    if (consentError) setConsentError(undefined);
                  }}
                  error={consentError}
                  compact
                  testIdPrefix="hold-pdn-consent"
                />
                {holdError && (
                  <p
                    role="alert"
                    data-testid="hold-modal-error"
                    className="text-xs text-[#DC2626] font-medium"
                  >
                    {holdError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={isSubmittingLead || rateLimitCountdownSec > 0}
                  className="w-full min-h-[44px] px-4 rounded-full bg-[#FF4820] disabled:opacity-65 text-white text-xs font-semibold cursor-pointer whitespace-normal"
                >
                  {isSubmittingLead
                    ? 'Проверка контакта…'
                    : rateLimitCountdownSec > 0
                      ? `Повторите через ${rateLimitCountdownSec} сек`
                      : `Зафиксировать квоты (${formatRubCompact(plan.totalClientCostRub)})`}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
