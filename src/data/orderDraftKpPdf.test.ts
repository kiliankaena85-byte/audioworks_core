import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCommercialProposalFromDraft,
  buildValidPdfDocumentBytes,
  encodePdfUtf16BeHex,
  generateCommercialProposalPdfFromDraft,
} from './orderDraftKpPdf';
import { type OrderDraftSnapshot, orderDraftStore } from './orderDraftStore';
import { BANNED_EDITORIAL_TERMS } from './studioCmsTypes';

function createBaseDraft(overrides: Partial<OrderDraftSnapshot> = {}): OrderDraftSnapshot {
  const base = orderDraftStore.getSnapshot();
  return {
    ...base,
    mode: 'production_only',
    selectedFormat: 'turnkey',
    spotDurationSec: 20,
    industryPreset: 'real-estate',
    briefText: 'Аудиоролик для дилерского центра в Твери: тест-драйв кроссоверов, динамичная подача.',
    contactLine: 'Алексей Смирнов, +7 920 155-44-22',
    preferredDeliveryChannel: 'email',
    deliveryEmail: 'marketing@auto-tver.ru',
    companyName: 'ООО «Тверь Авто Холдинг»',
    companyInn: '6950123456',
    companyLine: 'ООО «Тверь Авто Холдинг» (ИНН 6950123456)',
    paymentChannel: 'edo_invoice',
    wantsInvoiceNow: true,
    mediaReservation: null,
    confirmedReservation: null,
    ...overrides,
  };
}

test('buildCommercialProposalFromDraft builds structured KP spec for turnkey production draft', () => {
  const draft = createBaseDraft();
  const kp = buildCommercialProposalFromDraft(draft, {
    nowIso: '2026-11-15T10:00:00.000Z',
  });

  assert.equal(kp.selectedFormatId, 'turnkey');
  assert.equal(kp.spotDurationSec, 20);
  assert.equal(kp.totalPayableRub, 25000);
  assert.equal(kp.isNegotiable, false);
  assert.equal(
    kp.paymentTermsLabel,
    '100% предоплата по договору или банковской картой'
  );
  assert.ok(kp.customerDisplayName.includes('Тверь Авто Холдинг'));
  assert.equal(kp.customerInn, '6950123456');
  assert.ok(kp.lineItems.length >= 2, 'Turnkey KP should include main production + Broadcast Passport');
  assert.equal(kp.lineItems[0].amountRub, 25000);
  assert.ok(kp.suggestedFileName.endsWith('.pdf'));
  assert.ok(kp.suggestedFileName.includes('FMWorks-KP-turnkey-20s-20261115.pdf'));
});

test('buildCommercialProposalFromDraft includes 15s resize deliverable for cinema package and handles custom_consult', () => {
  const cinemaDraft = createBaseDraft({
    selectedFormat: 'cinema',
    spotDurationSec: 30,
  });
  const cinemaKp = buildCommercialProposalFromDraft(cinemaDraft, {
    nowIso: '2026-11-15T10:00:00.000Z',
  });

  assert.equal(cinemaKp.totalPayableRub, 35000);
  assert.ok(cinemaKp.lineItems.length >= 3);
  assert.ok(
    cinemaKp.includedDeliverables.some((item) => item.includes('15 сек')),
    'Cinema package must include 15s эфирный ресайз in includedDeliverables'
  );

  const consultDraft = createBaseDraft({
    selectedFormat: 'custom_consult',
    spotDurationSec: 25,
  });
  const consultKp = buildCommercialProposalFromDraft(consultDraft, {
    nowIso: '2026-11-15T10:00:00.000Z',
  });

  assert.equal(consultKp.isNegotiable, true);
  assert.equal(consultKp.totalPayableRub, 0);
  assert.equal(consultKp.totalPayableFormatted, 'Договорная цена (по оценке ТЗ)');
});

