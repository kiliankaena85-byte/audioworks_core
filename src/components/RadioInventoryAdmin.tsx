import {
  CheckCircle2,
  FileSpreadsheet,
  MessageSquare,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
  Zap,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AudienceTag,
  calculateCost,
  computeSlotDiscountPercent,
  createSecondBasedPricing,
  DaypartLabel,
  formatNumberSpaced,
  formatRubCompact,
  RadioInventorySlot,
  radioInventoryStore,
  resolveWeekdayNumbers,
  SecondBasedPricing,
  SlotDurationMultiplicitySec,
} from '../data/radioInventory';
import { useRateLimit } from '../security/useRateLimit';

interface RadioInventoryAdminProps {
  isOpen: boolean;
  onClose: () => void;
}

type AdminTabId = 'smart_import' | 'manage_quotas';

const PRODUCER_LEDGER_STORAGE_KEY = 'fmworks_producer_ledger_v1';

interface ProducerSlotMeta {
  /** Входная нетто-цена пакета от радиостанции для FMWorks */
  netCostRub: number;
  /** Остаток доступных пакетов к продаже на витрине */
  packagesRemaining: number;
}

interface StagingQuotaRow {
  tempId: string;
  selected: boolean;
  station: string;
  frequencyFm: string;
  programTitle?: string;
  formatDesc: string;
  audienceTags: AudienceTag[];
  daypart: DaypartLabel;
  daysPattern: string;
  sampleTimeSlots: string[];
  spotsIncluded: number;
  maxDuration: 15 | 30;
  officialPrice: number;
  netCostRub: number;
  marginPercent: number;
  reachOTS: number;
  deadlineHours: number;
  packagesRemaining: number;
}

const DAYPART_OPTIONS: readonly DaypartLabel[] = [
  'Утренний прайм 07:30–10:30',
  'Дневной блок 12:00–16:00',
  'Вечерний драйв 17:30–20:30',
  'Спонсорство пробок/погоды',
] as const;

const MANUAL_TAG_PRESETS: readonly {
  label: string;
  tags: AudienceTag[];
}[] = [
  { label: 'B2B и Недвижимость', tags: ['b2b', 'real_estate', 'premium'] },
  { label: 'FMCG и Массовый охват', tags: ['fmcg', 'mass', 'auto'] },
  { label: 'Медицина и Семья', tags: ['medicine', 'mass', 'fmcg'] },
  { label: 'Автомобильный прайм', tags: ['auto', 'mass', 'b2b'] },
] as const;

/**
 * 3 быстрых пресета для проверки всеядного парсера продюсера в 1 клик
 */
const PRESET_1_TELEGRAM_SALES = [
  'Привет! Снялась бронь на этой неделе, отдаём пакеты по спеццене для FMWorks:',
  'Авторадио утренний драйв 15 выходов прайс 210000 отдадим за 125000 хрон 30с дедлайн 36ч OTS 590к',
  'Business FM 87.5 утренние новости Пн–Пт 16 выходов прайс 265к вход нетто 138к до 30 сек дедлайн 28ч OTS 330к',
  'Радио Monte Carlo вечерний прайм 14 выходов по прайсу 195 000 отдадим за 102 000 хрон 30с дедлайн 30ч OTS 280 000',
].join('\n');

const PRESET_2_EXCEL_TSV = [
  'Радиостанция\tТайм-слот\tДни\tВыходов\tХрон\tПрайс\tНетто вход\tOTS\tДедлайн',
  'Европа Плюс 106.2 FM\tДневной блок 12:00–16:00\tСр–Вс\t18\t30\t220 000\t112 000\t585 000\t32',
  'Comedy Radio 102.5 FM\tВечерний драйв 17:30–20:30\tПн–Пт\t16\t15\t182 000\t92 000\t405 000\t27',
  'Ретро FM 88.3 FM\tУтренний прайм 07:30–10:30\tПн–Пт\t14\t30\t124 000\t62 000\t445 000\t26',
  'Коммерсантъ FM 93.6 FM\tУтренний прайм 07:30–10:30\tПн–Пт\t14\t30\t178 000\t94 000\t235 000\t29',
].join('\n');

const PRESET_3_URGENT_TRAFFIC = [
  'СРОЧНО на завтрашнее утро — слетели спонсорские пакеты пробок и погоды:',
  'Авторадио 90.3 FM | Спонсорство пробок 08:20, 09:15, 18:40 | Пн–Сб | 18 выходов | хрон 15с | прайс 230000 отдадим за 98000 | OTS 610к | дедлайн 8ч',
  'Радио JAZZ 89.1 FM | Спонсорство погоды и трафика 08:20, 09:15, 18:40 | Пн–Пт | 15 выходов | хрон 30с | прайс 176к нетто 78к | OTS 220к | дедлайн 9ч',
  'Серебряный Дождь 100.1 FM | Вечерний трафик 17:50, 18:40, 19:30 | Пн–Пт | 14 выходов | хрон 30с | прайс 165 000 отдадим за 82 000 | OTS 250к | дедлайн 26ч',
].join('\n');

interface KnownStationSpec {
  patterns: string[];
  canonicalName: string;
  frequencyFm: string;
  tags: AudienceTag[];
  formatDesc: string;
}

const KNOWN_STATIONS_DIRECTORY: readonly KnownStationSpec[] = [
  {
    patterns: ['business fm', 'бизнес фм', 'бизнес fm'],
    canonicalName: 'Business FM',
    frequencyFm: '87.5 FM',
    tags: ['b2b', 'real_estate', 'premium', 'auto'],
    formatDesc: 'Деловые новости, рынки и недвижимость каждые 15 минут',
  },
  {
    patterns: ['коммерсант', 'kommersant'],
    canonicalName: 'Коммерсантъ FM',
    frequencyFm: '93.6 FM',
    tags: ['b2b', 'real_estate', 'premium'],
    formatDesc: 'Собственники бизнеса, инвесторы и руководители компаний',
  },
  {
    patterns: ['monte carlo', 'монте карло', 'монте-карло'],
    canonicalName: 'Радио Monte Carlo',
    frequencyFm: '102.1 FM',
    tags: ['real_estate', 'premium', 'medicine', 'auto'],
    formatDesc: 'Мировая классика и аудитория бизнес-класса с высоким доходом',
  },
  {
    patterns: ['авторадио', 'avtoradio'],
    canonicalName: 'Авторадио',
    frequencyFm: '90.3 FM',
    tags: ['auto', 'fmcg', 'mass', 'real_estate'],
    formatDesc: 'Лидер автомобильного прайма и городских сводок движения',
  },
  {
    patterns: ['европа плюс', 'europa plus'],
    canonicalName: 'Европа Плюс',
    frequencyFm: '106.2 FM',
    tags: ['fmcg', 'mass', 'auto', 'medicine'],
    formatDesc: 'Высокий дневной и праймовый охват активной городской аудитории',
  },
  {
    patterns: ['comedy', 'камеди'],
    canonicalName: 'Comedy Radio',
    frequencyFm: '102.5 FM',
    tags: ['auto', 'fmcg', 'b2b', 'mass'],
    formatDesc: 'Платёжеспособная аудитория в автомобильном трафике',
  },
  {
    patterns: ['дорожное', 'dorozhnoe'],
    canonicalName: 'Дорожное Радио',
    frequencyFm: '96.0 FM',
    tags: ['medicine', 'fmcg', 'mass', 'auto'],
    formatDesc: 'Широкий семейный охват, медицина, ритейл и загородный поток',
  },
  {
    patterns: ['ретро fm', 'ретро фм', 'retro fm'],
    canonicalName: 'Ретро FM',
    frequencyFm: '88.3 FM',
    tags: ['medicine', 'fmcg', 'real_estate', 'mass'],
    formatDesc: 'Лояльная взрослая аудитория 35–60 лет с высоким доверием',
  },
  {
    patterns: ['серебряный дождь', 'silver rain'],
    canonicalName: 'Серебряный Дождь',
    frequencyFm: '100.1 FM',
    tags: ['real_estate', 'premium', 'b2b', 'auto'],
    formatDesc: 'Интеллектуальный авторский эфир, девелопмент и частный капитал',
  },
  {
    patterns: ['jazz', 'джаз'],
    canonicalName: 'Радио JAZZ',
    frequencyFm: '89.1 FM',
    tags: ['premium', 'real_estate', 'b2b', 'auto'],
    formatDesc: 'Премиальная джазовая волна, статусная аудитория в часах пик',
  },
  {
    patterns: ['relax', 'релакс'],
    canonicalName: 'Relax FM',
    frequencyFm: '90.8 FM',
    tags: ['medicine', 'real_estate', 'premium', 'fmcg'],
    formatDesc: 'Спокойная атмосферная волна: клиники, семейные ЖК и велнес',
  },
  {
    patterns: ['новое радио', 'novoe'],
    canonicalName: 'Новое Радио',
    frequencyFm: '98.4 FM',
    tags: ['fmcg', 'mass', 'auto'],
    formatDesc: 'Молодая и активная городская аудитория, утренние драйв-шоу',
  },
  {
    patterns: ['русское радио'],
    canonicalName: 'Русское Радио',
    frequencyFm: '105.7 FM',
    tags: ['fmcg', 'mass', 'medicine', 'auto'],
    formatDesc: 'Федеральный семейный охват и высокая узнаваемость',
  },
  {
    patterns: ['energy', 'nrj', 'энерджи'],
    canonicalName: 'Радио ENERGY',
    frequencyFm: '104.2 FM',
    tags: ['fmcg', 'auto', 'mass'],
    formatDesc: 'Динамичный городской формат для активных покупателей',
  },
  {
    patterns: ['радио 7', 'семи холмах'],
    canonicalName: 'Радио 7',
    frequencyFm: '104.7 FM',
    tags: ['medicine', 'real_estate', 'fmcg', 'premium'],
    formatDesc: 'Мягкий европейский прайм для взрослой платёжеспособной аудитории',
  },
  {
    patterns: ['рбк', 'rbc'],
    canonicalName: 'Радио РБК',
    frequencyFm: '92.8 FM',
    tags: ['b2b', 'real_estate', 'premium'],
    formatDesc: 'Финансовая аналитика, инвестиции и корпоративный сектор',
  },
] as const;

