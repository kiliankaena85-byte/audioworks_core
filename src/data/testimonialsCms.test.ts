import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditEditorialCopyGuardrails,
  BANNED_EDITORIAL_TERMS,
  createDefaultStudioCmsSnapshot,
  validateAndNormalizeCmsSnapshot,
} from './studioCmsTypes';
import {
  computeTestimonialFilterCounts,
  countLocalTestimonialsChanges,
  createDefaultTestimonialsCmsConfig,
  createNewCmsTestimonialRecord,
  deriveAuthorInitials,
  getPublishedCmsTestimonialsForFilterAndPersona,
  reorderCmsTestimonials,
  resolveTestimonialLinkedCase,
} from './testimonialsCms';

test('StudioCMS Testimonials: default snapshot passes validation and contains zero banned editorial terms', () => {
  const snapshot = createDefaultStudioCmsSnapshot();
  assert.equal(snapshot.testimonials.items.length, 4);
  assert.equal(snapshot.testimonials.trustMetrics.length, 3);

  const validated = validateAndNormalizeCmsSnapshot(snapshot);
  assert.equal(validated.ok, true);
  if (validated.ok) {
    assert.deepEqual(validated.editorialWarnings, []);
  }

  const serialized = JSON.stringify(snapshot.testimonials).toLowerCase();
  for (const banned of BANNED_EDITORIAL_TERMS) {
    assert.equal(
      serialized.includes(banned),
      false,
      `Found banned term "${banned}" in default StudioCMS testimonials`
    );
  }
});

test('StudioCMS Testimonials: backward-compatible migration hydrates legacy CMS snapshots without testimonials field', () => {
  const fullDefault = createDefaultStudioCmsSnapshot();
  const legacyPayload: Record<string, unknown> = { ...fullDefault };
  delete legacyPayload.testimonials;

  const parsed = validateAndNormalizeCmsSnapshot(legacyPayload);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.data.testimonials.items.length, 4);
    assert.equal(parsed.data.testimonials.eyebrow, 'Отзывы клиентов');
    assert.equal(parsed.data.testimonials.items[0]?.id, 'dmitrogorsky-fmcg');
  }
});

test('StudioCMS Testimonials: rejects unpublishing every testimonial and audits editorial guardrails', () => {
  const snapshot = createDefaultStudioCmsSnapshot();
  const allUnpublished = {
    ...snapshot,
    testimonials: {
      ...snapshot.testimonials,
      items: snapshot.testimonials.items.map((item) => ({
        ...item,
        published: false,
      })),
    },
  };

  const rejected = validateAndNormalizeCmsSnapshot(allUnpublished);
  assert.equal(rejected.ok, false);
  if (!rejected.ok) {
    assert.match(rejected.error, /один опубликованный отзыв/);
  }

  const withBannedToponym = {
    ...snapshot,
    testimonials: {
      ...snapshot.testimonials,
      subheading: 'Отзывы федеральных рекламодателей из Москвы и регионов.',
    },
  };
  const warnings = auditEditorialCopyGuardrails(withBannedToponym);
  assert.equal(warnings.includes('москв'), true);
});

test('StudioCMS Testimonials: dynamic filtering, Laya AI persona ordering, and filter counts respect published flag', () => {
  const config = createDefaultTestimonialsCmsConfig();
  const newReview = {
    ...createNewCmsTestimonialRecord(config.items),
    id: 'custom-estate-tower',
    category: 'real_estate' as const,
    authorName: 'Ольга Сафонова',
    initials: deriveAuthorInitials('Ольга Сафонова'),
  };
  assert.equal(newReview.initials, 'ОС');

  const updatedConfig = {
    ...config,
    items: [
      ...config.items.map((item) =>
        item.id === 'veramed-clinics' ? { ...item, published: false } : item
      ),
      newReview,
    ],
  };

  const counts = computeTestimonialFilterCounts(updatedConfig);
  assert.equal(counts.all, 4);
  assert.equal(counts.real_estate, 2);
  assert.equal(counts.medical, 0);

  // Persona real_estate puts real_estate items at the lead
  const estateOrdered = getPublishedCmsTestimonialsForFilterAndPersona(
    updatedConfig,
    'all',
    'real_estate'
  );
  assert.equal(estateOrdered[0]?.category, 'real_estate');
  assert.equal(estateOrdered[1]?.category, 'real_estate');
  assert.equal(
    estateOrdered.some((item) => item.id === 'veramed-clinics'),
    false
  );

  // Persona returning_vip puts fast_launch lead
  const vipOrdered = getPublishedCmsTestimonialsForFilterAndPersona(
    updatedConfig,
    'all',
    'returning_vip'
  );
  assert.equal(vipOrdered[0]?.id, 'zerno-fast-launch');

  // Specific category filter
  const medicalFiltered = getPublishedCmsTestimonialsForFilterAndPersona(
    updatedConfig,
    'medical',
    'default'
  );
  assert.equal(medicalFiltered.length, 0);
});

test('StudioCMS Testimonials: resolves linked portfolio audio cases and tracks local CMS changes & reordering', () => {
  const baseline = createDefaultStudioCmsSnapshot();
  const firstReview = baseline.testimonials.items[0]!;
  const linkedCase = resolveTestimonialLinkedCase(
    firstReview,
    baseline.portfolioCases,
    baseline.flagshipReel
  );
  assert.ok(linkedCase);
  assert.equal(linkedCase.id, 'dmitrogorsky');

  // Unpublished portfolio case should not resolve as playable
  const unpublishedCases = baseline.portfolioCases.map((c) =>
    c.id === 'dmitrogorsky' ? { ...c, published: false } : c
  );
  assert.equal(
    resolveTestimonialLinkedCase(
      firstReview,
      unpublishedCases,
      baseline.flagshipReel
    ),
    null
  );

  // Reorder testimonials up/down
  const reordered = reorderCmsTestimonials(baseline.testimonials.items, 1, 'up');
  assert.equal(reordered[0]?.id, 'forma-estate');
  assert.equal(reordered[0]?.sortOrder, 1);
  assert.equal(reordered[1]?.id, 'dmitrogorsky-fmcg');
  assert.equal(reordered[1]?.sortOrder, 2);

  // Local changes diff count
  assert.equal(countLocalTestimonialsChanges(baseline, baseline), 0);
  const modifiedSnap = {
    ...baseline,
    testimonials: {
      ...baseline.testimonials,
      headingPrimary: 'Обновлённый заголовок отзывов',
      items: reordered,
    },
  };
  assert.equal(countLocalTestimonialsChanges(modifiedSnap, baseline) >= 2, true);
});
