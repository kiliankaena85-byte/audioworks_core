import {
  APPROACH_LEAD_PARAGRAPH,
  APPROACH_NEURO_STUDIES,
  APPROACH_PILLARS,
  APPROACH_STUDIO_PHOTO,
  APPROACH_THESIS,
  BRAND_CASES,
  type BrandCasePoster,
  FLAGSHIP_STUDIO_REEL,
} from './casesData.ts';
import { HOME_PROCESS_FAQ_ITEMS } from './faqData.ts';
import {
  getCaseDetailedBreakdown,
  INDUSTRY_SOLUTIONS,
  LEGAL_RIGHTS_DELIVERABLES,
  LOCAL_EDITORIAL_IMAGES,
  MODERATION_COMPLIANCE_RULES,
  PRODUCTION_STAGES_24_48H,
  RADIO_MISTAKE_ARTICLES,
} from './multiPageContentData.ts';
import {
  MAIN_PLATFORM_NAV_ITEMS,
  VALID_INDUSTRY_SLUGS,
} from './platformRouter.ts';
import { CUSTOM_CONSULT_PRICING_ROW, EDITORIAL_PRICING_ROWS } from './pricingData.ts';
import { BROADCAST_TECH_STANDARD_ROWS } from './studioDocumentsCore.ts';
import type { PortfolioCaseRecord } from './studioCmsTypes.ts';

export const TURBO_FEED_DEFAULT_PUBDATE = 'Sat, 14 Nov 2026 09:00:00 GMT';

export interface BuildTurboPagesOptions {
  cmsCases?: readonly PortfolioCaseRecord[];
  pubDateRfc822?: string;
}

interface TurboItemSpec {
  title: string;
  linkPath: string;
  category: string;
  topic: string;
  imagePath?: string;
  imageAlt?: string;
  subtitle?: string;
  bodyHtml: string;
}

function normalizeOrigin(rawOrigin?: string): string {
  const trimmed = (rawOrigin ?? '').trim().replace(/\/+$/g, '');
  return trimmed || 'https://fmworks.ru';
}

function escapeXmlText(value?: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(value?: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeCdata(value: string): string {
  return value.replace(/\]\]>/g, ']]]]><![CDATA[>');
}

