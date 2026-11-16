---
name: seo-geo-standards
description: >
  Official technical SEO, Yandex Webmaster, Core Web Vitals, Structured Data (Schema.org JSON-LD),
  Open Graph, Sitemaps, and Neural Search / GEO (Google AI Overviews, Yandex Neuro / Alice,
  ChatGPT Search, Perplexity, Claude Search, llms.txt) configuration and audit workflow.
  Use when setting up, auditing, or upgrading SEO, SSR metadata, robots.txt, sitemap.xml,
  llms.txt, JSON-LD, or AI crawler policies on a website.
---

# SEO & Neural Search (GEO / AEO) Standards Skill

Скилл объединяет верифицированные официальные спецификации Google Search Central, Яндекс Вебмастера, web.dev (Core Web Vitals), IETF RFC 9309, Sitemaps.org, Open Graph (`ogp.me`), Schema.org, IndexNow и стандарты нейропоиска (`llms.txt`, управление AI-краулерами OpenAI / Anthropic / Perplexity / Google / Яндекс).

---

## 0. Красные линии (Обязательные правила и актуальные изменения)

1. **Никакой «секретной AI-схемы» не существует:** По официальной документации Google Search Central, попадание в **AI Overviews** и **AI Mode** опирается исключительно на базовые требования **Google Search Essentials** (разрешённый обход, индексируемость, видимый текстовый контент, внутренняя перелинковка, E-E-A-T).
2. **Разделяйте AI-поисковиков и AI-обучение в `robots.txt`:**
   - Поиск/цитирование (`OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`, `YandexAdditionalBot`, `Googlebot`) — **разрешайте** (`Allow`), если нужен трафик из ответов нейросетей.
   - Обучение моделей (`GPTBot`, `ClaudeBot`, `Google-Extended`) — управляйте **независимо**. По официальному заявлению Google, блокировка `Google-Extended` **не влияет** на ранжирование в поиске Google и включение в AI Overviews.
3. **Яндекс Турбо-страницы официально закрыты (апрель 2025 г.):** Поддержка в поиске и раздел в Вебмастере прекращены; в проектах нового поколения не создавайте новые зависимости от `turbo-pages.xml`, а при аудите убирайте устаревшие `<link rel="alternate" type="application/rss+xml">` (оставляя только добровольный RSS-фид, если он нужен как сигнал обновления).
4. **JavaScript / SPA (React, Vite):** Google и нейрокраулеры обрабатывают JS в две волны или вообще **не выполняют JS** (как большинство LLM-ботов и часть мессенджер-парсеров). Критичные мета-теги, `canonical`, JSON-LD и смысловой HTML-контент (или `<noscript data-ssr-seo>` / полноценный SSR) **обязаны отдаваться сервером в первом HTTP-ответе 200 OK**. Dynamic Rendering признан Google устаревшим костылём (workaround).
5. **Паритет Schema.org и видимого DOM:** Разметка JSON-LD должна на 100% соответствовать видимому контенту страницы. Скрытые или несоответствующие claims (цены, отзывы, рейтинг, FAQ) нарушают Google Spam Policies и ведут к ручным санкциям.
6. **Core Web Vitals (p75 CrUX):** Ориентир «Хорошо» (Good) на 75-м перцентиле реальных пользователей: `LCP <= 2.5s`, `INP <= 200ms` (INP заменил FID), `CLS <= 0.1`.
7. **`robots.txt` ≠ `noindex` (RFC 9309):** `Disallow` запрещает обход, но URL с внешними ссылками может попасть в индекс без сниппета. Чтобы гарантированно исключить страницу (`/admin`, `/order`, `/cabinet`, `/checkout`), используйте `<meta name="robots" content="noindex, nofollow">` или HTTP-заголовок `X-Robots-Tag: noindex`, а **НЕ** блокируйте её в `robots.txt`, если поисковик должен прочитать `noindex` (либо отдавайте `401/403` / `noindex` + исключение из `sitemap.xml`).

---

## 1. Пошаговый протокол настройки сайта по этому скиллу

Выполняйте настройку и аудит сайта строго в следующей последовательности, обращаясь к профильным справочникам в `references/`:

### Шаг 1. Аудит архитектуры URL, кодов ответа и каноникализации
* Проверьте `references/official-google-yandex-standards.md`.
* Убедитесь, что несуществующие страницы отдают **строгий HTTP 404** (никаких Soft-404 с кодом `200 OK` для битых слагов `/cases/unknown`).
* Закрепите единый канонический хост (`HTTPS`, без `www` или с `www`, без дублирующего trailing slash) через `301`/`308` редиректы и самоссылающийся `<link rel="canonical" href="https://.../path" />`.
* Закройте служебные страницы от индексации (`noindex, nofollow` + отсутствие в `sitemap.xml`), не допуская утечки параметров отслеживания в индекс (`Clean-param` для Яндекса).

### Шаг 2. Настройка `robots.txt` для классического и нейросетевого поиска (RFC 9309)
* Проверьте матрицу ботов в `references/neural-search-geo-crawlers.md`.
* Настройте отдельные секции для `Yandex` (`Clean-param` со списком UTM/реферальных параметров + `Allow: /llms.txt`), `YandexAdditionalBot`, `Googlebot`, `OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`, а также явную политику для `GPTBot`, `ClaudeBot`, `Google-Extended`.
* Укажите полный канонический URL `Sitemap: https://domain.tld/sitemap.xml` (обязательно с протоколом и хостом по RFC 9309 / Яндексу).
* Не забывайте про 24-часовое окно распространения кэша `robots.txt` у крупных краулеров.