function computeClientHotPriceFromNet(netCostRub: number, marginPercent: number): number {
  return Math.max(15_000, Math.round((netCostRub * (1 + marginPercent / 100)) / 1000) * 1000);
}

function parseMoneyToken(rawToken: string): number | null {
  const cleaned = rawToken.trim().toLowerCase().replace(/\u00A0/g, ' ');
  const kMatch = cleaned.match(/^(\d{2,4}(?:[.,]\d{1,2})?)\s*(?:к|k|тыс\.?)$/i);
  if (kMatch) {
    const val = parseFloat(kMatch[1].replace(',', '.'));
    return Number.isFinite(val) ? Math.round(val * 1000) : null;
  }
  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return null;
  const parsed = parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function detectStationAndTags(rawLineOrCell: string): {
  station: string;
  frequencyFm: string;
  tags: AudienceTag[];
  formatDesc: string;
} {
  const low = rawLineOrCell.toLowerCase();
  const explicitFmMatch = rawLineOrCell.match(/(\d{2,3}[.,]\d)\s*FM/i);
  const explicitFm = explicitFmMatch ? `${explicitFmMatch[1].replace(',', '.')} FM` : null;

  for (const spec of KNOWN_STATIONS_DIRECTORY) {
    if (spec.patterns.some((pat) => low.includes(pat))) {
      return {
        station: spec.canonicalName,
        frequencyFm: explicitFm ?? spec.frequencyFm,
        tags: [...spec.tags],
        formatDesc: spec.formatDesc,
      };
    }
  }

  // Если станция нестандартная — аккуратно отрезаем всё до ключевых слов расписания/цены
  const stripped = rawLineOrCell
    .replace(/^[-•*\d.)\s]+/, '')
    .split(/\s*\|\s*|\t|;/)[0]
    .replace(/(\d{2,3}[.,]\d)\s*FM/gi, '')
    .split(
      /\s+(?:утрен\S*|дневн\S*|вечерн\S*|драйв\S*|прайм\S*|спонсор\S*|проб\S*|погод\S*|пн|ср|сб|\d+\s*выход|прайс|нетто|отдадим|хрон)/i
    )[0]
    .replace(/[()]/g, '')
    .trim();

  const fallbackTags: AudienceTag[] =
    low.includes('бизнес') || low.includes('делов')
      ? ['b2b', 'real_estate', 'premium']
      : low.includes('авто') || low.includes('трафик') || low.includes('проб')
        ? ['auto', 'mass', 'fmcg']
        : ['fmcg', 'mass', 'auto', 'medicine'];

  return {
    station: stripped || 'Радиосеть',
    frequencyFm: explicitFm ?? '101.2 FM',
    tags: fallbackTags,
    formatDesc: 'Горящая эфирная квота радиостанции с проверенным охватом',
  };
}

function detectDaypartAndClockWindows(text: string): {
  daypart: DaypartLabel;
  sampleTimeSlots: string[];
} {
  // Извлекаем точные часы выходов вида 08:20, 18:40 (исключая диапазоны блока 07:30–10:30, 12:00–16:00, 17:30–20:30)
  const withoutBlockRanges = text.replace(
    /\b(?:07:30|10:30|12:00|16:00|17:30|20:30)\s*[–—-]?\s*(?:10:30|16:00|20:30)?/g,
    ''
  );
  const explicitTimes = Array.from(
    withoutBlockRanges.matchAll(/\b([01]\d|2[0-3]):[0-5]\d\b/g)
  ).map((m) => m[0]);

  const low = text.toLowerCase();
  if (
    low.includes('проб') ||
    low.includes('погод') ||
    low.includes('трафик') ||
    low.includes('спонсор')
  ) {
    return {
      daypart: 'Спонсорство пробок/погоды',
      sampleTimeSlots: explicitTimes.length >= 2 ? explicitTimes : ['08:20', '09:15', '18:40'],
    };
  }
  if (
    low.includes('вечер') ||
    low.includes('17:30') ||
    low.includes('18:') ||
    low.includes('19:')
  ) {
    return {
      daypart: 'Вечерний драйв 17:30–20:30',
      sampleTimeSlots: explicitTimes.length >= 2 ? explicitTimes : ['17:50', '18:35', '19:40'],
    };
  }
  if (
    low.includes('дневн') ||
    low.includes('день') ||
    low.includes('12:00') ||
    low.includes('13:') ||
    low.includes('14:')
  ) {
    return {
      daypart: 'Дневной блок 12:00–16:00',
      sampleTimeSlots: explicitTimes.length >= 2 ? explicitTimes : ['12:35', '14:15', '15:40'],
    };
  }
  return {
    daypart: 'Утренний прайм 07:30–10:30',
    sampleTimeSlots: explicitTimes.length >= 2 ? explicitTimes : ['08:15', '09:15', '10:05'],
  };
}

/**
 * Всеядный парсер продюсера FMWorks:
 * Понимает как прямой Copy-Paste из Excel / Google Таблиц (`\t` или `;`),
 * так и свободный русский текст из Telegram (включая сокращения `125к`, `210000`, `хрон 30с`, `дедлайн 36ч`).
 */
