import { Clock, ShieldCheck } from 'lucide-react';
import { OrderCheckoutMode } from '../data/orderDraftStore';
import { AIRTIME_SALES_ENABLED } from '../data/platformFeatures';
import {
  CALLBACK_PREFERENCE_OPTIONS,
  ClientCallbackPreference,
  getCallbackPreferenceMeta,
  resolveStudioOperatingRegime,
  StudioOperatingRegimeStatus,
  StudioWorkScheduleConfig,
} from '../data/slaWorkCalendar';

interface OperatingRegimeBannerProps {
  nowMs?: number;
  workSchedule?: Partial<StudioWorkScheduleConfig> | null;
  mode?: OrderCheckoutMode;
  compact?: boolean;
}

function getStudioModeCopy(regime: StudioOperatingRegimeStatus): {
  badgeLabel: string;
  promiseTitle: string;
  promiseDetail: string;
  protectionNote: string;
} {
  switch (regime.regime) {
    case 'workday_prime':
      return {
        badgeLabel: 'Дневная смена студии открыта',
        promiseTitle: `Прямая связь с продюсером и смета проекта за ${regime.targetSlaMinutes} минут`,
        promiseDetail:
          'Сценаристы, кастинг-директор и звукорежиссёры на смене: оперативно разберём задачу, предложим голоса и сформируем счёт в ЭДО.',
        protectionNote:
          'Стоимость выбранного пакета и слот записи в студийном графике закрепляются сразу после отправки заявки.',
      };
    case 'evening_duty':
      return {
        badgeLabel: 'Вечерний дежурный продюсер на связи',
        promiseTitle: `Дежурный продюсер ответит до ${regime.targetSlaMinutes} мин · старт записи с утра`,
        promiseDetail:
          'Примем голосовой или текстовый бриф, проверим хронометраж по ФЗ-38 и подготовим счёт для ЭДО уже сегодня вечером.',
        protectionNote: `Сценарий уходит в приоритетную утреннюю смену (${regime.nextTrafficOpenFormatted}) без ночных звонков.`,
      };
    case 'weekend_duty':
      return {
        badgeLabel: 'Субботняя дежурная смена студии',
        promiseTitle: `Дежурный продюсер на связи (до ${regime.targetSlaMinutes} мин) · фиксация цены`,
        promiseDetail:
          'Разберём задачу на ролик, подготовим варианты сценария и счёт-спецификацию в выходной день без потери темпа.',
        protectionNote: `Финальная студийная запись с дикторами стартует первым приоритетом (${regime.nextTrafficOpenFormatted}).`,
      };
    case 'holiday_or_sunday_freeze':
      return {
        badgeLabel: regime.isHoliday
          ? 'Праздничный приём заявок · Без лишних звонков'
          : 'Выходной приём заявок · Без лишних звонков',
        promiseTitle:
          'Фиксируем стоимость пакета сейчас — свяжемся в первый час открытия студии',
        promiseDetail: `Студийная смена откроется ${regime.nextTrafficOpenFormatted}. Ваша задача встаёт первой в очередь сценаристов и кастинга.`,
        protectionNote:
          'Предварительную счёт-оферту и спецификацию для бухгалтерии (ЭДО) можно забрать сразу на экране подтверждения.',
      };
    case 'night_freeze':
      return {
        badgeLabel: 'Ночной сейф-режим · Без ночных звонков',
        promiseTitle: `Принимаем бриф 24/7 — продюсер свяжется утром (${regime.nextTrafficOpenFormatted})`,
        promiseDetail:
          'Мы не беспокоим клиентов ночью: ваш голосовой или текстовый бриф сразу попадает в утренний план сценаристов.',
        protectionNote:
          'Стоимость пакета фиксируется в момент отправки, а счёт для ЭДО доступен на экране сразу после оформления.',
      };
  }
}

function getStudioCallbackDescription(pref: ClientCallbackPreference): string {
  switch (pref) {
    case 'call_15m':
      return 'В рабочие часы продюсер свяжется за 15 минут; ночью и в праздники — первым приоритетом сразу после открытия смены.';
    case 'async_no_call':
      return 'Не беспокоим звонками: разберём бриф и пришлём концепции сценария, кастинг голосов и счёт для ЭДО письменно.';
    case 'morning_0930':
      return 'Примем задачу сейчас, а продюсер позвонит строго в утренний интервал 09:30–11:00 (UTC+3) с готовыми идеями.';
    case 'day_1300':
      return 'Удобно после утренних планёрок: подготовим расчёт хронометража и свяжемся в дневном окне 13:00–15:00 (UTC+3).';
    case 'evening_1730':
      return 'Свяжемся ближе к завершению рабочего дня (17:30–19:30 UTC+3) с готовым предложением по сценарию и голосам.';
  }
}

