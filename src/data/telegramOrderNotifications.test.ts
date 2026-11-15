import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import {
  buildWebhookOrderEnvelope,
  createSeedCrmOrders,
  formatTelegramOrderDispatchMessage,
} from './orderCrmTypes';
import { BANNED_EDITORIAL_TERMS } from './studioCmsTypes';
import {
  extractChatFromTelegramUpdates,
  formatStatusChangeActorLabel,
  parseTelegramBotApiError,
  resolveEffectiveTelegramSettings,
} from './telegramOrderNotifications';

test('resolveEffectiveTelegramSettings активирует уведомления из TELEGRAM_ORDERS_BOT_TOKEN даже поверх старого пустого конфига на диске', () => {
  const legacyEmptyDiskConfig = {
    enabled: false,
    botToken: '',
    chatId: '',
    notifyOnNewOrder: true,
    notifyOnStageChange: true,
    maskPdnInExternalAlerts: true,
  };

  const resolvedWithEnvTokenOnly = resolveEffectiveTelegramSettings(
    legacyEmptyDiskConfig,
    {
      TELEGRAM_ORDERS_BOT_TOKEN: '789012345:AAH_studio_env_secret_token',
    }
  );

  assert.equal(resolvedWithEnvTokenOnly.enabled, true);
  assert.equal(resolvedWithEnvTokenOnly.hasBotToken, true);
  assert.equal(resolvedWithEnvTokenOnly.botTokenSource, 'env');
  assert.equal(resolvedWithEnvTokenOnly.envBotTokenConfigured, true);
  assert.equal(
    resolvedWithEnvTokenOnly.botToken,
    '789012345:AAH_studio_env_secret_token'
  );
  assert.equal(resolvedWithEnvTokenOnly.hasChatId, false);
  assert.equal(resolvedWithEnvTokenOnly.notifyOnStageChange, true);

  const resolvedWithEnvChat = resolveEffectiveTelegramSettings(
    legacyEmptyDiskConfig,
    {
      TELEGRAM_ORDERS_BOT_TOKEN: '789012345:AAH_studio_env_secret_token',
      TELEGRAM_ORDERS_CHAT_ID: '-1002233445566',
    }
  );
  assert.equal(resolvedWithEnvChat.hasChatId, true);
  assert.equal(resolvedWithEnvChat.chatId, '-1002233445566');
  assert.equal(resolvedWithEnvChat.chatIdSource, 'env');

  // Если администратор явно отключил тумблер в админке, уважаем его выбор, сохраняя признак наличия токена
  const explicitlyDisabled = resolveEffectiveTelegramSettings(
    {
      ...legacyEmptyDiskConfig,
      enabled: false,
      enabledExplicitlySet: true,
    },
    {
      TELEGRAM_ORDERS_BOT_TOKEN: '789012345:AAH_studio_env_secret_token',
      TELEGRAM_ORDERS_CHAT_ID: '-1002233445566',
    }
  );
  assert.equal(explicitlyDisabled.enabled, false);
  assert.equal(explicitlyDisabled.hasBotToken, true);
  assert.equal(explicitlyDisabled.botTokenSource, 'env');
});

test('extractChatFromTelegramUpdates извлекает самый свежий чат рабочей группы или личный диалог с ботом', () => {
  assert.equal(extractChatFromTelegramUpdates(null), null);
  assert.equal(extractChatFromTelegramUpdates({ ok: false, result: [] }), null);
  assert.equal(extractChatFromTelegramUpdates({ ok: true, result: [] }), null);

  const updatesPayload = {
    ok: true,
    result: [
      {
        update_id: 101,
        message: {
          message_id: 1,
          chat: {
            id: 44556677,
            type: 'private',
            first_name: 'Илья',
            username: 'producer_ilya',
          },
          text: '/start',
        },
      },
      {
        update_id: 102,
        my_chat_member: {
          chat: {
            id: -1009988776655,
            type: 'supergroup',
            title: 'FMWorks · Продюсерский пульт',
          },
        },
      },
    ],
  };

  const discovered = extractChatFromTelegramUpdates(updatesPayload);
  assert.deepEqual(discovered, {
    chatId: '-1009988776655',
    chatTitle: 'FMWorks · Продюсерский пульт',
    chatType: 'supergroup',
  });
});

