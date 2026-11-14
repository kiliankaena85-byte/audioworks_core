import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileAudio,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Lock,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ClientAccountPublicProfile,
  DEMO_CLIENT_CABINET_EMAIL,
  normalizeClientEmail,
} from '../../data/clientAuthShared';
import {
  inspectInnDigits,
  normalizeInnDigits,
  parseCompanyNameAndInn,
} from '../order/companyDetailsHelpers';
import {
  CLIENT_DELIVERY_CHANNEL_OPTIONS,
  ClientCabinetOrderSummary,
  ClientDeliveryChannel,
  DELIVERY_CLOUD_OPTIONS,
  DELIVERY_MESSENGER_OPTIONS,
  formatFileSizeReadable,
  mapCrmStageToClientProgress,
  OrderDeliverableFile,
  parseDeliveryDetailSelection,
  readClientCabinetEntries,
  removeClientCabinetEntry,
  resolveDeliveryChannelLabel,
  upsertClientCabinetEntry,
  validateDeliveryEmail,
} from '../../data/clientCabinetHelpers';
import { orderDraftStore } from '../../data/orderDraftStore';
import { PlatformRoute } from '../../data/platformRouter';
import { formatRubCompact } from '../../data/radioInventory';
import { StudioLegalProfilesConfig } from '../../data/studioDocumentsCore';
import { BrandedDocumentSuiteModal } from '../documents/BrandedDocumentSuiteModal';

interface ClientCabinetPageProps {
  onNavigate: (route: PlatformRoute) => void;
}

const DELIVERABLE_KIND_LABELS: Record<OrderDeliverableFile['kind'], string> = {
  audio_master: 'Аудиомастер',
  script: 'Сценарий',
  invoice: 'Счёт / документы',
  passport: 'Паспорт прав',
  archive: 'Архив / материалы',
};

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function readFileAsBase64Payload(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = res.indexOf(',');
      resolve(commaIdx >= 0 ? res.slice(commaIdx + 1) : res);
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать выбранный файл'));
    reader.readAsDataURL(file);
  });
}

