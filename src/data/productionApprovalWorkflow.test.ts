import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  applyClientScriptDecision,
  applyClientSpotDecision,
  applyProducerDirectSpotRevision,
  applyProducerEscalationResolution,
  applyProducerReopenScriptForRework,
  applyPublishEngineerTakeToClient,
  applyPublishScriptDraft,
  applyRecordEngineerTake,
  applyRejectEngineerTakeForRework,
  buildStudioQuickShareLinks,
  buildSyntheticSilentWavBytes,
  createDefaultSoundEngineerRoster,
  createSeedApprovalWorkflowForOrder,
  CRM_STAGE_RETURN_NOTE_PRESETS,
  estimateRussianScriptDurationSec,
  evaluateBroadcastSlotFit,
  evaluateOrderProductionSlaStatus,
  filterProductionOrdersForStudioQueue,
  formatSoundEngineerProductionSheet,
  issueSoundDropTokenWithSigner,
  issueSoundEngineerEmailGrantWithSigner,
  parseWavExactDurationSec,
  resolveExternalClientStep,
  resolveStudioKanbanColumn,
  resolveWhoseTurn,
  SOUND_ENGINEER_EMAIL_CTA_LABEL,
  STUDIO_REWORK_REASON_PRESETS,
  toClientApprovalWorkflowView,
  toSoundDropTaskPublicView,
  verifySoundDropTokenWithSigner,
  verifySoundEngineerEmailGrantWithSigner,
} from './productionApprovalWorkflow';
import { BANNED_EDITORIAL_TERMS } from './studioCmsTypes';

test('Пошаговое согласование сценария: публикация продюсером -> замечание клиента -> v2 -> утверждение и заморозка текста', () => {
  const initial = createSeedApprovalWorkflowForOrder({
    orderNumber: 'FM-3100',
    createdAt: '2026-11-14T10:00:00.000Z',
    updatedAt: '2026-11-14T10:00:00.000Z',
    stage: 'in_production',
    formatLabel: 'Продакшн под ключ (20 сек) — 25 000 ₽',
    briefText: 'Лизинг спецтехники за 1 день',
    deliverables: [],
  });

  assert.equal(initial.phase, 'script_drafting');
  assert.equal(resolveWhoseTurn(initial).actor, 'producer');
  assert.equal(resolveExternalClientStep(initial), '01_script');
  assert.equal(resolveStudioKanbanColumn(initial), 'col_script');

  const publishedV1 = applyPublishScriptDraft(
    initial,
    {
      targetSlotSec: 20,
      concepts: [
        {
          title: 'Концепция 1 · Прямая выгода',
          bodyText:
            'Новая техника на объекте уже завтра. Лизинг строительных машин по ИНН за один рабочий день.',
          stressNotes: 'ли́зинг, по ИНН [и-эн-эн]',
          fz38Disclaimer: 'АО «СтройЛизинг». Подробности на сайте.',
          directorApproach: 'Низкий уверенный баритон, ритмичная подложка без вокала.',
        },
      ],
    },
    '2026-11-14T10:15:00.000Z'
  );

  assert.equal(publishedV1.phase, 'script_client_review');
  assert.equal(publishedV1.scriptVersions.length, 1);
  assert.equal(publishedV1.scriptVersions[0]?.versionNumber, 1);
  assert.equal(resolveWhoseTurn(publishedV1).actor, 'client');

  const withClientComment = applyClientScriptDecision(
    publishedV1,
    {
      action: 'request_changes',
      comment: 'Добавьте упоминание нулевого удорожания в первые три месяца.',
    },
    '2026-11-14T10:30:00.000Z'
  );

  assert.equal(withClientComment.phase, 'script_drafting');
  assert.equal(resolveWhoseTurn(withClientComment).actor, 'producer');
  assert.equal(
    withClientComment.scriptVersions[0]?.clientComment,
    'Добавьте упоминание нулевого удорожания в первые три месяца.'
  );

  const publishedV2 = applyPublishScriptDraft(
    withClientComment,
    {
      targetSlotSec: 20,
      concepts: [
        {
          title: 'Концепция 1 (обновлённая) · Нулевое удорожание 3 мес.',
          bodyText:
            'Новая техника на объекте уже завтра. Лизинг строительных машин с нулевым удорожанием в первые три месяца.',
          stressNotes: 'ли́зинг, удорожа́ние',
          fz38Disclaimer: 'АО «СтройЛизинг». Подробности на сайте.',
          directorApproach: 'Низкий уверенный баритон, ритмичная подложка без вокала.',
        },
      ],
    },
    '2026-11-14T10:45:00.000Z'
  );

  assert.equal(publishedV2.scriptVersions[0]?.versionNumber, 2);
  assert.equal(publishedV2.phase, 'script_client_review');

  const locked = applyClientScriptDecision(
    publishedV2,
    { action: 'approve' },
    '2026-11-14T11:00:00.000Z'
  );

  assert.equal(locked.phase, 'studio_production');
  assert.ok(locked.lockedScript);
  assert.equal(locked.lockedScript.versionNumber, 2);
  assert.equal(resolveExternalClientStep(locked), '02_production');
  assert.equal(resolveStudioKanbanColumn(locked), 'col_ready_for_sound');
});

