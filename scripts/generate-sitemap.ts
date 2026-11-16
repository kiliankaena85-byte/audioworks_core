import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildLlmsTxt,
  buildRobotsTxt,
  buildSitemapXml,
  DEFAULT_SITEMAP_LASTMOD,
} from '../src/data/seoServerTemplates.ts';
import { buildTurboPagesXml } from '../src/data/turboFeed.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_SITEMAP_PATH = path.join(ROOT_DIR, 'public', 'sitemap.xml');
const PUBLIC_ROBOTS_PATH = path.join(ROOT_DIR, 'public', 'robots.txt');
const PUBLIC_LLMS_PATH = path.join(ROOT_DIR, 'public', 'llms.txt');
const PUBLIC_TURBO_PATH = path.join(ROOT_DIR, 'public', 'turbo-pages.xml');

const xml = buildSitemapXml('https://fmworks.ru', {
  airtimeEnabled: false,
  lastmodIsoDate: DEFAULT_SITEMAP_LASTMOD,
});
const robotsTxt = buildRobotsTxt('https://fmworks.ru/', {
  airtimeEnabled: false,
});
const llmsTxt = buildLlmsTxt('https://fmworks.ru/');
const turboXml = buildTurboPagesXml('https://fmworks.ru/');

fs.mkdirSync(path.dirname(PUBLIC_SITEMAP_PATH), { recursive: true });
fs.writeFileSync(PUBLIC_SITEMAP_PATH, xml, 'utf8');
fs.writeFileSync(PUBLIC_ROBOTS_PATH, robotsTxt, 'utf8');
fs.writeFileSync(PUBLIC_LLMS_PATH, llmsTxt, 'utf8');
fs.writeFileSync(PUBLIC_TURBO_PATH, turboXml, 'utf8');
console.log(
  `[SEO] Synced public/sitemap.xml (${Buffer.byteLength(xml, 'utf8')}B), public/robots.txt (${Buffer.byteLength(robotsTxt, 'utf8')}B), public/llms.txt (${Buffer.byteLength(llmsTxt, 'utf8')}B), public/turbo-pages.xml (${Buffer.byteLength(turboXml, 'utf8')}B)`
);
