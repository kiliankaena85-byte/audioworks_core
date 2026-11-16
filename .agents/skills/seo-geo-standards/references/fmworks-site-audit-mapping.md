# Карта настройки и аудита сайта FMWorks по скиллу `seo-geo-standards`

Используйте эту карту при запуске настройки или ревизии SEO/GEO-слоя данного приложения.

---

## 1. Ключевые файлы SEO-архитектуры проекта

- `index.html` — статическая HTML-оболочка SPA (базовый `<title>`, meta, Open Graph, JSON-LD по умолчанию).
- `src/data/platformRouter.ts` — маршрутизатор `History API`, таблица SEO-метаданных по всем роутам (`resolveRouteSeoMeta`), граф `Schema.org` (`buildRouteSchemaGraph`, `buildBreadcrumbListJsonLd`), флаги `noindex`.
- `src/data/seoUtils.ts` — генераторы JSON-LD `Organization`, `LocalBusiness`, `Service` (+ `OfferCatalog`), `WebSite` (`SearchAction`).
- `src/data/seoServerTemplates.ts` — серверная инъекция SEO в HTML (`injectRouteSeoIntoHtml`), генераторы `buildRobotsTxt`, `buildLlmsTxt`, `buildSitemapXml`, и `<noscript data-ssr-seo>` фолбэк с таблицами тарифов, стандартами ГОСТ и FAQ.
- `src/data/ogImageTemplates.ts` + серверный роут `/api/og.png` — динамическая генерация PNG-карточек `1200×630` для Open Graph / Twitter / Telegram.
- `server.ts` — Express-эндпоинты `/robots.txt`, `/llms.txt`, `/sitemap.xml`, SSR-отдача HTML с проверкой `Host` через `src/security/serverSecurity.ts` и HTTP `404` для неизвестных роутов/слагов.
- `public/robots.txt`, `public/llms.txt`, `public/sitemap.xml` — статические копии для CDN/фолбэка, синхронизированные тестами в `src/data/seoServerTemplates.test.ts`.
- `scripts/quality-audit.ts` — автоматический quality gate (проверка SEO/OpenGraph/Twitter/JSON-LD и бюджета входного бандла).

---

## 2. Текущее соответствие стандартам (Сильные стороны)

- Чистый History API роутинг без `#`-якорей и жёсткий HTTP `404` на неизвестных URL/слагах (нет Soft-404).
- Серверная инъекция уникальных `Title`, `Description`, `canonical`, Open Graph (`1200×630` PNG), `noindex, nofollow` (на `/admin`, `/order`, `/cabinet`, `/sound-drop`).
- В `robots.txt` настроена директива `Clean-param` для Яндекса и прописан абсолютный `Sitemap`.
- Имеется структурированный `/llms.txt` и серверная семантическая таблица тарифов/стандартов/FAQ в HTML для ботов без JS.
- Входной бандл укладывается в жёсткий бюджет (`< 340 KiB`), тяжёлые маршруты разделены через `React.lazy`, есть трекинг Web Vitals (`PerformanceMonitor.tsx`).

---

## 3. Найденные точки апгрейда при следующем применении скилла к сайту

Ниже перечислены конкретные несоответствия новейшим официальным стандартам (2025–2026), которые необходимо проверять/обновлять при работе с проектом:

1. **Устаревшая привязка к закрытым Яндекс Турбо-страницам (закрыты Яндексом в апреле 2025 г.):**
   - В `index.html`, `src/data/seoServerTemplates.ts` (`<link rel="alternate" type="application/rss+xml" title="Яндекс Турбо-страницы...">`, `Allow: /turbo.xml`, `Allow: /turbo-pages.xml`), `public/robots.txt`, `server.ts` и `src/data/turboFeed.ts` сохранена активная поддержка закрытой технологии.
   - *Рекомендация скилла:* удалить устаревшее продвижение «Яндекс Турбо-страниц» из `<head>` и `robots.txt` (или перепрофилировать RSS только как стандартный RSS-фид публикаций, если он нужен, и убрать мёртвые `turbo:*` артефакты).
2. **Явная политика AI-краулеров в `robots.txt` (`OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`, `GPTBot`, `ClaudeBot`, `Google-Extended`):**
   - Сейчас в `buildRobotsTxt` прописаны только `Yandex`, `YandexAdditionalBot`, `Googlebot` и `*`.
   - *Рекомендация скилла:* явно прописать поисковых AI-агентов (`OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`) с доступом к публичным страницам и `/llms.txt`, и осознанно зафиксировать правило для обучающих ботов (`GPTBot`, `ClaudeBot`, `Google-Extended`).
3. **Расширенные директивы сниппетов и `ogp.me` prefix:**
   - В `index.html` и `seoServerTemplates.ts` стоит `<meta name="robots" content="index, follow" />` вместо `index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1`.
   - На `<html lang="ru">` отсутствует `prefix="og: https://ogp.me/ns#"` по спецификации `ogp.me`.
   - На служебных/cookie-баннерах (`RfStorageNoticeBanner.tsx`) рекомендуется добавить `data-nosnippet`.
4. **Длина `Title` / `Description` и видимость `<noscript data-ssr-seo>`:**
   - Проверять через автотест, что `title` всех роутов стремится к `30–65` символам (без обрезки в сниппете Яндекса/Google), а `description` — к `120–160` символам.
   - Учесть, что боты, **умеющие** исполнять JS (`Googlebot` WRS, Chromium-парсеры), **игнорируют** содержимое `<noscript>`, а боты **без JS** (`OAI-SearchBot`, `PerplexityBot`, `curl`) **читают** `<noscript data-ssr-seo>`. Следить, чтобы контент в `<noscript data-ssr-seo>` по фактам (цены, сроки, FAQ) на 100% совпадал с React-интерфейсом (соблюдение запрета Google на клоакинг).
5. **Опционально — протокол `IndexNow`:**
   - Добавить эндпоинт верификации ключа `/{INDEXNOW_KEY}.txt` и отправку уведомлений в `https://api.indexnow.org/indexnow` при публикации/обновлении кейсов в CMS.
6. **Проверка `SearchAction` в `WebSite` JSON-LD:**
   - В `src/data/seoUtils.ts` объявлен `urlTemplate: "${cleanOrigin}/cases?q={search_term_string}"`. При аудите убедиться, что `/cases?q=...` реально фильтрует и рендерит результаты поиска по запросу (по требованиям Google Sitelinks Search Box / Schema.org).