test('Зашитый 1 сервисный раунд доводки ролика (включая до 1 замены музыки без доплат) и эскалация на продюсера', () => {
  const seed2926 = createSeedApprovalWorkflowForOrder({
    orderNumber: 'FM-2926',
    createdAt: '2026-11-14T08:00:00.000Z',
    updatedAt: '2026-11-14T09:30:00.000Z',
    stage: 'quota_locked',
    formatLabel: 'Игровой ролик / Мини-кино (30 сек) — 35 000 ₽',
    briefText: 'Лизинг рефрижераторов',
    deliverables: [{ id: 'deliv-v2', versionCode: 'v2', versionStage: 'revision' }],
  });

  assert.equal(seed2926.phase, 'spot_client_review');
  assert.equal(seed2926.serviceRoundUsed, false);

  // 1-й запрос клиента: замена музыкальной подложки после показа директору — проходит в рамках включённого раунда без микро-счетов!
  const firstRound = applyClientSpotDecision(
    seed2926,
    {
      action: 'request_revision',
      revisionId: 'rev-1',
      kind: 'music_replacement',
      timecodeSec: 4.5,
      comment: 'Руководитель просит более спокойную деловую подложку без острых ударных.',
    },
    '2026-11-14T10:00:00.000Z'
  );

  assert.equal(firstRound.routedTo, 'sound_engineer_included_round');
  assert.equal(firstRound.workflow.serviceRoundUsed, true);
  assert.equal(firstRound.workflow.phase, 'revision_in_progress');
  assert.equal(firstRound.workflow.spotRevisions[0]?.usedIncludedServiceRound, true);
  assert.equal(firstRound.workflow.spotRevisions[0]?.status, 'sent_to_engineer');

  // Звукорежиссёр сдаёт обновлённый дубль в буфер ОТК продюсера
  const withTake = applyRecordEngineerTake(
    firstRound.workflow,
    {
      id: 'take-1',
      engineerId: 'eng-vetrov',
      engineerName: 'Павел Ветров',
      fileName: 'spot_30s_v3.wav',
      mimeType: 'audio/wav',
      sizeBytes: 2_880_000,
      storageKey: 'spot_30s_v3.wav',
      measuredDurationSec: 30.0,
      engineerNote: 'Заменил подложку на спокойный корпоративный пульс, громкость -14 LUFS',
    },
    '2026-11-14T11:00:00.000Z'
  );

  assert.equal(resolveStudioKanbanColumn(withTake), 'col_producer_qc');
  assert.equal(toClientApprovalWorkflowView(withTake).hasPendingQcTake, true);

  // Продюсер проверяет и публикует клиенту
  const publishedToClient = applyPublishEngineerTakeToClient(
    withTake,
    {
      takeId: 'take-1',
      deliverableId: 'deliv-v3',
      versionCode: 'v3',
    },
    '2026-11-14T11:10:00.000Z'
  );

  assert.equal(publishedToClient.phase, 'spot_client_review');
  assert.equal(publishedToClient.spotRevisions[0]?.status, 'completed');

  // Повторная попытка правки после исчерпания 1 сервисного раунда уходит строго на решение продюсера
  const secondRound = applyClientSpotDecision(
    publishedToClient,
    {
      action: 'request_revision',
      revisionId: 'rev-2',
      kind: 'balance_timecode',
      timecodeSec: 18.0,
      comment: 'Давайте ещё поменяем телефон в конце текста на другой номер.',
    },
    '2026-11-14T11:30:00.000Z'
  );

  assert.equal(secondRound.routedTo, 'producer_escalation');
  assert.equal(secondRound.workflow.phase, 'producer_escalation');
  assert.equal(secondRound.workflow.spotRevisions[0]?.status, 'awaiting_producer');

  // Продюсер в 1 клик решает вопрос лояльно без лишних счетов
  const resolvedByProducer = applyProducerEscalationResolution(
    secondRound.workflow,
    {
      revisionId: 'rev-2',
      mode: 'loyal_included',
      note: 'Допишем концовку лояльно для постоянного клиента',
    },
    '2026-11-14T11:40:00.000Z'
  );

  assert.equal(resolvedByProducer.phase, 'revision_in_progress');
  assert.equal(resolvedByProducer.spotRevisions[0]?.status, 'approved_by_producer');

  // Финальная приёмка ролика клиентом
  const accepted = applyClientSpotDecision(
    resolvedByProducer,
    { action: 'accept', deliverableId: 'deliv-v3' },
    '2026-11-14T12:15:00.000Z'
  );
  assert.equal(accepted.routedTo, 'accepted');
  assert.equal(accepted.workflow.phase, 'accepted');
  assert.equal(resolveWhoseTurn(accepted.workflow).actor, 'completed');
});