test('parseTelegramBotApiError возвращает понятную диагностику для 401, 400 chat not found, 403 и 429 retry_after', () => {
  const err401 = parseTelegramBotApiError(401, {
    ok: false,
    error_code: 401,
    description: 'Unauthorized',
  });
  assert.ok(err401.detail.includes('TELEGRAM_ORDERS_BOT_TOKEN'));
  assert.equal(err401.retryAfterSec, null);

  const err400 = parseTelegramBotApiError(
    400,
    JSON.stringify({
      ok: false,
      error_code: 400,
      description: 'Bad Request: chat not found',
    })
  );
  assert.ok(err400.detail.includes('chat not found'));

  const err429 = parseTelegramBotApiError(429, {
    ok: false,
    error_code: 429,
    description: 'Too Many Requests: retry after 2',
    parameters: { retry_after: 2 },
  });
  assert.equal(err429.retryAfterSec, 2);
  assert.ok(err429.detail.includes('429'));
});

test('formatTelegramOrderDispatchMessage для order.stage_changed отображает переход статусов, инициатора и скрывает ПДн по 152-ФЗ', () => {
  const [seedOrder] = createSeedCrmOrders(1_760_000_000_000);
  const progressedOrder = {
    ...seedOrder,
    stage: 'in_production' as const,
    updatedAt: '2026-11-15T11:30:00.000Z',
  };

  const msg = formatTelegramOrderDispatchMessage(
    progressedOrder,
    'order.stage_changed',
    {
      maskPdn: true,
      statusChange: {
        previousStage: 'edo_invoice',
        nextStage: 'in_production',
        actor: 'client_cabinet',
        workflowStepLabel:
          'Клиент утвердил режиссёрский сценарий — запущена студийная запись',
        reasonSummary:
          'Просьба связаться по +7 916 740-28-19 или client@company.ru (ИНН 7707083893, @alex_dir)',
        changedAtIso: '2026-11-15T11:30:00.000Z',
      },
    }
  );

  assert.ok(msg.includes(`СТАТУС ЗАКАЗА ИЗМЕНЁН · #${progressedOrder.orderNumber}`));
  assert.ok(
    msg.includes('Переход этапа: «03. Счёт в ЭДО» → «04. Ролик и паспорт»')
  );
  assert.ok(msg.includes('Инициатор: Клиент (личный кабинет заказа)'));
  assert.ok(
    msg.includes(
      'Статус производства: Клиент утвердил режиссёрский сценарий — запущена студийная запись'
    )
  );
  assert.ok(msg.includes('Готовность чек-листа:'));
  assert.ok(msg.includes('UTC+3'));

  // 152-ФЗ: прямые ПДн из комментария и карточки заказа не должны попасть в текст для Telegram
  assert.equal(msg.includes('+7 916 740-28-19'), false);
  assert.equal(msg.includes('client@company.ru'), false);
  assert.equal(msg.includes('7707083893'), false);
  assert.equal(msg.includes('@alex_dir'), false);
  assert.ok(msg.includes('152-ФЗ'));

  // Проверка редакционной политики (отсутствие стоп-слов, включая региональные штампы)
  const lower = msg.toLowerCase();
  for (const banned of BANNED_EDITORIAL_TERMS) {
    assert.equal(
      lower.includes(banned),
      false,
      `Обнаружен запрещённый термин в уведомлении смены статуса: ${banned}`
    );
  }

  // Webhook-конверт также получает структурированный блок statusTransition
  const webhookEnv = buildWebhookOrderEnvelope(
    progressedOrder,
    'order.stage_changed',
    '2026-11-15T11:30:00.000Z',
    {
      previousStage: 'edo_invoice',
      nextStage: 'in_production',
      actor: 'sound_engineer',
      workflowStepLabel: 'Сдан мастер-дубль на проверку',
    }
  );
  assert.ok(webhookEnv.statusTransition);
  assert.equal(webhookEnv.statusTransition.previousStage, 'edo_invoice');
  assert.equal(webhookEnv.statusTransition.nextStage, 'in_production');
  assert.equal(
    webhookEnv.statusTransition.actor,
    formatStatusChangeActorLabel('sound_engineer')
  );

  // Предпросмотр/тест смены статуса на исходной карточке new_hold корректно отражает nextStage = quota_locked
  const previewWebhookEnv = buildWebhookOrderEnvelope(
    seedOrder,
    'order.stage_changed',
    '2026-11-15T11:30:00.000Z',
    {
      previousStage: 'new_hold',
      nextStage: 'quota_locked',
      actor: 'producer_crm',
    }
  );
  assert.equal(previewWebhookEnv.statusTransition?.previousStage, 'new_hold');
  assert.equal(previewWebhookEnv.statusTransition?.nextStage, 'quota_locked');
  assert.equal(previewWebhookEnv.order.stage, 'quota_locked');
});

