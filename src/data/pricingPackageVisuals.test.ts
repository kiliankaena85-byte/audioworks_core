import assert from 'node:assert/strict';
import test from 'node:test';
import { BANNED_EDITORIAL_TERMS } from './studioCmsTypes';
import {
  buildRadarPolygonPoints,
  computeChronometryStructureForPackage,
  getPricingPackageVisualSpec,
  PRICING_PACKAGE_VISUAL_SPECS,
  SUPPORTED_SPOT_DURATIONS_SEC,
} from './pricingPackageVisuals';

test('PRICING_PACKAGE_VISUAL_SPECS: корректная структура 4 пакетов по хронометражу, сложности и срокам', () => {
  assert.equal(PRICING_PACKAGE_VISUAL_SPECS.length, 4);

  const voice = getPricingPackageVisualSpec('voice_style');
  const turnkey = getPricingPackageVisualSpec('turnkey');
  const cinema = getPricingPackageVisualSpec('cinema');
  const custom = getPricingPackageVisualSpec('custom_consult');

  // Проверка прогрессии цен и сложности от базового пакета к игровому мини-кино
  assert.equal(voice.priceRub, 15_000);
  assert.equal(turnkey.priceRub, 25_000);
  assert.equal(cinema.priceRub, 35_000);
  assert.equal(custom.isNegotiable, true);

  assert.ok(voice.complexity.overallScore < turnkey.complexity.overallScore);
  assert.ok(turnkey.complexity.overallScore < cinema.complexity.overallScore);

  // Проверка прогрессии стандартных сроков выпуска (часы)
  assert.ok(voice.turnaroundHoursMax < turnkey.turnaroundHoursMax);
  assert.ok(turnkey.turnaroundHoursMax < cinema.turnaroundHoursMax);
  assert.equal(voice.supportsUrgent1Hour, true);
  assert.equal(custom.supportsUrgent1Hour, true);
  assert.equal(cinema.chronometry.includes15sResize, true);

  for (const spec of PRICING_PACKAGE_VISUAL_SPECS) {
    assert.equal(spec.complexity.axes.length, 4);
    assert.equal(spec.timeline.phases.length, 4);
    const totalShare = spec.timeline.phases.reduce(
      (sum, p) => sum + p.sharePercent,
      0
    );
    assert.equal(
      totalShare,
      100,
      `Сумма долей фаз времени для ${spec.id} должна быть равна 100%`
    );
  }
});

test('computeChronometryStructureForPackage: расчёт посекундной структуры ролика (15–30 сек) и цены секунды', () => {
  for (const durationSec of SUPPORTED_SPOT_DURATIONS_SEC) {
    const withDisclaimer = computeChronometryStructureForPackage(
      'turnkey',
      durationSec,
      true
    );
    assert.equal(withDisclaimer.targetDurationSec, durationSec);
    assert.equal(withDisclaimer.segments.length, 4);
    assert.equal(
      withDisclaimer.segments.reduce((acc, s) => acc + s.sharePercent, 0),
      100
    );
    assert.equal(
      withDisclaimer.pricePerSecondRub,
      Math.round(25_000 / durationSec)
    );

    const withoutDisclaimer = computeChronometryStructureForPackage(
      'turnkey',
      durationSec,
      false
    );
    assert.equal(withoutDisclaimer.segments.length, 3);
    assert.equal(
      withoutDisclaimer.segments.reduce((acc, s) => acc + s.sharePercent, 0),
      100
    );
  }

  const cinema30 = computeChronometryStructureForPackage('cinema', 30, true);
  assert.equal(cinema30.isWithinRecommendedRange, true);
  assert.ok(cinema30.recommendedAdjustmentNote.includes('ресайз 15 сек'));
});

test('buildRadarPolygonPoints: генерация 4-осевого SVG многоугольника для радара сложности', () => {
  const voiceSpec = getPricingPackageVisualSpec('voice_style');
  const cinemaSpec = getPricingPackageVisualSpec('cinema');

  const voiceRadar = buildRadarPolygonPoints(voiceSpec.complexity.axes, 110, 74);
  const cinemaRadar = buildRadarPolygonPoints(
    cinemaSpec.complexity.axes,
    110,
    74
  );

  assert.equal(voiceRadar.vertices.length, 4);
  assert.equal(cinemaRadar.vertices.length, 4);
  assert.notEqual(voiceRadar.polygonPoints, cinemaRadar.polygonPoints);

  // Верхняя вершина (script_depth): у cinema она выше (меньше координата Y от центра 110)
  assert.ok(cinemaRadar.vertices[0].y < voiceRadar.vertices[0].y);
  // Правая вершина (voice_acting): у cinema она правее (больше координата X от центра 110)
  assert.ok(cinemaRadar.vertices[1].x > voiceRadar.vertices[1].x);
});

test('Тексты интерактивных графиков пакетов не содержат запрещённых редакционных штампов и гео-привязок', () => {
  const serialized = JSON.stringify(PRICING_PACKAGE_VISUAL_SPECS).toLowerCase();
  for (const banned of BANNED_EDITORIAL_TERMS) {
    assert.equal(
      serialized.includes(banned),
      false,
      `Обнаружен запрещённый термин в pricingPackageVisuals: ${banned}`
    );
  }
});