test('Точный расчёт длительности WAV и проверка эфирного слота ±0,05 сек', () => {
  const wav20 = buildSyntheticSilentWavBytes(20.0, 8000);
  const parsed20 = parseWavExactDurationSec(wav20);
  assert.equal(parsed20, 20);
  assert.equal(evaluateBroadcastSlotFit(parsed20, 20).status, 'exact');

  const wav2004 = buildSyntheticSilentWavBytes(20.04, 8000);
  const parsed2004 = parseWavExactDurationSec(wav2004);
  assert.equal(evaluateBroadcastSlotFit(parsed2004, 20).status, 'exact');

  const wav2018 = buildSyntheticSilentWavBytes(20.18, 8000);
  const parsed2018 = parseWavExactDurationSec(wav2018);
  assert.equal(evaluateBroadcastSlotFit(parsed2018, 20).status, 'tolerance_warning');

  const wav212 = buildSyntheticSilentWavBytes(21.2, 8000);
  const parsed212 = parseWavExactDurationSec(wav212);
  assert.equal(evaluateBroadcastSlotFit(parsed212, 20).status, 'out_of_slot');

  const est = estimateRussianScriptDurationSec(
    'Седельные тягачи в лизинг с отсрочкой платежа шестьдесят дней и одобрением по ИНН за один день.',
    'АО «ТрансФлот Лизинг». Подробности на сайте.'
  );
  assert.ok(est.wordsCount >= 14);
  assert.ok(est.estimatedSec >= 8 && est.estimatedSec <= 14);
});

