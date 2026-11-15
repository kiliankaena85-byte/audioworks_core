import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIOWORKS_TOTAL_DURATION_SEC,
  AUDIOWORKS_WAV_URL,
  formatAudioTime,
  getCinemaSceneIdAtTime,
   getCommercialStateAtTime,
  HERO_CINEMA_SCENES,
} from '../data/audioworksCommercial';
import {
  APPROACH_PILLARS,
  APPROACH_THESIS,
  BRAND_CASES,
  FLAGSHIP_STUDIO_REEL,
  getOrderedCasesForPersona,
} from '../data/casesData';
import {
  EDITORIAL_FAQ_ITEMS,
  HOME_PROCESS_FAQ_ITEMS,
  resolveFaqIconKey,
  toggleFaqItem,
} from '../data/faqData';
import {
  EDITORIAL_PRICING_ROWS,
  generateOrderNumber,
  getStudioFormatDisplayMeta,
  QUICK_ORDER_PILLS,
  readSavedVipProfile,
  validateQuickOrder,
  writeSavedVipProfile,
} from '../data/pricingData';
import {
  evaluateLayaDecision,
  LAYA_CONFIDENCE_THRESHOLD,
  LAYA_CONTENT_DICTIONARY,
  LAYA_SIMULATION_TRACES,
  readVisitorStateFromLocation,
  VALID_PERSONAS,
} from './layaEngine';

test('Wave 1 LayaDecisionEngine: provides complete content slots for all 5 profiles', () => {
  assert.deepEqual(VALID_PERSONAS, [
    'default',
    'price_searcher',
    'real_estate',
    'fmcg',
    'returning_vip',
  ]);

  for (const persona of VALID_PERSONAS) {
    const slot = LAYA_CONTENT_DICTIONARY[persona];
    assert.ok(slot.heroHeading.length > 15);
    assert.ok(slot.heroSubheading.includes('15 000 ₽'));
    assert.ok(slot.streamCliches.length >= 5);
    assert.ok(slot.focusWords.length >= 5);
  }

  assert.equal(
    LAYA_CONTENT_DICTIONARY.default.heroHeading,
    'Эфир продаёт минуты. Мы создаём секунды, которые помнят.'
  );
});

test('Wave 1 LayaDecisionEngine: enforces confidence < 0.75 fallback to default baseline', () => {
  const directDecision = evaluateLayaDecision({
    utmTerm: '',
    personaParam: '',
    utmSource: '',
    device: 'desktop',
    visitCount: 1,
    referrer: '',
  });

  assert.equal(directDecision.confidence < LAYA_CONFIDENCE_THRESHOLD, true);
  assert.equal(directDecision.isFallback, true);
  assert.equal(directDecision.choice, 'default');
  assert.equal(directDecision.latencyMs, 28);
});

test('Wave 1 LayaDecisionEngine: maps ?utm_term="озвучка радио цена" to price_searcher', () => {
  const state = readVisitorStateFromLocation(
    '?utm_term=%D0%BE%D0%B7%D0%B2%D1%83%D1%87%D0%BA%D0%B0+%D1%80%D0%B0%D0%B4%D0%B8%D0%BE+%D1%86%D0%B5%D0%BD%D0%B0',
    1440,
    '',
    1
  );
  const decision = evaluateLayaDecision(state);

  assert.equal(decision.choice, 'price_searcher');
  assert.equal(decision.recommendedTier, 'voice_style');
  assert.equal(decision.confidence >= 0.75, true);
  assert.equal(decision.latencyMs, 28);
});

test('Wave 1 LayaDecisionEngine: supports ?persona=... for real_estate, fmcg, returning_vip', () => {
  for (const p of ['real_estate', 'fmcg', 'returning_vip'] as const) {
    const state = readVisitorStateFromLocation(`?persona=${p}`, 1440, '', 1);
    const decision = evaluateLayaDecision(state);
    assert.equal(decision.choice, p);
    assert.equal(decision.isFallback, false);
    assert.equal(decision.confidence >= 0.75, true);
  }
});

test('Wave 2 Showcase Sorting & Photographic Posters: real_estate puts Developer first; fmcg & default put Dmitrogorsky first', () => {
  const realEstateOrder = getOrderedCasesForPersona('real_estate');
  assert.equal(realEstateOrder.length, 3);
  assert.equal(realEstateOrder[0].id, 'business-estate');
  assert.equal(realEstateOrder[0].client, 'Квартал бизнес-класса');
  assert.equal(realEstateOrder[0].tag, 'Девелопмент • Недвижимость');

  const fmcgOrder = getOrderedCasesForPersona('fmcg');
  assert.equal(fmcgOrder[0].id, 'dmitrogorsky');
  assert.equal(fmcgOrder[0].client, 'Дмитрогорский продукт');
  assert.equal(fmcgOrder[0].editorialSurfaceBg, 'bg-[#2A1410]');

  const defaultOrder = getOrderedCasesForPersona('default');
  assert.equal(defaultOrder[0].id, 'dmitrogorsky');

  // Verify all 3 brand case photographic covers use local high-res assets
  assert.ok(BRAND_CASES[0].coverImageUrl.startsWith('/src/assets/images/'));
  assert.ok(BRAND_CASES[1].coverImageUrl.startsWith('/src/assets/images/'));
  assert.ok(BRAND_CASES[2].coverImageUrl.startsWith('/src/assets/images/'));
});

test('Wave 3 Editorial Pricing & Quick Order logic: tiers, VIP storage, and validation', () => {
  assert.deepEqual(
    EDITORIAL_PRICING_ROWS.map((r) => [r.id, r.priceRub]),
    [
      ['voice_style', 15000],
      ['turnkey', 25000],
      ['cinema', 35000],
    ]
  );
  assert.equal(EDITORIAL_PRICING_ROWS[1].badgeHit, 'Основной формат');
  assert.equal(QUICK_ORDER_PILLS.length, 5);
  assert.equal(QUICK_ORDER_PILLS[3].id, 'adaptation');
  assert.equal(QUICK_ORDER_PILLS[4].id, 'custom_consult');
  const consultMeta = getStudioFormatDisplayMeta('custom_consult');
  assert.equal(consultMeta.priceRub, 0);
  assert.equal(consultMeta.priceFormatted, 'Договорная цена');
  assert.equal(consultMeta.isNegotiable, true);

  // Mock localStorage round-trip for returning client 2-click flow
  const memory = new Map<string, string>();
  const mockStore = {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memory.set(k, v);
    },
  };
  assert.equal(readSavedVipProfile(mockStore), null);
  writeSavedVipProfile(
    { contactLine: '  Мария +7 926 000-11-22 ', company: ' Дмитрогорский продукт ' },
    mockStore
  );
  assert.deepEqual(readSavedVipProfile(mockStore), {
    contactLine: 'Мария +7 926 000-11-22',
    company: 'Дмитрогорский продукт',
  });

  // New project empty inputs -> invalid
  const invalidNew = validateQuickOrder({
    contactLine: '',
    briefText: '',
    hasVoiceRecording: false,
    hasAttachedFile: false,
    isReturningClientWithSavedProfile: false,
  });
  assert.equal(invalidNew.valid, false);
  assert.ok(invalidNew.contactError);
  assert.ok(invalidNew.taskError);

  // Voice recording alone + contact -> valid
  const validVoice = validateQuickOrder({
    contactLine: 'Илья @ilya_brand',
    briefText: '',
    hasVoiceRecording: true,
    hasAttachedFile: false,
    isReturningClientWithSavedProfile: false,
  });
  assert.equal(validVoice.valid, true);

  // Returning client with saved profile -> valid in 2 clicks
  const validVip = validateQuickOrder({
    contactLine: 'Мария +7 926 000-11-22',
    briefText: '',
    hasVoiceRecording: false,
    hasAttachedFile: false,
    isReturningClientWithSavedProfile: true,
  });
  assert.equal(validVip.valid, true);
  assert.match(generateOrderNumber(12345), /^FM-\d{4}$/);
});