export function ClientCabinetPage({ onNavigate }: ClientCabinetPageProps) {
  const [orders, setOrders] = useState<ClientCabinetOrderSummary[]>([]);
  const [clientAccount, setClientAccount] =
    useState<ClientAccountPublicProfile | null>(null);
  const [legalProfiles, setLegalProfiles] =
    useState<StudioLegalProfilesConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [authBanner, setAuthBanner] = useState<string | null>(null);

  // Вход без пароля по почте (Magic-ссылка) + поиск заказа по номеру
  const [showLookupForm, setShowLookupForm] = useState<boolean>(false);
  const [accessTab, setAccessTab] = useState<'magic_email' | 'order_number'>(
    'magic_email'
  );
  const [magicEmailInput, setMagicEmailInput] = useState<string>('');
  const [isRequestingMagic, setIsRequestingMagic] = useState<boolean>(false);
  const [magicRequestError, setMagicRequestError] = useState<string | null>(null);
  const [magicDispatchResult, setMagicDispatchResult] = useState<{
    email: string;
    deliveryMode: 'email_gateway' | 'local_preview';
    magicLinkPath?: string;
    magicLinkUrl?: string;
  } | null>(null);
  const [isVerifyingMagic, setIsVerifyingMagic] = useState<boolean>(false);
  const consumedMagicTokenRef = useRef<string | null>(null);

  // Ссылка для быстрого переноса сессии на другое устройство
  const [crossDeviceLink, setCrossDeviceLink] = useState<{
    magicLinkUrl: string;
    magicLinkPath: string;
    copied: boolean;
  } | null>(null);
  const [isIssuingCrossDeviceLink, setIsIssuingCrossDeviceLink] =
    useState<boolean>(false);

  // Привязка анонимных заказов устройства к почте в 1 клик
  const [bindEmailInput, setBindEmailInput] = useState<string>('');
  const [isBindingEmail, setIsBindingEmail] = useState<boolean>(false);
  const [bindEmailError, setBindEmailError] = useState<string | null>(null);

  // Поиск и подключение заказа по номеру + телефону / ИНН / @Telegram
  const [orderNumberInput, setOrderNumberInput] = useState<string>('');
  const [verifierInput, setVerifierInput] = useState<string>('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false);

  // Редактирование деталей канала выдачи (другой мессенджер/облако или e-mail)
  const [deliveryDraftByOrder, setDeliveryDraftByOrder] = useState<
    Record<string, string>
  >({});

  // Редактирование реквизитов для моментального счёта по конкретному заказу
  const [editingInnOrderNum, setEditingInnOrderNum] = useState<string | null>(null);
  const [innCompanyNameDraft, setInnCompanyNameDraft] = useState<string>('');
  const [innDigitsDraft, setInnDigitsDraft] = useState<string>('');
  const [innSaveError, setInnSaveError] = useState<string | null>(null);
  const [isSavingPrefsFor, setIsSavingPrefsFor] = useState<string | null>(null);

  // Загрузка клиентского файла к заказу
  const [uploadNoteByOrder, setUploadNoteByOrder] = useState<Record<string, string>>({});
  const [uploadingOrderNum, setUploadingOrderNum] = useState<string | null>(null);
  const [uploadFeedbackByOrder, setUploadFeedbackByOrder] = useState<
    Record<string, { kind: 'ok' | 'error'; text: string }>
  >({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Модальное окно счёта и пакета документов A4
  const [invoiceModalOrder, setInvoiceModalOrder] =
    useState<ClientCabinetOrderSummary | null>(null);

  const verifyAndConsumeMagicToken = useCallback(async (rawToken: string) => {
    const cleanToken = rawToken.trim();
    if (!cleanToken) return { ok: false as const, error: null };
    setIsVerifyingMagic(true);
    setStatusError(null);
    setMagicRequestError(null);
    try {
      const stored = readClientCabinetEntries();
      const res = await fetch('/api/client-auth/verify-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: cleanToken,
          localItems: stored.map((entry) => ({
            orderNumber: entry.orderNumber,
            rescueToken: entry.rescueToken,
          })),
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        authenticated?: boolean;
        account?: ClientAccountPublicProfile | null;
        orders?: ClientCabinetOrderSummary[];
        legalProfiles?: StudioLegalProfilesConfig;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(
          json.error ?? 'Ссылка для входа недействительна или уже была использована'
        );
      }

      const verifiedOrders = Array.isArray(json.orders) ? json.orders : [];
      for (const ord of verifiedOrders) {
        upsertClientCabinetEntry({
          orderNumber: ord.orderNumber,
          rescueToken: ord.rescueToken,
          contactLine: ord.contact,
          companyLine: ord.companyOrInn,
        });
      }
      if (json.legalProfiles) {
        setLegalProfiles(json.legalProfiles);
      }
      setClientAccount(json.account ?? null);
      setOrders(verifiedOrders);
      setMagicDispatchResult(null);
      setMagicEmailInput('');
      setAuthBanner(null);
      setShowLookupForm(verifiedOrders.length === 0);
      return { ok: true as const, error: null };
    } catch (err) {
      const errMsg =
        err instanceof Error
          ? err.message
          : 'Не удалось выполнить вход по одноразовой ссылке';
      setStatusError(errMsg);
      setAccessTab('magic_email');
      setShowLookupForm(true);
      return { ok: false as const, error: errMsg };
    } finally {
      setIsVerifyingMagic(false);
    }
  }, []);

  const loadStoredOrders = useCallback(async () => {
    let magicFailedError: string | null = null;
    // 1. Проверяем, не открыт ли кабинет по одноразовой magic-ссылке (?magic=...)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const magicFromUrl = params.get('magic')?.trim() || '';
      if (magicFromUrl && consumedMagicTokenRef.current !== magicFromUrl) {
        consumedMagicTokenRef.current = magicFromUrl;
        window.history.replaceState({}, '', '/cabinet');
        setIsLoading(true);
        const magicResult = await verifyAndConsumeMagicToken(magicFromUrl);
        if (magicResult.ok) {
          setIsLoading(false);
          return;
        }
        magicFailedError = magicResult.error;
      }
    }

    setIsLoading(true);
    if (!magicFailedError) {
      setStatusError(null);
    }
    const stored = readClientCabinetEntries();

    try {
      const [sessionRes, batchRes] = await Promise.all([
        fetch('/api/client-auth/session', {
          headers: { Accept: 'application/json' },
        }),
        stored.length > 0
          ? fetch('/api/client-cabinet/batch-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                items: stored.map((entry) => ({
                  orderNumber: entry.orderNumber,
                  rescueToken: entry.rescueToken,
                })),
              }),
            })
          : Promise.resolve(null),
      ]);

      const sessionJson = sessionRes.ok
        ? ((await sessionRes.json()) as {
            ok?: boolean;
            authenticated?: boolean;
            account?: ClientAccountPublicProfile | null;
            orders?: ClientCabinetOrderSummary[];
            legalProfiles?: StudioLegalProfilesConfig;
          })
        : null;

      const batchJson =
        batchRes && batchRes.ok
          ? ((await batchRes.json()) as {
              ok?: boolean;
              orders?: ClientCabinetOrderSummary[];
              legalProfiles?: StudioLegalProfilesConfig;
            })
          : null;

      if (sessionJson?.legalProfiles) {
        setLegalProfiles(sessionJson.legalProfiles);
      } else if (batchJson?.legalProfiles) {
        setLegalProfiles(batchJson.legalProfiles);
      }

      const sessionOrders =
        sessionJson?.authenticated && Array.isArray(sessionJson.orders)
          ? sessionJson.orders
          : [];
      const deviceOrders = Array.isArray(batchJson?.orders) ? batchJson!.orders : [];

      if (stored.length > 0 && batchRes?.ok) {
        const validDeviceNums = new Set(deviceOrders.map((o) => o.orderNumber));
        for (const entry of stored) {
          if (!validDeviceNums.has(entry.orderNumber)) {
            removeClientCabinetEntry(entry.orderNumber);
          }
        }
      }

      // Если клиент авторизован по почте, синхронизируем его заказы и склеиваем возможные анонимные заказы устройства
      if (sessionJson?.authenticated && sessionJson.account) {
        const unboundDeviceItems = deviceOrders
          .filter((d) => !d.clientEmail)
          .map((d) => ({
            orderNumber: d.orderNumber,
            rescueToken: d.rescueToken,
          }));

        if (unboundDeviceItems.length > 0) {
          const bindRes = await fetch('/api/client-auth/bind-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: sessionJson.account.email,
              items: unboundDeviceItems,
            }),
          });
          if (bindRes.ok) {
            const bindJson = (await bindRes.json()) as {
              ok?: boolean;
              account?: ClientAccountPublicProfile;
              orders?: ClientCabinetOrderSummary[];
            };
            if (bindJson.ok && Array.isArray(bindJson.orders)) {
              for (const ord of bindJson.orders) {
                upsertClientCabinetEntry({
                  orderNumber: ord.orderNumber,
                  rescueToken: ord.rescueToken,
                  contactLine: ord.contact,
                  companyLine: ord.companyOrInn,
                });
              }
              setClientAccount(bindJson.account ?? sessionJson.account);
              setOrders(bindJson.orders);
              if (bindJson.orders.length === 0) {
                setShowLookupForm(true);
              }
              return;
            }
          }
        }

        setClientAccount(sessionJson.account);
      } else {
        setClientAccount(null);
      }

      const byOrderNum = new Map<string, ClientCabinetOrderSummary>();
      for (const ord of sessionOrders) {
        byOrderNum.set(ord.orderNumber, ord);
        upsertClientCabinetEntry({
          orderNumber: ord.orderNumber,
          rescueToken: ord.rescueToken,
          contactLine: ord.contact,
          companyLine: ord.companyOrInn,
        });
      }
      for (const ord of deviceOrders) {
        if (!byOrderNum.has(ord.orderNumber)) {
          byOrderNum.set(ord.orderNumber, ord);
        }
      }

      const mergedOrders = Array.from(byOrderNum.values()).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );

      setOrders(mergedOrders);
      if (mergedOrders.length === 0) {
        setShowLookupForm(true);
      }
    } catch (err) {
      setStatusError(
        err instanceof Error
          ? err.message
          : 'Ошибка загрузки данных личного кабинета'
      );
    } finally {
      setIsLoading(false);
    }
  }, [verifyAndConsumeMagicToken]);

  useEffect(() => {
    void loadStoredOrders();
  }, [loadStoredOrders]);

  const executeRequestMagicLink = async (rawEmail: string) => {
    const cleanEmail = normalizeClientEmail(rawEmail);
    if (!cleanEmail) {
      setMagicRequestError(
        'Укажите корректную почту (например, name@company.ru)'
      );
      return;
    }

    setIsRequestingMagic(true);
    setMagicRequestError(null);
    setStatusError(null);
    setMagicDispatchResult(null);
    try {
      const res = await fetch('/api/client-auth/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        email?: string;
        deliveryMode?: 'email_gateway' | 'local_preview';
        magicLinkPath?: string;
        magicLinkUrl?: string;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(
          json.error ?? 'Не удалось отправить ссылку для входа на почту'
        );
      }

      setMagicDispatchResult({
        email: json.email ?? cleanEmail,
        deliveryMode: json.deliveryMode ?? 'local_preview',
        magicLinkPath: json.magicLinkPath,
        magicLinkUrl: json.magicLinkUrl,
      });
    } catch (err) {
      setMagicRequestError(
        err instanceof Error
          ? err.message
          : 'Не удалось сформировать ссылку для входа'
      );
    } finally {
      setIsRequestingMagic(false);
    }
  };

  const handleMagicLinkSubmit = (e: FormEvent) => {
    e.preventDefault();
    void executeRequestMagicLink(magicEmailInput);
  };

  const handleOpenPreviewMagicLink = async () => {
    const path = magicDispatchResult?.magicLinkPath;
    if (!path) return;
    const queryIdx = path.indexOf('?');
    const token =
      queryIdx >= 0
        ? new URLSearchParams(path.slice(queryIdx)).get('magic') ?? ''
        : '';
    if (!token) return;
    consumedMagicTokenRef.current = token;
    await verifyAndConsumeMagicToken(token);
  };

  const handleIssueCrossDeviceMagicLink = async () => {
    if (!clientAccount?.email || isIssuingCrossDeviceLink) return;
    setIsIssuingCrossDeviceLink(true);
    setStatusError(null);
    try {
      const res = await fetch('/api/client-auth/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clientAccount.email }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        magicLinkUrl?: string;
        magicLinkPath?: string;
        deliveryMode?: 'email_gateway' | 'local_preview';
        error?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? 'Не удалось создать ссылку для устройства');
      }
      if (json.magicLinkUrl && json.magicLinkPath) {
        let copied = false;
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(json.magicLinkUrl);
            copied = true;
          }
        } catch {
          copied = false;
        }
        setCrossDeviceLink({
          magicLinkUrl: json.magicLinkUrl,
          magicLinkPath: json.magicLinkPath,
          copied,
        });
      } else {
        setAuthBanner(
          `Одноразовая ссылка для входа отправлена на ${clientAccount.email}`
        );
      }
    } catch (err) {
      setStatusError(
        err instanceof Error ? err.message : 'Ошибка выпуска ссылки входа'
      );
    } finally {
      setIsIssuingCrossDeviceLink(false);
    }
  };

  const handleBindAnonymousOrdersToEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (isBindingEmail || orders.length === 0) return;
    const cleanEmail = normalizeClientEmail(bindEmailInput);
    if (!cleanEmail) {
      setBindEmailError('Укажите корректную почту (например, name@company.ru)');
      return;
    }

    setIsBindingEmail(true);
    setBindEmailError(null);
    try {
      const res = await fetch('/api/client-auth/bind-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          items: orders.map((o) => ({
            orderNumber: o.orderNumber,
            rescueToken: o.rescueToken,
          })),
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        account?: ClientAccountPublicProfile;
        orders?: ClientCabinetOrderSummary[];
        legalProfiles?: StudioLegalProfilesConfig;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? 'Не удалось привязать заказы к почте');
      }

      const nextOrders = Array.isArray(json.orders) ? json.orders : orders;
      for (const ord of nextOrders) {
        upsertClientCabinetEntry({
          orderNumber: ord.orderNumber,
          rescueToken: ord.rescueToken,
          contactLine: ord.contact,
          companyLine: ord.companyOrInn,
        });
      }
      if (json.legalProfiles) {
        setLegalProfiles(json.legalProfiles);
      }
      setClientAccount(json.account ?? null);
      setOrders(nextOrders);
      setBindEmailInput('');
      setAuthBanner(`Профиль привязан к ${cleanEmail} — вход выполнен автоматически`);
    } catch (err) {
      setBindEmailError(
        err instanceof Error ? err.message : 'Ошибка привязки почты'
      );
    } finally {
      setIsBindingEmail(false);
    }
  };

  const handleLogoutClientSession = async () => {
    try {
      await fetch('/api/client-auth/logout', { method: 'POST' });
    } catch {
      // Локальная очистка выполняется в любом случае
    }
    const existingLocal = readClientCabinetEntries();
    for (const entry of existingLocal) {
      removeClientCabinetEntry(entry.orderNumber);
    }
    for (const ord of orders) {
      removeClientCabinetEntry(ord.orderNumber);
    }
    setClientAccount(null);
    setOrders([]);
    setCrossDeviceLink(null);
    setAuthBanner(null);
    setMagicDispatchResult(null);
    setAccessTab('magic_email');
    setShowLookupForm(true);
  };

  const executeOrderLookup = async (rawOrderNum: string, rawVerifier: string) => {
    const cleanOrder = rawOrderNum.trim().toUpperCase();
    const cleanVerifier = rawVerifier.trim();
    if (!cleanOrder || !cleanVerifier) {
      setLookupError('Укажите номер заказа (например, FM-2510) и телефон или ИНН');
      return;
    }

    setIsLookingUp(true);
    setLookupError(null);
    try {
      const res = await fetch('/api/client-cabinet/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: cleanOrder,
          verifier: cleanVerifier,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        order?: ClientCabinetOrderSummary;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.order) {
        throw new Error(
          json.error ?? 'Заказ не найден или проверочные данные не совпали'
        );
      }

      const foundOrder = json.order;
      upsertClientCabinetEntry({
        orderNumber: foundOrder.orderNumber,
        rescueToken: foundOrder.rescueToken,
        contactLine: foundOrder.contact,
        companyLine: foundOrder.companyOrInn,
      });

      setOrders((prev) => [
        foundOrder,
        ...prev.filter((o) => o.orderNumber !== foundOrder.orderNumber),
      ]);
      if (foundOrder.legalProfiles) {
        setLegalProfiles(foundOrder.legalProfiles);
      }
      setOrderNumberInput('');
      setVerifierInput('');
      setShowLookupForm(false);
    } catch (err) {
      setLookupError(
        err instanceof Error ? err.message : 'Не удалось подключить заказ'
      );
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleLookupSubmit = (e: FormEvent) => {
    e.preventDefault();
    void executeOrderLookup(orderNumberInput, verifierInput);
  };

  const handleDeliveryPreferencesUpdate = async (
    order: ClientCabinetOrderSummary,
    nextChannel: ClientDeliveryChannel,
    nextDetail?: string
  ) => {
    const isSameChannel = order.preferredDeliveryChannel === nextChannel;
    const isSameDetail =
      nextDetail === undefined ||
      (order.preferredDeliveryDetail ?? '') === nextDetail;
    if (isSameChannel && isSameDetail) return;

    if (nextChannel === 'email' && nextDetail !== undefined) {
      if (!validateDeliveryEmail(nextDetail)) {
        setStatusError('Укажите корректный e-mail для отправки готового ролика');
        return;
      }
    }

    setIsSavingPrefsFor(order.orderNumber);
    setStatusError(null);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(order.orderNumber)}/preferences`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rescueToken: order.rescueToken,
            preferredDeliveryChannel: nextChannel,
            ...(nextDetail !== undefined
              ? { preferredDeliveryDetail: nextDetail }
              : {}),
          }),
        }
      );
      const json = (await res.json()) as {
        ok?: boolean;
        order?: ClientCabinetOrderSummary;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.order) {
        throw new Error(json.error ?? 'Не удалось сохранить способ получения');
      }
      setOrders((prev) =>
        prev.map((o) =>
          o.orderNumber === json.order!.orderNumber ? json.order! : o
        )
      );
    } catch (err) {
      setStatusError(
        err instanceof Error ? err.message : 'Не удалось обновить канал выдачи'
      );
    } finally {
      setIsSavingPrefsFor(null);
    }
  };

  const openInnEditorForOrder = (order: ClientCabinetOrderSummary) => {
    const parsed = parseCompanyNameAndInn(order.companyOrInn || '');
    setEditingInnOrderNum(order.orderNumber);
    setInnCompanyNameDraft(parsed.companyName);
    setInnDigitsDraft(parsed.companyInn);
    setInnSaveError(null);
  };

  const handleSaveCompanyInnForOrder = async (order: ClientCabinetOrderSummary) => {
    const cleanName = innCompanyNameDraft.trim();
    const innInfo = inspectInnDigits(innDigitsDraft);
    if (cleanName.length < 2) {
      setInnSaveError('Укажите название компании или ИП (от 2 символов)');
      return;
    }
    if (!innInfo.isCompleteLength || !innInfo.checksumValid) {
      setInnSaveError(
        innInfo.statusMessage ??
          'Проверьте ИНН (10 цифр для организации или 12 цифр для ИП)'
      );
      return;
    }

    setIsSavingPrefsFor(order.orderNumber);
    setInnSaveError(null);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(order.orderNumber)}/preferences`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rescueToken: order.rescueToken,
            companyName: cleanName,
            companyInn: innInfo.digits,
          }),
        }
      );
      const json = (await res.json()) as {
        ok?: boolean;
        order?: ClientCabinetOrderSummary;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.order) {
        throw new Error(json.error ?? 'Не удалось сохранить реквизиты');
      }

      const updated = json.order;
      upsertClientCabinetEntry({
        orderNumber: updated.orderNumber,
        rescueToken: updated.rescueToken,
        contactLine: updated.contact,
        companyLine: updated.companyOrInn,
      });
      setOrders((prev) =>
        prev.map((o) => (o.orderNumber === updated.orderNumber ? updated : o))
      );
      setEditingInnOrderNum(null);
    } catch (err) {
      setInnSaveError(
        err instanceof Error ? err.message : 'Ошибка сохранения реквизитов'
      );
    } finally {
      setIsSavingPrefsFor(null);
    }
  };

  const handleClientFileSelected = async (
    order: ClientCabinetOrderSummary,
    file: File | null
  ) => {
    if (!file) return;
    if (file.size > 7 * 1024 * 1024) {
      setUploadFeedbackByOrder((prev) => ({
        ...prev,
        [order.orderNumber]: {
          kind: 'error',
          text: 'Файл слишком большой — выберите документ или аудио до 7 МБ',
        },
      }));
      return;
    }

    setUploadingOrderNum(order.orderNumber);
    setUploadFeedbackByOrder((prev) => {
      const next = { ...prev };
      delete next[order.orderNumber];
      return next;
    });

    try {
      const dataBase64 = await readFileAsBase64Payload(file);
      const note = (uploadNoteByOrder[order.orderNumber] ?? '').trim();
      const res = await fetch(
        `/api/orders/${encodeURIComponent(order.orderNumber)}/client-upload`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rescueToken: order.rescueToken,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            dataBase64,
            note,
          }),
        }
      );
      const json = (await res.json()) as {
        ok?: boolean;
        order?: ClientCabinetOrderSummary;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.order) {
        throw new Error(json.error ?? 'Не удалось загрузить файл к заказу');
      }

      setOrders((prev) =>
        prev.map((o) =>
          o.orderNumber === json.order!.orderNumber ? json.order! : o
        )
      );
      setUploadNoteByOrder((prev) => ({ ...prev, [order.orderNumber]: '' }));
      setUploadFeedbackByOrder((prev) => ({
        ...prev,
        [order.orderNumber]: {
          kind: 'ok',
          text: `Файл «${file.name}» добавлен к заказу и виден продюсеру.`,
        },
      }));
    } catch (err) {
      setUploadFeedbackByOrder((prev) => ({
        ...prev,
        [order.orderNumber]: {
          kind: 'error',
          text:
            err instanceof Error ? err.message : 'Ошибка загрузки файла к заказу',
        },
      }));
    } finally {
      setUploadingOrderNum(null);
      const inputEl = fileInputRefs.current[order.orderNumber];
      if (inputEl) inputEl.value = '';
    }
  };

  const handleRepeatOrder = (order: ClientCabinetOrderSummary) => {
    orderDraftStore.prepareProductionOrder({
      briefHint: order.briefText,
      returnPath: '/cabinet',
    });
    const parsedCompany = parseCompanyNameAndInn(order.companyOrInn || '');
    const parsedDelivery = parseDeliveryDetailSelection(
      order.preferredDeliveryChannel,
      order.preferredDeliveryDetail
    );
    orderDraftStore.updateDraft({
      contactLine: order.contact,
      companyLine: order.companyOrInn,
      companyName: parsedCompany.companyName,
      companyInn: parsedCompany.companyInn,
      preferredDeliveryChannel: order.preferredDeliveryChannel,
      deliveryMessenger: parsedDelivery.messenger,
      deliveryMessengerOther: parsedDelivery.messengerOther,
      deliveryCloud: parsedDelivery.cloud,
      deliveryCloudOther: parsedDelivery.cloudOther,
      deliveryEmail: parsedDelivery.email,
      cabinetEmail: clientAccount?.email || order.clientEmail || '',
      wantsInvoiceNow: Boolean(parsedCompany.companyInn),
    });
    onNavigate({ kind: 'order' });
  };

  const handleForgetOrderFromDevice = (orderNumber: string) => {
    removeClientCabinetEntry(orderNumber);
    setOrders((prev) => {
      const next = prev.filter((o) => o.orderNumber !== orderNumber);
      if (next.length === 0) {
        setShowLookupForm(true);
      }
      return next;
    });
  };

  const innDraftInspection = useMemo(
    () => inspectInnDigits(innDigitsDraft),
    [innDigitsDraft]
  );

  return (
    <section
      data-testid="client-cabinet-page"
      aria-labelledby="cabinet-page-heading"
      className="py-10 sm:py-16 lg:py-20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 space-y-8 sm:space-y-10">
        {/* Верхняя строка навигации */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#111111]/10 dark:border-white/10">
          <button
            type="button"
            onClick={() => onNavigate({ kind: 'home' })}
            className="min-h-[42px] inline-flex items-center gap-2 text-sm font-medium text-[#111111]/68 dark:text-[#F4F3EF]/68 hover:text-[#111111] dark:hover:text-[#F4F3EF] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>На главную студию</span>
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            {orders.length > 0 && (
              <button
                type="button"
                data-testid="cabinet-toggle-lookup-btn"
                onClick={() => setShowLookupForm((prev) => !prev)}
                className="min-h-[40px] px-4 py-2 rounded-full border border-[#111111]/14 dark:border-white/14 bg-white dark:bg-[#141418] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] hover:border-[#FF4820] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 text-[#FF4820]" aria-hidden="true" />
                <span>Найти другой заказ</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void loadStoredOrders()}
              disabled={isLoading}
              aria-label="Обновить статусы заказов"
              className="min-h-[40px] px-3.5 py-2 rounded-full border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75 hover:border-[#FF4820] inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Обновить</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate({ kind: 'order' })}
              className="min-h-[40px] px-4 py-2 rounded-full bg-[#FF4820] hover:bg-[#E63D18] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              Новый заказ →
            </button>
          </div>
        </div>

        {/* Заголовок кабинета */}
        <div className="max-w-3xl space-y-2.5">
          <p className="text-sm font-medium text-[#FF4820]">
            Личный кабинет постоянного клиента
          </p>
          <h1
            id="cabinet-page-heading"
            className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.06] text-[#111111] dark:text-[#F4F3EF] editorial-balance"
          >
            Мои заказы и материалы
          </h1>
          <p className="text-sm sm:text-base text-[#111111]/68 dark:text-[#F4F3EF]/68 leading-relaxed">
            Отслеживайте этапы работы, выгружайте счёт на оплату, догружайте бриф и
            скачивайте готовые аудиоролики напрямую или через удобный диск.
          </p>
        </div>

        {statusError && (
          <div
            role="alert"
            data-testid="cabinet-status-error"
            className="rounded-2xl px-4 py-3 bg-[#DC2626]/10 border border-[#DC2626]/25 text-xs sm:text-sm text-[#DC2626] dark:text-[#F87171]"
          >
            {statusError}
          </div>
        )}

        {authBanner && (
          <div
            role="status"
            data-testid="cabinet-auth-banner"
            className="rounded-2xl px-4 py-3 bg-[#16A34A]/10 border border-[#16A34A]/25 text-xs sm:text-sm text-[#15803D] dark:text-[#4ADE80] flex items-center justify-between gap-3"
          >
            <span>{authBanner}</span>
            <button
              type="button"
              onClick={() => setAuthBanner(null)}
              className="text-xs font-semibold underline underline-offset-2 cursor-pointer shrink-0"
            >
              Скрыть
            </button>
          </div>
        )}

        {/* Строка активной сессии без пароля (почта + выход + перенос на другое устройство) */}
        {clientAccount && (
          <div
            data-testid="cabinet-authenticated-bar"
            className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 px-4 py-3.5 sm:px-6 space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-[#111111]/72 dark:text-[#F4F3EF]/72 tabular-nums">
                <span>Вход без пароля:</span>
                <strong
                  data-testid="cabinet-authenticated-email"
                  className="text-[#111111] dark:text-[#F4F3EF]"
                >
                  {clientAccount.email}
                </strong>
                <span aria-hidden="true">·</span>
                <span>Заказов в профиле: {orders.length}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isIssuingCrossDeviceLink}
                  data-testid="cabinet-cross-device-link-btn"
                  onClick={() => void handleIssueCrossDeviceMagicLink()}
                  className="min-h-[36px] px-3.5 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {isIssuingCrossDeviceLink
                      ? 'Создаём ссылку…'
                      : 'Ссылка для другого устройства'}
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="cabinet-logout-btn"
                  onClick={() => void handleLogoutClientSession()}
                  className="min-h-[36px] px-3.5 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#DC2626] hover:text-[#DC2626] text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Выйти</span>
                </button>
              </div>
            </div>

            {crossDeviceLink && (
              <div
                data-testid="cabinet-cross-device-link-panel"
                className="pt-2.5 border-t border-[#111111]/8 dark:border-white/8 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <p className="text-[#111111]/72 dark:text-[#F4F3EF]/72 break-all">
                  {crossDeviceLink.copied
                    ? 'Одноразовая ссылка скопирована в буфер обмена (действует 30 мин): '
                    : 'Одноразовая ссылка для телефона или другого ПК (действует 30 мин): '}
                  <code className="font-mono text-[#111111] dark:text-[#F4F3EF]">
                    {crossDeviceLink.magicLinkUrl}
                  </code>
                </p>
                <button
                  type="button"
                  onClick={() => setCrossDeviceLink(null)}
                  className="text-xs font-semibold text-[#111111]/58 dark:text-[#F4F3EF]/58 hover:text-[#111111] dark:hover:text-[#F4F3EF] cursor-pointer shrink-0 self-start sm:self-auto"
                >
                  Скрыть
                </button>
              </div>
            )}
          </div>
        )}

        {/* Тихая строка привязки почты, если заказы открыты локально без почты */}
        {!clientAccount && orders.length > 0 && (
          <form
            onSubmit={handleBindAnonymousOrdersToEmail}
            data-testid="cabinet-bind-email-card"
            className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="space-y-0.5 min-w-0">
              <label
                htmlFor="cabinet-bind-email-input"
                className="block text-xs sm:text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]"
              >
                Сохранить заказы на вашу почту (без пароля)
              </label>
              <p className="text-xs text-[#111111]/62 dark:text-[#F4F3EF]/62">
                Укажите почту один раз — вы сможете входить по magic-ссылке с телефона или рабочего ПК.
              </p>
              {bindEmailError && (
                <p role="alert" className="text-xs font-medium text-[#DC2626] dark:text-[#F87171]">
                  {bindEmailError}
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              <input
                id="cabinet-bind-email-input"
                data-testid="cabinet-bind-email-input"
                type="email"
                value={bindEmailInput}
                onChange={(e) => {
                  setBindEmailInput(e.target.value);
                  if (bindEmailError) setBindEmailError(null);
                }}
                placeholder="name@company.ru"
                className="min-h-[40px] sm:w-56 px-3.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/16 dark:border-white/16 text-xs sm:text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              />
              <button
                type="submit"
                disabled={isBindingEmail}
                data-testid="cabinet-bind-email-submit-btn"
                className="min-h-[40px] px-4 rounded-xl bg-[#111111] hover:bg-[#FF4820] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#FF4820] dark:hover:text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {isBindingEmail ? 'Привязываем…' : 'Привязать почту'}
              </button>
            </div>
          </form>
        )}

        {/* Форма входа по Magic-ссылке или поиска заказа по номеру */}
        {showLookupForm && (
          <section
            data-testid="cabinet-lookup-card"
            aria-label="Вход в кабинет и поиск заказа"
            className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 p-5 sm:p-7 space-y-5 shadow-xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div
                role="tablist"
                aria-label="Способ входа в личный кабинет"
                className="inline-flex flex-wrap sm:flex-nowrap items-center gap-1 p-1 rounded-xl bg-[#EFECE5] dark:bg-[#0D0D0F] border border-[#111111]/8 dark:border-white/8 self-start"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={accessTab === 'magic_email'}
                  data-testid="cabinet-tab-magic"
                  onClick={() => {
                    setAccessTab('magic_email');
                    setLookupError(null);
                  }}
                  className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    accessTab === 'magic_email'
                      ? 'bg-white text-[#111111] dark:bg-[#1C1C22] dark:text-[#F4F3EF] shadow-xs'
                      : 'text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                  }`}
                >
                  По почте (Magic-ссылка)
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={accessTab === 'order_number'}
                  data-testid="cabinet-tab-lookup"
                  onClick={() => {
                    setAccessTab('order_number');
                    setMagicRequestError(null);
                  }}
                  className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    accessTab === 'order_number'
                      ? 'bg-white text-[#111111] dark:bg-[#1C1C22] dark:text-[#F4F3EF] shadow-xs'
                      : 'text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                  }`}
                >
                  По номеру заказа
                </button>
              </div>

              {accessTab === 'magic_email' ? (
                <button
                  type="button"
                  data-testid="cabinet-demo-magic-btn"
                  disabled={isRequestingMagic || isVerifyingMagic}
                  onClick={() => {
                    setMagicEmailInput(DEMO_CLIENT_CABINET_EMAIL);
                    void executeRequestMagicLink(DEMO_CLIENT_CABINET_EMAIL);
                  }}
                  className="min-h-[38px] px-3.5 py-2 rounded-xl border border-[#FF4820]/35 bg-[#FF4820]/8 hover:bg-[#FF4820]/14 text-xs font-semibold text-[#FF4820] transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
                >
                  Демо-почта ({DEMO_CLIENT_CABINET_EMAIL})
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="cabinet-demo-order-btn"
                  disabled={isLookingUp}
                  onClick={() => void executeOrderLookup('FM-HOLD-2854', '7702070139')}
                  className="min-h-[38px] px-3.5 py-2 rounded-xl border border-[#FF4820]/35 bg-[#FF4820]/8 hover:bg-[#FF4820]/14 text-xs font-semibold text-[#FF4820] transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
                >
                  Открыть демо-заказ (FM-HOLD-2854)
                </button>
              )}
            </div>

            {accessTab === 'magic_email' ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-[#111111] dark:text-[#F4F3EF]">
                    Вход и восстановление доступа по почте без пароля
                  </h2>
                  <p className="text-xs sm:text-sm text-[#111111]/62 dark:text-[#F4F3EF]/62">
                    При оформлении заказа с почтой вы входите автоматически. На новом устройстве укажите ту же почту — мы сформируем одноразовую magic-ссылку со всеми вашими заказами и счетами.
                  </p>
                </div>

                <form
                  onSubmit={handleMagicLinkSubmit}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                >
                  <div className="sm:col-span-8 space-y-1.5">
                    <label
                      htmlFor="cabinet-magic-email-input"
                      className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
                    >
                      Рабочая или личная почта
                    </label>
                    <input
                      id="cabinet-magic-email-input"
                      data-testid="cabinet-magic-email-input"
                      type="email"
                      value={magicEmailInput}
                      onChange={(e) => {
                        setMagicEmailInput(e.target.value);
                        if (magicRequestError) setMagicRequestError(null);
                      }}
                      placeholder="name@company.ru"
                      className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/16 dark:border-white/16 text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <button
                      type="submit"
                      data-testid="cabinet-magic-submit-btn"
                      disabled={isRequestingMagic || isVerifyingMagic}
                      className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#111111] hover:bg-[#FF4820] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#FF4820] dark:hover:text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      <Mail className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>
                        {isRequestingMagic
                          ? 'Отправляем…'
                          : 'Получить magic-ссылку'}
                      </span>
                    </button>
                  </div>
                </form>

                {magicRequestError && (
                  <p
                    role="alert"
                    data-testid="cabinet-magic-error"
                    className="text-xs font-medium text-[#DC2626] dark:text-[#F87171]"
                  >
                    {magicRequestError}
                  </p>
                )}

                {magicDispatchResult && (
                  <div
                    data-testid="cabinet-magic-dispatch-panel"
                    className="rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 p-4 space-y-3"
                  >
                    {magicDispatchResult.deliveryMode === 'email_gateway' ? (
                      <p className="text-xs sm:text-sm text-[#111111] dark:text-[#F4F3EF]">
                        Одноразовая ссылка для входа отправлена на{' '}
                        <strong>{magicDispatchResult.email}</strong> (действует 30 минут). Перейдите по ней из письма.
                      </p>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <p className="text-xs sm:text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]">
                            Одноразовая ссылка готова для{' '}
                            <span>{magicDispatchResult.email}</span> (30 мин)
                          </p>
                          <p className="text-xs text-[#111111]/62 dark:text-[#F4F3EF]/62">
                            В режиме предпросмотра (без внешнего SMTP) ссылка доступна сразу для мгновенной проверки входа:
                          </p>
                        </div>

                        {magicDispatchResult.magicLinkPath && (
                          <button
                            type="button"
                            disabled={isVerifyingMagic}
                            data-testid="cabinet-preview-magic-open-btn"
                            onClick={() => void handleOpenPreviewMagicLink()}
                            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FF4820] hover:bg-[#E63D18] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                          >
                            {isVerifyingMagic
                              ? 'Входим…'
                              : 'Войти по magic-ссылке →'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-[#111111] dark:text-[#F4F3EF]">
                    Подключить отдельный заказ по номеру
                  </h2>
                  <p className="text-xs sm:text-sm text-[#111111]/62 dark:text-[#F4F3EF]/62">
                    Если заказ оформлялся без почты, введите его номер и последние 4 цифры телефона, @Telegram или ИНН.
                  </p>
                </div>

                <form
                  onSubmit={handleLookupSubmit}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                >
                  <div className="sm:col-span-4 space-y-1.5">
                    <label
                      htmlFor="cabinet-lookup-order-num"
                      className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
                    >
                      Номер заказа
                    </label>
                    <input
                      id="cabinet-lookup-order-num"
                      data-testid="cabinet-lookup-order-input"
                      type="text"
                      value={orderNumberInput}
                      onChange={(e) => setOrderNumberInput(e.target.value)}
                      placeholder="Например, FM-2510"
                      className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/16 dark:border-white/16 text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                    />
                  </div>

                  <div className="sm:col-span-5 space-y-1.5">
                    <label
                      htmlFor="cabinet-lookup-verifier"
                      className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
                    >
                      Телефон (последние 4 цифры), @Telegram или ИНН
                    </label>
                    <input
                      id="cabinet-lookup-verifier"
                      data-testid="cabinet-lookup-verifier-input"
                      type="text"
                      value={verifierInput}
                      onChange={(e) => setVerifierInput(e.target.value)}
                      placeholder="4510 или 7702070139"
                      className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/16 dark:border-white/16 text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <button
                      type="submit"
                      data-testid="cabinet-lookup-submit-btn"
                      disabled={isLookingUp}
                      className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#111111] hover:bg-[#FF4820] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#FF4820] dark:hover:text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{isLookingUp ? 'Поиск…' : 'Открыть заказ'}</span>
                    </button>
                  </div>
                </form>

                {lookupError && (
                  <p
                    role="alert"
                    className="text-xs font-medium text-[#DC2626] dark:text-[#F87171]"
                  >
                    {lookupError}
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {/* Список заказов клиента */}
        {isLoading && orders.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-8 text-center text-sm text-[#111111]/60 dark:text-[#F4F3EF]/60">
            Проверяем статусы и готовые файлы ваших заказов…
          </div>
        ) : orders.length === 0 ? (
          showLookupForm ? (
            <div
              data-testid="cabinet-empty-state"
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-[#EFECE5]/55 dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 px-5 py-4"
            >
              <p className="text-xs sm:text-sm text-[#111111]/72 dark:text-[#F4F3EF]/72">
                Ещё не оформляли заказ? Заявка создаётся за минуту — кабинет привяжется к вашей почте автоматически.
              </p>
              <button
                type="button"
                onClick={() => onNavigate({ kind: 'order' })}
                className="min-h-[40px] px-5 py-2 rounded-full bg-[#FF4820] hover:bg-[#E63D18] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
              >
                Оформить новый заказ →
              </button>
            </div>
          ) : (
            <div
              data-testid="cabinet-empty-state"
              className="rounded-2xl bg-[#EFECE5]/65 dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-8 sm:p-10 text-center space-y-4"
            >
              <p className="text-base font-semibold text-[#111111] dark:text-[#F4F3EF]">
                В личном кабинете пока нет сохранённых заказов
              </p>
              <p className="text-sm text-[#111111]/64 dark:text-[#F4F3EF]/64 max-w-lg mx-auto">
                Оформите новый заказ за минуту — он сразу появится здесь — или войдите по почте выше.
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate({ kind: 'order' })}
                  className="min-h-[44px] px-6 py-2.5 rounded-full bg-[#FF4820] hover:bg-[#E63D18] text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  Оформить новый заказ
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="space-y-6">
            {orders.map((order) => {
              const progress = mapCrmStageToClientProgress(order.stage);
              const isEditingInn = editingInnOrderNum === order.orderNumber;
              const isBusyPrefs = isSavingPrefsFor === order.orderNumber;
              const uploadFeedback = uploadFeedbackByOrder[order.orderNumber];

              return (
                <article
                  key={order.orderNumber}
                  data-testid={`cabinet-order-card-${order.orderNumber}`}
                  className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 p-5 sm:p-7 space-y-6 shadow-xs"
                >
                  {/* Шапка карточки заказа */}
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-5 border-b border-[#111111]/10 dark:border-white/10">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[#111111]/62 dark:text-[#F4F3EF]/62 tabular-nums">
                        <span className="font-bold text-[#111111] dark:text-[#F4F3EF]">
                          #{order.orderNumber}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-[#FF4820]">
                          {progress.badgeLabel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>от {formatShortDate(order.createdAt)}</span>
                      </div>

                      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                        {order.formatLabel}
                      </h2>

                      <p className="text-xs sm:text-sm text-[#111111]/68 dark:text-[#F4F3EF]/68">
                        Контакт: <strong>{order.contact}</strong>
                        {order.companyOrInn ? (
                          <>
                            {' '}
                            · Компания: <strong>{order.companyOrInn}</strong>
                          </>
                        ) : (
                          <> · Заявка оформлена без ИНН</>
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap lg:flex-col items-start lg:items-end justify-between gap-2 shrink-0">
                      <p className="text-2xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF] tabular-nums">
                        {order.totalBudgetRub > 0
                          ? formatRubCompact(order.totalBudgetRub)
                          : 'Договорная'}
                      </p>
                      <button
                        type="button"
                        data-testid={`cabinet-invoice-btn-${order.orderNumber}`}
                        onClick={() => setInvoiceModalOrder(order)}
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-[#111111] hover:bg-[#FF4820] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#FF4820] dark:hover:text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <FileSpreadsheet className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>Открыть / скачать счёт (A4)</span>
                      </button>
                    </div>
                  </div>

                  {/* 5-шаговая шкала прогресса заказа */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75">
                        {progress.summaryText}
                      </p>
                      <span className="text-xs font-semibold text-[#111111]/55 dark:text-[#F4F3EF]/55 tabular-nums">
                        Этап {progress.stepIndex + 1} из {progress.totalSteps}
                      </span>
                    </div>

                    <ol className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {progress.steps.map((step, idx) => (
                        <li
                          key={step.key}
                          className={`rounded-xl px-3 py-2.5 border text-xs transition-colors ${
                            step.done
                              ? 'bg-[#16A34A]/8 border-[#16A34A]/30 text-[#15803D] dark:text-[#4ADE80]'
                              : step.active
                                ? 'bg-[#FF4820]/10 border-[#FF4820]/45 text-[#111111] dark:text-[#F4F3EF] font-semibold'
                                : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] border-[#111111]/8 dark:border-white/8 text-[#111111]/50 dark:text-[#F4F3EF]/50'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            {step.done ? (
                              <CheckCircle2
                                className="w-3.5 h-3.5 shrink-0 text-[#16A34A] dark:text-[#4ADE80]"
                                aria-hidden="true"
                              />
                            ) : (
                              <span
                                className={`w-4 h-4 rounded-full text-[10px] font-bold inline-flex items-center justify-center shrink-0 ${
                                  step.active
                                    ? 'bg-[#FF4820] text-white'
                                    : 'bg-[#111111]/10 dark:bg-white/10'
                                }`}
                              >
                                {idx + 1}
                              </span>
                            )}
                            <span className="leading-tight">{step.label}</span>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Основная сетка: Готовые файлы + Диск слева, Канал/Реквизиты/Дозагрузка справа */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                    {/* Левая колонка: Готовые файлы и облачная папка */}
                    <div className="lg:col-span-7 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                          Готовые материалы и файлы ({order.deliverables.length})
                        </h3>
                        {order.cloudDiskUrl && (
                          <a
                            href={order.cloudDiskUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid={`cabinet-cloud-link-${order.orderNumber}`}
                            className="min-h-[34px] px-3 py-1.5 rounded-lg bg-[#FF4820]/10 hover:bg-[#FF4820]/18 text-xs font-semibold text-[#FF4820] inline-flex items-center gap-1.5 transition-colors"
                          >
                            <FolderOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>Открыть папку на диске</span>
                            <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                          </a>
                        )}
                      </div>

                      {order.deliverables.length === 0 ? (
                        <div className="rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/8 dark:border-white/8 p-4 text-xs text-[#111111]/64 dark:text-[#F4F3EF]/64 leading-relaxed">
                          Готовые файлы появятся здесь после записи и сведения, а также
                          придут выбранным способом:{' '}
                          <strong className="text-[#111111] dark:text-[#F4F3EF]">
                            {resolveDeliveryChannelLabel(
                              order.preferredDeliveryChannel,
                              order.preferredDeliveryDetail
                            )}
                          </strong>
                          .
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {order.deliverables.map((file) => {
                            const downloadHref = `/api/orders/${encodeURIComponent(
                              order.orderNumber
                            )}/deliverables/${encodeURIComponent(
                              file.id
                            )}?token=${encodeURIComponent(order.rescueToken)}`;
                            const previewHref = `${downloadHref}&preview=1`;
                            const isAudio =
                              file.mimeType.startsWith('audio/') ||
                              file.kind === 'audio_master';

                            return (
                              <div
                                key={file.id}
                                data-testid={`cabinet-deliverable-${file.id}`}
                                className="rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10 p-3.5 space-y-2.5"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2.5">
                                  <div className="flex items-start gap-2.5 flex-1 min-w-[200px]">
                                    <span className="w-8 h-8 rounded-lg bg-[#FF4820]/12 text-[#FF4820] inline-flex items-center justify-center shrink-0">
                                      {isAudio ? (
                                        <FileAudio className="w-4 h-4" aria-hidden="true" />
                                      ) : (
                                        <FileText className="w-4 h-4" aria-hidden="true" />
                                      )}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs sm:text-sm font-bold leading-snug text-[#111111] dark:text-[#F4F3EF] line-clamp-2 break-words">
                                        {file.title}
                                      </p>
                                      <p className="text-[11px] text-[#111111]/58 dark:text-[#F4F3EF]/58 break-all sm:break-normal mt-0.5">
                                        {DELIVERABLE_KIND_LABELS[file.kind] ?? 'Файл'} ·{' '}
                                        {file.fileName} ·{' '}
                                        {formatFileSizeReadable(file.sizeBytes)}
                                      </p>
                                    </div>
                                  </div>

                                  <a
                                    href={downloadHref}
                                    download={file.fileName}
                                    data-testid={`cabinet-download-deliverable-${file.id}`}
                                    className="min-h-[34px] px-3 py-1.5 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors shrink-0"
                                  >
                                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>Скачать</span>
                                  </a>
                                </div>

                                {isAudio && (
                                  <audio
                                    controls
                                    preload="none"
                                    src={previewHref}
                                    className="w-full h-9"
                                    aria-label={`Прослушать ${file.title}`}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Краткое описание задачи заказа */}
                      {order.briefText && (
                        <div className="pt-2 space-y-1">
                          <p className="text-xs font-semibold text-[#111111]/60 dark:text-[#F4F3EF]/60">
                            Текст задачи по заказу
                          </p>
                          <p className="text-xs sm:text-sm text-[#111111]/82 dark:text-[#F4F3EF]/82 leading-relaxed">
                            {order.briefText}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Правая колонка: Способ выдачи + Реквизиты для счёта + Дозагрузка материалов */}
                    <div className="lg:col-span-5 space-y-5 lg:border-l lg:border-[#111111]/10 lg:dark:border-white/10 lg:pl-6">
                      {/* Выбор канала получения готового ролика */}
                      <div className="space-y-2.5">
                        <p className="text-xs font-semibold text-[#111111] dark:text-[#F4F3EF]">
                          Куда отправить готовый ролик
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {CLIENT_DELIVERY_CHANNEL_OPTIONS.map((opt) => {
                            const selected = order.preferredDeliveryChannel === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                disabled={isBusyPrefs}
                                data-testid={`cabinet-delivery-${order.orderNumber}-${opt.id}`}
                                onClick={() => {
                                  if (opt.id === 'email') {
                                    const currentDraft =
                                      deliveryDraftByOrder[order.orderNumber] ??
                                      (order.preferredDeliveryChannel === 'email'
                                        ? order.preferredDeliveryDetail ?? ''
                                        : '');
                                    const fallbackEmail =
                                      currentDraft ||
                                      order.contact.match(
                                        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
                                      )?.[0] ||
                                      '';
                                    setDeliveryDraftByOrder((prev) => ({
                                      ...prev,
                                      [order.orderNumber]: fallbackEmail,
                                    }));
                                    if (validateDeliveryEmail(fallbackEmail)) {
                                      void handleDeliveryPreferencesUpdate(
                                        order,
                                        'email',
                                        fallbackEmail
                                      );
                                    } else {
                                      void handleDeliveryPreferencesUpdate(
                                        order,
                                        'email',
                                        ''
                                      );
                                    }
                                    return;
                                  }
                                  const nextDefaultDetail =
                                    opt.id === 'messenger'
                                      ? 'Telegram'
                                      : opt.id === 'cloud'
                                        ? 'Яндекс Диск'
                                        : '';
                                  void handleDeliveryPreferencesUpdate(
                                    order,
                                    opt.id,
                                    nextDefaultDetail
                                  );
                                }}
                                aria-pressed={selected}
                                className={`min-h-[38px] px-2.5 py-1.5 rounded-lg border text-xs font-medium text-left transition-colors cursor-pointer inline-flex items-center justify-between gap-1 ${
                                  selected
                                    ? 'bg-[#111111] text-white border-[#111111] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:border-[#F4F3EF]'
                                    : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111]/78 dark:text-[#F4F3EF]/78 border-[#111111]/12 dark:border-white/12 hover:border-[#FF4820]/50'
                                }`}
                              >
                                <span className="leading-tight">{opt.shortLabel}</span>
                                {selected && (
                                  <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {(() => {
                          const parsedSel = parseDeliveryDetailSelection(
                            order.preferredDeliveryChannel,
                            order.preferredDeliveryDetail
                          );
                          if (order.preferredDeliveryChannel === 'messenger') {
                            return (
                              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                {DELIVERY_MESSENGER_OPTIONS.filter((m) => m.id !== 'other').map(
                                  (m) => {
                                    const active = parsedSel.messenger === m.id;
                                    return (
                                      <button
                                        key={m.id}
                                        type="button"
                                        disabled={isBusyPrefs}
                                        data-testid={`cabinet-messenger-${order.orderNumber}-${m.id}`}
                                        onClick={() =>
                                          void handleDeliveryPreferencesUpdate(
                                            order,
                                            'messenger',
                                            m.label
                                          )
                                        }
                                        className={`min-h-[28px] px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer ${
                                          active
                                            ? 'bg-[#FF4820] text-white border-[#FF4820]'
                                            : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111]/75 dark:text-[#F4F3EF]/75 border-[#111111]/12 dark:border-white/12 hover:border-[#FF4820]'
                                        }`}
                                      >
                                        {m.label}
                                      </button>
                                    );
                                  }
                                )}
                                {parsedSel.messenger === 'other' && parsedSel.messengerOther && (
                                  <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#FF4820]/12 text-[#FF4820]">
                                    {parsedSel.messengerOther}
                                  </span>
                                )}
                              </div>
                            );
                          }
                          if (order.preferredDeliveryChannel === 'cloud') {
                            return (
                              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                {DELIVERY_CLOUD_OPTIONS.filter((c) => c.id !== 'other').map(
                                  (c) => {
                                    const active = parsedSel.cloud === c.id;
                                    return (
                                      <button
                                        key={c.id}
                                        type="button"
                                        disabled={isBusyPrefs}
                                        data-testid={`cabinet-cloud-${order.orderNumber}-${c.id}`}
                                        onClick={() =>
                                          void handleDeliveryPreferencesUpdate(
                                            order,
                                            'cloud',
                                            c.label
                                          )
                                        }
                                        className={`min-h-[28px] px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer ${
                                          active
                                            ? 'bg-[#FF4820] text-white border-[#FF4820]'
                                            : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111]/75 dark:text-[#F4F3EF]/75 border-[#111111]/12 dark:border-white/12 hover:border-[#FF4820]'
                                        }`}
                                      >
                                        {c.label}
                                      </button>
                                    );
                                  }
                                )}
                                {parsedSel.cloud === 'other' && parsedSel.cloudOther && (
                                  <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#FF4820]/12 text-[#FF4820]">
                                    {parsedSel.cloudOther}
                                  </span>
                                )}
                              </div>
                            );
                          }
                          if (order.preferredDeliveryChannel === 'email') {
                            const emailVal =
                              deliveryDraftByOrder[order.orderNumber] ??
                              order.preferredDeliveryDetail ??
                              '';
                            return (
                              <div className="flex items-center gap-1.5 pt-0.5">
                                <input
                                  type="email"
                                  aria-label="Почта для получения ролика"
                                  data-testid={`cabinet-email-input-${order.orderNumber}`}
                                  value={emailVal}
                                  onChange={(e) =>
                                    setDeliveryDraftByOrder((prev) => ({
                                      ...prev,
                                      [order.orderNumber]: e.target.value,
                                    }))
                                  }
                                  placeholder="name@company.ru"
                                  className="flex-1 min-w-0 min-h-[34px] px-2.5 rounded-lg bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs"
                                />
                                <button
                                  type="button"
                                  disabled={isBusyPrefs}
                                  data-testid={`cabinet-email-save-${order.orderNumber}`}
                                  onClick={() =>
                                    void handleDeliveryPreferencesUpdate(
                                      order,
                                      'email',
                                      emailVal
                                    )
                                  }
                                  className="min-h-[34px] px-3 rounded-lg bg-[#FF4820] hover:bg-[#E63D18] text-white text-xs font-semibold transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                                >
                                  ОК
                                </button>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      {/* Реквизиты организации для счёта */}
                      <div className="space-y-2 pt-3 border-t border-[#111111]/8 dark:border-white/8">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-[#111111] dark:text-[#F4F3EF]">
                            Реквизиты для счёта и акта
                          </p>
                          <button
                            type="button"
                            data-testid={`cabinet-edit-inn-btn-${order.orderNumber}`}
                            onClick={() =>
                              isEditingInn
                                ? setEditingInnOrderNum(null)
                                : openInnEditorForOrder(order)
                            }
                            className="text-xs font-semibold text-[#FF4820] hover:underline cursor-pointer"
                          >
                            {isEditingInn
                              ? 'Отмена'
                              : order.companyOrInn
                                ? 'Изменить ИНН'
                                : '+ Добавить ИНН'}
                          </button>
                        </div>

                        {!isEditingInn ? (
                          <p className="text-xs text-[#111111]/68 dark:text-[#F4F3EF]/68">
                            {order.companyOrInn
                              ? order.companyOrInn
                              : 'ИНН пока не указан — добавьте его здесь, если потребуется выставить счёт на юрлицо или ИП.'}
                          </p>
                        ) : (
                          <div className="space-y-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 p-3">
                            <input
                              type="text"
                              aria-label="Название компании или ИП"
                              value={innCompanyNameDraft}
                              onChange={(e) => setInnCompanyNameDraft(e.target.value)}
                              placeholder="ООО «Компания» или ИП"
                              className="w-full min-h-[38px] px-3 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/14 dark:border-white/14 text-xs"
                            />
                            <input
                              type="text"
                              inputMode="numeric"
                              aria-label="ИНН организации или ИП"
                              value={innDigitsDraft}
                              onChange={(e) =>
                                setInnDigitsDraft(normalizeInnDigits(e.target.value))
                              }
                              placeholder="ИНН (10 или 12 цифр)"
                              className="w-full min-h-[38px] px-3 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/14 dark:border-white/14 text-xs tabular-nums"
                            />
                            {innDraftInspection.statusMessage && (
                              <p
                                className={`text-[11px] ${
                                  innDraftInspection.checksumValid
                                    ? 'text-[#16A34A] dark:text-[#4ADE80]'
                                    : 'text-[#111111]/60 dark:text-[#F4F3EF]/60'
                                }`}
                              >
                                {innDraftInspection.statusMessage}
                              </p>
                            )}
                            {innSaveError && (
                              <p className="text-[11px] font-medium text-[#DC2626] dark:text-[#F87171]">
                                {innSaveError}
                              </p>
                            )}
                            <button
                              type="button"
                              disabled={isBusyPrefs}
                              data-testid={`cabinet-save-inn-btn-${order.orderNumber}`}
                              onClick={() => void handleSaveCompanyInnForOrder(order)}
                              className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-[#FF4820] hover:bg-[#E63D18] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {isBusyPrefs
                                ? 'Сохранение…'
                                : 'Сохранить реквизиты и обновить счёт'}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Загрузка дополнительных материалов к заказу */}
                      <div className="space-y-2.5 pt-3 border-t border-[#111111]/8 dark:border-white/8">
                        <p className="text-xs font-semibold text-[#111111] dark:text-[#F4F3EF]">
                          Передать материалы к заказу (текст, логотип, референс)
                        </p>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            aria-label="Комментарий к файлу"
                            value={uploadNoteByOrder[order.orderNumber] ?? ''}
                            onChange={(e) =>
                              setUploadNoteByOrder((prev) => ({
                                ...prev,
                                [order.orderNumber]: e.target.value,
                              }))
                            }
                            placeholder="Комментарий (необязательно)"
                            className="flex-1 min-h-[38px] px-3 rounded-lg bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-xs"
                          />
                          <input
                            ref={(el) => {
                              fileInputRefs.current[order.orderNumber] = el;
                            }}
                            type="file"
                            data-testid={`cabinet-file-input-${order.orderNumber}`}
                            aria-label={`Загрузить файл к заказу ${order.orderNumber}`}
                            onChange={(e) =>
                              void handleClientFileSelected(
                                order,
                                e.target.files?.[0] ?? null
                              )
                            }
                            className="sr-only"
                          />
                          <button
                            type="button"
                            disabled={uploadingOrderNum === order.orderNumber}
                            data-testid={`cabinet-upload-btn-${order.orderNumber}`}
                            onClick={() =>
                              fileInputRefs.current[order.orderNumber]?.click()
                            }
                            className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                          >
                            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>
                              {uploadingOrderNum === order.orderNumber
                                ? 'Загрузка…'
                                : 'Загрузить файл'}
                            </span>
                          </button>
                        </div>

                        {uploadFeedback && (
                          <p
                            className={`text-[11px] font-medium ${
                              uploadFeedback.kind === 'ok'
                                ? 'text-[#16A34A] dark:text-[#4ADE80]'
                                : 'text-[#DC2626] dark:text-[#F87171]'
                            }`}
                          >
                            {uploadFeedback.text}
                          </p>
                        )}

                        {order.clientUploads.length > 0 && (
                          <ul className="space-y-1.5 pt-1">
                            {order.clientUploads.map((up) => (
                              <li
                                key={up.id}
                                className="flex items-center justify-between gap-2 text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72 bg-[#F7F6F2] dark:bg-[#0D0D0F] px-2.5 py-1.5 rounded-lg"
                              >
                                <span className="truncate">
                                  {up.fileName}
                                  {up.note ? ` · ${up.note}` : ''}
                                </span>
                                <span className="text-[11px] text-[#111111]/50 dark:text-[#F4F3EF]/50 shrink-0">
                                  {formatFileSizeReadable(up.sizeBytes)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Действия с заказом */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#111111]/8 dark:border-white/8">
                        <button
                          type="button"
                          data-testid={`cabinet-repeat-btn-${order.orderNumber}`}
                          onClick={() => handleRepeatOrder(order)}
                          className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-[#FF4820]/10 hover:bg-[#FF4820]/18 text-xs font-semibold text-[#FF4820] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Повторить заказ с этими данными</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleForgetOrderFromDevice(order.orderNumber)
                          }
                          aria-label={`Убрать заказ ${order.orderNumber} из этого браузера`}
                          className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs text-[#111111]/48 dark:text-[#F4F3EF]/48 hover:text-[#DC2626] inline-flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Скрыть с устройства</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Сноска о безопасности */}
        <p className="text-xs text-[#111111]/52 dark:text-[#F4F3EF]/52 inline-flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>
            Доступ к файлам и счетам защищён персональным ключом заказа — чужие
            заказы недоступны посторонним.
          </span>
        </p>
      </div>

      {invoiceModalOrder && (
        <BrandedDocumentSuiteModal
          isOpen
          onClose={() => setInvoiceModalOrder(null)}
          mode="client"
          initialDoc="invoice"
          legalProfiles={invoiceModalOrder.legalProfiles ?? legalProfiles}
          order={{
            orderNumber: invoiceModalOrder.orderNumber,
            createdAtIso: invoiceModalOrder.createdAt,
            formatLabel: invoiceModalOrder.formatLabel,
            baseBudgetRub: invoiceModalOrder.totalBudgetRub,
            contact: invoiceModalOrder.contact,
            companyOrInn: invoiceModalOrder.companyOrInn,
            briefText: invoiceModalOrder.briefText,
            documentMeta: invoiceModalOrder.documentMeta,
          }}
        />
      )}
    </section>
  );
}
