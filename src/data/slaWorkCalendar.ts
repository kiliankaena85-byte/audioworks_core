/**
 * Календарно-сменный движок SLA, рабочего времени трафик-служб радиостанций,
 * ночной/праздничной заморозки 4-часового холда и протокола защиты клиента при опоздании звонка.
 *
 * Важно для продакшн-запуска (`node server.ts` в Node 22 ESM):
 * модуль не имеет внешних runtime-импортов и использует чистую UTC-арифметику
 * относительно часового пояса студии (по умолчанию UTC+3), поэтому работает
 * одинаково на сервере в любом облачном регионе и в браузере клиента.
 */

export type StudioOperatingRegimeId =
  | 'workday_prime'
  | 'evening_duty'
  | 'weekend_duty'
  | 'night_freeze'
  | 'holiday_or_sunday_freeze';

export type ClientCallbackPreference =
  | 'call_15m'
  | 'async_no_call'
  | 'morning_0930'
  | 'day_1300'
  | 'evening_1730';

export interface CallbackPreferenceOption {
  id: ClientCallbackPreference;
  shortLabel: string;
  fullLabel: string;
  description: string;
}

export const CALLBACK_PREFERENCE_OPTIONS: readonly CallbackPreferenceOption[] = [
  {
    id: 'call_15m',
    shortLabel: 'Звонок за 15 мин',
    fullLabel: 'Оперативный звонок продюсера (15 мин в рабочее окно)',
    description:
      'В рабочие часы свяжемся за 15 минут; ночью и в праздники — первыми в очереди сразу после открытия смен.',
  },
  {
    id: 'async_no_call',
    shortLabel: 'Без звонка (счёт письменно)',
    fullLabel: 'Без звонка — прислать расписание и счёт в мессенджер / ЭДО',
    description:
      'Не беспокоим звонками: проверим сетку на станциях и отправим готовый медиаплан и счёт-спецификацию письменно.',
  },
  {
    id: 'morning_0930',
    shortLabel: 'Утро 09:30–11:00',
    fullLabel: 'Ко времени: утреннее окно 09:30–11:00 (UTC+3)',
    description:
      'Зафиксируем квоту сейчас, а продюсер позвонит строго в утренний слот рабочего дня.',
  },
  {
    id: 'day_1300',
    shortLabel: 'День 13:00–15:00',
    fullLabel: 'Ко времени: дневное окно 13:00–15:00 (UTC+3)',
    description:
      'Удобно после утренних планёрок: слоты уже под защитой, звонок в дневном интервале.',
  },
  {
    id: 'evening_1730',
    shortLabel: 'Вечер 17:30–19:30',
    fullLabel: 'Ко времени: вечернее окно 17:30–19:30 (UTC+3)',
    description:
      'Свяжемся ближе к завершению рабочего дня с уже проверенной эфирной ведомостью.',
  },
] as const;

export function getCallbackPreferenceMeta(
  pref: ClientCallbackPreference | undefined | null
): CallbackPreferenceOption {
  return (
    CALLBACK_PREFERENCE_OPTIONS.find((item) => item.id === pref) ??
    CALLBACK_PREFERENCE_OPTIONS[0]
  );
}

export interface StudioWorkScheduleConfig {
  /** Смещение часового пояса студии относительно UTC в минутах (180 = UTC+3) */
  utcOffsetMinutes: number;
  /** Открытие дневного окна трафик-служб радиостанций Пн–Пт (в минутах от 00:00, 570 = 09:30) */
  weekdayOpenMinute: number;
  /** Закрытие дневного окна трафик-служб радиостанций Пн–Пт (1170 = 19:30) */
  weekdayCloseMinute: number;
  /** Окончание смены вечернего дежурного продюсера Пн–Пт (1320 = 22:00) */
  eveningDutyCloseMinute: number;
  /** Начало субботней дежурной смены продюсера (660 = 11:00) */
  saturdayDutyOpenMinute: number;
  /** Окончание субботней дежурной смены продюсера (1020 = 17:00) */
  saturdayDutyCloseMinute: number;
  /** Целевой SLA первого контакта в дневное рабочее окно (мин) */
  daytimeSlaMinutes: number;
  /** Целевой SLA ответа дежурного продюсера вечером и в субботу (мин) */
  dutySlaMinutes: number;
  /** Длительность гарантированного рабочего резерва эфирных квот (часов открытого трафика) */
  holdWorkingHours: number;
  /** Дополнительные нерабочие праздничные и перенесённые даты в формате YYYY-MM-DD */
  extraHolidayDates: string[];
  /** Перенесённые рабочие субботы/воскресенья по производственному календарю (YYYY-MM-DD) */
  workingWeekendOverrides: string[];
}

/**
 * Ежегодные нерабочие праздничные даты РФ (формат MM-DD), в которые трафик-службы
 * федеральных радиостанций закрыты и резерв автоматически замораживается.
 */
export const OFFICIAL_RECURRING_MMDD_HOLIDAYS: ReadonlySet<string> = new Set([
  '01-01',
  '01-02',
  '01-03',
  '01-04',
  '01-05',
  '01-06',
  '01-07',
  '01-08',
  '02-23',
  '03-08',
  '05-01',
  '05-09',
  '06-12',
  '11-04',
]);

export const SLA_BREACH_COMPENSATION_NOTE =
  'Гарантия при задержке ответа SLA: приоритетное окно продакшна и выпуск 3 концепций сценария за 12ч сразу после поступления предоплаты';

export const DEFAULT_STUDIO_WORK_SCHEDULE: StudioWorkScheduleConfig = {
  utcOffsetMinutes: 180,
  weekdayOpenMinute: 9 * 60 + 30, // 09:30
  weekdayCloseMinute: 19 * 60 + 30, // 19:30
  eveningDutyCloseMinute: 22 * 60, // 22:00
  saturdayDutyOpenMinute: 11 * 60, // 11:00
  saturdayDutyCloseMinute: 17 * 60, // 17:00
  daytimeSlaMinutes: 15,
  dutySlaMinutes: 30,
  holdWorkingHours: 4,
  extraHolidayDates: [
    '2026-01-09',
    '2026-05-04',
    '2026-05-11',
    '2026-12-31',
  ],
  workingWeekendOverrides: [],
};

