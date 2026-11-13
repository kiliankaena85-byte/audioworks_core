import { FlexibleMediaPlanResult, formatAudienceSummaryLine } from './mediaPlannerCore';
import {
  ComputedReservationTotals,
  formatHoldCountdown,
  formatNumberSpaced,
  formatRubCompact,
  MEDIA_NICHE_OPTIONS,
  MediaGridReservationPayload,
} from './radioInventory';

export type CrmOrderStage =
  | 'new_hold'
  | 'quota_locked'
  | 'edo_invoice'
  | 'in_production'
  | 'on_air'
  | 'completed_ltv';

export type OrderEntrySource =
  | 'order_page'
  | 'quick_order_drawer'
  | 'standalone_hold_modal';

export interface CrmStageMeta {
  id: CrmOrderStage;
  stepCode: string;
  shortLabel: string;
  fullTitle: string;
  slaHint: string;
  nextActionLabel: string | null;
  nextStage: CrmOrderStage | null;
}

export const CRM_ORDER_STAGES: readonly CrmStageMeta[] = [
  {
    id: 'new_hold',
    stepCode: '01',
    shortLabel: 'Новый резерв (4ч)',
    fullTitle: '01. Новый резерв · Холд квоты 4 часа',
    slaHint: 'SLA 15 минут: сверка сетки в трафик-службе радиостанций и звонок клиенту',
    nextActionLabel: 'Подтвердить квоту на станциях →',
    nextStage: 'quota_locked',
  },
  {
    id: 'quota_locked',
    stepCode: '02',
    shortLabel: 'Квота подтверждена',
    fullTitle: '02. Квота заблокирована за клиентом',
    slaHint: 'Слоты защищены от открытой продажи · согласование тайминга и пре-чек ФЗ-38',
    nextActionLabel: 'Выставить договор-счёт в ЭДО →',
    nextStage: 'edo_invoice',
  },
  {
    id: 'edo_invoice',
    stepCode: '03',
    shortLabel: 'Счёт в ЭДО',
    fullTitle: '03. Единый договор-счёт направлен в ЭДО',
    slaHint: 'Спецификация в Диадок / СБИС · фиксация скидки горящего эфира',
    nextActionLabel: 'Передать в продакшн / техконтроль →',
    nextStage: 'in_production',
  },
  {
    id: 'in_production',
    stepCode: '04',
    shortLabel: 'Ролик и паспорт',
    fullTitle: '04. Аудиопродакшн, мастеринг −14 LUFS и паспорт прав',
    slaHint: '3 сценария / запись диктора либо проверка готового спота и очистка РАО/ВОИС',
    nextActionLabel: 'Запустить ролик в радиоэфир →',
    nextStage: 'on_air',
  },
  {
    id: 'on_air',
    stepCode: '05',
    shortLabel: 'В эфире',
    fullTitle: '05. Кампания в эфире · Контроль выходов и Search Lift',
    slaHint: 'Мастер-файл на радиостанциях · мониторинг эфирной справки и отклика',
    nextActionLabel: 'Закрыть акты и рассчитать 2-ю волну →',
    nextStage: 'completed_ltv',
  },
  {
    id: 'completed_ltv',
    stepCode: '06',
    shortLabel: 'Завершён · LTV',
    fullTitle: '06. Флайт закрыт · Готов расчёт 2-й волны без оплаты ролика',
    slaHint: 'Акты в ЭДО подписаны · паспорт прав бессрочный (100% бюджета следующей волны в эфир)',
    nextActionLabel: null,
    nextStage: null,
  },
] as const;

export function getCrmStageMeta(stage: CrmOrderStage): CrmStageMeta {
  return CRM_ORDER_STAGES.find((s) => s.id === stage) ?? CRM_ORDER_STAGES[0];
}

export interface OrderStationLineSnapshot {
  slotId: string;
  stationName: string;
  frequencyFm: string;
  slotLabel: string;
  daysPattern: string;
  sampleTimeSlots: string[];
  spotsCount: number;
  spotSeconds: number;
  reachOTS: number;
  officialPriceRub: number;
  hotPriceRub: number;
  discountPercent: number;
}

export interface OrderMediaPlanSnapshot {
  nicheId: string;
  nicheLabel: string;
  audienceSummary: string;
  campaignGoal: 'promo_burst' | 'brand_system_3m';
  spotReadiness: 'need_production_24h' | 'ready_with_passport';
  spotDurationSec: number;
  productionStatusLabel: string;
  totalSpots: number;
  totalReachOTS: number;
  estimatedFrequency: number;
  officialAirTotalRub: number;
  hotAirTotalRub: number;
  productionPriceRub: number;
  totalSavingsRub: number;
  unifiedTotalRub: number;
  airDiscountPercent: number;
  stations: OrderStationLineSnapshot[];
}

