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
import { EDITORIAL_FAQ_ITEMS, toggleFaqItem } from '../data/faqData';
import {
  EDITORIAL_PRICING_ROWS,
  generateOrderNumber,
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

  // Verify all 3 brand case photographic covers
  assert.ok(BRAND_CASES[0].coverImageUrl.includes('photo-1495474472287-4d71bcdd2085'));
  assert.ok(BRAND_CASES[1].coverImageUrl.includes('photo-1545324418-cc1a3fa10c00'));
  assert.ok(BRAND_CASES[2].coverImageUrl.includes('photo-1629909613654-28e377c37b09'));
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
  assert.equal(QUICK_ORDER_PILLS.length, 4);
  assert.equal(QUICK_ORDER_PILLS[3].id, 'adaptation');

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
  assert.match(generateOrderNumber(12345), /^AW-\d{4}$/);
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
  assert.ok(KOTO_MIC_WIDGET_IMAGE.includes('photo-1590602847861-f357a9332bbc'));

  // Verify Case share deep-link URL generation & parsing
  assert.equal(
    buildCaseShareUrl('https://audioworks.ru/?persona=real_estate#top', 'business-estate'),
    'https://audioworks.ru/?persona=real_estate&case=business-estate#case-business-estate'
  );
  assert.equal(readSharedCaseIdFromLocation('?case=dmitrogorsky', ''), 'dmitrogorsky');
  assert.equal(readSharedCaseIdFromLocation('', '#case-medical-clinics'), 'medical-clinics');
  assert.equal(readSharedCaseIdFromLocation('?case=unknown', '#top'), null);

  assert.deepEqual(
    APPROACH_PILLARS.map((p) => p.number),
    ['01', '02', '03']
  );
  assert.ok(APPROACH_STUDIO_PHOTO.imageUrl.includes('photo-1590602847861-f357a9332bbc'));
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

test('BrandLogo & Brand Kit AudioWorks: generates pure vector SVGs, dynamic oscillogram W wave, and 4-spec asset kit across 3 domain marks', async () => {
  const {
    BRAND_DOMAIN_OPTIONS,
    buildAvatarIconSvgMarkup,
    buildBrandLogoSvgMarkup,
    computeMonogramPaths,
    computeOscillogramWPath,
    getBrandKitAssetSpecs,
    getBrandWordmarkGeometry,
  } = await import('../data/brandKitData');

  assert.deepEqual(
    BRAND_DOMAIN_OPTIONS.map((o) => o.label),
    ['AudioWorks®', 'AudioWorks.pro', 'AirWorks®']
  );

  // Oscillogram W smoothly changes amplitude on hover vs idle
  const geomDefault = getBrandWordmarkGeometry('audioworks_reg');
  const idleWave = computeOscillogramWPath(geomDefault.waveStartX, 0, 0);
  const hoverWaveA = computeOscillogramWPath(geomDefault.waveStartX, 1, 0.7);
  const hoverWaveB = computeOscillogramWPath(geomDefault.waveStartX, 1, 2.1);
  assert.notEqual(idleWave, hoverWaveA);
  assert.notEqual(hoverWaveA, hoverWaveB);

  // Monogram 3 asymmetric acoustic lines also respond to hover energy
  const idleMono = computeMonogramPaths(0, 0);
  const hoverMono = computeMonogramPaths(1, 0.9);
  assert.equal(idleMono.length, 3);
  assert.notDeepEqual(idleMono, hoverMono);

  // Canonical file names for default AudioWorks®
  const defaultSpecs = getBrandKitAssetSpecs('audioworks_reg');
  assert.deepEqual(
    defaultSpecs.map((s) => [s.svgFileName, s.pngFileName, s.pngWidth, s.pngHeight]),
    [
      ['audioworks-logo-dark.svg', 'audioworks-logo-dark.png', 2400, 800],
      ['audioworks-logo-light.svg', 'audioworks-logo-light.png', 2400, 800],
      ['audioworks-avatar-icon.svg', 'audioworks-avatar-icon.png', 1000, 1000],
    ]
  );

  // Standalone exported SVGs contain explicit dimensions, #FF4820 accent, and no currentColor leaks
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
    assert.ok(darkSvg.includes('#111111'));
    assert.ok(darkSvg.includes('#FF4820'));
    assert.equal(darkSvg.includes('currentColor'), false);

    assert.ok(lightSvg.includes('width="2400" height="800"'));
    assert.ok(lightSvg.includes('#FFFFFF'));
    assert.ok(lightSvg.includes('#FF4820'));
    assert.equal(lightSvg.includes('currentColor'), false);

    assert.ok(avatarSvg.includes('width="1000" height="1000"'));
    assert.ok(avatarSvg.includes('#FF4820'));
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
    filterSiteTextBlocks(STATIC_SITE_TEXT_BLOCKS, 'all', 'фиксированная смета').length,
    1
  );

  // Zero banned editorial terms across the entire static content array
  const dump = JSON.stringify(STATIC_SITE_TEXT_BLOCKS).toLowerCase();
  for (const term of BANNED_EDITORIAL_TERMS) {
    assert.equal(dump.includes(term), false, `Found banned term in static blocks: ${term}`);
  }

  // Real-time update in session memory across Hero, Approach, and Pricing
  siteTextBlocksStore.updateBlock('hero-manifesto', {
    title: 'Студия AudioWorks.',
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
  assert.equal(editedHero.title, 'Студия AudioWorks.');
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
    'Мы AudioWorks.'
  );
});