test('Однокнопочный токен звукорежиссёра, e-mail грант кнопки «Сдать файл на проверку» и техлист не содержат цен, ИНН клиента и запрещённых слов', () => {
  const secret = 'test-sound-drop-secret-2026';
  const signFn = (msg: string) =>
    crypto.createHmac('sha256', secret).update(msg).digest('base64url').slice(0, 32);

  const nowMs = Date.parse('2026-11-14T12:00:00.000Z');
  const token = issueSoundDropTokenWithSigner(
    {
      orderId: 'crm-seed-prod-2948',
      orderNumber: 'FM-2948',
      engineerId: 'eng-gromov',
      engineerName: 'Илья Громов',
      gen: 2,
      expMs: nowMs + 7 * 24 * 3600 * 1000,
    },
    signFn
  );

  const emailGrant = issueSoundEngineerEmailGrantWithSigner(
    {
      orderId: 'crm-seed-prod-2948',
      orderNumber: 'FM-2948',
      engineerId: 'eng-gromov',
      engineerName: 'Илья Громов',
      gen: 2,
      expMs: nowMs + 7 * 24 * 3600 * 1000,
    },
    signFn
  );

  const verifiedGrant = verifySoundEngineerEmailGrantWithSigner(emailGrant, signFn, nowMs, {
    expectedGeneration: 2,
  });
  assert.equal(verifiedGrant.ok, true);

  const revokedGrant = verifySoundEngineerEmailGrantWithSigner(emailGrant, signFn, nowMs, {
    expectedGeneration: 3,
  });
  assert.deepEqual(revokedGrant, { ok: false, reason: 'revoked' });

  const verified = verifySoundDropTokenWithSigner(token, signFn, nowMs, {
    expectedGeneration: 2,
  });
  assert.equal(verified.ok, true);

  const revoked = verifySoundDropTokenWithSigner(token, signFn, nowMs, {
    expectedGeneration: 3,
  });
  assert.deepEqual(revoked, { ok: false, reason: 'revoked' });

  const expired = verifySoundDropTokenWithSigner(
    token,
    signFn,
    nowMs + 8 * 24 * 3600 * 1000,
    { expectedGeneration: 2 }
  );
  assert.deepEqual(expired, { ok: false, reason: 'expired' });

  const tampered = verifySoundDropTokenWithSigner(`${token}x`, signFn, nowMs);
  assert.deepEqual(tampered, { ok: false, reason: 'bad_signature' });

  const roster = createDefaultSoundEngineerRoster();
  const wf = applyClientScriptDecision(
    createSeedApprovalWorkflowForOrder({
      orderNumber: 'FM-2948',
      createdAt: '2026-11-14T08:00:00.000Z',
      updatedAt: '2026-11-14T09:00:00.000Z',
      stage: 'in_production',
      formatLabel: 'Продакшн под ключ (20 сек) — 25 000 ₽',
      briefText: 'Зимний лизинг тягачей',
    }),
    { action: 'approve' },
    '2026-11-14T12:05:00.000Z'
  );

  const emailActionUrl = `https://fmworks.ru/api/sound-drop/from-email?grant=${encodeURIComponent(emailGrant)}`;
  const sheet = formatSoundEngineerProductionSheet({
    orderNumber: 'FM-2948',
    engineer: roster[0]!,
    workflow: wf,
    briefFallbackText: 'Зимний лизинг тягачей',
    directDropUrl: `https://fmworks.ru/sound-drop?token=${encodeURIComponent(token)}`,
    emailActionUrl,
    previousStageLabel: '03. Счёт и предоплата',
    currentStageLabel: '04. Сценарии и запись',
    triggerSummary: 'Заказ переведён на этап производства ролика',
  });

  assert.equal(sheet.buttonLabel, SOUND_ENGINEER_EMAIL_CTA_LABEL);
  assert.equal(sheet.actionButtonUrl, emailActionUrl);
  assert.equal(sheet.htmlBody.includes(SOUND_ENGINEER_EMAIL_CTA_LABEL), true);
  assert.equal(sheet.htmlBody.includes('/api/sound-drop/from-email?grant='), true);

  const publicDropView = toSoundDropTaskPublicView({
    orderNumber: 'FM-2948',
    engineerId: roster[0]!.id,
    engineerName: roster[0]!.name,
    workflow: wf,
  });

  const combined = `${sheet.subject}\n${sheet.plainBody}\n${sheet.htmlBody}\n${JSON.stringify(publicDropView)}`;
  // Не должно быть ни цены 25 000 ₽, ни ИНН 7702070139, ни телефона клиента!
  assert.equal(combined.includes('25 000'), false);
  assert.equal(combined.includes('7702070139'), false);
  assert.equal(combined.includes('925 310-88-42'), false);
  assert.equal(combined.includes('/api/sound-drop/from-email?grant='), true);

  const lower = combined.toLowerCase();
  for (const banned of BANNED_EDITORIAL_TERMS) {
    assert.equal(
      lower.includes(banned.toLowerCase()),
      false,
      `Обнаружено запрещённое слово «${banned}»`
    );
  }

  // Telegram-техлист звукорежиссёру принудительно маскирует любые ПДн, случайно попавшие в бриф или комментарий клиента
  const dirtySheet = formatSoundEngineerProductionSheet({
    orderNumber: 'FM-2991',
    engineer: roster[0]!,
    workflow: {
      ...wf,
      lockedScript: null,
      scriptVersions: [],
      spotRevisions: [
        {
          id: 'rev-dirty',
          createdAt: '2026-11-14T12:10:00.000Z',
          kind: 'balance_timecode',
          timecodeSec: 5.0,
          comment: 'Позвоните мне на +7 916 555-22-11 или @client_tg, ИНН 7707083893',
          usedIncludedServiceRound: true,
          status: 'sent_to_engineer',
        },
      ],
    },
    briefFallbackText: 'Пишите на lead@brand.ru или +7 (904) 000-09-11',
    directDropUrl: `https://fmworks.ru/sound-drop?token=${encodeURIComponent(token)}`,
  });
  assert.equal(dirtySheet.telegramMessage.includes('+7 916 555-22-11'), false);
  assert.equal(dirtySheet.telegramMessage.includes('@client_tg'), false);
  assert.equal(dirtySheet.telegramMessage.includes('7707083893'), false);
  assert.equal(dirtySheet.telegramMessage.includes('lead@brand.ru'), false);
  assert.equal(dirtySheet.telegramMessage.includes('904'), false);
  assert.ok(dirtySheet.telegramMessage.includes('152-ФЗ'));
});