export interface OrderComplianceChecklist {
  trafficConfirmed: boolean;
  fz38Checked: boolean;
  rightsPassportIssued: boolean;
  edoAndOrdRegistered: boolean;
}

export type ExternalDeliveryState =
  | 'delivered'
  | 'ready_simulated'
  | 'not_configured'
  | 'failed';

export interface ChannelDeliveryStatus {
  state: ExternalDeliveryState;
  updatedAt: string;
  httpStatus: number | null;
  detail: string;
}

export interface CrmOrderRecord {
  id: string;
  orderNumber: string;
  createdAt: string;
  updatedAt: string;
  holdExpiresAt: string;
  source: OrderEntrySource;
  checkoutMode: 'air_plus_production' | 'production_only';
  stage: CrmOrderStage;
  formatLabel: string;
  totalBudgetRub: number;
  contact: string;
  detectedChannel: 'phone' | 'telegram' | 'email' | 'vip_saved';
  companyOrInn: string;
  innVerified: boolean;
  briefText: string;
  hasVoiceRecording: boolean;
  voiceDurationSec: number;
  attachedFileName: string | null;
  producerNotes: string;
  compliance: OrderComplianceChecklist;
  mediaPlanSnapshot: OrderMediaPlanSnapshot | null;
  delivery: {
    crmRegistry: 'saved';
    telegram: ChannelDeliveryStatus;
    webhook: ChannelDeliveryStatus;
  };
}

export interface OrderDispatchSettings {
  telegram: {
    enabled: boolean;
    botToken: string;
    chatId: string;
    notifyOnNewOrder: boolean;
    notifyOnStageChange: boolean;
  };
  webhook: {
    enabled: boolean;
    endpointUrl: string;
    hmacSecret: string;
    notifyOnNewOrder: boolean;
    notifyOnStageChange: boolean;
  };
}

export interface DispatchAttemptLog {
  id: string;
  timestamp: string;
  orderNumber: string;
  channel: 'telegram' | 'webhook';
  event: 'order.created' | 'order.stage_changed' | 'dispatch.test';
  state: ExternalDeliveryState;
  httpStatus: number | null;
  latencyMs: number;
  summary: string;
}

/**
 * Оценивает среднюю эффективную частоту контактов в ядре ЦА по числу выходов на станцию.
 * Использует эмпирический коэффициент зацепа прайм-драйва (~0.34 контакта ядра на 1 выход станции).
 */
export function estimateCoreFrequencyFromStations(
  stations: readonly { spotsCount: number }[]
): number {
  if (!stations.length) return 0;
  const avgSpotsPerStation =
    stations.reduce((acc, s) => acc + Math.max(0, s.spotsCount), 0) / stations.length;
  const rawFreq = avgSpotsPerStation * 0.34;
  return Math.round(rawFreq * 10) / 10;
}

export function buildMediaPlanSnapshotFromReservation(
  payload: MediaGridReservationPayload,
  totals: ComputedReservationTotals
): OrderMediaPlanSnapshot {
  const spotSeconds =
    typeof payload.spotDurationSec === 'number' && Number.isFinite(payload.spotDurationSec)
      ? Math.max(5, Math.min(60, Math.round(payload.spotDurationSec)))
      : payload.durationPref === '30'
        ? 30
        : 15;

  const stations: OrderStationLineSnapshot[] = payload.stations.map((st) => ({
    slotId: st.slotId,
    stationName: st.station,
    frequencyFm: st.frequencyFm,
    slotLabel: st.daypart,
    daysPattern: st.daysPattern,
    sampleTimeSlots: [...st.sampleTimeSlots],
    spotsCount: st.spotsIncluded * Math.max(1, st.packageMultiplier || 1),
    spotSeconds: st.exactDurationSec ?? spotSeconds,
    reachOTS: st.reachOTS,
    officialPriceRub: st.officialPrice,
    hotPriceRub: st.hotPrice,
    discountPercent: st.discountPercent,
  }));

  const estimatedFrequency = estimateCoreFrequencyFromStations(stations);
  const isReadySpot =
    totals.productionSelection === 'ready_spot' || payload.durationPref === 'ready_spot';

  return {
    nicheId: payload.nicheId,
    nicheLabel: payload.nicheLabel,
    audienceSummary: payload.targetAudienceSummary ?? payload.nicheLabel,
    campaignGoal: payload.hotAirTotal >= 320_000 ? 'brand_system_3m' : 'promo_burst',
    spotReadiness: isReadySpot ? 'ready_with_passport' : 'need_production_24h',
    spotDurationSec: spotSeconds,
    productionStatusLabel: totals.spotStatusLabel,
    totalSpots: payload.totalSpots,
    totalReachOTS: payload.totalReachOTS,
    estimatedFrequency,
    officialAirTotalRub: payload.officialAirTotal,
    hotAirTotalRub: payload.hotAirTotal,
    productionPriceRub: totals.productionPriceRub,
    totalSavingsRub: totals.totalSavingsRub,
    unifiedTotalRub: totals.unifiedTotalRub,
    airDiscountPercent: payload.airDiscountPercent,
    stations,
  };
}

