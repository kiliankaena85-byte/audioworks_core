export const DEFAULT_OG_IMAGE_PATH =
  '/src/assets/images/hero_studio_editorial_1794399404984.jpg';
export const ORGANIZATION_JSONLD_SCRIPT_ID = 'fmworks-organization-jsonld';
export const LOCAL_BUSINESS_JSONLD_SCRIPT_ID = 'fmworks-localbusiness-jsonld';
export const WEBSITE_JSONLD_SCRIPT_ID = 'fmworks-website-jsonld';

export const FMWORKS_BUSINESS_DETAILS = {
  brandName: 'FMWorks',
  legalName: 'Аудиопродакшн-студия FMWorks®',
  alternateName: 'Студия коммерческого аудиопродакшна FMWorks',
  description:
    'Студия аудиопродакшна полного цикла: рекламные аудиоролики для радио и бизнеса от 24–48 ч по готовому тексту и 3–4 дня под ключ с паспортом прав РАО/ВОИС и гарантией прохождения модерации по ФЗ-38.',
  email: 'art@artmspektr.ru',
  telephone: '+79040000911',
  priceRange: '15 000 – 35 000 ₽',
  currenciesAccepted: 'RUB',
  paymentAccepted: 'Безналичный расчёт (ЭДО), банковская карта (54-ФЗ), СБП',
  address: {
    streetAddress: '',
    postalCode: '170100',
    addressLocality: 'Тверь',
    addressRegion: 'Тверская область',
    addressCountry: 'RU',
  },
  geo: {
    latitude: 56.859611,
    longitude: 35.911896,
  },
  openingHours: {
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const,
    opens: '09:00',
    closes: '19:00',
  },
  knowsAbout: [
    'Производство рекламных аудиороликов',
    'Сценарии радиорекламы',
    'Звуковой дизайн и мастеринг по ГОСТ (-14 … -11 LUFS)',
    'Паспорт прав РАО и ВОИС',
    'Юридический комплаенс по ФЗ-38 «О рекламе»',
  ] as const,
} as const;

export interface PostalAddressSchema {
  '@type': 'PostalAddress';
  streetAddress: string;
  postalCode: string;
  addressLocality: string;
  addressRegion: string;
  addressCountry: string;
}

export interface OpeningHoursSpecificationSchema {
  '@type': 'OpeningHoursSpecification';
  dayOfWeek: string[];
  opens: string;
  closes: string;
}

export interface OrganizationJsonLd {
  '@context': 'https://schema.org';
  '@type': 'Organization';
  '@id': string;
  name: string;
  legalName: string;
  alternateName: string;
  description: string;
  url: string;
  logo: {
    '@type': 'ImageObject';
    url: string;
    caption: string;
  };
  image: string;
  email: string;
  telephone: string;
  address: PostalAddressSchema;
  contactPoint: Array<{
    '@type': 'ContactPoint';
    telephone: string;
    email: string;
    contactType: string;
    areaServed: string;
    availableLanguage: string[];
    hoursAvailable: OpeningHoursSpecificationSchema;
  }>;
  areaServed: {
    '@type': 'Country';
    name: string;
  };
  knowsAbout: string[];
}

export interface LocalBusinessJsonLd {
  '@context': 'https://schema.org';
  '@type': 'LocalBusiness';
  '@id': string;
  name: string;
  alternateName: string;
  description: string;
  url: string;
  image: string;
  email: string;
  telephone: string;
  priceRange: string;
  currenciesAccepted: string;
  paymentAccepted: string;
  address: PostalAddressSchema;
  geo: {
    '@type': 'GeoCoordinates';
    latitude: number;
    longitude: number;
  };
  openingHoursSpecification: OpeningHoursSpecificationSchema[];
  areaServed: Array<{
    '@type': 'City' | 'Country';
    name: string;
  }>;
  parentOrganization: {
    '@id': string;
  };
}