test('Интеграционный цикл Telegram Bot API (getUpdates + sendMessage) доставляет мгновенное уведомление по TELEGRAM_ORDERS_BOT_TOKEN', async () => {
  const receivedMessages: Array<{ chat_id: string; text: string }> = [];
  const fakeBotToken = '999888777:AAH_loopback_test_token';

  const mockTelegramServer = http.createServer((req, res) => {
    const url = req.url || '';
    if (req.method === 'GET' && url.startsWith(`/bot${fakeBotToken}/getUpdates`)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          result: [
            {
              update_id: 501,
              message: {
                message_id: 12,
                chat: {
                  id: -100777888999,
                  type: 'supergroup',
                  title: 'Студия FMWorks · Статусы заказов',
                },
                text: '/start',
              },
            },
          ],
        })
      );
      return;
    }

    if (req.method === 'POST' && url === `/bot${fakeBotToken}/sendMessage`) {
      let body = '';
      req.on('data', (chunk) => {
        body += String(chunk);
      });
      req.on('end', () => {
        const parsed = JSON.parse(body) as { chat_id: string; text: string };
        receivedMessages.push(parsed);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, result: { message_id: 99 } }));
      });
      return;
    }

    res.writeHead(404).end();
  });

  await new Promise<void>((resolve) =>
    mockTelegramServer.listen(0, '127.0.0.1', () => resolve())
  );

  try {
    const addr = mockTelegramServer.address();
    assert.ok(addr && typeof addr === 'object');
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    const resolved = resolveEffectiveTelegramSettings(
      { enabled: false, botToken: '', chatId: '' },
      { TELEGRAM_ORDERS_BOT_TOKEN: fakeBotToken }
    );
    assert.equal(resolved.enabled, true);
    assert.equal(resolved.hasChatId, false);

    // Шаг 1: Автоопределение Chat ID по одному лишь TELEGRAM_ORDERS_BOT_TOKEN
    const updatesRes = await fetch(
      `${baseUrl}/bot${resolved.botToken}/getUpdates?limit=10`
    );
    const discovered = extractChatFromTelegramUpdates(await updatesRes.json());
    assert.ok(discovered);
    assert.equal(discovered.chatId, '-100777888999');

    // Шаг 2: Мгновенная отправка уведомления о смене статуса заказа
    const [seedOrder] = createSeedCrmOrders(1_760_000_000_000);
    const updatedOrder = { ...seedOrder, stage: 'quota_locked' as const };
    const text = formatTelegramOrderDispatchMessage(
      updatedOrder,
      'order.stage_changed',
      {
        maskPdn: resolved.maskPdnInExternalAlerts,
        statusChange: {
          previousStage: 'new_hold',
          nextStage: 'quota_locked',
          actor: 'producer_crm',
        },
      }
    );

    const sendRes = await fetch(`${baseUrl}/bot${resolved.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: discovered.chatId,
        text,
      }),
    });
    assert.equal(sendRes.status, 200);
    assert.equal(receivedMessages.length, 1);
    assert.equal(receivedMessages[0].chat_id, '-100777888999');
    assert.ok(
      receivedMessages[0].text.includes(
        `СТАТУС ЗАКАЗА ИЗМЕНЁН · #${updatedOrder.orderNumber}`
      )
    );
    assert.ok(
      receivedMessages[0].text.includes(
        'Переход этапа: «01. Новый резерв (4ч)» → «02. Квота подтверждена»'
      )
    );
  } finally {
    await new Promise<void>((resolve) => mockTelegramServer.close(() => resolve()));
  }
});

test('Cloud Run prod ESM: telegramOrderNotifications.ts и orderCrmTypes.ts загружаются нативным Node ESM без tsx', async () => {
  const { execFileSync } = await import('node:child_process');
  const out = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { resolveEffectiveTelegramSettings } from './src/data/telegramOrderNotifications.ts';
       import { formatTelegramOrderDispatchMessage, createSeedCrmOrders } from './src/data/orderCrmTypes.ts';
       const cfg = resolveEffectiveTelegramSettings(null, { TELEGRAM_ORDERS_BOT_TOKEN: '123:ABC' });
       const [ord] = createSeedCrmOrders();
       const msg = formatTelegramOrderDispatchMessage(ord, 'order.stage_changed', { statusChange: { previousStage: 'new_hold', nextStage: 'quota_locked' } });
       console.log(JSON.stringify({ enabled: cfg.enabled, source: cfg.botTokenSource, hasHeader: msg.includes('СТАТУС ЗАКАЗА ИЗМЕНЁН') }));`,
    ],
    { encoding: 'utf8' }
  );
  const parsed = JSON.parse(out.trim()) as {
    enabled: boolean;
    source: string;
    hasHeader: boolean;
  };
  assert.equal(parsed.enabled, true);
  assert.equal(parsed.source, 'env');
  assert.equal(parsed.hasHeader, true);
});
