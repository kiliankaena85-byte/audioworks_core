import assert from 'node:assert/strict';
import test from 'node:test';
import {
  issueClientMagicLinkToken,
  issueClientSessionToken,
  upsertClientAccountRecord,
  verifyClientMagicLinkToken,
  verifyClientSessionToken,
} from './clientAuthCore';
import {
  buildCabinetRouteForAccessTab,
  buildCabinetRouteForWorkspaceFilter,
  buildDeliverableDownloadUrls,
  deriveCabinetLifecycleState,
  extractMagicTokenFromCabinetHref,
  extractOrderMasterFiles,
  filterCabinetHistoryOrders,
  mergeAuthenticatedAndDeviceOrders,
  partitionCabinetOrders,
  pickUnboundDeviceOrderTokens,
  resolveCabinetAccessUiFromRoute,
  resolveCabinetOrderVisualStatus,
  resolveWorkspaceFilterFromRoute,
  summarizeCabinetHistoryStatuses,
} from './clientCabinetArchitecture';
import type {
  ClientCabinetOrderSummary,
  OrderDeliverableFile,
} from './clientCabinetHelpers';
import {
  buildPlatformPath,
  parsePlatformRoute,
  resolveRouteSeoMeta,
  sanitizeCabinetMagicToken,
} from './platformRouter';

const TEST_SECRET = 'cabinet-arch-test-secret-2026';

test('platformRouter: разбирает /cabinet, /cabinet/reset и сохраняет регистр base64url токена ?magic=', () => {
  assert.deepEqual(parsePlatformRoute('/cabinet'), { kind: 'cabinet' });
  assert.deepEqual(parsePlatformRoute('/account'), { kind: 'cabinet' });
  assert.deepEqual(parsePlatformRoute('/cabinet/reset'), {
    kind: 'cabinet',
    subroute: 'reset',
  });
  assert.deepEqual(parsePlatformRoute('/cabinet', '?mode=reset'), {
    kind: 'cabinet',
    subroute: 'reset',
  });
  assert.deepEqual(parsePlatformRoute('/', '', '#cabinet'), { kind: 'cabinet' });
  assert.deepEqual(parsePlatformRoute('/', '', '#cabinet-reset'), {
    kind: 'cabinet',
    subroute: 'reset',
  });

  const mixedCaseToken = 'eyJlbWFpbCI6ImFAyi5ydSJ9.AbCdEfGhIjKlMnOpQrStUvWxYz_09-12';
  assert.deepEqual(
    parsePlatformRoute('/cabinet', `?magic=${encodeURIComponent(mixedCaseToken)}`),
    {
      kind: 'cabinet',
      magicToken: mixedCaseToken,
    }
  );
  assert.deepEqual(
    parsePlatformRoute(
      '/cabinet/reset',
      `?magic=${encodeURIComponent(mixedCaseToken)}`
    ),
    {
      kind: 'cabinet',
      subroute: 'reset',
      magicToken: mixedCaseToken,
    }
  );

  // Опасные строки с HTML/пробелами отсекаются в sanitizeCabinetMagicToken
  assert.equal(sanitizeCabinetMagicToken('<script>alert(1)</script>'), undefined);
  assert.equal(sanitizeCabinetMagicToken('short'), undefined);
});

test('platformRouter: buildPlatformPath и resolveRouteSeoMeta защищают canonicalPath от утечки magic-токена', () => {
  assert.equal(buildPlatformPath({ kind: 'cabinet' }), '/cabinet');
  assert.equal(
    buildPlatformPath({ kind: 'cabinet', subroute: 'reset' }),
    '/cabinet/reset'
  );
  assert.equal(
    buildPlatformPath({
      kind: 'cabinet',
      subroute: 'reset',
      magicToken: 'AbCdEfGhIjKl.MnOpQrStUvWx',
    }),
    '/cabinet/reset?magic=AbCdEfGhIjKl.MnOpQrStUvWx'
  );

  const seoResetWithToken = resolveRouteSeoMeta({
    kind: 'cabinet',
    subroute: 'reset',
    magicToken: 'AbCdEfGhIjKl.MnOpQrStUvWx',
  });
  assert.equal(seoResetWithToken.canonicalPath, '/cabinet');
  assert.equal(seoResetWithToken.noindex, true);
  assert.ok(seoResetWithToken.title.includes('Сброс и восстановление доступа'));
});