test('Editorial FAQ logic & content: 4 questions, smooth toggle state, and respectful tone', () => {
  assert.equal(EDITORIAL_FAQ_ITEMS.length, 4);
  assert.deepEqual(
    EDITORIAL_FAQ_ITEMS.map((item) => item.indexLabel),
    ['01', '02', '03', '04']
  );
  assert.ok(EDITORIAL_FAQ_ITEMS[0].question.includes('25 000 ₽'));
  assert.ok(EDITORIAL_FAQ_ITEMS[1].answer.includes('уважением'));
  assert.ok(EDITORIAL_FAQ_ITEMS[2].answer.includes('100%'));
  assert.ok(EDITORIAL_FAQ_ITEMS[3].answer.includes('ЭДО'));

  // Toggle accordion state transitions
  const firstId = EDITORIAL_FAQ_ITEMS[0].id;
  const secondId = EDITORIAL_FAQ_ITEMS[1].id;
  assert.equal(toggleFaqItem(firstId, firstId), null);
  assert.equal(toggleFaqItem(null, secondId), secondId);
  assert.equal(toggleFaqItem(secondId, firstId), firstId);

  assert.equal(HOME_PROCESS_FAQ_ITEMS.length, 7);
  assert.deepEqual(
    HOME_PROCESS_FAQ_ITEMS.map((item) => item.indexLabel),
    ['01', '02', '03', '04', '05', '06', '07']
  );
  assert.ok(HOME_PROCESS_FAQ_ITEMS[0].answer.includes('Без договора и предоплаты сценарии не пишутся'));
  assert.ok(HOME_PROCESS_FAQ_ITEMS[3].question.includes('24–48'));
  assert.ok(HOME_PROCESS_FAQ_ITEMS[4].answer.includes('Индивидуальный проект'));
  assert.ok(HOME_PROCESS_FAQ_ITEMS[5].answer.includes('Только сценарий'.slice(6)) || HOME_PROCESS_FAQ_ITEMS[5].question.includes('только сценарий'));
  assert.ok(HOME_PROCESS_FAQ_ITEMS[6].question.includes('Срочный заказ'));
  assert.ok(HOME_PROCESS_FAQ_ITEMS[6].answer.includes('от 1 часа'));
  assert.ok(HOME_PROCESS_FAQ_ITEMS[6].answer.includes('без разработки сценария'));
  assert.ok(HOME_PROCESS_FAQ_ITEMS[6].answer.includes('по договорной цене'));
  assert.equal(
    toggleFaqItem(HOME_PROCESS_FAQ_ITEMS[0].id, HOME_PROCESS_FAQ_ITEMS[0].id),
    null
  );
  assert.equal(
    toggleFaqItem(null, HOME_PROCESS_FAQ_ITEMS[2].id),
    HOME_PROCESS_FAQ_ITEMS[2].id
  );
  assert.deepEqual(
    HOME_PROCESS_FAQ_ITEMS.map((item) => resolveFaqIconKey(item)),
    ['waveform', 'shield', 'receipt', 'clock', 'sliders', 'mic', 'clock']
  );
  assert.equal(
    resolveFaqIconKey({
      id: 'custom-1',
      question: 'Сколько дней займёт оплата по ЭДО?',
    }),
    'clock'
  );
  assert.equal(
    resolveFaqIconKey({
      id: 'custom-2',
      question: 'Как проверяются авторские права и договор?',
    }),
    'shield'
  );
  assert.equal(
    resolveFaqIconKey({
      id: 'custom-3',
      question: 'Можно ли оплатить картой физлица?',
    }),
    'receipt'
  );
});

test('Studio Commercial WAV integration: chapters, timecode formatting, and showcase wiring', () => {
  assert.equal(AUDIOWORKS_WAV_URL, '/assets/aistudio/Audioworks_75c6023f.wav');
  assert.equal(formatAudioTime(0), '0:00');
  assert.equal(formatAudioTime(21), '0:21');
  assert.equal(formatAudioTime(Math.round(AUDIOWORKS_TOTAL_DURATION_SEC)), '1:19');

  assert.equal(getCommercialStateAtTime(1.5).mode, 'stream');
  assert.equal(getCommercialStateAtTime(6.2).mode, 'silence');
  assert.equal(getCommercialStateAtTime(10.0).chapter.id, 'manifesto_intro');
  assert.equal(getCommercialStateAtTime(22.0).chapter.id, 'scene_fmcg');
  assert.equal(getCommercialStateAtTime(44.0).chapter.id, 'scene_estate');
  assert.equal(getCommercialStateAtTime(65.0).chapter.id, 'manifesto_finale');

  assert.equal(FLAGSHIP_STUDIO_REEL.audioUrl, AUDIOWORKS_WAV_URL);
  assert.equal(FLAGSHIP_STUDIO_REEL.durationSec, 79);
  assert.equal(BRAND_CASES[0].audioUrl, AUDIOWORKS_WAV_URL);
  assert.equal(BRAND_CASES[1].audioUrl, AUDIOWORKS_WAV_URL);

  // HeroCinemaStage 3 widescreen scenes & audio-synced scene mapping
  assert.equal(HERO_CINEMA_SCENES.length, 3);
  assert.deepEqual(
    HERO_CINEMA_SCENES.map((s) => s.tabLabel),
    ['01 Студия ON AIR', '02 Вкус бренда', '03 Тихий статус']
  );
  assert.equal(HERO_CINEMA_SCENES[0].showOnAirBadge, true);
  assert.equal(HERO_CINEMA_SCENES[1].caption, 'Звук, у которого есть вкус');
  assert.equal(HERO_CINEMA_SCENES[2].caption, 'Тихий статус вместо кричащих скидок');
  assert.equal(getCinemaSceneIdAtTime(8.0), 'studio');
  assert.equal(getCinemaSceneIdAtTime(20.0), 'taste');
  assert.equal(getCinemaSceneIdAtTime(42.0), 'status');
});

