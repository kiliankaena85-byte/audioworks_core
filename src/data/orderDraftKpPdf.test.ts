import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCommercialProposalFromDraft,
  buildValidPdfDocumentBytes,
  computeProposalA4Layout,
  encodePdfUtf16BeHex,
  generateCommercialProposalPdfFromDraft,
  type ProposalA4PagePlan,
} from './orderDraftKpPdf';
import { type OrderDraftSnapshot, orderDraftStore } from './orderDraftStore';
import { BANNED_EDITORIAL_TERMS } from './studioCmsTypes';
import { createDefaultStudioLegalProfiles } from './studioDocumentsCore';

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

function assertZeroLayoutOverlapsAndBounds(
  pages: readonly ProposalA4PagePlan[],
  scenarioLabel: string
) {
  assert.ok(pages.length >= 1, `${scenarioLabel}: must produce at least 1 A4 page`);
  for (const page of pages) {
    assert.ok(
      page.maxContentBottomY <= page.contentBottomLimit,
      `${scenarioLabel} (p.${page.pageNumber}): content bottom ${page.maxContentBottomY}px exceeded footer safe limit ${page.contentBottomLimit}px`
    );

    // Every text bounding box must stay strictly inside horizontal margins [56..1184] and page height
    for (const t of page.texts) {
      assert.ok(
        t.bbox.x >= 50 && t.bbox.x + t.bbox.width <= page.widthPx - 50,
        `${scenarioLabel} (p.${page.pageNumber}): text "${t.id}" ("${t.text}") overflows horizontal A4 bounds: x=${t.bbox.x}, w=${t.bbox.width}`
      );
      assert.ok(
        t.bbox.y >= 40 && t.bbox.y + t.bbox.height <= page.heightPx - 16,
        `${scenarioLabel} (p.${page.pageNumber}): text "${t.id}" overflows vertical A4 bounds`
      );
    }

    // Check pairwise text bounding box collisions (allowing 1.5px subpixel tolerance)
    for (let i = 0; i < page.texts.length; i++) {
      for (let j = i + 1; j < page.texts.length; j++) {
        const a = page.texts[i];
        const b = page.texts[j];
        const overlapX =
          Math.min(a.bbox.x + a.bbox.width, b.bbox.x + b.bbox.width) -
          Math.max(a.bbox.x, b.bbox.x);
        const overlapY =
          Math.min(a.bbox.y + a.bbox.height, b.bbox.y + b.bbox.height) -
          Math.max(a.bbox.y, b.bbox.y);
        assert.ok(
          overlapX <= 1.5 || overlapY <= 1.5,
          `${scenarioLabel} (p.${page.pageNumber}): text collision between "${a.id}" ("${a.text}") and "${b.id}" ("${b.text}") — overlap ${overlapX.toFixed(1)}x${overlapY.toFixed(1)}px`
        );
      }
    }
  }
}

test('buildCommercialProposalFromDraft builds structured KP spec for turnkey production draft without duplicating package price', () => {
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
  assert.ok(kp.lineItems.length >= 2, 'Turnkey KP should include stages + Broadcast Passport');

  const sumLineAmounts = kp.lineItems.reduce((sum, item) => sum + item.amountRub, 0);
  assert.equal(sumLineAmounts, 25000, 'Sum of line item amounts must equal package total (no double pricing)');
  const pricedRows = kp.lineItems.filter((item) => item.amountRub > 0);
  assert.equal(pricedRows.length, 1, 'Exactly one row carries the unified package amount');

  assert.ok(kp.suggestedFileName.endsWith('.pdf'));
  assert.ok(kp.suggestedFileName.includes('FMWorks-KP-turnkey-20s-20261115.pdf'));
});