export function sanitizeWorkScheduleConfig(
  raw?: Partial<StudioWorkScheduleConfig> | null
): StudioWorkScheduleConfig {
  const base = DEFAULT_STUDIO_WORK_SCHEDULE;
  if (!raw || typeof raw !== 'object') {
    return {
      ...base,
      extraHolidayDates: [...base.extraHolidayDates],
      workingWeekendOverrides: [...base.workingWeekendOverrides],
    };
  }

  const clampInt = (val: unknown, min: number, max: number, fallback: number): number =>
    typeof val === 'number' && Number.isFinite(val)
      ? Math.max(min, Math.min(max, Math.round(val)))
      : fallback;

  const sanitizeDateList = (val: unknown, fallback: readonly string[]): string[] => {
    if (!Array.isArray(val)) return [...fallback];
    const valid = val
      .filter((item): item is string => typeof item === 'string')
      .map((s) => s.trim())
      .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
    return Array.from(new Set(valid)).slice(0, 60);
  };

  const weekdayOpenMinute = clampInt(raw.weekdayOpenMinute, 360, 780, base.weekdayOpenMinute);
  const weekdayCloseMinute = clampInt(
    raw.weekdayCloseMinute,
    weekdayOpenMinute + 120,
    1320,
    base.weekdayCloseMinute
  );
  const eveningDutyCloseMinute = clampInt(
    raw.eveningDutyCloseMinute,
    weekdayCloseMinute,
    1439,
    base.eveningDutyCloseMinute
  );

  return {
    utcOffsetMinutes: clampInt(raw.utcOffsetMinutes, -720, 840, base.utcOffsetMinutes),
    weekdayOpenMinute,
    weekdayCloseMinute,
    eveningDutyCloseMinute,
    saturdayDutyOpenMinute: clampInt(
      raw.saturdayDutyOpenMinute,
      420,
      900,
      base.saturdayDutyOpenMinute
    ),
    saturdayDutyCloseMinute: clampInt(
      raw.saturdayDutyCloseMinute,
      901,
      1320,
      base.saturdayDutyCloseMinute
    ),
    daytimeSlaMinutes: clampInt(raw.daytimeSlaMinutes, 5, 90, base.daytimeSlaMinutes),
    dutySlaMinutes: clampInt(raw.dutySlaMinutes, 10, 120, base.dutySlaMinutes),
    holdWorkingHours: clampInt(raw.holdWorkingHours, 2, 24, base.holdWorkingHours),
    extraHolidayDates: sanitizeDateList(raw.extraHolidayDates, base.extraHolidayDates),
    workingWeekendOverrides: sanitizeDateList(
      raw.workingWeekendOverrides,
      base.workingWeekendOverrides
    ),
  };
}

interface StudioWallClockParts {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
  dayOfWeek: number; // 0 = Sun, 1 = Mon .. 6 = Sat
  minuteOfDay: number; // 0..1439
  secondOfMinute: number;
  dateKey: string; // YYYY-MM-DD
  mmddKey: string; // MM-DD
}

function toStudioWallClock(
  epochMs: number,
  utcOffsetMinutes: number
): StudioWallClockParts {
  const shifted = new Date(epochMs + utcOffsetMinutes * 60_000);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  const day = shifted.getUTCDate();
  const dayOfWeek = shifted.getUTCDay();
  const minuteOfDay = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  const secondOfMinute = shifted.getUTCSeconds();
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return {
    year,
    month,
    day,
    dayOfWeek,
    minuteOfDay,
    secondOfMinute,
    dateKey: `${year}-${mm}-${dd}`,
    mmddKey: `${mm}-${dd}`,
  };
}

function fromStudioWallClockToEpochMs(
  year: number,
  month: number,
  day: number,
  minuteOfDay: number,
  utcOffsetMinutes: number
): number {
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  return (
    Date.UTC(year, month - 1, day, hours, minutes, 0, 0) -
    utcOffsetMinutes * 60_000
  );
}

