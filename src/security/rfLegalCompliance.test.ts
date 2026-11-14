import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkBannedForeignServiceUrl,
  containsDirectPersonalData,
  evaluateWebhookEndpointRfSafety,
  maskContactChannelSummary,
  RF_COMPLIANCE_PASSPORT_ITEMS,
  scrubPersonalDataFromText,
} from './rfLegalCompliance.ts';

test('checkBannedForeignServiceUrl блокирует сервисы Google, заблокированные соцсети и зарубежные CDN', () => {
  const ga = checkBannedForeignServiceUrl('https://www.google-analytics.com/analytics.js');
  assert.equal(ga.matched, true);
  assert.equal(ga.category, 'google_banned_or_restricted');

  const gfonts = checkBannedForeignServiceUrl('https://fonts.googleapis.com/css2?family=Manrope');
  assert.equal(gfonts.matched, true);
  assert.equal(gfonts.category, 'google_banned_or_restricted');

  const recaptcha = checkBannedForeignServiceUrl('https://www.recaptcha.net/recaptcha/api.js');
  assert.equal(recaptcha.matched, true);
  assert.equal(recaptcha.category, 'google_banned_or_restricted');

  const geminiApi = checkBannedForeignServiceUrl('https://generativelanguage.googleapis.com/v1');
  assert.equal(geminiApi.matched, true);

  const unsplash = checkBannedForeignServiceUrl('https://images.unsplash.com/photo-123');
  assert.equal(unsplash.matched, true);
  assert.equal(unsplash.category, 'foreign_cdn_or_media');

  const twitter = checkBannedForeignServiceUrl('https://twitter.com/intent/tweet');
  assert.equal(twitter.matched, true);
  assert.equal(twitter.category, 'foreign_social_blocked');

  const localAsset = checkBannedForeignServiceUrl('/src/assets/images/hero_studio_editorial_1794399404984.jpg');
  assert.equal(localAsset.matched, false);

  const ruSite = checkBannedForeignServiceUrl('https://crm.company.ru/webhooks/fmworks');
  assert.equal(ruSite.matched, false);
});

test('evaluateWebhookEndpointRfSafety различает российский контур (.ru / localhost), зарубежные хосты и запрещённые домены', () => {
  const ruCrm = evaluateWebhookEndpointRfSafety('https://my.bitrix24.ru/rest/123');
  assert.equal(ruCrm.isValidUrl, true);
  assert.equal(ruCrm.isBannedForeignService, false);
  assert.equal(ruCrm.isRfContourRecommended, true);
  assert.equal(ruCrm.warning, null);

  const loopback = evaluateWebhookEndpointRfSafety('http://localhost:3000/api/webhooks/loopback-crm-sink');
  assert.equal(loopback.isRfContourRecommended, true);
  assert.equal(loopback.warning, null);

  const foreignWebhook = evaluateWebhookEndpointRfSafety('https://hook.eu2.make.com/abc');
  assert.equal(foreignWebhook.isBannedForeignService, false);
  assert.equal(foreignWebhook.isRfContourRecommended, false);
  assert.ok(foreignWebhook.warning && foreignWebhook.warning.includes('152-ФЗ'));

  const bannedWebhook = evaluateWebhookEndpointRfSafety('https://script.google.com/macros/s/abc');
  assert.equal(bannedWebhook.isRfContourRecommended, false);
});

test('scrubPersonalDataFromText и containsDirectPersonalData маскируют телефон, email, @telegram и ИНН', () => {
  const raw = 'Иван +7 (905) 123-45-67, почта ivan@company.ru, @ivan_studio, ИНН 6950241890';
  assert.equal(containsDirectPersonalData(raw), true);

  const scrubbed = scrubPersonalDataFromText(raw);
  assert.equal(scrubbed.includes('905'), false);
  assert.equal(scrubbed.includes('ivan@company.ru'), false);
  assert.equal(scrubbed.includes('@ivan_studio'), false);
  assert.equal(scrubbed.includes('6950241890'), false);
  assert.ok(scrubbed.includes('152-ФЗ'));

  assert.equal(containsDirectPersonalData('Ролик 20 секунд под ключ для стоматологии в Твери'), false);
  assert.ok(maskContactChannelSummary('phone').includes('152-ФЗ'));
  assert.ok(RF_COMPLIANCE_PASSPORT_ITEMS.length >= 5);
});