test('Waves 1-4 & HeroKoto Guardrails: verifies Koto 4-frame showreel, manifesto taglines, share URLs, custom showreel, and zero banned copy', async () => {
  const {
    APPROACH_STUDIO_PHOTO,
    buildCaseShareUrl,
    computeCaseHoverOffset,
    readSharedCaseIdFromLocation,
  } = await import('../data/casesData');
  const {
    getCrashTestPhaseAtElapsed,
    GREY_RADIO_MARQUEE_BASE,
    HERO_KOTO_FRAMES,
    HERO_LENS_FRAMES,
    KOTO_LENS_MANIFESTO_PARAGRAPH,
    KOTO_MIC_WIDGET_IMAGE,
    ZERNO_DUEL_DATA,
  } = await import('../data/audioworksCommercial');
  const { contrastAudioEngine } = await import('../audio/contrastAudioEngine');

  // Verify hover parallax micro-interaction math (center neutrality, counter-shift, clamping)
  const sampleRect = { left: 100, top: 200, width: 400, height: 300 };
  assert.deepEqual(computeCaseHoverOffset(300, 350, sampleRect, 10, 8), { x: 0, y: 0 });
  assert.deepEqual(computeCaseHoverOffset(100, 200, sampleRect, 10, 8), { x: 10, y: 8 });
  assert.deepEqual(computeCaseHoverOffset(500, 500, sampleRect, 10, 8), { x: -10, y: -8 });
  assert.deepEqual(computeCaseHoverOffset(900, 900, sampleRect, 10, 8), { x: -10, y: -8 });

  // Verify HeroKotoLens 3-phase Crash-Test timeline math
  assert.equal(getCrashTestPhaseAtElapsed(-1), 'idle');
  assert.equal(getCrashTestPhaseAtElapsed(0), 'clutter');
  assert.equal(getCrashTestPhaseAtElapsed(3.9), 'clutter');
  assert.equal(getCrashTestPhaseAtElapsed(4.0), 'stop_pause');
  assert.equal(getCrashTestPhaseAtElapsed(4.45), 'stop_pause');
  assert.equal(getCrashTestPhaseAtElapsed(4.5), 'audioworks');
  assert.equal(getCrashTestPhaseAtElapsed(12.0), 'audioworks');

  // Verify HeroKotoLens 3 vivid AudioWorks frames & manifesto copy
  assert.equal(HERO_LENS_FRAMES.length, 3);
  assert.deepEqual(
    HERO_LENS_FRAMES.map((f) => f.id),
    ['taste', 'status', 'studio']
  );
  assert.equal(HERO_LENS_FRAMES[0].title, 'Звук, который вызывает аппетит');
  assert.equal(
    HERO_LENS_FRAMES[1].title,
    'Пауза и достоинство вместо кричащих скидок'
  );
  assert.equal(HERO_LENS_FRAMES[2].title, 'Режиссура каждой секунды');
  assert.ok(KOTO_LENS_MANIFESTO_PARAGRAPH.includes('3 000 ₽'));
  assert.ok(KOTO_LENS_MANIFESTO_PARAGRAPH.includes('четырьмя чужими объявлениями'));

  // Verify Zerno i Svet 15-second A/B Duel data & exact filename classifier
  const { classifyUploadedDuelFilename } = await import('../audio/duelAudioStore');
  assert.equal(
    classifyUploadedDuelFilename('Зерно и свет 15_РАДИР _mixdown.wav'),
    'radio'
  );
  assert.equal(
    classifyUploadedDuelFilename('Зерно и свет 15_mixdown.wav'),
    'audioworks'
  );
  assert.equal(ZERNO_DUEL_DATA.clientName, 'Кофейня «Зерно и Свет»');
  assert.equal(
    ZERNO_DUEL_DATA.audioworksSpot.badge,
    '15 секунд в FMWorks: Выстрел в память'
  );
  assert.equal(ZERNO_DUEL_DATA.radioSpot.durationSec, 14);
  assert.equal(ZERNO_DUEL_DATA.audioworksSpot.durationSec, 15);
  assert.equal(ZERNO_DUEL_DATA.radioSpot.phrases.length, 5);
  assert.equal(ZERNO_DUEL_DATA.audioworksSpot.phrases.length, 4);
  assert.equal(
    ZERNO_DUEL_DATA.audioworksSpot.phrases[0].text,
    'Пробка на Ленинском… подождёт.'
  );

  // Verify Koto Manifesto dynamic second line across all 5 Laya personas
  assert.equal(
    LAYA_CONTENT_DICTIONARY.default.kotoManifestoTagline,
    'Аудиореклама, которая работает.'
  );
  for (const persona of VALID_PERSONAS) {
    assert.ok(LAYA_CONTENT_DICTIONARY[persona].kotoManifestoTagline.length > 10);
  }

  // Verify 4 rhythmic full-bleed HeroKoto art frames + mic widget image
  assert.equal(HERO_KOTO_FRAMES.length, 4);
  assert.deepEqual(
    HERO_KOTO_FRAMES.map((f) => f.id),
    ['frame-studio', 'frame-onair', 'frame-product', 'frame-architecture']
  );
  assert.equal(HERO_KOTO_FRAMES[1].kind, 'kinetic_poster');
  assert.equal(HERO_KOTO_FRAMES[1].title, 'ON AIR');
  assert.ok(KOTO_MIC_WIDGET_IMAGE.startsWith('/src/assets/images/'));

  // Verify Case share deep-link URL generation & parsing
  assert.equal(
    buildCaseShareUrl('https://fmworks.ru/?persona=real_estate#top', 'business-estate'),
    'https://fmworks.ru/?persona=real_estate&case=business-estate#case-business-estate'
  );
  assert.equal(readSharedCaseIdFromLocation('?case=dmitrogorsky', ''), 'dmitrogorsky');
  assert.equal(readSharedCaseIdFromLocation('', '#case-medical-clinics'), 'medical-clinics');
  assert.equal(readSharedCaseIdFromLocation('?case=unknown', '#top'), null);

  assert.deepEqual(
    APPROACH_PILLARS.map((p) => p.number),
    ['01', '02', '03']
  );
  assert.ok(APPROACH_STUDIO_PHOTO.imageUrl.startsWith('/src/assets/images/'));
  assert.equal(
    APPROACH_STUDIO_PHOTO.caption,
    'Собственный контроль качества на каждом этапе — от текста до паспорта ролика'
  );

  // Verify Lens expansion & custom .mp3/.wav showreel state on contrastAudioEngine
  assert.equal(contrastAudioEngine.getSnapshot().hasCustomAudio, false);
  assert.equal(contrastAudioEngine.getSnapshot().isLensExpanded, false);

  contrastAudioEngine.expandLensWithAudioWorks();
  assert.equal(contrastAudioEngine.getSnapshot().isLensExpanded, true);
  assert.equal(contrastAudioEngine.getSnapshot().crashPhase, 'audioworks');

  contrastAudioEngine.collapseLensToSpotlight();
  assert.equal(contrastAudioEngine.getSnapshot().isLensExpanded, false);
  assert.equal(contrastAudioEngine.getSnapshot().crashPhase, 'idle');

  contrastAudioEngine.loadCustomShowreel('blob:http://localhost:3000/welcome-reel', 'welcome.wav', false);
  const loadedSnap = contrastAudioEngine.getSnapshot();
  assert.equal(loadedSnap.hasCustomAudio, true);
  assert.equal(loadedSnap.customAudioName, 'welcome.wav');
  assert.equal(loadedSnap.mode, 'focus');
  assert.equal(loadedSnap.isLensExpanded, true);

  contrastAudioEngine.resetCustomShowreel();
  const resetSnap = contrastAudioEngine.getSnapshot();
  assert.equal(resetSnap.hasCustomAudio, false);
  assert.equal(resetSnap.customAudioName, null);
  assert.equal(resetSnap.isLensExpanded, false);

  const {
    CLIENT_TESTIMONIALS,
    getTestimonialsForFilterAndPersona,
    TESTIMONIAL_FILTERS,
  } = await import('../data/testimonialsData');

  assert.equal(CLIENT_TESTIMONIALS.length, 4);
  assert.equal(TESTIMONIAL_FILTERS.length, 5);
  assert.equal(
    getTestimonialsForFilterAndPersona('all', 'default')[0].id,
    'dmitrogorsky-fmcg'
  );
  assert.equal(
    getTestimonialsForFilterAndPersona('all', 'real_estate')[0].id,
    'forma-estate'
  );
  assert.equal(
    getTestimonialsForFilterAndPersona('all', 'returning_vip')[0].id,
    'zerno-fast-launch'
  );
  assert.equal(getTestimonialsForFilterAndPersona('medical', 'default').length, 1);
  assert.equal(
    getTestimonialsForFilterAndPersona('medical', 'default')[0].id,
    'veramed-clinics'
  );

  const dump = JSON.stringify({
    LAYA_CONTENT_DICTIONARY,
    LAYA_SIMULATION_TRACES,
    HERO_CINEMA_SCENES,
    HERO_KOTO_FRAMES,
    HERO_LENS_FRAMES,
    GREY_RADIO_MARQUEE_BASE,
    KOTO_LENS_MANIFESTO_PARAGRAPH,
    ZERNO_DUEL_DATA,
    FLAGSHIP_STUDIO_REEL,
    BRAND_CASES,
    APPROACH_THESIS,
    APPROACH_PILLARS,
    APPROACH_STUDIO_PHOTO,
    EDITORIAL_PRICING_ROWS,
    QUICK_ORDER_PILLS,
    EDITORIAL_FAQ_ITEMS,
    HOME_PROCESS_FAQ_ITEMS,
    CLIENT_TESTIMONIALS,
    TESTIMONIAL_FILTERS,
  }).toLowerCase();

  const forbidden = [
    'fm-тракт',
    'спектрограмма',
    'компрессор',
    'стемы',
    'дешевые биржи',
    'честная московская цена',
    'москв',
    'петерб',
    'питер',
    'мск',
    'спб',
    'moscow',
    'spb',
  ];
  for (const word of forbidden) {
    assert.equal(dump.includes(word), false, `Found banned term: ${word}`);
  }
});

test('CompactHeaderNav logic: includes Галерея, Стоимость, FAQ and resolves active section & scroll target', async () => {
  const {
    COMPACT_NAV_ITEMS,
    computeSmoothScrollTargetY,
    resolveActiveSectionId,
  } = await import('../data/navigationData');

  const labels = COMPACT_NAV_ITEMS.map((item) => item.label);
  assert.equal(labels.includes('Галерея'), true);
  assert.equal(labels.includes('Стоимость'), true);
  assert.equal(labels.includes('FAQ'), true);

  const sampleBounds = [
    { id: 'duel' as const, top: 600, bottom: 1300 },
    { id: 'work' as const, top: 1300, bottom: 2500 },
    { id: 'pricing' as const, top: 3200, bottom: 4000 },
    { id: 'testimonials' as const, top: 4000, bottom: 4800 },
    { id: 'faq' as const, top: 4800, bottom: 5400 },
  ];

  // Above first tracked section -> null
  assert.equal(resolveActiveSectionId(sampleBounds, 148, false), null);

  // Scrolled into Галерея (#work)
  const inGallery = sampleBounds.map((b) => ({
    ...b,
    top: b.top - 1400,
    bottom: b.bottom - 1400,
  }));
  assert.equal(resolveActiveSectionId(inGallery, 148, false), 'work');

  // Scrolled into intervening #approach section between #work and #pricing -> keeps 'work' active
  const inApproachGap = sampleBounds.map((b) => ({
    ...b,
    top: b.top - 2600,
    bottom: b.bottom - 2600,
  }));
  assert.equal(resolveActiveSectionId(inApproachGap, 148, false), 'work');

  // At very bottom of page -> highlights 'faq'
  assert.equal(resolveActiveSectionId(inApproachGap, 148, true), 'faq');

  // Smooth scroll target calculation clamps at >= 0 and accounts for sticky header offset
  assert.equal(computeSmoothScrollTargetY(500, 200, 68), 632);
  assert.equal(computeSmoothScrollTargetY(-300, 100, 68), 0);
});

