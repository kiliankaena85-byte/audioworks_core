import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterVoiceArchetypes,
  formatVoiceSelectionSummary,
  getVoiceArchetypeById,
  isValidVoiceArchetypeId,
  toVoiceDemoCasePoster,
  VOICE_ARCHETYPES_CATALOG,
} from './voiceCastingCatalog';

test('VOICE_ARCHETYPES_CATALOG exposes 6 studio archetypes with local audio clips and valid windows', () => {
  assert.equal(VOICE_ARCHETYPES_CATALOG.length, 6);
  for (const voice of VOICE_ARCHETYPES_CATALOG) {
    assert.equal(isValidVoiceArchetypeId(voice.id), true);
    assert.ok(voice.demoClipEndSec > voice.demoClipStartSec);
    const poster = toVoiceDemoCasePoster(voice);
    assert.equal(Boolean(poster.audioUrl?.startsWith('/')), true);
    assert.equal(Boolean(poster.coverImageUrl.startsWith('/')), true);
    assert.ok(poster.durationSec >= 8);
  }
});

test('filterVoiceArchetypes filters by gender and industry tags accurately', () => {
  const male = filterVoiceArchetypes('male');
  assert.ok(male.length >= 2);
  assert.equal(
    male.every((v) => v.genderKind === 'male'),
    true
  );

  const duo = filterVoiceArchetypes('duo');
  assert.equal(duo.length, 1);
  assert.equal(duo[0]?.id, 'dubbing_scene_duo');

  assert.equal(getVoiceArchetypeById('unknown-voice'), null);
  assert.ok(formatVoiceSelectionSummary('federal_baritone')?.includes('CAST-01'));
});