test('Оперативный возврат на доработку продюсером: отклонение дубля в буфере ОТК, прямая доработка звука и возврат сценария в черновик', () => {
  const seed = createSeedApprovalWorkflowForOrder({
    orderNumber: 'FM-2926',
    createdAt: '2026-11-18T08:00:00.000Z',
    updatedAt: '2026-11-18T09:00:00.000Z',
    stage: 'in_production',
    formatLabel: 'Игровой ролик (30 сек) — 35 000 ₽',
    briefText: 'Лизинг рефрижераторов',
    deliverables: [{ id: 'deliv-v2', versionCode: 'v2', versionStage: 'revision' }],
  });

  // 1. Звукорежиссёр загружает дубль с превышением слота (30,65 с вместо 30,00 с)
  const withTake = applyRecordEngineerTake(
    seed,
    {
      id: 'take-out-of-slot',
      engineerId: 'eng-vetrov',
      engineerName: 'Павел Ветров',
      fileName: 'spot_30s_draft.wav',
      mimeType: 'audio/wav',
      sizeBytes: 2_900_000,
      storageKey: 'spot_30s_draft.wav',
      measuredDurationSec: 30.65,
      engineerNote: 'Черновой микс с хвостом реверберации',
    },
    '2026-11-18T10:00:00.000Z'
  );

  assert.equal(resolveStudioKanbanColumn(withTake), 'col_producer_qc');
  assert.equal(resolveWhoseTurn(withTake).actor, 'producer');

  // 2. Продюсер на ОТК отклоняет дубль и возвращает звукорежиссёру на доработку
  const rejectedOnQc = applyRejectEngineerTakeForRework(
    withTake,
    {
      takeId: 'take-out-of-slot',
      revisionId: 'rev-qc-1',
      note: 'Подрезать хвост строго под слот 30,00 с (±0,05 с) и сделать музыку тише на 14 с.',
      kind: 'balance_timecode',
      timecodeSec: 14,
    },
    '2026-11-18T10:05:00.000Z'
  );

  assert.equal(rejectedOnQc.phase, 'revision_in_progress');
  assert.equal(rejectedOnQc.pendingEngineerTakes[0]?.status, 'rejected_qc');
  assert.equal(
    rejectedOnQc.pendingEngineerTakes[0]?.rejectedReason,
    'Подрезать хвост строго под слот 30,00 с (±0,05 с) и сделать музыку тише на 14 с.'
  );
  assert.equal(rejectedOnQc.spotRevisions[0]?.status, 'sent_to_engineer');
  assert.equal(resolveStudioKanbanColumn(rejectedOnQc), 'col_with_engineer');
  assert.equal(resolveWhoseTurn(rejectedOnQc).actor, 'sound_engineer');

  // 3. Продюсер может в любой момент поставить прямую задачу звукорежиссёру по звонку клиента
  const directRevision = applyProducerDirectSpotRevision(
    seed,
    {
      revisionId: 'rev-prod-direct',
      kind: 'music_replacement',
      timecodeSec: 6.5,
      comment: 'Клиент по телефону попросил заменить подложку на более спокойный темп.',
    },
    '2026-11-18T11:00:00.000Z'
  );

  assert.equal(directRevision.phase, 'revision_in_progress');
  assert.equal(directRevision.spotRevisions[0]?.status, 'sent_to_engineer');
  assert.equal(directRevision.spotRevisions[0]?.kind, 'music_replacement');
  assert.equal(resolveStudioKanbanColumn(directRevision), 'col_with_engineer');

  // 4. Продюсер возвращает утверждённый сценарий на корректировку текста
  const reopenedScript = applyProducerReopenScriptForRework(
    directRevision,
    {
      reason: 'Обновляем условия акции в финале текста по просьбе коммерческого директора',
    },
    '2026-11-18T11:15:00.000Z'
  );

  assert.equal(reopenedScript.phase, 'script_drafting');
  assert.equal(reopenedScript.lockedScript, null);
  assert.equal(resolveStudioKanbanColumn(reopenedScript), 'col_script');
  assert.equal(resolveWhoseTurn(reopenedScript).actor, 'producer');
  assert.equal(
    reopenedScript.scriptVersions[0]?.clientComment,
    'Обновляем условия акции в финале текста по просьбе коммерческого директора'
  );
});

