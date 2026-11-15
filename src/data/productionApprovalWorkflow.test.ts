import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  applyClientScriptDecision,
  applyClientSpotDecision,
  applyProducerEscalationResolution,
  applyPublishEngineerTakeToClient,
  applyPublishScriptDraft,
  applyRecordEngineerTake,
  buildSyntheticSilentWavBytes,
  createDefaultSoundEngineerRoster,
  createSeedApprovalWorkflowForOrder,
  estimateRussianScriptDurationSec,
  evaluateBroadcastSlotFit,
  formatSoundEngineerProductionSheet,
  issueSoundDropTokenWithSigner,
  issueSoundEngineerEmailGrantWithSigner,
  parseWavExactDurationSec,
  resolveExternalClientStep,
  resolveStudioKanbanColumn,
  resolveWhoseTurn,
  SOUND_ENGINEER_EMAIL_CTA_LABEL,
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
});