test('CasesGallery per-card audio progress bar: fills only for active playing case and resets others', async () => {
  const { computeCaseCardProgress } = await import('../data/casesData');

  // Idle -> all cards unfilled
  assert.deepEqual(computeCaseCardProgress('dmitrogorsky', false, null, 0.5), {
    isActive: false,
    mode: null,
    ratio: 0,
    percent: 0,
  });

  // Playing Dmitrogorsky at 38% -> fills Dmitrogorsky, keeps others at 0
  assert.deepEqual(
    computeCaseCardProgress('dmitrogorsky', true, 'dmitrogorsky', 0.384, 'full'),
    {
      isActive: true,
      mode: 'full',
      ratio: 0.384,
      percent: 38,
    }
  );
  assert.deepEqual(
    computeCaseCardProgress('business-estate', true, 'dmitrogorsky', 0.384, 'full'),
    {
      isActive: false,
      mode: null,
      ratio: 0,
      percent: 0,
    }
  );

  // Initial playback start (progress = 0) -> shows subtle 0.02 visual spark while percent is 0
  assert.deepEqual(
    computeCaseCardProgress('medical-clinics', true, 'medical-clinics', 0, 'preview'),
    {
      isActive: true,
      mode: 'preview',
      ratio: 0.02,
      percent: 0,
    }
  );

  // Clamps out-of-range and NaN values safely
  assert.deepEqual(
    computeCaseCardProgress('audioworks-reel', true, 'audioworks-reel', 1.4, 'full'),
    {
      isActive: true,
      mode: 'full',
      ratio: 1,
      percent: 100,
    }
  );
  assert.deepEqual(
    computeCaseCardProgress('audioworks-reel', true, 'audioworks-reel', Number.NaN, 'preview'),
    {
      isActive: true,
      mode: 'preview',
      ratio: 0.02,
      percent: 0,
    }
  );
});

test('CasesGallery hover preview (3-5s): resolves curated preview windows and protects active full tracks', async () => {
  const {
    BRAND_CASES,
    FLAGSHIP_STUDIO_REEL,
    getCasePreviewWindow,
    shouldStartHoverPreview,
  } = await import('../data/casesData');
  const { casePlayerEngine } = await import('../audio/casePlayerEngine');

  // Every case has a 3-5 second curated preview window
  for (const item of [FLAGSHIP_STUDIO_REEL, ...BRAND_CASES]) {
    const win = getCasePreviewWindow(item);
    assert.equal(win.durationSec >= 3 && win.durationSec <= 5, true);
    assert.equal(win.endSec, Math.round((win.startSec + win.durationSec) * 100) / 100);
  }

  assert.deepEqual(getCasePreviewWindow(FLAGSHIP_STUDIO_REEL), {
    startSec: 7.2,
    durationSec: 4,
    endSec: 11.2,
  });
  assert.deepEqual(getCasePreviewWindow(BRAND_CASES[0]), {
    startSec: 15.6,
    durationSec: 4,
    endSec: 19.6,
  });

  // Clamps custom preview durations strictly into [3..5] seconds
  assert.equal(
    getCasePreviewWindow({ durationSec: 20, previewStartSec: 2, previewDurationSec: 1 }).durationSec,
    3
  );
  assert.equal(
    getCasePreviewWindow({ durationSec: 20, previewStartSec: 2, previewDurationSec: 9 }).durationSec,
    5
  );

  // Hover guard: blocks touch pointers & never interrupts full playback, allows idle or switching previews
  assert.equal(
    shouldStartHoverPreview({ pointerType: 'touch', isPlaying: false, playbackMode: null }),
    false
  );
  assert.equal(
    shouldStartHoverPreview({ pointerType: 'mouse', isPlaying: true, playbackMode: 'full' }),
    false
  );
  assert.equal(
    shouldStartHoverPreview({ pointerType: 'mouse', isPlaying: false, playbackMode: null }),
    true
  );
  assert.equal(
    shouldStartHoverPreview({ pointerType: 'mouse', isPlaying: true, playbackMode: 'preview' }),
    true
  );

  // Engine state check in headless/node environment: startPreview -> stopPreview -> clean idle
  assert.equal(casePlayerEngine.getSnapshot().playbackMode, null);
  assert.equal(casePlayerEngine.getSnapshot().spectrumBands.length, 32);
  assert.equal(
    casePlayerEngine.getSnapshot().spectrumBands.every((v) => v === 0),
    true
  );
  casePlayerEngine.stop();
  assert.equal(casePlayerEngine.getSnapshot().isPlaying, false);
});

test('CasesGallery boutique sound wave visualizer: generates 32-band case-specific acoustic profile when active and zeros when idle', async () => {
  const { CASE_SPECTRUM_BAND_COUNT, computeCaseSpectrumBands } = await import(
    '../data/casesData'
  );

  // Idle -> 32 silent bands (0)
  const idleBands = computeCaseSpectrumBands('dmitrogorsky', 1.2, false);
  assert.equal(idleBands.length, CASE_SPECTRUM_BAND_COUNT);
  assert.equal(idleBands.every((v) => v === 0), true);

  // Active -> 32 bands strictly clamped within [0.16, 1]
  const fmcgAtStart = computeCaseSpectrumBands('dmitrogorsky', 0.35, true);
  const fmcgLater = computeCaseSpectrumBands('dmitrogorsky', 1.15, true);
  const estateAtStart = computeCaseSpectrumBands('business-estate', 0.35, true);

  assert.equal(fmcgAtStart.length, 32);
  assert.equal(
    fmcgAtStart.every((v) => v >= 0.16 && v <= 1),
    true
  );

  // Evolves dynamically over time and differs between case acoustic profiles
  assert.notDeepEqual(fmcgAtStart, fmcgLater);
  assert.notDeepEqual(fmcgAtStart, estateAtStart);

  // Supports live Web Audio FFT blending and clamps safely
  const mockFft = Array.from({ length: 64 }, (_, i) => (i < 24 ? 0.92 : 0.15));
  const blended = computeCaseSpectrumBands('medical-clinics', 0.8, true, mockFft);
  assert.equal(blended.length, 32);
  assert.equal(
    blended.every((v) => v >= 0.16 && v <= 1),
    true
  );
  assert.equal(blended[4] > blended[28], true);
});

test('BrandLogo & Brand Kit FMWorks: generates pure vector SVGs, sound-wave W inside orange frame, monolithic FMWorks® wordmark, and 4-spec asset kit', async () => {
  const {
    BRAND_DOMAIN_OPTIONS,
    buildAvatarIconSvgMarkup,
    buildBrandLogoSvgMarkup,
    computeBadgeWaveWPath,
    getBrandKitAssetSpecs,
    getBrandWordmarkGeometry,
  } = await import('../data/brandKitData');

  assert.deepEqual(
    BRAND_DOMAIN_OPTIONS.map((o) => o.label),
    ['FMWorks®', 'FMWorks.ru', 'FMWorks.pro']
  );

  // Verify 6-segment continuous cubic Bezier sound-wave W inside 48x48 rx=13 #FF4820 frame
  const idleWave = computeBadgeWaveWPath(0, 0);
  const hoverWaveA = computeBadgeWaveWPath(1, 0.8);
  const hoverWaveB = computeBadgeWaveWPath(1, 2.1);
  const countCubicSegments = (d: string) => (d.match(/\bC\b/g) || []).length;

  assert.equal(countCubicSegments(idleWave), 6);
  assert.notEqual(idleWave, hoverWaveA);
  assert.notEqual(hoverWaveA, hoverWaveB);

  // Monolithic FMWorks® wordmark geometry without gaps or curves
  const geomDefault = getBrandWordmarkGeometry('fmworks_reg');
  assert.equal(geomDefault.fmPrefix, 'FM');
  assert.equal(geomDefault.worksBody, 'Works');
  assert.equal(geomDefault.suffixText, '®');
  assert.equal(geomDefault.letterSpacing, -1.12);

  // Canonical file names for default FMWorks®
  const defaultSpecs = getBrandKitAssetSpecs('fmworks_reg');
  assert.deepEqual(
    defaultSpecs.map((s) => [s.svgFileName, s.pngFileName, s.pngWidth, s.pngHeight]),
    [
      ['fmworks-logo-dark.svg', 'fmworks-logo-dark.png', 2400, 800],
      ['fmworks-logo-light.svg', 'fmworks-logo-light.png', 2400, 800],
      ['fmworks-avatar-icon.svg', 'fmworks-avatar-icon.png', 1000, 1000],
    ]
  );

  // Standalone exported SVGs contain explicit dimensions, #FF4820 48x48 rx="13" icon, wave W path, and zero currentColor leaks
  for (const option of BRAND_DOMAIN_OPTIONS) {
    const darkSvg = buildBrandLogoSvgMarkup({
      variant: option.id,
      colorTheme: 'dark',
      exportArtboard2400x800: true,
    });
    const lightSvg = buildBrandLogoSvgMarkup({
      variant: option.id,
      colorTheme: 'light',
      exportArtboard2400x800: true,
    });
    const avatarSvg = buildAvatarIconSvgMarkup(option.id);

    assert.ok(darkSvg.includes('width="2400" height="800"'));
    assert.ok(darkSvg.includes('width="48" height="48" rx="13" fill="#FF4820"'));
    assert.ok(darkSvg.includes(`d="${idleWave}"`));
    assert.ok(darkSvg.includes('#111111'));
    assert.equal(darkSvg.includes('currentColor'), false);

    assert.ok(lightSvg.includes('width="2400" height="800"'));
    assert.ok(lightSvg.includes('#FFFFFF'));
    assert.ok(lightSvg.includes('#FF4820'));
    assert.equal(lightSvg.includes('currentColor'), false);

    assert.ok(avatarSvg.includes('width="1000" height="1000"'));
    assert.ok(avatarSvg.includes('width="48" height="48" rx="13" fill="#FF4820"'));
    assert.ok(avatarSvg.includes(`d="${idleWave}"`));
    assert.equal(avatarSvg.includes('currentColor'), false);
  }
});

