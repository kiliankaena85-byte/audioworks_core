# Спецификации Sitemaps, RFC 9309, Open Graph и Schema.org JSON-LD

---

## 1. Robots Exclusion Protocol — IETF RFC 9309 (`robots.txt`)

Официальный стандарт: `https://www.rfc-editor.org/rfc/rfc9309`

- Расположение: строго `https://domain.tld/robots.txt`, кодировка `UTF-8`, `Content-Type: text/plain; charset=utf-8`, ответ `HTTP 200`.
- `robots.txt` является **рекомендательным протоколом управления обходом** (*advisory crawl-access protocol*), а не механизмом безопасности или сокрытия данных.
- Поддерживает маски `*` (любая последовательность символов) и `$` (конец URL).
- Правила группируются под `User-agent:`. Если указана специфическая секция (например, `User-agent: Googlebot`), то общие правила `User-agent: *` для этого бота **не наследуются** — нужные `Allow`/`Disallow` необходимо продублировать внутри специфической секции!
- Кэширование парсерами: до 24 часов по RFC 9309.

---

## 2. Протокол Sitemaps XML 0.9 (`sitemaps.org`)

Официальная спецификация: `https://www.sitemaps.org/protocol.html`

- **Лимиты одного файла:** не более **50 000 URL** и не более **50 MB** (52 428 800 байт) в несжатом виде. При превышении используется `<sitemapindex>` (который также вмещает до 50 000 карт).
- **Чистота списка URL:**
  - Только канонические URL (`rel="canonical"`) с кодом ответа `200 OK`.
  - **Запрещено** включать страницы с `noindex`, редиректами `3xx`, ошибками `4xx/5xx` или закрытые в `robots.txt`.
- **Формат `lastmod`:** W3C Datetime (`YYYY-MM-DD` или полный ISO-8601 с часовым поясом). Обновляйте дату только при реальном изменении содержимого страницы.
- **Официальный статус тегов:** Google документально игнорирует `<priority>` и `<changefreq>`, опираясь на `<lastmod>` (при условии достоверности) и общую иерархию ссылок.
- **Image Sitemap расширение (`xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"`):** полезно для фиксации ключевых превью-изображений/постеров на страницах.

---

## 3. Open Graph Protocol (`ogp.me`) и Twitter / X Cards

Официальная спецификация: `https://ogp.me/`

- **Декларация пространства имён в `<html>`:**
  `<html lang="ru" prefix="og: https://ogp.me/ns#">`
- **4 строго обязательных свойства по стандарту OGP:**
  1. `og:title` — чистый заголовок объекта (без лишних хвостов при шаринге; согласован с `<title>`).
  2. `og:type` — `"website"` (главная/разделы/услуги) или `"article"` (кейсы-разборы/статьи).
  3. `og:image` — **абсолютный** `https://` URL изображения (оптимально **1200×630 px**, JPEG/PNG/WebP, < 5 MB; SVG-картинки большинством мессенджеров — Telegram, WhatsApp, VK, X — не рендерятся!).
  4. `og:url` — **абсолютный** канонический URL текущей страницы.
- **Обязательные практические дополнения для Telegram / VK / Slack / X:**
  - `og:description`, `og:site_name`, `og:locale` (`ru_RU`), `og:image:width` (`1200`), `og:image:height` (`630`), `og:image:type`, `og:image:alt`.
  - `twitter:card` = `summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`.

---

## 4. Структурированные данные Schema.org (JSON-LD)

Официальные руководства:
* Google: `https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data`
* Яндекс: `https://yandex.ru/support/webmaster/schema-org/what-is-schema-org.html`
* Валидаторы: `https://search.google.com/test/rich-results`, `https://validator.schema.org/`, Вебмастер Яндекса (Инструменты → Валидатор микроразметки).

### Ключевые правила внедрения JSON-LD:
1. **Предпочтительный формат:** `<script type="application/ld+json">` в `<head>` (проще поддерживать и отделять от UI-вёрстки).
2. **Безопасная сериализация в HTML:** при серверной вставке всегда экранируйте `<`, `>`, `&` (`\u003c`, `\u003e`, `\u0026`), чтобы исключить закрытие тега `</script>` из пользовательских данных CMS.
3. **Связывание графа сущностей через `@id`:**
   - `https://domain.tld/#organization` (`Organization`)
   - `https://domain.tld/#localbusiness` (`LocalBusiness`, ссылка `parentOrganization: { "@id": "...#organization" }`)
   - `https://domain.tld/#service` (`Service`, `provider: { "@id": "...#localbusiness" }`)
   - `https://domain.tld/#website` (`WebSite`, `publisher: { "@id": "...#organization" }`)
   - Текущая страница (`WebPage` / `Article` / `CollectionPage` / `FAQPage`, `isPartOf: { "@id": "...#website" }`).
4. **Запрет на фантомную разметку:**
   - Не добавляйте `FAQPage` на страницу, где этих вопросов и ответов нет в видимом интерфейсе.
   - Не размечайте `AggregateRating` без реальных, видимых и проверяемых отзывов на странице (частая причина ручного фильтра Google).
   - Для `SearchAction` в `WebSite` параметр `urlTemplate` должен вести на реальный рабочий поиск на сайте (`/cases?q={search_term_string}`).
   - Помните: начиная с 2023–2024 годов Google ограничивает показ богатого блока `FAQ` в выдаче преимущественно авторитетными госсайтами и медучреждениями, но `FAQPage` по-прежнему помогает Яндексу, LLM-парсерам и графу сущностей, **если** вопросы присутствуют на странице.
