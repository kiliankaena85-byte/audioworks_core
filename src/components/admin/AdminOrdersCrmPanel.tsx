import {
  Building2,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Webhook,
} from 'lucide-react';
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { studioCmsStore } from '../../cms/studioCmsStore';
import {
  type B2bLedgerBucketId,
  type B2bLedgerRowView,
  buildB2bLedgerRowView,
  computeB2bLedgerSummary,
  matchesB2bLedgerBucket,
  resolveOrderTargetSlotSeconds,
} from '../../data/b2bContractLedgerCore';
import type { OrderDeliverableKind } from '../../data/clientCabinetHelpers';
import type { DeliverableVersionPreset } from '../../data/deliverableVersioning';
import {
  formatKonturExternInvoiceCsv,
  type KonturIntegrationStatus,
} from '../../data/konturIntegrationCore';
import {
  buildWebhookOrderEnvelope,
  CRM_ORDER_STAGES,
  type CrmOrderRecord,
  type CrmOrderStage,
  type DispatchAttemptLog,
  exportCrmOrdersToCsv,
  type ExternalDeliveryState,
  formatTelegramOrderDispatchMessage,
  getCrmStageMetaForOrder,
  type OrderComplianceChecklist,
} from '../../data/orderCrmTypes';
import {
  createDefaultSoundEngineerRoster,
  SOUND_ENGINEER_EMAIL_CTA_LABEL,
  type SoundEngineerContact,
  type SoundEngineerEmailNotificationRecord,
} from '../../data/productionApprovalWorkflow';
import { formatRubCompact } from '../../data/radioInventory';
import {
  assembleProductionDocumentSuite,
  createDefaultStudioLegalProfiles,
  type OrderDocumentMeta,
  type StudioEntityKind,
  type StudioLegalProfile,
  type StudioLegalProfilesConfig,
  type StudioTaxRegimeId,
  type StudioVatCalculationMode,
  TAX_REGIME_OPTIONS,
} from '../../data/studioDocumentsCore';
import { resolveNextTabIdOnArrowKey } from '../../security/adminSessionStandards';
import { evaluateWebhookEndpointRfSafety } from '../../security/rfLegalCompliance';
import { BrandedDocumentSuiteModal } from '../documents/BrandedDocumentSuiteModal';
import { AdminB2bOrderDossier } from './AdminB2bOrderDossier';
import { AdminProductionKanbanView } from './AdminProductionKanbanView';
import { AdminSecurityPanel } from './AdminSecurityPanel';

const LEDGER_BUCKET_IDS: readonly B2bLedgerBucketId[] = [
  'all',
  'intake_queue',
  'awaiting_payment',
  'paid_in_work',
  'closed_acts',
];

const SETTINGS_TAB_IDS = ['legal', 'channels', 'security'] as const;

export type AdminOperationalGroup = 'ledger' | 'production' | 'settings';
export type AdminSettingsTabId = 'legal' | 'channels' | 'security';

interface AdminOrdersCrmPanelProps {
  viewGroup?: AdminOperationalGroup;
  initialSettingsTab?: AdminSettingsTabId;
  focusedOrderId?: string;
  onNavigateToProductionOrder?: (orderId: string) => void;
}

interface AdminDispatchSettingsResponse {
  telegram: {
    enabled: boolean;
    hasBotToken: boolean;
    botTokenSource?: 'env' | 'legacy_store' | 'none';
    envBotTokenConfigured?: boolean;
    maskedBotToken: string;
    chatId: string;
    hasChatId?: boolean;
    chatIdSource?: 'admin' | 'auto_discovered' | 'env' | 'none';
    envChatIdConfigured?: boolean;
    discoveredChatTitle?: string;
    notifyOnNewOrder: boolean;
    notifyOnStageChange: boolean;
    maskPdnInExternalAlerts?: boolean;
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

function getDeliveryStatePresentation(state: ExternalDeliveryState): {
  label: string;
  colorClass: string;
} {
  if (state === 'delivered') {
    return {
      label: 'Доставлено (200 OK)',
      colorClass: 'text-[#166534] dark:text-[#4ADE80]',
    };
  }
  if (state === 'failed') {
    return {
      label: 'Ошибка доставки',
      colorClass: 'text-[#B91C1C] dark:text-[#F87171]',
    };
  }
  if (state === 'not_configured') {
    return {
      label: 'Отключено',
      colorClass: 'text-[#111111]/72 dark:text-[#F4F3EF]/72',
    };
  }
  return {
    label: 'Ожидает шлюз',
    colorClass: 'text-[#92400E] dark:text-[#FBBF24]',
  };
}

function getEdoToneTextClass(tone: B2bLedgerRowView['edoStatusTone']): string {
  if (tone === 'ready') {
    return 'text-[#166534] dark:text-[#4ADE80]';
  }
  if (tone === 'active') {
    return 'text-[#111111] dark:text-[#F4F3EF]';
  }
  if (tone === 'pending') {
    return 'text-[#92400E] dark:text-[#FBBF24]';
  }
  return 'text-[#B82D0D] dark:text-[#FF7A5C]';
}

export function AdminOrdersCrmPanel({
  viewGroup = 'ledger',
  initialSettingsTab = 'legal',
  focusedOrderId,
  onNavigateToProductionOrder,
}: AdminOrdersCrmPanelProps) {
  const [settingsTab, setSettingsTab] =
    useState<AdminSettingsTabId>(initialSettingsTab);
  const [orders, setOrders] = useState<CrmOrderRecord[]>([]);
  const [soundEngineers, setSoundEngineers] = useState<SoundEngineerContact[]>(
    () => createDefaultSoundEngineerRoster()
  );
  const [soundEngineerEmails, setSoundEngineerEmails] = useState<
    SoundEngineerEmailNotificationRecord[]
  >([]);
  const [dispatchLogs, setDispatchLogs] = useState<DispatchAttemptLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    kind: 'ok' | 'error';
    text: string;
  } | null>(null);

  // Бухгалтерские фильтры B2B-реестра и поиск
  const [bucketFilter, setBucketFilter] = useState<B2bLedgerBucketId>('all');
  const [stageFilter, setStageFilter] = useState<'all' | CrmOrderStage>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    focusedOrderId ?? ''
  );

