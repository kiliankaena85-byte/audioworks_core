import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildSitemapXml,
  DEFAULT_SITEMAP_LASTMOD,
} from '../src/data/seoServerTemplates.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_SITEMAP_PATH = path.join(ROOT_DIR, 'public', 'sitemap.xml');

const xml = buildSitemapXml('https://fmworks.ru', {
  airtimeEnabled: false,
  lastmodIsoDate: DEFAULT_SITEMAP_LASTMOD,
});

fs.mkdirSync(path.dirname(PUBLIC_SITEMAP_PATH), { recursive: true });
fs.writeFileSync(PUBLIC_SITEMAP_PATH, xml, 'utf8');
console.log(
  `[SEO] Generated ${path.relative(ROOT_DIR, PUBLIC_SITEMAP_PATH)} (${Buffer.byteLength(xml, 'utf8')} bytes)`
);
