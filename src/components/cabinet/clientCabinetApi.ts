import type {
  CabinetNotificationViewItem,
  ClientNotificationPreferences,
} from '../../data/cabinetPushNotifications';
import type { ClientAccountPublicProfile } from '../../data/clientAuthShared';
import type { GuestOrderReviewPayload } from '../../data/clientCabinetArchitecture';
import type {
  ClientCabinetOrderSummary,
  ClientDeliveryChannel,
} from '../../data/clientCabinetHelpers';
import type { SpotRevisionKind } from '../../data/productionApprovalWorkflow';
import type { StudioLegalProfilesConfig } from '../../data/studioDocumentsCore';

export interface LocalOrderTokenRef {
  orderNumber: string;
  rescueToken: string;
}

export interface ClientAuthSessionResponse {
  ok: boolean;
  authenticated: boolean;
  account: ClientAccountPublicProfile | null;
  orders: ClientCabinetOrderSummary[];
  legalProfiles?: StudioLegalProfilesConfig;
}

export interface RequestMagicLinkResponse {
  ok: boolean;
  email: string;
  intent: 'login' | 'reset';
  revokeOtherSessions: boolean;
  isNewRegistration: boolean;
  deliveryMode: 'email_gateway' | 'local_preview';
  magicLinkPath?: string;
  magicLinkUrl?: string;
  expiresAt?: string;
  error?: string;
}

export interface VerifyMagicLinkResponse {
  ok: boolean;
  authenticated?: boolean;
  sessionsReset?: boolean;
  account?: ClientAccountPublicProfile | null;
  orders?: ClientCabinetOrderSummary[];
  legalProfiles?: StudioLegalProfilesConfig;
  reason?: string;
  error?: string;
}

export interface BindEmailResponse {
  ok: boolean;
  authenticated?: boolean;
  verificationRequired?: boolean;
  email?: string;
  deliveryMode?: 'email_gateway' | 'local_preview';
  magicLinkPath?: string;
  magicLinkUrl?: string;
  expiresAt?: string;
  account?: ClientAccountPublicProfile;
  orders?: ClientCabinetOrderSummary[];
  legalProfiles?: StudioLegalProfilesConfig;
  error?: string;
}

