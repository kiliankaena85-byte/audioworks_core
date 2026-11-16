# Стандарты нейропоиска (GEO / AEO), управление AI-краулерами и `llms.txt`

Данный справочник регламентирует видимость сайта в генеративном поиске (**Google AI Overviews / AI Mode**, **Яндекс Поиск с Алисой / Нейро**, **ChatGPT Search**, **Perplexity**, **Claude Search**) на базе официальных спецификаций.

---

## 1. Официальная матрица AI-краулеров (`robots.txt`)

Крупные AI-провайдеры строго разделяют **ботов живого/индексного поиска** (приносят цитирование и реферальный трафик) и **ботов для обучения базовых моделей**. Блокировка обучающего бота по официальной документации **не отключает** участие сайта в поисковых ответах, если разрешён поисковый агент.

| Платформа | Поисковый бот (Search / Citations) | Бот пользовательского запроса (Live Fetch) | Обучающий бот (Model Training) | Официальный источник |
| :--- | :--- | :--- | :--- | :--- |
| **OpenAI** | `OAI-SearchBot` | `ChatGPT-User` | `GPTBot` | `platform.openai.com/docs/bots` |
| **Anthropic** | `Claude-SearchBot` | `Claude-User` | `ClaudeBot` | `support.anthropic.com` (Anthropic crawlers) |
| **Perplexity** | `PerplexityBot` | `Perplexity-User` | *(не выделяется отдельно от индексации)* | `docs.perplexity.ai/guides/bots` |
| **Google** | `Googlebot` *(обслуживает и Search, и AI Overviews)* | — | `Google-Extended` *(Gemini Apps / Vertex grounding & training)* | `developers.google.com/search/docs/crawling-indexing/overview-google-crawlers` |
| **Яндекс** | `Yandex`, `YandexAdditionalBot` | — | Использует индекс Поиска и дополнительные сигналы | `yandex.ru/support/webmaster/robot-work-with-site/allowing-indexing.html` |

### Важные технические нюансы:
1. **Политика по умолчанию для коммерческих/контентных сайтов (максимальный GEO-охват):**
   Если бизнес заинтересован в том, чтобы нейросети рекомендовали его бренд, цены и услуги со ссылкой на сайт, разрешайте в `robots.txt` **все поисковые и user-fetch боты** (`OAI-SearchBot`, `ChatGPT-User`, `Claude-SearchBot`, `Claude-User`, `PerplexityBot`, `YandexAdditionalBot`, `Googlebot`). Решение по `GPTBot`, `ClaudeBot`, `Google-Extended` принимается владельцем (для B2B-сайтов без платного медиа-пейволла обычно тоже открывают либо закрывают только обучение, оставляя поиск открытым).
2. **Распространение правил (TTL кэша):** Обновление `robots.txt` применяется AI-инфраструктурой в течение **до 24 часов**.
3. **Защита от спуфинга:** Недобросовестные скраперы часто подделывают `User-Agent` `GPTBot`/`ClaudeBot`. В серверных логах/WAF проверяйте официальные опубликованные JSON-диапазоны IP-адресов OpenAI / Anthropic / Perplexity / Google / Reverse DNS Яндекса.
4. **Не допускайте случайного бана `User-agent: *`:** Жёсткие запреты для `*` без отдельных секций для `OAI-SearchBot`/`YandexAdditionalBot` могут полностью вырезать сайт из нейроответов.

### Эталонный шаблон AI-дружелюбного `robots.txt` (режим «Поиск и цитирование открыты, обучение — по политике владельца»):
```text
User-agent: Yandex
Allow: /
Allow: /llms.txt
Disallow: /admin
Disallow: /order
Disallow: /cabinet
Disallow: /api/
Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&ref /

User-agent: YandexAdditionalBot
Allow: /
Allow: /llms.txt
Disallow: /admin
Disallow: /order
Disallow: /cabinet
Disallow: /api/

User-agent: Googlebot
Allow: /
Disallow: /admin
Disallow: /order
Disallow: /cabinet
Disallow: /api/

User-agent: OAI-SearchBot
Allow: /
Allow: /llms.txt
Disallow: /admin
Disallow: /order
Disallow: /cabinet
Disallow: /api/

User-agent: Claude-SearchBot
Allow: /
Allow: /llms.txt
Disallow: /admin
Disallow: /order
Disallow: /cabinet
Disallow: /api/

User-agent: PerplexityBot
Allow: /
Allow: /llms.txt
Disallow: /admin
Disallow: /order
Disallow: /cabinet
Disallow: /api/

# Опционально: разрешить или закрыть обучение моделей независимо от поиска
User-agent: GPTBot
Allow: /
Disallow: /admin
Disallow: /order
Disallow: /cabinet
Disallow: /api/

User-agent: ClaudeBot
Allow: /
Disallow: /admin
Disallow: /order
Disallow: /cabinet
Disallow: /api/

User-agent: Google-Extended
Allow: /

User-agent: *
Allow: /
Allow: /llms.txt
Disallow: /admin
Disallow: /order
Disallow: /cabinet
Disallow: /api/

Sitemap: https://example.com/sitemap.xml
```

