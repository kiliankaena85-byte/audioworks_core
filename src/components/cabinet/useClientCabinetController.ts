import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type ClientAccountPublicProfile,
  normalizeClientEmail,
} from '../../data/clientAuthShared';
import {
  buildCabinetRouteForAccessTab,
  buildCabinetRouteForWorkspaceFilter,
  type CabinetAccessTabId,
  type CabinetHistoryStatusFilter,
  type CabinetWorkspaceSectionFilter,
  deriveCabinetLifecycleState,
  extractMagicTokenFromCabinetHref,
  filterCabinetHistoryOrders,
  inferOrderRepeatParameters,
  mergeAuthenticatedAndDeviceOrders,
  partitionCabinetOrders,
  pickUnboundDeviceOrderTokens,
  resolveWorkspaceFilterFromRoute,
  sortActiveOrdersByClientTurn,
  summarizeCabinetHistoryArchive,
  summarizeCabinetHistoryStatuses,
} from '../../data/clientCabinetArchitecture';
import {
  type ClientCabinetOrderSummary,
  type ClientCabinetStoredEntry,
  type ClientDeliveryChannel,
  parseDeliveryDetailSelection,
  readClientCabinetEntries,
  removeClientCabinetEntry,
  upsertClientCabinetEntry,
  validateDeliveryEmail,
} from '../../data/clientCabinetHelpers';
import { resolveOfflineCounterpartyByInn } from '../../data/konturIntegrationCore';
import { orderDraftStore } from '../../data/orderDraftStore';
import type { CabinetSubrouteMode, PlatformRoute } from '../../data/platformRouter';
import type {
  BrandedDocumentKind,
  StudioLegalProfilesConfig,
} from '../../data/studioDocumentsCore';
import {
  inspectInnDigits,
  parseCompanyNameAndInn,
} from '../order/companyDetailsHelpers';
import {
  type ClientAvatarPresetId,
  resolveClientAvatarModel,
  sanitizeClientAvatarPresetId,
} from '../../data/clientAvatarLogic';
import { validateCabinetEmailConsent } from '../../security/legalDocumentBuilder';
import type { SpotRevisionKind } from '../../data/productionApprovalWorkflow';
import {
  bindClientEmailApi,
  deleteClientAvatarPhotoApi,
  fetchCabinetBatchStatusApi,
  fetchClientAuthSessionApi,
  lookupSingleCabinetOrderApi,
  logoutClientSessionApi,
  requestClientMagicLinkApi,
  submitClientScriptDecisionApi,
  submitClientSpotDecisionApi,
  updateCabinetOrderPreferencesApi,
  updateClientAvatarApi,
  uploadClientOrderAttachmentApi,
  verifyClientMagicLinkApi,
} from './clientCabinetApi';

export type CabinetNavigateFn = (
  route: PlatformRoute,
  options?: { replace?: boolean }
) => void;

export interface MagicLinkDispatchPreview {
  email: string;
  intent: 'login' | 'reset';
  revokeOtherSessions: boolean;
  isNewRegistration: boolean;
  deliveryMode: 'email_gateway' | 'local_preview';
  magicLinkPath?: string;
  magicLinkUrl?: string;
}

export interface PendingBindEmailVerification {
  email: string;
  deliveryMode: 'email_gateway' | 'local_preview';
  magicLinkPath?: string;
}

export interface AudioSeekRequest {
  timeSec: number;
  versionCode?: string;
  nonce: number;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = typeof reader.result === 'string' ? reader.result : '';
      resolve(res);
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать выбранный файл'));
    reader.readAsDataURL(file);
  });
}

function readFileAsBase64Payload(file: File): Promise<string> {
  return readFileAsDataUrl(file).then((res) => {
    const commaIdx = res.indexOf(',');
    return commaIdx >= 0 ? res.slice(commaIdx + 1) : res;
  });
}

const DEVICE_AVATAR_STORAGE_KEY = 'fmworks_cabinet_device_avatar_v1';

interface DeviceAvatarPreferences {
  presetId: ClientAvatarPresetId | null;
  photoDataUrl: string | null;
}

function readDeviceAvatarPreferences(): DeviceAvatarPreferences {
  if (typeof window === 'undefined') {
    return { presetId: null, photoDataUrl: null };
  }
  try {
    const raw = window.localStorage.getItem(DEVICE_AVATAR_STORAGE_KEY);
    if (!raw) return { presetId: null, photoDataUrl: null };
    const parsed = JSON.parse(raw) as {
      presetId?: unknown;
      photoDataUrl?: unknown;
    };
    return {
      presetId: sanitizeClientAvatarPresetId(parsed.presetId),
      photoDataUrl:
        typeof parsed.photoDataUrl === 'string' &&
        parsed.photoDataUrl.startsWith('data:image/')
          ? parsed.photoDataUrl
          : null,
    };
  } catch {
    return { presetId: null, photoDataUrl: null };
  }
}

function writeDeviceAvatarPreferences(prefs: DeviceAvatarPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    if (!prefs.presetId && !prefs.photoDataUrl) {
      window.localStorage.removeItem(DEVICE_AVATAR_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(DEVICE_AVATAR_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors
  }
}

const HISTORY_HIDE_OLDER_6M_KEY = 'fmworks_cabinet_hide_older_6m_v1';
const HISTORY_MANUAL_ARCHIVE_KEY = 'fmworks_cabinet_manual_archive_v1';

function readHideOlderThanSixMonthsPreference(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(HISTORY_HIDE_OLDER_6M_KEY);
    if (raw === '0' || raw === 'false') return false;
    if (raw === '1' || raw === 'true') return true;
    return true;
  } catch {
    return true;
  }
}

function writeHideOlderThanSixMonthsPreference(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HISTORY_HIDE_OLDER_6M_KEY, value ? '1' : '0');
  } catch {
    // Ignore storage quota errors
  }
}

function readManuallyArchivedOrderNumbers(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_MANUAL_ARCHIVE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0
    );
  } catch {
    return [];
  }
}

function writeManuallyArchivedOrderNumbers(orderNumbers: readonly string[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (orderNumbers.length === 0) {
      window.localStorage.removeItem(HISTORY_MANUAL_ARCHIVE_KEY);
      return;
    }
    window.localStorage.setItem(
      HISTORY_MANUAL_ARCHIVE_KEY,
      JSON.stringify(Array.from(new Set(orderNumbers)))
    );
  } catch {
    // Ignore storage quota errors
  }
}

export interface UseClientCabinetControllerParams {
  subroute?: CabinetSubrouteMode;
  magicToken?: string;
  onNavigate: CabinetNavigateFn;
}

