import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileSpreadsheet,
  FlaskConical,
  Printer,
  RefreshCw,
  Send,
  Webhook,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildWebhookOrderEnvelope,
  computeOrderHoldStatus,
  CRM_ORDER_STAGES,
  CrmOrderRecord,
  CrmOrderStage,
  DispatchAttemptLog,
  exportCrmOrdersToCsv,
  ExternalDeliveryState,
  formatEdoInvoiceSpecificationDocument,
  formatTelegramOrderDispatchMessage,
  getCrmStageMetaForOrder,
  OrderComplianceChecklist,
} from '../../data/orderCrmTypes';
import { AIRTIME_SALES_ENABLED } from '../../data/platformFeatures';
import { formatNumberSpaced, formatRubCompact } from '../../data/radioInventory';
import { AdminScientificPlanView } from './AdminScientificPlanView';

const ADMIN_TOKEN_STORAGE_KEY = 'audioworks_cms_session_token_v1';

export type OrdersCrmSubView = 'funnel' | 'channels' | 'science';

interface AdminOrdersCrmPanelProps {
  initialSubView?: OrdersCrmSubView;
}

interface AdminDispatchSettingsResponse {
  telegram: {
    enabled: boolean;
    hasBotToken: boolean;
    maskedBotToken: string;
    chatId: string;
    notifyOnNewOrder: boolean;
    notifyOnStageChange: boolean;
  };
  webhook: {
    enabled: boolean;
    endpointUrl: string;
    hasHmacSecret: boolean;
    maskedHmacSecret: string;
    notifyOnNewOrder: boolean;
    notifyOnStageChange: boolean;
  };
}

function readAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return (
      window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ||
      window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

function formatDateTimeShort(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function getSourceReadableLabel(source: CrmOrderRecord['source']): string {
  if (source === 'quick_order_drawer') return 'Быстрый заказ';
  if (source === 'standalone_hold_modal') return 'Медиапланер';
  return 'Страница резерва';
}

function getDeliveryStatePresentation(state: ExternalDeliveryState): {
  label: string;
  colorClass: string;
} {
  if (state === 'delivered') {
    return {
      label: 'Доставлено (200 OK)',
      colorClass: 'text-[#16A34A] dark:text-[#4ADE80]',
    };
  }
  if (state === 'failed') {
    return {
      label: 'Ошибка доставки',
      colorClass: 'text-[#DC2626] dark:text-[#F87171]',
    };
  }
  if (state === 'not_configured') {
    return {
      label: 'Отключено',
      colorClass: 'text-[#111111]/50 dark:text-[#F4F3EF]/50',
    };
  }
  return {
    label: 'Сформировано · ожидает шлюз',
    colorClass: 'text-[#D97706] dark:text-[#FBBF24]',
  };
}

export function AdminOrdersCrmPanel({
  initialSubView = 'funnel',
}: AdminOrdersCrmPanelProps) {
  const [subView, setSubView] = useState<OrdersCrmSubView>(initialSubView);
  const [orders, setOrders] = useState<CrmOrderRecord[]>([]);
  const [dispatchLogs, setDispatchLogs] = useState<DispatchAttemptLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    kind: 'ok' | 'error';
    text: string;
  } | null>(null);

  // Живой тик раз в секунду для обратного отсчёта 4-часового холда квоты
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setSubView(initialSubView);
  }, [initialSubView]);

  // Фильтры воронки и выбранная карточка сделки
  const [stageFilter, setStageFilter] = useState<'all' | CrmOrderStage>('all');
  const [modeFilter, setModeFilter] = useState<
    'all' | 'air_plus_production' | 'production_only'
  >('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');

  // Локальный черновик заметки продюсера для выбранного заказа
  const [notesDraft, setNotesDraft] = useState<string>('');
  const [isUpdatingOrder, setIsUpdatingOrder] = useState<boolean>(false);
  const [isRedelivering, setIsRedelivering] = useState<boolean>(false);

  // Модальное окно счёта-спецификации для ЭДО
  const [edoModalOrder, setEdoModalOrder] = useState<CrmOrderRecord | null>(null);
  const [copiedEdoText, setCopiedEdoText] = useState<boolean>(false);

  // Целевой заказ для передачи в «Научный план развития»
  const [scienceTargetOrder, setScienceTargetOrder] =
    useState<CrmOrderRecord | null>(null);

  // Состояние формы настроек шлюзов Telegram + Webhook
  const [tgEnabled, setTgEnabled] = useState<boolean>(false);
  const [tgBotTokenInput, setTgBotTokenInput] = useState<string>('');
  const [tgHasToken, setTgHasToken] = useState<boolean>(false);
  const [tgChatId, setTgChatId] = useState<string>('');
  const [tgNotifyNew, setTgNotifyNew] = useState<boolean>(true);
  const [tgNotifyStage, setTgNotifyStage] = useState<boolean>(true);

  const [whEnabled, setWhEnabled] = useState<boolean>(false);
  const [whEndpointUrl, setWhEndpointUrl] = useState<string>('');
  const [whSecretInput, setWhSecretInput] = useState<string>('');
  const [whHasSecret, setWhHasSecret] = useState<boolean>(false);
  const [whNotifyNew, setWhNotifyNew] = useState<boolean>(true);
  const [whNotifyStage, setWhNotifyStage] = useState<boolean>(true);

  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [isTestingDispatch, setIsTestingDispatch] = useState<boolean>(false);

  const applyServerSettings = useCallback((settings: AdminDispatchSettingsResponse) => {
    setTgEnabled(settings.telegram.enabled);
    setTgHasToken(settings.telegram.hasBotToken);
    setTgBotTokenInput(settings.telegram.maskedBotToken || '');
    setTgChatId(settings.telegram.chatId || '');
    setTgNotifyNew(settings.telegram.notifyOnNewOrder);
    setTgNotifyStage(settings.telegram.notifyOnStageChange);

    setWhEnabled(settings.webhook.enabled);
    setWhEndpointUrl(settings.webhook.endpointUrl || '');
    setWhHasSecret(settings.webhook.hasHmacSecret);
    setWhSecretInput(settings.webhook.maskedHmacSecret || '');
    setWhNotifyNew(settings.webhook.notifyOnNewOrder);
    setWhNotifyStage(settings.webhook.notifyOnStageChange);
  }, []);

  const fetchOrdersCrm = useCallback(
    async (silent = false) => {
      if (!silent) setIsRefreshing(true);
      try {
        const token = readAdminToken();
        const res = await fetch('/api/cms/orders', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          throw new Error('Не удалось загрузить реестр заказов CRM');
        }
        const json = (await res.json()) as {
          ok: boolean;
          orders: CrmOrderRecord[];
          dispatchLogs: DispatchAttemptLog[];
          settings: AdminDispatchSettingsResponse;
        };

        setOrders(json.orders);
        setDispatchLogs(json.dispatchLogs);
        applyServerSettings(json.settings);
        setSelectedOrderId((prev) => {
          if (prev && json.orders.some((o) => o.id === prev)) return prev;
          return json.orders[0]?.id ?? '';
        });
      } catch (err) {
        setFeedbackBanner({
          kind: 'error',
          text:
            err instanceof Error
              ? err.message
              : 'Ошибка соединения с сервером CRM',
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [applyServerSettings]
  );

  useEffect(() => {
    void fetchOrdersCrm(false);
  }, [fetchOrdersCrm]);

  // Закрытие модального окна ЭДО по Escape
  useEffect(() => {
    if (!edoModalOrder) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEdoModalOrder(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [edoModalOrder]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length };
    for (const st of CRM_ORDER_STAGES) {
      counts[st.id] = 0;
    }
    for (const ord of orders) {
      counts[ord.stage] = (counts[ord.stage] ?? 0) + 1;
    }
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((ord) => {
      if (stageFilter !== 'all' && ord.stage !== stageFilter) return false;
      if (modeFilter !== 'all' && ord.checkoutMode !== modeFilter) return false;
      if (!q) return true;
      const haystack = [
        ord.orderNumber,
        ord.contact,
        ord.companyOrInn,
        ord.briefText,
        ord.mediaPlanSnapshot?.nicheLabel ?? '',
        ...(ord.mediaPlanSnapshot?.stations.map((s) => s.stationName) ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [orders, stageFilter, modeFilter, searchQuery]);

  const selectedOrder = useMemo(() => {
    return (
      filteredOrders.find((o) => o.id === selectedOrderId) ??
      orders.find((o) => o.id === selectedOrderId) ??
      filteredOrders[0] ??
      null
    );
  }, [filteredOrders, orders, selectedOrderId]);

  useEffect(() => {
    setNotesDraft(selectedOrder?.producerNotes ?? '');
  }, [selectedOrder?.id, selectedOrder?.producerNotes]);

  // Агрегированные KPI верхнего ряда
  const kpiMetrics = useMemo(() => {
    const activeHolds = orders.filter((o) => {
      if (o.stage !== 'new_hold') return false;
      const hs = computeOrderHoldStatus(o, nowMs);
      return hs.remainingSec > 0;
    }).length;

    const totalPipelineRub = orders.reduce(
      (sum, o) => sum + (Number.isFinite(o.totalBudgetRub) ? o.totalBudgetRub : 0),
      0
    );

    const airOrders = orders.filter((o) => o.mediaPlanSnapshot !== null);
    const fivePlusCompliant = airOrders.filter(
      (o) => (o.mediaPlanSnapshot?.estimatedFrequency ?? 0) >= 5.0
    ).length;

    const activeChannelsCount =
      1 + (tgEnabled && tgHasToken && tgChatId ? 1 : 0) + (whEnabled && whEndpointUrl ? 1 : 0);

    return {
      activeHolds,
      totalPipelineRub,
      airOrdersCount: airOrders.length,
      fivePlusCompliant,
      activeChannelsCount,
    };
  }, [orders, nowMs, tgEnabled, tgHasToken, tgChatId, whEnabled, whEndpointUrl]);

  const patchOrderOnServer = async (
    orderId: string,
    payload: {
      stage?: CrmOrderStage;
      producerNotes?: string;
      compliance?: Partial<OrderComplianceChecklist>;
    },
    successMessage?: string
  ) => {
    setIsUpdatingOrder(true);
    setFeedbackBanner(null);
    try {
      const token = readAdminToken();
      const res = await fetch(`/api/cms/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        ok: boolean;
        order?: CrmOrderRecord;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.order) {
        throw new Error(json.error ?? 'Не удалось обновить карточку сделки');
      }
      const updated = json.order;
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      if (successMessage) {
        setFeedbackBanner({ kind: 'ok', text: successMessage });
      }
    } catch (err) {
      setFeedbackBanner({
        kind: 'error',
        text:
          err instanceof Error ? err.message : 'Ошибка сохранения сделки в CRM',
      });
    } finally {
      setIsUpdatingOrder(false);
    }
  };

  const handleRedeliverOrder = async (orderId: string) => {
    setIsRedelivering(true);
    setFeedbackBanner(null);
    try {
      const token = readAdminToken();
      const res = await fetch(
        `/api/cms/orders/${encodeURIComponent(orderId)}/redeliver`,
        {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      const json = (await res.json()) as {
        ok: boolean;
        order?: CrmOrderRecord;
        dispatchLogs?: DispatchAttemptLog[];
        error?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? 'Ошибка повторной отправки в шлюзы');
      }
      if (json.order) {
        const updated = json.order;
        setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      }
      if (json.dispatchLogs) {
        setDispatchLogs(json.dispatchLogs);
      }
      setFeedbackBanner({
        kind: 'ok',
        text: 'Пакет сделки повторно отправлен во внешние шлюзы приёма (Telegram / Webhook).',
      });
    } catch (err) {
      setFeedbackBanner({
        kind: 'error',
        text:
          err instanceof Error ? err.message : 'Не удалось выполнить отправку',
      });
    } finally {
      setIsRedelivering(false);
    }
  };

  const handleSaveDispatchSettings = async () => {
    setIsSavingSettings(true);
    setFeedbackBanner(null);
    try {
      const token = readAdminToken();
      const res = await fetch('/api/cms/orders-dispatch/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          telegram: {
            enabled: tgEnabled,
            botToken: tgBotTokenInput,
            chatId: tgChatId,
            notifyOnNewOrder: tgNotifyNew,
            notifyOnStageChange: tgNotifyStage,
          },
          webhook: {
            enabled: whEnabled,
            endpointUrl: whEndpointUrl,
            hmacSecret: whSecretInput,
            notifyOnNewOrder: whNotifyNew,
            notifyOnStageChange: whNotifyStage,
          },
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        settings?: AdminDispatchSettingsResponse;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.settings) {
        throw new Error(json.error ?? 'Не удалось сохранить настройки шлюзов');
      }
      applyServerSettings(json.settings);
      setFeedbackBanner({
        kind: 'ok',
        text: 'Настройки маршрутизации заказов (Telegram и Webhook) сохранены на сервере.',
      });
    } catch (err) {
      setFeedbackBanner({
        kind: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Ошибка сохранения настроек доставки',
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleTestDispatchGateway = async () => {
    setIsTestingDispatch(true);
    setFeedbackBanner(null);
    try {
      const token = readAdminToken();
      // Сначала сохраняем текущие поля формы, чтобы тест шёл по актуальному URL / токену
      await fetch('/api/cms/orders-dispatch/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          telegram: {
            enabled: tgEnabled,
            botToken: tgBotTokenInput,
            chatId: tgChatId,
            notifyOnNewOrder: tgNotifyNew,
            notifyOnStageChange: tgNotifyStage,
          },
          webhook: {
            enabled: whEnabled,
            endpointUrl: whEndpointUrl,
            hmacSecret: whSecretInput,
            notifyOnNewOrder: whNotifyNew,
            notifyOnStageChange: whNotifyStage,
          },
        }),
      });

      const res = await fetch('/api/cms/orders-dispatch/test', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = (await res.json()) as {
        ok: boolean;
        dispatchLogs?: DispatchAttemptLog[];
        result?: {
          telegramResult?: { state: ExternalDeliveryState; detail: string };
          webhookResult?: { state: ExternalDeliveryState; detail: string };
        };
        error?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? 'Контрольная отправка завершилась ошибкой');
      }
      if (json.dispatchLogs) {
        setDispatchLogs(json.dispatchLogs);
      }
      await fetchOrdersCrm(true);
      const whSummary = json.result?.webhookResult?.detail ?? '';
      const tgSummary = json.result?.telegramResult?.detail ?? '';
      setFeedbackBanner({
        kind: 'ok',
        text: `Контрольная проверка выполнена. Telegram: ${tgSummary} · Webhook: ${whSummary}`,
      });
    } catch (err) {
      setFeedbackBanner({
        kind: 'error',
        text:
          err instanceof Error ? err.message : 'Ошибка тестовой проверки шлюза',
      });
    } finally {
      setIsTestingDispatch(false);
    }
  };

  const handleBindLoopbackWebhook = () => {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    setWhEnabled(true);
    setWhEndpointUrl(`${origin}/api/webhooks/loopback-crm-sink`);
    if (!whSecretInput || whSecretInput.startsWith('••••')) {
      setWhSecretInput('fmworks-hmac-local-verify-key');
    }
  };

  const handleDownloadCsv = () => {
    const csvContent = '\uFEFF' + exportCrmOrdersToCsv(filteredOrders);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fmworks-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyEdoDocument = async (order: CrmOrderRecord) => {
    const docText = formatEdoInvoiceSpecificationDocument(order);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(docText);
      }
      setCopiedEdoText(true);
      window.setTimeout(() => setCopiedEdoText(false), 2200);
    } catch {
      setCopiedEdoText(true);
      window.setTimeout(() => setCopiedEdoText(false), 2200);
    }
  };

  const samplePreviewOrder = selectedOrder ?? orders[0] ?? null;

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-6 space-y-4">
        <div className="h-5 w-56 rounded bg-[#111111]/8 dark:bg-white/8" />
        <div className="h-24 w-full rounded-xl bg-[#111111]/5 dark:bg-white/5" />
      </div>
    );
  }

  return (
    <div data-testid="admin-orders-crm-panel" className="space-y-6 tabular-nums">
      {/* Верхний ряд KPI системы приёма заказов (ровно 4 показателя) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-4 sm:p-5 space-y-1">
          <p className="text-xs font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58">
            Активные резервы 4ч
          </p>
          <p
            data-testid="crm-kpi-active-holds"
            className="text-2xl font-bold text-[#FF4820]"
          >
            {kpiMetrics.activeHolds}
          </p>
          <p className="text-[11px] text-[#111111]/54 dark:text-[#F4F3EF]/54">
            Всего сделок в воронке: {orders.length}
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-4 sm:p-5 space-y-1">
          <p className="text-xs font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58">
            Объём портфеля сделок
          </p>
          <p
            data-testid="crm-kpi-pipeline-rub"
            className="text-2xl font-bold text-[#111111] dark:text-[#F4F3EF]"
          >
            {formatRubCompact(kpiMetrics.totalPipelineRub)}
          </p>
          <p className="text-[11px] text-[#111111]/54 dark:text-[#F4F3EF]/54">
            Прямые договоры в ЭДО без комиссий
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-4 sm:p-5 space-y-1">
          <p className="text-xs font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58">
            Норма частоты 5+ касаний
          </p>
          <p className="text-2xl font-bold text-[#16A34A] dark:text-[#4ADE80]">
            {kpiMetrics.fivePlusCompliant} из {kpiMetrics.airOrdersCount || 1}
          </p>
          <p className="text-[11px] text-[#111111]/54 dark:text-[#F4F3EF]/54">
            Эфирных медиапланов выше порога памяти
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-4 sm:p-5 space-y-1">
          <p className="text-xs font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58">
            Куда поступают заказы
          </p>
          <p className="text-lg font-bold text-[#111111] dark:text-[#F4F3EF]">
            CRM · Telegram · Webhook
          </p>
          <p className="text-[11px] text-[#16A34A] dark:text-[#4ADE80] font-medium">
            Активно контуров приёма: {kpiMetrics.activeChannelsCount} из 3
          </p>
        </div>
      </div>

      {/* Переключатель 3 режимов: Воронка заказов / Каналы приёма / Научный план развития */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#111111]/10 dark:border-white/10 pb-3">
        <div
          role="tablist"
          aria-label="Контуры системы заказов и развития"
          className="flex flex-wrap items-center gap-2"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subView === 'funnel'}
            data-testid="crm-subtab-funnel"
            onClick={() => setSubView('funnel')}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              subView === 'funnel'
                ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                : 'bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 text-[#111111]/75 dark:text-[#F4F3EF]/75 hover:text-[#111111] dark:hover:text-white'
            }`}
          >
            <span>Воронка заказов ({orders.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subView === 'channels'}
            data-testid="crm-subtab-channels"
            onClick={() => setSubView('channels')}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              subView === 'channels'
                ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                : 'bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 text-[#111111]/75 dark:text-[#F4F3EF]/75 hover:text-[#111111] dark:hover:text-white'
            }`}
          >
            <Webhook className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Куда поступают заказы (Telegram и Webhook)</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subView === 'science'}
            data-testid="crm-subtab-science"
            onClick={() => setSubView('science')}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              subView === 'science'
                ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                : 'bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 text-[#111111]/75 dark:text-[#F4F3EF]/75 hover:text-[#111111] dark:hover:text-white'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Научный план развития (4 контура)</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {subView === 'funnel' && (
            <button
              type="button"
              data-testid="crm-export-csv-btn"
              onClick={handleDownloadCsv}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111]/80 dark:text-[#F4F3EF]/80 hover:border-[#FF4820] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Выгрузить реестр CSV</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void fetchOrdersCrm(false)}
            disabled={isRefreshing}
            className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111]/80 dark:text-[#F4F3EF]/80 hover:text-[#111111] dark:hover:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 shrink-0 ${isRefreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Обновить</span>
          </button>
        </div>
      </div>

      {feedbackBanner && (
        <div
          role="status"
          data-testid="crm-feedback-banner"
          className={`px-4 py-3 rounded-xl text-xs font-medium border ${
            feedbackBanner.kind === 'ok'
              ? 'bg-[#16A34A]/10 border-[#16A34A]/30 text-[#15803D] dark:text-[#4ADE80]'
              : 'bg-[#DC2626]/10 border-[#DC2626]/30 text-[#DC2626] dark:text-[#F87171]'
          }`}
        >
          {feedbackBanner.text}
        </div>
      )}

      {/* ===================================================================== */}
      {/* ВКЛАДКА 1: 6-ЭТАПНАЯ ВОРОНКА ПРИЁМА И ВЕДЕНИЯ ЗАКАЗОВ (CRM ПУЛЬТ)    */}
      {/* ===================================================================== */}
      {subView === 'funnel' && (
        <div className="space-y-5">
          {/* Фильтр по 6 этапам воронки + поиск */}
          <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setStageFilter('all')}
                className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  stageFilter === 'all'
                    ? 'bg-[#FF4820] text-white'
                    : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111]/72 dark:text-[#F4F3EF]/72 hover:text-[#111111] dark:hover:text-white'
                }`}
              >
                Все этапы ({stageCounts.all ?? 0})
              </button>

              {CRM_ORDER_STAGES.map((st) => {
                const filterStageMeta = getCrmStageMetaForOrder(
                  st.id,
                  AIRTIME_SALES_ENABLED && modeFilter !== 'production_only'
                    ? 'air_plus_production'
                    : 'production_only'
                );
                return (
                  <button
                    key={st.id}
                    type="button"
                    data-testid={`crm-stage-filter-${st.id}`}
                    onClick={() => setStageFilter(st.id)}
                    className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      stageFilter === st.id
                        ? 'bg-[#FF4820] text-white'
                        : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111]/72 dark:text-[#F4F3EF]/72 hover:text-[#111111] dark:hover:text-white'
                    }`}
                  >
                    {filterStageMeta.stepCode}. {filterStageMeta.shortLabel} (
                    {stageCounts[st.id] ?? 0})
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#111111]/8 dark:border-white/8">
              <div className="sm:col-span-2">
                <label htmlFor="crm-search-input" className="sr-only">
                  Поиск по номеру заказа, контакту, ИНН или радиостанции
                </label>
                <input
                  id="crm-search-input"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по номеру #FM-HOLD, телефону, ИНН, компании или радиостанции…"
                  className="w-full min-h-[38px] px-3.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-xs text-[#111111] dark:text-[#F4F3EF]"
                />
              </div>

              <div>
                <label htmlFor="crm-mode-select" className="sr-only">
                  Тип сделки
                </label>
                <select
                  id="crm-mode-select"
                  value={modeFilter}
                  onChange={(e) =>
                    setModeFilter(
                      e.target.value as
                        | 'all'
                        | 'air_plus_production'
                        | 'production_only'
                    )
                  }
                  className="w-full min-h-[38px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF]"
                >
                  <option value="all">Все типы заказов</option>
                  <option value="air_plus_production">Резерв эфира + ролик</option>
                  <option value="production_only">Только аудиопродакшн</option>
                </select>
              </div>
            </div>
          </div>

          {/* Рабочий сплит: слева список заказов (5 колонок), справа инспектор сделки (7 колонок) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Левая колонка: Очередь заказов */}
            <div
              data-testid="crm-orders-list"
              className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 divide-y divide-[#111111]/8 dark:divide-white/8 overflow-hidden"
            >
              {filteredOrders.length === 0 ? (
                <div className="p-6 text-center space-y-2">
                  <p className="text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]">
                    По выбранному фильтру заказов нет
                  </p>
                  <p className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60">
                    Сбросьте фильтр этапа или поисковую строку, чтобы увидеть весь реестр.
                  </p>
                </div>
              ) : (
                filteredOrders.map((ord) => {
                  const isSelected = selectedOrder?.id === ord.id;
                  const stageMeta = getCrmStageMetaForOrder(ord.stage, ord.checkoutMode);
                  const holdInfo = computeOrderHoldStatus(ord, nowMs);
                  const snap = ord.mediaPlanSnapshot;

                  return (
                    <button
                      key={ord.id}
                      type="button"
                      data-testid={`crm-order-row-${ord.orderNumber}`}
                      onClick={() => setSelectedOrderId(ord.id)}
                      className={`w-full text-left p-4 sm:p-5 transition-colors cursor-pointer block space-y-2 ${
                        isSelected
                          ? 'bg-[#FF4820]/[0.06] dark:bg-[#FF4820]/[0.11]'
                          : 'hover:bg-[#F7F6F2]/80 dark:hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#111111] dark:text-[#F4F3EF]">
                          #{ord.orderNumber}
                          <span className="font-normal text-[#111111]/55 dark:text-[#F4F3EF]/55">
                            {' '}
                            · {formatDateTimeShort(ord.createdAt)}
                          </span>
                        </span>
                        <span className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                          {ord.totalBudgetRub > 0
                            ? formatRubCompact(ord.totalBudgetRub)
                            : 'Договорная'}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-[#111111]/88 dark:text-[#F4F3EF]/88 truncate">
                        {ord.companyOrInn || ord.contact}
                      </p>

                      <p className="text-[11px] text-[#111111]/64 dark:text-[#F4F3EF]/64 truncate">
                        {snap
                          ? `${snap.stations.map((s) => s.stationName).join(', ')} · ${snap.totalSpots} вых. × ${snap.spotDurationSec}с`
                          : ord.formatLabel}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                        <span className="font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75">
                          {stageMeta.stepCode}. {stageMeta.shortLabel}
                        </span>

                        <span
                          className={`font-semibold inline-flex items-center gap-1 ${
                            holdInfo.urgency === 'locked_safe'
                              ? 'text-[#16A34A] dark:text-[#4ADE80]'
                              : holdInfo.urgency === 'expiring_soon' ||
                                  holdInfo.urgency === 'expired'
                                ? 'text-[#DC2626] dark:text-[#F87171]'
                                : 'text-[#FF4820]'
                          }`}
                        >
                          <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                          <span>{holdInfo.statusLabel}</span>
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Правая колонка: Детальный пульт управления выбранной сделкой */}
            <div className="lg:col-span-7">
              {selectedOrder ? (
                (() => {
                  const stageMeta = getCrmStageMetaForOrder(
                    selectedOrder.stage,
                    selectedOrder.checkoutMode
                  );
                  const holdInfo = computeOrderHoldStatus(selectedOrder, nowMs);
                  const snap = selectedOrder.mediaPlanSnapshot;
                  const tgPres = getDeliveryStatePresentation(
                    selectedOrder.delivery.telegram.state
                  );
                  const whPres = getDeliveryStatePresentation(
                    selectedOrder.delivery.webhook.state
                  );

                  return (
                    <section
                      aria-label={`Карточка заказа ${selectedOrder.orderNumber}`}
                      data-testid="crm-order-inspector"
                      className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-5 sm:p-6 space-y-6"
                    >
                      {/* Шапка карточки заказа + главное действие перевода по воронке */}
                      <div className="space-y-4 pb-5 border-b border-[#111111]/10 dark:border-white/10">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58">
                              Заказ #{selectedOrder.orderNumber} ·{' '}
                              {getSourceReadableLabel(selectedOrder.source)} ·{' '}
                              {selectedOrder.checkoutMode === 'air_plus_production'
                                ? 'Эфир + Продакшн'
                                : 'Аудиопродакшн'}
                            </p>
                            <h2 className="text-xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                              {selectedOrder.companyOrInn || selectedOrder.contact}
                            </h2>
                            <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
                              Контакт: <strong>{selectedOrder.contact}</strong>
                              {selectedOrder.innVerified && (
                                <span className="text-[#16A34A] dark:text-[#4ADE80] font-semibold">
                                  {' '}
                                  · ИНН проверен по ключу ФНС
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="text-left sm:text-right space-y-0.5">
                            <p className="text-xs text-[#111111]/56 dark:text-[#F4F3EF]/56">
                              Сумма договора ·{' '}
                              {selectedOrder.paymentChannel === 'card_online'
                                ? 'Карта / СБП (54-ФЗ)'
                                : 'ЭДО / безнал'}
                            </p>
                            <p className="text-2xl font-bold text-[#111111] dark:text-[#F4F3EF]">
                              {selectedOrder.totalBudgetRub > 0
                                ? formatRubCompact(selectedOrder.totalBudgetRub)
                                : 'Договорная цена'}
                            </p>
                            <p
                              className={`text-xs font-semibold ${
                                holdInfo.urgency === 'locked_safe'
                                  ? 'text-[#16A34A] dark:text-[#4ADE80]'
                                  : 'text-[#FF4820]'
                              }`}
                            >
                              {holdInfo.statusLabel}
                            </p>
                          </div>
                        </div>

                        {/* Управление этапом сделки */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <label
                              htmlFor="inspector-stage-select"
                              className="text-xs font-semibold text-[#111111]/68 dark:text-[#F4F3EF]/68"
                            >
                              Этап:
                            </label>
                            <select
                              id="inspector-stage-select"
                              data-testid="crm-inspector-stage-select"
                              disabled={isUpdatingOrder}
                              value={selectedOrder.stage}
                              onChange={(e) =>
                                void patchOrderOnServer(
                                  selectedOrder.id,
                                  { stage: e.target.value as CrmOrderStage },
                                  `Этап сделки #${selectedOrder.orderNumber} обновлён.`
                                )
                              }
                              className="min-h-[40px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs font-bold text-[#111111] dark:text-[#F4F3EF]"
                            >
                              {CRM_ORDER_STAGES.map((st) => (
                                <option key={st.id} value={st.id}>
                                  {
                                    getCrmStageMetaForOrder(
                                      st.id,
                                      selectedOrder.checkoutMode
                                    ).fullTitle
                                  }
                                </option>
                              ))}
                            </select>
                          </div>

                          {stageMeta.nextStage && stageMeta.nextActionLabel && (
                            <button
                              type="button"
                              disabled={isUpdatingOrder}
                              data-testid="crm-advance-stage-btn"
                              onClick={() =>
                                void patchOrderOnServer(
                                  selectedOrder.id,
                                  { stage: stageMeta.nextStage! },
                                  `Сделка #${selectedOrder.orderNumber} переведена на следующий этап.`
                                )
                              }
                              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FF4820] hover:bg-[#E63D18] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                            >
                              <span>{stageMeta.nextActionLabel}</span>
                            </button>
                          )}
                        </div>

                        <p className="text-[11px] text-[#111111]/58 dark:text-[#F4F3EF]/58">
                          Регламент этапа: {stageMeta.slaHint}
                        </p>
                      </div>

                      {/* Спецификация медиаплана (радиостанции, хронометраж, выходы, OTS) */}
                      {snap ? (
                        <div className="space-y-3 pb-5 border-b border-[#111111]/10 dark:border-white/10">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h3 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                                Медиаплан резерва · {snap.nicheLabel}
                              </h3>
                              <p className="text-xs text-[#111111]/62 dark:text-[#F4F3EF]/62">
                                {snap.audienceSummary} · Хронометраж:{' '}
                                <strong>{snap.spotDurationSec} сек</strong> · Контактов:{' '}
                                <strong>{formatNumberSpaced(snap.totalReachOTS)} OTS</strong>{' '}
                                (~{snap.estimatedFrequency.toFixed(1).replace('.', ',')}×)
                              </p>
                            </div>

                            <button
                              type="button"
                              data-testid="crm-open-science-for-order-btn"
                              onClick={() => {
                                setScienceTargetOrder(selectedOrder);
                                setSubView('science');
                              }}
                              className="min-h-[36px] px-3.5 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] hover:border-[#FF4820] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                            >
                              <FlaskConical className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span>Научный аудит и LTV</span>
                              <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            </button>
                          </div>

                          <div className="overflow-x-auto border-t border-b border-[#111111]/10 dark:border-white/10">
                            <table className="w-full text-xs text-left border-collapse">
                              <thead>
                                <tr className="text-[#111111]/56 dark:text-[#F4F3EF]/56 border-b border-[#111111]/8 dark:border-white/8">
                                  <th className="py-2 pr-3 font-semibold">Радиостанция и слот</th>
                                  <th className="py-2 px-2 font-semibold text-right">Выходы</th>
                                  <th className="py-2 px-2 font-semibold text-right">Охват OTS</th>
                                  <th className="py-2 pl-2 font-semibold text-right">По квоте</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#111111]/6 dark:divide-white/6">
                                {snap.stations.map((st) => (
                                  <tr key={st.slotId}>
                                    <td className="py-2.5 pr-3">
                                      <div className="font-bold text-[#111111] dark:text-[#F4F3EF]">
                                        {st.stationName}{' '}
                                        <span className="font-normal text-[#111111]/55 dark:text-[#F4F3EF]/55">
                                          · {st.frequencyFm}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-[#111111]/58 dark:text-[#F4F3EF]/58">
                                        {st.slotLabel} ({st.daysPattern})
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-2 text-right font-semibold whitespace-nowrap">
                                      {st.spotsCount} × {st.spotSeconds}с
                                    </td>
                                    <td className="py-2.5 px-2 text-right whitespace-nowrap">
                                      {formatNumberSpaced(st.reachOTS)}
                                    </td>
                                    <td className="py-2.5 pl-2 text-right font-bold whitespace-nowrap">
                                      {formatRubCompact(st.hotPriceRub)}{' '}
                                      <span className="text-[11px] font-normal text-[#16A34A] dark:text-[#4ADE80]">
                                        (−{st.discountPercent}%)
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="text-[#111111]/72 dark:text-[#F4F3EF]/72">
                              Продакшн: <strong>{snap.productionStatusLabel}</strong>
                            </span>
                            <span className="text-[#16A34A] dark:text-[#4ADE80] font-semibold">
                              Экономия квоты: −{formatRubCompact(snap.totalSavingsRub)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="pb-5 border-b border-[#111111]/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                              Тариф аудиопродакшна
                            </h3>
                            <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
                              {selectedOrder.formatLabel}
                            </p>
                          </div>
                          <button
                            type="button"
                            data-testid="crm-open-science-for-order-btn"
                            onClick={() => {
                              setScienceTargetOrder(selectedOrder);
                              setSubView('science');
                            }}
                            className="min-h-[36px] px-3.5 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] hover:border-[#FF4820] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <FlaskConical className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>Проверить сценарий и LTV</span>
                          </button>
                        </div>
                      )}

                      {/* Бриф клиента + чек-лист юридического и трафик-контроля */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-5 border-b border-[#111111]/10 dark:border-white/10">
                        <div className="space-y-2.5">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111]/58 dark:text-[#F4F3EF]/58">
                            Бриф и материалы клиента
                          </h3>
                          <p className="text-xs leading-relaxed text-[#111111]/85 dark:text-[#F4F3EF]/85">
                            {selectedOrder.briefText ||
                              'Быстрый резерв эфира по контакту — детали оффера уточняет сейлз-продюсер при звонке.'}
                          </p>
                          {(selectedOrder.hasVoiceRecording ||
                            selectedOrder.attachedFileName) && (
                            <p className="text-xs font-semibold text-[#FF4820]">
                              {selectedOrder.hasVoiceRecording
                                ? `Голосовой бриф (${selectedOrder.voiceDurationSec || 15} сек)`
                                : ''}
                              {selectedOrder.hasVoiceRecording &&
                              selectedOrder.attachedFileName
                                ? ' · '
                                : ''}
                              {selectedOrder.attachedFileName
                                ? `Файл: ${selectedOrder.attachedFileName}`
                                : ''}
                            </p>
                          )}

                          <div className="pt-2 space-y-2">
                            <label
                              htmlFor="crm-producer-notes"
                              className="block text-xs font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
                            >
                              Рабочая заметка сейлз-продюсера:
                            </label>
                            <textarea
                              id="crm-producer-notes"
                              rows={2}
                              value={notesDraft}
                              onChange={(e) => setNotesDraft(e.target.value)}
                              placeholder="Договорённости по слотам, реквизитам ЭДО или диктору…"
                              className="w-full p-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs text-[#111111] dark:text-[#F4F3EF]"
                            />
                            <button
                              type="button"
                              disabled={
                                isUpdatingOrder ||
                                notesDraft === selectedOrder.producerNotes
                              }
                              onClick={() =>
                                void patchOrderOnServer(
                                  selectedOrder.id,
                                  { producerNotes: notesDraft },
                                  'Заметка продюсера сохранена.'
                                )
                              }
                              className="min-h-[34px] px-3 py-1 rounded-lg border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] disabled:opacity-40 cursor-pointer whitespace-nowrap"
                            >
                              Сохранить заметку
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111]/58 dark:text-[#F4F3EF]/58">
                            Чек-лист допуска в эфир и ЭДО
                          </h3>
                          <div className="space-y-2 text-xs">
                            {(
                              [
                                {
                                  key: 'trafficConfirmed',
                                  label:
                                    'Сетка выходов подтверждена в трафик-службе радиостанций',
                                },
                                {
                                  key: 'fz38Checked',
                                  label:
                                    'Пре-чек текста и дисклеймеров по ФЗ-38 «О рекламе» пройден',
                                },
                                {
                                  key: 'rightsPassportIssued',
                                  label:
                                    'Бессрочный паспорт прав РАО/ВОИС оформлен или проверен',
                                },
                                {
                                  key: 'edoAndOrdRegistered',
                                  label:
                                    'Договор-счёт отправлен в ЭДО (Диадок / СБИС)',
                                },
                              ] as const
                            ).map((item) => (
                              <label
                                key={item.key}
                                className="flex items-start gap-2.5 cursor-pointer py-1 text-[#111111]/85 dark:text-[#F4F3EF]/85"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedOrder.compliance[item.key]}
                                  disabled={isUpdatingOrder}
                                  onChange={(e) =>
                                    void patchOrderOnServer(selectedOrder.id, {
                                      compliance: {
                                        [item.key]: e.target.checked,
                                      },
                                    })
                                  }
                                  className="mt-0.5 rounded border-[#111111]/30 accent-[#FF4820]"
                                />
                                <span className="leading-snug">{item.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Нижняя панель: статус доставки по 3 каналам + генератор счёта-спецификации ЭДО */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1 text-xs">
                          <p className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                            Маршрутизация заявки:
                          </p>
                          <p className="text-[#111111]/70 dark:text-[#F4F3EF]/70">
                            CRM:{' '}
                            <strong className="text-[#16A34A] dark:text-[#4ADE80]">
                              Записано
                            </strong>{' '}
                            · Telegram:{' '}
                            <strong className={tgPres.colorClass}>{tgPres.label}</strong> ·
                            Webhook:{' '}
                            <strong className={whPres.colorClass}>{whPres.label}</strong>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                          <button
                            type="button"
                            disabled={isRedelivering}
                            data-testid="crm-redeliver-order-btn"
                            onClick={() => void handleRedeliverOrder(selectedOrder.id)}
                            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] hover:border-[#FF4820] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <Send className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>
                              {isRedelivering ? 'Отправка…' : 'Отправить в шлюзы'}
                            </span>
                          </button>

                          <button
                            type="button"
                            data-testid="crm-open-edo-spec-btn"
                            onClick={() => setEdoModalOrder(selectedOrder)}
                            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#111111] hover:bg-[#27272A] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <FileSpreadsheet
                              className="w-3.5 h-3.5 shrink-0"
                              aria-hidden="true"
                            />
                            <span>Счёт-спецификация ЭДО</span>
                          </button>
                        </div>
                      </div>
                    </section>
                  );
                })()
              ) : (
                <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-8 text-center text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60">
                  Выберите заказ слева для просмотра медиаплана и управления сделкой.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ВКЛАДКА 2: КУДА ПОСТУПАЮТ ЗАКАЗЫ (АРХИТЕКТУРА ШЛЮЗОВ + ТЕСТ ДОСТАВКИ) */}
      {/* ===================================================================== */}
      {subView === 'channels' && (
        <div data-testid="crm-channels-view" className="space-y-6">
          {/* Архитектурная схема 3 контуров приёма без потери лидов */}
          <section className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-5 sm:p-6 space-y-4">
            <div className="space-y-1 pb-3 border-b border-[#111111]/8 dark:border-white/8">
              <p className="text-xs font-medium text-[#111111]/56 dark:text-[#F4F3EF]/56">
                Архитектура гарантированного приёма заявок (Zero-Loss Outbox)
              </p>
              <h2 className="text-lg font-bold text-[#111111] dark:text-[#F4F3EF]">
                Куда поступают заказы и брони радиоэфира после нажатия кнопки клиентом
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 divide-y lg:divide-y-0 lg:divide-x divide-[#111111]/10 dark:divide-white/10 text-xs">
              <div className="space-y-1.5">
                <p className="font-bold text-[#16A34A] dark:text-[#4ADE80]">
                  Контур 1 · Встроенный CRM-реестр студии (Активен всегда)
                </p>
                <p className="leading-relaxed text-[#111111]/75 dark:text-[#F4F3EF]/75">
                  После криптографической проверки защиты от ботов и проверки ИНН заявка
                  атомарно записывается на сервер в <code>studio-orders-crm.json</code> со
                  слепком станций, тайм-слотов, хронометража и таймером 4ч. Ни одна сделка
                  не теряется даже при сбое внешних мессенджеров.
                </p>
              </div>

              <div className="pt-4 lg:pt-0 lg:pl-5 space-y-1.5">
                <p className="font-bold text-[#111111] dark:text-[#F4F3EF]">
                  Контур 2 · Оперативный Telegram-пульт продюсеров (SLA 15 мин)
                </p>
                <p className="leading-relaxed text-[#111111]/75 dark:text-[#F4F3EF]/75">
                  Сервер мгновенно отправляет карточку резерва в закрытый чат сейлз-продюсеров
                  и трафик-менеджеров через Telegram Bot API: номер брони, станции, число
                  выходов, хронометраж ролика, контакт и голосовой бриф для блокировки сетки.
                </p>
              </div>

              <div className="pt-4 lg:pt-0 lg:pl-5 space-y-1.5">
                <p className="font-bold text-[#111111] dark:text-[#F4F3EF]">
                  Контур 3 · Подписанный Webhook во внешние CRM и 1С / ЭДО
                </p>
                <p className="leading-relaxed text-[#111111]/75 dark:text-[#F4F3EF]/75">
                  Параллельно сервер передаёт строгий JSON-пакет с заголовком подписи{' '}
                  <code>X-FMWorks-Signature</code> (HMAC-SHA256) и ключом идемпотентности в
                  amoCRM, Битрикс24, 1С или корпоративную шину данных.
                </p>
              </div>
            </div>
          </section>

          {/* Формы настройки Telegram и Webhook + предпросмотр реального пакета */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* Настройка Telegram */}
            <section className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-5 sm:p-6 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#111111]/8 dark:border-white/8">
                  <div>
                    <h3 className="text-base font-bold text-[#111111] dark:text-[#F4F3EF]">
                      Telegram-шлюз отдела продаж
                    </h3>
                    <p className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58">
                      Мгновенные алерты о новых 4-часовых резервах эфира
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tgEnabled}
                      onChange={(e) => setTgEnabled(e.target.checked)}
                      className="accent-[#FF4820]"
                    />
                    <span>Включён</span>
                  </label>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <label
                      htmlFor="tg-bot-token"
                      className="block font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
                    >
                      Токен бота (@BotFather):
                    </label>
                    <input
                      id="tg-bot-token"
                      type="password"
                      value={tgBotTokenInput}
                      onChange={(e) => setTgBotTokenInput(e.target.value)}
                      placeholder="123456789:AAH..."
                      className="w-full min-h-[38px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="tg-chat-id"
                      className="block font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
                    >
                      Chat ID рабочей группы продюсеров:
                    </label>
                    <input
                      id="tg-chat-id"
                      type="text"
                      value={tgChatId}
                      onChange={(e) => setTgChatId(e.target.value)}
                      placeholder="-1001987654321"
                      className="w-full min-h-[38px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tgNotifyNew}
                        onChange={(e) => setTgNotifyNew(e.target.checked)}
                        className="accent-[#FF4820]"
                      />
                      <span>Новый заказ</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tgNotifyStage}
                        onChange={(e) => setTgNotifyStage(e.target.checked)}
                        className="accent-[#FF4820]"
                      />
                      <span>Смена этапа сделки</span>
                    </label>
                  </div>
                </div>

                {samplePreviewOrder && (
                  <div className="space-y-1.5 pt-2 border-t border-[#111111]/8 dark:border-white/8">
                    <p className="text-[11px] font-semibold text-[#111111]/60 dark:text-[#F4F3EF]/60">
                      Формат сообщения в Telegram (на примере #{samplePreviewOrder.orderNumber}):
                    </p>
                    <pre className="p-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[11px] leading-relaxed whitespace-pre-wrap font-mono text-[#111111]/85 dark:text-[#F4F3EF]/85 max-h-44 overflow-y-auto">
                      {formatTelegramOrderDispatchMessage(samplePreviewOrder, 'order.created')}
                    </pre>
                  </div>
                )}
              </div>
            </section>

            {/* Настройка Webhook CRM */}
            <section className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-5 sm:p-6 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#111111]/8 dark:border-white/8">
                  <div>
                    <h3 className="text-base font-bold text-[#111111] dark:text-[#F4F3EF]">
                      Исходящий Webhook (amoCRM · Битрикс24 · 1С)
                    </h3>
                    <p className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58">
                      POST JSON с подписью HMAC-SHA256 и полной таблицей станций
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      data-testid="crm-webhook-enabled-checkbox"
                      checked={whEnabled}
                      onChange={(e) => setWhEnabled(e.target.checked)}
                      className="accent-[#FF4820]"
                    />
                    <span>Включён</span>
                  </label>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label
                        htmlFor="wh-endpoint-url"
                        className="font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
                      >
                        URL приёмника внешней CRM:
                      </label>
                      <button
                        type="button"
                        data-testid="crm-bind-loopback-webhook-btn"
                        onClick={handleBindLoopbackWebhook}
                        className="text-[11px] font-semibold text-[#FF4820] hover:underline cursor-pointer"
                      >
                        Подставить локальный тест-контур
                      </button>
                    </div>
                    <input
                      id="wh-endpoint-url"
                      data-testid="crm-webhook-url-input"
                      type="url"
                      value={whEndpointUrl}
                      onChange={(e) => setWhEndpointUrl(e.target.value)}
                      placeholder="https://crm.company.ru/webhooks/fmworks"
                      className="w-full min-h-[38px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="wh-hmac-secret"
                      className="block font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
                    >
                      Секретный ключ подписи (X-FMWorks-Signature):
                    </label>
                    <input
                      id="wh-hmac-secret"
                      type="password"
                      value={whSecretInput}
                      onChange={(e) => setWhSecretInput(e.target.value)}
                      placeholder="Секрет для проверки подлинности пакета"
                      className="w-full min-h-[38px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={whNotifyNew}
                        onChange={(e) => setWhNotifyNew(e.target.checked)}
                        className="accent-[#FF4820]"
                      />
                      <span>Событие order.created</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={whNotifyStage}
                        onChange={(e) => setWhNotifyStage(e.target.checked)}
                        className="accent-[#FF4820]"
                      />
                      <span>Событие order.stage_changed</span>
                    </label>
                  </div>
                </div>

                {samplePreviewOrder && (
                  <div className="space-y-1.5 pt-2 border-t border-[#111111]/8 dark:border-white/8">
                    <p className="text-[11px] font-semibold text-[#111111]/60 dark:text-[#F4F3EF]/60">
                      JSON-конверт Webhook (на примере #{samplePreviewOrder.orderNumber}):
                    </p>
                    <pre className="p-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[11px] leading-relaxed whitespace-pre-wrap font-mono text-[#111111]/85 dark:text-[#F4F3EF]/85 max-h-44 overflow-y-auto">
                      {JSON.stringify(
                        buildWebhookOrderEnvelope(samplePreviewOrder, 'order.created'),
                        null,
                        2
                      )}
                    </pre>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Кнопки сохранения и живого теста доставки + журнал попыток */}
          <section className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#111111] dark:text-[#F4F3EF]">
                  Журнал доставки внешних шлюзов
                </h3>
                <p className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58">
                  Протокол последних отправок в Telegram и внешние CRM с кодом ответа и задержкой
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={isTestingDispatch}
                  data-testid="crm-test-dispatch-btn"
                  onClick={() => void handleTestDispatchGateway()}
                  className="min-h-[40px] px-4 py-2 rounded-xl border border-[#111111]/16 dark:border-white/16 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] hover:border-[#FF4820] inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Send className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {isTestingDispatch
                      ? 'Проверка связи…'
                      : 'Проверить доставку тестового заказа'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isSavingSettings}
                  data-testid="crm-save-dispatch-settings-btn"
                  onClick={() => void handleSaveDispatchSettings()}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FF4820] hover:bg-[#E63D18] text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {isSavingSettings ? 'Сохранение…' : 'Сохранить настройки шлюзов'}
                  </span>
                </button>
              </div>
            </div>

            {dispatchLogs.length === 0 ? (
              <p className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58 py-3 border-t border-[#111111]/8 dark:border-white/8">
                Попыток внешней доставки в текущей сессии ещё не зафиксировано. Нажмите
                «Подставить локальный тест-контур» и «Проверить доставку тестового заказа» для
                проверки.
              </p>
            ) : (
              <div className="overflow-x-auto border-t border-[#111111]/10 dark:border-white/10">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="text-[#111111]/56 dark:text-[#F4F3EF]/56 border-b border-[#111111]/8 dark:border-white/8">
                      <th className="py-2 pr-3 font-semibold">Время</th>
                      <th className="py-2 px-2 font-semibold">Заказ</th>
                      <th className="py-2 px-2 font-semibold">Шлюз / Событие</th>
                      <th className="py-2 px-2 font-semibold">Статус</th>
                      <th className="py-2 pl-2 font-semibold text-right">Ответ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#111111]/6 dark:divide-white/6">
                    {dispatchLogs.map((log) => {
                      const pres = getDeliveryStatePresentation(log.state);
                      return (
                        <tr key={log.id}>
                          <td className="py-2 pr-3 whitespace-nowrap text-[#111111]/65 dark:text-[#F4F3EF]/65">
                            {formatDateTimeShort(log.timestamp)}
                          </td>
                          <td className="py-2 px-2 font-bold whitespace-nowrap">
                            #{log.orderNumber}
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap">
                            {log.channel === 'telegram' ? 'Telegram' : 'Webhook'} ·{' '}
                            {log.event}
                          </td>
                          <td className={`py-2 px-2 font-semibold ${pres.colorClass}`}>
                            {log.summary}
                          </td>
                          <td className="py-2 pl-2 text-right whitespace-nowrap text-[#111111]/65 dark:text-[#F4F3EF]/65">
                            {log.httpStatus ? `HTTP ${log.httpStatus}` : '—'} ({log.latencyMs}{' '}
                            мс)
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ВКЛАДКА 3: НАУЧНЫЙ ПЛАН РАЗВИТИЯ ПЛАТФОРМЫ И КАМПАНИЙ (4 КОНТУРА)     */}
      {/* ===================================================================== */}
      {subView === 'science' && (
        <AdminScientificPlanView
          orders={orders}
          preselectedOrder={scienceTargetOrder}
        />
      )}

      {/* Модальное окно официальной счёт-спецификации для ЭДО (Диадок / СБИС) */}
      {edoModalOrder && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edo-modal-title"
          data-testid="crm-edo-modal"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setEdoModalOrder(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[88vh] rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/14 dark:border-white/14 flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 sm:px-6 py-4 border-b border-[#111111]/10 dark:border-white/10 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58">
                  Документ для выставления в Диадок / СБИС / 1С
                </p>
                <h3
                  id="edo-modal-title"
                  className="text-base sm:text-lg font-bold text-[#111111] dark:text-[#F4F3EF]"
                >
                  Счёт-спецификация по заказу #{edoModalOrder.orderNumber}
                </h3>
              </div>

              <button
                type="button"
                aria-label="Закрыть окно спецификации"
                data-testid="crm-edo-modal-close"
                onClick={() => setEdoModalOrder(null)}
                className="w-9 h-9 rounded-xl border border-[#111111]/12 dark:border-white/12 flex items-center justify-center text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:text-[#111111] dark:hover:text-white cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto flex-1">
              <pre
                data-testid="crm-edo-document-pre"
                className="p-4 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10 text-xs leading-relaxed whitespace-pre-wrap font-mono text-[#111111] dark:text-[#F4F3EF]"
              >
                {formatEdoInvoiceSpecificationDocument(edoModalOrder)}
              </pre>
            </div>

            <div className="px-5 sm:px-6 py-4 border-t border-[#111111]/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58">
                Единый договор без скрытых агентских комиссий · ЭДО
              </p>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Printer className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Печать / PDF</span>
                </button>

                <button
                  type="button"
                  data-testid="crm-copy-edo-btn"
                  onClick={() => void handleCopyEdoDocument(edoModalOrder)}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FF4820] hover:bg-[#E63D18] text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {copiedEdoText
                      ? 'Скопировано в буфер'
                      : 'Скопировать для ЭДО'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