test('Сброс доступа через magic-ссылку увеличивает sessionEpoch и отзывает старые сессии других устройств', () => {
  const nowMs = 1_765_000_000_000;

  // 1. Авто-регистрация при первом заказе создаёт аккаунт с sessionEpoch = 1
  const initialReg = upsertClientAccountRecord([], {
    email: 'CFO@TransHolding.ru',
    orderNumbersToLink: ['FM-3001'],
    contactLine: 'Елена +7 916 000-11-22',
    companyOrInn: 'АО «ТрансХолдинг» · ИНН 7707083893',
    markLoggedIn: true,
    nowIso: '2026-11-14T09:00:00.000Z',
  });
  assert.equal(initialReg.account.sessionEpoch, 1);

  const oldLaptopSession = issueClientSessionToken(
    initialReg.account.email,
    TEST_SECRET,
    { nowMs, epoch: initialReg.account.sessionEpoch }
  );
  assert.ok(
    verifyClientSessionToken(oldLaptopSession.token, TEST_SECRET, {
      nowMs: nowMs + 1000,
      minValidEpoch: initialReg.account.sessionEpoch,
    })
  );

  // 2. Клиент запрашивает сброс доступа по magic-ссылке с отзывом старых сессий
  const resetMagic = issueClientMagicLinkToken(
    'cfo@transholding.ru',
    TEST_SECRET,
    { nowMs, revokeSessions: true }
  );
  const parsedRoute = parsePlatformRoute(
    '/cabinet/reset',
    `?magic=${encodeURIComponent(resetMagic.token)}`
  );
  assert.equal(parsedRoute.kind, 'cabinet');
  if (parsedRoute.kind === 'cabinet') {
    assert.equal(parsedRoute.subroute, 'reset');
    assert.equal(parsedRoute.magicToken, resetMagic.token);
  }

  const verifiedMagic = verifyClientMagicLinkToken(resetMagic.token, TEST_SECRET, {
    nowMs: nowMs + 5000,
  });
  assert.equal(verifiedMagic.ok, true);
  if (!verifiedMagic.ok) return;
  assert.equal(verifiedMagic.payload.revokeSessions, true);

  // 3. При погашении magic-ссылки эпоха сессии увеличивается до 2
  const afterReset = upsertClientAccountRecord(initialReg.accounts, {
    email: verifiedMagic.payload.email,
    markLoggedIn: true,
    rotateSessionEpoch: Boolean(verifiedMagic.payload.revokeSessions),
    nowIso: '2026-11-14T09:05:00.000Z',
  });
  assert.equal(afterReset.account.sessionEpoch, 2);

  const newPhoneSession = issueClientSessionToken(
    afterReset.account.email,
    TEST_SECRET,
    { nowMs: nowMs + 5000, epoch: afterReset.account.sessionEpoch }
  );

  // Старая сессия на чужом ноутбуке (epoch 1) мгновенно отклоняется, новая (epoch 2) работает
  assert.equal(
    verifyClientSessionToken(oldLaptopSession.token, TEST_SECRET, {
      nowMs: nowMs + 6000,
      minValidEpoch: () => afterReset.account.sessionEpoch ?? 1,
    }),
    null
  );
  const verifiedNewSession = verifyClientSessionToken(
    newPhoneSession.token,
    TEST_SECRET,
    {
      nowMs: nowMs + 6000,
      minValidEpoch: () => afterReset.account.sessionEpoch ?? 1,
    }
  );
  assert.ok(verifiedNewSession);
  assert.equal(verifiedNewSession.epoch, 2);
});