export function buildMediaPlanSnapshotFromFlexiblePlan(
  plan: FlexibleMediaPlanResult
): OrderMediaPlanSnapshot {
  const nicheLabel =
    MEDIA_NICHE_OPTIONS.find((n) => n.id === plan.niche)?.label ?? 'Бизнес-сегмент';

  const stations: OrderStationLineSnapshot[] = plan.selectedQuotes.map((q) => ({
    slotId: q.variation.id,
    stationName: q.stationItem.station,
    frequencyFm: q.stationItem.frequencyFm,
    slotLabel: `${q.variation.label} (${q.variation.hoursWindow})`,
    daysPattern: q.variation.daysPattern,
    sampleTimeSlots: [...q.variation.sampleTimeSlots],
    spotsCount: q.spotsCount,
    spotSeconds: q.spotSeconds,
    reachOTS: q.reachOTS,
    officialPriceRub: q.officialPriceRub,
    hotPriceRub: q.hotPriceRub,
    discountPercent: q.discountPercent,
  }));

  const estimatedFrequency = estimateCoreFrequencyFromStations(stations);
  const isReadySpot = plan.spotReadiness === 'ready_with_passport';

  const productionStatusLabel = isReadySpot
    ? `Готовый ролик клиента (${plan.spotSeconds} сек) — 0 ₽`
    : plan.production.isBonusUnlocked
      ? `Студийный ролик (${plan.spotSeconds} сек) — 0 ₽ бонус квоты`
      : `${plan.production.title} (${plan.spotSeconds} сек) — ${formatRubCompact(
          plan.production.effectivePriceRub
        )}`;

  return {
    nicheId: plan.niche,
    nicheLabel,
    audienceSummary: formatAudienceSummaryLine(plan.audience),
    campaignGoal: plan.hotAirTotalRub >= 320_000 ? 'brand_system_3m' : 'promo_burst',
    spotReadiness: plan.spotReadiness,
    spotDurationSec: plan.spotSeconds,
    productionStatusLabel,
    totalSpots: plan.totalSpots,
    totalReachOTS: plan.totalReachOTS,
    estimatedFrequency,
    officialAirTotalRub: plan.officialAirTotalRub,
    hotAirTotalRub: plan.hotAirTotalRub,
    productionPriceRub: plan.production.effectivePriceRub,
    totalSavingsRub: plan.totalSavingsRub,
    unifiedTotalRub: plan.totalClientCostRub,
    airDiscountPercent: plan.airDiscountPercent,
    stations,
  };
}

export function computeOrderHoldStatus(
  order: Pick<CrmOrderRecord, 'holdExpiresAt' | 'stage'>,
  nowMs = Date.now()
): {
  remainingSec: number;
  formattedCountdown: string;
  urgency: 'locked_safe' | 'active_normal' | 'expiring_soon' | 'expired';
  statusLabel: string;
} {
  if (order.stage !== 'new_hold') {
    return {
      remainingSec: 0,
      formattedCountdown: 'Зафиксировано',
      urgency: 'locked_safe',
      statusLabel: 'Квота закреплена за сделкой',
    };
  }
  const expMs = Date.parse(order.holdExpiresAt);
  if (!Number.isFinite(expMs)) {
    return {
      remainingSec: 0,
      formattedCountdown: '00:00:00',
      urgency: 'expired',
      statusLabel: 'Требуется продление холда',
    };
  }
  const remainingSec = Math.max(0, Math.floor((expMs - nowMs) / 1000));
  if (remainingSec === 0) {
    return {
      remainingSec: 0,
      formattedCountdown: '00:00:00',
      urgency: 'expired',
      statusLabel: '4ч истекли · обновите квоту',
    };
  }
  if (remainingSec <= 45 * 60) {
    return {
      remainingSec,
      formattedCountdown: formatHoldCountdown(remainingSec),
      urgency: 'expiring_soon',
      statusLabel: `Срочный холд · осталось ${formatHoldCountdown(remainingSec)}`,
    };
  }
  return {
    remainingSec,
    formattedCountdown: formatHoldCountdown(remainingSec),
    urgency: 'active_normal',
    statusLabel: `Холд 4ч · ${formatHoldCountdown(remainingSec)}`,
  };
}