test('Studio CMS & CNS Neuroscience Approach: validates snapshots, clamps 3-5s preview windows, sorts published cases, and enforces editorial guardrails', async () => {
  const { APPROACH_LEAD_PARAGRAPH, APPROACH_NEURO_STUDIES, readSharedCaseIdFromLocation } =
    await import('../data/casesData');
  const {
    auditEditorialCopyGuardrails,
    clampPreviewTiming,
    createDefaultStudioCmsSnapshot,
    formatPriceRub,
    orderPublishedCmsCasesForPersona,
    resolveAppRoute,
    validateAndNormalizeCmsSnapshot,
  } = await import('../data/studioCmsTypes');

  // Verify CNS / Selective Attention studies (Neuro-Insight +22% & System1 2x)
  assert.equal(APPROACH_NEURO_STUDIES.length, 2);
  assert.equal(APPROACH_NEURO_STUDIES[0].metricValue, '+22%');
  assert.ok(APPROACH_NEURO_STUDIES[0].sourceLabel.includes('Neuro-Insight'));
  assert.equal(APPROACH_NEURO_STUDIES[1].metricValue, '2×');
  assert.ok(APPROACH_NEURO_STUDIES[1].sourceLabel.includes('System1'));
  assert.ok(APPROACH_LEAD_PARAGRAPH.length > 60);

  // Route resolver
  assert.equal(resolveAppRoute('/'), 'public');
  assert.equal(resolveAppRoute('/?persona=fmcg'), 'public');
  assert.equal(resolveAppRoute('/admin'), 'admin');
  assert.equal(resolveAppRoute('/admin/'), 'admin');

  // Price formatting
  assert.equal(formatPriceRub(25000), '25 000 ₽');
  assert.equal(formatPriceRub(145000), '145 000 ₽');

  // Preview timing clamping strictly bounds hover preview into [3..5]s inside clip bounds
  const clampedShort = clampPreviewTiming({
    durationSec: 20,
    clipStartSec: 2,
    clipEndSec: 17,
    previewStartSec: 16,
    previewDurationSec: 1.2,
  });
  assert.equal(clampedShort.previewDurationSec, 3);
  assert.equal(clampedShort.previewStartSec, 14);
  assert.equal(clampedShort.durationSec, 15);

  const clampedLong = clampPreviewTiming({
    durationSec: 30,
    clipStartSec: 0,
    clipEndSec: 30,
    previewStartSec: 4.5,
    previewDurationSec: 9.5,
  });
  assert.equal(clampedLong.previewDurationSec, 5);
  assert.equal(clampedLong.previewStartSec, 4.5);

  // Default snapshot passes validation with zero banned editorial terms
  const defaultSnap = createDefaultStudioCmsSnapshot();
  assert.deepEqual(auditEditorialCopyGuardrails(defaultSnap), []);

  const validRes = validateAndNormalizeCmsSnapshot(defaultSnap);
  assert.equal(validRes.ok, true);
  if (validRes.ok) {
    assert.deepEqual(validRes.editorialWarnings, []);
    assert.equal(validRes.data.portfolioCases.length, 3);
  }

  // Rejects snapshots where every portfolio case is unpublished
  const allUnpublished = {
    ...defaultSnap,
    portfolioCases: defaultSnap.portfolioCases.map((c) => ({
      ...c,
      published: false,
    })),
  };
  const rejectedRes = validateAndNormalizeCmsSnapshot(allUnpublished);
  assert.equal(rejectedRes.ok, false);

  // Custom CMS case IDs work with share deep-links and persona sorting
  const customCases = [
    ...defaultSnap.portfolioCases,
    {
      ...defaultSnap.portfolioCases[0],
      id: 'custom-retail-launch',
      client: 'Федеральная сеть пекарен',
      published: true,
      sortOrder: 4,
      personaFocus: 'real_estate' as const,
    },
    {
      ...defaultSnap.portfolioCases[1],
      id: 'hidden-draft',
      published: false,
      sortOrder: 5,
      personaFocus: 'fmcg' as const,
    },
  ];
  const estateOrdered = orderPublishedCmsCasesForPersona(customCases, 'real_estate');
  assert.equal(estateOrdered.some((c) => c.id === 'hidden-draft'), false);
  assert.equal(estateOrdered[0].personaFocus, 'real_estate');
  assert.equal(
    readSharedCaseIdFromLocation(
      '?case=custom-retail-launch',
      '',
      customCases.map((c) => c.id)
    ),
    'custom-retail-launch'
  );
});

test('AdminWorkspace Real-Time Site Text Blocks: provides static content array for Hero, Approach, and Pricing and updates session memory instantaneously', async () => {
  const {
    STATIC_SITE_TEXT_BLOCKS,
    filterSiteTextBlocks,
    isSiteTextBlockModified,
    isSiteTextBlockSubtitleModified,
  } = await import('../data/siteTextBlocksData');
  const { siteTextBlocksStore } = await import('../cms/siteTextBlocksStore');
  const { BANNED_EDITORIAL_TERMS } = await import('../data/studioCmsTypes');

  siteTextBlocksStore.resetAllBlocks();

  // Verify static array covers Hero (2), Approach (4), and Pricing (4)
  assert.equal(STATIC_SITE_TEXT_BLOCKS.length, 10);
  assert.equal(filterSiteTextBlocks(STATIC_SITE_TEXT_BLOCKS, 'hero').length, 2);
  assert.equal(filterSiteTextBlocks(STATIC_SITE_TEXT_BLOCKS, 'approach').length, 4);
  assert.equal(filterSiteTextBlocks(STATIC_SITE_TEXT_BLOCKS, 'pricing').length, 4);
  assert.equal(
    filterSiteTextBlocks(STATIC_SITE_TEXT_BLOCKS, 'all', 'индивидуальный разбор').length,
    1
  );

  // Zero banned editorial terms across the entire static content array
  const dump = JSON.stringify(STATIC_SITE_TEXT_BLOCKS).toLowerCase();
  for (const term of BANNED_EDITORIAL_TERMS) {
    assert.equal(dump.includes(term), false, `Found banned term in static blocks: ${term}`);
  }

  // Real-time update in session memory across Hero, Approach, and Pricing
  siteTextBlocksStore.updateBlock('hero-manifesto', {
    title: 'Студия FMWorks.',
    subtitle: 'Живой звук в памяти сессии.',
    description: 'Обновлённое описание первого экрана.',
  });
  siteTextBlocksStore.updateBlock('approach-lead', {
    title: 'Новый заголовок подхода студии',
    description: 'Новое описание избирательного внимания слушателя.',
  });
  siteTextBlocksStore.updateBlock('pricing-tier-turnkey', {
    title: 'Флагманский продакшн под ключ',
  });

  const snapAfterEdit = siteTextBlocksStore.getState();
  assert.equal(snapAfterEdit.modifiedCount, 3);
  assert.equal(snapAfterEdit.lastEditedBlockId, 'pricing-tier-turnkey');

  const editedHero = siteTextBlocksStore.getBlock('hero-manifesto');
  assert.equal(isSiteTextBlockModified(editedHero), true);
  assert.equal(isSiteTextBlockSubtitleModified(editedHero), true);
  assert.equal(editedHero.title, 'Студия FMWorks.');
  assert.equal(editedHero.subtitle, 'Живой звук в памяти сессии.');

  // Per-block reset restores only that block
  siteTextBlocksStore.resetBlock('approach-lead');
  assert.equal(siteTextBlocksStore.getState().modifiedCount, 2);
  assert.equal(
    isSiteTextBlockModified(siteTextBlocksStore.getBlock('approach-lead')),
    false
  );

  // Full session reset restores baseline
  siteTextBlocksStore.resetAllBlocks();
  assert.equal(siteTextBlocksStore.getState().modifiedCount, 0);
  assert.equal(
    siteTextBlocksStore.getBlock('hero-manifesto').title,
    'Мы FMWorks.'
  );
});