---

## 2. Управление сниппетами и цитированием в AI Overviews

Официальная справка Google: `https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag`

- `<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />`
  - `max-snippet:-1`: разрешает поисковику и AI Overviews использовать фрагменты любой длины (рекомендуется по умолчанию для максимального цитирования).
  - `max-snippet:0` или `nosnippet`: полностью запрещает текстовые сниппеты и **исключает** использование текста страницы в AI Overviews.
  - `max-image-preview:large`: разрешает показ крупных превью-карточек (важно для Google Discover и мультимодального нейропоиска).
- **`data-nosnippet` (HTML-атрибут для `div`, `span`, `section`):**
  Точечно исключает конкретный блок DOM (например, куки-баннер, отладочный виджет или повторяющийся шаблонный дисклеймер) из сниппетов и превью AI:
  ```html
  <aside data-nosnippet>Технические cookie (152-ФЗ)...</aside>
  ```

---

## 3. Спецификация `/llms.txt` (`llmstxt.org`)

Официальный стандарт: `https://llmstxt.org/`

`llms.txt` — единый структурированный Markdown-файл в корне домена (`https://site.tld/llms.txt`), позволяющий LLM-агентам и поисковым синтезаторам без парсинга сложного HTML/CSS/JS сразу считать точную фактографию о компании и навигацию по ключевым страницам.

### Строгая структура файла по спецификации `llmstxt.org`:
1. **`# Название проекта / компании`** (обязательный H1 в первой строке).
2. **`> Краткое описание (blockquote)`** — 1 абзац с ключевой сутью, географией, специализацией и УТП.
3. **Дополнительный текстовый контекст (без заголовка H2+)** — сжатые, проверяемые факты: юридический профиль, цены, сроки, стандарты качества, условия работы.
4. **Секции `## Группа ресурсов`** — маркированные списки Markdown-ссылок строгого вида:
   `- [Название раздела](https://domain.tld/url): краткое точное пояснение, что находится внутри.`
5. **Опциональная секция `## Optional`** — второстепенные документы (политика конфиденциальности, архивы), которые LLM-агент может пропустить при дефиците контекстного окна.
6. *(Расширение стандарта)* Для крупных сайтов с документацией полезно дополнительно отдавать `/llms-full.txt` или `.md`-представления статей, но не за счёт дублирования спама.

---

## 4. Правила написания контента для нейропоиска (GEO Content Engineering)

Чтобы языковые модели и RAG-системы поисковиков (Google Gemini Search, Яндекс Нейро, Perplexity) выбирали именно ваш сайт в качестве источника ответа и ссылки:

1. **Direct Answer Pattern (Прямой ответ после H2):** На каждый целевой коммерческий или информационный вопрос сразу под заголовком `<h2>` давайте ёмкий самодостаточный абзац (40–70 слов), содержащий сущность, цифру/диапазон и вывод без вводной «воды».
2. **Структурированные сравнения и таблицы (`<table>`):** Нейросети и парсеры намного точнее извлекают тарифы, сроки, технические допуски (ГОСТ/LUFS/размеры/ограничения ФЗ) из семантических HTML `<table>` и `<dl>/<dt>/<dd>`, чем из рекламных карточек с разрозненными `<div>`.
3. **Плотность проверяемых сущностей (Entity & Provenance):** Указывайте конкретные единицы измерения, стандарты, юрисдикцию, режим работы и юридические атрибуты, совпадающие между видимой страницей, `llms.txt` и `Organization`/`LocalBusiness` JSON-LD.
4. **Доступность без JS-выполнения:** Так как `ChatGPT-User`, `Claude-User`, `PerplexityBot` и `OAI-SearchBot` часто читают только сырой HTTP-ответ без полного headless Chromium-рендеринга, ключевые факты, таблицы тарифов, FAQ и ссылки **обязаны** присутствовать в серверном HTML (SSR или семантический SSR-блок в теле документа).
5. **Цитируемая уникальность (Information Gain):** Оригинальные кейсы, разборы ошибок, калькуляции, чек-листы и цифры с собственной практикой повышают вероятность цитирования (в отличие от перефразированных общеизвестных статей).
