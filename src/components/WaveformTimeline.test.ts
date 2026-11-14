import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clampSeekRatioToSeconds,
  computeWaveformTimelineGeometry,
  createDefault150sSegments,
  DEFAULT_BLOCK_DURATION_SEC,
  DEFAULT_TIMELINE_SAMPLE_COUNT,
  SEGMENT_VISUAL_PROFILES,
  TIMELINE_VIEWBOX_WIDTH,
} from './WaveformTimeline';

test('WaveformTimeline строит 150-секундную дорожку по умолчанию с 8 сегментами и непрерывными SVG-кривыми', () => {
  const defaultSegments = createDefault150sSegments();
  assert.equal(defaultSegments.length, 8);
  assert.equal(
    defaultSegments[defaultSegments.length - 1].endSec,
    DEFAULT_BLOCK_DURATION_SEC
  );

  const geo = computeWaveformTimelineGeometry({});
  assert.equal(geo.totalDurationSec, 150);
  assert.equal(geo.samples.length, DEFAULT_TIMELINE_SAMPLE_COUNT);
  assert.equal(geo.segmentLayers.length, 8);
  assert.ok(geo.upperCrestPath.includes(' C '));
  assert.ok(geo.lowerCrestPath.includes(' C '));
  assert.ok(geo.closedAreaPath.endsWith(' Z'));

  // Координаты X монотонно возрастают от 0 до ширины viewBox
  assert.equal(geo.samples[0].x, 0);
  assert.equal(geo.samples[geo.samples.length - 1].x, TIMELINE_VIEWBOX_WIDTH);
  for (let i = 1; i < geo.samples.length; i++) {
    assert.ok(geo.samples[i].x > geo.samples[i - 1].x);
    assert.ok(geo.samples[i].amplitude >= 0.08 && geo.samples[i].amplitude <= 0.97);
  }
});

test('WaveformTimeline разделяет эфир, склейку, рекламу конкурентов и целевой ролик цветом и амплитудой', () => {
  // 1. Уникальная цветовая кодировка каждого типа сегмента
  const idleColors = new Set([
    SEGMENT_VISUAL_PROFILES.program.idleCrestStroke,
    SEGMENT_VISUAL_PROFILES.splice.idleCrestStroke,
    SEGMENT_VISUAL_PROFILES.competitor.idleCrestStroke,
    SEGMENT_VISUAL_PROFILES.target.idleCrestStroke,
  ]);
  assert.equal(idleColors.size, 4);

  const playedColors = new Set([
    SEGMENT_VISUAL_PROFILES.program.playedCrestStroke,
    SEGMENT_VISUAL_PROFILES.splice.playedCrestStroke,
    SEGMENT_VISUAL_PROFILES.competitor.playedCrestStroke,
    SEGMENT_VISUAL_PROFILES.target.playedCrestStroke,
  ]);
  assert.equal(playedColors.size, 4);

  // 2. Акустический контраст амплитуд между типами сегментов
  const sculptedGeo = computeWaveformTimelineGeometry({
    spotMode: 'fmworks_example',
    sampleCount: 300,
  });

  const meanOfKind = (kind: 'program' | 'splice' | 'competitor' | 'target') => {
    const matching = sculptedGeo.samples.filter((s) => s.kind === kind);
    assert.ok(matching.length > 0, `Должны присутствовать сэмплы типа ${kind}`);
    return matching.reduce((acc, s) => acc + s.amplitude, 0) / matching.length;
  };

  const meanProgram = meanOfKind('program');
  const meanSplice = meanOfKind('splice');
  const meanCompetitor = meanOfKind('competitor');

  // Плотный рекламный блок конкурентов и отбивка громче спокойной разговорной студии
  assert.ok(
    meanCompetitor > meanProgram + 0.2,
    `Сжатая реклама конкурентов (${meanCompetitor.toFixed(2)}) должна быть плотнее эфира (${meanProgram.toFixed(2)})`
  );
  assert.ok(
    meanSplice > meanProgram + 0.2,
    `Рекламная склейка (${meanSplice.toFixed(2)}) должна выделяться относительно эфира (${meanProgram.toFixed(2)})`
  );

  // 3. В целевом слоте эталона/клиента видна стартовая воздушная пауза, а в шаблоне — плоский кирпич
  const targetSculpted = sculptedGeo.samples.filter((s) => s.kind === 'target');
  const minSculptedTarget = Math.min(...targetSculpted.map((s) => s.amplitude));
  const maxSculptedTarget = Math.max(...targetSculpted.map((s) => s.amplitude));
  assert.ok(
    minSculptedTarget <= 0.14,
    `Стартовая пауза целевого ролика должна опускаться <= 0.14, получено ${minSculptedTarget}`
  );
  assert.ok(
    maxSculptedTarget >= 0.7,
    `Пик целевого ролика должен подниматься >= 0.70, получено ${maxSculptedTarget}`
  );

  const clicheGeo = computeWaveformTimelineGeometry({
    spotMode: 'typical_cliche',
    sampleCount: 300,
  });
  const targetCliche = clicheGeo.samples.filter((s) => s.kind === 'target');
  const minClicheTarget = Math.min(...targetCliche.map((s) => s.amplitude));
  assert.ok(
    minClicheTarget >= 0.55,
    `Шаблонный ролик без паузы должен оставаться зажатым >= 0.55, получено ${minClicheTarget}`
  );
});

test('clampSeekRatioToSeconds точно переводит долю клика по шкале в секунды 150-секундного блока', () => {
  assert.equal(clampSeekRatioToSeconds(-0.3, 150), 0);
  assert.equal(clampSeekRatioToSeconds(0.5, 150), 75);
  assert.equal(clampSeekRatioToSeconds(1.4, 150), 150);
});
