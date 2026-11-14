import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  buildWebpOutputFilePath,
  deriveWebpUrl,
  resolveImageLoadingProps,
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

test('buildWebpOutputFilePath и все студийные .jpg изображения в src/assets/images имеют сгенерированные .webp версии', () => {
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
  }
});