function parseOmnivorousProducerInput(
  rawText: string,
  defaultMarginPercent: number
): { rows: StagingQuotaRow[]; skippedCount: number } {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rows: StagingQuotaRow[] = [];
  let skippedCount = 0;

  lines.forEach((line, idx) => {
    const low = line.toLowerCase();

    // Пропускаем шапки Excel-таблиц и вводные приветствия сейлзов без цен
    if (
      (low.startsWith('радиостанция') ||
        low.startsWith('станция') ||
        low.startsWith('station') ||
        low.startsWith('коллеги') ||
        low.startsWith('привет') ||
        low.startsWith('срочно на завтра')) &&
      !/\d{5,6}|\d{2,3}\s*(?:к|тыс)|\d{2,3}\s+\d{3}/i.test(line)
    ) {
      skippedCount += 1;
      return;
    }

    // ВЕТКА А: Табличная строка из Excel / Google Sheets (`\t`) или CSV (`;`)
    const delimiter = line.includes('\t') ? '\t' : line.split(';').length >= 5 ? ';' : null;
    if (delimiter) {
      const cols = line.split(delimiter).map((c) => c.trim());
      if (cols.length >= 5) {
        const stationMeta = detectStationAndTags(cols[0]);
        const daypartMeta = detectDaypartAndClockWindows(`${cols[1]} ${cols[0]}`);
        const daysPattern =
          cols[2] && /(пн|вт|ср|чт|пт|сб|вс|ежедн)/i.test(cols[2])
            ? cols[2].replace('-', '–')
            : 'Пн–Пт';

        const spotsParsed = parseInt((cols[3] ?? '').replace(/\D/g, ''), 10);
        const spotsIncluded = Number.isFinite(spotsParsed) && spotsParsed >= 2 ? spotsParsed : 15;

        const durParsed = parseInt((cols[4] ?? '').replace(/\D/g, ''), 10);
        const maxDuration: 15 | 30 = durParsed === 15 ? 15 : 30;

        const col5Money = parseMoneyToken(cols[5] ?? '');
        const col6Money = parseMoneyToken(cols[6] ?? '');

        let officialPrice = 190_000;
        let netCostRub = 98_000;

        if (col5Money && col6Money) {
          officialPrice = Math.max(col5Money, col6Money);
          netCostRub = Math.min(col5Money, col6Money);
        } else if (col5Money) {
          netCostRub = col5Money;
          officialPrice = Math.round((netCostRub * 1.85) / 1000) * 1000;
        }

        const otsParsed = parseMoneyToken(cols[7] ?? '');
        const reachOTS = otsParsed && otsParsed >= 20_000 ? otsParsed : 340_000;

        const deadlineParsed = parseInt((cols[8] ?? '').replace(/\D/g, ''), 10);
        const deadlineHours =
          Number.isFinite(deadlineParsed) && deadlineParsed >= 4 && deadlineParsed <= 96
            ? deadlineParsed
            : 28;

        rows.push({
          tempId: `stg-${Date.now()}-${idx}`,
          selected: true,
          station: stationMeta.station,
          frequencyFm: stationMeta.frequencyFm,
          formatDesc: stationMeta.formatDesc,
          audienceTags: stationMeta.tags,
          daypart: daypartMeta.daypart,
          daysPattern,
          sampleTimeSlots: daypartMeta.sampleTimeSlots,
          spotsIncluded,
          maxDuration,
          officialPrice,
          netCostRub,
          marginPercent: defaultMarginPercent,
          reachOTS,
          deadlineHours,
          packagesRemaining: 1,
        });
        return;
      }
    }

    // ВЕТКА Б: Свободный русский текст из Telegram / WhatsApp / почты
    const stationMeta = detectStationAndTags(line);
    const daypartMeta = detectDaypartAndClockWindows(line);

    // 1. Сначала вытаскиваем OTS / охват, чтобы не перепутать его со стоимостью
    let reachOTS = 320_000;
    const otsMatch = line.match(
      /(?:ots|охват)\s*[:=-]?\s*(\d{2,3}(?:[\s\u00A0]\d{3})+|\d{2,4}(?:[.,]\d)?\s*(?:к|k|тыс)?)/i
    );
    if (otsMatch) {
      const parsedOts = parseMoneyToken(otsMatch[1]);
      if (parsedOts && parsedOts >= 15_000) {
        reachOTS = parsedOts;
      } else {
        const rawSmall = parseInt(otsMatch[1].replace(/\D/g, ''), 10);
        if (rawSmall > 0 && rawSmall < 2000) reachOTS = rawSmall * 1000;
      }
    }

    // Убираем из строки OTS, хронометраж, выходы, дедлайн и FM-частоту перед поиском денег
    const scrubbedForMoney = line
      .replace(/(?:ots|охват)\s*[:=-]?\s*\d[\d\s.,]*(?:к|k|тыс)?/gi, ' ')
      .replace(/\d{2,3}[.,]\d\s*FM/gi, ' ')
      .replace(/\b([01]\d|2[0-3]):[0-5]\d\b/g, ' ')
      .replace(/\d{1,3}\s*(?:выход\S*|спот\S*|выпуск\S*)/gi, ' ')
      .replace(/(?:хрон\S*|до|по)\s*(?:15|30)\s*(?:сек\S*|с\b)/gi, ' ')
      .replace(/(?:дедлайн|бронь|осталось)\s*[:=-]?\s*\d{1,2}\s*(?:ч|час\S*)/gi, ' ');

    // Проверяем явные маркеры «прайс X» и «нетто / отдадим за Y»
    const explicitOfficialMatch = scrubbedForMoney.match(
      /(?:по\s*прайсу|прайс)\s*[:=-]?\s*(\d{2,3}(?:[\s\u00A0]\d{3})+|\d{5,6}|\d{2,3}(?:[.,]\d)?\s*(?:к|k|тыс))/i
    );
    const explicitNetMatch = scrubbedForMoney.match(
      /(?:нетто|вход|отдадим\s*за|отдаем\s*за|спеццена|за)\s*[:=-]?\s*(\d{2,3}(?:[\s\u00A0]\d{3})+|\d{5,6}|\d{2,3}(?:[.,]\d)?\s*(?:к|k|тыс))/i
    );

    const allMoneyTokens = Array.from(
      scrubbedForMoney.matchAll(
        /(\d{2,3}(?:[\s\u00A0]\d{3})+|\d{5,6}|\d{2,3}(?:[.,]\d)?\s*(?:к|k|тыс))\b/gi
      )
    )
      .map((m) => parseMoneyToken(m[1]))
      .filter((v): v is number => v !== null && v >= 25_000 && v <= 1_500_000);

    let officialPrice: number | null = explicitOfficialMatch
      ? parseMoneyToken(explicitOfficialMatch[1])
      : null;
    let netCostRub: number | null = explicitNetMatch
      ? parseMoneyToken(explicitNetMatch[1])
      : null;

    if (!officialPrice || !netCostRub) {
      if (allMoneyTokens.length >= 2) {
        const sorted = [...allMoneyTokens].sort((a, b) => b - a);
        officialPrice = officialPrice ?? sorted[0];
        netCostRub = netCostRub ?? sorted[sorted.length - 1];
      } else if (allMoneyTokens.length === 1) {
        netCostRub = netCostRub ?? allMoneyTokens[0];
        officialPrice = officialPrice ?? Math.round((netCostRub * 1.85) / 1000) * 1000;
      }
    }

    if (!netCostRub || !officialPrice) {
      skippedCount += 1;
      return;
    }

    if (netCostRub > officialPrice) {
      const swap = officialPrice;
      officialPrice = netCostRub;
      netCostRub = swap;
    }

    const spotsMatch = line.match(/(\d{1,3})\s*(?:выход|выпуск|спот|ролик)/i);
    const spotsIncluded = spotsMatch ? Math.max(4, parseInt(spotsMatch[1], 10)) : 15;

    const durMatch = line.match(/(?:хрон\S*\s*|до\s*|по\s*)?(15|30)\s*(?:сек|с\b)/i);
    const maxDuration: 15 | 30 = durMatch && durMatch[1] === '15' ? 15 : 30;

    const daysMatch = line.match(
      /(Пн\s*[–-]\s*Пт|Ср\s*[–-]\s*Вс|Пн\s*[–-]\s*Сб|Пн\s*[–-]\s*Вс|Сб\s*[–-]\s*Вс)/i
    );
    const daysPattern = daysMatch
      ? daysMatch[1].replace(/\s+/g, '').replace('-', '–')
      : 'Пн–Пт';

    const deadlineMatch = line.match(
      /(?:дедлайн|бронь|закрыт\S*|осталось)\s*[:=-]?\s*(\d{1,2})\s*(?:ч|час)/i
    );
    const deadlineHours = deadlineMatch
      ? Math.max(4, Math.min(96, parseInt(deadlineMatch[1], 10)))
      : 28;

    rows.push({
      tempId: `stg-${Date.now()}-${idx}`,
      selected: true,
      station: stationMeta.station,
      frequencyFm: stationMeta.frequencyFm,
      formatDesc: stationMeta.formatDesc,
      audienceTags: stationMeta.tags,
      daypart: daypartMeta.daypart,
      daysPattern,
      sampleTimeSlots: daypartMeta.sampleTimeSlots,
      spotsIncluded,
      maxDuration,
      officialPrice,
      netCostRub,
      marginPercent: defaultMarginPercent,
      reachOTS,
      deadlineHours,
      packagesRemaining: 1,
    });
  });

  return { rows, skippedCount };
}

function readProducerLedger(): Record<string, ProducerSlotMeta> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PRODUCER_LEDGER_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeProducerLedger(ledger: Record<string, ProducerSlotMeta>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PRODUCER_LEDGER_STORAGE_KEY, JSON.stringify(ledger));
  } catch {
    // Ignore private mode storage limits
  }
}

function resolveSlotProducerMeta(
  slot: RadioInventorySlot,
  ledger: Readonly<Record<string, ProducerSlotMeta>>
): ProducerSlotMeta {
  const existing = ledger[slot.id];
  if (existing) return existing;
  // Базовые квоты имеют заложенную агентскую маржу 20% поверх входного нетто станции
  return {
    netCostRub: Math.round(slot.hotPrice / 1.2 / 1000) * 1000,
    packagesRemaining: slot.isHidden ? 0 : 2,
  };
}