test('clientCabinetArchitecture: чистые селекторы жизненного цикла, маршрутов и слияния заказов', () => {
  assert.equal(
    deriveCabinetLifecycleState({
      isLoading: true,
      isVerifyingMagic: false,
      hasAuthenticatedAccount: false,
      ordersCount: 0,
    }),
    'initializing'
  );
  assert.equal(
    deriveCabinetLifecycleState({
      isLoading: true,
      isVerifyingMagic: true,
      hasAuthenticatedAccount: false,
      ordersCount: 0,
    }),
    'verifying_magic_link'
  );
  assert.equal(
    deriveCabinetLifecycleState({
      isLoading: false,
      isVerifyingMagic: false,
      hasAuthenticatedAccount: true,
      ordersCount: 2,
    }),
    'authenticated'
  );
  assert.equal(
    deriveCabinetLifecycleState({
      isLoading: false,
      isVerifyingMagic: false,
      hasAuthenticatedAccount: false,
      ordersCount: 1,
    }),
    'anonymous_device_orders'
  );

  assert.deepEqual(
    resolveCabinetAccessUiFromRoute({
      subroute: 'reset',
      currentTab: 'magic_email',
      currentlyOpen: false,
      ordersCount: 3,
    }),
    { accessTab: 'access_reset', showAccessPanel: true }
  );
  assert.deepEqual(buildCabinetRouteForAccessTab('access_reset'), {
    kind: 'cabinet',
    subroute: 'reset',
  });
  assert.deepEqual(buildCabinetRouteForAccessTab('magic_email'), {
    kind: 'cabinet',
  });

  const extracted = extractMagicTokenFromCabinetHref(
    '/cabinet/reset?magic=PayLoad_CaseSensitive.Sig_1234567890'
  );
  assert.deepEqual(extracted, {
    token: 'PayLoad_CaseSensitive.Sig_1234567890',
    isResetPath: true,
  });

  const makeOrder = (
    orderNumber: string,
    createdAt: string,
    clientEmail: string | null
  ): ClientCabinetOrderSummary => ({
    orderNumber,
    rescueToken: `tok-${orderNumber}`,
    createdAt,
    updatedAt: createdAt,
    stage: 'new_hold',
    formatLabel: 'Ролик «Под ключ»',
    totalBudgetRub: 25000,
    contact: '+7 999 000-00-00',
    clientEmail,
    companyOrInn: 'ООО Тест',
    innVerified: true,
    briefText: 'Тест',
    hasVoiceRecording: false,
    voiceDurationSec: 0,
    attachedFileName: null,
    preferredDeliveryChannel: 'cabinet',
    cloudDiskUrl: null,
    deliverables: [],
    clientUploads: [],
    documentMeta: null,
  });

  const merged = mergeAuthenticatedAndDeviceOrders(
    [makeOrder('FM-101', '2026-11-13T10:00:00Z', 'a@b.ru')],
    [
      makeOrder('FM-101', '2026-11-13T10:00:00Z', 'a@b.ru'),
      makeOrder('FM-102', '2026-11-14T10:00:00Z', null),
    ]
  );
  assert.deepEqual(
    merged.map((o) => o.orderNumber),
    ['FM-102', 'FM-101']
  );

  const unbound = pickUnboundDeviceOrderTokens(merged, 'a@b.ru');
  assert.deepEqual(unbound, [{ orderNumber: 'FM-102', rescueToken: 'tok-FM-102' }]);
});

