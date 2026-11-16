import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { containsDirectPersonalData } from '../security/rfLegalCompliance';
import {
  createZeroPdnSharedProposalRecord,
  sanitizeCorporateTitleForZeroPdnShare,
  verifySharedProposalRecordToken,
} from './b2bSharedProposalCore';

const signTestHmac = (msg: string) =>
  createHmac('sha256', 'test-kp-secret-key').update(msg).digest('hex');

test('createZeroPdnSharedProposalRecord scrubs all personal data (phone, email, @tg, INN, FIO) per 152-FZ', () => {
  const record = createZeroPdnSharedProposalRecord({
    input: {
      selectedFormatId: 'turnkey',
      spotDurationSec: 20,
      selectedVoiceId: 'federal_baritone',
      industrySlug: 'real-estate',
      briefText:
        'Ролик для ЖК Сосны. Позвоните менеджеру Анне +7 (916) 555-32-10, почта anna.ivanova@mail.ru или @anna_dev, ИНН 7707083893',
      companyName: 'ИП Иванов Иван Иванович +79165553210',
    },
    shareIdHex: '1a2b3c4d5e6f77889900',
    signHmacHex: signTestHmac,
    nowMs: Date.parse('2026-11-16T10:00:00.000Z'),
  });

  // Ни телефон, ни email, ни @telegram, ни ФИО ИП не должны попасть в публичную запись КП
  assert.equal(containsDirectPersonalData(record.scrubbedTaskSummary), false);
  assert.equal(record.scrubbedTaskSummary.includes('555-32-10'), false);
  assert.equal(record.scrubbedTaskSummary.includes('anna.ivanova@mail.ru'), false);
  assert.equal(record.scrubbedTaskSummary.includes('@anna_dev'), false);
  assert.equal(record.corporateEntityHint, '');
  assert.equal(record.selectedVoiceId, 'federal_baritone');
  assert.ok(record.selectedVoiceLabel?.includes('баритон'));

  // Корпоративное юрлицо ООО сохраняется без ПДн
  assert.equal(
    sanitizeCorporateTitleForZeroPdnShare('ООО «Север Девелопмент» +7 999 111-22-33'),
    'ООО «Север Девелопмент»'
  );
});

test('verifySharedProposalRecordToken validates HMAC signature and expiration', () => {
  const nowMs = Date.parse('2026-11-16T10:00:00.000Z');
  const record = createZeroPdnSharedProposalRecord({
    input: { selectedFormatId: 'cinema', spotDurationSec: 30 },
    shareIdHex: 'abcdef0123456789abcd',
    signHmacHex: signTestHmac,
    nowMs,
  });

  const valid = verifySharedProposalRecordToken({
    rawToken: record.token,
    record,
    signHmacHex: signTestHmac,
    nowMs: nowMs + 3600_000,
  });
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.view.totalPayableRub, 35000);
    assert.equal('token' in valid.view, false);
  }

  const tampered = verifySharedProposalRecordToken({
    rawToken: `${record.shareId}.000000000000000000000000`,
    record,
    signHmacHex: signTestHmac,
    nowMs: nowMs + 3600_000,
  });
  assert.equal(tampered.ok, false);
  if (!tampered.ok) {
    assert.equal(tampered.reason, 'bad_signature');
  }

  const expired = verifySharedProposalRecordToken({
    rawToken: record.token,
    record,
    signHmacHex: signTestHmac,
    nowMs: nowMs + 15 * 24 * 3600 * 1000,
  });
  assert.equal(expired.ok, false);
  if (!expired.ok) {
    assert.equal(expired.reason, 'expired');
  }
});