/**
 * Формирует оперативное сообщение для рабочего Telegram-чата сейлз-продюсеров и трафик-службы.
 */
export function formatTelegramOrderDispatchMessage(
  order: CrmOrderRecord,
  event: 'order.created' | 'order.stage_changed' | 'dispatch.test' = 'order.created'
): string {
  const stageMeta = getCrmStageMeta(order.stage);
  const header =
    event === 'dispatch.test'
      ? `ТЕСТ ШЛЮЗА ПРИЁМА ЗАКАЗОВ · FMWorks`
      : event === 'order.stage_changed'
        ? `ОБНОВЛЕНИЕ ЭТАПА СДЕЛКИ #${order.orderNumber}`
        : order.checkoutMode === 'air_plus_production'
          ? `НОВЫЙ ПРИОРИТЕТНЫЙ ХОЛД 4Ч · #${order.orderNumber}`
          : `НОВЫЙ ЗАКАЗ НА АУДИОПРОДАКШН · #${order.orderNumber}`;

  const lines: string[] = [
    header,
    `Этап: ${stageMeta.fullTitle}`,
    `Сумма договора: ${formatRubCompact(order.totalBudgetRub)}`,
    `Контакт клиента: ${order.contact} (${order.detectedChannel})`,
  ];

  if (order.companyOrInn) {
    lines.push(
      `Контрагент / ИНН: ${order.companyOrInn}${
        order.innVerified ? ' · ИНН проверен по ключу ФНС' : ''
      }`
    );
  }

  if (order.mediaPlanSnapshot) {
    const snap = order.mediaPlanSnapshot;
    lines.push(
      ``,
      `МЕДИАПЛАН (${snap.stations.length} ст. · ${snap.totalSpots} вых. × ${snap.spotDurationSec}с · ${formatNumberSpaced(
        snap.totalReachOTS
      )} OTS · ~${snap.estimatedFrequency.toFixed(1).replace('.', ',')}×):`,
      ...snap.stations.map(
        (st, idx) =>
          `${idx + 1}) ${st.stationName} (${st.frequencyFm}) — ${st.spotsCount} вых. × ${st.spotSeconds}с (${st.slotLabel}) — ${formatRubCompact(
            st.hotPriceRub
          )}`
      ),
      `Ролик: ${snap.productionStatusLabel}`
    );
  } else {
    lines.push(`Формат: ${order.formatLabel}`);
  }

  if (order.briefText) {
    lines.push(`Бриф / задача: ${order.briefText}`);
  }
  if (order.hasVoiceRecording) {
    lines.push(`Голосовое ТЗ: прикреплено (${order.voiceDurationSec} сек)`);
  }

  lines.push(``, `Пульт управления: /admin -> Заказы и воронка (CRM)`);
  return lines.join('\n');
}

export interface WebhookOrderEnvelope {
  event: 'order.created' | 'order.stage_changed' | 'dispatch.test';
  idempotencyKey: string;
  emittedAt: string;
  platform: 'FMWorks Studio CRM';
  order: {
    id: string;
    orderNumber: string;
    stage: CrmOrderStage;
    stageTitle: string;
    checkoutMode: 'air_plus_production' | 'production_only';
    totalBudgetRub: number;
    holdExpiresAt: string;
    client: {
      contact: string;
      channel: string;
      companyOrInn: string;
      innVerified: boolean;
    };
    brief: {
      text: string;
      hasVoiceRecording: boolean;
      voiceDurationSec: number;
      attachedFileName: string | null;
    };
    compliance: OrderComplianceChecklist;
    mediaPlan: OrderMediaPlanSnapshot | null;
  };
}

export function buildWebhookOrderEnvelope(
  order: CrmOrderRecord,
  event: 'order.created' | 'order.stage_changed' | 'dispatch.test',
  nowIso = new Date().toISOString()
): WebhookOrderEnvelope {
  return {
    event,
    idempotencyKey: `${order.orderNumber}:${event}:${order.stage}:${nowIso.slice(0, 16)}`,
    emittedAt: nowIso,
    platform: 'FMWorks Studio CRM',
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      stage: order.stage,
      stageTitle: getCrmStageMeta(order.stage).fullTitle,
      checkoutMode: order.checkoutMode,
      totalBudgetRub: order.totalBudgetRub,
      holdExpiresAt: order.holdExpiresAt,
      client: {
        contact: order.contact,
        channel: order.detectedChannel,
        companyOrInn: order.companyOrInn,
        innVerified: order.innVerified,
      },
      brief: {
        text: order.briefText,
        hasVoiceRecording: order.hasVoiceRecording,
        voiceDurationSec: order.voiceDurationSec,
        attachedFileName: order.attachedFileName,
      },
      compliance: { ...order.compliance },
      mediaPlan: order.mediaPlanSnapshot,
    },
  };
}

