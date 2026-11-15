import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clampTestimonialCarouselIndex,
  computeTestimonialFilterCounts,
  createDefaultTestimonialsCmsConfig,
  formatTestimonialCarouselCounter,
  getPublishedCmsTestimonialsForFilterAndPersona,
  resolveTestimonialCarouselSwipeDirection,
  shouldShowTestimonialCarouselControls,
  stepTestimonialCarouselIndex,
} from './testimonialsCms';

test('clampTestimonialCarouselIndex handles empty, negative, NaN, and out-of-range indices', () => {
  assert.equal(clampTestimonialCarouselIndex(0, 0), 0);
  assert.equal(clampTestimonialCarouselIndex(2, 0), 0);
  assert.equal(clampTestimonialCarouselIndex(-3, 4), 0);
  assert.equal(clampTestimonialCarouselIndex(9, 4), 3);
  assert.equal(clampTestimonialCarouselIndex(Number.NaN, 4), 0);
  assert.equal(clampTestimonialCarouselIndex(2.8, 4), 2);
});

test('stepTestimonialCarouselIndex wraps around cleanly in both directions', () => {
  assert.equal(stepTestimonialCarouselIndex(0, 4, 'next'), 1);
  assert.equal(stepTestimonialCarouselIndex(3, 4, 'next'), 0);
  assert.equal(stepTestimonialCarouselIndex(0, 4, 'prev'), 3);
  assert.equal(stepTestimonialCarouselIndex(2, 4, 'prev'), 1);

  // Single or zero slides stay pinned at 0
  assert.equal(stepTestimonialCarouselIndex(0, 1, 'next'), 0);
  assert.equal(stepTestimonialCarouselIndex(0, 1, 'prev'), 0);
  assert.equal(stepTestimonialCarouselIndex(0, 0, 'next'), 0);
});

test('formatTestimonialCarouselCounter formats zero-padded tabular slide counters', () => {
  assert.equal(formatTestimonialCarouselCounter(0, 4), '01 / 04');
  assert.equal(formatTestimonialCarouselCounter(3, 4), '04 / 04');
  assert.equal(formatTestimonialCarouselCounter(12, 4), '04 / 04');
  assert.equal(formatTestimonialCarouselCounter(0, 0), '00 / 00');
});

test('shouldShowTestimonialCarouselControls and swipe gesture helper behave deterministically', () => {
  assert.equal(shouldShowTestimonialCarouselControls(0), false);
  assert.equal(shouldShowTestimonialCarouselControls(1), false);
  assert.equal(shouldShowTestimonialCarouselControls(2), true);

  assert.equal(resolveTestimonialCarouselSwipeDirection(-60), 'next');
  assert.equal(resolveTestimonialCarouselSwipeDirection(55), 'prev');
  assert.equal(resolveTestimonialCarouselSwipeDirection(-15), null);
  assert.equal(resolveTestimonialCarouselSwipeDirection(Number.NaN), null);
});

test('Studio CMS testimonials config feeds carousel filters, counts, and persona priority cleanly', () => {
  const cmsConfig = createDefaultTestimonialsCmsConfig();
  const counts = computeTestimonialFilterCounts(cmsConfig);
  assert.equal(counts.all, 4);
  assert.equal(counts.fmcg, 1);
  assert.equal(counts.real_estate, 1);
  assert.equal(counts.medical, 1);
  assert.equal(counts.fast_launch, 1);

  const realEstateFirst = getPublishedCmsTestimonialsForFilterAndPersona(
    cmsConfig,
    'all',
    'real_estate'
  );
  assert.equal(realEstateFirst[0].id, 'forma-estate');
  assert.equal(realEstateFirst.length, 4);

  // Unpublished CMS records are excluded dynamically
  const customized = {
    ...cmsConfig,
    items: cmsConfig.items.map((item) =>
      item.id === 'forma-estate' ? { ...item, published: false } : item
    ),
  };
  const updatedCounts = computeTestimonialFilterCounts(customized);
  assert.equal(updatedCounts.all, 3);
  assert.equal(updatedCounts.real_estate, 0);
  assert.equal(
    getPublishedCmsTestimonialsForFilterAndPersona(customized, 'real_estate', 'default').length,
    0
  );
});