export function formatMinuteOfDay(minuteOfDay: number): string {
  const clamped = Math.max(0, Math.min(1439, Math.floor(minuteOfDay)));
  const hh = String(Math.floor(clamped / 60)).padStart(2, '0');
  const mm = String(clamped % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

const SHORT_WEEKDAY_RU: readonly string[] = [
  'Вс',
  'Пн',
  'Вт',
  'Ср',
  'Чт',
  'Пт',
  'Сб',
];

const GENITIVE_MONTH_RU: readonly string[] = [
  '',
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

export function formatStudioTimestampHuman(
  epochMs: number,
  config: StudioWorkScheduleConfig = DEFAULT_STUDIO_WORK_SCHEDULE
): string {
  const parts = toStudioWallClock(epochMs, config.utcOffsetMinutes);
  const wd = SHORT_WEEKDAY_RU[parts.dayOfWeek] ?? '';
  const monthName = GENITIVE_MONTH_RU[parts.month] ?? '';
  return `${wd}, ${parts.day} ${monthName} в ${formatMinuteOfDay(parts.minuteOfDay)} (UTC+3)`;
}

export function isOfficialOrCustomHolidayDate(
  dateKey: string,
  config: StudioWorkScheduleConfig = DEFAULT_STUDIO_WORK_SCHEDULE
): boolean {
  if (config.workingWeekendOverrides.includes(dateKey)) {
    return false;
  }
  const mmdd = dateKey.slice(5);
  if (OFFICIAL_RECURRING_MMDD_HOLIDAYS.has(mmdd)) {
    return true;
  }
  return config.extraHolidayDates.includes(dateKey);
}

export function isTrafficDeskWorkingDate(
  parts: Pick<StudioWallClockParts, 'dateKey' | 'dayOfWeek'>,
  config: StudioWorkScheduleConfig = DEFAULT_STUDIO_WORK_SCHEDULE
): boolean {
  if (config.workingWeekendOverrides.includes(parts.dateKey)) {
    return true;
  }
  if (isOfficialOrCustomHolidayDate(parts.dateKey, config)) {
    return false;
  }
  return parts.dayOfWeek >= 1 && parts.dayOfWeek <= 5;
}

export function findNextTrafficDeskOpenMs(
  fromMs: number,
  config: StudioWorkScheduleConfig = DEFAULT_STUDIO_WORK_SCHEDULE
): number {
  const nowParts = toStudioWallClock(fromMs, config.utcOffsetMinutes);
  if (
    isTrafficDeskWorkingDate(nowParts, config) &&
    nowParts.minuteOfDay < config.weekdayOpenMinute
  ) {
    return fromStudioWallClockToEpochMs(
      nowParts.year,
      nowParts.month,
      nowParts.day,
      config.weekdayOpenMinute,
      config.utcOffsetMinutes
    );
  }

  for (let offsetDays = 1; offsetDays <= 25; offsetDays += 1) {
    const probeMs = fromStudioWallClockToEpochMs(
      nowParts.year,
      nowParts.month,
      nowParts.day + offsetDays,
      config.weekdayOpenMinute,
      config.utcOffsetMinutes
    );
    const probeParts = toStudioWallClock(probeMs, config.utcOffsetMinutes);
    if (isTrafficDeskWorkingDate(probeParts, config)) {
      return probeMs;
    }
  }

  return fromMs + 24 * 3600_000;
}

export interface StudioOperatingRegimeStatus {
  regime: StudioOperatingRegimeId;
  studioClockFormatted: string;
  studioDateKey: string;
  isTrafficDeskOpen: boolean;
  isDutyProducerOnline: boolean;
  isHoliday: boolean;
  regimeBadgeLabel: string;
  clientPromiseTitle: string;
  clientPromiseDetail: string;
  holdProtectionNote: string;
  targetSlaMinutes: number;
  nextTrafficOpenMs: number;
  nextTrafficOpenFormatted: string;
}

export function resolveStudioOperatingRegime(
  nowMs = Date.now(),
  rawConfig?: Partial<StudioWorkScheduleConfig> | null
): StudioOperatingRegimeStatus {
  const config = sanitizeWorkScheduleConfig(rawConfig);
  const parts = toStudioWallClock(nowMs, config.utcOffsetMinutes);
  const clockStr = `${SHORT_WEEKDAY_RU[parts.dayOfWeek]}, ${formatMinuteOfDay(
    parts.minuteOfDay
  )} · время студии (UTC+3)`;

  const holiday = isOfficialOrCustomHolidayDate(parts.dateKey, config);
  const trafficDay = isTrafficDeskWorkingDate(parts, config);
  const nextTrafficOpenMs = findNextTrafficDeskOpenMs(nowMs, config);
  const nextTrafficOpenFormatted = formatStudioTimestampHuman(nextTrafficOpenMs, config);

  // 1. Рабочее дневное окно трафик-служб радиостанций (Пн–Пт 09:30–19:30 либо перенесённая рабочая суббота)
  if (
    trafficDay &&
    parts.minuteOfDay >= config.weekdayOpenMinute &&
    parts.minuteOfDay < config.weekdayCloseMinute
  ) {
    return {
      regime: 'workday_prime',
      studioClockFormatted: clockStr,
      studioDateKey: parts.dateKey,
      isTrafficDeskOpen: true,
      isDutyProducerOnline: true,
      isHoliday: false,
      regimeBadgeLabel: 'Трафик-службы радиостанций открыты',
      clientPromiseTitle: `Прямая сверка сетки и связь с продюсером за ${config.daytimeSlaMinutes} минут`,
      clientPromiseDetail: `Рабочее окно эфира (${formatMinuteOfDay(
        config.weekdayOpenMinute
      )}–${formatMinuteOfDay(
        config.weekdayCloseMinute
      )} UTC+3): трафик-менеджер сразу блокирует выбранные слоты на радиостанциях.`,
      holdProtectionNote:
        'Если до закрытия вечерней смены остаётся меньше 4 часов, остаток резерва автоматически переносится на следующее рабочее утро.',
      targetSlaMinutes: config.daytimeSlaMinutes,
      nextTrafficOpenMs: nowMs,
      nextTrafficOpenFormatted: 'Сейчас в прямом режиме',
    };
  }

  // 2. Вечернее дежурное окно сейлз-продюсера в будни (19:30–22:00)
  if (
    trafficDay &&
    parts.minuteOfDay >= config.weekdayCloseMinute &&
    parts.minuteOfDay < config.eveningDutyCloseMinute
  ) {
    return {
      regime: 'evening_duty',
      studioClockFormatted: clockStr,
      studioDateKey: parts.dateKey,
      isTrafficDeskOpen: false,
      isDutyProducerOnline: true,
      isHoliday: false,
      regimeBadgeLabel: 'Вечерний дежурный продюсер · Ночной сейф квоты',
      clientPromiseTitle: `Дежурный продюсер ответит до ${config.dutySlaMinutes} мин · холд заморожен до утра`,
      clientPromiseDetail: `Трафик-службы станций уже закрыты до ${formatMinuteOfDay(
        config.weekdayOpenMinute
      )}, но дежурный продюсер примет бриф и подготовит счёт в ЭДО уже сегодня вечером.`,
      holdProtectionNote: `4-часовой таймер квоты не сгорает ночью и продлён после открытия трафика (${nextTrafficOpenFormatted}).`,
      targetSlaMinutes: config.dutySlaMinutes,
      nextTrafficOpenMs,
      nextTrafficOpenFormatted,
    };
  }

  // 3. Субботняя дежурная смена (11:00–17:00, если не государственный праздник)
  if (
    !holiday &&
    parts.dayOfWeek === 6 &&
    parts.minuteOfDay >= config.saturdayDutyOpenMinute &&
    parts.minuteOfDay < config.saturdayDutyCloseMinute
  ) {
    return {
      regime: 'weekend_duty',
      studioClockFormatted: clockStr,
      studioDateKey: parts.dateKey,
      isTrafficDeskOpen: false,
      isDutyProducerOnline: true,
      isHoliday: false,
      regimeBadgeLabel: 'Субботняя смена студии · Защита квоты на выходные',
      clientPromiseTitle: `Дежурный продюсер на связи (до ${config.dutySlaMinutes} мин) · эфир защищён до рабочего дня`,
      clientPromiseDetail:
        'Примем задачу на ролик, проверим текст по ФЗ-38 и сформируем счёт-спецификацию сегодня, а сетку на станциях подтвердим в первый час открытия трафик-служб.',
      holdProtectionNote: `Скидка горящего эфира заморожена на все выходные до ${nextTrafficOpenFormatted} (+${config.holdWorkingHours}ч рабочего резерва).`,
      targetSlaMinutes: config.dutySlaMinutes,
      nextTrafficOpenMs,
      nextTrafficOpenFormatted,
    };
  }

  // 4. Государственный праздник или воскресенье
  if (holiday || parts.dayOfWeek === 0 || (parts.dayOfWeek === 6 && parts.minuteOfDay >= config.saturdayDutyCloseMinute)) {
    return {
      regime: 'holiday_or_sunday_freeze',
      studioClockFormatted: clockStr,
      studioDateKey: parts.dateKey,
      isTrafficDeskOpen: false,
      isDutyProducerOnline: false,
      isHoliday: holiday,
      regimeBadgeLabel: holiday
        ? 'Праздничный сейф-режим · Квота заморожена'
        : 'Выходной сейф-режим · Квота заморожена',
      clientPromiseTitle: holiday
        ? 'Праздничная защита цены: слоты заморожены, счёт в ЭДО доступен сразу'
        : 'Выходной режим без лишних звонков: цена зафиксирована до рабочего дня',
      clientPromiseDetail: `Трафик-службы радиостанций откроются ${nextTrafficOpenFormatted}. Ваша бронь встаёт первой в утреннюю очередь подтверждения без потери скидки.`,
      holdProtectionNote: `4-часовой таймер начнёт отсчёт только после открытия трафик-служб (${nextTrafficOpenFormatted}). Счёт-спецификацию можно скачать сразу на экране.`,
      targetSlaMinutes: config.daytimeSlaMinutes,
      nextTrafficOpenMs,
      nextTrafficOpenFormatted,
    };
  }

  // 5. Ночное окно (22:00–09:30 в будни или утро субботы до 11:00)
  return {
    regime: 'night_freeze',
    studioClockFormatted: clockStr,
    studioDateKey: parts.dateKey,
    isTrafficDeskOpen: false,
    isDutyProducerOnline: false,
    isHoliday: false,
    regimeBadgeLabel: 'Ночной сейф-режим · Без ночных звонков',
    clientPromiseTitle: `Ночная заморозка квоты: свяжемся в рабочее окно с ${formatMinuteOfDay(
      config.weekdayOpenMinute
    )} (UTC+3)`,
    clientPromiseDetail:
      'Мы не тревожим клиентов ночью и не даём ложных обещаний 15-минутного звонка в 3 часа ночи. Квота и скидка сохранены за вашей компанией до дневной смены.',
    holdProtectionNote: `Резерв заморожен на всю ночь: полные ${config.holdWorkingHours} рабочих часа действуют после открытия трафик-служб (${nextTrafficOpenFormatted}).`,
    targetSlaMinutes: config.daytimeSlaMinutes,
    nextTrafficOpenMs,
    nextTrafficOpenFormatted,
  };
}

/**
 * Рассчитывает честный дедлайн 4-часового холда квоты исключительно по открытому
 * рабочему времени трафик-служб радиостанций (`weekdayOpenMinute`..`weekdayCloseMinute`).
 *
 * Примеры:
 * - Среда 11:00 -> Среда 15:00 (ровно +4 рабочих часа).
 * - Пятница 18:30 (закрытие в 19:30) -> 1 час в пятницу + перенос 3 часов на понедельник 09:30 -> Понедельник 12:30.
 * - Ночь 02:40 вторника -> старт отсчёта в 09:30 вторника -> Вторник 13:30.
 * - 1 января (праздник) -> старт в первый рабочий день после каникул 09:30 + 4 часа = 13:30.
 */
export function computeSmartHoldExpirationMs(
  createdAtMs: number,
  rawConfig?: Partial<StudioWorkScheduleConfig> | null
): number {
  const config = sanitizeWorkScheduleConfig(rawConfig);
  let remainingHoldMs = config.holdWorkingHours * 3600_000;
  let cursorMs = createdAtMs;

  for (let dayStep = 0; dayStep < 32; dayStep += 1) {
    const parts = toStudioWallClock(cursorMs, config.utcOffsetMinutes);
    if (isTrafficDeskWorkingDate(parts, config)) {
      const windowStartMs = fromStudioWallClockToEpochMs(
        parts.year,
        parts.month,
        parts.day,
        config.weekdayOpenMinute,
        config.utcOffsetMinutes
      );
      const windowEndMs = fromStudioWallClockToEpochMs(
        parts.year,
        parts.month,
        parts.day,
        config.weekdayCloseMinute,
        config.utcOffsetMinutes
      );

      if (cursorMs < windowEndMs) {
        const effectiveStartMs = Math.max(cursorMs, windowStartMs);
        const availableTodayMs = Math.max(0, windowEndMs - effectiveStartMs);
        if (remainingHoldMs <= availableTodayMs) {
          return effectiveStartMs + remainingHoldMs;
        }
        remainingHoldMs -= availableTodayMs;
      }
    }

    // Переходим к 00:00 следующих календарных суток по часам студии
    cursorMs = fromStudioWallClockToEpochMs(
      parts.year,
      parts.month,
      parts.day + 1,
      0,
      config.utcOffsetMinutes
    );
  }

  return createdAtMs + config.holdWorkingHours * 3600_000;
}

/**
 * Продлевает существующий холд ещё на N рабочих часов трафик-служб (от максимума из `nowMs` и текущего `currentHoldExpiresMs`).
 */
export function extendHoldByWorkingHoursMs(
  currentHoldExpiresMs: number,
  nowMs: number,
  extraWorkingHours = 4,
  rawConfig?: Partial<StudioWorkScheduleConfig> | null
): number {
  const config = sanitizeWorkScheduleConfig(rawConfig);
  const anchorMs = Math.max(nowMs, Number.isFinite(currentHoldExpiresMs) ? currentHoldExpiresMs : nowMs);
  return computeSmartHoldExpirationMs(anchorMs, {
    ...config,
    holdWorkingHours: extraWorkingHours,
  });
}

export interface ComputedSlaWindow {
  /** Момент, когда начинается активное окно исполнения обещанного контакта */
  slaWindowStartMs: number;
  /** Жёсткий дедлайн первого контакта с клиентом (после него фиксируется опоздание SLA) */
  slaDeadlineMs: number;
  /** Человекочитаемое описание обещанного окна связи */
  promisedWindowLabel: string;
}

/**
 * Вычисляет старт окна связи и жёсткий дедлайн SLA с учётом:
 * - текущего времени суток, выходных и государственных праздников,
 * - выбранного самим клиентом способа коммуникации (`call_15m`, `async_no_call`, `morning_0930` и т.д.).
 */
export function computeSlaDeadlineWindow(
  createdAtMs: number,
  callbackPreference: ClientCallbackPreference = 'call_15m',
  rawConfig?: Partial<StudioWorkScheduleConfig> | null
): ComputedSlaWindow {
  const config = sanitizeWorkScheduleConfig(rawConfig);
  const parts = toStudioWallClock(createdAtMs, config.utcOffsetMinutes);
  const regimeInfo = resolveStudioOperatingRegime(createdAtMs, config);

  // Вспомогательный поиск ближайшего рабочего дня для слота ко времени
  const resolveScheduledSlotOnWorkday = (
    slotStartMin: number,
    slotEndMin: number,
    slotTitle: string
  ): ComputedSlaWindow => {
    const todayIsWorkday = isTrafficDeskWorkingDate(parts, config);
    if (todayIsWorkday && parts.minuteOfDay < slotEndMin - 20) {
      const startMs = Math.max(
        createdAtMs,
        fromStudioWallClockToEpochMs(
          parts.year,
          parts.month,
          parts.day,
          slotStartMin,
          config.utcOffsetMinutes
        )
      );
      const deadlineMs = fromStudioWallClockToEpochMs(
        parts.year,
        parts.month,
        parts.day,
        slotEndMin,
        config.utcOffsetMinutes
      );
      return {
        slaWindowStartMs: startMs,
        slaDeadlineMs: deadlineMs,
        promisedWindowLabel: `Сегодня ${slotTitle} (UTC+3)`,
      };
    }

    const nextOpenMs = findNextTrafficDeskOpenMs(
      fromStudioWallClockToEpochMs(
        parts.year,
        parts.month,
        parts.day + 1,
        0,
        config.utcOffsetMinutes
      ),
      config
    );
    const nextParts = toStudioWallClock(nextOpenMs, config.utcOffsetMinutes);
    const startMs = fromStudioWallClockToEpochMs(
      nextParts.year,
      nextParts.month,
      nextParts.day,
      slotStartMin,
      config.utcOffsetMinutes
    );
    const deadlineMs = fromStudioWallClockToEpochMs(
      nextParts.year,
      nextParts.month,
      nextParts.day,
      slotEndMin,
      config.utcOffsetMinutes
    );
    return {
      slaWindowStartMs: startMs,
      slaDeadlineMs: deadlineMs,
      promisedWindowLabel: `${SHORT_WEEKDAY_RU[nextParts.dayOfWeek]}, ${nextParts.day} ${
        GENITIVE_MONTH_RU[nextParts.month]
      } · ${slotTitle} (UTC+3)`,
    };
  };

  if (callbackPreference === 'morning_0930') {
    return resolveScheduledSlotOnWorkday(9 * 60 + 30, 11 * 60, '09:30–11:00');
  }
  if (callbackPreference === 'day_1300') {
    return resolveScheduledSlotOnWorkday(13 * 60, 15 * 60, '13:00–15:00');
  }
  if (callbackPreference === 'evening_1730') {
    return resolveScheduledSlotOnWorkday(17 * 60 + 30, 19 * 60 + 30, '17:30–19:30');
  }

  // Письменный режим без звонка или оперативный звонок 15 мин
  const isAsync = callbackPreference === 'async_no_call';

  if (regimeInfo.regime === 'workday_prime') {
    const minutesAllowance = isAsync
      ? Math.max(20, config.daytimeSlaMinutes + 5)
      : config.daytimeSlaMinutes;
    return {
      slaWindowStartMs: createdAtMs,
      slaDeadlineMs: createdAtMs + minutesAllowance * 60_000,
      promisedWindowLabel: isAsync
        ? `Письменно со счётом за ${minutesAllowance} мин`
        : `Звонок продюсера за ${minutesAllowance} мин`,
    };
  }

  if (regimeInfo.regime === 'evening_duty' || regimeInfo.regime === 'weekend_duty') {
    return {
      slaWindowStartMs: createdAtMs,
      slaDeadlineMs: createdAtMs + config.dutySlaMinutes * 60_000,
      promisedWindowLabel: isAsync
        ? `Письменный расчёт от дежурного продюсера за ${config.dutySlaMinutes} мин`
        : `Связь дежурного продюсера за ${config.dutySlaMinutes} мин`,
    };
  }

  // Ночной или праздничный/воскресный режим -> первая очередь после открытия трафик-служб
  // Проверяем также ближайшую субботнюю дежурную смену, если заказ оставлен в ночь с пятницы на субботу
  for (let dayOffset = 0; dayOffset <= 25; dayOffset += 1) {
    const probeDayStartMs =
      dayOffset === 0
        ? createdAtMs
        : fromStudioWallClockToEpochMs(
            parts.year,
            parts.month,
            parts.day + dayOffset,
            0,
            config.utcOffsetMinutes
          );
    const probeParts = toStudioWallClock(probeDayStartMs, config.utcOffsetMinutes);
    const probeHoliday = isOfficialOrCustomHolidayDate(probeParts.dateKey, config);

    if (isTrafficDeskWorkingDate(probeParts, config)) {
      const openMs = fromStudioWallClockToEpochMs(
        probeParts.year,
        probeParts.month,
        probeParts.day,
        config.weekdayOpenMinute,
        config.utcOffsetMinutes
      );
      if (openMs > createdAtMs) {
        const deadlineMs = openMs + 30 * 60_000; // Первые 30 минут утренней очереди (09:30–10:00)
        return {
          slaWindowStartMs: openMs,
          slaDeadlineMs: deadlineMs,
          promisedWindowLabel: `${isAsync ? 'Письменный счёт' : 'Приоритетный звонок'} ${formatStudioTimestampHuman(
            openMs,
            config
          )}`,
        };
      }
    }

    if (!probeHoliday && probeParts.dayOfWeek === 6) {
      const satOpenMs = fromStudioWallClockToEpochMs(
        probeParts.year,
        probeParts.month,
        probeParts.day,
        config.saturdayDutyOpenMinute,
        config.utcOffsetMinutes
      );
      if (satOpenMs > createdAtMs) {
        const deadlineMs = satOpenMs + config.dutySlaMinutes * 60_000;
        return {
          slaWindowStartMs: satOpenMs,
          slaDeadlineMs: deadlineMs,
          promisedWindowLabel: `Дежурная смена в Сб с ${formatMinuteOfDay(
            config.saturdayDutyOpenMinute
          )} (UTC+3)`,
        };
      }
    }
  }

  return {
    slaWindowStartMs: regimeInfo.nextTrafficOpenMs,
    slaDeadlineMs: regimeInfo.nextTrafficOpenMs + 30 * 60_000,
    promisedWindowLabel: `После открытия смен: ${regimeInfo.nextTrafficOpenFormatted}`,
  };
}

export type OrderSlaEvaluationState =
  | 'contact_completed'
  | 'queued_off_hours'
  | 'scheduled_slot'
  | 'active_countdown'
  | 'warning_soon'
  | 'breached_late';

export interface OrderSlaEvaluationResult {
  state: OrderSlaEvaluationState;
  remainingSec: number;
  overdueSec: number;
  overdueMinutes: number;
  formattedClock: string;
  badgeLabel: string;
  detailMessage: string;
  escalationActionRequired: boolean;
  clientRescueEligible: boolean;
}

function formatMmSs(totalSec: number): string {
  const clamped = Math.max(0, Math.floor(totalSec));
  const hours = Math.floor(clamped / 3600);
  const mins = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(
      secs
    ).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function evaluateOrderSlaStatus(
  params: {
    stage: string;
    createdAtIso: string;
    callbackPreference?: ClientCallbackPreference | null;
    slaWindowStartIso?: string | null;
    slaDeadlineIso?: string | null;
    firstContactedAtIso?: string | null;
    escalatedAtIso?: string | null;
  },
  nowMs = Date.now(),
  rawConfig?: Partial<StudioWorkScheduleConfig> | null
): OrderSlaEvaluationResult {
  const config = sanitizeWorkScheduleConfig(rawConfig);
  const pref = params.callbackPreference ?? 'call_15m';

  if (params.firstContactedAtIso || params.stage !== 'new_hold') {
    return {
      state: 'contact_completed',
      remainingSec: 0,
      overdueSec: 0,
      overdueMinutes: 0,
      formattedClock: 'Выполнено',
      badgeLabel:
        pref === 'async_no_call'
          ? 'Счёт и статус переданы письменно'
          : 'Контакт с клиентом выполнен',
      detailMessage: 'Обязательство SLA по первичной реакции закрыто.',
      escalationActionRequired: false,
      clientRescueEligible: false,
    };
  }

  const createdMs = Date.parse(params.createdAtIso);
  const safeCreatedMs = Number.isFinite(createdMs) ? createdMs : nowMs;
  const computed = computeSlaDeadlineWindow(safeCreatedMs, pref, config);

  const windowStartMs =
    params.slaWindowStartIso && Number.isFinite(Date.parse(params.slaWindowStartIso))
      ? Date.parse(params.slaWindowStartIso)
      : computed.slaWindowStartMs;

  const deadlineMs =
    params.slaDeadlineIso && Number.isFinite(Date.parse(params.slaDeadlineIso))
      ? Date.parse(params.slaDeadlineIso)
      : computed.slaDeadlineMs;

  // 1. Заказ оформлен ночью, в воскресенье или в праздник — ждём открытия рабочей смены
  if (nowMs < windowStartMs) {
    const waitSec = Math.max(0, Math.floor((windowStartMs - nowMs) / 1000));
    const isScheduledPref =
      pref === 'morning_0930' || pref === 'day_1300' || pref === 'evening_1730';

    if (isScheduledPref) {
      return {
        state: 'scheduled_slot',
        remainingSec: waitSec,
        overdueSec: 0,
        overdueMinutes: 0,
        formattedClock: formatMmSs(waitSec),
        badgeLabel: `Ожидает окна клиента · ${getCallbackPreferenceMeta(pref).shortLabel}`,
        detailMessage: `Связь назначена по выбору клиента: ${computed.promisedWindowLabel}.`,
        escalationActionRequired: false,
        clientRescueEligible: false,
      };
    }

    return {
      state: 'queued_off_hours',
      remainingSec: waitSec,
      overdueSec: 0,
      overdueMinutes: 0,
      formattedClock: formatMmSs(waitSec),
      badgeLabel: `Ночной / праздничный сейф · старт смены через ${formatMmSs(waitSec)}`,
      detailMessage: `Квота заморожена без потери скидки. ${computed.promisedWindowLabel}.`,
      escalationActionRequired: false,
      clientRescueEligible: false,
    };
  }

  // 2. Идёт активное рабочее окно ответа до дедлайна SLA
  if (nowMs < deadlineMs) {
    const remSec = Math.max(0, Math.floor((deadlineMs - nowMs) / 1000));
    const isWarning = remSec <= 5 * 60;
    return {
      state: isWarning ? 'warning_soon' : 'active_countdown',
      remainingSec: remSec,
      overdueSec: 0,
      overdueMinutes: 0,
      formattedClock: formatMmSs(remSec),
      badgeLabel: isWarning
        ? `Срочно SLA · осталось ${formatMmSs(remSec)}`
        : `SLA ответа · ${formatMmSs(remSec)}`,
      detailMessage:
        pref === 'async_no_call'
          ? 'Клиент выбрал режим без звонка: подготовьте письменную спецификацию и счёт в ЭДО.'
          : 'Идёт контрольный интервал первичного контакта с клиентом и сверки сетки.',
      escalationActionRequired: false,
      clientRescueEligible: false,
    };
  }

  // 3. Дедлайн SLA пропущен (опоздание звонка / письменного ответа)
  const overdueSec = Math.max(1, Math.floor((nowMs - deadlineMs) / 1000));
  const overdueMinutes = Math.max(1, Math.ceil(overdueSec / 60));

  return {
    state: 'breached_late',
    remainingSec: 0,
    overdueSec,
    overdueMinutes,
    formattedClock: `+${formatMmSs(overdueSec)}`,
    badgeLabel: `Опоздание SLA +${overdueMinutes} мин · Эскалация руководителю`,
    detailMessage: params.escalatedAtIso
      ? `Передано старшему продюсеру. Активирована компенсация: приоритетный сценарий за 12ч и защита скидки.`
      : `Превышен регламент реакции (${overdueMinutes} мин). Требуется немедленный контакт руководителя смены и пролонгация холда.`,
    escalationActionRequired: true,
    clientRescueEligible: true,
  };
}

export interface RegimeTimelineStep {
  stepNumber: string;
  timingLabel: string;
  title: string;
  description: string;
}

/**
 * Строит честный 3-шаговый маршрут для клиента в зависимости от времени суток,
 * выходного/праздника и выбранного способа связи (со звонком, ко времени или без звонка).
 */
export function buildRegimeAwareClientTimeline(params: {
  checkoutMode: 'air_plus_production' | 'production_only';
  stationsCount: number;
  nowMs?: number;
  callbackPreference?: ClientCallbackPreference;
  scheduleConfig?: Partial<StudioWorkScheduleConfig> | null;
  paymentChannel?: 'edo_invoice' | 'card_online';
  isNegotiable?: boolean;
}): readonly RegimeTimelineStep[] {
  const nowMs = params.nowMs ?? Date.now();
  const pref = params.callbackPreference ?? 'call_15m';
  const config = sanitizeWorkScheduleConfig(params.scheduleConfig);
  const regime = resolveStudioOperatingRegime(nowMs, config);
  const slaWin = computeSlaDeadlineWindow(nowMs, pref, config);
  const holdExpMs = computeSmartHoldExpirationMs(nowMs, config);
  const holdExpHuman = formatStudioTimestampHuman(holdExpMs, config);

  const isNoCall = pref === 'async_no_call';
  const isScheduled =
    pref === 'morning_0930' || pref === 'day_1300' || pref === 'evening_1730';
  const isCardPayment = params.paymentChannel === 'card_online';
  const isNegotiable = Boolean(params.isNegotiable);

  if (params.checkoutMode === 'air_plus_production') {
    const stationsPhrase =
      params.stationsCount === 1
        ? 'выбранной радиостанции'
        : `выбранных радиостанциях (${params.stationsCount} ст.)`;

    const step1: RegimeTimelineStep = regime.isTrafficDeskOpen
      ? {
          stepNumber: '01',
          timingLabel: `Сейчас · 0–${config.daytimeSlaMinutes} мин`,
          title: 'Прямая блокировка эфирных окон в трафик-службе',
          description: `Трафик-службы открыты: сейлз-продюсер сверяет сетку на ${stationsPhrase} и закрепляет скидку горящего эфира за вашей компанией.`,
        }
      : {
          stepNumber: '01',
          timingLabel: 'Мгновенно · Автоматический сейф',
          title:
            regime.regime === 'holiday_or_sunday_freeze'
              ? 'Праздничная / выходная заморозка цены и слотов'
              : 'Ночной сейф-резерв без сгорания таймера',
          description: `Скидка и выбранные пакеты на ${stationsPhrase} зафиксированы в реестре CRM. Таймер 4 рабочих часов заморожен и действует до ${holdExpHuman}.`,
        };

    const step2: RegimeTimelineStep = isNoCall
      ? {
          stepNumber: '02',
          timingLabel: slaWin.promisedWindowLabel,
          title: 'Письменное подтверждение сетки без звонков',
          description:
            'Мы не будем беспокоить вас телефонными звонками: отправим подтверждённый график выходов и ссылку на документы в указанный мессенджер или на почту.',
        }
      : isScheduled
        ? {
            stepNumber: '02',
            timingLabel: slaWin.promisedWindowLabel,
            title: `Звонок продюсера строго в выбранное окно (${getCallbackPreferenceMeta(pref).shortLabel})`,
            description:
              'К моменту звонка продюсер уже сверит наличие всех выходов в трафик-службе, чтобы разговор занял не более 3 минут по делу.',
          }
        : regime.isDutyProducerOnline
          ? {
              stepNumber: '02',
              timingLabel: `До ${regime.targetSlaMinutes} минут`,
              title:
                regime.regime === 'workday_prime'
                  ? 'Звонок или сообщение сейлз-продюсера'
                  : 'Связь дежурного продюсера студии',
              description:
                regime.regime === 'workday_prime'
                  ? 'Подтвердим точное время выходов по станциям и при необходимости примем задачу для сценариста устно.'
                  : 'Дежурный продюсер примет пожелания к ролику и реквизиты сегодня, а финальную бронь трафик-служб подтвердит утром.',
            }
          : {
              stepNumber: '02',
              timingLabel: slaWin.promisedWindowLabel,
              title: 'Первая очередь утренней сверки без ночных звонков',
              description:
                'Сразу после открытия трафик-служб радиостанций продюсер подтвердит слоты первым приоритетом и свяжется с вами с готовым расписанием.',
            };

    const step3: RegimeTimelineStep = {
      stepNumber: '03',
      timingLabel: regime.isTrafficDeskOpen
        ? `До ${formatMinuteOfDay(config.weekdayCloseMinute)} / в рамках 4ч`
        : `До ${holdExpHuman}`,
      title: 'Единый счёт в ЭДО (доступен сразу на экране) и старт ролика',
      description:
        'Предварительную счёт-спецификацию для бухгалтерии и ЭДО можно забрать прямо сейчас на этой странице, не дожидаясь звонка. При опоздании ответа квота продлевается автоматически.',
    };

    return [step1, step2, step3];
  }

  // Режим «Только аудиопродакшн» (строгий юридический и безопасный порядок: проверка → договор и предоплата → сценарии и запись)
  return [
    {
      stepNumber: '01',
      timingLabel: regime.isDutyProducerOnline ? 'Сейчас · 0–15 минут' : 'Заявка зафиксирована',
      title: 'Проверка контрагента, реквизитов и задачи',
      description:
        'Заявка, бриф и указанные реквизиты переданы продюсеру. Студия проверяет компанию (или формат оплаты от физлица) и подтверждает сотрудничество и сроки.',
    },
    {
      stepNumber: '02',
      timingLabel: slaWin.promisedWindowLabel,
      title: isNegotiable
        ? 'Консультация продюсера, договорная смета и документ оплаты'
        : isCardPayment
          ? 'Акцепт оферты и ссылка ЮKassa / Робокасса (чек 54-ФЗ)'
          : 'Рамочный договор-оферта и счёт для ЭДО (Диадок / СБИС)',
      description: isNegotiable
        ? isNoCall
          ? 'Письменно разберём нестандартную задачу (или этап «Только сценарий»), согласуем договорную цену и направим рамочный договор со счётом / платёжной ссылкой.'
          : 'Живой продюсер свяжется в выбранное окно, поможет уточнить ТЗ, согласует договорную цену и подготовит рамочный договор-счёт или ссылку оплаты.'
        : isCardPayment
          ? 'Вы можете скачать текст рамочного договора-оферты выше, а продюсер отправит официальную ссылку для оплаты картой физлица / по СБП с чеком по 54-ФЗ.'
          : 'Вы уже можете скачать готовый рамочный договор-оферту и счёт для ЭДО прямо на этой странице, чтобы бухгалтерия провела предоплату без лишних задержек.',
    },
    {
      stepNumber: '03',
      timingLabel: 'Отсчёт после 100% предоплаты',
      title: 'Сценарии, запись актёра и паспорт прав РАО/ВОИС',
      description:
        'Разработка сценариев, кастинг голосов и запись открываются строго после договора и поступления предоплаты — далее выпускаем 3 концепции, мастер WAV/MP3 и закрывающие акты.',
    },
  ];
}

export interface ScheduleSimulationPreset {
  id: string;
  label: string;
  isoTimestamp: string;
  description: string;
}

/**
 * Набор эталонных временных точек для интерактивной проверки поведения системы
 * в будни днём, вечером, глубокой ночью, в выходные и в новогодние/майские праздники.
 */
export const SCHEDULE_SIMULATION_PRESETS: readonly ScheduleSimulationPreset[] = [
  {
    id: 'workday_prime_1415',
    label: 'Будни · День (Ср 14:15)',
    isoTimestamp: '2026-11-18T11:15:00.000Z', // 14:15 UTC+3
    description: 'Трафик-службы станций открыты: звонок 15 мин, холд 4ч до 18:15 того же дня.',
  },
  {
    id: 'friday_late_1830',
    label: 'Пятница 18:30 (перенос на Пн)',
    isoTimestamp: '2026-11-20T15:30:00.000Z', // 18:30 UTC+3 пятница
    description: '1 час трафика в пятницу + автоматическая заморозка на выходные -> холд до Пн 12:30.',
  },
  {
    id: 'weekday_evening_2045',
    label: 'Вечер дежурный (Чт 20:45)',
    isoTimestamp: '2026-11-19T17:45:00.000Z', // 20:45 UTC+3
    description: 'Дежурный продюсер отвечает за 30 мин, а эфирный холд заморожен до 13:30 пятницы.',
  },
  {
    id: 'deep_night_0240',
    label: 'Ночь 02:40 (без звонков)',
    isoTimestamp: '2026-11-18T23:40:00.000Z', // 02:40 UTC+3 четверг
    description: 'Ночной сейф: никаких звонков ночью, старт очереди в 09:30, холд до 13:30.',
  },
  {
    id: 'saturday_duty_1320',
    label: 'Суббота 13:20 (дежурный)',
    isoTimestamp: '2026-11-21T10:20:00.000Z', // 13:20 UTC+3 суббота
    description: 'Дежурный продюсер принимает бриф (30 мин), слоты на станциях защищены до Пн 13:30.',
  },
  {
    id: 'sunday_off_1500',
    label: 'Воскресенье 15:00',
    isoTimestamp: '2026-11-22T12:00:00.000Z', // 15:00 UTC+3 воскресенье
    description: 'Полная выходная заморозка скидки до Пн 13:30 + автономный счёт на экране.',
  },
  {
    id: 'new_year_holiday_jan03',
    label: 'Праздники (3 января)',
    isoTimestamp: '2026-01-03T11:00:00.000Z', // 14:00 UTC+3 3 января
    description: 'Многодневная праздничная защита квоты через все каникулы до первого рабочего дня.',
  },
] as const;