test('buildCommercialProposalFromDraft handles custom_consult, 15s resize edge cases, and messenger deduplication', () => {
  const cinema30Draft = createBaseDraft({
    selectedFormat: 'cinema',
    spotDurationSec: 30,
  });
  const cinema30Kp = buildCommercialProposalFromDraft(cinema30Draft, {
    nowIso: '2026-11-15T10:00:00.000Z',
  });
  assert.equal(cinema30Kp.totalPayableRub, 35000);
  assert.ok(
    cinema30Kp.includedDeliverables.some((item) => item.includes('ресайз 15 сек')),
    '30s Cinema package must include 15s эфирный ресайз'
  );

  // Boundary case: 12s Cinema spot should NOT promise a "15s short resize" longer than the main spot
  const cinema12Kp = buildCommercialProposalFromDraft(
    createBaseDraft({ selectedFormat: 'cinema', spotDurationSec: 12 }),
    { nowIso: '2026-11-15T10:00:00.000Z' }
  );
  assert.equal(
    cinema12Kp.includedDeliverables.some((item) => item.includes('ресайз 15 сек')),
    false
  );
  assert.ok(cinema12Kp.includedDeliverables.some((item) => item.includes('5–10 сек')));

  // Exact screenshot state: custom_consult + 15s + empty draft + messenger='other' with blank custom input
  const consultEmptyDraft = createBaseDraft({
    selectedFormat: 'custom_consult',
    spotDurationSec: 15,
    industryPreset: null,
    briefText: '',
    contactLine: '',
    companyName: '',
    companyInn: '',
    companyLine: '',
    preferredDeliveryChannel: 'messenger',
    deliveryMessenger: 'other',
    deliveryMessengerOther: '',
    paymentChannel: 'edo_invoice',
  });
  const consultKp = buildCommercialProposalFromDraft(consultEmptyDraft, {
    nowIso: '2026-11-16T10:00:00.000Z',
  });

  assert.equal(consultKp.isNegotiable, true);
  assert.equal(consultKp.totalPayableRub, 0);
  assert.equal(consultKp.totalPayableFormatted, 'Договорная цена (по оценке ТЗ)');
  assert.equal(
    consultKp.totalInWordsRu.toLowerCase().includes('ноль рублей'),
    false,
    'Negotiable KP must never output "Ноль рублей 00 копеек"'
  );
  assert.equal(
    consultKp.deliveryChannelLabel,
    'Мессенджер',
    'Messenger with empty "other" detail must not duplicate "Мессенджер · Мессенджер"'
  );
  assert.equal(
    consultKp.includedDeliverables.some((item) => item.includes('ресайз 15 сек')),
    false,
    'Unpriced custom_consult 15s draft must not promise a 15s resize'
  );
  assert.equal(consultKp.lineItems[0].amountFormatted, 'Бесплатно');
  assert.equal(consultKp.lineItems[1].amountFormatted, 'Договорная цена');

  // Verify full untruncated text, zero hanging № / prepositions, & zero overlap on the exact screenshot scenario
  const pages = computeProposalA4Layout(consultKp);
  assertZeroLayoutOverlapsAndBounds(pages, 'custom_consult_15s_empty_draft');
  for (const t of pages.flatMap((p) => p.texts)) {
    assert.equal(
      /\s№$/.test(t.text),
      false,
      `Line "${t.id}" must never end with an orphan "№": "${t.text}"`
    );
  }
  const joinedCanvasText = pages
    .flatMap((p) => p.texts.map((t) => t.text.replace(/\u00A0/g, ' ')))
    .join(' ');
  assert.ok(joinedCanvasText.includes('формирование сметы'), 'Row 1 title must not be truncated');
  assert.ok(joinedCanvasText.includes('Приложению № 1 к Договору'), 'Row 2 title must not be truncated');
  assert.ok(joinedCanvasText.includes('Диадок / СБИС'), 'Payment channel must not be truncated at СБИС');
});