test('buildCommercialProposalFromDraft builds unified air + production KP when mediaReservation is active', () => {
  const airDraft = createBaseDraft({
    mode: 'air_plus_production',
    mediaReservation: {
      createdAtMs: 1763200000000,
      initialCountdownSeconds: 14399,
      nicheId: 'auto_services',
      nicheLabel: 'Автодилеры и сервис',
      productNote: 'Кроссоверы в наличии',
      durationPref: '30',
      spotDurationSec: 20,
      targetAudienceSummary: 'Мужчины и женщины 25–54 за рулём',
      targetAudienceSharePct: 68,
      officialAirTotal: 76000,
      hotAirTotal: 57000,
      airDiscountPercent: 25,
      totalSpots: 40,
      totalReachOTS: 120000,
      isBonusProductionUnlocked: false,
      initialProductionSelection: 'turnkey',
      initialRecommendedTier: 'turnkey',
      aiRationale: 'Утренний и вечерний драйв',
      stations: [
        {
          slotId: 'slot-1',
          station: 'Пилот Радио',
          frequencyFm: '102.7 FM',
          daypart: 'Утренний прайм 07:30–10:30',
          daysPattern: 'Пн–Пт',
          sampleTimeSlots: ['08:15', '09:15'],
          spotsIncluded: 20,
          maxDuration: 30,
          exactDurationSec: 20,
          officialPrice: 40000,
          hotPrice: 30000,
          discountPercent: 25,
          reachOTS: 65000,
          packageMultiplier: 1,
        },
        {
          slotId: 'slot-2',
          station: 'Авторадио',
          frequencyFm: '90.3 FM',
          daypart: 'Вечерний драйв 17:30–20:30',
          daysPattern: 'Пн–Пт',
          sampleTimeSlots: ['18:20', '19:10'],
          spotsIncluded: 20,
          maxDuration: 30,
          exactDurationSec: 20,
          officialPrice: 36000,
          hotPrice: 27000,
          discountPercent: 25,
          reachOTS: 55000,
          packageMultiplier: 1,
        },
      ],
    },
    reservationProdSelection: 'turnkey',
  });

  const airKp = buildCommercialProposalFromDraft(airDraft, {
    nowIso: '2026-11-15T10:00:00.000Z',
  });

  assert.equal(airKp.checkoutMode, 'air_plus_production');
  assert.equal(airKp.totalPayableRub, 57000 + 25000);
  assert.equal(airKp.lineItems.length, 3, 'Should contain 2 radio stations + production spot');
});

test('generateCommercialProposalPdfFromDraft produces valid %PDF-1.4 binary with xref and %%EOF and zero banned terms', () => {
  const draft = createBaseDraft();
  const result = generateCommercialProposalPdfFromDraft(draft, {
    nowIso: '2026-11-15T10:00:00.000Z',
  });

  assert.equal(result.mimeType, 'application/pdf');
  assert.ok(result.pdfBytes.byteLength > 500, 'PDF binary must be non-trivial');

  const asciiText = new TextDecoder('latin1').decode(result.pdfBytes);
  assert.ok(asciiText.startsWith('%PDF-1.4\n'), 'PDF must start with %PDF-1.4 header');
  assert.ok(asciiText.includes('/Type /Catalog'), 'PDF must include /Type /Catalog');
  assert.ok(asciiText.includes('/Type /Page'), 'PDF must include /Type /Page');
  assert.ok(asciiText.includes('xref\n'), 'PDF must include xref table');
  assert.ok(asciiText.trimEnd().endsWith('%%EOF'), 'PDF must end with %%EOF');

  // Verify UTF-16BE hex encoding helper for Cyrillic metadata
  const hexSample = encodePdfUtf16BeHex('КП FMWorks');
  assert.ok(hexSample.startsWith('<FEFF'), 'UTF-16BE Hex string must start with <FEFF BOM');

  // Verify direct byte builder with embedded JPEG stream
  const dummyJpeg = {
    jpegBytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]),
    widthPx: 1240,
    heightPx: 1754,
  };
  const jpegPdfBytes = buildValidPdfDocumentBytes(result.proposal, dummyJpeg);
  const jpegPdfAscii = new TextDecoder('latin1').decode(jpegPdfBytes);
  assert.ok(jpegPdfAscii.includes('/Filter /DCTDecode'));
  assert.ok(jpegPdfAscii.includes('/Subtype /Image'));

  // Editorial guardrail check: no banned slang or terms in any proposal field
  const serializedProposal = JSON.stringify(result.proposal).toLowerCase();
  for (const banned of BANNED_EDITORIAL_TERMS) {
    assert.equal(
      serializedProposal.includes(banned.toLowerCase()),
      false,
      `Proposal must not contain banned term "${banned}"`
    );
  }
  assert.equal(
    serializedProposal.includes('рамочн'),
    false,
    'Proposal must not contain deprecated phrase "рамочный договор"'
  );
});