export function useClientCabinetController({
  subroute,
  magicToken,
  onNavigate,
}: UseClientCabinetControllerParams) {
  const [orders, setOrders] = useState<ClientCabinetOrderSummary[]>([]);
  const [clientAccount, setClientAccount] =
    useState<ClientAccountPublicProfile | null>(null);
  const [legalProfiles, setLegalProfiles] =
    useState<StudioLegalProfilesConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [authBanner, setAuthBanner] = useState<string | null>(null);

  // Панель доступа: вход по почте / сброс доступа по magic-ссылке / поиск заказа по номеру
  const [showLookupForm, setShowLookupForm] = useState<boolean>(
    subroute === 'reset'
  );
  const [accessTab, setAccessTab] = useState<CabinetAccessTabId>(
    subroute === 'reset' ? 'access_reset' : 'magic_email'
  );
  const [magicEmailInput, setMagicEmailInput] = useState<string>('');
  const [magicConsentAccepted, setMagicConsentAccepted] = useState<boolean>(false);
  const [magicConsentError, setMagicConsentError] = useState<string | null>(null);
  const [revokeOtherSessionsOnReset, setRevokeOtherSessionsOnReset] =
    useState<boolean>(true);
  const [isRequestingMagic, setIsRequestingMagic] = useState<boolean>(false);
  const [magicRequestError, setMagicRequestError] = useState<string | null>(null);
  const [magicDispatchResult, setMagicDispatchResult] =
    useState<MagicLinkDispatchPreview | null>(null);
  const [isVerifyingMagic, setIsVerifyingMagic] = useState<boolean>(false);
  const consumedMagicTokenRef = useRef<string | null>(null);
  const loadSeqRef = useRef<number>(0);
  const onNavigateRef = useRef<CabinetNavigateFn>(onNavigate);
  onNavigateRef.current = onNavigate;
  const subrouteRef = useRef<CabinetSubrouteMode | undefined>(subroute);
  subrouteRef.current = subroute;

  // Одноразовая ссылка для переноса сессии на другое устройство
  const [crossDeviceLink, setCrossDeviceLink] = useState<{
    magicLinkUrl: string;
    magicLinkPath: string;
    copied: boolean;
  } | null>(null);
  const [isIssuingCrossDeviceLink, setIsIssuingCrossDeviceLink] =
    useState<boolean>(false);

  // Привязка анонимных заказов устройства к почте (с подтверждением владения почтой)
  const [bindEmailInput, setBindEmailInput] = useState<string>('');
  const [bindConsentAccepted, setBindConsentAccepted] = useState<boolean>(false);
  const [isBindingEmail, setIsBindingEmail] = useState<boolean>(false);
  const [bindEmailError, setBindEmailError] = useState<string | null>(null);
  const [bindConsentError, setBindConsentError] = useState<string | null>(null);
  const [pendingBindVerification, setPendingBindVerification] =
    useState<PendingBindEmailVerification | null>(null);

  // Поиск заказа по номеру + телефону / ИНН / @Telegram
  const [orderNumberInput, setOrderNumberInput] = useState<string>('');
  const [verifierInput, setVerifierInput] = useState<string>('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false);

  // Редактирование параметров выдачи и ИНН по заказам
  const [deliveryDraftByOrder, setDeliveryDraftByOrder] = useState<
    Record<string, string>
  >({});
  const [editingInnOrderNum, setEditingInnOrderNum] = useState<string | null>(null);
  const [innCompanyNameDraft, setInnCompanyNameDraft] = useState<string>('');
  const [innDigitsDraft, setInnDigitsDraft] = useState<string>('');
  const [innSaveError, setInnSaveError] = useState<string | null>(null);
  const [isLookingUpInn, setIsLookingUpInn] = useState<boolean>(false);
  const [isSavingPrefsFor, setIsSavingPrefsFor] = useState<string | null>(null);

  // Загрузка клиентского файла
  const [uploadNoteByOrder, setUploadNoteByOrder] = useState<Record<string, string>>({});
  const [uploadingOrderNum, setUploadingOrderNum] = useState<string | null>(null);
  const [uploadFeedbackByOrder, setUploadFeedbackByOrder] = useState<
    Record<string, { kind: 'ok' | 'error'; text: string }>
  >({});

  // Модальное окно пакета документов A4 (Счёт / Договор / Акт сдачи / Паспорт прав / КП)
  const [documentModalState, setDocumentModalState] = useState<{
    order: ClientCabinetOrderSummary;
    initialDoc: BrandedDocumentKind;
  } | null>(null);

  const openOrderDocumentModal = useCallback(
    (order: ClientCabinetOrderSummary, initialDoc: BrandedDocumentKind = 'invoice') => {
      setDocumentModalState({ order, initialDoc });
    },
    []
  );

  const setInvoiceModalOrder = useCallback(
    (order: ClientCabinetOrderSummary | null) => {
      setDocumentModalState(order ? { order, initialDoc: 'invoice' } : null);
    },
    []
  );

  // Безопасное скрытие заказа с устройства с возможностью отмены (Undo)
  const [forgottenDeviceOrderUndo, setForgottenDeviceOrderUndo] = useState<{
    order: ClientCabinetOrderSummary;
    entry: Pick<
      ClientCabinetStoredEntry,
      'orderNumber' | 'rescueToken' | 'contactLine' | 'companyLine'
    >;
  } | null>(null);

  // Синхронизация таймкода между студийным аудиоплеером и конвейером согласования
  const [activePlayerTimeByOrder, setActivePlayerTimeByOrder] = useState<
    Record<string, number>
  >({});
  const [audioSeekRequestByOrder, setAudioSeekRequestByOrder] = useState<
    Record<string, AudioSeekRequest>
  >({});
  const [highlightedVersionByOrder, setHighlightedVersionByOrder] = useState<
    Record<string, string>
  >({});

  const handleAudioPlayerTimeUpdate = useCallback(
    (orderNumber: string, timeSec: number) => {
      if (!Number.isFinite(timeSec) || timeSec < 0) return;
      const rounded = Math.round(timeSec * 10) / 10;
      setActivePlayerTimeByOrder((prev) => {
        if (prev[orderNumber] === rounded) return prev;
        return { ...prev, [orderNumber]: rounded };
      });
    },
    []
  );

  const handleRequestAudioSeek = useCallback(
    (orderNumber: string, timeSec: number, versionCode?: string) => {
      if (!Number.isFinite(timeSec) || timeSec < 0) return;
      setAudioSeekRequestByOrder((prev) => ({
        ...prev,
        [orderNumber]: {
          timeSec,
          versionCode,
          nonce: (prev[orderNumber]?.nonce ?? 0) + 1,
        },
      }));
    },
    []
  );

  const highlightOrderVersion = useCallback(
    (orderNumber: string, versionCode?: string) => {
      if (!versionCode) return;
      setHighlightedVersionByOrder((prev) => ({
        ...prev,
        [orderNumber]: versionCode,
      }));
    },
    []
  );

  // Отправка решений по конвейеру согласования сценария и готового ролика
  const [submittingApprovalOrderNum, setSubmittingApprovalOrderNum] =
    useState<string | null>(null);

  // Аватар профиля клиента
  const [isAvatarEditorOpen, setIsAvatarEditorOpen] = useState<boolean>(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState<boolean>(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [deviceAvatarPrefs, setDeviceAvatarPrefs] =
    useState<DeviceAvatarPreferences>(() => readDeviceAvatarPreferences());

  // Фильтрация рабочего пространства и поиск по разделу «История завершённых заказов»
  const [workspaceFilter, setWorkspaceFilter] =
    useState<CabinetWorkspaceSectionFilter>(() =>
      resolveWorkspaceFilterFromRoute(subroute)
    );
  const [historyStatusFilter, setHistoryStatusFilter] =
    useState<CabinetHistoryStatusFilter>('all');
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [historyOnlyWithMasters, setHistoryOnlyWithMasters] =
    useState<boolean>(false);
  const [historyHideOlderThanSixMonths, setHistoryHideOlderThanSixMonthsState] =
    useState<boolean>(() => readHideOlderThanSixMonthsPreference());
  const [historyShowArchivedOnly, setHistoryShowArchivedOnly] =
    useState<boolean>(false);
  const [manuallyArchivedOrderNumbers, setManuallyArchivedOrderNumbersState] =
    useState<string[]>(() => readManuallyArchivedOrderNumbers());

  const setHistoryHideOlderThanSixMonths = useCallback((nextValue: boolean) => {
    setHistoryHideOlderThanSixMonthsState(nextValue);
    writeHideOlderThanSixMonthsPreference(nextValue);
  }, []);

  const toggleManualArchiveOrder = useCallback((orderNumber: string) => {
    const cleanNum = orderNumber.trim();
    if (!cleanNum) return;
    setManuallyArchivedOrderNumbersState((prev) => {
      const next = prev.includes(cleanNum)
        ? prev.filter((item) => item !== cleanNum)
        : [...prev, cleanNum];
      writeManuallyArchivedOrderNumbers(next);
      return next;
    });
  }, []);

  // Синхронизация подмаршрутов `/cabinet/reset` и `/cabinet/history`
  useEffect(() => {
    if (subroute === 'reset') {
      setAccessTab('access_reset');
      setShowLookupForm(true);
      if (clientAccount?.email && !magicEmailInput) {
        setMagicEmailInput(clientAccount.email);
      }
      return;
    }
    if (subroute === 'history') {
      setWorkspaceFilter('history');
    } else {
      setWorkspaceFilter((prev) => (prev === 'history' ? 'all' : prev));
    }
  }, [subroute, clientAccount?.email, magicEmailInput]);

  const selectWorkspaceFilter = useCallback(
    (nextFilter: CabinetWorkspaceSectionFilter) => {
      setWorkspaceFilter(nextFilter);
      const targetRoute = buildCabinetRouteForWorkspaceFilter(nextFilter);
      const currentSubroute = subroute;
      const nextSubroute = targetRoute.subroute;
      if (currentSubroute !== nextSubroute) {
        onNavigate(targetRoute, { replace: true });
      }
    },
    [onNavigate, subroute]
  );

  const resetHistoryFilters = useCallback(() => {
    setHistoryStatusFilter('all');
    setHistorySearchQuery('');
    setHistoryOnlyWithMasters(false);
    setHistoryShowArchivedOnly(false);
    setHistoryHideOlderThanSixMonthsState(false);
    writeHideOlderThanSixMonthsPreference(false);
  }, []);

  const selectAccessTab = useCallback(
    (nextTab: CabinetAccessTabId) => {
      setAccessTab(nextTab);
      setMagicRequestError(null);
      setLookupError(null);
      if (nextTab === 'access_reset' && clientAccount?.email && !magicEmailInput) {
        setMagicEmailInput(clientAccount.email);
      }
      const targetRoute = buildCabinetRouteForAccessTab(nextTab);
      const currentIsReset = subroute === 'reset';
      const nextIsReset = targetRoute.subroute === 'reset';
      if (currentIsReset !== nextIsReset) {
        onNavigate(targetRoute, { replace: true });
      }
    },
    [clientAccount?.email, magicEmailInput, onNavigate, subroute]
  );

  const openAccessResetFlow = useCallback(() => {
    setShowLookupForm(true);
    setAccessTab('access_reset');
    setMagicRequestError(null);
    setMagicDispatchResult(null);
    if (clientAccount?.email) {
      setMagicEmailInput(clientAccount.email);
    }
    onNavigate({ kind: 'cabinet', subroute: 'reset' });
  }, [clientAccount?.email, onNavigate]);

  const verifyAndConsumeMagicToken = useCallback(
    async (rawToken: string, options?: { revokeOtherSessions?: boolean }) => {
      const cleanToken = rawToken.trim();
      if (!cleanToken) return { ok: false as const, error: null };
      setIsVerifyingMagic(true);
      setStatusError(null);
      setMagicRequestError(null);
      try {
        const stored = readClientCabinetEntries();
        const json = await verifyClientMagicLinkApi({
          token: cleanToken,
          revokeOtherSessions: options?.revokeOtherSessions,
          localItems: stored.map((entry) => ({
            orderNumber: entry.orderNumber,
            rescueToken: entry.rescueToken,
          })),
        });

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

        let nextAccount = json.account ?? null;
        if (
          nextAccount &&
          (deviceAvatarPrefs.photoDataUrl || deviceAvatarPrefs.presetId)
        ) {
          try {
            nextAccount = await updateClientAvatarApi({
              ...(deviceAvatarPrefs.photoDataUrl
                ? { dataBase64: deviceAvatarPrefs.photoDataUrl }
                : {}),
              ...(deviceAvatarPrefs.presetId
                ? { avatarPresetId: deviceAvatarPrefs.presetId }
                : {}),
            });
            const cleared = { presetId: null, photoDataUrl: null };
            setDeviceAvatarPrefs(cleared);
            writeDeviceAvatarPreferences(cleared);
          } catch {
            // Non-fatal avatar sync
          }
        }

        setClientAccount(nextAccount);
        setOrders(verifiedOrders);
        setMagicDispatchResult(null);
        setPendingBindVerification(null);
        setBindEmailInput('');
        setMagicEmailInput('');
        setCrossDeviceLink(null);
        setAuthBanner(
          json.sessionsReset
            ? `Доступ восстановлен для ${nextAccount?.email ?? 'профиля'} · Старые сессии на других устройствах завершены`
            : `Вход по защищённой ссылке выполнен (${nextAccount?.email ?? ''})`
        );
        setAccessTab('magic_email');
        setShowLookupForm(verifiedOrders.length === 0);
        return { ok: true as const, error: null };
      } catch (err) {
        const errMsg =
          err instanceof Error
            ? err.message
            : 'Не удалось выполнить вход по одноразовой ссылке';
        setStatusError(errMsg);
        setAccessTab(subrouteRef.current === 'reset' ? 'access_reset' : 'magic_email');
        setShowLookupForm(true);
        return { ok: false as const, error: errMsg };
      } finally {
        setIsVerifyingMagic(false);
      }
    },
    [deviceAvatarPrefs.photoDataUrl, deviceAvatarPrefs.presetId]
  );

  const loadStoredOrders = useCallback(
    async (incomingMagicToken?: string) => {
      const requestSeq = ++loadSeqRef.current;
      let magicFailedError: string | null = null;
      const candidateMagic = (incomingMagicToken ?? '').trim();

      if (candidateMagic && consumedMagicTokenRef.current !== candidateMagic) {
        consumedMagicTokenRef.current = candidateMagic;
        setIsLoading(true);
        const magicResult = await verifyAndConsumeMagicToken(candidateMagic);
        onNavigateRef.current({ kind: 'cabinet' }, { replace: true });
        if (magicResult.ok) {
          if (requestSeq === loadSeqRef.current) {
            setIsLoading(false);
          }
          return;
        }
        magicFailedError = magicResult.error;
      }

      setIsLoading(true);
      if (!magicFailedError) {
        setStatusError(null);
      }
      const stored = readClientCabinetEntries();

      try {
        const [sessionJson, batchJson] = await Promise.all([
          fetchClientAuthSessionApi(),
          fetchCabinetBatchStatusApi(
            stored.map((entry) => ({
              orderNumber: entry.orderNumber,
              rescueToken: entry.rescueToken,
            }))
          ),
        ]);

        if (requestSeq !== loadSeqRef.current) {
          return;
        }

        if (sessionJson?.legalProfiles) {
          setLegalProfiles(sessionJson.legalProfiles);
        } else if (batchJson?.legalProfiles) {
          setLegalProfiles(batchJson.legalProfiles);
        }

        const sessionOrders =
          sessionJson?.authenticated && Array.isArray(sessionJson.orders)
            ? sessionJson.orders
            : [];
        const deviceOrders = Array.isArray(batchJson?.orders)
          ? batchJson.orders
          : [];

        if (stored.length > 0 && batchJson?.ok) {
          const validDeviceNums = new Set(deviceOrders.map((o) => o.orderNumber));
          for (const entry of stored) {
            if (!validDeviceNums.has(entry.orderNumber)) {
              removeClientCabinetEntry(entry.orderNumber);
            }
          }
        }

        if (sessionJson?.authenticated && sessionJson.account) {
          const unboundDeviceItems = pickUnboundDeviceOrderTokens(
            deviceOrders,
            sessionJson.account.email
          );

          if (unboundDeviceItems.length > 0) {
            try {
              const bindJson = await bindClientEmailApi({
                email: sessionJson.account.email,
                items: unboundDeviceItems,
                pdnConsentAccepted: true,
              });
              if (requestSeq !== loadSeqRef.current) {
                return;
              }
              if (bindJson.ok && bindJson.authenticated && Array.isArray(bindJson.orders)) {
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
            } catch {
              // Продолжаем со стандартным объединением заказов сессии
            }
          }

          setClientAccount(sessionJson.account);
        } else {
          setClientAccount(null);
        }

        for (const ord of sessionOrders) {
          upsertClientCabinetEntry({
            orderNumber: ord.orderNumber,
            rescueToken: ord.rescueToken,
            contactLine: ord.contact,
            companyLine: ord.companyOrInn,
          });
        }

        const mergedOrders = mergeAuthenticatedAndDeviceOrders(
          sessionOrders,
          deviceOrders
        );
        setOrders(mergedOrders);
        if (mergedOrders.length === 0) {
          setShowLookupForm(true);
        }
      } catch (err) {
        if (requestSeq !== loadSeqRef.current) {
          return;
        }
        setStatusError(
          err instanceof Error
            ? err.message
            : 'Ошибка загрузки данных личного кабинета'
        );
      } finally {
        if (requestSeq === loadSeqRef.current) {
          setIsLoading(false);
        }
      }
    },
    [verifyAndConsumeMagicToken]
  );

  useEffect(() => {
    void loadStoredOrders(magicToken);
  }, [loadStoredOrders, magicToken]);

  const executeRequestMagicLink = useCallback(
    async (
      rawEmail: string,
      options?: {
        mode?: 'login' | 'reset';
        revokeOtherSessions?: boolean;
        consentAccepted?: boolean;
        skipConsentCheck?: boolean;
      }
    ) => {
      const cleanEmail = normalizeClientEmail(rawEmail);
      const effectiveConsent = options?.consentAccepted ?? magicConsentAccepted;
      if (!options?.skipConsentCheck) {
        const consentValidation = validateCabinetEmailConsent({
          email: rawEmail,
          consentAccepted: effectiveConsent,
        });
        if (!consentValidation.valid || !cleanEmail) {
          setMagicRequestError(consentValidation.emailError);
          setMagicConsentError(consentValidation.consentError);
          return;
        }
      } else if (!cleanEmail) {
        setMagicRequestError(
          'Укажите корректную почту (например, name@company.ru)'
        );
        return;
      }

      const effectiveMode =
        options?.mode ?? (accessTab === 'access_reset' ? 'reset' : 'login');
      const effectiveRevoke =
        typeof options?.revokeOtherSessions === 'boolean'
          ? options.revokeOtherSessions
          : effectiveMode === 'reset'
            ? revokeOtherSessionsOnReset
            : false;

      setIsRequestingMagic(true);
      setMagicRequestError(null);
      setMagicConsentError(null);
      setStatusError(null);
      setMagicDispatchResult(null);
      try {
        const result = await requestClientMagicLinkApi({
          email: cleanEmail,
          mode: effectiveMode,
          revokeOtherSessions: effectiveRevoke,
          pdnConsentAccepted: true,
        });
        setMagicDispatchResult({
          email: result.email,
          intent: result.intent,
          revokeOtherSessions: result.revokeOtherSessions,
          isNewRegistration: result.isNewRegistration,
          deliveryMode: result.deliveryMode,
          magicLinkPath: result.magicLinkPath,
          magicLinkUrl: result.magicLinkUrl,
        });
      } catch (err) {
        setMagicRequestError(
          err instanceof Error
            ? err.message
            : 'Не удалось сформировать одноразовую ссылку входа'
        );
      } finally {
        setIsRequestingMagic(false);
      }
    },
    [accessTab, magicConsentAccepted, revokeOtherSessionsOnReset]
  );

  const handleMagicLinkSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      void executeRequestMagicLink(magicEmailInput);
    },
    [executeRequestMagicLink, magicEmailInput]
  );

  const handleOpenPreviewMagicLink = useCallback(() => {
    const extracted = extractMagicTokenFromCabinetHref(
      magicDispatchResult?.magicLinkPath
    );
    if (!extracted.token) return;
    onNavigate(
      {
        kind: 'cabinet',
        ...(extracted.isResetPath ? { subroute: 'reset' as const } : {}),
        magicToken: extracted.token,
      },
      { replace: true }
    );
  }, [magicDispatchResult?.magicLinkPath, onNavigate]);

  const handleConfirmPendingBindMagicLink = useCallback(() => {
    const extracted = extractMagicTokenFromCabinetHref(
      pendingBindVerification?.magicLinkPath
    );
    if (!extracted.token) return;
    onNavigate(
      {
        kind: 'cabinet',
        magicToken: extracted.token,
      },
      { replace: true }
    );
  }, [onNavigate, pendingBindVerification?.magicLinkPath]);

  const handleIssueCrossDeviceMagicLink = useCallback(async () => {
    if (!clientAccount?.email || isIssuingCrossDeviceLink) return;
    setIsIssuingCrossDeviceLink(true);
    setStatusError(null);
    try {
      const json = await requestClientMagicLinkApi({
        email: clientAccount.email,
        mode: 'login',
        revokeOtherSessions: false,
        pdnConsentAccepted: true,
      });
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
  }, [clientAccount?.email, isIssuingCrossDeviceLink]);

  const handleBindAnonymousOrdersToEmail = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (isBindingEmail || orders.length === 0) return;
      const cleanEmail = normalizeClientEmail(bindEmailInput);
      const consentValidation = validateCabinetEmailConsent({
        email: bindEmailInput,
        consentAccepted: bindConsentAccepted,
      });
      if (!consentValidation.valid || !cleanEmail) {
        setBindEmailError(consentValidation.emailError);
        setBindConsentError(consentValidation.consentError);
        return;
      }

      setIsBindingEmail(true);
      setBindEmailError(null);
      setBindConsentError(null);
      setPendingBindVerification(null);
      try {
        const json = await bindClientEmailApi({
          email: cleanEmail,
          items: orders.map((o) => ({
            orderNumber: o.orderNumber,
            rescueToken: o.rescueToken,
          })),
          pdnConsentAccepted: true,
        });

        if (json.verificationRequired || !json.authenticated) {
          const deliveryMode = json.deliveryMode ?? 'email_gateway';
          setPendingBindVerification({
            email: json.email || cleanEmail,
            deliveryMode,
            magicLinkPath: json.magicLinkPath,
          });
          if (deliveryMode === 'email_gateway') {
            setAuthBanner(
              `На ${json.email || cleanEmail} отправлена одноразовая ссылка подтверждения (30 мин). Перейдите по ней, чтобы завершить привязку заказов.`
            );
          }
          return;
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
        let boundAccount = json.account ?? null;
        if (
          boundAccount &&
          (deviceAvatarPrefs.photoDataUrl || deviceAvatarPrefs.presetId)
        ) {
          try {
            boundAccount = await updateClientAvatarApi({
              ...(deviceAvatarPrefs.photoDataUrl
                ? { dataBase64: deviceAvatarPrefs.photoDataUrl }
                : {}),
              ...(deviceAvatarPrefs.presetId
                ? { avatarPresetId: deviceAvatarPrefs.presetId }
                : {}),
            });
            const cleared = { presetId: null, photoDataUrl: null };
            setDeviceAvatarPrefs(cleared);
            writeDeviceAvatarPreferences(cleared);
          } catch {
            // Non-fatal sync
          }
        }
        setClientAccount(boundAccount);
        setOrders(nextOrders);
        setBindEmailInput('');
        setBindConsentAccepted(false);
        setAuthBanner(
          `Заказы привязаны к подтверждённому профилю ${cleanEmail}`
        );
      } catch (err) {
        setBindEmailError(
          err instanceof Error ? err.message : 'Ошибка привязки почты'
        );
      } finally {
        setIsBindingEmail(false);
      }
    },
    [bindConsentAccepted, bindEmailInput, deviceAvatarPrefs, isBindingEmail, orders]
  );

  const handleLogoutClientSession = useCallback(async () => {
    try {
      await logoutClientSessionApi();
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
    setPendingBindVerification(null);
    setForgottenDeviceOrderUndo(null);
    setAuthBanner(null);
    setMagicDispatchResult(null);
    setMagicConsentAccepted(false);
    setMagicConsentError(null);
    setBindConsentAccepted(false);
    setBindConsentError(null);
    setAccessTab('magic_email');
    setShowLookupForm(true);
    if (subroute === 'reset') {
      onNavigate({ kind: 'cabinet' }, { replace: true });
    }
  }, [onNavigate, orders, subroute]);

  const executeOrderLookup = useCallback(
    async (rawOrderNum: string, rawVerifier: string) => {
      const cleanOrder = rawOrderNum.trim().toUpperCase();
      const cleanVerifier = rawVerifier.trim();
      if (!cleanOrder || !cleanVerifier) {
        setLookupError(
          'Укажите номер заказа (например, FM-2510) и телефон или ИНН'
        );
        return;
      }

      setIsLookingUp(true);
      setLookupError(null);
      try {
        const foundOrder = await lookupSingleCabinetOrderApi({
          orderNumber: cleanOrder,
          verifier: cleanVerifier,
        });
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
        if (subroute === 'reset') {
          onNavigate({ kind: 'cabinet' }, { replace: true });
        }
      } catch (err) {
        setLookupError(
          err instanceof Error ? err.message : 'Не удалось подключить заказ'
        );
      } finally {
        setIsLookingUp(false);
      }
    },
    [onNavigate, subroute]
  );

  const handleLookupSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      void executeOrderLookup(orderNumberInput, verifierInput);
    },
    [executeOrderLookup, orderNumberInput, verifierInput]
  );

  const handleDeliveryPreferencesUpdate = useCallback(
    async (
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
        const updated = await updateCabinetOrderPreferencesApi({
          orderNumber: order.orderNumber,
          rescueToken: order.rescueToken,
          preferredDeliveryChannel: nextChannel,
          ...(nextDetail !== undefined
            ? { preferredDeliveryDetail: nextDetail }
            : {}),
        });
        setOrders((prev) =>
          prev.map((o) => (o.orderNumber === updated.orderNumber ? updated : o))
        );
      } catch (err) {
        setStatusError(
          err instanceof Error ? err.message : 'Не удалось обновить канал выдачи'
        );
      } finally {
        setIsSavingPrefsFor(null);
      }
    },
    []
  );

  const openInnEditorForOrder = useCallback((order: ClientCabinetOrderSummary) => {
    const parsed = parseCompanyNameAndInn(order.companyOrInn || '');
    setEditingInnOrderNum(order.orderNumber);
    setInnCompanyNameDraft(parsed.companyName);
    setInnDigitsDraft(parsed.companyInn);
    setInnSaveError(null);
  }, []);

  const handleLookupCompanyByInn = useCallback(async () => {
    const innInfo = inspectInnDigits(innDigitsDraft);
    if (!innInfo.isCompleteLength || !innInfo.checksumValid) {
      setInnSaveError(
        innInfo.statusMessage ??
          'Введите корректный ИНН (10 цифр для юрлица или 12 цифр для ИП)'
      );
      return;
    }

    setIsLookingUpInn(true);
    setInnSaveError(null);
    try {
      const offline = resolveOfflineCounterpartyByInn(innInfo.digits);
      if (offline?.shortName) {
        setInnCompanyNameDraft(offline.shortName);
      }

      const resp = await fetch(
        `/api/public/counterparty-by-inn?inn=${encodeURIComponent(innInfo.digits)}`,
        { credentials: 'same-origin' }
      );
      if (resp.ok) {
        const data = (await resp.json().catch(() => null)) as {
          found?: boolean;
          counterparty?: { shortName?: string; fullName?: string } | null;
        } | null;
        const resolvedName =
          data?.counterparty?.shortName || data?.counterparty?.fullName || '';
        if (resolvedName) {
          setInnCompanyNameDraft(resolvedName);
          return;
        }
      }

      if (!offline?.shortName && !innCompanyNameDraft.trim()) {
        setInnSaveError(
          'Организация не найдена в справочнике — укажите наименование вручную'
        );
      }
    } catch {
      const offline = resolveOfflineCounterpartyByInn(innInfo.digits);
      if (offline?.shortName) {
        setInnCompanyNameDraft(offline.shortName);
      }
    } finally {
      setIsLookingUpInn(false);
    }
  }, [innCompanyNameDraft, innDigitsDraft]);

  const handleSaveCompanyInnForOrder = useCallback(
    async (order: ClientCabinetOrderSummary) => {
      let cleanName = innCompanyNameDraft.trim();
      const innInfo = inspectInnDigits(innDigitsDraft);
      if (!cleanName && innInfo.isCompleteLength && innInfo.checksumValid) {
        const offline = resolveOfflineCounterpartyByInn(innInfo.digits);
        if (offline?.shortName) {
          cleanName = offline.shortName.trim();
          setInnCompanyNameDraft(cleanName);
        }
      }

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
        const updated = await updateCabinetOrderPreferencesApi({
          orderNumber: order.orderNumber,
          rescueToken: order.rescueToken,
          companyName: cleanName,
          companyInn: innInfo.digits,
        });
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
    },
    [innCompanyNameDraft, innDigitsDraft]
  );

  const handleClientFileSelected = useCallback(
    async (order: ClientCabinetOrderSummary, file: File | null) => {
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
        const updated = await uploadClientOrderAttachmentApi({
          orderNumber: order.orderNumber,
          rescueToken: order.rescueToken,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          dataBase64,
          note,
        });
        setOrders((prev) =>
          prev.map((o) => (o.orderNumber === updated.orderNumber ? updated : o))
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
      }
    },
    [uploadNoteByOrder]
  );

  const handleRepeatOrder = useCallback(
    (order: ClientCabinetOrderSummary) => {
      const repeatParams = inferOrderRepeatParameters(order);
      orderDraftStore.prepareProductionOrder({
        formatId: repeatParams.formatId,
        spotDurationSec: repeatParams.spotDurationSec,
        briefHint: order.briefText,
        returnPath: '/cabinet',
      });
      const parsedCompany = parseCompanyNameAndInn(order.companyOrInn || '');
      const parsedDelivery = parseDeliveryDetailSelection(
        order.preferredDeliveryChannel,
        order.preferredDeliveryDetail
      );
      orderDraftStore.updateDraft({
        selectedFormat: repeatParams.formatId,
        isFormatPreselected: true,
        spotDurationSec: repeatParams.spotDurationSec,
        briefText: order.briefText || '',
        contactLine: order.contact,
        companyLine: order.companyOrInn,
        companyName: parsedCompany.companyName,
        companyInn: parsedCompany.companyInn,
        resolvedCounterpartyMeta: order.documentMeta ?? null,
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
    },
    [clientAccount?.email, onNavigate]
  );

  const handleForgetOrderFromDevice = useCallback(
    (orderNumber: string) => {
      const targetOrder = orders.find((o) => o.orderNumber === orderNumber);
      if (targetOrder) {
        setForgottenDeviceOrderUndo({
          order: targetOrder,
          entry: {
            orderNumber: targetOrder.orderNumber,
            rescueToken: targetOrder.rescueToken,
            contactLine: targetOrder.contact,
            companyLine: targetOrder.companyOrInn,
          },
        });
      }
      removeClientCabinetEntry(orderNumber);
      setOrders((prev) => {
        const next = prev.filter((o) => o.orderNumber !== orderNumber);
        if (next.length === 0) {
          setShowLookupForm(true);
        }
        return next;
      });
    },
    [orders]
  );

  const handleUndoForgetOrderFromDevice = useCallback(() => {
    if (!forgottenDeviceOrderUndo) return;
    const { order, entry } = forgottenDeviceOrderUndo;
    upsertClientCabinetEntry({
      orderNumber: entry.orderNumber,
      rescueToken: entry.rescueToken,
      contactLine: entry.contactLine,
      companyLine: entry.companyLine,
    });
    setOrders((prev) => [
      order,
      ...prev.filter((o) => o.orderNumber !== order.orderNumber),
    ]);
    setForgottenDeviceOrderUndo(null);
    setShowLookupForm(false);
  }, [forgottenDeviceOrderUndo]);

  const handleClientApproveScript = useCallback(
    async (order: ClientCabinetOrderSummary, conceptId?: string) => {
      setSubmittingApprovalOrderNum(order.orderNumber);
      setStatusError(null);
      try {
        const updated = await submitClientScriptDecisionApi({
          orderNumber: order.orderNumber,
          rescueToken: order.rescueToken,
          action: 'approve',
          conceptId,
        });
        setOrders((prev) =>
          prev.map((o) => (o.orderNumber === updated.orderNumber ? updated : o))
        );
        setAuthBanner(
          `Сценарий по заказу #${updated.orderNumber} утверждён — ролик передан в студийное производство.`
        );
      } catch (err) {
        setStatusError(
          err instanceof Error
            ? err.message
            : 'Не удалось утвердить сценарий в производство'
        );
      } finally {
        setSubmittingApprovalOrderNum(null);
      }
    },
    []
  );

  const handleClientRequestScriptChanges = useCallback(
    async (order: ClientCabinetOrderSummary, comment: string) => {
      setSubmittingApprovalOrderNum(order.orderNumber);
      setStatusError(null);
      try {
        const updated = await submitClientScriptDecisionApi({
          orderNumber: order.orderNumber,
          rescueToken: order.rescueToken,
          action: 'request_changes',
          comment,
        });
        setOrders((prev) =>
          prev.map((o) => (o.orderNumber === updated.orderNumber ? updated : o))
        );
        setAuthBanner(
          `Замечание к сценарию #${updated.orderNumber} отправлено продюсеру — готовим обновлённую версию.`
        );
      } catch (err) {
        setStatusError(
          err instanceof Error
            ? err.message
            : 'Не удалось отправить замечание к сценарию'
        );
      } finally {
        setSubmittingApprovalOrderNum(null);
      }
    },
    []
  );

  const handleClientAcceptSpot = useCallback(
    async (
      order: ClientCabinetOrderSummary,
      deliverableId?: string | null
    ) => {
      setSubmittingApprovalOrderNum(order.orderNumber);
      setStatusError(null);
      try {
        const { order: updated } = await submitClientSpotDecisionApi({
          orderNumber: order.orderNumber,
          rescueToken: order.rescueToken,
          action: 'accept',
          deliverableId: deliverableId ?? undefined,
        });
        setOrders((prev) =>
          prev.map((o) => (o.orderNumber === updated.orderNumber ? updated : o))
        );
        setAuthBanner(
          `Готовый ролик по заказу #${updated.orderNumber} официально принят. Мастер-файл WAV, акт сдачи-приёмки и паспорт прав доступны в карточке.`
        );
      } catch (err) {
        setStatusError(
          err instanceof Error ? err.message : 'Не удалось зафиксировать приёмку ролика'
        );
      } finally {
        setSubmittingApprovalOrderNum(null);
      }
    },
    []
  );

  const handleClientRequestSpotRevision = useCallback(
    async (
      order: ClientCabinetOrderSummary,
      params: {
        kind: SpotRevisionKind;
        timecodeSec: number | null;
        comment: string;
      }
    ) => {
      setSubmittingApprovalOrderNum(order.orderNumber);
      setStatusError(null);
      try {
        const { order: updated, routedTo } = await submitClientSpotDecisionApi({
          orderNumber: order.orderNumber,
          rescueToken: order.rescueToken,
          action: 'request_revision',
          kind: params.kind,
          timecodeSec: params.timecodeSec,
          comment: params.comment,
        });
        setOrders((prev) =>
          prev.map((o) => (o.orderNumber === updated.orderNumber ? updated : o))
        );
        setAuthBanner(
          routedTo === 'sound_engineer_included_round'
            ? `Поправка по заказу #${updated.orderNumber} принята в работу в рамках включённого сервисного раунда (без доплат и новых счетов).`
            : `Запрос по заказу #${updated.orderNumber} передан продюсеру для быстрого согласования.`
        );
      } catch (err) {
        setStatusError(
          err instanceof Error
            ? err.message
            : 'Не удалось отправить запрос на доводку ролика'
        );
      } finally {
        setSubmittingApprovalOrderNum(null);
      }
    },
    []
  );

  const handleSelectAvatarPreset = useCallback(
    async (presetId: ClientAvatarPresetId) => {
      setAvatarError(null);
      if (clientAccount) {
        setIsSavingAvatar(true);
        try {
          const updatedAccount = await updateClientAvatarApi({
            avatarPresetId: presetId,
            ...(clientAccount.avatarUrl ? { clearPhoto: true } : {}),
          });
          setClientAccount(updatedAccount);
        } catch (err) {
          setAvatarError(
            err instanceof Error
              ? err.message
              : 'Не удалось сменить стиль абстрактного аватара'
          );
        } finally {
          setIsSavingAvatar(false);
        }
        return;
      }

      const nextPrefs: DeviceAvatarPreferences = {
        presetId,
        photoDataUrl: null,
      };
      setDeviceAvatarPrefs(nextPrefs);
      writeDeviceAvatarPreferences(nextPrefs);
    },
    [clientAccount]
  );

  const handleUploadAvatarPhoto = useCallback(
    async (file: File) => {
      setAvatarError(null);
      if (!/^image\/(?:jpeg|png|webp|avif)$/i.test(file.type)) {
        setAvatarError('Выберите изображение в формате JPEG, PNG, WebP или AVIF');
        return;
      }
      if (file.size > 4 * 1024 * 1024) {
        setAvatarError('Размер фотографии не должен превышать 4 МБ');
        return;
      }

      setIsSavingAvatar(true);
      try {
        const dataUrl = await readFileAsDataUrl(file);
        if (clientAccount) {
          const updatedAccount = await updateClientAvatarApi({
            dataBase64: dataUrl,
          });
          setClientAccount(updatedAccount);
        } else {
          const nextPrefs: DeviceAvatarPreferences = {
            presetId: deviceAvatarPrefs.presetId,
            photoDataUrl: dataUrl,
          };
          setDeviceAvatarPrefs(nextPrefs);
          writeDeviceAvatarPreferences(nextPrefs);
        }
      } catch (err) {
        setAvatarError(
          err instanceof Error ? err.message : 'Не удалось загрузить фото профиля'
        );
      } finally {
        setIsSavingAvatar(false);
      }
    },
    [clientAccount, deviceAvatarPrefs.presetId]
  );

  const handleRemoveAvatarPhoto = useCallback(async () => {
    setAvatarError(null);
    if (clientAccount) {
      setIsSavingAvatar(true);
      try {
        const updatedAccount = await deleteClientAvatarPhotoApi();
        setClientAccount(updatedAccount);
      } catch (err) {
        setAvatarError(
          err instanceof Error ? err.message : 'Не удалось удалить фото профиля'
        );
      } finally {
        setIsSavingAvatar(false);
      }
      return;
    }

    const nextPrefs: DeviceAvatarPreferences = {
      presetId: deviceAvatarPrefs.presetId,
      photoDataUrl: null,
    };
    setDeviceAvatarPrefs(nextPrefs);
    writeDeviceAvatarPreferences(nextPrefs);
  }, [clientAccount, deviceAvatarPrefs.presetId]);

  const profileAvatar = useMemo(() => {
    const primaryOrder = orders[0];
    return resolveClientAvatarModel({
      displayName: clientAccount?.displayName || null,
      contactLine: primaryOrder?.contact || null,
      companyOrInn:
        clientAccount?.defaultCompanyOrInn || primaryOrder?.companyOrInn || null,
      email:
        clientAccount?.email ||
        bindEmailInput.trim() ||
        primaryOrder?.clientEmail ||
        null,
      avatarUrl: clientAccount?.avatarUrl ?? null,
      localPreviewDataUrl: clientAccount ? null : deviceAvatarPrefs.photoDataUrl,
      avatarPresetId: clientAccount
        ? clientAccount.avatarPresetId
        : deviceAvatarPrefs.presetId,
    });
  }, [bindEmailInput, clientAccount, deviceAvatarPrefs, orders]);

  const innDraftInspection = useMemo(
    () => inspectInnDigits(innDigitsDraft),
    [innDigitsDraft]
  );

  const lifecycleState = useMemo(
    () =>
      deriveCabinetLifecycleState({
        isLoading,
        isVerifyingMagic,
        hasAuthenticatedAccount: Boolean(clientAccount),
        ordersCount: orders.length,
      }),
    [clientAccount, isLoading, isVerifyingMagic, orders.length]
  );

  const partitionedOrders = useMemo(
    () => partitionCabinetOrders(orders),
    [orders]
  );

  const sortedActiveOrders = useMemo(
    () => sortActiveOrdersByClientTurn(partitionedOrders.activeOrders),
    [partitionedOrders.activeOrders]
  );

  const clientTurnActiveCount = useMemo(
    () =>
      sortedActiveOrders.filter(
        (o) => o.approvalWorkflow?.whoseTurnActor === 'client'
      ).length,
    [sortedActiveOrders]
  );

  // Каноническая сводка по всему кабинету (для верхней строки прогресса)
  const overallStatusSummary = useMemo(
    () => summarizeCabinetHistoryStatuses(orders),
    [orders]
  );

  // Каноническая сводка строго по завершённым проектам в «Истории заказов» (без дублирования активных)
  const historyStatusSummary = useMemo(
    () => summarizeCabinetHistoryStatuses(partitionedOrders.historyOrders),
    [partitionedOrders.historyOrders]
  );

  const historyArchiveSummary = useMemo(
    () =>
      summarizeCabinetHistoryArchive(partitionedOrders.historyOrders, {
        hideOlderThanSixMonths: historyHideOlderThanSixMonths,
        manuallyArchivedOrderNumbers,
      }),
    [
      historyHideOlderThanSixMonths,
      manuallyArchivedOrderNumbers,
      partitionedOrders.historyOrders,
    ]
  );

  const filteredHistoryOrders = useMemo(
    () =>
      filterCabinetHistoryOrders(partitionedOrders.historyOrders, {
        searchQuery: historySearchQuery,
        onlyWithMasters: historyOnlyWithMasters,
        statusFilter: historyStatusFilter,
        hideOlderThanSixMonths: historyHideOlderThanSixMonths,
        manuallyArchivedOrderNumbers,
        showArchivedOnly: historyShowArchivedOnly,
      }),
    [
      historyHideOlderThanSixMonths,
      historyOnlyWithMasters,
      historySearchQuery,
      historyShowArchivedOnly,
      historyStatusFilter,
      manuallyArchivedOrderNumbers,
      partitionedOrders.historyOrders,
    ]
  );

  return {
    lifecycleState,
    orders,
    activeOrders: sortedActiveOrders,
    clientTurnActiveCount,
    historyOrders: partitionedOrders.historyOrders,
    overallStatusSummary,
    historyStatusSummary,
    historyArchiveSummary,
    totalHistoryMastersCount: partitionedOrders.totalHistoryMastersCount,
    filteredHistoryOrders,
    workspaceFilter,
    selectWorkspaceFilter,
    historyStatusFilter,
    setHistoryStatusFilter,
    historySearchQuery,
    setHistorySearchQuery,
    historyOnlyWithMasters,
    setHistoryOnlyWithMasters,
    historyHideOlderThanSixMonths,
    setHistoryHideOlderThanSixMonths,
    historyShowArchivedOnly,
    setHistoryShowArchivedOnly,
    manuallyArchivedOrderNumbers,
    toggleManualArchiveOrder,
    resetHistoryFilters,
    clientAccount,
    profileAvatar,
    isAvatarEditorOpen,
    setIsAvatarEditorOpen,
    isSavingAvatar,
    avatarError,
    handleSelectAvatarPreset,
    handleUploadAvatarPhoto,
    handleRemoveAvatarPhoto,
    legalProfiles,
    isLoading,
    statusError,
    setStatusError,
    authBanner,
    setAuthBanner,
    showLookupForm,
    setShowLookupForm,
    accessTab,
    selectAccessTab,
    openAccessResetFlow,
    magicEmailInput,
    setMagicEmailInput,
    magicConsentAccepted,
    setMagicConsentAccepted,
    magicConsentError,
    setMagicConsentError,
    revokeOtherSessionsOnReset,
    setRevokeOtherSessionsOnReset,
    isRequestingMagic,
    magicRequestError,
    setMagicRequestError,
    magicDispatchResult,
    isVerifyingMagic,
    crossDeviceLink,
    setCrossDeviceLink,
    isIssuingCrossDeviceLink,
    bindEmailInput,
    setBindEmailInput,
    bindConsentAccepted,
    setBindConsentAccepted,
    isBindingEmail,
    bindEmailError,
    setBindEmailError,
    bindConsentError,
    setBindConsentError,
    pendingBindVerification,
    setPendingBindVerification,
    handleConfirmPendingBindMagicLink,
    orderNumberInput,
    setOrderNumberInput,
    verifierInput,
    setVerifierInput,
    lookupError,
    isLookingUp,
    deliveryDraftByOrder,
    setDeliveryDraftByOrder,
    editingInnOrderNum,
    setEditingInnOrderNum,
    innCompanyNameDraft,
    setInnCompanyNameDraft,
    innDigitsDraft,
    setInnDigitsDraft,
    innDraftInspection,
    innSaveError,
    isLookingUpInn,
    handleLookupCompanyByInn,
    isSavingPrefsFor,
    uploadNoteByOrder,
    setUploadNoteByOrder,
    uploadingOrderNum,
    uploadFeedbackByOrder,
    documentModalState,
    openOrderDocumentModal,
    closeOrderDocumentModal: () => setDocumentModalState(null),
    invoiceModalOrder: documentModalState?.order ?? null,
    setInvoiceModalOrder,
    forgottenDeviceOrderUndo,
    dismissForgottenOrderUndo: () => setForgottenDeviceOrderUndo(null),
    handleUndoForgetOrderFromDevice,
    activePlayerTimeByOrder,
    audioSeekRequestByOrder,
    highlightedVersionByOrder,
    handleAudioPlayerTimeUpdate,
    handleRequestAudioSeek,
    highlightOrderVersion,
    reloadCabinet: () => loadStoredOrders(),
    executeRequestMagicLink,
    handleMagicLinkSubmit,
    handleOpenPreviewMagicLink,
    handleIssueCrossDeviceMagicLink,
    handleBindAnonymousOrdersToEmail,
    handleLogoutClientSession,
    executeOrderLookup,
    handleLookupSubmit,
    handleDeliveryPreferencesUpdate,
    openInnEditorForOrder,
    handleSaveCompanyInnForOrder,
    handleClientFileSelected,
    handleRepeatOrder,
    handleForgetOrderFromDevice,
    submittingApprovalOrderNum,
    handleClientApproveScript,
    handleClientRequestScriptChanges,
    handleClientAcceptSpot,
    handleClientRequestSpotRevision,
  };
}