export function RadioInventoryAdmin({ isOpen, onClose }: RadioInventoryAdminProps) {
  const [activeTab, setActiveTab] = useState<AdminTabId>('smart_import');
  const [slots, setSlots] = useState<RadioInventorySlot[]>(() =>
    radioInventoryStore.getAllSlots()
  );
  const [producerLedger, setProducerLedger] = useState<Record<string, ProducerSlotMeta>>(() =>
    readProducerLedger()
  );

  // Вкладка 1: Всеядный парсер + Staging Table калькулятора прибыли
  const [rawImportText, setRawImportText] = useState('');
  const [globalMarginPercent, setGlobalMarginPercent] = useState<number>(20);
  const [stagingRows, setStagingRows] = useState<StagingQuotaRow[]>([]);
  const [importFeedback, setImportFeedback] = useState<{
    kind: 'success' | 'error';
    message: string;
  } | null>(null);

  // Вкладка 2: Ручное добавление слота
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [manualStation, setManualStation] = useState('');
  const [manualFrequency, setManualFrequency] = useState('101.2 FM');
  const [manualDaypart, setManualDaypart] = useState<DaypartLabel>(
    'Утренний прайм 07:30–10:30'
  );
  const [manualDays, setManualDays] = useState('Пн–Пт');
  const [manualSpots, setManualSpots] = useState(15);
  const [manualMaxDur, setManualMaxDur] = useState<15 | 30>(30);
  const [manualOfficialPrice, setManualOfficialPrice] = useState(190_000);
  const [manualNetCost, setManualNetCost] = useState(96_000);
  const [manualHotPrice, setManualHotPrice] = useState(115_000);
  const [manualOts, setManualOts] = useState(310_000);
  const [manualTagPresetIdx, setManualTagPresetIdx] = useState(0);
  const [manualError, setManualError] = useState<string | null>(null);

  const quotaImportRateLimit = useRateLimit({
    scope: 'quota_import',
    maxAttempts: 5,
    windowMs: 5 * 60 * 1000,
    minIntervalMs: 1500,
  });

  useEffect(() => {
    return radioInventoryStore.subscribe((next) => {
      setSlots([...next]);
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const updateLedgerEntry = (slotId: string, patch: Partial<ProducerSlotMeta>) => {
    setProducerLedger((prev) => {
      const targetSlot = slots.find((s) => s.id === slotId);
      const base = targetSlot
        ? resolveSlotProducerMeta(targetSlot, prev)
        : { netCostRub: 80_000, packagesRemaining: 1 };
      const next = {
        ...prev,
        [slotId]: {
          ...base,
          ...patch,
        },
      };
      writeProducerLedger(next);
      return next;
    });
  };

  // Верхняя сводка экономики инвентаря продюсера FMWorks
  const inventoryMetrics = useMemo(() => {
    const activeSlots = slots.filter((s) => !s.isHidden);
    let totalPackagesOnShowcase = 0;
    let totalShowcaseClientRub = 0;
    let totalPotentialCommissionRub = 0;

    for (const slot of activeSlots) {
      const meta = resolveSlotProducerMeta(slot, producerLedger);
      const pkgCount = Math.max(1, meta.packagesRemaining);
      const unitProfit = Math.max(0, slot.hotPrice - meta.netCostRub);

      totalPackagesOnShowcase += pkgCount;
      totalShowcaseClientRub += slot.hotPrice * pkgCount;
      totalPotentialCommissionRub += unitProfit * pkgCount;
    }

    return {
      activeCount: activeSlots.length,
      totalCount: slots.length,
      soldHiddenCount: slots.length - activeSlots.length,
      totalPackagesOnShowcase,
      totalShowcaseClientRub,
      totalPotentialCommissionRub,
    };
  }, [slots, producerLedger]);

  // Автоматический разбор текста в Staging Table
  const handleRunOmnivorousParse = (sourceText: string, margin = globalMarginPercent) => {
    setRawImportText(sourceText);
    setImportFeedback(null);

    if (!sourceText.trim()) {
      setStagingRows([]);
      return;
    }

    const parsed = parseOmnivorousProducerInput(sourceText, margin);
    setStagingRows(parsed.rows);
    if (parsed.rows.length === 0) {
      setImportFeedback({
        kind: 'error',
        message:
          'Не удалось распознать квоты. Укажите станцию и цену (например: Авторадио 15 выходов прайс 210000 отдадим за 125000).',
      });
    }
  };

  const handleGlobalMarginChange = (nextMargin: number) => {
    setGlobalMarginPercent(nextMargin);
    setStagingRows((prev) =>
      prev.map((row) => ({
        ...row,
        marginPercent: nextMargin,
      }))
    );
  };

  const handleUpdateStagingRow = (
    tempId: string,
    patch: Partial<StagingQuotaRow>
  ) => {
    setStagingRows((prev) =>
      prev.map((row) => (row.tempId === tempId ? { ...row, ...patch } : row))
    );
  };

  const stagingSummary = useMemo(() => {
    const selected = stagingRows.filter((r) => r.selected);
    let totalNetRub = 0;
    let totalClientRub = 0;
    let totalProfitRub = 0;

    for (const r of selected) {
      const clientHot = computeClientHotPriceFromNet(r.netCostRub, r.marginPercent);
      totalNetRub += r.netCostRub;
      totalClientRub += clientHot;
      totalProfitRub += Math.max(0, clientHot - r.netCostRub);
    }

    return {
      selectedCount: selected.length,
      totalNetRub,
      totalClientRub,
      totalProfitRub,
    };
  }, [stagingRows]);

  // Публикация проверенных строк из Staging Table на живую витрину сайта
  const handlePublishStagingRows = () => {
    const selectedRows = stagingRows.filter((r) => r.selected);
    if (selectedRows.length === 0) {
      setImportFeedback({
        kind: 'error',
        message: 'Отметьте хотя бы одну строку в таблице предпросмотра для публикации на сайт.',
      });
      return;
    }

    const rateCheck = quotaImportRateLimit.recordAttempt('quota_import');
    if (!rateCheck.allowed) {
      setImportFeedback({
        kind: 'error',
        message:
          rateCheck.message ??
          `Слишком частая публикация квот. Подождите ${rateCheck.retryAfterSec} сек.`,
      });
      return;
    }

    const nowTs = Date.now();
    const nextLedger = { ...producerLedger };

    const createdSlots: RadioInventorySlot[] = selectedRows.map((row, idx) => {
      const id = `imp-${nowTs}-${idx}`;
      const spots = Math.max(2, row.spotsIncluded);
      const refSec = row.maxDuration === 15 ? 15 : 20;
      const isSponsorship = row.daypart === 'Спонсорство пробок/погоды';
      const durationMultiplicitySec: SlotDurationMultiplicitySec = isSponsorship ? 5 : 1;
      const slotPricing: SecondBasedPricing = createSecondBasedPricing({
        slotId: id,
        baseQuotaDurationSeconds: refSec,
        spotsIncluded: spots,
        stationPriceBasis: 'package_total',
        stationPriceRub: row.netCostRub,
        multiplicityStepSeconds: durationMultiplicitySec,
        minDurationSeconds: 5,
        maxDurationSeconds: row.maxDuration === 15 ? 20 : 60,
        spotsMultiplicityStep: isSponsorship ? 3 : 1,
        agencyMargin: row.marginPercent,
      });
      const quotaEval = calculateCost(refSec, row.netCostRub, row.marginPercent, {
        stationPriceBasis: 'package_total',
        basePackageSpots: spots,
        basePackageDurationSec: refSec,
        spotsCount: spots,
        multiplicityRules: slotPricing.multiplicityRules,
      });
      const hotPrice = computeClientHotPriceFromNet(row.netCostRub, row.marginPercent);
      const officialPrice = Math.max(row.officialPrice, hotPrice + 15_000);

      nextLedger[id] = {
        netCostRub: row.netCostRub,
        packagesRemaining: Math.max(1, row.packagesRemaining),
      };

      return {
        id,
        station: row.station.trim() || 'Радиостанция',
        frequencyFm: row.frequencyFm,
        formatDesc: row.formatDesc,
        audienceTags: [...row.audienceTags],
        daypart: row.daypart,
        daysPattern: row.daysPattern,
        weekdays: resolveWeekdayNumbers(row.daysPattern),
        sampleTimeSlots: [...row.sampleTimeSlots],
        spotsIncluded: spots,
        maxDuration: row.maxDuration,
        minDurationSec: 5,
        maxSpotSeconds: row.maxDuration === 15 ? 20 : 60,
        durationMultiplicitySec,
        spotsMultiplicityStep: isSponsorship ? 3 : 1,
        stationNetRatePerSec: quotaEval.stationRatePerSecRub,
        officialRatePerSec: Math.round((officialPrice / (spots * refSec)) * 100) / 100,
        fmworksMarginPercent: row.marginPercent,
        secondBasedPricing: slotPricing,
        officialPrice,
        hotPrice,
        reachOTS: row.reachOTS,
        deadlineHours: row.deadlineHours,
        isHidden: false,
        sourceKind: 'imported',
      };
    });

    writeProducerLedger(nextLedger);
    setProducerLedger(nextLedger);
    radioInventoryStore.prependImportedSlots(createdSlots);

    setImportFeedback({
      kind: 'success',
      message: `Опубликовано на витрину: ${createdSlots.length} квот · расчётная комиссия FMWorks +${formatRubCompact(stagingSummary.totalProfitRub)}.`,
    });
    setStagingRows([]);
    setRawImportText('');
  };

  // Быстрый тумблер Активен / Продан (скрыт) во вкладке живых слотов
  const handleToggleSlotStatus = (slot: RadioInventorySlot) => {
    const nextHidden = !slot.isHidden;
    radioInventoryStore.updateSlot(slot.id, { isHidden: nextHidden });

    const currentMeta = resolveSlotProducerMeta(slot, producerLedger);
    updateLedgerEntry(slot.id, {
      packagesRemaining: nextHidden ? 0 : Math.max(1, currentMeta.packagesRemaining || 1),
    });
  };

  // Изменение остатка пакетов на живой витрине
  const handleAdjustSlotPackages = (slot: RadioInventorySlot, nextCountRaw: number) => {
    const nextCount = Math.max(0, Math.min(50, Math.round(nextCountRaw)));
    updateLedgerEntry(slot.id, { packagesRemaining: nextCount });
    if (nextCount === 0 && !slot.isHidden) {
      radioInventoryStore.updateSlot(slot.id, { isHidden: true });
    } else if (nextCount > 0 && slot.isHidden) {
      radioInventoryStore.updateSlot(slot.id, { isHidden: false });
    }
  };

  const handleCreateManualSlot = (e: FormEvent) => {
    e.preventDefault();
    if (manualStation.trim().length < 2) {
      setManualError('Введите название радиостанции.');
      return;
    }
    if (manualHotPrice >= manualOfficialPrice) {
      setManualError('Горящая цена на сайте должна быть ниже официального прайса станции.');
      return;
    }

    const rateCheck = quotaImportRateLimit.recordAttempt('quota_import');
    if (!rateCheck.allowed) {
      setManualError(
        rateCheck.message ??
          `Слишком частое добавление слотов. Подождите ${rateCheck.retryAfterSec} сек.`
      );
      return;
    }

    const tagPreset = MANUAL_TAG_PRESETS[manualTagPresetIdx] ?? MANUAL_TAG_PRESETS[0];
    const sampleTimes = manualDaypart.includes('Вечерний')
      ? ['17:50', '18:40', '19:35']
      : manualDaypart.includes('Дневной')
        ? ['12:30', '14:10', '15:35']
        : manualDaypart.includes('пробок')
          ? ['08:20', '09:15', '18:40']
          : ['08:15', '09:15', '10:05'];

    const created = radioInventoryStore.addManualSlot({
      station: manualStation.trim(),
      frequencyFm: manualFrequency.trim() || '100.0 FM',
      formatDesc: `Прямая эфирная квота · ${tagPreset.label}`,
      audienceTags: [...tagPreset.tags],
      daypart: manualDaypart,
      daysPattern: manualDays.trim() || 'Пн–Пт',
      sampleTimeSlots: sampleTimes,
      spotsIncluded: Math.max(2, manualSpots),
      maxDuration: manualMaxDur,
      officialPrice: manualOfficialPrice,
      hotPrice: manualHotPrice,
      reachOTS: Math.max(20_000, manualOts),
      deadlineHours: 28,
      isHidden: false,
    });

    updateLedgerEntry(created.id, {
      netCostRub: Math.min(manualNetCost, manualHotPrice),
      packagesRemaining: 2,
    });

    setManualStation('');
    setManualError(null);
    setIsManualFormOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="radio-admin-modal-title"
          data-testid="radio-inventory-admin-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-[#111111]/68 dark:bg-black/80 backdrop-blur-xs"
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-6xl max-h-[92vh] flex flex-col rounded-3xl bg-[#F7F6F2] dark:bg-[#141419] text-[#111111] dark:text-[#F4F3EF] border border-[#111111]/14 dark:border-white/14 shadow-2xl overflow-hidden"
          >
            {/* Шапка рабочего стола продюсера + Верхняя финансовая сводка инвентаря */}
            <div className="px-5 sm:px-8 pt-5 pb-4 border-b border-[#111111]/10 dark:border-white/10 space-y-4 shrink-0">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-[#FF4820]">
                    FMWorks Producer Desk · Управление горящим радиоинвентарём и маржинальностью
                  </p>
                  <h2
                    id="radio-admin-modal-title"
                    className="text-xl sm:text-2xl font-bold tracking-tight"
                  >
                    Рабочий пульт эфирных квот
                  </h2>
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto">
                  <div
                    role="tablist"
                    aria-label="Разделы управления базой эфира"
                    className="inline-flex items-center p-1 rounded-xl bg-[#EFECE5] dark:bg-[#1E1E26] border border-[#111111]/8 dark:border-white/10"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === 'smart_import'}
                      data-testid="admin-tab-import"
                      onClick={() => setActiveTab('smart_import')}
                      className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        activeTab === 'smart_import'
                          ? 'bg-white dark:bg-[#111115] text-[#111111] dark:text-[#F4F3EF]'
                          : 'text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#111111] dark:hover:text-white'
                      }`}
                    >
                      Умный парсер и расчёт прибыли
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === 'manage_quotas'}
                      data-testid="admin-tab-quotas"
                      onClick={() => setActiveTab('manage_quotas')}
                      className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        activeTab === 'manage_quotas'
                          ? 'bg-white dark:bg-[#111115] text-[#111111] dark:text-[#F4F3EF]'
                          : 'text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#111111] dark:hover:text-white'
                      }`}
                    >
                      Живые слоты на витрине ({inventoryMetrics.activeCount}/{inventoryMetrics.totalCount})
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Закрыть управление базой эфира"
                    className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#111111]/8 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-5 h-5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* 3. Общая сводка наверху админки: объём инвентаря и потенциальная комиссия FMWorks */}
              <div
                data-testid="producer-top-summary"
                className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-2xl bg-[#EFECE5] dark:bg-[#1B1B23] border border-[#111111]/8 dark:border-white/10 px-4 py-3 tabular-nums"
              >
                <div>
                  <div className="text-[11px] font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58">
                    Активно на витрине сайта
                  </div>
                  <div className="text-base sm:text-lg font-bold text-[#111111] dark:text-white">
                    {inventoryMetrics.activeCount} квот · {inventoryMetrics.totalPackagesOnShowcase}{' '}
                    пакетов
                    {inventoryMetrics.soldHiddenCount > 0 && (
                      <span className="text-xs font-normal text-[#111111]/52 dark:text-[#F4F3EF]/52">
                        {' '}
                        ({inventoryMetrics.soldHiddenCount} продано)
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58">
                    Объём горящего инвентаря (в ценах витрины)
                  </div>
                  <div
                    data-testid="producer-total-inventory-rub"
                    className="text-base sm:text-lg font-bold text-[#111111] dark:text-white"
                  >
                    {formatRubCompact(inventoryMetrics.totalShowcaseClientRub)}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58">
                    Потенциальная суммарная комиссия FMWorks
                  </div>
                  <div
                    data-testid="producer-total-commission-rub"
                    className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-400"
                  >
                    +{formatRubCompact(inventoryMetrics.totalPotentialCommissionRub)}
                  </div>
                </div>
              </div>
            </div>

            {/* Основная рабочая область */}
            <div className="p-5 sm:p-8 overflow-y-auto subtle-scrollbar space-y-6 flex-1">
              {activeTab === 'smart_import' ? (
                <div className="space-y-6">
                  {/* Заголовок + 3 кнопки быстрых пресетов */}
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <h3 className="text-base sm:text-lg font-bold tracking-tight">
                        Всеядный импорт (Copy-Paste из Excel / Google Таблиц и Telegram)
                      </h3>
                      <p className="text-xs sm:text-sm text-[#111111]/65 dark:text-[#F4F3EF]/65">
                        Вставьте столбцы из Excel (с табуляцией) или свободное сообщение сейлза —
                        парсер выделит прайс, входное нетто, теги ЦА и откроет калькулятор нашей прибыли перед публикацией.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        data-testid="preset-telegram-btn"
                        onClick={() => handleRunOmnivorousParse(PRESET_1_TELEGRAM_SALES)}
                        className="min-h-[38px] px-3.5 py-2 rounded-xl bg-[#EFECE5] dark:bg-[#22222B] hover:bg-[#111111] hover:text-white dark:hover:bg-white dark:hover:text-[#111111] border border-[#111111]/12 dark:border-white/14 text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-[#FF4820]" aria-hidden="true" />
                        <span>Пример 1: Сообщение из Telegram от сейлза</span>
                      </button>

                      <button
                        type="button"
                        data-testid="preset-excel-btn"
                        onClick={() => handleRunOmnivorousParse(PRESET_2_EXCEL_TSV)}
                        className="min-h-[38px] px-3.5 py-2 rounded-xl bg-[#EFECE5] dark:bg-[#22222B] hover:bg-[#111111] hover:text-white dark:hover:bg-white dark:hover:text-[#111111] border border-[#111111]/12 dark:border-white/14 text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-[#FF4820]" aria-hidden="true" />
                        <span>Пример 2: Копия строк из Excel-таблицы холдинга</span>
                      </button>

                      <button
                        type="button"
                        data-testid="preset-traffic-btn"
                        onClick={() => handleRunOmnivorousParse(PRESET_3_URGENT_TRAFFIC)}
                        className="min-h-[38px] px-3.5 py-2 rounded-xl bg-[#EFECE5] dark:bg-[#22222B] hover:bg-[#111111] hover:text-white dark:hover:bg-white dark:hover:text-[#111111] border border-[#111111]/12 dark:border-white/14 text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Zap className="w-3.5 h-3.5 text-[#FF4820]" aria-hidden="true" />
                        <span>Пример 3: Срочное спонсорство пробок</span>
                      </button>
                    </div>
                  </div>

                  {/* Поле ввода сырого текста или таблицы */}
                  <div className="space-y-2">
                    <label htmlFor="raw-radio-dump-textarea" className="sr-only">
                      Сырой текст из Telegram или скопированные строки из Excel
                    </label>
                    <textarea
                      id="raw-radio-dump-textarea"
                      data-testid="raw-radio-dump-textarea"
                      rows={4}
                      value={rawImportText}
                      onChange={(e) => handleRunOmnivorousParse(e.target.value)}
                      placeholder={`Вставьте сюда строки из Excel (Ctrl+V) или сообщение сейлза из Telegram:\nАвторадио утренний драйв 15 выходов прайс 210000 отдадим за 125000 хрон 30с дедлайн 36ч`}
                      className="w-full p-4 rounded-2xl bg-white dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs sm:text-sm font-mono leading-relaxed focus:outline-none focus:border-[#FF4820]"
                    />
                  </div>

                  {/* Единый регулятор базовой комиссии для всей партии */}
                  <div className="rounded-2xl bg-[#EFECE5] dark:bg-[#1C1C24] border border-[#111111]/10 dark:border-white/10 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-5">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between gap-4 text-xs sm:text-sm">
                        <label htmlFor="agency-margin-slider" className="font-semibold">
                          Базовая наценка / комиссия FMWorks для всех распознанных строк
                        </label>
                        <output
                          htmlFor="agency-margin-slider"
                          className="text-lg font-bold text-[#FF4820] tabular-nums"
                        >
                          +{globalMarginPercent}%
                        </output>
                      </div>
                      <input
                        id="agency-margin-slider"
                        type="range"
                        min={10}
                        max={40}
                        step={1}
                        value={globalMarginPercent}
                        onChange={(e) => handleGlobalMarginChange(Number(e.target.value))}
                        className="w-full h-2 rounded-full appearance-none bg-[#111111]/15 dark:bg-white/16 accent-[#FF4820] cursor-pointer"
                      />
                      <div className="flex justify-between text-[11px] text-[#111111]/52 dark:text-[#F4F3EF]/52 tabular-nums">
                        <span>10% (крупный объём)</span>
                        <span>20% (стандарт FMWorks)</span>
                        <span>40% (эксклюзивный слив)</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRunOmnivorousParse(rawImportText)}
                      className="min-h-[42px] px-5 py-2.5 rounded-full bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#111111] text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Пересобрать таблицу предпросмотра
                    </button>
                  </div>

                  {/* 2. STAGING TABLE: Редактируемый предпросмотр и калькулятор чистой прибыли перед публикацией */}
                  {stagingRows.length > 0 && (
                    <div
                      data-testid="staging-preview-section"
                      className="rounded-3xl bg-white dark:bg-[#111116] border border-[#111111]/14 dark:border-white/14 p-4 sm:p-6 space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-[#FF4820]">
                            Этап предпросмотра · Проверка экономики перед выгрузкой на сайт
                          </p>
                          <h4 className="text-base sm:text-lg font-bold tracking-tight">
                            Распознано {stagingRows.length} слотов · Выбрано к публикации:{' '}
                            {stagingSummary.selectedCount}
                          </h4>
                        </div>

                        <div className="text-left sm:text-right text-xs tabular-nums space-y-0.5">
                          <div className="text-[#111111]/60 dark:text-[#F4F3EF]/60">
                            Вход нетто партии: {formatRubCompact(stagingSummary.totalNetRub)}
                          </div>
                          <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                            Чистая прибыль FMWorks с партии: +
                            {formatRubCompact(stagingSummary.totalProfitRub)}
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto subtle-scrollbar">
                        <table className="w-full min-w-[920px] text-left text-xs border-collapse tabular-nums">
                          <thead>
                            <tr className="border-b border-[#111111]/10 dark:border-white/10 text-[11px] font-semibold text-[#111111]/58 dark:text-[#F4F3EF]/58">
                              <th className="py-2.5 pr-2 w-8">Выб.</th>
                              <th className="py-2.5 px-2">Радиостанция и ЦА-теги</th>
                              <th className="py-2.5 px-2">Офиц. прайс (₽)</th>
                              <th className="py-2.5 px-2">Вход Нетто FMWorks (₽)</th>
                              <th className="py-2.5 px-3 min-w-[205px]">
                                Наценка FMWorks (%) и прибыль
                              </th>
                              <th className="py-2.5 pl-2 text-right">
                                Горящая цена клиента и выгода
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#111111]/8 dark:divide-white/8">
                            {stagingRows.map((row) => {
                              const clientHotPrice = computeClientHotPriceFromNet(
                                row.netCostRub,
                                row.marginPercent
                              );
                              const netProfitRub = Math.max(0, clientHotPrice - row.netCostRub);
                              const clientDiscountPct = computeSlotDiscountPercent({
                                officialPrice: row.officialPrice,
                                hotPrice: clientHotPrice,
                              });
                              const isHealthyClientDiscount = clientDiscountPct >= 20;

                              return (
                                <tr
                                  key={row.tempId}
                                  data-testid="staging-row"
                                  className={!row.selected ? 'opacity-45' : ''}
                                >
                                  <td className="py-3 pr-2 align-top pt-4">
                                    <input
                                      type="checkbox"
                                      checked={row.selected}
                                      onChange={(e) =>
                                        handleUpdateStagingRow(row.tempId, {
                                          selected: e.target.checked,
                                        })
                                      }
                                      aria-label={`Выбрать ${row.station} для публикации`}
                                      className="w-4 h-4 rounded accent-[#FF4820] cursor-pointer"
                                    />
                                  </td>

                                  <td className="py-3 px-2 align-top space-y-1">
                                    <input
                                      type="text"
                                      value={row.station}
                                      onChange={(e) =>
                                        handleUpdateStagingRow(row.tempId, {
                                          station: e.target.value,
                                        })
                                      }
                                      aria-label="Название радиостанции"
                                      className="w-44 h-8 px-2.5 rounded-lg bg-[#F7F6F2] dark:bg-[#1B1B23] border border-[#111111]/12 dark:border-white/14 font-bold text-xs"
                                    />
                                    <div className="text-[11px] text-[#111111]/60 dark:text-[#F4F3EF]/60">
                                      {row.daypart} · {row.spotsIncluded} вых. · до{' '}
                                      {row.maxDuration}с · {row.deadlineHours}ч
                                    </div>
                                    <div className="text-[10px] text-[#FF4820] font-medium">
                                      Теги ЦА: {row.audienceTags.join(' · ')}
                                    </div>
                                  </td>

                                  <td className="py-3 px-2 align-top">
                                    <input
                                      type="number"
                                      step={1000}
                                      value={row.officialPrice}
                                      onChange={(e) =>
                                        handleUpdateStagingRow(row.tempId, {
                                          officialPrice: Math.max(
                                            20_000,
                                            Number(e.target.value) || 0
                                          ),
                                        })
                                      }
                                      aria-label={`Официальный прайс ${row.station}`}
                                      className="w-28 h-8 px-2.5 rounded-lg bg-[#F7F6F2] dark:bg-[#1B1B23] border border-[#111111]/12 dark:border-white/14 font-medium"
                                    />
                                  </td>

                                  <td className="py-3 px-2 align-top">
                                    <input
                                      type="number"
                                      step={1000}
                                      value={row.netCostRub}
                                      onChange={(e) =>
                                        handleUpdateStagingRow(row.tempId, {
                                          netCostRub: Math.max(
                                            10_000,
                                            Number(e.target.value) || 0
                                          ),
                                        })
                                      }
                                      aria-label={`Входная цена нетто ${row.station}`}
                                      className="w-28 h-8 px-2.5 rounded-lg bg-[#F7F6F2] dark:bg-[#1B1B23] border border-[#111111]/12 dark:border-white/14 font-semibold"
                                    />
                                  </td>

                                  <td className="py-3 px-3 align-top space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-bold text-[#111111] dark:text-white">
                                        +{row.marginPercent}%
                                      </span>
                                      <span
                                        data-testid="staging-row-profit"
                                        className="font-bold text-emerald-700 dark:text-emerald-400"
                                      >
                                        Прибыль: +{formatRubCompact(netProfitRub)}
                                      </span>
                                    </div>
                                    <input
                                      type="range"
                                      min={8}
                                      max={50}
                                      step={1}
                                      value={row.marginPercent}
                                      onChange={(e) =>
                                        handleUpdateStagingRow(row.tempId, {
                                          marginPercent: Number(e.target.value),
                                        })
                                      }
                                      aria-label={`Комиссия FMWorks для ${row.station}`}
                                      className="w-full h-1.5 rounded-full appearance-none bg-[#111111]/15 dark:bg-white/16 accent-[#FF4820] cursor-pointer"
                                    />
                                  </td>

                                  <td className="py-3 pl-2 align-top text-right space-y-1">
                                    <div className="text-sm font-bold text-[#111111] dark:text-white">
                                      {formatRubCompact(clientHotPrice)}
                                    </div>
                                    <div className="text-[10px] text-[#111111]/55 dark:text-[#F4F3EF]/55">
                                      {(() => {
                                        const refDur = row.maxDuration === 15 ? 15 : 20;
                                        const rowPricing = createSecondBasedPricing({
                                          slotId: row.tempId,
                                          baseQuotaDurationSeconds: refDur,
                                          spotsIncluded: Math.max(2, row.spotsIncluded),
                                          stationPriceBasis: 'package_total',
                                          stationPriceRub: row.netCostRub,
                                          multiplicityStepSeconds:
                                            row.daypart === 'Спонсорство пробок/погоды' ? 5 : 1,
                                          maxDurationSeconds: row.maxDuration === 15 ? 20 : 60,
                                          agencyMargin: row.marginPercent,
                                        });
                                        const dyn17 = rowPricing.calculateCost(
                                          17,
                                          row.netCostRub,
                                          row.marginPercent
                                        );
                                        return `${Math.round(dyn17.clientRatePerSecRub)} ₽/сек · 17с = ${formatRubCompact(dyn17.singleSpotClientPriceRub)}/вых.`;
                                      })()}
                                    </div>
                                    <div>
                                      <span
                                        className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap ${
                                          isHealthyClientDiscount
                                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                        }`}
                                      >
                                        {isHealthyClientDiscount
                                          ? `Скидка клиенту −${clientDiscountPct}%`
                                          : `Малая скидка −${clientDiscountPct}%`}
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="pt-3 border-t border-[#111111]/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <span className="block text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60">
                            Зелёный индикатор подтверждает, что клиент получает честную выгоду не менее 20% от прайса станции.
                          </span>
                          <span
                            data-testid="quota-import-rate-status"
                            className="block text-[11px] font-medium text-[#111111]/54 dark:text-[#F4F3EF]/54 tabular-nums"
                          >
                            Защита от дублей импорта (useRateLimit): доступно публикаций{' '}
                            {quotaImportRateLimit.remainingAttempts} из{' '}
                            {quotaImportRateLimit.maxAttempts}
                            {quotaImportRateLimit.isRateLimited
                              ? ` · пауза ${quotaImportRateLimit.countdownSec} сек`
                              : ''}
                          </span>
                        </div>

                        <button
                          type="button"
                          data-testid="publish-staging-slots-btn"
                          onClick={handlePublishStagingRows}
                          className="min-h-[44px] px-6 py-2.5 rounded-full bg-[#FF4820] hover:bg-[#E63E19] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>
                            {quotaImportRateLimit.isRateLimited
                              ? `Повторная публикация через ${quotaImportRateLimit.countdownSec} сек`
                              : `Опубликовать выбранные квоты на витрину (${stagingSummary.selectedCount})`}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {importFeedback && (
                    <div
                      role="status"
                      data-testid="import-feedback-banner"
                      className={`rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm font-medium ${
                        importFeedback.kind === 'success'
                          ? 'bg-[#111111] text-[#F7F6F2] dark:bg-white dark:text-[#111111]'
                          : 'bg-[#FF4820]/12 text-[#FF4820] border border-[#FF4820]/30'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {importFeedback.kind === 'success' && (
                          <CheckCircle2
                            className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                        <span>{importFeedback.message}</span>
                      </div>

                      {importFeedback.kind === 'success' && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('manage_quotas')}
                          className="underline underline-offset-4 text-xs font-semibold shrink-0 cursor-pointer"
                        >
                          Перейти к живым слотам витрины
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Вкладка 2: Управление живыми слотами витрины */
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold tracking-tight">
                        Управление живыми слотами на витрине
                      </h3>
                      <p className="text-xs text-[#111111]/62 dark:text-[#F4F3EF]/62">
                        Тумблер «Активен / Продан», редактирование остатка пакетов и цен мгновенно
                        синхронизированы с конструктором на сайте.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsManualFormOpen((prev) => !prev)}
                        className="min-h-[38px] px-4 py-2 rounded-full bg-[#FF4820] hover:bg-[#E63E19] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Добавить слот вручную</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          radioInventoryStore.resetToDefaults();
                          setProducerLedger({});
                          writeProducerLedger({});
                        }}
                        className="min-h-[38px] px-3.5 py-2 rounded-full border border-[#111111]/15 dark:border-white/15 text-xs font-medium hover:border-[#FF4820] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Сброс к 12 базовым</span>
                      </button>
                    </div>
                  </div>

                  {isManualFormOpen && (
                    <form
                      onSubmit={handleCreateManualSlot}
                      className="rounded-2xl bg-[#EFECE5] dark:bg-[#1C1C24] border border-[#111111]/12 dark:border-white/12 p-4 sm:p-5 space-y-4"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-semibold opacity-70">
                            Радиостанция *
                          </label>
                          <input
                            type="text"
                            value={manualStation}
                            onChange={(e) => setManualStation(e.target.value)}
                            placeholder="Например: Радио 7"
                            className="w-full h-9 px-3 rounded-lg bg-white dark:bg-[#0D0D0F] border border-[#111111]/15 dark:border-white/15 text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[11px] font-semibold opacity-70">
                            Тайм-слот
                          </label>
                          <select
                            value={manualDaypart}
                            onChange={(e) => setManualDaypart(e.target.value as DaypartLabel)}
                            className="w-full h-9 px-2.5 rounded-lg bg-white dark:bg-[#0D0D0F] border border-[#111111]/15 dark:border-white/15 text-xs"
                          >
                            {DAYPART_OPTIONS.map((dp) => (
                              <option key={dp} value={dp}>
                                {dp}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[11px] font-semibold opacity-70">
                            Профиль аудитории
                          </label>
                          <select
                            value={manualTagPresetIdx}
                            onChange={(e) => setManualTagPresetIdx(Number(e.target.value))}
                            className="w-full h-9 px-2.5 rounded-lg bg-white dark:bg-[#0D0D0F] border border-[#111111]/15 dark:border-white/15 text-xs"
                          >
                            {MANUAL_TAG_PRESETS.map((preset, idx) => (
                              <option key={preset.label} value={idx}>
                                {preset.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="block text-[11px] font-semibold opacity-70">
                              Дни
                            </label>
                            <input
                              type="text"
                              value={manualDays}
                              onChange={(e) => setManualDays(e.target.value)}
                              className="w-full h-9 px-2.5 rounded-lg bg-white dark:bg-[#0D0D0F] border border-[#111111]/15 dark:border-white/15 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[11px] font-semibold opacity-70">
                              Выходов
                            </label>
                            <input
                              type="number"
                              min={2}
                              max={200}
                              value={manualSpots}
                              onChange={(e) => setManualSpots(Number(e.target.value))}
                              className="w-full h-9 px-2.5 rounded-lg bg-white dark:bg-[#0D0D0F] border border-[#111111]/15 dark:border-white/15 text-xs tabular-nums"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[11px] font-semibold opacity-70">
                            Прайс станции (₽)
                          </label>
                          <input
                            type="number"
                            step={1000}
                            value={manualOfficialPrice}
                            onChange={(e) => setManualOfficialPrice(Number(e.target.value))}
                            className="w-full h-9 px-3 rounded-lg bg-white dark:bg-[#0D0D0F] border border-[#111111]/15 dark:border-white/15 text-xs tabular-nums"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[11px] font-semibold opacity-70">
                            Вход Нетто FMWorks (₽)
                          </label>
                          <input
                            type="number"
                            step={1000}
                            value={manualNetCost}
                            onChange={(e) => setManualNetCost(Number(e.target.value))}
                            className="w-full h-9 px-3 rounded-lg bg-white dark:bg-[#0D0D0F] border border-[#111111]/15 dark:border-white/15 text-xs tabular-nums"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[11px] font-semibold opacity-70">
                            Горящая цена витрины (₽)
                          </label>
                          <input
                            type="number"
                            step={1000}
                            value={manualHotPrice}
                            onChange={(e) => setManualHotPrice(Number(e.target.value))}
                            className="w-full h-9 px-3 rounded-lg bg-white dark:bg-[#0D0D0F] border border-[#111111]/15 dark:border-white/15 text-xs tabular-nums"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="block text-[11px] font-semibold opacity-70">
                              Хрон.
                            </label>
                            <select
                              value={manualMaxDur}
                              onChange={(e) =>
                                setManualMaxDur(Number(e.target.value) === 15 ? 15 : 30)
                              }
                              className="w-full h-9 px-2 rounded-lg bg-white dark:bg-[#0D0D0F] border border-[#111111]/15 dark:border-white/15 text-xs"
                            >
                              <option value={15}>15 сек</option>
                              <option value={30}>30 сек</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[11px] font-semibold opacity-70">
                              OTS
                            </label>
                            <input
                              type="number"
                              step={5000}
                              value={manualOts}
                              onChange={(e) => setManualOts(Number(e.target.value))}
                              className="w-full h-9 px-2.5 rounded-lg bg-white dark:bg-[#0D0D0F] border border-[#111111]/15 dark:border-white/15 text-xs tabular-nums"
                            />
                          </div>
                        </div>
                      </div>

                      {manualError && (
                        <p
                          role="alert"
                          data-testid="quota-manual-error"
                          className="text-xs font-semibold text-[#FF4820]"
                        >
                          {manualError}
                        </p>
                      )}

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsManualFormOpen(false)}
                          className="px-4 py-2 rounded-full text-xs font-medium opacity-70 hover:opacity-100 cursor-pointer"
                        >
                          Отмена
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 rounded-full bg-[#111111] text-white dark:bg-white dark:text-[#111111] text-xs font-semibold cursor-pointer"
                        >
                          Сохранить в сетку
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Таблица управления живыми слотами */}
                  <div className="overflow-x-auto subtle-scrollbar rounded-2xl border border-[#111111]/10 dark:border-white/10 bg-white dark:bg-[#111115]">
                    <table className="w-full min-w-[900px] text-left text-xs border-collapse tabular-nums">
                      <thead>
                        <tr className="border-b border-[#111111]/10 dark:border-white/10 text-[11px] font-semibold text-[#111111]/55 dark:text-[#F4F3EF]/55">
                          <th className="py-3 px-4">Радиостанция и блок</th>
                          <th className="py-3 px-3">Остаток пакетов</th>
                          <th className="py-3 px-3">Цена витрины (₽)</th>
                          <th className="py-3 px-3">Комиссия FMWorks</th>
                          <th className="py-3 px-3">Дедлайн (ч)</th>
                          <th className="py-3 px-4 text-right">Тумблер витрины</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#111111]/8 dark:divide-white/8">
                        {slots.map((slot) => {
                          const disc = computeSlotDiscountPercent(slot);
                          const meta = resolveSlotProducerMeta(slot, producerLedger);
                          const unitCommission = Math.max(0, slot.hotPrice - meta.netCostRub);

                          return (
                            <tr
                              key={slot.id}
                              className={
                                slot.isHidden ? 'opacity-50 bg-[#111111]/[0.025] dark:bg-white/[0.02]' : ''
                              }
                            >
                              <td className="py-3 px-4 min-w-[215px]">
                                <div className="font-bold text-sm text-[#111111] dark:text-[#F4F3EF]">
                                  {slot.station}{' '}
                                  <span className="font-normal text-xs opacity-60">
                                    · {slot.frequencyFm}
                                  </span>
                                </div>
                                <div className="text-[11px] text-[#111111]/58 dark:text-[#F4F3EF]/58">
                                  {slot.daypart} · {slot.daysPattern} · {slot.spotsIncluded} вых. ·{' '}
                                  {formatNumberSpaced(slot.reachOTS)} OTS
                                </div>
                              </td>

                              <td className="py-3 px-3">
                                <div className="inline-flex items-center rounded-lg border border-[#111111]/14 dark:border-white/14 bg-[#F7F6F2] dark:bg-[#1B1B22]">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleAdjustSlotPackages(
                                        slot,
                                        meta.packagesRemaining - 1
                                      )
                                    }
                                    aria-label={`Уменьшить остаток пакетов ${slot.station}`}
                                    className="w-7 h-8 inline-flex items-center justify-center hover:text-[#FF4820] cursor-pointer"
                                  >
                                    <Minus className="w-3 h-3" aria-hidden="true" />
                                  </button>
                                  <input
                                    type="number"
                                    min={0}
                                    max={50}
                                    aria-label={`Остаток пакетов для ${slot.station}`}
                                    value={meta.packagesRemaining}
                                    onChange={(e) =>
                                      handleAdjustSlotPackages(slot, Number(e.target.value))
                                    }
                                    className="w-10 h-8 text-center bg-transparent font-bold text-xs focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleAdjustSlotPackages(
                                        slot,
                                        meta.packagesRemaining + 1
                                      )
                                    }
                                    aria-label={`Увеличить остаток пакетов ${slot.station}`}
                                    className="w-7 h-8 inline-flex items-center justify-center hover:text-[#FF4820] cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" aria-hidden="true" />
                                  </button>
                                </div>
                              </td>

                              <td className="py-3 px-3 space-y-1">
                                <input
                                  type="number"
                                  step={1000}
                                  min={15000}
                                  aria-label={`Горящая цена для ${slot.station}`}
                                  value={slot.hotPrice}
                                  onChange={(e) =>
                                    radioInventoryStore.updateSlot(slot.id, {
                                      hotPrice: Number(e.target.value),
                                    })
                                  }
                                  className="w-28 h-8 px-2.5 rounded-lg bg-[#F7F6F2] dark:bg-[#1B1B22] border border-[#111111]/14 dark:border-white/14 text-xs font-bold"
                                />
                                <div className="text-[10px] text-[#111111]/50 dark:text-[#F4F3EF]/50">
                                  Прайс {formatRubCompact(slot.officialPrice)} (−{disc}%)
                                </div>
                              </td>

                              <td className="py-3 px-3">
                                <div className="font-bold text-emerald-700 dark:text-emerald-400">
                                  +{formatRubCompact(unitCommission)} / пакет
                                </div>
                                <div className="text-[10px] text-[#111111]/52 dark:text-[#F4F3EF]/52">
                                  Вход нетто: {formatRubCompact(meta.netCostRub)}
                                </div>
                              </td>

                              <td className="py-3 px-3">
                                <input
                                  type="number"
                                  min={1}
                                  max={96}
                                  aria-label={`Дедлайн часов для ${slot.station}`}
                                  value={slot.deadlineHours}
                                  onChange={(e) =>
                                    radioInventoryStore.updateSlot(slot.id, {
                                      deadlineHours: Number(e.target.value),
                                    })
                                  }
                                  className="w-16 h-8 px-2 rounded-lg bg-[#F7F6F2] dark:bg-[#1B1B22] border border-[#111111]/14 dark:border-white/14 text-xs font-semibold"
                                />
                              </td>

                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-2">
                                  {/* Быстрый тумблер Активен / Продан (скрыт) */}
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={!slot.isHidden}
                                    data-testid={`toggle-slot-status-${slot.id}`}
                                    onClick={() => handleToggleSlotStatus(slot)}
                                    className={`h-8 px-3 rounded-full text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer border ${
                                      !slot.isHidden
                                        ? 'bg-emerald-500/14 text-emerald-800 dark:text-emerald-300 border-emerald-500/35'
                                        : 'bg-[#EFECE5] dark:bg-[#22222B] text-[#111111]/62 dark:text-[#F4F3EF]/62 border-[#111111]/14 dark:border-white/14'
                                    }`}
                                  >
                                    <span
                                      className={`w-2 h-2 rounded-full ${
                                        !slot.isHidden
                                          ? 'bg-emerald-600 dark:bg-emerald-400'
                                          : 'bg-[#111111]/35 dark:bg-white/35'
                                      }`}
                                    />
                                    <span>{!slot.isHidden ? 'Активен' : 'Продан (скрыт)'}</span>
                                  </button>

                                  {slot.sourceKind !== 'seed' && (
                                    <button
                                      type="button"
                                      onClick={() => radioInventoryStore.removeSlot(slot.id)}
                                      aria-label={`Удалить слот ${slot.station}`}
                                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#111111]/55 dark:text-[#F4F3EF]/55 hover:text-[#FF4820] cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