test('Фильтрация очереди цеха озвучки по ответственному («Ваш ход», «У звукорежиссёра», «Ждём клиента») и поисковому запросу', () => {
  const orderProducerTurn = {
    orderNumber: 'FM-HOLD-2914',
    companyOrInn: 'ООО «Квартал Инвест» · ИНН 7707083893',
    contact: '+7 916 740-28-19',
    briefText: 'Старт продаж видовых квартир',
    formatLabel: 'Голос и стиль (15 сек)',
    approvalWorkflow: createSeedApprovalWorkflowForOrder({
      orderNumber: 'FM-HOLD-2914',
      createdAt: '2026-11-18T08:00:00.000Z',
      updatedAt: '2026-11-18T08:00:00.000Z',
      stage: 'new_hold',
      formatLabel: 'Голос и стиль (15 сек)',
      briefText: 'Старт продаж видовых квартир',
    }),
  };

  const orderClientTurn = {
    orderNumber: 'FM-2948',
    companyOrInn: 'АО «ТрансФлот Лизинг» · ИНН 7702070139',
    contact: '+7 925 310-88-42',
    briefText: 'Лизинг тягачей',
    formatLabel: 'Продакшн под ключ (20 сек)',
    approvalWorkflow: createSeedApprovalWorkflowForOrder({
      orderNumber: 'FM-2948',
      createdAt: '2026-11-18T08:00:00.000Z',
      updatedAt: '2026-11-18T08:00:00.000Z',
      stage: 'in_production',
      formatLabel: 'Продакшн под ключ (20 сек)',
      briefText: 'Лизинг тягачей',
    }),
  };

  const orderEngineerTurn = {
    orderNumber: 'FM-2926',
    companyOrInn: 'АО «ТрансФлот Лизинг» · ИНН 7702070139',
    contact: '+7 925 310-88-42',
    briefText: 'Рефрижераторы в лизинг',
    formatLabel: 'Игровой ролик (30 сек)',
    approvalWorkflow: applyProducerDirectSpotRevision(
      createSeedApprovalWorkflowForOrder({
        orderNumber: 'FM-2926',
        createdAt: '2026-11-18T08:00:00.000Z',
        updatedAt: '2026-11-18T08:00:00.000Z',
        stage: 'in_production',
        formatLabel: 'Игровой ролик (30 сек)',
        briefText: 'Рефрижераторы в лизинг',
      }),
      {
        revisionId: 'rev-test',
        comment: 'Прибрать музыку на 12 с',
      },
      '2026-11-18T09:00:00.000Z'
    ),
  };

  const queue = [orderProducerTurn, orderClientTurn, orderEngineerTurn];

  const onlyProducer = filterProductionOrdersForStudioQueue(queue, {
    columnFilter: 'all',
    turnFilter: 'producer_turn',
  });
  assert.deepEqual(
    onlyProducer.map((o) => o.orderNumber),
    ['FM-HOLD-2914']
  );

  const onlyEngineer = filterProductionOrdersForStudioQueue(queue, {
    columnFilter: 'all',
    turnFilter: 'engineer_turn',
  });
  assert.deepEqual(
    onlyEngineer.map((o) => o.orderNumber),
    ['FM-2926']
  );

  const onlyClient = filterProductionOrdersForStudioQueue(queue, {
    columnFilter: 'all',
    turnFilter: 'client_turn',
  });
  assert.deepEqual(
    onlyClient.map((o) => o.orderNumber),
    ['FM-2948']
  );

  const bySearch = filterProductionOrdersForStudioQueue(queue, {
    columnFilter: 'all',
    turnFilter: 'all',
    searchQuery: 'Квартал Инвест',
  });
  assert.deepEqual(
    bySearch.map((o) => o.orderNumber),
    ['FM-HOLD-2914']
  );
});