export interface WebSiteSearchActionSchema {
  '@type': 'SearchAction';
  target: {
    '@type': 'EntryPoint';
    urlTemplate: string;
  };
  'query-input': string;
  'search-input': string;
}

export interface WebSiteJsonLd {
  '@context': 'https://schema.org';
  '@type': 'WebSite';
  '@id': string;
  name: string;
  alternateName: string;
  description: string;
  url: string;
  inLanguage: 'ru-RU';
  publisher: {
    '@id': string;
  };
  potentialAction: WebSiteSearchActionSchema;
}

function normalizeSeoOrigin(rawOrigin?: string): string {
  const trimmed = (rawOrigin ?? '').trim().replace(/\/+$/g, '');
  return trimmed || 'https://fmworks.ru';
}

function buildPostalAddress(): PostalAddressSchema {
  return {
    '@type': 'PostalAddress',
    ...FMWORKS_BUSINESS_DETAILS.address,
  };
}

function buildOpeningHoursSpecification(): OpeningHoursSpecificationSchema {
  return {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: [...FMWORKS_BUSINESS_DETAILS.openingHours.dayOfWeek],
    opens: FMWORKS_BUSINESS_DETAILS.openingHours.opens,
    closes: FMWORKS_BUSINESS_DETAILS.openingHours.closes,
  };
}

/**
 * Генерирует структурированную разметку Schema.org `Organization` для парсеров Яндекса и Google.
 */
export function buildOrganizationJsonLd(
  origin: string,
  imagePath = DEFAULT_OG_IMAGE_PATH
): OrganizationJsonLd {
  const cleanOrigin = normalizeSeoOrigin(origin);
  const imageUrl = `${cleanOrigin}${imagePath}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${cleanOrigin}/#organization`,
    name: FMWORKS_BUSINESS_DETAILS.brandName,
    legalName: FMWORKS_BUSINESS_DETAILS.legalName,
    alternateName: FMWORKS_BUSINESS_DETAILS.alternateName,
    description: FMWORKS_BUSINESS_DETAILS.description,
    url: cleanOrigin,
    logo: {
      '@type': 'ImageObject',
      url: imageUrl,
      caption: FMWORKS_BUSINESS_DETAILS.legalName,
    },
    image: imageUrl,
    email: FMWORKS_BUSINESS_DETAILS.email,
    telephone: FMWORKS_BUSINESS_DETAILS.telephone,
    address: buildPostalAddress(),
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: FMWORKS_BUSINESS_DETAILS.telephone,
        email: FMWORKS_BUSINESS_DETAILS.email,
        contactType: 'sales',
        areaServed: 'RU',
        availableLanguage: ['Russian'],
        hoursAvailable: buildOpeningHoursSpecification(),
      },
    ],
    areaServed: {
      '@type': 'Country',
      name: 'Россия',
    },
    knowsAbout: [...FMWORKS_BUSINESS_DETAILS.knowsAbout],
  };
}

/**
 * Генерирует структурированную разметку Schema.org `LocalBusiness` с адресом в Твери,
 * координатами, режимом работы, прайс-диапазоном и способами оплаты.
 */
export function buildLocalBusinessJsonLd(
  origin: string,
  imagePath = DEFAULT_OG_IMAGE_PATH
): LocalBusinessJsonLd {
  const cleanOrigin = normalizeSeoOrigin(origin);
  const imageUrl = `${cleanOrigin}${imagePath}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${cleanOrigin}/#localbusiness`,
    name: FMWORKS_BUSINESS_DETAILS.brandName,
    alternateName: FMWORKS_BUSINESS_DETAILS.legalName,
    description: FMWORKS_BUSINESS_DETAILS.description,
    url: cleanOrigin,
    image: imageUrl,
    email: FMWORKS_BUSINESS_DETAILS.email,
    telephone: FMWORKS_BUSINESS_DETAILS.telephone,
    priceRange: FMWORKS_BUSINESS_DETAILS.priceRange,
    currenciesAccepted: FMWORKS_BUSINESS_DETAILS.currenciesAccepted,
    paymentAccepted: FMWORKS_BUSINESS_DETAILS.paymentAccepted,
    address: buildPostalAddress(),
    geo: {
      '@type': 'GeoCoordinates',
      latitude: FMWORKS_BUSINESS_DETAILS.geo.latitude,
      longitude: FMWORKS_BUSINESS_DETAILS.geo.longitude,
    },
    openingHoursSpecification: [buildOpeningHoursSpecification()],
    areaServed: [
      {
        '@type': 'City',
        name: 'Тверь',
      },
      {
        '@type': 'Country',
        name: 'Россия',
      },
    ],
    parentOrganization: {
      '@id': `${cleanOrigin}/#organization`,
    },
  };
}