export function OperatingRegimeBanner({
  nowMs,
  workSchedule,
  mode = AIRTIME_SALES_ENABLED ? 'air_plus_production' : 'production_only',
  compact = false,
}: OperatingRegimeBannerProps) {
  const regime = resolveStudioOperatingRegime(nowMs ?? Date.now(), workSchedule);
  const isAirMode = AIRTIME_SALES_ENABLED && mode === 'air_plus_production';
  const studioCopy = getStudioModeCopy(regime);

  const badgeLabel = isAirMode ? regime.regimeBadgeLabel : studioCopy.badgeLabel;
  const promiseTitle = isAirMode ? regime.clientPromiseTitle : studioCopy.promiseTitle;
  const promiseDetail = isAirMode ? regime.clientPromiseDetail : studioCopy.promiseDetail;
  const protectionNote = isAirMode ? regime.holdProtectionNote : studioCopy.protectionNote;

  const statusAccentClass = regime.isTrafficDeskOpen
    ? 'text-[#16A34A] dark:text-[#4ADE80]'
    : regime.isDutyProducerOnline
      ? 'text-[#D97706] dark:text-[#FBBF24]'
      : 'text-[#FF4820]';

  if (compact) {
    return (
      <div
        data-testid="operating-regime-banner"
        className="rounded-2xl p-3.5 bg-[#EFECE5] dark:bg-[#16161B] border border-[#111111]/10 dark:border-white/10 space-y-1.5 text-xs tabular-nums"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`font-bold ${statusAccentClass}`}>{badgeLabel}</span>
          <span className="text-[#111111]/58 dark:text-[#F4F3EF]/58">
            {regime.studioClockFormatted}
          </span>
        </div>
        <p className="text-[#111111]/78 dark:text-[#F4F3EF]/78 leading-relaxed">
          {promiseTitle}. {protectionNote}
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="operating-regime-banner"
      className="rounded-2xl p-4 sm:p-5 bg-[#EFECE5]/85 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 space-y-2 tabular-nums"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="inline-flex flex-wrap items-center gap-2 font-semibold">
          <Clock className="w-3.5 h-3.5 text-[#FF4820] shrink-0" aria-hidden="true" />
          <span className={statusAccentClass}>{badgeLabel}</span>
          <span aria-hidden="true" className="opacity-35">
            ·
          </span>
          <span className="text-[#111111]/64 dark:text-[#F4F3EF]/64">
            {regime.studioClockFormatted}
          </span>
        </div>

        <span className="inline-flex items-center gap-1.5 font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72">
          <ShieldCheck className="w-3.5 h-3.5 text-[#FF4820] shrink-0" aria-hidden="true" />
          <span>
            {isAirMode
              ? 'Защита цены в ночи, выходные и праздники'
              : 'Фиксация сметы и счёта ЭДО 24/7'}
          </span>
        </span>
      </div>

      <p className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
        {promiseTitle}
      </p>
      <p className="text-xs sm:text-[13px] text-[#111111]/74 dark:text-[#F4F3EF]/74 leading-relaxed">
        {promiseDetail} {protectionNote}
      </p>
    </div>
  );
}

interface CallbackPreferenceSelectorProps {
  value: ClientCallbackPreference;
  onChange: (next: ClientCallbackPreference) => void;
  mode?: OrderCheckoutMode;
  compact?: boolean;
  nowMs?: number;
  workSchedule?: Partial<StudioWorkScheduleConfig> | null;
}

export function CallbackPreferenceSelector({
  value,
  onChange,
  mode = AIRTIME_SALES_ENABLED ? 'air_plus_production' : 'production_only',
  compact = false,
  nowMs,
  workSchedule,
}: CallbackPreferenceSelectorProps) {
  const activeMeta = getCallbackPreferenceMeta(value);
  const isAirMode = AIRTIME_SALES_ENABLED && mode === 'air_plus_production';
  const regime = resolveStudioOperatingRegime(nowMs ?? Date.now(), workSchedule);
  const studioCopy = getStudioModeCopy(regime);

  return (
    <div
      data-testid="callback-preference-selector"
      className="space-y-2.5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-[#111111]/68 dark:text-[#F4F3EF]/68">
          {isAirMode
            ? 'Как и когда вам удобнее получить расчёт и счёт:'
            : 'Как и когда вам удобнее обсудить сценарий и получить счёт:'}
        </p>
        <span className="text-[11px] text-[#111111]/58 dark:text-[#F4F3EF]/58 tabular-nums">
          {isAirMode
            ? 'Часовой пояс интервалов: UTC+3'
            : `${studioCopy.badgeLabel} · ${regime.studioClockFormatted} (UTC+3)`}
        </span>
      </div>

      <div
        role="group"
        aria-label="Способ связи и удобное окно ответа продюсера"
        className="flex flex-wrap gap-2"
      >
        {CALLBACK_PREFERENCE_OPTIONS.map((opt) => {
          const isSelected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={isSelected}
              data-testid={`callback-pref-${opt.id}`}
              onClick={() => onChange(opt.id)}
              className={`min-h-[38px] ${
                compact ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-xs sm:text-[13px]'
              } rounded-xl font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 border ${
                isSelected
                  ? 'bg-[#111111] text-[#F7F6F2] border-[#111111] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:border-[#F4F3EF]'
                  : 'bg-transparent border-[#111111]/15 dark:border-[#F4F3EF]/15 text-[#111111]/78 dark:text-[#F4F3EF]/78 hover:border-[#FF4820]'
              }`}
            >
              {opt.shortLabel}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-[#111111]/66 dark:text-[#F4F3EF]/66 leading-relaxed">
        {isAirMode ? activeMeta.description : getStudioCallbackDescription(value)}
      </p>
    </div>
  );
}