test('Wave 1 Portfolio CMS: validates WAV/MP3 uploads, parses RIFF WAV duration, computes 3s preview windows, and updates local CMS state', async () => {
  const {
    WAVE1_DEFAULT_PREVIEW_DURATION_SEC,
    applyThreeSecondPreviewTiming,
    computePreviewWindowTimeline,
    parseWavDurationFromBuffer,
    resolveAudioBadgeLabel,
    validatePortfolioAudioFileMeta,
  } = await import('../data/portfolioWave1Helpers');
  const { studioCmsStore } = await import('../cms/studioCmsStore');

  studioCmsStore.discardLocalChanges();

  // 1. Strict WAV / MP3 validation
  assert.deepEqual(
    validatePortfolioAudioFileMeta({ name: 'spot-master.wav', type: 'audio/wav', size: 512_000 }),
    { ok: true, format: 'WAV' }
  );
  assert.deepEqual(
    validatePortfolioAudioFileMeta({ name: 'spot-air.mp3', type: 'audio/mpeg', size: 240_000 }),
    { ok: true, format: 'MP3' }
  );
  assert.equal(
    validatePortfolioAudioFileMeta({ name: 'notes.txt', type: 'text/plain', size: 1024 }).ok,
    false
  );
  assert.equal(
    validatePortfolioAudioFileMeta({ name: 'empty.wav', type: 'audio/wav', size: 0 }).ok,
    false
  );

  // 2. Binary RIFF/WAVE header duration parser (8000 Hz mono 16-bit = 16,000 bytes/sec -> 6.0 sec = 96,000 bytes)
  const sampleRate = 8000;
  const bytesPerSample = 2;
  const byteRate = sampleRate * bytesPerSample;
  const pcmByteLength = byteRate * 6;
  const wavBuffer = new ArrayBuffer(44 + pcmByteLength);
  const view = new DataView(wavBuffer);
  const writeAscii = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + pcmByteLength, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, pcmByteLength, true);

  assert.equal(parseWavDurationFromBuffer(wavBuffer), 6);
  assert.equal(parseWavDurationFromBuffer(new ArrayBuffer(12)), null);

  // 3. 3-second preview timing window & timeline percentages
  const initialCase = studioCmsStore.getState().snapshot.portfolioCases[0];
  const timedCase = applyThreeSecondPreviewTiming(
    {
      ...initialCase,
      durationSec: 15,
      clipStartSec: 0,
      clipEndSec: 15,
      previewDurationSec: 4.5,
    },
    3
  );
  assert.equal(timedCase.previewDurationSec, WAVE1_DEFAULT_PREVIEW_DURATION_SEC);
  assert.equal(timedCase.previewStartSec, 3);

  const metrics = computePreviewWindowTimeline(timedCase);
  assert.equal(metrics.previewStartSec, 3);
  assert.equal(metrics.previewEndSec, 6);
  assert.equal(metrics.previewDurationSec, 3);
  assert.equal(metrics.offsetPercent, 20);
  assert.equal(metrics.widthPercent, 20);

  assert.equal(
    resolveAudioBadgeLabel({ customAudioFileName: 'bakery-spot.mp3', audioUrl: 'blob:123' }),
    'MP3'
  );
  assert.equal(
    resolveAudioBadgeLabel({ customAudioFileName: 'bakery-master.wav', audioUrl: 'blob:123' }),
    'WAV'
  );

  // 4. Live local CMS store state updates & discard
  assert.equal(studioCmsStore.getState().hasLocalChanges, false);
  assert.equal(studioCmsStore.getState().localPortfolioChangeCount, 0);

  studioCmsStore.updateLocalSnapshot((prev) => ({
    ...prev,
    portfolioCases: prev.portfolioCases.map((item, idx) =>
      idx === 0
        ? {
            ...item,
            headline: 'Утренний эфир со вкусом свежего хлеба',
            customAudioFileName: 'bakery-master.wav',
            previewStartSec: 1.5,
            previewDurationSec: 3,
          }
        : item
    ),
  }));

  const updatedState = studioCmsStore.getState();
  assert.equal(updatedState.hasLocalChanges, true);
  assert.equal(updatedState.localPortfolioChangeCount, 1);
  assert.equal(
    updatedState.snapshot.portfolioCases[0].headline,
    'Утренний эфир со вкусом свежего хлеба'
  );
  assert.equal(updatedState.snapshot.portfolioCases[0].previewDurationSec, 3);

  studioCmsStore.discardLocalChanges();
  assert.equal(studioCmsStore.getState().hasLocalChanges, false);
  assert.equal(studioCmsStore.getState().localPortfolioChangeCount, 0);
});