/**
 * Генерирует Schema.org `WebSite` JSON-LD с `potentialAction` (`SearchAction`)
 * и свойствами `query-input` / `search-input` для Sitelinks Search Box в Яндексе и Google.
 */
export function buildWebSiteJsonLd(origin: string): WebSiteJsonLd {
  const cleanOrigin = normalizeSeoOrigin(origin);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${cleanOrigin}/#website`,
    name: FMWORKS_BUSINESS_DETAILS.brandName,
    alternateName: FMWORKS_BUSINESS_DETAILS.legalName,
    description: FMWORKS_BUSINESS_DETAILS.description,
    url: `${cleanOrigin}/`,
    inLanguage: 'ru-RU',
    publisher: {
      '@id': `${cleanOrigin}/#organization`,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${cleanOrigin}/cases?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
      'search-input': 'required name=search_term_string',
    },
  };
}

/**
 * Безопасно создаёт или обновляет `<script type="application/ld+json">` внутри `<head>`.
 */
export function upsertJsonLdScriptInHead(
  scriptId: string,
  payload: unknown
): void {
  if (typeof document === 'undefined' || !document.head) return;
  let scriptEl = document.getElementById(scriptId) as HTMLScriptElement | null;
  if (!scriptEl) {
    scriptEl = document.createElement('script');
    scriptEl.id = scriptId;
    scriptEl.type = 'application/ld+json';
    document.head.appendChild(scriptEl);
  }
  scriptEl.textContent = JSON.stringify(payload);
}

/**
 * Автоматически внедряет JSON-LD схему `WebSite` (Sitelinks Search Box) в `<head>` документа.
 */
export function injectWebSiteSchemaIntoDocument(origin?: string): WebSiteJsonLd {
  const resolvedOrigin =
    origin ||
    (typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://fmworks.ru');
  const website = buildWebSiteJsonLd(resolvedOrigin);
  upsertJsonLdScriptInHead(WEBSITE_JSONLD_SCRIPT_ID, website);
  return website;
}

/**
 * Автоматически внедряет JSON-LD схемы `Organization`, `LocalBusiness` и `WebSite` в `<head>` документа.
 */
export function injectBusinessSchemasIntoDocument(
  origin?: string,
  imagePath = DEFAULT_OG_IMAGE_PATH
): {
  organization: OrganizationJsonLd;
  localBusiness: LocalBusinessJsonLd;
  website: WebSiteJsonLd;
} {
  const resolvedOrigin =
    origin ||
    (typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://fmworks.ru');

  const organization = buildOrganizationJsonLd(resolvedOrigin, imagePath);
  const localBusiness = buildLocalBusinessJsonLd(resolvedOrigin, imagePath);
  const website = buildWebSiteJsonLd(resolvedOrigin);

  upsertJsonLdScriptInHead(ORGANIZATION_JSONLD_SCRIPT_ID, organization);
  upsertJsonLdScriptInHead(LOCAL_BUSINESS_JSONLD_SCRIPT_ID, localBusiness);
  upsertJsonLdScriptInHead(WEBSITE_JSONLD_SCRIPT_ID, website);

  return { organization, localBusiness, website };
}