test('История заказов: маршрутизация /cabinet/history, разделение активных и прошлых проектов, мастер-файлы и поиск', () => {
  assert.deepEqual(parsePlatformRoute('/cabinet/history'), {
    kind: 'cabinet',
    subroute: 'history',
  });
  assert.deepEqual(parsePlatformRoute('/cabinet', '?mode=history'), {
    kind: 'cabinet',
    subroute: 'history',
  });
  assert.deepEqual(parsePlatformRoute('/', '', '#cabinet-history'), {
    kind: 'cabinet',
    subroute: 'history',
  });
  assert.equal(
    buildPlatformPath({ kind: 'cabinet', subroute: 'history' }),
    '/cabinet/history'
  );
  assert.equal(resolveWorkspaceFilterFromRoute('history'), 'history');
  assert.equal(resolveWorkspaceFilterFromRoute(undefined), 'all');
  assert.deepEqual(buildCabinetRouteForWorkspaceFilter('history'), {
    kind: 'cabinet',
    subroute: 'history',
  });
  assert.deepEqual(buildCabinetRouteForWorkspaceFilter('all'), {
    kind: 'cabinet',
  });

  const seoHistory = resolveRouteSeoMeta({
    kind: 'cabinet',
    subroute: 'history',
  });
  assert.equal(seoHistory.canonicalPath, '/cabinet');
  assert.equal(seoHistory.noindex, true);
  assert.ok(seoHistory.title.includes('История заказов'));

  const wavMaster: OrderDeliverableFile = {
    id: 'deliv-1',
    title: 'Эфирный мастер 25 сек (WAV 48kHz / 24bit)',
    kind: 'audio_master',
    fileName: 'TransFlot_25sec_Master.wav',
    mimeType: 'audio/wav',
    sizeBytes: 2_845_120,
    uploadedAt: '2026-09-18T15:00:00.000Z',
  };
  const passportPdf: OrderDeliverableFile = {
    id: 'deliv-2',
    title: 'Паспорт музыкальных прав РАО/ВОИС',
    kind: 'passport',
    fileName: 'Passport_2418.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 185_000,
    uploadedAt: '2026-09-18T15:05:00.000Z',
  };

  const buildOrder = (
    overrides: Partial<ClientCabinetOrderSummary> & { orderNumber: string }
  ): ClientCabinetOrderSummary => ({
    rescueToken: `tok-${overrides.orderNumber}`,
    createdAt: '2026-09-15T10:00:00.000Z',
    updatedAt: '2026-09-18T15:00:00.000Z',
    stage: 'completed_ltv',
    formatLabel: 'Игровой ролик / Мини-кино (25 сек) — 35 000 ₽',
    totalBudgetRub: 35000,
    contact: 'Алексей +7 926 410-55-88',
    clientEmail: 'director@transflot-leasing.ru',
    companyOrInn: 'АО «ТрансФлот Лизинг» · ИНН 7702070139',
    innVerified: true,
    briefText: 'Осенний лизинг тягачей с авансом от 5%',
    hasVoiceRecording: false,
    voiceDurationSec: 0,
    attachedFileName: null,
    preferredDeliveryChannel: 'cabinet',
    cloudDiskUrl: null,
    deliverables: [],
    clientUploads: [],
    documentMeta: null,
    ...overrides,
  });

  const activeOrder = buildOrder({
    orderNumber: 'FM-HOLD-2854',
    stage: 'on_air',
    deliverables: [wavMaster],
  });
  const completedWithMaster = buildOrder({
    orderNumber: 'FM-2418',
    stage: 'completed_ltv',
    deliverables: [wavMaster, passportPdf],
  });
  const completedWithoutMaster = buildOrder({
    orderNumber: 'FM-2105',
    stage: 'completed_ltv',
    formatLabel: 'Голос и стиль (15 сек) — 15 000 ₽',
    briefText: 'Весенняя сервисная кампания',
    deliverables: [passportPdf],
  });

  const partitioned = partitionCabinetOrders([
    activeOrder,
    completedWithMaster,
    completedWithoutMaster,
  ]);
  assert.deepEqual(
    partitioned.activeOrders.map((o) => o.orderNumber),
    ['FM-HOLD-2854']
  );
  assert.deepEqual(
    partitioned.historyOrders.map((o) => o.orderNumber),
    ['FM-2418', 'FM-2105']
  );
  assert.equal(partitioned.totalHistoryMastersCount, 1);

  const extractedFiles = extractOrderMasterFiles(completedWithMaster);
  assert.equal(extractedFiles.masterFiles.length, 1);
  assert.equal(extractedFiles.masterFiles[0].id, 'deliv-1');
  assert.equal(extractedFiles.supplementaryFiles.length, 1);
  assert.equal(extractedFiles.supplementaryFiles[0].id, 'deliv-2');

  const urls = buildDeliverableDownloadUrls(
    'FM-2418',
    'tok-FM-2418',
    'deliv-1'
  );
  assert.equal(
    urls.downloadHref,
    '/api/orders/FM-2418/deliverables/deliv-1?token=tok-FM-2418'
  );
  assert.equal(
    urls.previewHref,
    '/api/orders/FM-2418/deliverables/deliv-1?token=tok-FM-2418&preview=1'
  );

  // Поиск по имени мастер-файла
  assert.deepEqual(
    filterCabinetHistoryOrders(partitioned.historyOrders, {
      searchQuery: 'TransFlot_25sec',
    }).map((o) => o.orderNumber),
    ['FM-2418']
  );

  // Фильтр «Только с мастер-файлами»
  assert.deepEqual(
    filterCabinetHistoryOrders(partitioned.historyOrders, {
      onlyWithMasters: true,
    }).map((o) => o.orderNumber),
    ['FM-2418']
  );

  // Пустой результат при несовпадающем запросе
  assert.deepEqual(
    filterCabinetHistoryOrders(partitioned.historyOrders, {
      searchQuery: 'несуществующий-проект-999',
    }),
    []
  );
});