test('Контроль SLA просрочки, фильтр sla_overdue, быстрые ссылки и пресеты возврата (P2)', () => {
  const nowMs = Date.parse('2026-11-18T20:00:00.000Z');

  // Заказ, который ждёт продюсера 30 часов (> 24 ч -> overdue)
  const overdueProducerOrder = {
    orderNumber: 'FM-SLA-OVERDUE',
    createdAt: '2026-11-17T10:00:00.000Z',
    updatedAt: '2026-11-17T14:00:00.000Z',
    approvalWorkflow: createSeedApprovalWorkflowForOrder({
      orderNumber: 'FM-SLA-OVERDUE',
      createdAt: '2026-11-17T10:00:00.000Z',
      updatedAt: '2026-11-17T14:00:00.000Z',
      stage: 'new_hold',
      formatLabel: 'Голос и стиль (15 сек)',
      briefText: 'Срочная акция',
    }),
  };

  // Заказ, обновлённый 4 часа назад (ok)
  const freshOrder = {
    orderNumber: 'FM-SLA-FRESH',
    createdAt: '2026-11-18T15:00:00.000Z',
    updatedAt: '2026-11-18T16:00:00.000Z',
    approvalWorkflow: createSeedApprovalWorkflowForOrder({
      orderNumber: 'FM-SLA-FRESH',
      createdAt: '2026-11-18T15:00:00.000Z',
      updatedAt: '2026-11-18T16:00:00.000Z',
      stage: 'new_hold',
      formatLabel: 'Голос и стиль (15 сек)',
      briefText: 'Свежая заявка',
    }),
  };

  // Заказ, принятый клиентом давно — никогда не считается просроченным
  const acceptedOldOrder = {
    orderNumber: 'FM-SLA-DONE',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z',
    approvalWorkflow: createSeedApprovalWorkflowForOrder({
      orderNumber: 'FM-SLA-DONE',
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T12:00:00.000Z',
      stage: 'completed_ltv',
      formatLabel: 'Голос и стиль (15 сек)',
      briefText: 'Закрытый заказ',
    }),
  };

  const overdueEval = evaluateOrderProductionSlaStatus(overdueProducerOrder, nowMs);
  assert.equal(overdueEval.level, 'overdue');
  assert.equal(overdueEval.isOverdue, true);
  assert.equal(overdueEval.elapsedHours, 30);

  const freshEval = evaluateOrderProductionSlaStatus(freshOrder, nowMs);
  assert.equal(freshEval.level, 'ok');
  assert.equal(freshEval.isOverdue, false);

  const doneEval = evaluateOrderProductionSlaStatus(acceptedOldOrder, nowMs);
  assert.equal(doneEval.level, 'completed');
  assert.equal(doneEval.isOverdue, false);

  const overdueOnly = filterProductionOrdersForStudioQueue(
    [overdueProducerOrder, freshOrder, acceptedOldOrder],
    {
      columnFilter: 'all',
      turnFilter: 'sla_overdue',
      nowMs,
    }
  );
  assert.deepEqual(
    overdueOnly.map((o) => o.orderNumber),
    ['FM-SLA-OVERDUE']
  );

  // Быстрые ссылки из цеха
  const linksWithEmailAction = buildStudioQuickShareLinks({
    origin: 'https://fmworks.ru/',
    latestEngineerEmailActionPath: '/api/sound-drop/from-email?grant=abc123',
  });
  assert.equal(linksWithEmailAction.clientCabinetUrl, 'https://fmworks.ru/cabinet');
  assert.equal(
    linksWithEmailAction.engineerDropUrl,
    'https://fmworks.ru/api/sound-drop/from-email?grant=abc123'
  );

  const linksWithoutEngineer = buildStudioQuickShareLinks({
    origin: 'https://fmworks.ru',
  });
  assert.equal(linksWithoutEngineer.clientCabinetUrl, 'https://fmworks.ru/cabinet');
  assert.equal(linksWithoutEngineer.engineerDropUrl, null);

  // Пресеты причин возврата не пусты
  assert.ok(STUDIO_REWORK_REASON_PRESETS.length >= 4);
  assert.ok(CRM_STAGE_RETURN_NOTE_PRESETS.length >= 3);
});