### Шаг 3. Настройка `sitemap.xml` (Sitemaps 0.9) и мгновенной индексации (IndexNow)
* Проверьте лимиты и теги в `references/structured-data-sitemaps-og.md`.
* Автоматически генерируйте `sitemap.xml` только из **индексируемых** (`!meta.noindex`) канонических URL (лимит: `<= 50 000 URL` и `<= 50 MB` несжатого XML).
* Используйте актуальный `lastmod` (W3C Datetime `YYYY-MM-DD`) — Яндекс и Google используют реальное изменение `lastmod` (игнорируя искусственное ежедневное обновление без правки контента; Google также официально игнорирует `<priority>` и `<changefreq>`).
* Для ускорения переиндексации в **Яндексе и Bing** подключите протокол **IndexNow** (`indexnow.org`) с key-файлом в корне `/{key}.txt` и отправкой изменённых URL при публикации в CMS.

### Шаг 4. Метаданные маршрутов, Open Graph (`ogp.me`) и Twitter/X Cards
* Проверьте правила в `references/structured-data-sitemaps-og.md`.
* На корневом `<html>` укажите `<html lang="ru" prefix="og: https://ogp.me/ns#">`.
* На каждом публичном маршруте сервер должен подставлять **уникальные**:
  - `<title>`: целевой диапазон **30–60 символов** (без дублей по сайту — критическая ошибка в Яндекс Вебмастере).
  - `<meta name="description">`: **120–160 символов** с чётким оффером/ценностью.
  - Обязательную четвёрку Open Graph: `og:title`, `og:type` (`website` | `article`), `og:image` (`1200×630` PNG/JPEG, абсолютный URL), `og:url` (абсолютный canonical).
  - Рекомендуемые теги: `og:site_name`, `og:locale` (`ru_RU`), `og:description`, `og:image:width`, `og:image:height`, `og:image:alt`.
  - Twitter/X: `twitter:card` (`summary_large_image`), `twitter:title`, `twitter:description`, `twitter:image`.

### Шаг 5. Структурированные данные Schema.org (JSON-LD)
* Проверьте схемы в `references/structured-data-sitemaps-og.md`.
* Используйте единый связный граф через `@id` в `<head>`:
  - Глобально: `Organization`, `LocalBusiness` (если есть география/офис/телефон), `WebSite` (с `SearchAction`, если поиск реально работает на сайте).
  - По маршрутам: `Service` + `OfferCatalog` / `AggregateOffer`, `FAQPage` (только если вопросы/ответы видны на этой странице), `BreadcrumbList` (на внутренних страницах), `Article` (для разборов/статей с реальным автором/датой — критерии Who/How/Why).
* Экранируйте `<`, `>`, `&` в JSON-LD (`\u003c`, `\u003e`, `\u0026`) для защиты от XSS.

### Шаг 6. GEO / LLMO: `llms.txt`, сниппет-контроль и структура контента для нейросетей
* Проверьте спецификацию `llmstxt.org` и гайд по AI-сниппетам в `references/neural-search-geo-crawlers.md`.
* Создайте чистый `/llms.txt` в корне сайта (и при необходимости `/llms-full.txt` с полным справочником):
  - H1 с названием бренда, `>` blockquote-саммари (кто, где, для кого, ключевое УТП в 2–3 фактах), таблица тарифов/услуг с цифрами и единицами измерения, юридические/контактные факты и H2-списки абсолютных Markdown-ссылок с кратким описанием разделов.
* Для управления цитированием в Google AI Overviews / Поиске с Алисой используйте `max-snippet:-1` (разрешить развёрнутые цитаты) или ограничение длины `max-snippet:[N]` и точечный HTML-атрибут `data-nosnippet` на служебных/юридических дисклеймерах, которые не должны попадать в ответ нейросети.
* Оформляйте смысловой контент на страницах по принципу **Answer-First + Fact Tables**: прямые ответы в 40–60 слов после H2-вопроса, HTML-таблицы характеристик/тарифов, проверяемые цифры, ссылки на первоисточники/законодательство и явный автор/редакция (E-E-A-T).

### Шаг 7. Производительность (Core Web Vitals) и автоматизированная проверка
* Убедитесь, что `LCP` (герой/H1), `INP` (отклик интерактивных элементов), `CLS` (зафиксированные размеры изображений/скелетонов, `font-display: swap`) укладываются в зелёную зону.
* Проведите финальный аудит по чек-листу из `references/fmworks-site-audit-mapping.md`, включая синхронизацию `public/*` с серверными генераторами и автотесты.

---

## Справочные материалы скилла (`references/`)

- `references/official-google-yandex-standards.md` — выжимка и ссылки на официальные документы Google Search Central, Яндекс Вебмастера, web.dev CWV и IndexNow.
- `references/neural-search-geo-crawlers.md` — спецификации краулеров OpenAI, Anthropic, Perplexity, Google (`Google-Extended`), Яндекса (`YandexAdditionalBot`), `llms.txt` и правил GEO-контента.
- `references/structured-data-sitemaps-og.md` — стандарты RFC 9309, Sitemaps 0.9, Open Graph (`ogp.me`) и Schema.org JSON-LD.
- `references/fmworks-site-audit-mapping.md` — карта применения скилла к текущей кодовой базе сайта (что уже настроено по стандарту и какие улучшения рекомендуется внедрить).
