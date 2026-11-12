import { RecommendedTier } from '../engine/layaTypes';

export type OrderFormatId = RecommendedTier | 'adaptation';

export interface EditorialPricingRow {
  id: RecommendedTier;
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
      'Когда у вас уже есть текст. Адаптируем фразы под живую речь, запишем характерного актера, сведем с лицензионной музыкой и выдадим паспорт ролика.',
    priceFormatted: '15 000 ₽',
    priceRub: 15000,
    turnaround: '24–48 ч',
  },
  {
    id: 'turnkey',
    title: 'Продакшн под ключ',
    badgeHit: 'Основной формат',
    description:
      'Полный цикл с нуля: разработаем концепцию и 3 сценария, проведём режиссёрскую запись, создадим фирменное звуковое оформление и проверим юридические нюансы.',
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

export interface QuickOrderPill {
  id: OrderFormatId;
  label: string;
  shortSummary: string;
}

export const QUICK_ORDER_PILLS: QuickOrderPill[] = [
  {
    id: 'voice_style',
    label: 'Голос и стиль (15 000 ₽)',
    shortSummary: '15 000 ₽ • 24–48 ч',
  },
  {
    id: 'turnkey',
    label: 'Под ключ (25 000 ₽)',
    shortSummary: '25 000 ₽ • 3–4 дня',
  },
  {
    id: 'cinema',
    label: 'Игровой (35 000 ₽)',
    shortSummary: '35 000 ₽ • 4–5 дней',
  },
  {
    id: 'adaptation',
    label: 'Адаптация прошлого ролика',
    shortSummary: 'Обновление акции / дат / условий',
  },
];

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
