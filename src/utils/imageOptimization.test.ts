import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  buildWebpOutputFilePath,
  deriveResponsiveWebpSrcSet,
  deriveWebpUrl,
  resolveImageLoadingProps,
  STUDIO_RESPONSIVE_WEBP_TIERS,
} from './imageOptimization.ts';

test('deriveWebpUrl преобразует локальные JPEG/PNG пути в .webp и пропускает внешние URL, SVG и data URI', () => {
  assert.equal(
    deriveWebpUrl('/src/assets/images/hero_studio_editorial_1794399404984.jpg'),
    '/src/assets/images/hero_studio_editorial_1794399404984.webp'
  );
  assert.equal(
    deriveWebpUrl('/assets/cms/case-cover-1731570000000.png?v=2'),
    '/assets/cms/case-cover-1731570000000.webp?v=2'
  );
  assert.equal(
    deriveWebpUrl('/src/assets/images/hero_studio_editorial_1794399404984.webp'),
    null
  );
  assert.equal(deriveWebpUrl('/src/assets/logo.svg'), null);
  assert.equal(deriveWebpUrl('https://example.com/photo.jpg'), null);
  assert.equal(deriveWebpUrl('data:image/png;base64,iVBORw0KGgo='), null);
  assert.equal(deriveWebpUrl(''), null);
});

test('deriveResponsiveWebpSrcSet формирует адаптивные 480w/800w/1280w WebP для студийных фото и одиночный WebP для аватаров/CMS', () => {
  const heroSet = deriveResponsiveWebpSrcSet(
    '/src/assets/images/hero_studio_editorial_1794399404984.jpg'
  );
  assert.deepEqual(heroSet, {
    isMultiWidth: true,
    srcSet:
      '/src/assets/images/hero_studio_editorial_1794399404984-480w.webp 480w, /src/assets/images/hero_studio_editorial_1794399404984-800w.webp 800w, /src/assets/images/hero_studio_editorial_1794399404984.webp 1280w',
  });

  const avatarSet = deriveResponsiveWebpSrcSet(
    '/src/assets/images/avatar_vermilion_wave_1794695842553.jpg'
  );
  assert.deepEqual(avatarSet, {
    isMultiWidth: false,
    srcSet: '/src/assets/images/avatar_vermilion_wave_1794695842553.webp',
  });

  const cmsSet = deriveResponsiveWebpSrcSet('/assets/cms/cover.png?v=5');
  assert.deepEqual(cmsSet, {
    isMultiWidth: false,
    srcSet: '/assets/cms/cover.webp?v=5',
  });
});

test('resolveImageLoadingProps по умолчанию задаёт loading="lazy" и decoding="async"', () => {
  assert.deepEqual(resolveImageLoadingProps(), {
    loading: 'lazy',
    decoding: 'async',
    fetchPriority: 'auto',
  });

  assert.deepEqual(resolveImageLoadingProps({ priority: true }), {
    loading: 'eager',
    decoding: 'async',
    fetchPriority: 'high',
  });

  assert.deepEqual(
    resolveImageLoadingProps({ priority: true, loading: 'lazy', fetchPriority: 'low' }),
    {
      loading: 'lazy',
      decoding: 'async',
      fetchPriority: 'low',
    }
  );
});

test('buildWebpOutputFilePath и все студийные .jpg изображения в src/assets/images имеют сгенерированные адаптивные .webp версии', () => {
  assert.equal(
    buildWebpOutputFilePath('/tmp/cover.JPEG'),
    '/tmp/cover.webp'
  );
  assert.equal(buildWebpOutputFilePath('/tmp/vector.svg'), null);

  const imagesDir = path.resolve(process.cwd(), 'src', 'assets', 'images');
  const entries = fs.readdirSync(imagesDir);
  const rasterFiles = entries.filter((name) => /\.(jpe?g|png)$/i.test(name));
  assert.ok(rasterFiles.length > 0);

  for (const file of rasterFiles) {
    const webpName = file.replace(/\.(jpe?g|png)$/i, '.webp');
    const webpAbs = path.join(imagesDir, webpName);
    assert.equal(
      fs.existsSync(webpAbs),
      true,
      `Ожидалась WebP-версия для ${file}: ${webpName}`
    );
    assert.ok(fs.statSync(webpAbs).size > 0);

    if (!file.startsWith('avatar_')) {
      for (const tier of STUDIO_RESPONSIVE_WEBP_TIERS) {
        const tierName = file.replace(/\.(jpe?g|png)$/i, `-${tier}w.webp`);
        const tierAbs = path.join(imagesDir, tierName);
        assert.equal(
          fs.existsSync(tierAbs),
          true,
          `Ожидался адаптивный WebP ${tier}w для ${file}: ${tierName}`
        );
        assert.ok(fs.statSync(tierAbs).size > 0);
      }
    }
  }
});