function resolveAbsoluteAssetUrl(origin: string, assetPath?: string): string | undefined {
  if (!assetPath) return undefined;
  if (/^https?:\/\//i.test(assetPath)) return assetPath;
  const cleanPath = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
  return `${origin}${cleanPath}`;
}

function buildTurboMenuHtml(origin: string): string {
  const links = MAIN_PLATFORM_NAV_ITEMS.filter((item) => item.key !== 'hot-air')
    .map(
      (item) =>
        `<a href="${escapeHtml(`${origin}${item.href}`)}">${escapeHtml(item.label)}</a>`
    )
    .join('');
  return `<menu>${links}<a href="${escapeHtml(`${origin}/order`)}">Заказать ролик</a></menu>`;
}

function buildTurboCtaButton(
  origin: string,
  label: string,
  targetPath = '/order'
): string {
  return `<button formaction="${escapeHtml(`${origin}${targetPath}`)}" data-background-color="#FF4820" data-color="white" data-primary="true">${escapeHtml(label)}</button>`;
}

function buildPricingTableHtml(): string {
  const rows = [
    ...EDITORIAL_PRICING_ROWS.map(
      (r) =>
        `<tr><td>${escapeHtml(r.title)}</td><td>${escapeHtml(r.description)}</td><td>${escapeHtml(r.turnaround)}</td><td>${escapeHtml(r.priceFormatted)}</td></tr>`
    ),
    `<tr><td>${escapeHtml(CUSTOM_CONSULT_PRICING_ROW.title)}</td><td>${escapeHtml(CUSTOM_CONSULT_PRICING_ROW.description)}</td><td>${escapeHtml(CUSTOM_CONSULT_PRICING_ROW.turnaround)}</td><td>${escapeHtml(CUSTOM_CONSULT_PRICING_ROW.priceFormatted)}</td></tr>`,
  ].join('');

  return `<table><thead><tr><th>Тариф</th><th>Состав пакета</th><th>Срок</th><th>Стоимость</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function buildTechStandardsTableHtml(): string {
  const rows = BROADCAST_TECH_STANDARD_ROWS.map(
    (row) =>
      `<tr><td>${escapeHtml(row.parameter)}</td><td>${escapeHtml(row.specification)}</td></tr>`
  ).join('');

  return `<table><thead><tr><th>Технический параметр</th><th>Требование вещания (РФ)</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderTurboItemXml(
  item: TurboItemSpec,
  origin: string,
  pubDateRfc822: string,
  menuHtml: string
): string {
  const canonicalUrl = `${origin}${item.linkPath.startsWith('/') ? item.linkPath : `/${item.linkPath}`}`;
  const absImageUrl = resolveAbsoluteAssetUrl(origin, item.imagePath);

  const headerParts = [
    '<header>',
    `<h1>${escapeHtml(item.title)}</h1>`,
    item.subtitle ? `<h2>${escapeHtml(item.subtitle)}</h2>` : '',
    absImageUrl
      ? `<figure><img src="${escapeHtml(absImageUrl)}" alt="${escapeHtml(item.imageAlt || item.title)}" /></figure>`
      : '',
    menuHtml,
    '</header>',
  ]
    .filter(Boolean)
    .join('');

  const footerBlock = `<p><strong>FMWorks®</strong> · г. Тверь · Работаем по всей России · Пн–Пт 09:00–19:00 (МСК) · +79040000911 · art@artmspektr.ru</p>`;
  const cdataContent = sanitizeCdata(`${headerParts}${item.bodyHtml}${footerBlock}`);

  return [
    '    <item turbo="true">',
    `      <title>${escapeXmlText(item.title)}</title>`,
    `      <link>${escapeXmlText(canonicalUrl)}</link>`,
    `      <pubDate>${escapeXmlText(pubDateRfc822)}</pubDate>`,
    '      <author>Студия FMWorks</author>',
    `      <category>${escapeXmlText(item.category)}</category>`,
    `      <turbo:topic>${escapeXmlText(item.topic)}</turbo:topic>`,
    `      <turbo:source>${escapeXmlText(canonicalUrl)}</turbo:source>`,
    `      <turbo:content><![CDATA[${cdataContent}]]></turbo:content>`,
    '    </item>',
  ].join('\n');
}

/**
 * Формирует RSS 2.0 XML-фид Яндекс Турбо-страниц (`xmlns:turbo="http://turbo.yandex.ru"`)
 * на основе актуального контента платформы FMWorks: главной, тарифов, кейсов, отраслей, статей и FAQ.
 */
export function buildTurboPagesXml(
  origin: string,
  options: BuildTurboPagesOptions = {}
): string {
  const cleanOrigin = normalizeOrigin(origin);
  const pubDate = options.pubDateRfc822 || TURBO_FEED_DEFAULT_PUBDATE;
  const menuHtml = buildTurboMenuHtml(cleanOrigin);
  const pricingTable = buildPricingTableHtml();

  const items: TurboItemSpec[] = [];

  // 1. Главная страница
  items.push({
    title: 'FMWorks — Студийный аудиопродакшн для радио и бизнеса',
    subtitle: 'Сценарии, актёры кино и дубляжа, чистые права РАО/ВОИС и прохождение модерации ФЗ-38 с первого дубля',
    linkPath: '/',
    category: 'Студийный аудиопродакшн',
    topic: 'Аудиореклама под ключ — FMWorks',
    imagePath: LOCAL_EDITORIAL_IMAGES.studioHero,
    imageAlt: 'Студия звукозаписи FMWorks: микрофон и рабочее место продюсера',
    bodyHtml: [
      `<p>${escapeHtml(APPROACH_THESIS)}</p>`,
      `<p>${escapeHtml(APPROACH_LEAD_PARAGRAPH)}</p>`,
      '<h2>Три принципа продакшна FMWorks</h2>',
      '<ul>',
      ...APPROACH_PILLARS.map(
        (p) => `<li><strong>${escapeHtml(p.number)}. ${escapeHtml(p.title)}:</strong> ${escapeHtml(p.body)}</li>`
      ),
      '</ul>',
      '<h2>Тарифы и сроки</h2>',
      pricingTable,
      '<h2>Доказательная база внимания слушателя</h2>',
      ...APPROACH_NEURO_STUDIES.map(
        (study) =>
          `<blockquote><strong>${escapeHtml(study.metricValue)}</strong> — ${escapeHtml(study.metricCaption)}. ${escapeHtml(study.summary)} <em>(${escapeHtml(study.sourceLabel)})</em></blockquote>`
      ),
      buildTurboCtaButton(cleanOrigin, 'Рассчитать ролик и получить договор/счёт'),
    ].join(''),
  });

  // 2. Тарифы, этапы и паспорт прав
  items.push({
    title: 'Тарифы на аудиоролики, этапы от 24–48 часов и паспорт прав РАО/ВОИС',
    subtitle: 'Фиксированная смета по договору и счёту для юрлиц или оплата картой и по СБП',
    linkPath: '/pricing',
    category: 'Тарифы и права',
    topic: 'Тарифы и юридический стандарт FMWorks',
    imagePath: LOCAL_EDITORIAL_IMAGES.studioLegalMastering,
    imageAlt: 'Студийный мастеринг и юридическая проверка аудиороликов по ФЗ-38',
    bodyHtml: [
      '<h2>Стоимость пакетов производства</h2>',
      pricingTable,
      '<h2>Этапы производства: от заявки до эфирного мастера</h2>',
      '<ol>',
      ...PRODUCTION_STAGES_24_48H.map(
        (stage) =>
          `<li><strong>${escapeHtml(stage.title)} (${escapeHtml(stage.timeWindow)}):</strong> ${escapeHtml(stage.description)} <em>Результат: ${escapeHtml(stage.deliverable)}.</em></li>`
      ),
      '</ol>',
      '<h2>Документы и юридическая очистка</h2>',
      '<ul>',
      ...LEGAL_RIGHTS_DELIVERABLES.map(
        (doc) =>
          `<li><strong>${escapeHtml(doc.title)}:</strong> ${escapeHtml(doc.summary)}<ul>${doc.includedItems
            .map((sub) => `<li>${escapeHtml(sub)}</li>`)
            .join('')}</ul></li>`
      ),
      '</ul>',
      '<h2>Матрица модерации по ФЗ-38</h2>',
      `<table><thead><tr><th>Отрасль</th><th>Требование закона и радиостанций</th><th>Решение FMWorks</th></tr></thead><tbody>${MODERATION_COMPLIANCE_RULES.map(
        (row) =>
          `<tr><td>${escapeHtml(row.sector)}</td><td>${escapeHtml(row.mandatoryRequirement)}</td><td>${escapeHtml(row.howFmworksSolves)}</td></tr>`
      ).join('')}</tbody></table>`,
      '<h2>Единый технический стандарт сдачи мастер-пакета</h2>',
      buildTechStandardsTableHtml(),
      buildTurboCtaButton(cleanOrigin, 'Оформить заказ и скачать договор-оферту'),
    ].join(''),
  });

  // 3. Обзорный раздел кейсов + отдельные страницы кейсов
  const sourceCases: readonly BrandCasePoster[] =
    options.cmsCases && options.cmsCases.length > 0
      ? [
          FLAGSHIP_STUDIO_REEL,
          ...options.cmsCases.filter((c) => c.published !== false),
        ]
      : [FLAGSHIP_STUDIO_REEL, ...BRAND_CASES];

  items.push({
    title: 'Кейсы аудиорекламы, сценарии и отраслевые решения — FMWorks',
    subtitle: 'Примеры коммерческих роликов с посекундными таймкодами, разбором драматургии и юридической адаптацией',
    linkPath: '/cases',
    category: 'Кейсы и сценарии',
    topic: 'Портфолио коммерческих аудиороликов',
    imagePath: FLAGSHIP_STUDIO_REEL.coverImageUrl,
    imageAlt: FLAGSHIP_STUDIO_REEL.coverImageAlt,
    bodyHtml: [
      '<h2>Коммерческие кейсы студии</h2>',
      '<ul>',
      ...sourceCases.map(
        (c) =>
          `<li><a href="${escapeHtml(`${cleanOrigin}/cases/${encodeURIComponent(c.id)}`)}"><strong>${escapeHtml(c.client)}:</strong> ${escapeHtml(c.headline)}</a> (${c.durationSec} сек) — ${escapeHtml(c.summary)}</li>`
      ),
      '</ul>',
      '<h2>Отраслевые стандарты</h2>',
      '<ul>',
      ...VALID_INDUSTRY_SLUGS.map((slug) => {
        const ind = INDUSTRY_SOLUTIONS[slug];
        return `<li><a href="${escapeHtml(`${cleanOrigin}/cases/industry/${slug}`)}"><strong>${escapeHtml(ind.shortTitle)}:</strong> ${escapeHtml(ind.fullTitle)}</a> — ${escapeHtml(ind.heroSummary)}</li>`;
      }),
      '</ul>',
      buildTurboCtaButton(cleanOrigin, 'Заказать ролик в похожем формате'),
    ].join(''),
  });

  for (const c of sourceCases) {
    const breakdown = getCaseDetailedBreakdown(c);
    items.push({
      title: `${c.client}: ${c.headline}`,
      subtitle: `${breakdown.formatLabel} · ${breakdown.spotSeconds} сек`,
      linkPath: `/cases/${encodeURIComponent(c.id)}`,
      category: 'Кейсы и сценарии',
      topic: `Кейс ${c.client} (${breakdown.industryLabel})`,
      imagePath: c.coverImageUrl,
      imageAlt: c.coverImageAlt,
      bodyHtml: [
        `<blockquote>${escapeHtml(c.quoteImage || c.summary)}</blockquote>`,
        `<p><strong>Задача клиента:</strong> ${escapeHtml(breakdown.clientChallenge)}</p>`,
        `<p><strong>Режиссёрское решение:</strong> ${escapeHtml(breakdown.dramaticSolution)}</p>`,
        `<p><strong>Юридическая адаптация и хронометраж:</strong> ${escapeHtml(breakdown.legalAdaptationNote)}</p>`,
        '<h2>Посекундная партитура сценария</h2>',
        `<table><thead><tr><th>Таймкод</th><th>Слой</th><th>Реплика / звук</th><th>Режиссёрская заметка</th></tr></thead><tbody>${breakdown.scriptCues
          .map(
            (cue) =>
              `<tr><td>${escapeHtml(cue.timecode)}</td><td>${escapeHtml(cue.layerLabel)}</td><td>${escapeHtml(cue.spokenOrFoley)}</td><td>${escapeHtml(cue.directorNote)}</td></tr>`
          )
          .join('')}</tbody></table>`,
        '<h2>Результаты кампании</h2>',
        '<ul>',
        ...breakdown.metrics.map(
          (m) => `<li><strong>${escapeHtml(m.value)} — ${escapeHtml(m.label)}:</strong> ${escapeHtml(m.context)}</li>`
        ),
        '</ul>',
        buildTurboCtaButton(cleanOrigin, 'Заказать аналогичный аудиоролик'),
      ].join(''),
    });
  }

  // 4. Отраслевые решения
  for (const slug of VALID_INDUSTRY_SLUGS) {
    const ind = INDUSTRY_SOLUTIONS[slug];
    items.push({
      title: ind.fullTitle,
      subtitle: `${ind.kicker} · Оптимально ${ind.optimalDurationRange}`,
      linkPath: `/cases/industry/${ind.slug}`,
      category: 'Отраслевые решения',
      topic: ind.shortTitle,
      imagePath: ind.coverImageUrl,
      imageAlt: ind.coverImageAlt,
      bodyHtml: [
        `<p>${escapeHtml(ind.heroSummary)}</p>`,
        `<p><strong>Контекст слушателя:</strong> ${escapeHtml(ind.listenerContext)}</p>`,
        `<p><strong>Главная ошибка в категории:</strong> ${escapeHtml(ind.keyMistakeToAvoid)}</p>`,
        '<h2>Требования комплаенса ФЗ-38 и радиосетей</h2>',
        `<ul>${ind.legalComplianceRules.map((rule) => `<li>${escapeHtml(rule)}</li>`).join('')}</ul>`,
        `<h2>${escapeHtml(ind.sampleBenchmarkScript.title)} (${ind.sampleBenchmarkScript.durationSec} сек)</h2>`,
        `<ul>${ind.sampleBenchmarkScript.lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`,
        '<h2>Отраслевые ориентиры эффективности</h2>',
        `<ul>${ind.kpiBenchmarks.map((k) => `<li><strong>${escapeHtml(k.value)}</strong> — ${escapeHtml(k.label)}</li>`).join('')}</ul>`,
        buildTurboCtaButton(cleanOrigin, `Заказать ролик для отрасли «${ind.shortTitle}»`),
      ].join(''),
    });
  }

  // 5. Подход и экспертные статьи
  items.push({
    title: 'Подход FMWorks и 5 главных ошибок в сценариях радиорекламы',
    subtitle: 'Почему слушатели отключают внимание за 1,6 секунды и как драматургия звука окупает эфирный бюджет',
    linkPath: '/approach',
    category: 'Экспертные разборы',
    topic: 'Нейроисследования и методология FMWorks',
    imagePath: APPROACH_STUDIO_PHOTO.imageUrl,
    imageAlt: APPROACH_STUDIO_PHOTO.imageAlt,
    bodyHtml: [
      `<p>${escapeHtml(APPROACH_THESIS)}</p>`,
      `<p>${escapeHtml(APPROACH_LEAD_PARAGRAPH)}</p>`,
      '<h2>Пять разборов типовых ошибок в радиоэфире</h2>',
      '<ul>',
      ...RADIO_MISTAKE_ARTICLES.map(
        (article) =>
          `<li><a href="${escapeHtml(`${cleanOrigin}/approach/${article.slug}`)}"><strong>${escapeHtml(article.title)}</strong></a> (${escapeHtml(article.readingTime)}) — ${escapeHtml(article.subtitle)}</li>`
      ),
      '</ul>',
      buildTurboCtaButton(cleanOrigin, 'Заказать сценарий и продакшн'),
    ].join(''),
  });

  for (const article of RADIO_MISTAKE_ARTICLES) {
    items.push({
      title: article.title,
      subtitle: `${article.categoryKicker} · ${article.readingTime}`,
      linkPath: `/approach/${article.slug}`,
      category: 'Экспертные разборы',
      topic: article.indexLabel,
      imagePath: LOCAL_EDITORIAL_IMAGES.radioAttention,
      imageAlt: article.title,
      bodyHtml: [
        `<p><strong>Ключевая метрика: ${escapeHtml(article.impactStatValue)}</strong> — ${escapeHtml(article.impactStatLabel)}.</p>`,
        `<p>${escapeHtml(article.summary)}</p>`,
        '<h2>Почему теряется отклик</h2>',
        `<ul>${article.problemDiagnosis.map((pt) => `<li>${escapeHtml(pt)}</li>`).join('')}</ul>`,
        `<h2>Сравнение сценариев: до и после режиссуры</h2>`,
        `<blockquote><strong>${escapeHtml(article.badScriptExample.label)} (${escapeHtml(article.badScriptExample.chronometry)}):</strong> ${escapeHtml(article.badScriptExample.text)}<br/><em>Проблема: ${escapeHtml(article.badScriptExample.flawNote)}</em></blockquote>`,
        `<blockquote><strong>${escapeHtml(article.goodScriptExample.label)} (${escapeHtml(article.goodScriptExample.chronometry)}):</strong> ${escapeHtml(article.goodScriptExample.text)}<br/><em>Эффект: ${escapeHtml(article.goodScriptExample.winNote)}</em></blockquote>`,
        '<h2>Научное обоснование</h2>',
        `<p>${escapeHtml(article.neuroExplanation)}</p>`,
        '<h2>Чек-лист продюсера перед записью</h2>',
        `<ul>${article.producerChecklist.map((chk) => `<li>${escapeHtml(chk)}</li>`).join('')}</ul>`,
        buildTurboCtaButton(cleanOrigin, 'Проверить ваш сценарий с продюсером FMWorks'),
      ].join(''),
    });
  }

  // 6. Страница FAQ с нативным Яндекс Турбо-аккордеоном
  items.push({
    title: 'Частые вопросы (FAQ) по договору, оплате, ЭДО и срокам — FMWorks',
    subtitle: 'Всё о договоре и быстром счёте на оплату, сроках производства и паспорте прав',
    linkPath: '/faq',
    category: 'Частые вопросы',
    topic: 'FAQ по работе со студией FMWorks',
    imagePath: LOCAL_EDITORIAL_IMAGES.studioLegalMastering,
    imageAlt: 'Регламент работы студии FMWorks и ответы на вопросы заказчиков',
    bodyHtml: [
      '<h2>Ответы на ключевые вопросы заказчиков</h2>',
      '<div data-block="accordion">',
      ...HOME_PROCESS_FAQ_ITEMS.map(
        (faq) =>
          `<div data-block="item" data-title="${escapeHtml(faq.question)}"><p>${escapeHtml(faq.answer)}</p></div>`
      ),
      '</div>',
      buildTurboCtaButton(cleanOrigin, 'Перейти к оформлению заявки'),
    ].join(''),
  });

  const itemsXml = items
    .map((item) => renderTurboItemXml(item, cleanOrigin, pubDate, menuHtml))
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss xmlns:yandex="http://news.yandex.ru"',
    '     xmlns:media="http://search.yahoo.com/mrss/"',
    '     xmlns:turbo="http://turbo.yandex.ru"',
    '     version="2.0">',
    '  <channel>',
    '    <title>FMWorks — Студийный аудиопродакшн для радио и бизнеса</title>',
    `    <link>${escapeXmlText(cleanOrigin)}</link>`,
    '    <description>Студия аудиорекламы полного цикла: сценарии, голоса кино и дубляжа, паспорт прав РАО/ВОИС, модерация по ФЗ-38 и быстрый старт по ЭДО или 54-ФЗ.</description>',
    '    <language>ru</language>',
    '    <turbo:analytics/>',
    itemsXml,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}
