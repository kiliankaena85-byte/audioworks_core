import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultStudioLegalProfiles } from '../data/studioDocumentsCore';
import {
  buildRknOperatorAct,
  renderRknOperatorActPrintableHtml,
} from './rknOperatorActsBuilder';

test('buildRknOperatorAct generates all 3 mandatory 152-FZ documents for OOO and IP', () => {
  const profiles = createDefaultStudioLegalProfiles();

  const rknNotice = buildRknOperatorAct({
    kind: 'rkn_notification_draft',
    legalProfiles: profiles,
    entityOverride: 'ooo',
    nowIso: '2026-11-16T12:00:00.000Z',
  });
  assert.ok(rknNotice.officialTitle.includes('РОСКОМНАДЗОРА'));
  const htmlNotice = renderRknOperatorActPrintableHtml(rknNotice);
  assert.ok(htmlNotice.includes('НЕ ОСУЩЕСТВЛЯЕТСЯ'));
  assert.ok(htmlNotice.includes('ОГРН'));

  const dpoOrderIp = buildRknOperatorAct({
    kind: 'dpo_appointment_order',
    legalProfiles: profiles,
    entityOverride: 'ip',
    nowIso: '2026-11-16T12:00:00.000Z',
  });
  assert.ok(dpoOrderIp.officialTitle.includes('РАСПОРЯЖЕНИЕ'));
  assert.equal(dpoOrderIp.operatorOgrnLabel, 'ОГРНИП');

  const destructionAct = buildRknOperatorAct({
    kind: 'pdn_destruction_act',
    legalProfiles: profiles,
    destructionContext: {
      orderNumber: 'FM-261116-901',
      anonymizedAtIso: '2026-11-16T14:30:00.000Z',
      operatorActorLabel: 'producer@fmworks.ru',
    },
  });
  assert.ok(destructionAct.officialTitle.includes('FM-261116-901'));
  const htmlAct = renderRknOperatorActPrintableHtml(destructionAct);
  assert.ok(htmlAct.includes('Приказа Роскомнадзора от 28.10.2022 № 179'));
  assert.ok(htmlAct.includes('order_pdn_anonymized'));
});
