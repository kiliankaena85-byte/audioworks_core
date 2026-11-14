import type { RecommendedTier } from '../engine/layaTypes.ts';

export type OrderFormatId = RecommendedTier | 'adaptation' | 'custom_consult';

export interface EditorialPricingRow {
  id: RecommendedTier;
  title: string;
  badgeHit?: string;
  description: string;
  priceFormatted: string;
  priceRub: number;
  turnaround: string;
}

export interface CustomConsultPricingRow {
  id: 'custom_consult';
  title: string;
  badgeHit?: string;
  description: string;
  priceFormatted: string;
  priceRub: number;
  turnaround: string;
}

export const EDITORIAL_PRICING_ROWS: EditorialPricingRow[] = [
  {
    id: 'voice_style',
    title: 'Голос и стиль',
    description:
      'Когда у вас уже есть текст. После договора и предоплаты адаптируем фразы под живую речь, запишем характерного актёра, сведём с лицензионной музыкой и выдадим паспорт ролика.',
    priceFormatted: '15 000 ₽',
    priceRub: 15000,
    turnaround: '24–48 ч',
  },
  {
    id: 'turnkey',
    title: 'Продакшн под ключ',
    badgeHit: 'Основной формат',
    description:
      'Полный цикл с нуля по рамочному договору и предоплате: 3 концепции сценария, режиссёрская запись, фирменное звуковое оформление, проверка дисклеймеров ФЗ-38 и паспорт прав.',
    priceFormatted: '25 000 ₽',
    priceRub: 25000,
    turnaround: '3–4 дня',
  },
  {
    id: 'cinema',
    title: 'Игровой ролик / Мини-кино',
    description:
      'Сюжетная сценка на 2–3 актёрских голоса, объёмная атмосфера и саунд-дизайн, полная очистка прав для эфира и эфирный ресайз 15 сек в комплекте.',
    priceFormatted: '35 000 ₽',
    priceRub: 35000,
    turnaround: '4–5 дней',
  },
];

export const CUSTOM_CONSULT_PRICING_ROW: CustomConsultPricingRow = {
  id: 'custom_consult',
  title: 'Индивидуальный проект',
  badgeHit: 'Договорная цена · Консультация',
  description:
    'Для нестандартных задач, пакетов из нескольких роликов, выделенного этапа «Только сценарий» или если сначала хочется обсудить задачу с живым продюсером. Опишите запрос без фиксации цены — согласуем смету до договора и оплаты.',
  priceFormatted: 'Договорная цена',
  priceRub: 0,
  turnaround: 'По оценке',
};

export interface QuickOrderPill {
  id: OrderFormatId;
  label: string;
  shortSummary: string;
}

export const QUICK_ORDER_PILLS: QuickOrderPill[] = [
  {
    id: 'voice_style',
    label: 'Голос и стиль (15 000 ₽)',
    shortSummary: '15 000 ₽ • 24–48 ч после оплаты',
  },
  {
    id: 'turnkey',
    label: 'Под ключ (25 000 ₽)',
    shortSummary: '25 000 ₽ • 3–4 дня после оплаты',
  },
  {
    id: 'cinema',
    label: 'Игровой (35 000 ₽)',
    shortSummary: '35 000 ₽ • 4–5 дней после оплаты',
  },
  {
    id: 'adaptation',
    label: 'Адаптация прошлого ролика',
    shortSummary: 'Обновление акции / дат / условий',
  },
  {
    id: 'custom_consult',
    label: 'Индивидуальный проект · Консультация',
    shortSummary: 'Договорная цена • Нестандарт, только сценарий или разбор ТЗ',
  },
];

export function getStudioFormatDisplayMeta(formatId: OrderFormatId): {
  title: string;
  priceFormatted: string;
  priceRub: number;
  turnaround: string;
  isNegotiable: boolean;
} {
  const editorial = EDITORIAL_PRICING_ROWS.find((row) => row.id === formatId);
  if (editorial) {
    return {
      title: editorial.title,
      priceFormatted: editorial.priceFormatted,
      priceRub: editorial.priceRub,
      turnaround: editorial.turnaround,
      isNegotiable: false,
    };
  }
  if (formatId === 'custom_consult') {
    return {
      title: CUSTOM_CONSULT_PRICING_ROW.title,
      priceFormatted: CUSTOM_CONSULT_PRICING_ROW.priceFormatted,
      priceRub: 0,
      turnaround: 'Согласуем с продюсером',
      isNegotiable: true,
    };
  }
  return {
    title: 'Адаптация прошлого ролика',
    priceFormatted: 'По оценке задачи',
    priceRub: 0,
    turnaround: '24 часа после оплаты',
    isNegotiable: true,
  };
}

export interface SavedVipProfile {
  contactLine: string;
  company: string;
}

export const VIP_STORAGE_KEY = 'fmworks_vip_client_v1';

export function readSavedVipProfile(storage?: Pick<Storage, 'getItem'>): SavedVipProfile | null {
  const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!store) return null;
  try {
    const raw = store.getItem(VIP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedVipProfile>;
    if (typeof parsed.contactLine === 'string' && parsed.contactLine.trim().length >= 3) {
      return {
        contactLine: parsed.contactLine.trim(),
        company: typeof parsed.company === 'string' ? parsed.company.trim() : '',
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeSavedVipProfile(
  profile: SavedVipProfile,
  storage?: Pick<Storage, 'setItem'>
): void {
  const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!store) return;
  try {
    store.setItem(
      VIP_STORAGE_KEY,
      JSON.stringify({
        contactLine: profile.contactLine.trim(),
        company: profile.company.trim(),
      })
    );
  } catch {
    // Ignore storage quota errors
  }
}

export interface QuickOrderValidationInput {
  contactLine: string;
  briefText: string;
  hasVoiceRecording: boolean;
  hasAttachedFile: boolean;
  isReturningClientWithSavedProfile: boolean;
}

export function validateQuickOrder(input: QuickOrderValidationInput): {
  valid: boolean;
  contactError?: string;
  taskError?: string;
} {
  let contactError: string | undefined;
  let taskError: string | undefined;

  if (!input.isReturningClientWithSavedProfile && input.contactLine.trim().length < 4) {
    contactError = 'Укажите имя и телефон или @Telegram для связи';
  }

  // Для постоянного клиента или при наличии голоса/файла/текста заказ проходит мгновенно;
  // если совсем пусто в новом проекте — мягко просим хотя бы пару слов или голосовое.
  if (
    !input.isReturningClientWithSavedProfile &&
    !input.hasVoiceRecording &&
    !input.hasAttachedFile &&
    input.briefText.trim().length < 3
  ) {
    taskError = 'Надиктуйте задачу голосом, прикрепите файл или напишите пару слов о ролике';
  }

  return {
    valid: !contactError && !taskError,
    contactError,
    taskError,
  };
}

export function generateOrderNumber(seed = Date.now()): string {
  const num = 2400 + (seed % 700);
  return `FM-${num}`;
}
