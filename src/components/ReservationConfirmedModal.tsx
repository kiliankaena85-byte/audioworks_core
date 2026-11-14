import { CheckCircle2, Clock, Copy, Download, PhoneCall, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import {
  buildClientNextStepsTimeline,
  computeRemainingHoldSeconds,
  ConfirmedReservationSummary,
} from '../data/orderDraftStore';
import { AIRTIME_SALES_ENABLED } from '../data/platformFeatures';
import {
  formatBookingSpecificationText,
  formatHoldCountdown,
  formatNumberSpaced,
  formatRubCompact,
} from '../data/radioInventory';
import { ClientSlaAndRescuePanel } from './ClientSlaAndRescuePanel';

interface ReservationConfirmedModalProps {
  isOpen: boolean;
  confirmed: ConfirmedReservationSummary | null;
  onClose: () => void;
  onNavigateHotAir?: () => void;
}

export function ReservationConfirmedModal({
  isOpen,
  confirmed,
  onClose,
  onNavigateHotAir,
}: ReservationConfirmedModalProps) {
  const [copiedSpec, setCopiedSpec] = useState(false);
  const [holdRemainingSec, setHoldRemainingSec] = useState<number>(() =>
    computeRemainingHoldSeconds(confirmed?.holdExpiresAtMs ?? null)
  );

  useEffect(() => {
    if (!isOpen || !confirmed) return;
    setCopiedSpec(false);
    setHoldRemainingSec(computeRemainingHoldSeconds(confirmed.holdExpiresAtMs));
    const timerId = window.setInterval(() => {
      setHoldRemainingSec(computeRemainingHoldSeconds(confirmed.holdExpiresAtMs));
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [isOpen, confirmed]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!confirmed) return null;

  const isAirBooking =
    AIRTIME_SALES_ENABLED &&
    confirmed.checkoutMode === 'air_plus_production' &&
    confirmed.lockedMediaReservation !== null &&
    confirmed.lockedTotals !== null;

  const stationsCount = confirmed.lockedMediaReservation?.stations.length ?? 0;
  const isNegotiable =
    confirmed.selectedFormatId === 'custom_consult' || confirmed.selectedBudgetRub === 0;
  const timelineSteps = buildClientNextStepsTimeline(
    isAirBooking ? 'air_plus_production' : 'production_only',
    stationsCount,
    {
      callbackPreference: confirmed.callbackPreference,
      paymentChannel: confirmed.paymentChannel,
      isNegotiable,
    }
  );

  const handleCopyBookingSpec = async () => {
    if (!confirmed.lockedMediaReservation || !confirmed.lockedTotals) return;
    const specText = formatBookingSpecificationText({
      orderNumber: confirmed.orderNumber,
      payload: confirmed.lockedMediaReservation,
      totals: confirmed.lockedTotals,
      contact: confirmed.contactLine,
      companyRequisites: confirmed.companyLine,
      briefText: confirmed.briefNote,
      hasVoice: confirmed.hasVoice,
      voiceSec: confirmed.voiceSec,
      requisitesFileName: confirmed.fileName,
    });
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(specText);
      }
      setCopiedSpec(true);
      window.setTimeout(() => setCopiedSpec(false), 2400);
    } catch {
      setCopiedSpec(true);
      window.setTimeout(() => setCopiedSpec(false), 2400);
    }
  };

  const handleDownloadBookingSpec = () => {
    if (!confirmed.lockedMediaReservation || !confirmed.lockedTotals) return;
    const specText = formatBookingSpecificationText({
      orderNumber: confirmed.orderNumber,
      payload: confirmed.lockedMediaReservation,
      totals: confirmed.lockedTotals,
      contact: confirmed.contactLine,
      companyRequisites: confirmed.companyLine,
      briefText: confirmed.briefNote,
      hasVoice: confirmed.hasVoice,
      voiceSec: confirmed.voiceSec,
      requisitesFileName: confirmed.fileName,
    });
    const blob = new Blob([specText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FMWorks-${confirmed.orderNumber}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-[#111111]/65 dark:bg-black/80 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reservation-confirmed-modal-title"
          data-testid="reservation-confirmed-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-3xl my-auto rounded-3xl bg-[#F7F6F2] dark:bg-[#121217] text-[#111111] dark:text-[#F4F3EF] border border-[#111111]/12 dark:border-white/14 p-5 sm:p-8 lg:p-10 space-y-6 max-h-[92vh] overflow-y-auto subtle-scrollbar shadow-2xl"
          >
            {/* Шапка диалогового окна подтверждения */}
            <div className="flex items-start justify-between gap-4 pb-5 border-b border-[#111111]/10 dark:border-white/10">
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#FF4820] text-white flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold tabular-nums">
                    <span className="text-[#FF4820]">
                      {isAirBooking
                        ? `Приоритетная бронь #${confirmed.orderNumber} отправлена`
                        : `Заказ #${confirmed.orderNumber} принят в работу`}
                    </span>
                    <span aria-hidden="true" className="opacity-40">
                      ·
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-400">
                      {confirmed.promisedWindowLabel ?? 'Ответ продюсера за 15–20 мин'}
                    </span>
                  </div>
                  <h2
                    id="reservation-confirmed-modal-title"
                    className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight leading-snug editorial-balance"
                  >
                    {isAirBooking
                      ? 'Заявка принята! Квоты поставлены на 4-часовой резерв'
                      : isNegotiable
                        ? 'Заявка принята! Продюсер изучает задачу для оценки и договора'
                        : confirmed.paymentChannel === 'card_online'
                          ? 'Заявка принята! Проверяем контрагента и готовим ссылку на оплату'
                          : 'Заявка принята! Проверяем реквизиты и готовим рамочный договор'}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#111111]/72 dark:text-[#F4F3EF]/72 tabular-nums">
                    Контакт для связи:{' '}
                    <strong className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                      {confirmed.contactLine}
                    </strong>
                    {confirmed.companyLine ? ` · ${confirmed.companyLine}` : ''}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть окно подтверждения брони"
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#111111]/8 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Живая плашка 4-часового резерва и времени ответа */}
            {isAirBooking && (
              <div className="rounded-2xl bg-[#111114] text-[#F4F3EF] px-4 py-3.5 sm:px-5 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm tabular-nums">
                <div className="flex items-center gap-2 font-semibold text-[#FFB36B]">
                  <Clock className="w-4 h-4 text-[#FF4820] shrink-0" aria-hidden="true" />
                  <span>
                    Фиксация цены и слотов: {formatHoldCountdown(holdRemainingSec)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-white/78">
                  <PhoneCall className="w-3.5 h-3.5 text-[#FF4820] shrink-0" aria-hidden="true" />
                  <span>Свяжемся в выбранное окно · Договор и счёт ЭДО</span>
                </div>
              </div>
            )}

            {/* Живой пульт SLA, автономного счёта ЭДО и защиты клиента при задержке */}
            <ClientSlaAndRescuePanel confirmed={confirmed} />

            {/* ГЛАВНЫЙ БЛОК: ЧТО ПРОИСХОДИТ ДАЛЬШЕ (3 ПОШАГОВЫХ ЭТАПА ДЛЯ КЛИЕНТА) */}
            <div
              data-testid="confirmed-next-steps-timeline"
              className="space-y-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm sm:text-base font-bold text-[#111111] dark:text-[#F4F3EF]">
                  Что происходит дальше (пошаговый маршрут)
                </h3>
                <span className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58">
                  Вам ничего дополнительно заполнять не нужно
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {timelineSteps.map((step) => (
                  <div
                    key={step.stepNumber}
                    data-testid={`confirmed-step-${step.stepNumber}`}
                    className="rounded-2xl p-4 bg-[#EFECE5] dark:bg-[#1A1A22] border border-[#111111]/10 dark:border-white/10 flex flex-col justify-between gap-2.5"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs font-semibold tabular-nums">
                        <span className="text-[#FF4820]">Шаг {step.stepNumber}</span>
                        <span className="text-[#111111]/62 dark:text-[#F4F3EF]/62">
                          {step.timingLabel}
                        </span>
                      </div>
                      <p className="text-sm font-bold leading-snug text-[#111111] dark:text-[#F4F3EF]">
                        {step.title}
                      </p>
                    </div>
                    <p className="text-xs leading-relaxed text-[#111111]/74 dark:text-[#F4F3EF]/74">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Сводка забронированных станций и бюджета */}
            {isAirBooking &&
              confirmed.lockedMediaReservation &&
              confirmed.lockedTotals && (
                <div className="rounded-2xl p-4 sm:p-5 bg-[#FFFFFF] dark:bg-[#17171F] border border-[#111111]/10 dark:border-white/10 space-y-3 tabular-nums">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#111111]/10 dark:border-white/10 text-xs sm:text-sm">
                    <span className="font-bold text-[#111111] dark:text-[#F4F3EF]">
                      Зарезервированные радиостанции ({confirmed.lockedMediaReservation.stations.length})
                    </span>
                    <span className="font-semibold text-[#FF4820]">
                      {confirmed.lockedMediaReservation.totalSpots} выходов ·{' '}
                      {formatNumberSpaced(confirmed.lockedMediaReservation.totalReachOTS)} OTS
                    </span>
                  </div>

                  <div className="divide-y divide-[#111111]/8 dark:divide-white/8 text-xs sm:text-sm max-h-44 overflow-y-auto subtle-scrollbar pr-1">
                    {confirmed.lockedMediaReservation.stations.map((st) => (
                      <div
                        key={st.slotId}
                        className="py-2 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                            {st.station}
                          </span>
                          <span className="text-[#111111]/60 dark:text-[#F4F3EF]/60">
                            {' '}
                            · {st.daypart || st.frequencyFm} · {st.spotsIncluded} вых.
                            {st.exactDurationSec ? ` · ${st.exactDurationSec} сек` : ''}
                          </span>
                        </div>
                        <span className="font-bold shrink-0">
                          {formatRubCompact(st.hotPrice)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2.5 border-t border-[#111111]/10 dark:border-white/10 flex flex-wrap items-baseline justify-between gap-3">
                    <div className="text-xs text-[#111111]/68 dark:text-[#F4F3EF]/68">
                      <span>Статус ролика: </span>
                      <strong className="text-[#111111] dark:text-[#F4F3EF]">
                        {confirmed.lockedTotals.spotStatusLabel}
                      </strong>
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold ml-2">
                        (выгода +{formatRubCompact(confirmed.lockedTotals.totalSavingsRub)})
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60 mr-2">
                        Итого по единому счёту в ЭДО:
                      </span>
                      <span className="text-lg sm:text-xl font-bold text-[#111111] dark:text-[#F4F3EF]">
                        {formatRubCompact(confirmed.lockedTotals.unifiedTotalRub)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

            {/* Кнопки действий в модальном окне (без обрезки текста) */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                {isAirBooking && (
                  <>
                    <button
                      type="button"
                      data-testid="modal-copy-booking-spec-btn"
                      onClick={handleCopyBookingSpec}
                      className="min-h-[42px] px-4 py-2 rounded-full border border-[#111111]/18 dark:border-white/18 hover:border-[#FF4820] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer text-center leading-snug"
                    >
                      <Copy className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>
                        {copiedSpec
                          ? 'Спецификация скопирована'
                          : 'Скопировать спецификацию'}
                      </span>
                    </button>

                    <button
                      type="button"
                      data-testid="modal-download-booking-spec-btn"
                      onClick={handleDownloadBookingSpec}
                      className="min-h-[42px] px-4 py-2 rounded-full border border-[#111111]/18 dark:border-white/18 hover:border-[#FF4820] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer text-center leading-snug"
                    >
                      <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>Скачать ведомость (.txt)</span>
                    </button>
                  </>
                )}

                {AIRTIME_SALES_ENABLED && onNavigateHotAir && (
                  <button
                    type="button"
                    data-testid="modal-return-hot-air-btn"
                    onClick={() => {
                      onClose();
                      onNavigateHotAir();
                    }}
                    className="min-h-[42px] px-4 py-2 rounded-full border border-[#111111]/14 dark:border-white/14 hover:border-[#111111]/40 text-xs sm:text-sm font-medium transition-colors cursor-pointer text-center leading-snug"
                  >
                    К медиапланеру эфира
                  </button>
                )}
              </div>

              <button
                type="button"
                data-testid="close-confirmed-modal-btn"
                onClick={onClose}
                className="min-h-[46px] px-6 py-2.5 rounded-full bg-[#FF4820] hover:bg-[#E63C17] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center transition-colors cursor-pointer text-center leading-snug shrink-0"
              >
                {confirmed.callbackPreference === 'async_no_call'
                  ? 'Понятно, жду письменный расчёт'
                  : 'Понятно, статус заявки открыт'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