/**
 * Генерирует официальный бланк счёта-спецификации для отправки клиенту в ЭДО (Диадок / СБИС).
 */
export function formatEdoInvoiceSpecificationDocument(order: CrmOrderRecord): string {
  const createdDate = (() => {
    try {
      return new Date(order.createdAt).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return order.createdAt.slice(0, 10);
    }
  })();

  const invoiceNumber = `СФ-${order.orderNumber.replace(/^FM-/, '')}`;
  const snap = order.mediaPlanSnapshot;

  const lines: string[] = [
    `══════════════════════════════════════════════════════════════════════`,
    `СПЕЦИФИКАЦИЯ И СЧЁТ-ОФЕРТА ДЛЯ ЭДО № ${invoiceNumber} от ${createdDate}`,
    `Исполнитель: FMWorks® — Отдел радиомедиабаинга и аудиопродакшна (fmworks.ru)`,
    `Основание резерва: Заказ #${order.orderNumber} (${getCrmStageMeta(order.stage).shortLabel})`,
    `══════════════════════════════════════════════════════════════════════`,
    `ЗАКАЗЧИК:`,
    `• Контрагент / ИНН: ${
      order.companyOrInn
        ? `${order.companyOrInn}${order.innVerified ? ' (ИНН подтверждён по ФНС)' : ''}`
        : 'Реквизиты уточняются при выставлении в Диадок / СБИС'
    }`,
    `• Ответственный контакт: ${order.contact}`,
    ``,
  ];

  if (snap && snap.stations.length > 0) {
    lines.push(
      `ПАРАМЕТРЫ ЭФИРНОЙ КАМПАНИИ:`,
      `• Отрасль и портрет ЦА: ${snap.nicheLabel} (${snap.audienceSummary})`,
      `• Хронометраж аудиоролика: ${snap.spotDurationSec} сек (${
        snap.spotReadiness === 'ready_with_passport'
          ? 'готовый ролик Заказчика с паспортом прав'
          : 'производство студии FMWorks с бессрочным паспортом прав РАО/ВОИС'
      })`,
      `• Суммарный объём: ${snap.stations.length} радиостанций · ${snap.totalSpots} выходов · ${formatNumberSpaced(
        snap.totalReachOTS
      )} OTS (~${snap.estimatedFrequency.toFixed(1).replace('.', ',')} касаний ядра)`,
      ``,
      `ТАБЛИЦА ПОЗИЦИЙ ДЛЯ ЗАКРЫВАЮЩИХ ДОКУМЕНТОВ ЭДО:`
    );

    snap.stations.forEach((st, idx) => {
      lines.push(
        `${idx + 1}. Размещение аудиоролика (${st.spotSeconds} сек) в эфире «${st.stationName}» (${st.frequencyFm})`,
        `   Тайм-слот: ${st.slotLabel}, ${st.daysPattern} · Выходов: ${st.spotsCount} шт. · Охват: ${formatNumberSpaced(
          st.reachOTS
        )} OTS`,
        `   Стоимость по квоте: ${formatRubCompact(st.hotPriceRub)} (прайс станции ${formatRubCompact(
          st.officialPriceRub
        )}, скидка −${st.discountPercent}%)`
      );
    });

    const prodLineIndex = snap.stations.length + 1;
    lines.push(
      `${prodLineIndex}. Аудиопродакшн и лицензионный паспорт прав РАО/ВОИС: ${snap.productionStatusLabel}`,
      `   К оплате по позиции продакшна: ${formatRubCompact(snap.productionPriceRub)}`,
      ``,
      `ИТОГОВАЯ ФИНАНСОВАЯ СВОДКА:`,
      `• Сумма эфира по официальному прайсу радиостанций: ${formatRubCompact(snap.officialAirTotalRub)}`,
      `• Зафиксированная скидка агентской квоты: −${formatRubCompact(snap.totalSavingsRub)} (−${snap.airDiscountPercent}%)`,
      `• ИТОГО К ОПЛАТЕ ПО ЕДИНОМУ ДОГОВОРУ (ЭДО, без скрытых комиссий): ${formatRubCompact(
        snap.unifiedTotalRub
      )}`
    );
  } else {
    lines.push(
      `ТАБЛИЦА ПОЗИЦИЙ ДЛЯ ЭДО:`,
      `1. Производство рекламного аудиоролика по тарифу «${order.formatLabel}»`,
      `   Включая 3 концепции сценария, запись диктора, сведение −14 LUFS и бессрочный паспорт прав РАО/ВОИС`,
      `   ИТОГО К ОПЛАТЕ ПО ДОГОВОРУ (ЭДО): ${formatRubCompact(order.totalBudgetRub)}`
    );
  }

  lines.push(
    ``,
    `ЮРИДИЧЕСКИЕ ГАРАНТИИ И ОТЧЁТНОСТЬ:`,
    `• Эфирные справки радиостанций с точным временем каждого выхода передаются в ЭДО по завершении флайта.`,
    `• Паспорт прав на аудиоролик действует бессрочно: во 2-й и 3-й волне 100% бюджета направляется в эфир.`,
    `• Отдел оформления договоров: hello@fmworks.ru`
  );

  return lines.join('\n');
}