test('Hot Air MediaGridPlanner Engine: 12 station quotas, Laya affinity sync, exact budget knapsack, and >=400k 0 RUB production bonus', async () => {
  const {
    AIR_BONUS_THRESHOLD_RUB,
    DEFAULT_RADIO_INVENTORY_SLOTS,
    PRODUCTION_MODERATION_GATE_HOURS,
    READY_SPOT_INGEST_GATE_HOURS,
    buildOptimalMediaGrid,
    computeSlotAffinity,
    computeSlotDiscountPercent,
    expandSlotBroadcastGrid,
    mapLayaPersonaToMediaNiche,
    resolveActiveWeekdays,
    resolveWeekdayNumbers,
  } = await import('../data/radioInventory');

  // 1. Verify 12 diverse starter quotas: 9 regular (>=24h, 28-42% off) + 3 ultra-urgent (6-23h, 44-48% extra flash discount)
  assert.equal(DEFAULT_RADIO_INVENTORY_SLOTS.length, 12);
  const regularQuotas = DEFAULT_RADIO_INVENTORY_SLOTS.filter(
    (s) => s.deadlineHours >= PRODUCTION_MODERATION_GATE_HOURS
  );
  const urgentQuotas = DEFAULT_RADIO_INVENTORY_SLOTS.filter(
    (s) =>
      s.deadlineHours >= READY_SPOT_INGEST_GATE_HOURS &&
      s.deadlineHours < PRODUCTION_MODERATION_GATE_HOURS
  );
  assert.equal(regularQuotas.length, 9);
  assert.equal(urgentQuotas.length, 3);

  for (const slot of regularQuotas) {
    const disc = computeSlotDiscountPercent(slot);
    assert.equal(
      disc >= 28 && disc <= 42,
      true,
      `${slot.station} regular discount ${disc}% outside 28-42%`
    );
  }

  for (const slot of urgentQuotas) {
    const disc = computeSlotDiscountPercent(slot);
    assert.equal(
      disc >= 44 && disc <= 49,
      true,
      `${slot.station} urgent flash discount ${disc}% should carry extra discount`
    );
  }

  // Verify exact broadcast time-slots, numeric weekdays, and chessboard cell sum
  for (const slot of DEFAULT_RADIO_INVENTORY_SLOTS) {
    assert.equal(slot.weekdays.length >= 2, true);
    assert.equal(slot.sampleTimeSlots.length >= 3, true);
    for (const ts of slot.sampleTimeSlots) {
      assert.match(ts, /^([01]\d|2[0-3]):[0-5]\d$/);
    }
    const cells = expandSlotBroadcastGrid(slot);
    const sumSpots = cells.reduce((acc, c) => acc + c.spotsCount, 0);
    assert.equal(sumSpots, slot.spotsIncluded);
  }

  // 2. Weekday pattern & numeric resolvers
  assert.deepEqual(resolveWeekdayNumbers('Пн–Пт'), [1, 2, 3, 4, 5]);
  assert.deepEqual(resolveWeekdayNumbers('Ср–Вс'), [3, 4, 5, 6, 7]);
  assert.deepEqual(resolveActiveWeekdays('Пн–Пт'), ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ']);
  assert.deepEqual(resolveActiveWeekdays([3, 4, 5, 6, 7]), ['СР', 'ЧТ', 'ПТ', 'СБ', 'ВС']);

  // 3. LayaDecisionEngine synchronization & niche affinity ordering
  assert.equal(mapLayaPersonaToMediaNiche('real_estate'), 'real_estate');
  assert.equal(mapLayaPersonaToMediaNiche('fmcg'), 'fmcg_retail');
  assert.equal(mapLayaPersonaToMediaNiche('returning_vip'), 'b2b_finance');

  const bfm = DEFAULT_RADIO_INVENTORY_SLOTS[0];
  const dorozhnoe = DEFAULT_RADIO_INVENTORY_SLOTS[6];
  assert.equal(
    computeSlotAffinity(bfm, 'b2b_finance', 'returning_vip') >
      computeSlotAffinity(dorozhnoe, 'b2b_finance', 'returning_vip'),
    true
  );
  assert.equal(
    computeSlotAffinity(dorozhnoe, 'medicine', 'default', 'сеть семейных клиник') >
      computeSlotAffinity(bfm, 'medicine', 'default', 'сеть семейных клиник'),
    true
  );

  // 4. Strict budget adherence across [100k .. 1.5M] for 15s, 30s, and ready_spot
  for (const budget of [100_000, 180_000, 250_000, 300_000, 400_000, 550_000, 950_000, 1_500_000]) {
    for (const dur of ['15', '30', 'ready_spot'] as const) {
      const plan = buildOptimalMediaGrid('real_estate', budget, dur, {
        layaPersona: 'real_estate',
        slots: DEFAULT_RADIO_INVENTORY_SLOTS,
      });
      assert.equal(plan.selectedSlots.length >= 1, true, `Empty grid at ${budget} / ${dur}`);
      assert.equal(
        plan.totalClientCost <= budget,
        true,
        `Cost ${plan.totalClientCost} exceeded budget ${budget} (${dur})`
      );
      if (dur === '30') {
        assert.equal(
          plan.selectedSlots.every((item) => item.slot.maxDuration >= 30),
          true
        );
      }
    }
  }

  // 5. Commercial Bonus Rule: airSpend >= 400 000 RUB unlocks 0 RUB Turnkey production (+25 000 RUB extra savings)
  const belowThresholdPlan = buildOptimalMediaGrid('b2b_finance', 300_000, '30', {
    slots: DEFAULT_RADIO_INVENTORY_SLOTS,
  });
  assert.equal(belowThresholdPlan.hotAirTotal < AIR_BONUS_THRESHOLD_RUB, true);
  assert.equal(belowThresholdPlan.isBonusProductionUnlocked, false);
  assert.equal(belowThresholdPlan.effectiveProductionPrice, 25_000);

  const bonusPlanAt400k = buildOptimalMediaGrid('real_estate', 400_000, '30', {
    layaPersona: 'real_estate',
    slots: DEFAULT_RADIO_INVENTORY_SLOTS,
  });
  assert.equal(bonusPlanAt400k.hotAirTotal >= AIR_BONUS_THRESHOLD_RUB, true);
  assert.equal(bonusPlanAt400k.isBonusProductionUnlocked, true);
  assert.equal(bonusPlanAt400k.effectiveProductionPrice, 0);
  assert.equal(bonusPlanAt400k.totalClientCost <= 400_000, true);
  assert.equal(
    bonusPlanAt400k.totalSavingsRub,
    bonusPlanAt400k.officialAirTotal - bonusPlanAt400k.hotAirTotal + 25_000
  );
});

test('Wave 1 Media-Buyer Rules: Effective Frequency concentration (100-250k), Moderation Time-Gate (>=24h vs >=6h), and AI Rationale', async () => {
  const {
    DEFAULT_RADIO_INVENTORY_SLOTS,
    buildOptimalMediaGrid,
    formatRubCompact,
  } = await import('../data/radioInventory');
  const { BANNED_EDITORIAL_TERMS } = await import('../data/studioCmsTypes');

  const allNiches = [
    'real_estate',
    'b2b_finance',
    'fmcg_retail',
    'medicine',
    'auto_services',
  ] as const;

  // 1. Effective Frequency Rule: 100k - 250k NEVER smears across 3-5 stations; concentrates on 1-2 stations with >= 12 spots each
  for (const niche of allNiches) {
    for (const smallBudget of [100_000, 150_000, 200_000, 250_000]) {
      const plan = buildOptimalMediaGrid(niche, smallBudget, '15', {
        slots: DEFAULT_RADIO_INVENTORY_SLOTS,
      });
      assert.equal(
        plan.selectedSlots.length >= 1 && plan.selectedSlots.length <= 2,
        true,
        `Budget ${smallBudget} in ${niche} picked ${plan.selectedSlots.length} stations instead of 1-2`
      );
      assert.equal(
        plan.selectedSlots.every((s) => s.slot.spotsIncluded >= 12),
        true,
        `Selected slot below effective frequency threshold`
      );
      assert.equal(plan.totalSpots >= 14, true);
    }
  }

  // Inject synthetic 3-spot budget-wasters and 5 cheap 40k stations: 220k budget STILL caps at <= 2 dense Tier-1 stations
  const adversarialSlots = [
    ...DEFAULT_RADIO_INVENTORY_SLOTS,
    ...[1, 2, 3, 4, 5].map((n) => ({
      id: `thin-cheap-${n}`,
      station: `Дешёвая Волна ${n}`,
      frequencyFm: `10${n}.1 FM`,
      formatDesc: 'Размытый пакет по 3 выхода',
      audienceTags: ['mass'] as ('mass')[],
      daypart: 'Дневной блок 12:00–16:00' as const,
      daysPattern: 'Пн–Пт',
      weekdays: [1, 2, 3, 4, 5] as (1 | 2 | 3 | 4 | 5)[],
      sampleTimeSlots: ['13:10', '14:10', '15:10'],
      spotsIncluded: 3,
      maxDuration: 15 as const,
      pricePerSecond: 844,
      officialPrice: 65_000,
      hotPrice: 38_000,
      reachOTS: 190_000,
      deadlineHours: 30,
      isHidden: false,
    })),
  ];

  const antiSmearPlan = buildOptimalMediaGrid('b2b_finance', 220_000, '15', {
    slots: adversarialSlots,
  });
  assert.equal(antiSmearPlan.selectedSlots.length <= 2, true);
  assert.equal(
    antiSmearPlan.selectedSlots.some((s) => s.slot.spotsIncluded < 10),
    false,
    'Optimizer must reject 3-spot budget-waster packages'
  );

  // Higher budget (900k RUB) scales up by connecting Tier-2 reach stations (3+ stations)
  const scaledFlightPlan = buildOptimalMediaGrid('real_estate', 900_000, '15', {
    slots: DEFAULT_RADIO_INVENTORY_SLOTS,
  });
  assert.equal(scaledFlightPlan.selectedSlots.length >= 4, true);
  assert.equal(scaledFlightPlan.selectedSlots.some((s) => s.tier === 1), true);
  assert.equal(scaledFlightPlan.selectedSlots.some((s) => s.tier === 2), true);

  // 2. Moderation Time-Gate: '15'/'30' (need_production_24h) strictly requires deadlineHours >= 24;
  //    'ready_spot' (ready_with_passport) unlocks ultra-urgent tomorrow-morning slots (deadlineHours >= 6) while blocking < 6h
  const slotsWithSub6h = [
    ...DEFAULT_RADIO_INVENTORY_SLOTS,
    {
      ...DEFAULT_RADIO_INVENTORY_SLOTS[9],
      id: 'too-late-4h',
      station: 'Закрытый Эфир',
      deadlineHours: 4,
    },
  ];

  const prod24hPlan = buildOptimalMediaGrid('real_estate', 350_000, '30', {
    slots: slotsWithSub6h,
  });
  assert.equal(prod24hPlan.spotReadinessMode, 'need_production_24h');
  assert.equal(prod24hPlan.minRequiredDeadlineHours, 24);
  assert.equal(prod24hPlan.lockedUrgentSlots.length, 3);
  assert.equal(
    prod24hPlan.scoredSlots.every((s) => s.slot.deadlineHours >= 24),
    true,
    '24h production mode must filter out all slots with deadlineHours < 24'
  );

  const readySpotPlan = buildOptimalMediaGrid('real_estate', 350_000, 'ready_spot', {
    slots: slotsWithSub6h,
  });
  assert.equal(readySpotPlan.spotReadinessMode, 'ready_with_passport');
  assert.equal(readySpotPlan.minRequiredDeadlineHours, 6);
  assert.equal(readySpotPlan.scoredSlots.length, 12);
  assert.equal(
    readySpotPlan.scoredSlots.some((s) => s.slot.deadlineHours < 24 && s.slot.deadlineHours >= 6),
    true,
    'Ready spot mode must unlock ultra-urgent tomorrow-morning quotas (6-23h)'
  );
  assert.equal(
    readySpotPlan.scoredSlots.some((s) => s.slot.id === 'too-late-4h'),
    false,
    'Slots with deadlineHours < 6 must remain blocked'
  );

  // 3. AI Media-Buyer Rationale (`aiRationale`): 2-3 expert sentences mentioning station, audience %, and exact savings
  for (const plan of [prod24hPlan, readySpotPlan, scaledFlightPlan]) {
    assert.equal(plan.aiRationale.length > 90, true);
    const sentences = plan.aiRationale
      .split(/(?<=[.!?])\s+/)
      .filter((part) => part.trim().length > 0);
    assert.equal(
      sentences.length >= 2 && sentences.length <= 3,
      true,
      `Expected 2-3 sentences in aiRationale, got ${sentences.length}: ${plan.aiRationale}`
    );
    assert.equal(
      plan.aiRationale.includes(`${plan.targetAudienceSharePct}%`),
      true,
      'aiRationale must state target audience capture percentage'
    );
    assert.equal(
      plan.aiRationale.includes(formatRubCompact(plan.totalSavingsRub)),
      true,
      'aiRationale must state exact ruble savings'
    );
    assert.equal(
      plan.selectedSlots.some((s) => plan.aiRationale.includes(s.slot.station)),
      true,
      'aiRationale must name the chosen station(s)'
    );

    const lowerRationale = plan.aiRationale.toLowerCase();
    for (const term of BANNED_EDITORIAL_TERMS) {
      assert.equal(
        lowerRationale.includes(term),
        false,
        `Banned term "${term}" found in aiRationale`
      );
    }
  }
});

test('RadioInventoryAdmin Smart Parser & Store: parses raw Telegram dump and CSV with 15-25% margin and updates live inventory', async () => {
  const {
    SAMPLE_RADIO_SALES_DUMP,
    parseRawRadioSalesDump,
    radioInventoryStore,
    resolveSlotHotPrice,
    validateMediaHoldReservation,
  } = await import('../data/radioInventory');

  radioInventoryStore.resetToDefaults();
  assert.equal(radioInventoryStore.getAllSlots().length, 12);

  // 1. Parse sample raw Telegram sales dump with 15% vs 25% margin
  const parsed15 = parseRawRadioSalesDump(SAMPLE_RADIO_SALES_DUMP, 15);
  const parsed25 = parseRawRadioSalesDump(SAMPLE_RADIO_SALES_DUMP, 25);

  assert.equal(parsed15.slots.length, 3);
  assert.equal(parsed25.slots.length, 3);
  assert.equal(parsed15.slots[0].station, 'Серебряный Дождь');
  assert.equal(parsed15.slots[0].frequencyFm, '100.1 FM');
  assert.equal(parsed15.slots[0].spotsIncluded, 14);
  assert.equal(parsed15.slots[0].maxDuration, 30);
  assert.deepEqual(parsed15.slots[0].weekdays, [1, 2, 3, 4, 5]);
  assert.deepEqual(parsed15.slots[1].weekdays, [3, 4, 5, 6, 7]);
  assert.equal(resolveSlotHotPrice(parsed25.slots[0]) > resolveSlotHotPrice(parsed15.slots[0]), true);

  // 2. Parse semicolon CSV line
  const csvParsed = parseRawRadioSalesDump(
    'Новое Радио 98.4 FM;Дневной блок 12:00–16:00;Пн–Пт;18;15;190000;85000;410000;12',
    20
  );
  assert.equal(csvParsed.slots.length, 1);
  assert.equal(csvParsed.slots[0].station, 'Новое Радио');
  assert.equal(resolveSlotHotPrice(csvParsed.slots[0]), 102_000);
  assert.equal(csvParsed.slots[0].maxDuration, 15);
  assert.deepEqual(csvParsed.slots[0].weekdays, [1, 2, 3, 4, 5]);

  // 3. Commit imported slots, hide sold slot, update price, and reset
  radioInventoryStore.prependImportedSlots(parsed15.slots);
  assert.equal(radioInventoryStore.getAllSlots().length, 15);

  const firstId = radioInventoryStore.getAllSlots()[0].id;
  radioInventoryStore.updateSlot(firstId, { hotPrice: 99_000, isHidden: true });
  assert.equal(radioInventoryStore.getActiveSlots().length, 14);

  // 4. Hold validation
  assert.equal(
    validateMediaHoldReservation({ contactLine: '', companyName: 'ЖК Свет', selectedCount: 2 })
      .valid,
    false
  );
  assert.equal(
    validateMediaHoldReservation({
      contactLine: '@ivan_marketing',
      companyName: 'ЖК Свет',
      selectedCount: 2,
    }).valid,
    true
  );

  radioInventoryStore.resetToDefaults();
  assert.equal(radioInventoryStore.getAllSlots().length, 12);
});

test('Wave 4 End-to-End Integration: Laya AI niche sync (Real Estate, FMCG, Medicine) & QuickOrderDrawer 4-hour reservation handoff', async () => {
  const {
    DEFAULT_RADIO_INVENTORY_SLOTS,
    buildOptimalMediaGrid,
    buildMediaReservationPayload,
    computeReservationTotalsForSelection,
    formatBookingSpecificationText,
    formatHoldCountdown,
    resolveMediaNicheFromLaya,
  } = await import('../data/radioInventory');

  // 1. Laya AI simulation traces & URL signals map cleanly to MediaGridPlanner niches (incl. Medicine!)
  const realEstateTrace = LAYA_SIMULATION_TRACES.find((t) => t.id === 'ad_real_estate');
  const fmcgTrace = LAYA_SIMULATION_TRACES.find((t) => t.id === 'abm_fmcg');
  const medicineTrace = LAYA_SIMULATION_TRACES.find((t) => t.id === 'ad_medicine');
  assert.ok(realEstateTrace);
  assert.ok(fmcgTrace);
  assert.ok(medicineTrace);

  const realEstateDecision = evaluateLayaDecision(realEstateTrace.state);
  const fmcgDecision = evaluateLayaDecision(fmcgTrace.state);
  const medicineDecision = evaluateLayaDecision(medicineTrace.state);

  assert.equal(resolveMediaNicheFromLaya(realEstateDecision), 'real_estate');
  assert.equal(resolveMediaNicheFromLaya(fmcgDecision), 'fmcg_retail');
  assert.equal(resolveMediaNicheFromLaya(medicineDecision), 'medicine');
  assert.equal(medicineDecision.isFallback, false);
  assert.equal(medicineDecision.confidence >= 0.75, true);

  // URL ?persona=medicine and ?utm_term="клиника чекап" also trigger Medicine media grid
  const medUrlDecision = evaluateLayaDecision(
    readVisitorStateFromLocation('?persona=medicine', 1440, '', 1)
  );
  assert.equal(resolveMediaNicheFromLaya(medUrlDecision), 'medicine');

  const medUtmDecision = evaluateLayaDecision(
    readVisitorStateFromLocation(
      '?utm_term=%D0%BA%D0%BB%D0%B8%D0%BD%D0%B8%D0%BA%D0%B0+%D1%87%D0%B5%D0%BA%D0%B0%D0%BF',
      1440,
      '',
      1
    )
  );
  assert.equal(resolveMediaNicheFromLaya(medUtmDecision), 'medicine');

  // Pre-built grids for Real Estate, FMCG, and Medicine differ and prioritize profile-specific stations
  const medPlan = buildOptimalMediaGrid('medicine', 300_000, '15', {
    layaPersona: medicineDecision.choice,
    slots: DEFAULT_RADIO_INVENTORY_SLOTS,
  });
  assert.equal(
    medPlan.selectedSlots.some((s) => s.slot.audienceTags.includes('medicine')),
    true
  );

  // 2. 4-hour priority hold countdown formatter
  assert.equal(formatHoldCountdown(4 * 3600 - 1), '03:59:59');
  assert.equal(formatHoldCountdown(3661), '01:01:01');
  assert.equal(formatHoldCountdown(0), '00:00:00');

  // 3. Reservation payload & tariff recalculations (0 RUB Bonus vs 15k / 25k / 35k RUB)
  const bonusGridPlan = buildOptimalMediaGrid('real_estate', 450_000, '15', {
    layaPersona: 'real_estate',
    slots: DEFAULT_RADIO_INVENTORY_SLOTS,
  });
  const bonusPayload = buildMediaReservationPayload({
    plan: bonusGridPlan,
    nicheLabel: 'Недвижимость и ЖК',
    productNote: 'Старт продаж 2 очереди',
  });
  assert.equal(bonusPayload.initialCountdownSeconds, 14399);
  assert.equal(bonusPayload.isBonusProductionUnlocked, true);
  assert.equal(bonusPayload.initialProductionSelection, 'bonus_express_24h');

  const bonusTotals = computeReservationTotalsForSelection(bonusPayload, 'bonus_express_24h');
  assert.equal(bonusTotals.spotStatusLabel, 'Экспресс-продакшн за 24ч — 0 ₽ Бонус');
  assert.equal(bonusTotals.productionPriceRub, 0);
  assert.equal(bonusTotals.unifiedTotalRub, bonusPayload.hotAirTotal);

  const sub400kPlan = buildOptimalMediaGrid('fmcg_retail', 250_000, '15', {
    layaPersona: 'fmcg',
    slots: DEFAULT_RADIO_INVENTORY_SLOTS,
  });
  const sub400kPayload = buildMediaReservationPayload({
    plan: sub400kPlan,
    nicheLabel: 'Продукты и Ритейл',
    productNote: '',
  });
  assert.equal(sub400kPayload.isBonusProductionUnlocked, false);
  assert.equal(
    computeReservationTotalsForSelection(sub400kPayload, 'voice_style').unifiedTotalRub,
    sub400kPayload.hotAirTotal + 15_000
  );
  assert.equal(
    computeReservationTotalsForSelection(sub400kPayload, 'turnkey').unifiedTotalRub,
    sub400kPayload.hotAirTotal + 25_000
  );
  assert.equal(
    computeReservationTotalsForSelection(sub400kPayload, 'cinema').unifiedTotalRub,
    sub400kPayload.hotAirTotal + 35_000
  );

  // 4. Structured hold specification text for copy & download
  const specText = formatBookingSpecificationText({
    orderNumber: 'FM-HOLD-2850',
    payload: bonusPayload,
    totals: bonusTotals,
    contact: 'Алексей +7 999 123-45-67',
    companyRequisites: 'ИНН 7701234567 · ООО Свет Девелопмент',
    briefText: 'Старт продаж видовых квартир',
    hasVoice: true,
    voiceSec: 18,
    requisitesFileName: 'requisites_svet.pdf',
  });
  assert.equal(specText.includes('#FM-HOLD-2850'), true);
  assert.equal(specText.includes('4-часовой холд'), true);
  assert.equal(specText.includes('20 минут'), true);
  assert.equal(specText.includes('Экспресс-продакшн за 24ч — 0 ₽ Бонус'), true);
  assert.equal(specText.includes('ИНН 7701234567'), true);
  assert.equal(specText.includes('requisites_svet.pdf'), true);
});

