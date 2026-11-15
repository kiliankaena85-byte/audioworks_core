import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assignPortfolioCaseToHeroStage,
  buildShowcaseScenesMap,
  createDefaultHeroStageCmsConfig,
  normalizeHeroStageCmsConfig,
  resolveHeroStagePlayback,
  sanitizeHeroStageForSessionStorage,
} from './heroStageCms';
import {
  createDefaultStudioCmsSnapshot,
  validateAndNormalizeCmsSnapshot,
} from './studioCmsTypes';

test('HeroStageCMS: default snapshot resolves to factory 3-phase crash test (4.0s clutter -> 0.5s pause -> FMWorks reel)', () => {
  const snap = createDefaultStudioCmsSnapshot();
  const resolved = resolveHeroStagePlayback(snap, 'default');

  assert.equal(resolved.isCustomized, false);
  assert.equal(resolved.clutter.mode, 'builtin_stream');
  assert.equal(resolved.clutter.durationSec, 4);
  assert.equal(resolved.stopPauseDurationSec, 0.5);
  assert.equal(resolved.totalIntroDurationSec, 4.5);
  assert.equal(resolved.focus.sourceKind, 'default_reel');
  assert.equal(resolved.focus.startSec, 6.1);
  assert.equal(resolved.focus.activePersonaOverride, null);
});

test('HeroStageCMS: custom uploaded WAV/MP3 for Hero Phase C resolves cleanly and persists via validateAndNormalizeCmsSnapshot', () => {
  const base = createDefaultStudioCmsSnapshot();
  const candidate = {
    ...base,
    heroStage: {
      ...base.heroStage,
      clutterSourceMode: 'custom_upload' as const,
      clutterAudioUrl: '/assets/cms/regional-clutter-block.wav',
      clutterAudioFileName: 'regional-clutter-block.wav',
      clutterDurationSec: 3.5,
      stopPauseDurationSec: 0.6,
      focusSourceMode: 'custom_upload' as const,
      focusAudioUrl: '/assets/cms/hero-new-spot-2026.wav',
      focusAudioFileName: 'hero-new-spot-2026.wav',
      focusDurationSec: 18,
      focusStartSec: 0.4,
      focusCustomLabel: 'Премьера недели · ЖК Лесной Берег',
    },
  };

  const validated = validateAndNormalizeCmsSnapshot(candidate);
  assert.equal(validated.ok, true);
  if (!validated.ok) return;

  const resolved = resolveHeroStagePlayback(validated.data, 'default');
  assert.equal(resolved.isCustomized, true);
  assert.equal(resolved.clutter.mode, 'custom_upload');
  assert.equal(resolved.clutter.audioUrl, '/assets/cms/regional-clutter-block.wav');
  assert.equal(resolved.clutter.durationSec, 3.5);
  assert.equal(resolved.stopPauseDurationSec, 0.6);
  assert.equal(resolved.totalIntroDurationSec, 4.1);
  assert.equal(resolved.focus.sourceKind, 'custom_upload');
  assert.equal(resolved.focus.audioUrl, '/assets/cms/hero-new-spot-2026.wav');
  assert.equal(resolved.focus.fileName, 'hero-new-spot-2026.wav');
  assert.equal(resolved.focus.startSec, 0.4);
  assert.equal(resolved.focus.durationSec, 18);
  assert.equal(resolved.focus.label, 'Премьера недели · ЖК Лесной Берег');
});