  const handleBucketTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentId: B2bLedgerBucketId
  ) => {
    const nextId = resolveNextTabIdOnArrowKey(
      LEDGER_BUCKET_IDS,
      currentId,
      event.key
    );
    if (!nextId) return;
    event.preventDefault();
    setBucketFilter(nextId);
    document.getElementById(`b2b-bucket-tab-${nextId}`)?.focus();
  };

  const handleSettingsTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentId: AdminSettingsTabId
  ) => {
    const nextId = resolveNextTabIdOnArrowKey(
      SETTINGS_TAB_IDS,
      currentId,
      event.key
    );
    if (!nextId) return;
    event.preventDefault();
    setSettingsTab(nextId);
    document.getElementById(`crm-subtab-btn-${nextId}`)?.focus();
  };

  // Состояния операций по выбранному заказу
  const [isUploadingDeliverable, setIsUploadingDeliverable] =
    useState<boolean>(false);
  const [isUpdatingOrder, setIsUpdatingOrder] = useState<boolean>(false);
  const [isRedelivering, setIsRedelivering] = useState<boolean>(false);
  const [isCreatingDiadocDraft, setIsCreatingDiadocDraft] =
    useState<boolean>(false);
  const [konturStatus, setKonturStatus] =
    useState<KonturIntegrationStatus | null>(null);

  // Модальное окно фирменного пакета документов A4 (КП, Договор + Приложение, Счёт, Паспорт)
  const [edoModalOrder, setEdoModalOrder] = useState<CrmOrderRecord | null>(
    null
  );

  // Юридические и налоговые профили студии (ИП / ООО, г. Тверь)
  const [legalProfiles, setLegalProfiles] =
    useState<StudioLegalProfilesConfig>(() =>
      createDefaultStudioLegalProfiles()
    );
  const [legalDraft, setLegalDraft] = useState<StudioLegalProfilesConfig>(() =>
    createDefaultStudioLegalProfiles()
  );
  const [editingEntityTab, setEditingEntityTab] =
    useState<StudioEntityKind>('ip');
  const [isSavingLegal, setIsSavingLegal] = useState<boolean>(false);

  // Состояние формы настроек шлюзов Telegram + Webhook
  const [tgEnabled, setTgEnabled] = useState<boolean>(false);
  const [tgMaskedToken, setTgMaskedToken] = useState<string>('');
  const [tgHasToken, setTgHasToken] = useState<boolean>(false);
  const [tgTokenSource, setTgTokenSource] = useState<
    'env' | 'legacy_store' | 'none'
  >('none');
  const [tgChatId, setTgChatId] = useState<string>('');
  const [tgDiscoveredChatTitle, setTgDiscoveredChatTitle] =
    useState<string>('');
  const [tgNotifyNew, setTgNotifyNew] = useState<boolean>(true);
  const [tgNotifyStage, setTgNotifyStage] = useState<boolean>(true);
  const [tgMaskPdn, setTgMaskPdn] = useState<boolean>(true);
  const [tgPreviewEvent, setTgPreviewEvent] = useState<
    'order.stage_changed' | 'order.created'
  >('order.stage_changed');
  const [isDetectingTgChat, setIsDetectingTgChat] = useState<boolean>(false);

  const [whEnabled, setWhEnabled] = useState<boolean>(false);
  const [whEndpointUrl, setWhEndpointUrl] = useState<string>('');
  const [whSecretInput, setWhSecretInput] = useState<string>('');
  const [whNotifyNew, setWhNotifyNew] = useState<boolean>(true);
  const [whNotifyStage, setWhNotifyStage] = useState<boolean>(true);

  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [isTestingDispatch, setIsTestingDispatch] = useState<boolean>(false);

  useEffect(() => {
    setSettingsTab(initialSettingsTab);
  }, [initialSettingsTab]);

  useEffect(() => {
    if (focusedOrderId) {
      setSelectedOrderId(focusedOrderId);
    }
  }, [focusedOrderId]);

  const applyServerSettings = useCallback(
    (settings: AdminDispatchSettingsResponse) => {
      setTgEnabled(settings.telegram.enabled);
      setTgHasToken(settings.telegram.hasBotToken);
      setTgTokenSource(settings.telegram.botTokenSource ?? 'none');
      setTgMaskedToken(settings.telegram.maskedBotToken || '');
      setTgChatId(settings.telegram.chatId || '');
      setTgDiscoveredChatTitle(settings.telegram.discoveredChatTitle || '');
      setTgNotifyNew(settings.telegram.notifyOnNewOrder);
      setTgNotifyStage(settings.telegram.notifyOnStageChange);
      setTgMaskPdn(settings.telegram.maskPdnInExternalAlerts !== false);

      setWhEnabled(settings.webhook.enabled);
      setWhEndpointUrl(settings.webhook.endpointUrl || '');
      setWhSecretInput(settings.webhook.maskedHmacSecret || '');
      setWhNotifyNew(settings.webhook.notifyOnNewOrder);
      setWhNotifyStage(settings.webhook.notifyOnStageChange);
    },
    []
  );

  const fetchOrdersCrm = useCallback(
    async (silent = false) => {
      if (!silent) setIsRefreshing(true);
      try {
        const res = await fetch('/api/cms/orders', {
          credentials: 'same-origin',
          headers: studioCmsStore.getAuthHeaders(),
        });
        if (!res.ok) {
          throw new Error('Не удалось загрузить реестр сделок студии');
        }
        const json = (await res.json()) as {
          ok: boolean;
          orders: CrmOrderRecord[];
          soundEngineers?: SoundEngineerContact[];
          soundEngineerEmails?: SoundEngineerEmailNotificationRecord[];
          dispatchLogs: DispatchAttemptLog[];
          settings: AdminDispatchSettingsResponse;
          legalProfiles?: StudioLegalProfilesConfig;
          konturStatus?: KonturIntegrationStatus;
        };

        setOrders(json.orders);
        if (Array.isArray(json.soundEngineers)) {
          setSoundEngineers(json.soundEngineers);
        }
        if (Array.isArray(json.soundEngineerEmails)) {
          setSoundEngineerEmails(json.soundEngineerEmails);
        }
        setDispatchLogs(json.dispatchLogs);
        applyServerSettings(json.settings);
        if (json.konturStatus) {
          setKonturStatus(json.konturStatus);
        }
        if (json.legalProfiles) {
          setLegalProfiles(json.legalProfiles);
          setLegalDraft(json.legalProfiles);
          setEditingEntityTab(json.legalProfiles.activeEntityKind);
        }
        setSelectedOrderId((prev) => {
          if (focusedOrderId && json.orders.some((o) => o.id === focusedOrderId)) {
            return focusedOrderId;
          }
          if (prev && json.orders.some((o) => o.id === prev)) return prev;
          return json.orders[0]?.id ?? '';
        });
      } catch (err) {
        setFeedbackBanner({
          kind: 'error',
          text:
            err instanceof Error
              ? err.message
              : 'Ошибка соединения с сервером реестра сделок',
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [applyServerSettings, focusedOrderId]
  );

  useEffect(() => {
    void fetchOrdersCrm(false);
  }, [fetchOrdersCrm]);

  const b2bSummary = useMemo(
    () => computeB2bLedgerSummary(orders, legalProfiles),
    [orders, legalProfiles]
  );

  const ledgerEntries = useMemo(
    () =>
      orders.map((order) => ({
        order,
        row: buildB2bLedgerRowView(order, legalProfiles),
      })),
    [orders, legalProfiles]
  );

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ledgerEntries.filter(({ order, row }) => {
      if (!matchesB2bLedgerBucket(order, bucketFilter)) return false;
      if (stageFilter !== 'all' && order.stage !== stageFilter) return false;
      if (!q) return true;
      const haystack = [
        order.orderNumber,
        row.invoiceNumber,
        row.counterpartyTitle,
        row.inn,
        order.contact,
        order.companyOrInn,
        order.formatLabel,
        order.briefText,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [ledgerEntries, bucketFilter, stageFilter, searchQuery]);

  const selectedOrder = useMemo(() => {
    return (
      filteredEntries.find((item) => item.order.id === selectedOrderId)?.order ??
      orders.find((o) => o.id === selectedOrderId) ??
      filteredEntries[0]?.order ??
      null
    );
  }, [filteredEntries, orders, selectedOrderId]);

  const patchOrderOnServer = async (
    orderId: string,
    payload: {
      stage?: CrmOrderStage;
      producerNotes?: string;
      compliance?: Partial<OrderComplianceChecklist>;
      documentMeta?: OrderDocumentMeta;
      totalBudgetRub?: number;
      cloudDiskUrl?: string | null;
      removeDeliverableId?: string;
    },
    successMessage?: string
  ) => {
    setIsUpdatingOrder(true);
    setFeedbackBanner(null);
    try {
      const res = await fetch(
        `/api/cms/orders/${encodeURIComponent(orderId)}`,
        {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            ...studioCmsStore.getAuthHeaders(),
          },
          body: JSON.stringify(payload),
        }
      );
      const json = (await res.json()) as {
        ok: boolean;
        order?: CrmOrderRecord;
        dispatchLogs?: DispatchAttemptLog[];
        dispatchResult?: {
          telegramResult?: { state: ExternalDeliveryState; detail: string };
          webhookResult?: { state: ExternalDeliveryState; detail: string };
        } | null;
        soundEngineerEmail?: SoundEngineerEmailNotificationRecord | null;
        soundEngineerEmails?: SoundEngineerEmailNotificationRecord[];
        error?: string;
      };
      if (!res.ok || !json.ok || !json.order) {
        throw new Error(json.error ?? 'Не удалось обновить карточку сделки');
      }
      const updated = json.order;
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      if (Array.isArray(json.dispatchLogs)) {
        setDispatchLogs(json.dispatchLogs);
      }
      if (Array.isArray(json.soundEngineerEmails)) {
        setSoundEngineerEmails(json.soundEngineerEmails);
      } else if (json.soundEngineerEmail) {
        setSoundEngineerEmails((prev) =>
          [
            json.soundEngineerEmail!,
            ...prev.filter((item) => item.id !== json.soundEngineerEmail!.id),
          ].slice(0, 30)
        );
      }
      setEdoModalOrder((prev) =>
        prev && prev.id === updated.id ? updated : prev
      );
      if (successMessage) {
        const tgResult = json.dispatchResult?.telegramResult;
        const tgSuffix =
          payload.stage && tgResult
            ? tgResult.state === 'delivered'
              ? ' Мгновенное уведомление о смене статуса доставлено в Telegram студии.'
              : tgResult.state === 'failed'
                ? ` Ошибка Telegram: ${tgResult.detail}.`
                : ''
            : '';
        const emailSuffix = json.soundEngineerEmail
          ? ` Уведомление звукорежиссёру (${json.soundEngineerEmail.engineerEmail}) с кнопкой «${SOUND_ENGINEER_EMAIL_CTA_LABEL}» отправлено.`
          : '';
        setFeedbackBanner({
          kind: 'ok',
          text: `${successMessage}${tgSuffix}${emailSuffix}`,
        });
      }
    } catch (err) {
      setFeedbackBanner({
        kind: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Ошибка сохранения сделки в реестре',
      });
    } finally {
      setIsUpdatingOrder(false);
    }
  };

  const handleUploadDeliverableWithMeta = async (
    order: CrmOrderRecord,
    file: File | null,
    meta: {
      title: string;
      kind: OrderDeliverableKind;
      versionCode?: DeliverableVersionPreset;
      versionNote?: string;
    }
  ): Promise<boolean> => {
    if (!file) return false;
    if (file.size > 10 * 1024 * 1024) {
      setFeedbackBanner({
        kind: 'error',
        text: 'Файл превышает лимит 10 МБ для прямой загрузки в личный кабинет.',
      });
      return false;
    }
    setIsUploadingDeliverable(true);
    setFeedbackBanner(null);
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const str = typeof reader.result === 'string' ? reader.result : '';
          const idx = str.indexOf(',');
          resolve(idx >= 0 ? str.slice(idx + 1) : str);
        };
        reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
        reader.readAsDataURL(file);
      });

      const res = await fetch(
        `/api/cms/orders/${encodeURIComponent(order.id)}/deliverables`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            ...studioCmsStore.getAuthHeaders(),
          },
          body: JSON.stringify({
            title: meta.title.trim() || file.name,
            kind: meta.kind,
            fileName: file.name,
            dataBase64,
            versionCode: meta.versionCode,
            versionNote: meta.versionNote?.trim() || undefined,
          }),
        }
      );
      const json = (await res.json()) as {
        ok?: boolean;
        order?: CrmOrderRecord;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.order) {
        throw new Error(json.error ?? 'Не удалось прикрепить файл выдачи');
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === json.order!.id ? json.order! : o))
      );
      setFeedbackBanner({
        kind: 'ok',
        text: `Файл «${file.name}» прикреплён в пакет выдачи сделки #${order.orderNumber}.`,
      });
      return true;
    } catch (err) {
      setFeedbackBanner({
        kind: 'error',
        text:
          err instanceof Error ? err.message : 'Ошибка загрузки файла выдачи',
      });
      return false;
    } finally {
      setIsUploadingDeliverable(false);
    }
  };

  const handleSaveLegalProfiles = async () => {
    setIsSavingLegal(true);
    setFeedbackBanner(null);
    try {
      const res = await fetch('/api/cms/legal-profiles', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...studioCmsStore.getAuthHeaders(),
        },
        body: JSON.stringify(legalDraft),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        legalProfiles?: StudioLegalProfilesConfig;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.legalProfiles) {
        throw new Error(
          json.error ?? 'Не удалось сохранить юридические профили'
        );
      }
      setLegalProfiles(json.legalProfiles);
      setLegalDraft(json.legalProfiles);
      setFeedbackBanner({
        kind: 'ok',
        text: 'Юридические реквизиты исполнителя (ИП / ООО, г. Тверь) и налоговый режим сохранены.',
      });
    } catch (err) {
      setFeedbackBanner({
        kind: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Ошибка сохранения юридических реквизитов',
      });
    } finally {
      setIsSavingLegal(false);
    }
  };

  const updateEditingProfileField = <K extends keyof StudioLegalProfile>(
    key: K,
    value: StudioLegalProfile[K]
  ) => {
    setLegalDraft((prev) => {
      const targetKey = editingEntityTab === 'ip' ? 'ipProfile' : 'oooProfile';
      const current = prev[targetKey];
      return {
        ...prev,
        [targetKey]: {
          ...current,
          [key]: editingEntityTab === 'ip' && key === 'kpp' ? '' : value,
        },
      };
    });
  };

  const handleRedeliverOrder = async (orderId: string) => {
    setIsRedelivering(true);
    setFeedbackBanner(null);
    try {
      const res = await fetch(
        `/api/cms/orders/${encodeURIComponent(orderId)}/redeliver`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: studioCmsStore.getAuthHeaders(),
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
      const res = await fetch('/api/cms/orders-dispatch/settings', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...studioCmsStore.getAuthHeaders(),
        },
        body: JSON.stringify({
          telegram: {
            enabled: tgEnabled,
            chatId: tgChatId,
            notifyOnNewOrder: tgNotifyNew,
            notifyOnStageChange: tgNotifyStage,
            maskPdnInExternalAlerts: tgMaskPdn,
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

  const handleDetectTelegramChat = async () => {
    setIsDetectingTgChat(true);
    setFeedbackBanner(null);
    try {
      const res = await fetch('/api/cms/orders-dispatch/detect-telegram-chat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: studioCmsStore.getAuthHeaders(),
      });
      const json = (await res.json()) as {
        ok: boolean;
        discovered?: { chatId: string; chatTitle: string; chatType: string };
        settings?: AdminDispatchSettingsResponse;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.discovered) {
        throw new Error(
          json.error ??
            'Не удалось определить Chat ID. Отправьте боту /start в Telegram и повторите.'
        );
      }
      if (json.settings) {
        applyServerSettings(json.settings);
      } else {
        setTgChatId(json.discovered.chatId);
        setTgDiscoveredChatTitle(json.discovered.chatTitle);
      }
      setFeedbackBanner({
        kind: 'ok',
        text: `Чат студии успешно привязан из Telegram: «${json.discovered.chatTitle}» (Chat ID: ${json.discovered.chatId}).`,
      });
    } catch (err) {
      setFeedbackBanner({
        kind: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Ошибка определения Chat ID через Telegram Bot API',
      });
    } finally {
      setIsDetectingTgChat(false);
    }
  };

  const handleAnonymizeOrderPdn = async (order: CrmOrderRecord) => {
    setIsUpdatingOrder(true);
    setFeedbackBanner(null);
    try {
      const res = await fetch(`/api/cms/orders/${order.id}/anonymize-pdn`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: studioCmsStore.getAuthHeaders(),
      });
      const json = (await res.json()) as {
        ok: boolean;
        order?: CrmOrderRecord;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.order) {
        throw new Error(json.error ?? 'Не удалось обезличить ПДн заказа');
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === json.order!.id ? json.order! : o))
      );
      setFeedbackBanner({
        kind: 'ok',
        text: `Персональные данные по сделке #${order.orderNumber} обезличены согласно ч. 5 ст. 21 152-ФЗ.`,
      });
    } catch (err) {
      setFeedbackBanner({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Ошибка обезличивания ПДн',
      });
    } finally {
      setIsUpdatingOrder(false);
    }
  };

  const handleTestDispatchGateway = async (
    testEvent: 'dispatch.test' | 'order.stage_changed' = 'order.stage_changed'
  ) => {
    setIsTestingDispatch(true);
    setFeedbackBanner(null);
    try {
      await fetch('/api/cms/orders-dispatch/settings', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...studioCmsStore.getAuthHeaders(),
        },
        body: JSON.stringify({
          telegram: {
            enabled: tgEnabled,
            chatId: tgChatId,
            notifyOnNewOrder: tgNotifyNew,
            notifyOnStageChange: tgNotifyStage,
            maskPdnInExternalAlerts: tgMaskPdn,
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
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...studioCmsStore.getAuthHeaders(),
        },
        body: JSON.stringify({
          event: testEvent,
          orderId: selectedOrder?.id,
        }),
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
        text: `Контрольная проверка (${
          testEvent === 'order.stage_changed' ? 'смена статуса' : 'новый заказ'
        }) выполнена. Telegram: ${tgSummary} · Webhook: ${whSummary}`,
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
      typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost:3000';
    setWhEnabled(true);
    setWhEndpointUrl(`${origin}/api/webhooks/loopback-crm-sink`);
    if (!whSecretInput || whSecretInput.startsWith('••••')) {
      setWhSecretInput('fmworks-hmac-local-verify-key');
    }
  };

  const handleDownloadCsv = () => {
    const targetOrders = filteredEntries.map((entry) => entry.order);
    const csvContent = '\uFEFF' + exportCrmOrdersToCsv(targetOrders);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fmworks-b2b-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadOrderKonturExternCsv = (order: CrmOrderRecord) => {
    const suite = assembleProductionDocumentSuite({
      orderNumber: order.orderNumber,
      createdAtIso: order.createdAt,
      formatLabel: order.formatLabel,
      baseBudgetRub: order.totalBudgetRub,
      defaultDurationSec: resolveOrderTargetSlotSeconds(order),
      contact: order.contact,
      companyOrInn: order.companyOrInn,
      briefText: order.briefText,
      legalProfiles,
      documentMeta: order.documentMeta ?? null,
    });
    const csv = formatKonturExternInvoiceCsv(suite);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FMWorks-KonturExtern-${order.orderNumber}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleCreateDiadocDraft = async (order: CrmOrderRecord) => {
    setIsCreatingDiadocDraft(true);
    setFeedbackBanner(null);
    try {
      const res = await fetch(`/api/cms/orders/${order.id}/diadoc-draft`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...studioCmsStore.getAuthHeaders(),
        },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as {
        ok: boolean;
        order?: CrmOrderRecord;
        message?: string;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.order) {
        throw new Error(
          json.error ??
            'Не удалось сформировать черновик счёта для Контур.Диадока'
        );
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === json.order!.id ? json.order! : o))
      );
      if (edoModalOrder?.id === json.order.id) {
        setEdoModalOrder(json.order);
      }
      setFeedbackBanner({
        kind: 'ok',
        text:
          json.message ??
          `Черновик счёта по сделке #${order.orderNumber} сформирован для Контур.Диадока (IsDraft).`,
      });
    } catch (err) {
      setFeedbackBanner({
        kind: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Ошибка подготовки черновика Контур.Диадока',
      });
    } finally {
      setIsCreatingDiadocDraft(false);
    }
  };

  const samplePreviewOrder = selectedOrder ?? orders[0] ?? null;

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="h-[104px] rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 animate-pulse"
            />
          ))}
        </div>
        <div className="h-[320px] rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 animate-pulse" />
      </div>
    );
  }

  return (
    <div
      data-testid="admin-orders-crm-panel"
      className="space-y-6 tabular-nums"
    >
      {feedbackBanner && (
        <div
          role="status"
          data-testid="crm-feedback-banner"
          className={`px-4 py-3 rounded-xl text-xs font-medium border ${
            feedbackBanner.kind === 'ok'
              ? 'bg-[#166534]/10 border-[#166534]/30 text-[#166534] dark:text-[#4ADE80]'
              : 'bg-[#B91C1C]/10 border-[#B91C1C]/30 text-[#B91C1C] dark:text-[#F87171]'
          }`}
        >
          {feedbackBanner.text}
        </div>
      )}

      {/* ===================================================================== */}
      {/* КОНТУР 1: КОММЕРЧЕСКИЙ И ДОГОВОРНОЙ РЕЕСТР B2B (ВАРИАНТ 3)             */}
      {/* ===================================================================== */}
      {viewGroup === 'ledger' && (
        <div className="space-y-6">
          {/* 4 реальных коммерческих B2B-показателя студии */}
          <div
            data-testid="b2b-kpi-grid"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-4 sm:p-5 space-y-1">
              <p className="text-xs font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72">
                Новые заявки в очереди
              </p>
              <p
                data-testid="crm-kpi-intake-queue"
                className="text-2xl font-bold text-[#B82D0D] dark:text-[#FF7A5C]"
              >
                {b2bSummary.intakeQueueCount}
              </p>
              <p className="text-[11px] text-[#111111]/72 dark:text-[#F4F3EF]/72">
                Проверено ИНН: {b2bSummary.verifiedInnInQueueCount} ·{' '}
                {formatRubCompact(b2bSummary.intakeQueueRub)}
              </p>
            </div>

            <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-4 sm:p-5 space-y-1">
              <p className="text-xs font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72">
                Выставлено счетов (ЭДО)
              </p>
              <p
                data-testid="crm-kpi-invoiced-rub"
                className="text-2xl font-bold text-[#111111] dark:text-[#F4F3EF]"
              >
                {formatRubCompact(b2bSummary.invoicedPendingRub)}
              </p>
              <p className="text-[11px] text-[#111111]/72 dark:text-[#F4F3EF]/72">
                Счетов: {b2bSummary.invoicedPendingCount} · В Диадоке:{' '}
                {b2bSummary.diadocDraftsCount}
              </p>
            </div>

            <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-4 sm:p-5 space-y-1">
              <p className="text-xs font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72">
                Оплачено · в производстве
              </p>
              <p
                data-testid="crm-kpi-production-rub"
                className="text-2xl font-bold text-[#111111] dark:text-[#F4F3EF]"
              >
                {formatRubCompact(b2bSummary.paidInProductionRub)}
              </p>
              <p className="text-[11px] text-[#111111]/72 dark:text-[#F4F3EF]/72">
                Активных сделок: {b2bSummary.paidInProductionCount} · версий
                выдачи: {b2bSummary.activeDeliverablesCount}
              </p>
            </div>

            <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-4 sm:p-5 space-y-1">
              <p className="text-xs font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72">
                Сдано актов и прав
              </p>
              <p
                data-testid="crm-kpi-closed-rub"
                className="text-2xl font-bold text-[#166534] dark:text-[#4ADE80]"
              >
                {formatRubCompact(b2bSummary.closedActsRub)}
              </p>
              <p className="text-[11px] text-[#111111]/72 dark:text-[#F4F3EF]/72">
                Закрыто сделок: {b2bSummary.closedActsCount} · паспортов прав:{' '}
                {b2bSummary.rightsPassportsCount}
              </p>
            </div>
          </div>

          {/* Высокоплотный табличный реестр сделок и ЭДО */}
          <section
            aria-label="Коммерческий реестр сделок и договоров"
            className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 overflow-hidden"
          >
            {/* Верхняя панель бухгалтерских срезов, поиска и экспорта */}
            <div className="p-4 sm:p-5 border-b border-[#111111]/10 dark:border-white/10 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div
                  role="tablist"
                  aria-label="Бухгалтерские срезы реестра сделок"
                  className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/8 dark:border-white/8"
                >
                  {(
                    [
                      {
                        id: 'all',
                        label: `Все сделки (${orders.length})`,
                      },
                      {
                        id: 'intake_queue',
                        label: `Новые заявки (${b2bSummary.intakeQueueCount})`,
                      },
                      {
                        id: 'awaiting_payment',
                        label: `Счёт выставлен (${b2bSummary.invoicedPendingCount})`,
                      },
                      {
                        id: 'paid_in_work',
                        label: `В производстве (${b2bSummary.paidInProductionCount})`,
                      },
                      {
                        id: 'closed_acts',
                        label: `Сдано / Акты (${b2bSummary.closedActsCount})`,
                      },
                    ] as const
                  ).map((bucket) => {
                    const isBucketActive = bucketFilter === bucket.id;
                    return (
                      <button
                        id={`b2b-bucket-tab-${bucket.id}`}
                        key={bucket.id}
                        type="button"
                        role="tab"
                        aria-selected={isBucketActive}
                        aria-controls="b2b-ledger-tabpanel"
                        tabIndex={isBucketActive ? 0 : -1}
                        data-testid={`b2b-bucket-${bucket.id}`}
                        onClick={() => setBucketFilter(bucket.id)}
                        onKeyDown={(e) => handleBucketTabKeyDown(e, bucket.id)}
                        className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          isBucketActive
                            ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                            : 'text-[#111111]/74 dark:text-[#F4F3EF]/74 hover:text-[#111111] dark:hover:text-white'
                        }`}
                      >
                        {bucket.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    data-testid="crm-export-csv-btn"
                    onClick={handleDownloadCsv}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#C83210] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Download
                      className="w-3.5 h-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>Выгрузить реестр CSV</span>
                  </button>

                  <button
                    type="button"
                    data-testid="crm-refresh-btn"
                    aria-label="Обновить реестр сделок"
                    onClick={() => void fetchOrdersCrm(false)}
                    disabled={isRefreshing}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#C83210] text-xs font-semibold text-[#111111]/80 dark:text-[#F4F3EF]/80 hover:text-[#111111] dark:hover:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isRefreshing ? 'animate-spin' : ''
                      }`}
                      aria-hidden="true"
                    />
                    <span>Обновить</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-8 relative">
                  <label htmlFor="crm-search-input" className="sr-only">
                    Поиск по номеру сделки, ИНН, контрагенту или контакту
                  </label>
                  <Search
                    className="w-3.5 h-3.5 text-[#111111]/65 dark:text-[#F4F3EF]/65 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="crm-search-input"
                    data-testid="b2b-ledger-search-input"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск по номеру #FM-..., счёту, ИНН, контрагенту, контакту или задаче…"
                    className="w-full min-h-[38px] pl-9 pr-3.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-xs text-[#111111] dark:text-[#F4F3EF]"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label htmlFor="b2b-stage-select" className="sr-only">
                    Фильтр по этапу договора
                  </label>
                  <select
                    id="b2b-stage-select"
                    data-testid="b2b-stage-select"
                    value={stageFilter}
                    onChange={(e) =>
                      setStageFilter(e.target.value as 'all' | CrmOrderStage)
                    }
                    className="w-full min-h-[38px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] cursor-pointer"
                  >
                    <option value="all">Все этапы договора (01–06)</option>
                    {CRM_ORDER_STAGES.map((st) => {
                      const meta = getCrmStageMetaForOrder(
                        st.id,
                        'production_only'
                      );
                      return (
                        <option key={st.id} value={st.id}>
                          {meta.stepCode}. {meta.shortLabel}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>

            {/* Табличный реестр сделок (компактные строки 44px, без статичных капсул) */}
            <div
              id="b2b-ledger-tabpanel"
              role="tabpanel"
              aria-labelledby={`b2b-bucket-tab-${bucketFilter}`}
            >
              {filteredEntries.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
                    В выбранном бухгалтерском срезе не найдено сделок по текущему
                    запросу.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setBucketFilter('all');
                      setStageFilter('all');
                      setSearchQuery('');
                    }}
                    className="min-h-[36px] px-4 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#C83210] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Сбросить фильтры реестра
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table
                    data-testid="b2b-orders-ledger-table"
                    className="w-full text-xs text-left border-collapse"
                  >
                    <thead>
                      <tr className="border-b border-[#111111]/10 dark:border-white/10 bg-[#F7F6F2]/70 dark:bg-[#0D0D0F]/60 text-[11px] font-semibold text-[#111111]/74 dark:text-[#F4F3EF]/74">
                        <th scope="col" className="py-2.5 pl-4 pr-2 whitespace-nowrap">
                          Сделка · дата
                        </th>
                        <th scope="col" className="py-2.5 px-2 whitespace-nowrap">
                          Контрагент и ИНН
                        </th>
                        <th scope="col" className="py-2.5 px-2 whitespace-nowrap">
                          Тариф · слот
                        </th>
                        <th scope="col" className="py-2.5 px-2 text-right whitespace-nowrap">
                          Сумма · профиль
                        </th>
                        <th scope="col" className="py-2.5 px-2 whitespace-nowrap">
                          Счёт и ЭДО
                        </th>
                        <th scope="col" className="py-2.5 px-2 whitespace-nowrap">
                          Этап · права
                        </th>
                        <th scope="col" className="py-2.5 pl-2 pr-4 text-right whitespace-nowrap">
                          Документы
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#111111]/8 dark:divide-white/8">
                      {filteredEntries.map(({ order, row }) => {
                        const isSelected = selectedOrder?.id === order.id;
                        return (
                          <tr
                            key={order.id}
                            data-testid={`crm-order-row-${order.orderNumber}`}
                            aria-selected={isSelected}
                            onClick={() => setSelectedOrderId(order.id)}
                            className={`transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#C83210]/[0.07] dark:bg-[#FF7A5C]/[0.13]'
                                : 'hover:bg-[#F7F6F2]/80 dark:hover:bg-white/[0.03]'
                            }`}
                          >
                            <td className="py-2.5 pl-4 pr-2 whitespace-nowrap align-middle">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOrderId(order.id);
                                }}
                                className="min-h-[32px] py-0.5 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-[#C83210] rounded"
                              >
                                <span
                                  className={`block font-mono font-bold ${
                                    isSelected
                                      ? 'text-[#B82D0D] dark:text-[#FF7A5C]'
                                      : 'text-[#111111] dark:text-[#F4F3EF]'
                                  }`}
                                >
                                  #{row.orderNumber}
                                </span>
                                <span className="block text-[11px] text-[#111111]/72 dark:text-[#F4F3EF]/72">
                                  {formatDateTimeShort(row.createdAtIso)}
                                </span>
                              </button>
                            </td>

                            <td className="py-2.5 px-2 align-middle max-w-[180px]">
                              <p
                                title={row.counterpartyTitle}
                                className="font-semibold text-[#111111] dark:text-[#F4F3EF] truncate"
                              >
                                {row.counterpartyTitle}
                              </p>
                              <p className="text-[11px] text-[#111111]/72 dark:text-[#F4F3EF]/72 truncate">
                                <span>{row.innDisplayLabel}</span>
                                {row.innVerified && (
                                  <span className="text-[#166534] dark:text-[#4ADE80] font-semibold">
                                    {' '}
                                    · ФНС ✓
                                  </span>
                                )}
                              </p>
                            </td>

                            <td className="py-2.5 px-2 align-middle max-w-[148px]">
                              <p
                                title={row.formatSummary}
                                className="font-medium text-[#111111] dark:text-[#F4F3EF] truncate"
                              >
                                {row.formatSummary}
                              </p>
                              <p className="text-[11px] text-[#111111]/72 dark:text-[#F4F3EF]/72 whitespace-nowrap">
                                Слот {row.slotSeconds} сек
                              </p>
                            </td>

                            <td className="py-2.5 px-2 text-right align-middle whitespace-nowrap">
                              <p className="font-bold text-[#111111] dark:text-[#F4F3EF]">
                                {row.isNegotiablePrice
                                  ? 'Смета КП'
                                  : formatRubCompact(row.effectivePayableRub)}
                              </p>
                              <p className="text-[11px] text-[#111111]/72 dark:text-[#F4F3EF]/72">
                                {row.executorEntityShort} · {row.taxShortLabel}
                              </p>
                            </td>

                            <td className="py-2.5 px-2 align-middle max-w-[164px]">
                              <p
                                title={row.edoStatusLabel}
                                className={`font-semibold truncate ${getEdoToneTextClass(
                                  row.edoStatusTone
                                )}`}
                              >
                                {row.edoStatusLabel}
                              </p>
                              <p className="text-[11px] text-[#111111]/72 dark:text-[#F4F3EF]/72 truncate">
                                Счёт {row.invoiceNumber}
                              </p>
                            </td>

                            <td className="py-2.5 px-2 align-middle max-w-[168px]">
                              <p
                                title={`${row.stageCode}. ${row.stageShortLabel}`}
                                className="font-semibold text-[#111111] dark:text-[#F4F3EF] truncate"
                              >
                                {row.stageCode}. {row.stageShortLabel}
                              </p>
                              <p className="text-[11px] text-[#111111]/72 dark:text-[#F4F3EF]/72 truncate">
                                {row.rightsStatusLabel}
                              </p>
                            </td>

                            <td className="py-2.5 pl-2 pr-4 text-right align-middle whitespace-nowrap">
                              <button
                                type="button"
                                data-testid={`ledger-open-a4-${order.orderNumber}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOrderId(order.id);
                                  setEdoModalOrder(order);
                                }}
                                className="min-h-[32px] px-2.5 py-1 rounded-lg border border-[#111111]/14 dark:border-white/14 hover:border-[#C83210] text-[11px] font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                              >
                                <FileSpreadsheet
                                  className="w-3 h-3 shrink-0"
                                  aria-hidden="true"
                                />
                                <span>Пакет A4</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* Модульное договорное досье выбранной сделки (3 вкладки вместо простыни) */}
          {selectedOrder ? (
            <AdminB2bOrderDossier
              order={selectedOrder}
              legalProfiles={legalProfiles}
              konturStatus={konturStatus}
              soundEngineers={soundEngineers}
              soundEngineerEmails={soundEngineerEmails}
              isUpdatingOrder={isUpdatingOrder}
              isCreatingDiadocDraft={isCreatingDiadocDraft}
              isUploadingDeliverable={isUploadingDeliverable}
              isRedelivering={isRedelivering}
              onPatchOrder={patchOrderOnServer}
              onOpenDocumentsModal={setEdoModalOrder}
              onCreateDiadocDraft={handleCreateDiadocDraft}
              onDownloadExternCsv={handleDownloadOrderKonturExternCsv}
              onUploadDeliverableFile={handleUploadDeliverableWithMeta}
              onRedeliverGateways={handleRedeliverOrder}
              onAnonymizePdn={handleAnonymizeOrderPdn}
              onOpenProductionVoiceover={onNavigateToProductionOrder}
            />
          ) : (
            <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-8 text-center text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
              Выберите сделку в реестре выше для работы с договором, счётом ЭДО и
              нормативной проверкой хронометража.
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* КОНТУР 2: ПРОИЗВОДСТВО И ОЗВУЧКА (ЦЕХ СЦЕНАРИЕВ И ЗВУКОРЕЖИССЁРОВ)    */}
      {/* ===================================================================== */}
      {viewGroup === 'production' && (
        <div data-testid="b2b-production-view" className="space-y-5">
          <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                Производственный цех: сценарии, дикторы и сдача мастеров
              </h2>
              <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
                Сделок в работе: {b2bSummary.paidInProductionCount} · Всего в
                реестре: {orders.length} · Нарядов звукорежиссёрам:{' '}
                {soundEngineerEmails.length}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void fetchOrdersCrm(false)}
              disabled={isRefreshing}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#C83210] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 shrink-0 ${
                  isRefreshing ? 'animate-spin' : ''
                }`}
                aria-hidden="true"
              />
              <span>Обновить цех</span>
            </button>
          </div>

          <AdminProductionKanbanView
            orders={orders}
            soundEngineers={soundEngineers}
            soundEngineerEmails={soundEngineerEmails}
            selectedOrderId={selectedOrderId}
            onSelectOrderId={setSelectedOrderId}
            onOrderUpdated={(updated) =>
              setOrders((prev) =>
                prev.map((o) => (o.id === updated.id ? updated : o))
              )
            }
            onSoundEngineersUpdated={setSoundEngineers}
            onSoundEngineerEmailsUpdated={setSoundEngineerEmails}
            onFeedback={setFeedbackBanner}
          />
        </div>
      )}

      {/* ===================================================================== */}
      {/* КОНТУР 3: РЕКВИЗИТЫ ИП/ООО, ШЛЮЗЫ И БЕЗОПАСНОСТЬ ЗАЯВОК               */}
      {/* ===================================================================== */}
      {viewGroup === 'settings' && (
        <div data-testid="b2b-settings-view" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#111111]/10 dark:border-white/10 pb-3">
            <div
              role="tablist"
              aria-label="Юридические реквизиты, шлюзы и защита форм"
              className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10"
            >
              <button
                id="crm-subtab-btn-legal"
                type="button"
                role="tab"
                aria-selected={settingsTab === 'legal'}
                aria-controls="crm-settings-tabpanel-legal"
                tabIndex={settingsTab === 'legal' ? 0 : -1}
                data-testid="crm-subtab-legal"
                onClick={() => setSettingsTab('legal')}
                onKeyDown={(e) => handleSettingsTabKeyDown(e, 'legal')}
                className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  settingsTab === 'legal'
                    ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                    : 'text-[#111111]/74 dark:text-[#F4F3EF]/74 hover:text-[#111111] dark:hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Реквизиты ИП / ООО и налоги</span>
              </button>

              <button
                id="crm-subtab-btn-channels"
                type="button"
                role="tab"
                aria-selected={settingsTab === 'channels'}
                aria-controls="crm-settings-tabpanel-channels"
                tabIndex={settingsTab === 'channels' ? 0 : -1}
                data-testid="crm-subtab-channels"
                onClick={() => setSettingsTab('channels')}
                onKeyDown={(e) => handleSettingsTabKeyDown(e, 'channels')}
                className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  settingsTab === 'channels'
                    ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                    : 'text-[#111111]/74 dark:text-[#F4F3EF]/74 hover:text-[#111111] dark:hover:text-white'
                }`}
              >
                <Webhook className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Шлюзы Telegram и Webhook</span>
              </button>

              <button
                id="crm-subtab-btn-security"
                type="button"
                role="tab"
                aria-selected={settingsTab === 'security'}
                aria-controls="crm-settings-tabpanel-security"
                tabIndex={settingsTab === 'security' ? 0 : -1}
                data-testid="crm-subtab-security"
                onClick={() => setSettingsTab('security')}
                onKeyDown={(e) => handleSettingsTabKeyDown(e, 'security')}
                className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  settingsTab === 'security'
                    ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                    : 'text-[#111111]/74 dark:text-[#F4F3EF]/74 hover:text-[#111111] dark:hover:text-white'
                }`}
              >
                <ShieldCheck
                  className="w-3.5 h-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>Антиспам и карантин заявок</span>
              </button>
            </div>
          </div>

          {/* 3.1 Юридические и налоговые реквизиты студии (ИП / ООО, г. Тверь) */}
          {settingsTab === 'legal' &&
            (() => {
              const editedProfile =
                editingEntityTab === 'ip'
                  ? legalDraft.ipProfile
                  : legalDraft.oooProfile;

              return (
                <div
                  id="crm-settings-tabpanel-legal"
                  role="tabpanel"
                  aria-labelledby="crm-subtab-btn-legal"
                  data-testid="crm-legal-profiles-view"
                  className="space-y-6"
                >
                  <section className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-5 sm:p-6 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#111111]/10 dark:border-white/10">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72">
                          Брендированные документы A4 (КП · Договор г. Тверь ·
                          Счёт · Паспорт РАО/ВОИС)
                        </p>
                        <h2 className="text-lg font-bold text-[#111111] dark:text-[#F4F3EF]">
                          Профиль исполнителя (ИП / ООО) и налоговый режим (УСН /
                          НДС)
                        </h2>
                      </div>

                      <button
                        type="button"
                        disabled={isSavingLegal}
                        data-testid="crm-save-legal-profiles-btn"
                        onClick={() => void handleSaveLegalProfiles()}
                        className="w-full sm:w-auto min-h-[42px] px-5 py-2 rounded-xl bg-[#C83210] hover:bg-[#AE2A0C] disabled:opacity-55 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <CheckCircle2
                          className="w-4 h-4 shrink-0"
                          aria-hidden="true"
                        />
                        <span>
                          {isSavingLegal
                            ? 'Сохранение…'
                            : 'Сохранить реквизиты студии'}
                        </span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="rounded-xl p-4 bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10 space-y-2.5">
                        <p className="text-xs font-bold text-[#111111] dark:text-[#F4F3EF]">
                          Активное юрлицо по умолчанию для новых счетов:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            data-testid="crm-legal-active-ip"
                            onClick={() => {
                              setLegalDraft((prev) => ({
                                ...prev,
                                activeEntityKind: 'ip',
                              }));
                              setEditingEntityTab('ip');
                            }}
                            className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-semibold text-left transition-colors cursor-pointer whitespace-nowrap ${
                              legalDraft.activeEntityKind === 'ip'
                                ? 'bg-[#111111] text-white border-[#111111] dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                                : 'bg-white dark:bg-[#141418] border-[#111111]/14 dark:border-white/14'
                            }`}
                          >
                            ИП (без КПП · УСН / НДС)
                          </button>
                          <button
                            type="button"
                            data-testid="crm-legal-active-ooo"
                            onClick={() => {
                              setLegalDraft((prev) => ({
                                ...prev,
                                activeEntityKind: 'ooo',
                              }));
                              setEditingEntityTab('ooo');
                            }}
                            className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-semibold text-left transition-colors cursor-pointer whitespace-nowrap ${
                              legalDraft.activeEntityKind === 'ooo'
                                ? 'bg-[#111111] text-white border-[#111111] dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                                : 'bg-white dark:bg-[#141418] border-[#111111]/14 dark:border-white/14'
                            }`}
                          >
                            ООО (с КПП · УСН / ОСНО)
                          </button>
                        </div>
                      </div>

                      <div className="rounded-xl p-4 bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10 space-y-2.5">
                        <p className="text-xs font-bold text-[#111111] dark:text-[#F4F3EF]">
                          Редактируемая карточка реквизитов:
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            data-testid="crm-legal-edit-tab-ip"
                            onClick={() => setEditingEntityTab('ip')}
                            className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                              editingEntityTab === 'ip'
                                ? 'border-[#C83210] bg-[#C83210]/10 text-[#B82D0D] dark:text-[#FF7A5C]'
                                : 'border-[#111111]/14 dark:border-white/14'
                            }`}
                          >
                            Карточка ИП
                          </button>
                          <button
                            type="button"
                            data-testid="crm-legal-edit-tab-ooo"
                            onClick={() => setEditingEntityTab('ooo')}
                            className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                              editingEntityTab === 'ooo'
                                ? 'border-[#C83210] bg-[#C83210]/10 text-[#B82D0D] dark:text-[#FF7A5C]'
                                : 'border-[#111111]/14 dark:border-white/14'
                            }`}
                          >
                            Карточка ООО
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                      <div className="md:col-span-2 space-y-1">
                        <label
                          htmlFor="crm-legal-name"
                          className="block font-semibold text-[#111111]/74 dark:text-[#F4F3EF]/74"
                        >
                          Полное юридическое наименование
                        </label>
                        <input
                          id="crm-legal-name"
                          type="text"
                          value={editedProfile.legalName}
                          onChange={(e) =>
                            updateEditingProfileField('legalName', e.target.value)
                          }
                          className="w-full min-h-[42px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14"
                        />
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="crm-legal-tax-select"
                          className="block font-semibold text-[#111111]/74 dark:text-[#F4F3EF]/74"
                        >
                          Налоговый режим и ставка НДС
                        </label>
                        <select
                          id="crm-legal-tax-select"
                          data-testid="crm-legal-tax-select"
                          value={editedProfile.taxRegime}
                          onChange={(e) =>
                            updateEditingProfileField(
                              'taxRegime',
                              e.target.value as StudioTaxRegimeId
                            )
                          }
                          className="w-full min-h-[42px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 font-semibold"
                        >
                          {TAX_REGIME_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.shortLabel}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="crm-legal-vat-mode"
                          className="block font-semibold text-[#111111]/74 dark:text-[#F4F3EF]/74"
                        >
                          Порядок расчёта НДС в прайсе
                        </label>
                        <select
                          id="crm-legal-vat-mode"
                          value={editedProfile.vatMode}
                          onChange={(e) =>
                            updateEditingProfileField(
                              'vatMode',
                              e.target.value as StudioVatCalculationMode
                            )
                          }
                          className="w-full min-h-[42px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 font-semibold"
                        >
                          <option value="included">
                            НДС включён в сумму заказа
                          </option>
                          <option value="on_top">
                            НДС начисляется сверху суммы заказа
                          </option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="crm-legal-inn"
                          className="block font-semibold text-[#111111]/74 dark:text-[#F4F3EF]/74"
                        >
                          ИНН
                        </label>
                        <input
                          id="crm-legal-inn"
                          type="text"
                          value={editedProfile.inn}
                          onChange={(e) =>
                            updateEditingProfileField('inn', e.target.value)
                          }
                          className="w-full min-h-[42px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14"
                        />
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="crm-legal-kpp"
                          className="block font-semibold text-[#111111]/74 dark:text-[#F4F3EF]/74"
                        >
                          {editingEntityTab === 'ip'
                            ? 'КПП (у ИП отсутствует)'
                            : 'КПП (9 цифр)'}
                        </label>
                        <input
                          id="crm-legal-kpp"
                          type="text"
                          disabled={editingEntityTab === 'ip'}
                          value={editingEntityTab === 'ip' ? '' : editedProfile.kpp}
                          placeholder={
                            editingEntityTab === 'ip'
                              ? 'Не применяется для ИП'
                              : '695001001'
                          }
                          onChange={(e) =>
                            updateEditingProfileField('kpp', e.target.value)
                          }
                          className="w-full min-h-[42px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 disabled:opacity-55"
                        />
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="crm-legal-ogrn"
                          className="block font-semibold text-[#111111]/74 dark:text-[#F4F3EF]/74"
                        >
                          {editingEntityTab === 'ip' ? 'ОГРНИП' : 'ОГРН'}
                        </label>
                        <input
                          id="crm-legal-ogrn"
                          type="text"
                          value={editedProfile.ogrnOrOgrnip}
                          onChange={(e) =>
                            updateEditingProfileField(
                              'ogrnOrOgrnip',
                              e.target.value
                            )
                          }
                          className="w-full min-h-[42px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14"
                        />
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="crm-legal-city"
                          className="block font-semibold text-[#111111]/74 dark:text-[#F4F3EF]/74"
                        >
                          Город (место заключения договора)
                        </label>
                        <input
                          id="crm-legal-city"
                          type="text"
                          value={editedProfile.city}
                          onChange={(e) =>
                            updateEditingProfileField('city', e.target.value)
                          }
                          className="w-full min-h-[42px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14"
                        />
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="crm-legal-phone"
                          className="block font-semibold text-[#111111]/74 dark:text-[#F4F3EF]/74"
                        >
                          Телефон студии
                        </label>
                        <input
                          id="crm-legal-phone"
                          type="text"
                          value={editedProfile.phone}
                          onChange={(e) =>
                            updateEditingProfileField('phone', e.target.value)
                          }
                          className="w-full min-h-[42px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14"
                        />
                      </div>

                      <div className="md:col-span-2 lg:col-span-3 space-y-1">
                        <label
                          htmlFor="crm-legal-address"
                          className="block font-semibold text-[#111111]/74 dark:text-[#F4F3EF]/74"
                        >
                          Юридический адрес
                        </label>
                        <input
                          id="crm-legal-address"
                          type="text"
                          value={editedProfile.legalAddress}
                          onChange={(e) =>
                            updateEditingProfileField(
                              'legalAddress',
                              e.target.value
                            )
                          }
                          className="w-full min-h-[42px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14"
                        />
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="crm-legal-bank"
                          className="block font-semibold text-[#111111]/74 dark:text-[#F4F3EF]/74"
                        >
                          Банк получателя
                        </label>
                        <input
                          id="crm-legal-bank"
                          type="text"
                          value={editedProfile.bankName}
                          onChange={(e) =>
                            updateEditingProfileField('bankName', e.target.value)
                          }
                          className="w-full min-h-[42px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14"
                        />
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="crm-legal-bik"
                          className="block font-semibold text-[#111111]/74 dark:text-[#F4F3EF]/74"
                        >
                          БИК
                        </label>
                        <input
                          id="crm-legal-bik"
                          type="text"
                          value={editedProfile.bik}
                          onChange={(e) =>
                            updateEditingProfileField('bik', e.target.value)
                          }
                          className="w-full min-h-[42px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14"
                        />
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="crm-legal-checking"
                          className="block font-semibold text-[#111111]/74 dark:text-[#F4F3EF]/74"
                        >
                          Расчётный счёт (20 цифр)
                        </label>
                        <input
                          id="crm-legal-checking"
                          type="text"
                          value={editedProfile.checkingAccount}
                          onChange={(e) =>
                            updateEditingProfileField(
                              'checkingAccount',
                              e.target.value
                            )
                          }
                          className="w-full min-h-[42px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14"
                        />
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="crm-legal-correspondent"
                          className="block font-semibold text-[#111111]/74 dark:text-[#F4F3EF]/74"
                        >
                          Корреспондентский счёт
                        </label>
                        <input
                          id="crm-legal-correspondent"
                          type="text"
                          value={editedProfile.correspondentAccount}
                          onChange={(e) =>
                            updateEditingProfileField(
                              'correspondentAccount',
                              e.target.value
                            )
                          }
                          className="w-full min-h-[42px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14"
                        />
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="crm-legal-signatory"
                          className="block font-semibold text-[#111111]/74 dark:text-[#F4F3EF]/74"
                        >
                          Подписант (И. О. Фамилия)
                        </label>
                        <input
                          id="crm-legal-signatory"
                          type="text"
                          value={editedProfile.signatoryShortName}
                          onChange={(e) =>
                            updateEditingProfileField(
                              'signatoryShortName',
                              e.target.value
                            )
                          }
                          className="w-full min-h-[42px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14"
                        />
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="crm-legal-edo-box"
                          className="block font-semibold text-[#111111]/74 dark:text-[#F4F3EF]/74"
                        >
                          BoxId в Контур.Диадоке (Учёт в Контур.Экстерне)
                        </label>
                        <input
                          id="crm-legal-edo-box"
                          type="text"
                          value={editedProfile.edoParticipantId}
                          onChange={(e) =>
                            updateEditingProfileField(
                              'edoParticipantId',
                              e.target.value
                            )
                          }
                          className="w-full min-h-[42px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14"
                        />
                      </div>
                    </div>
                  </section>
                </div>
              );
            })()}

          {/* 3.2 Шлюзы Telegram и Webhook */}
          {settingsTab === 'channels' && (
            <div
              id="crm-settings-tabpanel-channels"
              role="tabpanel"
              aria-labelledby="crm-subtab-btn-channels"
              data-testid="crm-channels-view"
              className="space-y-6"
            >
              <section className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-5 sm:p-6 space-y-4">
                <div className="space-y-1 pb-3 border-b border-[#111111]/8 dark:border-white/8">
                  <p className="text-xs font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72">
                    Архитектура гарантированного приёма заявок (Zero-Loss Outbox)
                  </p>
                  <h2 className="text-lg font-bold text-[#111111] dark:text-[#F4F3EF]">
                    Куда поступают коммерческие заявки и уведомления о смене
                    этапа сделки
                  </h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 divide-y lg:divide-y-0 lg:divide-x divide-[#111111]/10 dark:divide-white/10 text-xs">
                  <div className="space-y-1.5">
                    <p className="font-bold text-[#166534] dark:text-[#4ADE80]">
                      Контур 1 · Встроенный B2B-реестр студии (Активен всегда)
                    </p>
                    <p className="leading-relaxed text-[#111111]/76 dark:text-[#F4F3EF]/76">
                      После криптографической фильтрации ботов и проверки ИНН
                      заявка атомарно сохраняется на сервере со слепком тарифа,
                      хронометража и реквизитов. Ни одна сделка не теряется даже
                      при недоступности внешних мессенджеров.
                    </p>
                  </div>

                  <div className="pt-4 lg:pt-0 lg:pl-5 space-y-1.5">
                    <p className="font-bold text-[#111111] dark:text-[#F4F3EF]">
                      Контур 2 · Оперативный Telegram-пульт продюсеров (SLA 15
                      мин)
                    </p>
                    <p className="leading-relaxed text-[#111111]/76 dark:text-[#F4F3EF]/76">
                      Сервер мгновенно отправляет карточку нового заказа и
                      переходы этапов в закрытый чат продюсеров через Telegram
                      Bot API с использованием ключа окружения{' '}
                      <code>TELEGRAM_ORDERS_BOT_TOKEN</code>.
                    </p>
                  </div>

                  <div className="pt-4 lg:pt-0 lg:pl-5 space-y-1.5">
                    <p className="font-bold text-[#111111] dark:text-[#F4F3EF]">
                      Контур 3 · Подписанный Webhook во внешние CRM и 1С / ЭДО
                    </p>
                    <p className="leading-relaxed text-[#111111]/76 dark:text-[#F4F3EF]/76">
                      Параллельно сервер передаёт строгий JSON-пакет с заголовком
                      подписи <code>X-FMWorks-Signature</code> (HMAC-SHA256) в
                      amoCRM, Битрикс24, 1С или корпоративную учётную систему.
                    </p>
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                {/* Настройка Telegram */}
                <section className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-5 sm:p-6 space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#111111]/8 dark:border-white/8">
                      <div>
                        <h3 className="text-base font-bold text-[#111111] dark:text-[#F4F3EF]">
                          Telegram-шлюз студии
                        </h3>
                        <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
                          Мгновенные уведомления при изменении статуса и
                          создании сделок
                        </p>
                      </div>
                      <label className="min-h-[32px] inline-flex items-center gap-2.5 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          data-testid="crm-tg-enabled-checkbox"
                          checked={tgEnabled}
                          onChange={(e) => setTgEnabled(e.target.checked)}
                          className="w-6 h-6 shrink-0 accent-[#C83210] cursor-pointer"
                        />
                        <span>Включён</span>
                      </label>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div
                        data-testid="crm-tg-env-token-status"
                        className="rounded-xl p-3 bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10 space-y-1"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                            Серверный ключ <code>TELEGRAM_ORDERS_BOT_TOKEN</code>
                          </span>
                          <span
                            className={`font-semibold ${
                              tgHasToken
                                ? 'text-[#166534] dark:text-[#4ADE80]'
                                : 'text-[#92400E] dark:text-[#FBBF24]'
                            }`}
                          >
                            {tgHasToken
                              ? tgTokenSource === 'env'
                                ? `Подключён из окружения · ${tgMaskedToken}`
                                : `Подключён на сервере · ${tgMaskedToken}`
                              : 'Ожидает настройки на сервере'}
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-[#111111]/74 dark:text-[#F4F3EF]/74">
                          {tgHasToken
                            ? 'Секретный токен считывается напрямую на сервере и не передаётся в браузер. При отсутствии Chat ID сервер определит рабочий чат после команды /start.'
                            : 'Задайте переменную окружения TELEGRAM_ORDERS_BOT_TOKEN на сервере — отправка включится автоматически.'}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label
                            htmlFor="tg-chat-id"
                            className="font-semibold text-[#111111]/78 dark:text-[#F4F3EF]/78"
                          >
                            Chat ID рабочей группы студии:
                          </label>
                          <button
                            type="button"
                            disabled={isDetectingTgChat}
                            data-testid="crm-detect-tg-chat-btn"
                            onClick={() => void handleDetectTelegramChat()}
                            className="min-h-[28px] px-2 py-1 rounded-md text-[11px] font-semibold text-[#B82D0D] dark:text-[#FF7A5C] hover:underline disabled:opacity-50 cursor-pointer"
                          >
                            {isDetectingTgChat
                              ? 'Поиск чата…'
                              : 'Определить Chat ID из бота'}
                          </button>
                        </div>
                        <input
                          id="tg-chat-id"
                          data-testid="crm-tg-chat-id-input"
                          type="text"
                          value={tgChatId}
                          onChange={(e) => setTgChatId(e.target.value)}
                          placeholder="Автоопределение после /start или -1001987654321"
                          className="w-full min-h-[38px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs"
                        />
                        {tgDiscoveredChatTitle && tgChatId && (
                          <p className="text-[11px] text-[#166534] dark:text-[#4ADE80]">
                            Привязанный чат: {tgDiscoveredChatTitle} · ID{' '}
                            {tgChatId}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 pt-1">
                        <div className="flex flex-wrap items-center gap-4">
                          <label className="min-h-[32px] inline-flex items-center gap-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={tgNotifyNew}
                              onChange={(e) => setTgNotifyNew(e.target.checked)}
                              className="w-6 h-6 shrink-0 accent-[#C83210] cursor-pointer"
                            />
                            <span>Новый заказ</span>
                          </label>
                          <label className="min-h-[32px] inline-flex items-center gap-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              data-testid="crm-tg-notify-stage-checkbox"
                              checked={tgNotifyStage}
                              onChange={(e) =>
                                setTgNotifyStage(e.target.checked)
                              }
                              className="w-6 h-6 shrink-0 accent-[#C83210] cursor-pointer"
                            />
                            <span>Изменение статуса сделки</span>
                          </label>
                        </div>

                        <label className="min-h-[40px] inline-flex items-start gap-2.5 cursor-pointer rounded-xl p-2.5 bg-[#166534]/[0.08] border border-[#166534]/20">
                          <input
                            type="checkbox"
                            data-testid="crm-tg-mask-pdn-checkbox"
                            checked={tgMaskPdn}
                            onChange={(e) => setTgMaskPdn(e.target.checked)}
                            className="mt-0.5 w-6 h-6 shrink-0 accent-[#166534] cursor-pointer"
                          />
                          <span className="leading-snug text-[#111111]/88 dark:text-[#F4F3EF]/88">
                            <strong>
                              Обезличивать ПДн в Telegram (ст. 12 152-ФЗ):
                            </strong>{' '}
                            отправлять только номер сделки, переход статуса и
                            сумму договора без телефона, e-mail и ИНН.
                          </span>
                        </label>
                      </div>
                    </div>

                    {samplePreviewOrder && (
                      <div className="space-y-2 pt-2 border-t border-[#111111]/8 dark:border-white/8">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72">
                            Предпросмотр Telegram (#
                            {samplePreviewOrder.orderNumber}):
                          </p>
                          <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10">
                            <button
                              type="button"
                              data-testid="crm-tg-preview-stage-btn"
                              onClick={() =>
                                setTgPreviewEvent('order.stage_changed')
                              }
                              className={`min-h-[28px] px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                                tgPreviewEvent === 'order.stage_changed'
                                  ? 'bg-white dark:bg-[#1E1E24] text-[#111111] dark:text-[#F4F3EF]'
                                  : 'text-[#111111]/74 dark:text-[#F4F3EF]/74 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                              }`}
                            >
                              Смена статуса
                            </button>
                            <button
                              type="button"
                              data-testid="crm-tg-preview-created-btn"
                              onClick={() => setTgPreviewEvent('order.created')}
                              className={`min-h-[28px] px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                                tgPreviewEvent === 'order.created'
                                  ? 'bg-white dark:bg-[#1E1E24] text-[#111111] dark:text-[#F4F3EF]'
                                  : 'text-[#111111]/74 dark:text-[#F4F3EF]/74 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                              }`}
                            >
                              Новый заказ
                            </button>
                          </div>
                        </div>
                        <pre
                          data-testid="crm-tg-message-preview"
                          className="p-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[11px] leading-relaxed whitespace-pre-wrap font-mono text-[#111111]/85 dark:text-[#F4F3EF]/85 max-h-48 overflow-y-auto"
                        >
                          {formatTelegramOrderDispatchMessage(
                            samplePreviewOrder,
                            tgPreviewEvent,
                            {
                              maskPdn: tgMaskPdn,
                              statusChange:
                                tgPreviewEvent === 'order.stage_changed'
                                  ? {
                                      previousStage: 'new_hold',
                                      nextStage:
                                        samplePreviewOrder.stage === 'new_hold'
                                          ? 'quota_locked'
                                          : samplePreviewOrder.stage,
                                      actor: 'producer_crm',
                                      workflowStepLabel:
                                        'Статус обновлён продюсером студии в реестре',
                                      changedAtIso:
                                        samplePreviewOrder.updatedAt,
                                    }
                                  : undefined,
                            }
                          )}
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
                        <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
                          POST JSON с подписью HMAC-SHA256 и реквизитами сделки
                        </p>
                      </div>
                      <label className="min-h-[32px] inline-flex items-center gap-2.5 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          data-testid="crm-webhook-enabled-checkbox"
                          checked={whEnabled}
                          onChange={(e) => setWhEnabled(e.target.checked)}
                          className="w-6 h-6 shrink-0 accent-[#C83210] cursor-pointer"
                        />
                        <span>Включён</span>
                      </label>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label
                            htmlFor="wh-endpoint-url"
                            className="font-semibold text-[#111111]/78 dark:text-[#F4F3EF]/78"
                          >
                            URL приёмника внешней CRM:
                          </label>
                          <button
                            type="button"
                            data-testid="crm-bind-loopback-webhook-btn"
                            onClick={handleBindLoopbackWebhook}
                            className="min-h-[28px] px-2 py-1 rounded-md text-[11px] font-semibold text-[#B82D0D] dark:text-[#FF7A5C] hover:underline cursor-pointer"
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
                        {whEndpointUrl.trim() &&
                          (() => {
                            const safety =
                              evaluateWebhookEndpointRfSafety(whEndpointUrl);
                            if (safety.warning) {
                              return (
                                <p
                                  className={`text-[11px] leading-snug pt-0.5 ${
                                    safety.isBannedForeignService
                                      ? 'text-[#B91C1C] dark:text-[#F87171] font-semibold'
                                      : 'text-[#92400E] dark:text-[#FBBF24]'
                                  }`}
                                >
                                  {safety.warning}
                                </p>
                              );
                            }
                            if (safety.isRfContourRecommended) {
                              return (
                                <p className="text-[11px] text-[#166534] dark:text-[#4ADE80] inline-flex items-center gap-1 pt-0.5">
                                  <ShieldCheck
                                    className="w-3.5 h-3.5 shrink-0"
                                    aria-hidden="true"
                                  />
                                  <span>
                                    Сервер находится в допустимом контуре РФ
                                    (ч. 5 ст. 18 152-ФЗ).
                                  </span>
                                </p>
                              );
                            }
                            return null;
                          })()}
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="wh-hmac-secret"
                          className="block font-semibold text-[#111111]/78 dark:text-[#F4F3EF]/78"
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
                        <label className="min-h-[32px] inline-flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={whNotifyNew}
                            onChange={(e) => setWhNotifyNew(e.target.checked)}
                            className="w-6 h-6 shrink-0 accent-[#C83210] cursor-pointer"
                          />
                          <span>Событие order.created</span>
                        </label>
                        <label className="min-h-[32px] inline-flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={whNotifyStage}
                            onChange={(e) => setWhNotifyStage(e.target.checked)}
                            className="w-6 h-6 shrink-0 accent-[#C83210] cursor-pointer"
                          />
                          <span>Событие order.stage_changed</span>
                        </label>
                      </div>
                    </div>

                    {samplePreviewOrder && (
                      <div className="space-y-1.5 pt-2 border-t border-[#111111]/8 dark:border-white/8">
                        <p className="text-[11px] font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72">
                          JSON-конверт Webhook (#{samplePreviewOrder.orderNumber}
                          ):
                        </p>
                        <pre className="p-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[11px] leading-relaxed whitespace-pre-wrap font-mono text-[#111111]/85 dark:text-[#F4F3EF]/85 max-h-48 overflow-y-auto">
                          {JSON.stringify(
                            buildWebhookOrderEnvelope(
                              samplePreviewOrder,
                              tgPreviewEvent,
                              samplePreviewOrder.updatedAt,
                              tgPreviewEvent === 'order.stage_changed'
                                ? {
                                    previousStage: 'new_hold',
                                    nextStage:
                                      samplePreviewOrder.stage === 'new_hold'
                                        ? 'quota_locked'
                                        : samplePreviewOrder.stage,
                                    actor: 'producer_crm',
                                    workflowStepLabel:
                                      'Статус обновлён продюсером студии в реестре',
                                  }
                                : undefined
                            ),
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <section className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-[#111111] dark:text-[#F4F3EF]">
                      Журнал доставки внешних шлюзов
                    </h3>
                    <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
                      Протокол последних отправок в Telegram и внешние CRM с
                      кодом ответа и задержкой
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      disabled={isTestingDispatch}
                      data-testid="crm-test-stage-dispatch-btn"
                      onClick={() =>
                        void handleTestDispatchGateway('order.stage_changed')
                      }
                      className="min-h-[40px] px-4 py-2 rounded-xl border border-[#111111]/16 dark:border-white/16 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] hover:border-[#C83210] inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Send className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        {isTestingDispatch
                          ? 'Проверка связи…'
                          : 'Проверить уведомление смены статуса'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={isTestingDispatch}
                      data-testid="crm-test-dispatch-btn"
                      onClick={() =>
                        void handleTestDispatchGateway('dispatch.test')
                      }
                      className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111]/78 dark:text-[#F4F3EF]/78 hover:border-[#C83210] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <span>Тест нового заказа</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSavingSettings}
                      data-testid="crm-save-dispatch-settings-btn"
                      onClick={() => void handleSaveDispatchSettings()}
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-[#C83210] hover:bg-[#AE2A0C] text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <CheckCircle2
                        className="w-3.5 h-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        {isSavingSettings
                          ? 'Сохранение…'
                          : 'Сохранить настройки шлюзов'}
                      </span>
                    </button>
                  </div>
                </div>

                {dispatchLogs.length === 0 ? (
                  <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72 py-3 border-t border-[#111111]/8 dark:border-white/8">
                    Попыток внешней доставки в текущей сессии ещё не
                    зафиксировано. Измените статус любой сделки или запустите
                    контрольную проверку.
                  </p>
                ) : (
                  <div className="overflow-x-auto border-t border-[#111111]/10 dark:border-white/10">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="text-[#111111]/72 dark:text-[#F4F3EF]/72 border-b border-[#111111]/8 dark:border-white/8">
                          <th scope="col" className="py-2 pr-3 font-semibold">
                            Время
                          </th>
                          <th scope="col" className="py-2 px-2 font-semibold">
                            Сделка
                          </th>
                          <th scope="col" className="py-2 px-2 font-semibold">
                            Шлюз / Событие
                          </th>
                          <th scope="col" className="py-2 px-2 font-semibold">
                            Статус
                          </th>
                          <th
                            scope="col"
                            className="py-2 pl-2 font-semibold text-right"
                          >
                            Ответ
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#111111]/6 dark:divide-white/6">
                        {dispatchLogs.map((log) => {
                          const pres = getDeliveryStatePresentation(log.state);
                          return (
                            <tr key={log.id}>
                              <td className="py-2 pr-3 whitespace-nowrap text-[#111111]/74 dark:text-[#F4F3EF]/74">
                                {formatDateTimeShort(log.timestamp)}
                              </td>
                              <td className="py-2 px-2 font-bold whitespace-nowrap">
                                #{log.orderNumber}
                              </td>
                              <td className="py-2 px-2 whitespace-nowrap">
                                {log.channel === 'telegram'
                                  ? 'Telegram'
                                  : 'Webhook'}{' '}
                                · {log.event}
                              </td>
                              <td
                                className={`py-2 px-2 font-semibold ${pres.colorClass}`}
                              >
                                {log.summary}
                              </td>
                              <td className="py-2 pl-2 text-right whitespace-nowrap text-[#111111]/74 dark:text-[#F4F3EF]/74">
                                {log.httpStatus
                                  ? `HTTP ${log.httpStatus}`
                                  : '—'}{' '}
                                ({log.latencyMs} мс)
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

          {/* 3.3 Антиспам, проверка ИНН и теневой карантин */}
          {settingsTab === 'security' && (
            <div
              id="crm-settings-tabpanel-security"
              role="tabpanel"
              aria-labelledby="crm-subtab-btn-security"
            >
              <AdminSecurityPanel />
            </div>
          )}
        </div>
      )}

      {/* Фирменный пакет документов A4 FMWorks® (КП · Договор + Приложение · Счёт · Паспорт) */}
      {edoModalOrder && (
        <BrandedDocumentSuiteModal
          isOpen={Boolean(edoModalOrder)}
          onClose={() => setEdoModalOrder(null)}
          mode="admin"
          initialDoc="invoice"
          legalProfiles={legalProfiles}
          order={{
            orderId: edoModalOrder.id,
            orderNumber: edoModalOrder.orderNumber,
            createdAtIso: edoModalOrder.createdAt,
            formatLabel: edoModalOrder.formatLabel,
            baseBudgetRub: edoModalOrder.totalBudgetRub,
            defaultDurationSec: resolveOrderTargetSlotSeconds(edoModalOrder),
            contact: edoModalOrder.contact,
            companyOrInn: edoModalOrder.companyOrInn,
            briefText: edoModalOrder.briefText,
            documentMeta: edoModalOrder.documentMeta ?? null,
          }}
          onSaveOrderDocumentMeta={async (orderId, nextMeta, nextBudgetRub) => {
            await patchOrderOnServer(
              orderId,
              {
                documentMeta: nextMeta,
                ...(typeof nextBudgetRub === 'number'
                  ? { totalBudgetRub: nextBudgetRub }
                  : {}),
              },
              `Документы и реквизиты сделки #${edoModalOrder.orderNumber} сохранены.`
            );
          }}
        />
      )}
    </div>
  );
}