export function exportCrmOrdersToCsv(orders: readonly CrmOrderRecord[]): string {
  const escapeCsv = (val: string | number | boolean | null | undefined): string => {
    const str = val === null || val === undefined ? '' : String(val);
    if (/[;"\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = [
    'Номер заказа',
    'Дата создания',
    'Этап воронки',
    'Тип сделки',
    'Бюджет (руб)',
    'Контакт',
    'Компания / ИНН',
    'ИНН проверен',
    'Хронометраж (сек)',
    'Радиостанции',
    'Выходов',
    'Охват OTS',
    'Заметка продюсера',
  ].join(';');

  const rows = orders.map((o) => {
    const snap = o.mediaPlanSnapshot;
    const stationsSummary = snap
      ? snap.stations.map((s) => `${s.stationName} (${s.spotsCount} вых.)`).join(', ')
      : o.formatLabel;

    return [
      escapeCsv(o.orderNumber),
      escapeCsv(o.createdAt),
      escapeCsv(getCrmStageMeta(o.stage).shortLabel),
      escapeCsv(o.checkoutMode === 'air_plus_production' ? 'Эфир + Ролик' : 'Аудиопродакшн'),
      escapeCsv(o.totalBudgetRub),
      escapeCsv(o.contact),
      escapeCsv(o.companyOrInn),
      escapeCsv(o.innVerified ? 'Да' : 'Нет'),
      escapeCsv(snap?.spotDurationSec ?? 15),
      escapeCsv(stationsSummary),
      escapeCsv(snap?.totalSpots ?? 0),
      escapeCsv(snap?.totalReachOTS ?? 0),
      escapeCsv(o.producerNotes),
    ].join(';');
  });

  return [header, ...rows].join('\n');
}

/**
 * Начальные демонстрационные заказы в CRM-пульте продюсера, чтобы воронка,
 * счёт-спецификация ЭДО и научный аудит работали сразу после входа в кабинет.
 */
export function createSeedCrmOrders(nowMs = Date.now()): CrmOrderRecord[] {
  const isoAt = (offsetMin: number) => new Date(nowMs + offsetMin * 60_000).toISOString();

  return [
    {
      id: 'crm-seed-hold-2914',
      orderNumber: 'FM-HOLD-2914',
      createdAt: isoAt(-22),
      updatedAt: isoAt(-22),
      holdExpiresAt: isoAt(3 * 60 + 38), // Осталось ~03:38:00 из 4 часов
      source: 'order_page',
      checkoutMode: 'air_plus_production',
      stage: 'new_hold',
      formatLabel: 'Голос и стиль (15 сек) за 24ч — 15 000 ₽',
      totalBudgetRub: 176_550,
      contact: '+7 916 740-28-19 · Алексей (коммерческий директор)',
      detectedChannel: 'phone',
      companyOrInn: 'ООО «Квартал Инвест» · ИНН 7707083893',
      innVerified: true,
      briefText:
        'Старт продаж видовых квартир с террасами, ипотечный транш и запись на закрытый показ в выходные.',
      hasVoiceRecording: true,
      voiceDurationSec: 26,
      attachedFileName: null,
      producerNotes: 'Проверить свободные утренние окна на Серебряном Дожде под бизнес-аудиторию.',
      compliance: {
        trafficConfirmed: false,
        fz38Checked: true,
        rightsPassportIssued: false,
        edoAndOrdRegistered: false,
      },
      mediaPlanSnapshot: {
        nicheId: 'real_estate',
        nicheLabel: 'Недвижимость и ЖК',
        audienceSummary: 'Премиум и ЖК (30–45 · высокий доход)',
        campaignGoal: 'promo_burst',
        spotReadiness: 'need_production_24h',
        spotDurationSec: 15,
        productionStatusLabel: 'Ролик 15 сек «Под ключ» за 24ч — 15 000 ₽',
        totalSpots: 23,
        totalReachOTS: 400_474,
        estimatedFrequency: 4.8,
        officialAirTotalRub: 264_000,
        hotAirTotalRub: 161_550,
        productionPriceRub: 15_000,
        totalSavingsRub: 102_450,
        unifiedTotalRub: 176_550,
        airDiscountPercent: 39,
        stations: [
          {
            slotId: 'bfm-evening',
            stationName: 'Business FM',
            frequencyFm: '87.5 FM',
            slotLabel: 'Вечерний драйв 17:30–20:30',
            daysPattern: 'Пн–Пт',
            sampleTimeSlots: ['18:15', '19:10', '19:45'],
            spotsCount: 9,
            spotSeconds: 15,
            reachOTS: 160_200,
            officialPriceRub: 132_750,
            hotPriceRub: 79_650,
            discountPercent: 40,
          },
          {
            slotId: 'silver-morning',
            stationName: 'Серебряный Дождь',
            frequencyFm: '100.1 FM',
            slotLabel: 'Утренний авторский эфир 08:00–11:00',
            daysPattern: 'Пн–Пт',
            sampleTimeSlots: ['08:35', '09:20', '10:15'],
            spotsCount: 14,
            spotSeconds: 15,
            reachOTS: 240_274,
            officialPriceRub: 131_250,
            hotPriceRub: 81_900,
            discountPercent: 38,
          },
        ],
      },
      delivery: {
        crmRegistry: 'saved',
        telegram: {
          state: 'ready_simulated',
          updatedAt: isoAt(-22),
          httpStatus: null,
          detail: 'Ожидает подключения Bot Token в настройках шлюза',
        },
        webhook: {
          state: 'ready_simulated',
          updatedAt: isoAt(-22),
          httpStatus: null,
          detail: 'Пакет сформирован · укажите URL внешней CRM для автоотправки',
        },
      },
    },
    {
      id: 'crm-seed-edo-2891',
      orderNumber: 'FM-HOLD-2891',
      createdAt: isoAt(-210),
      updatedAt: isoAt(-45),
      holdExpiresAt: isoAt(30),
      source: 'order_page',
      checkoutMode: 'air_plus_production',
      stage: 'edo_invoice',
      formatLabel: 'Готовый ролик (20 сек) с паспортом прав — 0 ₽',
      totalBudgetRub: 242_800,
      contact: '@med_marketing_dir · Елена (сеть клиник)',
      detectedChannel: 'telegram',
      companyOrInn: 'ООО «МедЦентр Профи» · ИНН 7736207543',
      innVerified: true,
      briefText:
        'Готовый ролик 20 секунд про кардиологический чекап за 1 визит. Нужен плотный выход в утреннем и дневном эфире + проверка медицинского дисклеймера.',
      hasVoiceRecording: false,
      voiceDurationSec: 0,
      attachedFileName: 'spot_cardio_20s_passport.pdf',
      producerNotes:
        'Трафик подтвердил все 28 выходов. Дисклеймер «Имеются противопоказания» уложен в финальные 3 сек. Счёт отправлен в Диадок.',
      compliance: {
        trafficConfirmed: true,
        fz38Checked: true,
        rightsPassportIssued: true,
        edoAndOrdRegistered: true,
      },
      mediaPlanSnapshot: {
        nicheId: 'medicine',
        nicheLabel: 'Медицина',
        audienceSummary: 'Семья и медицина (35–55 · платёжеспособное ядро)',
        campaignGoal: 'promo_burst',
        spotReadiness: 'ready_with_passport',
        spotDurationSec: 20,
        productionStatusLabel: 'Готовый ролик клиента (20 сек) — 0 ₽',
        totalSpots: 28,
        totalReachOTS: 584_000,
        estimatedFrequency: 5.4,
        officialAirTotalRub: 398_000,
        hotAirTotalRub: 242_800,
        productionPriceRub: 0,
        totalSavingsRub: 155_200,
        unifiedTotalRub: 242_800,
        airDiscountPercent: 39,
        stations: [
          {
            slotId: 'monte-morning',
            stationName: 'Радио Monte Carlo',
            frequencyFm: '102.1 FM',
            slotLabel: 'Утренний прайм 07:30–10:30',
            daysPattern: 'Пн–Пт',
            sampleTimeSlots: ['08:15', '09:15', '10:05'],
            spotsCount: 14,
            spotSeconds: 20,
            reachOTS: 298_000,
            officialPriceRub: 236_000,
            hotPriceRub: 145_600,
            discountPercent: 38,
          },
          {
            slotId: 'retro-day',
            stationName: 'Ретро FM',
            frequencyFm: '88.3 FM',
            slotLabel: 'Дневной блок 12:00–16:00',
            daysPattern: 'Пн–Вс',
            sampleTimeSlots: ['12:40', '14:15', '15:30'],
            spotsCount: 14,
            spotSeconds: 20,
            reachOTS: 286_000,
            officialPriceRub: 162_000,
            hotPriceRub: 97_200,
            discountPercent: 40,
          },
        ],
      },
      delivery: {
        crmRegistry: 'saved',
        telegram: {
          state: 'ready_simulated',
          updatedAt: isoAt(-45),
          httpStatus: null,
          detail: 'Готово к отправке в Telegram продюсеров',
        },
        webhook: {
          state: 'ready_simulated',
          updatedAt: isoAt(-45),
          httpStatus: null,
          detail: 'Событие order.stage_changed записано в журнал',
        },
      },
    },
    {
      id: 'crm-seed-onair-2854',
      orderNumber: 'FM-HOLD-2854',
      createdAt: isoAt(-2880),
      updatedAt: isoAt(-180),
      holdExpiresAt: isoAt(-2640),
      source: 'order_page',
      checkoutMode: 'air_plus_production',
      stage: 'on_air',
      formatLabel: 'Экспресс-продакшн (15 сек) за 24ч — 0 ₽ Бонус',
      totalBudgetRub: 418_500,
      contact: '+7 925 310-88-42 · Дмитрий (отдел лизинга)',
      detectedChannel: 'phone',
      companyOrInn: 'АО «ТрансФлот Лизинг» · ИНН 7702070139',
      innVerified: true,
      briefText:
        'Лизинг коммерческого транспорта для юрлиц с авансом от 10% и одобрением по ИНН за 1 рабочий день. Системная программа на 3 месяца.',
      hasVoiceRecording: true,
      voiceDurationSec: 34,
      attachedFileName: 'requisites_transflot.pdf',
      producerNotes:
        'Бонусный ролик за 0 ₽ сдан и утверждён с первого дубля. Идёт 1-я волна в утреннем и вечернем драйве, готовим график 2-й волны без оплаты продакшна.',
      compliance: {
        trafficConfirmed: true,
        fz38Checked: true,
        rightsPassportIssued: true,
        edoAndOrdRegistered: true,
      },
      mediaPlanSnapshot: {
        nicheId: 'b2b_finance',
        nicheLabel: 'B2B и Финансы',
        audienceSummary: 'Бизнес и B2B (35–55 · собственники и директора)',
        campaignGoal: 'brand_system_3m',
        spotReadiness: 'need_production_24h',
        spotDurationSec: 15,
        productionStatusLabel: 'Студийный ролик (15 сек) — 0 ₽ бонус квоты',
        totalSpots: 46,
        totalReachOTS: 892_400,
        estimatedFrequency: 7.8,
        officialAirTotalRub: 685_000,
        hotAirTotalRub: 418_500,
        productionPriceRub: 0,
        totalSavingsRub: 291_500,
        unifiedTotalRub: 418_500,
        airDiscountPercent: 39,
        stations: [
          {
            slotId: 'bfm-morning',
            stationName: 'Business FM',
            frequencyFm: '87.5 FM',
            slotLabel: 'Утренний прайм 07:30–10:30',
            daysPattern: 'Пн–Пт',
            sampleTimeSlots: ['08:20', '09:15', '10:10'],
            spotsCount: 24,
            spotSeconds: 15,
            reachOTS: 468_000,
            officialPriceRub: 396_000,
            hotPriceRub: 237_600,
            discountPercent: 40,
          },
          {
            slotId: 'kommersant-evening',
            stationName: 'Коммерсантъ FM',
            frequencyFm: '93.6 FM',
            slotLabel: 'Вечерний драйв 17:30–20:30',
            daysPattern: 'Пн–Пт',
            sampleTimeSlots: ['17:50', '18:40', '19:25'],
            spotsCount: 22,
            spotSeconds: 15,
            reachOTS: 424_400,
            officialPriceRub: 289_000,
            hotPriceRub: 180_900,
            discountPercent: 37,
          },
        ],
      },
      delivery: {
        crmRegistry: 'saved',
        telegram: {
          state: 'delivered',
          updatedAt: isoAt(-2879),
          httpStatus: 200,
          detail: 'Уведомление передано продюсерской группе',
        },
        webhook: {
          state: 'delivered',
          updatedAt: isoAt(-180),
          httpStatus: 200,
          detail: 'Синхронизирован статус on_air',
        },
      },
    },
  ];
}