test('Визуальные статусы в «Истории заказов»: «В работе», «На согласовании», «Готово» и шкала прогресса', () => {
  const wavMaster: OrderDeliverableFile = {
    id: 'deliv-wav',
    title: 'Эфирный мастер 20 сек',
    kind: 'audio_master',
    fileName: 'spot_master.wav',
    mimeType: 'audio/wav',
    sizeBytes: 2_600_000,
    uploadedAt: '2026-11-10T10:00:00.000Z',
  };
  const scriptDoc: OrderDeliverableFile = {
    id: 'deliv-script',
    title: '3 концепции сценария на утверждение',
    kind: 'script',
    fileName: 'scenarios_draft.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 120_000,
    uploadedAt: '2026-11-12T10:00:00.000Z',
  };

  const makeProj = (
    orderNumber: string,
    stage: ClientCabinetOrderSummary['stage'],
    deliverables: OrderDeliverableFile[] = []
  ): ClientCabinetOrderSummary => ({
    orderNumber,
    rescueToken: `tok-${orderNumber}`,
    createdAt: '2026-11-10T10:00:00.000Z',
    updatedAt: '2026-11-10T12:00:00.000Z',
    stage,
    formatLabel: 'Продакшн под ключ (20 сек)',
    totalBudgetRub: 25_000,
    contact: '+7 999 111-22-33',
    clientEmail: 'director@transflot-leasing.ru',
    companyOrInn: 'АО «ТрансФлот Лизинг» · ИНН 7702070139',
    innVerified: true,
    briefText: 'Лизинг техники',
    hasVoiceRecording: false,
    voiceDurationSec: 0,
    attachedFileName: null,
    preferredDeliveryChannel: 'cabinet',
    cloudDiskUrl: null,
    deliverables,
    clientUploads: [],
    documentMeta: null,
  });

  const inWorkNew = makeProj('FM-301', 'new_hold');
  const inWorkProd = makeProj('FM-302', 'in_production');
  const inReviewQuota = makeProj('FM-303', 'quota_locked');
  const inReviewScript = makeProj('FM-304', 'in_production', [scriptDoc]);
  const readyOnAir = makeProj('FM-305', 'on_air', [wavMaster]);
  const readyArchived = makeProj('FM-306', 'completed_ltv', [wavMaster]);

  const stWork = resolveCabinetOrderVisualStatus(inWorkProd);
  assert.equal(stWork.statusId, 'in_work');
  assert.equal(stWork.label, 'В работе');
  assert.equal(stWork.currentStepNumber, 1);
  assert.equal(stWork.progressPercent, 50);
  assert.deepEqual(
    stWork.steps.map((s) => s.state),
    ['current', 'upcoming', 'upcoming']
  );

  const stReviewQuota = resolveCabinetOrderVisualStatus(inReviewQuota);
  assert.equal(stReviewQuota.statusId, 'in_review');
  assert.equal(stReviewQuota.label, 'На согласовании');
  assert.equal(stReviewQuota.currentStepNumber, 2);
  assert.equal(stReviewQuota.progressPercent, 65);
  assert.deepEqual(
    stReviewQuota.steps.map((s) => s.state),
    ['done', 'current', 'upcoming']
  );

  const stReviewScript = resolveCabinetOrderVisualStatus(inReviewScript);
  assert.equal(stReviewScript.statusId, 'in_review');
  assert.equal(stReviewScript.progressPercent, 75);

  const stReady = resolveCabinetOrderVisualStatus(readyArchived);
  assert.equal(stReady.statusId, 'ready');
  assert.equal(stReady.label, 'Готово');
  assert.equal(stReady.currentStepNumber, 3);
  assert.equal(stReady.progressPercent, 100);
  assert.deepEqual(
    stReady.steps.map((s) => s.state),
    ['done', 'done', 'done']
  );

  const allProjects = [
    inWorkNew,
    inWorkProd,
    inReviewQuota,
    inReviewScript,
    readyOnAir,
    readyArchived,
  ];
  const summary = summarizeCabinetHistoryStatuses(allProjects);
  assert.deepEqual(summary, {
    totalProjectsCount: 6,
    inWorkCount: 2,
    inReviewCount: 2,
    readyCount: 2,
    totalMasterFilesCount: 2,
  });

  assert.deepEqual(
    filterCabinetHistoryOrders(allProjects, { statusFilter: 'in_work' }).map(
      (o) => o.orderNumber
    ),
    ['FM-301', 'FM-302']
  );
  assert.deepEqual(
    filterCabinetHistoryOrders(allProjects, { statusFilter: 'in_review' }).map(
      (o) => o.orderNumber
    ),
    ['FM-303', 'FM-304']
  );
  assert.deepEqual(
    filterCabinetHistoryOrders(allProjects, { statusFilter: 'ready' }).map(
      (o) => o.orderNumber
    ),
    ['FM-305', 'FM-306']
  );
});