test('HeroStageCMS: 1-click portfolio case assignment links Hero to case audio and falls back safely if case is deleted', () => {
  const snap = createDefaultStudioCmsSnapshot();
  const targetCase = {
    ...snap.portfolioCases[1],
    audioUrl: '/assets/cms/estate-master-20s.wav',
    customAudioFileName: 'estate-master-20s.wav',
    clipStartSec: 1.2,
    clipEndSec: 16.2,
    durationSec: 15,
  };

  const nextHero = assignPortfolioCaseToHeroStage(snap.heroStage, targetCase);
  const updatedSnap = {
    ...snap,
    portfolioCases: snap.portfolioCases.map((c) =>
      c.id === targetCase.id ? targetCase : c
    ),
    heroStage: nextHero,
  };

  const resolved = resolveHeroStagePlayback(updatedSnap, 'default');
  assert.equal(resolved.focus.sourceKind, 'portfolio_case');
  assert.equal(resolved.focus.linkedCaseId, targetCase.id);
  assert.equal(resolved.focus.audioUrl, '/assets/cms/estate-master-20s.wav');
  assert.equal(resolved.focus.startSec, 1.2);
  assert.equal(resolved.focus.endSec, 16.2);
  assert.equal(resolved.focus.durationSec, 15);

  // If the linked case is later removed, Hero gracefully falls back to factory default reel
  const snapWithoutCase = {
    ...updatedSnap,
    portfolioCases: updatedSnap.portfolioCases.filter(
      (c) => c.id !== targetCase.id
    ),
  };
  const fallbackResolved = resolveHeroStagePlayback(snapWithoutCase, 'default');
  assert.equal(fallbackResolved.focus.sourceKind, 'default_reel');
});

test('HeroStageCMS: Step-100 industry persona override activates only for matching Laya persona when enabled', () => {
  const snap = createDefaultStudioCmsSnapshot();
  const estateCase = {
    ...snap.portfolioCases.find((c) => c.id === 'business-estate')!,
    audioUrl: '/assets/cms/quarter-residence.wav',
    customAudioFileName: 'quarter-residence.wav',
    durationSec: 20,
  };

  const heroWithPersona = assignPortfolioCaseToHeroStage(
    snap.heroStage,
    estateCase,
    'real_estate'
  );
  const nextSnap = {
    ...snap,
    portfolioCases: snap.portfolioCases.map((c) =>
      c.id === estateCase.id ? estateCase : c
    ),
    heroStage: heroWithPersona,
  };

  const guestResolved = resolveHeroStagePlayback(nextSnap, 'default');
  assert.equal(guestResolved.focus.sourceKind, 'default_reel');
  assert.equal(guestResolved.focus.activePersonaOverride, null);

  const estateResolved = resolveHeroStagePlayback(nextSnap, 'real_estate');
  assert.equal(estateResolved.focus.sourceKind, 'persona_override');
  assert.equal(estateResolved.focus.activePersonaOverride, 'real_estate');
  assert.equal(estateResolved.focus.audioUrl, '/assets/cms/quarter-residence.wav');
});

test('HeroStageCMS: backward compatibility with legacy CMS snapshots missing heroStage & session blob sanitization', () => {
  const legacyPayload = {
    ...createDefaultStudioCmsSnapshot(),
    heroStage: undefined,
  };
  const validated = validateAndNormalizeCmsSnapshot(legacyPayload);
  assert.equal(validated.ok, true);
  if (validated.ok) {
    assert.equal(validated.data.heroStage.focusSourceMode, 'default_reel');
    assert.equal(validated.data.heroStage.clutterDurationSec, 4);
  }

  const baseline = createDefaultHeroStageCmsConfig();
  const dirtyBlobHero = normalizeHeroStageCmsConfig({
    ...baseline,
    focusSourceMode: 'custom_upload',
    focusAudioUrl: 'blob:http://localhost:3000/ephemeral-123',
    focusAudioFileName: 'temp.wav',
  });
  const sanitized = sanitizeHeroStageForSessionStorage(dirtyBlobHero, baseline);
  assert.equal(sanitized.focusAudioUrl, undefined);
  assert.equal(sanitized.focusSourceMode, 'default_reel');

  const mapItems = buildShowcaseScenesMap(createDefaultStudioCmsSnapshot());
  assert.equal(mapItems.length, 3);
  assert.deepEqual(
    mapItems.map((m) => m.id),
    ['hero_stage', 'portfolio', 'duel']
  );
});