export async function fetchClientAuthSessionApi(): Promise<ClientAuthSessionResponse | null> {
  const res = await fetch('/api/client-auth/session', {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  return (await res.json()) as ClientAuthSessionResponse;
}

export async function fetchCabinetBatchStatusApi(
  items: readonly LocalOrderTokenRef[]
): Promise<{
  ok: boolean;
  orders: ClientCabinetOrderSummary[];
  legalProfiles?: StudioLegalProfilesConfig;
} | null> {
  if (items.length === 0) return null;
  const res = await fetch('/api/client-cabinet/batch-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    ok?: boolean;
    orders?: ClientCabinetOrderSummary[];
    legalProfiles?: StudioLegalProfilesConfig;
  };
  return {
    ok: Boolean(json.ok),
    orders: Array.isArray(json.orders) ? json.orders : [],
    legalProfiles: json.legalProfiles,
  };
}

export async function requestClientMagicLinkApi(params: {
  email: string;
  mode: 'login' | 'reset';
  revokeOtherSessions?: boolean;
  pdnConsentAccepted?: boolean;
}): Promise<RequestMagicLinkResponse> {
  const res = await fetch('/api/client-auth/request-magic-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = (await res.json()) as Partial<RequestMagicLinkResponse>;
  if (!res.ok || !json.ok) {
    throw new Error(
      json.error ?? 'Не удалось отправить одноразовую magic-ссылку на почту'
    );
  }
  return {
    ok: true,
    email: json.email ?? params.email,
    intent: json.intent === 'reset' ? 'reset' : 'login',
    revokeOtherSessions: Boolean(json.revokeOtherSessions),
    isNewRegistration: Boolean(json.isNewRegistration),
    deliveryMode:
      json.deliveryMode === 'email_gateway' ? 'email_gateway' : 'local_preview',
    magicLinkPath: json.magicLinkPath,
    magicLinkUrl: json.magicLinkUrl,
    expiresAt: json.expiresAt,
  };
}

export async function verifyClientMagicLinkApi(params: {
  token: string;
  localItems: readonly LocalOrderTokenRef[];
  revokeOtherSessions?: boolean;
}): Promise<VerifyMagicLinkResponse> {
  const res = await fetch('/api/client-auth/verify-magic-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = (await res.json()) as VerifyMagicLinkResponse;
  if (!res.ok || !json.ok) {
    throw new Error(
      json.error ?? 'Ссылка для входа недействительна или уже была использована'
    );
  }
  return json;
}

export async function bindClientEmailApi(params: {
  email: string;
  items: readonly LocalOrderTokenRef[];
  pdnConsentAccepted?: boolean;
}): Promise<BindEmailResponse> {
  const res = await fetch('/api/client-auth/bind-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = (await res.json()) as BindEmailResponse;
  if (!res.ok || !json.ok) {
    throw new Error(json.error ?? 'Не удалось привязать заказы к электронной почте');
  }
  return json;
}

export async function logoutClientSessionApi(): Promise<void> {
  await fetch('/api/client-auth/logout', { method: 'POST' });
}

export async function updateClientAvatarApi(params: {
  dataBase64?: string;
  avatarPresetId?: string | null;
  clearPhoto?: boolean;
}): Promise<ClientAccountPublicProfile> {
  const res = await fetch('/api/client-auth/avatar', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = (await res.json()) as {
    ok?: boolean;
    account?: ClientAccountPublicProfile;
    error?: string;
  };
  if (!res.ok || !json.ok || !json.account) {
    throw new Error(json.error ?? 'Не удалось обновить аватар профиля');
  }
  return json.account;
}

export async function deleteClientAvatarPhotoApi(): Promise<ClientAccountPublicProfile> {
  const res = await fetch('/api/client-auth/avatar', {
    method: 'DELETE',
  });
  const json = (await res.json()) as {
    ok?: boolean;
    account?: ClientAccountPublicProfile;
    error?: string;
  };
  if (!res.ok || !json.ok || !json.account) {
    throw new Error(json.error ?? 'Не удалось удалить фото профиля');
  }
  return json.account;
}

export async function lookupSingleCabinetOrderApi(params: {
  orderNumber: string;
  verifier: string;
}): Promise<ClientCabinetOrderSummary> {
  const res = await fetch('/api/client-cabinet/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
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
  return json.order;
}

export async function updateCabinetOrderPreferencesApi(params: {
  orderNumber: string;
  rescueToken: string;
  preferredDeliveryChannel?: ClientDeliveryChannel;
  preferredDeliveryDetail?: string;
  companyName?: string;
  companyInn?: string;
}): Promise<ClientCabinetOrderSummary> {
  const { orderNumber, ...body } = params;
  const res = await fetch(
    `/api/orders/${encodeURIComponent(orderNumber)}/preferences`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  const json = (await res.json()) as {
    ok?: boolean;
    order?: ClientCabinetOrderSummary;
    error?: string;
  };
  if (!res.ok || !json.ok || !json.order) {
    throw new Error(json.error ?? 'Не удалось сохранить параметры заказа');
  }
  return json.order;
}

export interface CabinetNotificationsQueryResponse {
  ok: boolean;
  notifications: CabinetNotificationViewItem[];
  preferences: ClientNotificationPreferences;
  unreadCount: number;
}

export function buildCabinetNotificationsStreamUrl(
  items: readonly LocalOrderTokenRef[]
): string {
  const tokenPairs = items
    .slice(0, 25)
    .filter((item) => item.orderNumber && item.rescueToken)
    .map(
      (item) =>
        `${item.orderNumber.trim()}:${item.rescueToken.trim()}`
    )
    .join(',');

  if (!tokenPairs) {
    return '/api/client-cabinet/notifications/stream';
  }
  return `/api/client-cabinet/notifications/stream?tokens=${encodeURIComponent(
    tokenPairs
  )}`;
}

export async function queryCabinetNotificationsApi(
  items: readonly LocalOrderTokenRef[]
): Promise<CabinetNotificationsQueryResponse | null> {
  const res = await fetch('/api/client-cabinet/notifications/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as Partial<CabinetNotificationsQueryResponse>;
  if (!json.ok || !json.preferences) return null;
  return {
    ok: true,
    notifications: Array.isArray(json.notifications) ? json.notifications : [],
    preferences: json.preferences,
    unreadCount:
      typeof json.unreadCount === 'number' ? json.unreadCount : 0,
  };
}

export async function updateCabinetNotificationPreferencesApi(params: {
  items: readonly LocalOrderTokenRef[];
  browserPushEnabled?: boolean;
  notifyOnStageChange?: boolean;
  notifyOnNewVersion?: boolean;
  pushEndpoint?: string | null;
}): Promise<CabinetNotificationsQueryResponse> {
  const res = await fetch('/api/client-cabinet/notifications/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = (await res.json()) as Partial<CabinetNotificationsQueryResponse> & {
    error?: string;
  };
  if (!res.ok || !json.ok || !json.preferences) {
    throw new Error(
      json.error ?? 'Не удалось сохранить настройки push-уведомлений'
    );
  }
  return {
    ok: true,
    notifications: Array.isArray(json.notifications) ? json.notifications : [],
    preferences: json.preferences,
    unreadCount:
      typeof json.unreadCount === 'number' ? json.unreadCount : 0,
  };
}

export async function markCabinetNotificationsReadApi(params: {
  items: readonly LocalOrderTokenRef[];
  notificationIds?: readonly string[];
  markAll?: boolean;
}): Promise<CabinetNotificationsQueryResponse> {
  const res = await fetch('/api/client-cabinet/notifications/mark-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = (await res.json()) as Partial<CabinetNotificationsQueryResponse> & {
    error?: string;
  };
  if (!res.ok || !json.ok || !json.preferences) {
    throw new Error(
      json.error ?? 'Не удалось обновить статус прочтения уведомлений'
    );
  }
  return {
    ok: true,
    notifications: Array.isArray(json.notifications) ? json.notifications : [],
    preferences: json.preferences,
    unreadCount:
      typeof json.unreadCount === 'number' ? json.unreadCount : 0,
  };
}

export async function triggerCabinetTestPushApi(params: {
  items: readonly LocalOrderTokenRef[];
  orderNumber?: string;
}): Promise<{
  ok: boolean;
  notification: CabinetNotificationViewItem;
  notifications: CabinetNotificationViewItem[];
  unreadCount: number;
}> {
  const res = await fetch('/api/client-cabinet/notifications/test-push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = (await res.json()) as {
    ok?: boolean;
    notification?: CabinetNotificationViewItem;
    notifications?: CabinetNotificationViewItem[];
    unreadCount?: number;
    error?: string;
  };
  if (!res.ok || !json.ok || !json.notification) {
    throw new Error(
      json.error ?? 'Не удалось отправить тестовое push-оповещение'
    );
  }
  return {
    ok: true,
    notification: json.notification,
    notifications: Array.isArray(json.notifications) ? json.notifications : [],
    unreadCount:
      typeof json.unreadCount === 'number' ? json.unreadCount : 0,
  };
}

export async function uploadClientOrderAttachmentApi(params: {
  orderNumber: string;
  rescueToken: string;
  fileName: string;
  mimeType: string;
  dataBase64: string;
  note: string;
}): Promise<ClientCabinetOrderSummary> {
  const { orderNumber, ...body } = params;
  const res = await fetch(
    `/api/orders/${encodeURIComponent(orderNumber)}/client-upload`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
  return json.order;
}

export async function submitClientScriptDecisionApi(params: {
  orderNumber: string;
  rescueToken?: string;
  action: 'approve' | 'request_changes';
  conceptId?: string;
  comment?: string;
}): Promise<ClientCabinetOrderSummary> {
  const { orderNumber, ...body } = params;
  const res = await fetch(
    `/api/orders/${encodeURIComponent(orderNumber)}/approval/script-decision`,
    {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  const json = (await res.json()) as {
    ok?: boolean;
    order?: ClientCabinetOrderSummary;
    error?: string;
  };
  if (!res.ok || !json.ok || !json.order) {
    throw new Error(
      json.error ?? 'Не удалось сохранить решение по режиссёрскому сценарию'
    );
  }
  return json.order;
}

export async function submitClientSpotDecisionApi(params: {
  orderNumber: string;
  rescueToken?: string;
  action: 'accept' | 'request_revision';
  deliverableId?: string | null;
  kind?: SpotRevisionKind;
  timecodeSec?: number | null;
  comment?: string;
}): Promise<{
  order: ClientCabinetOrderSummary;
  routedTo:
    | 'accepted'
    | 'sound_engineer_included_round'
    | 'producer_escalation';
}> {
  const { orderNumber, ...body } = params;
  const res = await fetch(
    `/api/orders/${encodeURIComponent(orderNumber)}/approval/spot-decision`,
    {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  const json = (await res.json()) as {
    ok?: boolean;
    order?: ClientCabinetOrderSummary;
    routedTo?:
      | 'accepted'
      | 'sound_engineer_included_round'
      | 'producer_escalation';
    error?: string;
  };
  if (!res.ok || !json.ok || !json.order) {
    throw new Error(json.error ?? 'Не удалось обработать решение по ролику');
  }
  return {
    order: json.order,
    routedTo: json.routedTo ?? 'sound_engineer_included_round',
  };
}

export interface GuestReviewLinkResponse {
  ok: true;
  orderNumber: string;
  reviewToken: string;
  reviewPath: string;
  reviewUrl: string;
}

export async function createGuestReviewLinkApi(params: {
  orderNumber: string;
  rescueToken?: string;
}): Promise<GuestReviewLinkResponse> {
  const res = await fetch(
    `/api/orders/${encodeURIComponent(params.orderNumber)}/guest-review-link`,
    {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rescueToken: params.rescueToken,
      }),
    }
  );
  const json = (await res.json()) as Partial<GuestReviewLinkResponse> & {
    error?: string;
  };
  if (!res.ok || !json.ok || !json.reviewToken || !json.reviewUrl) {
    throw new Error(
      json.error ?? 'Не удалось создать гостевую ссылку для руководителя'
    );
  }
  return {
    ok: true,
    orderNumber: json.orderNumber ?? params.orderNumber,
    reviewToken: json.reviewToken,
    reviewPath: json.reviewPath ?? `/review?token=${encodeURIComponent(json.reviewToken)}`,
    reviewUrl: json.reviewUrl,
  };
}

export async function fetchGuestOrderReviewApi(
  reviewToken: string
): Promise<GuestOrderReviewPayload> {
  const res = await fetch(
    `/api/guest-review/${encodeURIComponent(reviewToken)}`,
    {
      headers: { Accept: 'application/json' },
    }
  );
  const json = (await res.json()) as {
    ok?: boolean;
    review?: GuestOrderReviewPayload;
    error?: string;
  };
  if (!res.ok || !json.ok || !json.review) {
    throw new Error(
      json.error ?? 'Гостевая ссылка недействительна или проект больше не доступен'
    );
  }
  return json.review;
}