test('computeProposalA4Layout guarantees zero overlaps across all formats, OOO VAT regimes, extreme strings, and multi-page air campaigns', () => {
  const oooVatProfiles = createDefaultStudioLegalProfiles();
  oooVatProfiles.activeEntityKind = 'ooo';
  oooVatProfiles.oooProfile.taxRegime = 'osno_vat_20';
  oooVatProfiles.oooProfile.vatMode = 'on_top';

  // 1. OOO + 20% VAT on_top + ultra-long counterparty + unbroken URL in brief
  const extremeDraft = createBaseDraft({
    selectedFormat: 'turnkey',
    spotDurationSec: 25,
    companyName:
      'Общество с ограниченной ответственностью «Научно-производственное объединение Верхневолжский машиностроительный комплекс»',
    companyInn: '6950241890',
    companyLine: '',
    contactLine:
      'Константинопольский Александр Владимирович, коммерческий директор, +7 (920) 155-44-22, alexander.konstantinopolsky@verhnevolzhsky-holding.ru',
    briefText:
      'Необходимо разработать серию имиджевых и продуктовых аудиороликов для дилерской сети. Ссылка на брендбук и гайдлайны: https://disk.yandex.ru/d/VeryLongUnbrokenFolderIdentifier_2026_Brandbook_Audio_Guidelines_Master_Archive_v4_Final .\nВажно учесть требования юридического департамента, выдержать плотный баритон и аккуратный дисклеймер в финале ролика.',
    resolvedCounterpartyMeta: {
      customerKpp: '695001001',
      customerAddress:
        '170100, Российская Федерация, Тверская область, г. Тверь, пр-кт Чайковского, д. 28/2, помещ. 405',
    },
  });
  const extremeKp = buildCommercialProposalFromDraft(extremeDraft, {
    legalProfiles: oooVatProfiles,
    nowIso: '2026-11-16T10:00:00.000Z',
  });
  assert.equal(extremeKp.totalPayableRub, 30000, '25 000 RUB + 20% VAT on_top = 30 000 RUB');
  assert.equal(extremeKp.studioEntityKind, 'ooo');
  assert.equal(extremeKp.studioKpp, '695001001');
  const extremePages = computeProposalA4Layout(extremeKp);
  assertZeroLayoutOverlapsAndBounds(extremePages, 'extreme_ooo_vat_long_strings');

  // 2. All remaining formats: voice_style, cinema, adaptation
  for (const fmt of ['voice_style', 'cinema', 'adaptation'] as const) {
    const kp = buildCommercialProposalFromDraft(
      createBaseDraft({ selectedFormat: fmt, paymentChannel: 'card_online' }),
      { nowIso: '2026-11-16T10:00:00.000Z' }
    );
    const pages = computeProposalA4Layout(kp);
    assertZeroLayoutOverlapsAndBounds(pages, `format_${fmt}`);
  }

  // 3. Large 9-station radio campaign + long brief -> automatic multi-page pagination
  const nineStations = Array.from({ length: 9 }, (_, idx) => ({
    slotId: `slot-${idx + 1}`,
    station: `Радиостанция Регион FM #${idx + 1}`,
    frequencyFm: `${100 + idx}.5 FM`,
    daypart: 'Утренний и вечерний драйв-тайм 07:30–10:30 / 17:00–20:00',
    daysPattern: 'Пн–Пт',
    sampleTimeSlots: ['08:15', '18:20'],
    spotsIncluded: 25,
    maxDuration: 30 as const,
    exactDurationSec: 20,
    officialPrice: 40000,
    hotPrice: 30000,
    discountPercent: 25,
    reachOTS: 65000,
    packageMultiplier: 1,
  }));

  const multiPageAirDraft = createBaseDraft({
    mode: 'air_plus_production',
    briefText: Array.from(
      { length: 8 },
      (_, i) =>
        `Блок задачи №${i + 1}: федеральная акция со специальными условиями и обязательной возрастной маркировкой.`
    ).join(' '),
    mediaReservation: {
      createdAtMs: 1763200000000,
      initialCountdownSeconds: 14399,
      nicheId: 'auto_services',
      nicheLabel: 'Автодилеры и сервис',
      productNote: 'Зимняя сервисная кампания',
      durationPref: '30',
      spotDurationSec: 20,
      targetAudienceSummary: 'Водители 25–54 лет',
      targetAudienceSharePct: 72,
      officialAirTotal: 360000,
      hotAirTotal: 270000,
      airDiscountPercent: 25,
      totalSpots: 225,
      totalReachOTS: 585000,
      isBonusProductionUnlocked: true,
      initialProductionSelection: 'turnkey',
      initialRecommendedTier: 'turnkey',
      aiRationale: 'Ковровый охват прайм-тайма',
      stations: nineStations,
    },
    reservationProdSelection: 'turnkey',
  });

  const multiPageKp = buildCommercialProposalFromDraft(multiPageAirDraft, {
    nowIso: '2026-11-16T10:00:00.000Z',
  });
  assert.equal(multiPageKp.lineItems.length, 10);
  const multiPages = computeProposalA4Layout(multiPageKp);
  assert.ok(multiPages.length >= 2, '9 radio stations + production must paginate cleanly onto >= 2 A4 pages');
  assertZeroLayoutOverlapsAndBounds(multiPages, 'multi_page_9_stations');

  // Verify multi-page binary PDF embedding
  const dummyJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
  const multiPdfBytes = buildValidPdfDocumentBytes(
    multiPageKp,
    multiPages.map((p) => ({ jpegBytes: dummyJpeg, widthPx: p.widthPx, heightPx: p.heightPx }))
  );
  const multiPdfAscii = new TextDecoder('latin1').decode(multiPdfBytes);
  assert.ok(multiPdfAscii.includes(`/Count ${multiPages.length}`));
  assert.ok(multiPdfAscii.trimEnd().endsWith('%%EOF'));
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
