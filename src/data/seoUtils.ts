export const DEFAULT_OG_IMAGE_PATH =
  '/src/assets/images/hero_studio_editorial_1794399404984.jpg';
export const ORGANIZATION_JSONLD_SCRIPT_ID = 'fmworks-organization-jsonld';
export const LOCAL_BUSINESS_JSONLD_SCRIPT_ID = 'fmworks-localbusiness-jsonld';
export const SERVICE_JSONLD_SCRIPT_ID = 'fmworks-service-jsonld';
export const WEBSITE_JSONLD_SCRIPT_ID = 'fmworks-website-jsonld';

export const FMWORKS_BUSINESS_DETAILS = {
  brandName: 'FMWorks',
  legalName: 'Аудиопродакшн-студия FMWorks®',
  alternateName: 'Студия коммерческого аудиопродакшна FMWorks (AudioWorks)',
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

export interface ServiceOfferItemSchema {
  '@type': 'Offer';
  name: string;
  description: string;
  url: string;
  price?: string;
  priceCurrency: 'RUB';
  availability: 'https://schema.org/InStock';
  itemOffered: {
    '@type': 'Service';
    name: string;
    description: string;
    provider: {
      '@id': string;
    };
  };
}

export interface ServiceOfferCatalogSchema {
  '@type': 'OfferCatalog';
  name: string;
  itemListElement: ServiceOfferItemSchema[];
}

export interface ServiceJsonLd {
  '@context': 'https://schema.org';
  '@type': 'Service';
  '@id': string;
  name: string;
  alternateName: string;
  serviceType: string;
  category: string;
  description: string;
  url: string;
  image: string;
  provider: {
    '@type': 'LocalBusiness';
    '@id': string;
    name: string;
    telephone: string;
    email: string;
  };
  brand: {
    '@type': 'Brand';
    name: string;
    alternateName: string;
  };
  areaServed: Array<{
    '@type': 'City' | 'Country';
    name: string;
  }>;
  audience: {
    '@type': 'BusinessAudience';
    audienceType: string;
  };
  termsOfService: string;
  serviceOutput: string;
  offers: {
    '@type': 'AggregateOffer';
    priceCurrency: 'RUB';
    lowPrice: string;
    highPrice: string;
    offerCount: number;
    url: string;
  };
  hasOfferCatalog: ServiceOfferCatalogSchema;
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
  contactPoint: Array<{
    '@type': 'ContactPoint';
    telephone: string;
    email: string;
    contactType: string;
    areaServed: string;
    availableLanguage: string[];
    hoursAvailable: OpeningHoursSpecificationSchema;
  }>;
  areaServed: Array<{
    '@type': 'City' | 'Country';
    name: string;
  }>;
  knowsAbout: string[];
  makesOffer: Array<{
    '@type': 'Offer';
    itemOffered: {
      '@type': 'Service';
      '@id': string;
      name: string;
    };
  }>;
  hasOfferCatalog: ServiceOfferCatalogSchema;
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

function buildServiceOfferCatalog(cleanOrigin: string): ServiceOfferCatalogSchema {
  const providerRef = { '@id': `${cleanOrigin}/#localbusiness` };
  return {
    '@type': 'OfferCatalog',
    name: 'Пакеты студийного аудиопродакшна FMWorks (AudioWorks)',
    itemListElement: [
      {
        '@type': 'Offer',
        name: 'Голос и стиль (по готовому тексту, 24–48 ч)',
        description:
          'Запись актёра дубляжа по готовому сценарию, редакторская выверка под эфир, лицензионная музыка, сведение -14 LUFS и паспорт прав РАО/ВОИС.',
        url: `${cleanOrigin}/pricing`,
        price: '15000',
        priceCurrency: 'RUB',
        availability: 'https://schema.org/InStock',
        itemOffered: {
          '@type': 'Service',
          name: 'Голос и стиль — озвучка и сведение ролика по готовому тексту',
          description:
            'Выпуск готового эфирного аудиоролика за 24–48 часов по тексту заказчика с паспортом прав РАО/ВОИС.',
          provider: providerRef,
        },
      },
      {
        '@type': 'Offer',
        name: 'Продакшн под ключ (3 сценария с нуля, 3–4 дня)',
        description:
          'Полный цикл производства аудиоролика с нуля: 3 концепции сценария, кастинг и режиссёрская запись, саунд-дизайн, проверка ФЗ-38 и паспорт прав.',
        url: `${cleanOrigin}/pricing`,
        price: '25000',
        priceCurrency: 'RUB',
        availability: 'https://schema.org/InStock',
        itemOffered: {
          '@type': 'Service',
          name: 'Продакшн аудиоролика под ключ',
          description:
            'Разработка 3 сценариев с нуля, запись диктора кинодубляжа, саунд-дизайн и полная очистка прав за 3–4 дня.',
          provider: providerRef,
        },
      },
      {
        '@type': 'Offer',
        name: 'Игровой ролик / Мини-кино (2–3 актёра, 4–5 дней)',
        description:
          'Постановочный диалоговый аудиоролик на 2–3 голоса, фоли-эффекты и атмосфера, эфирный ресайз 15 сек и паспорт прав РАО/ВОИС.',
        url: `${cleanOrigin}/pricing`,
        price: '35000',
        priceCurrency: 'RUB',
        availability: 'https://schema.org/InStock',
        itemOffered: {
          '@type': 'Service',
          name: 'Игровой аудиоролик / Мини-кино',
          description:
            'Сюжетная радиопостановка с несколькими актёрами, кинематографическим саунд-дизайном и ресайзом 15 сек за 4–5 дней.',
          provider: providerRef,
        },
      },
      {
        '@type': 'Offer',
        name: 'Срочный заказ аудиоролика от 1 часа (по договорной цене)',
        description:
          'Экстренная запись голоса и сведение по готовому тексту без разработки сценария от 1 часа по договорной цене.',
        url: `${cleanOrigin}/faq#urgent-order`,
        priceCurrency: 'RUB',
        availability: 'https://schema.org/InStock',
        itemOffered: {
          '@type': 'Service',
          name: 'Срочный выпуск аудиоролика от 1 часа',
          description:
            'Внеочередная запись диктора и мастеринг под радиоэфир от 1 часа по готовому тексту заказчика.',
          provider: providerRef,
        },
      },
    ],
  };
}

/**
 * Генерирует структурированную разметку Schema.org `Service` для услуг аудиопродакшна FMWorks (AudioWorks).
 */
export function buildServiceJsonLd(
  origin: string,
  imagePath = DEFAULT_OG_IMAGE_PATH
): ServiceJsonLd {
  const cleanOrigin = normalizeSeoOrigin(origin);
  const imageUrl = `${cleanOrigin}${imagePath}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${cleanOrigin}/#service`,
    name: 'Студийный аудиопродакшн и производство рекламных аудиороликов FMWorks (AudioWorks)',
    alternateName: 'AudioWorks — производство радиороликов, сценариев и озвучки под ключ',
    serviceType: 'Производство рекламных аудиороликов и студийный аудиопродакшн',
    category: 'Аудиореклама, озвучка и саунд-дизайн для радио и бизнеса',
    description: FMWORKS_BUSINESS_DETAILS.description,
    url: `${cleanOrigin}/pricing`,
    image: imageUrl,
    provider: {
      '@type': 'LocalBusiness',
      '@id': `${cleanOrigin}/#localbusiness`,
      name: FMWORKS_BUSINESS_DETAILS.brandName,
      telephone: FMWORKS_BUSINESS_DETAILS.telephone,
      email: FMWORKS_BUSINESS_DETAILS.email,
    },
    brand: {
      '@type': 'Brand',
      name: FMWORKS_BUSINESS_DETAILS.brandName,
      alternateName: 'AudioWorks',
    },
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
    audience: {
      '@type': 'BusinessAudience',
      audienceType:
        'Рекламодатели, отделы маркетинга, девелоперы, медицинские клиники, ритейл и B2B-компании',
    },
    termsOfService: `${cleanOrigin}/faq`,
    serviceOutput:
      'Эфирный мастер-файл (WAV 44.1 kHz / 16 bit + MP3 320 kbps, -14 LUFS), паспорт прав РАО/ВОИС и закрывающие документы по ЭДО',
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'RUB',
      lowPrice: '15000',
      highPrice: '35000',
      offerCount: 4,
      url: `${cleanOrigin}/pricing`,
    },
    hasOfferCatalog: buildServiceOfferCatalog(cleanOrigin),
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
 * Генерирует структурированную разметку Schema.org `LocalBusiness` с регионом,
 * координатами, режимом работы, прайс-диапазоном, каталогом услуг и способами оплаты.
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
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: FMWORKS_BUSINESS_DETAILS.telephone,
        email: FMWORKS_BUSINESS_DETAILS.email,
        contactType: 'customer service',
        areaServed: 'RU',
        availableLanguage: ['Russian'],
        hoursAvailable: buildOpeningHoursSpecification(),
      },
    ],
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
    knowsAbout: [...FMWORKS_BUSINESS_DETAILS.knowsAbout],
    makesOffer: [
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          '@id': `${cleanOrigin}/#service`,
          name: 'Студийный аудиопродакшн и производство рекламных аудиороликов FMWorks (AudioWorks)',
        },
      },
    ],
    hasOfferCatalog: buildServiceOfferCatalog(cleanOrigin),
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
 * Автоматически внедряет JSON-LD схему `Service` в `<head>` документа.
 */
export function injectServiceSchemaIntoDocument(
  origin?: string,
  imagePath = DEFAULT_OG_IMAGE_PATH
): ServiceJsonLd {
  const resolvedOrigin =
    origin ||
    (typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://fmworks.ru');
  const service = buildServiceJsonLd(resolvedOrigin, imagePath);
  upsertJsonLdScriptInHead(SERVICE_JSONLD_SCRIPT_ID, service);
  return service;
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
 * Автоматически внедряет JSON-LD схемы `Organization`, `LocalBusiness`, `Service` и `WebSite` в `<head>` документа.
 */
export function injectBusinessSchemasIntoDocument(
  origin?: string,
  imagePath = DEFAULT_OG_IMAGE_PATH
): {
  organization: OrganizationJsonLd;
  localBusiness: LocalBusinessJsonLd;
  service: ServiceJsonLd;
  website: WebSiteJsonLd;
} {
  const resolvedOrigin =
    origin ||
    (typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://fmworks.ru');

  const organization = buildOrganizationJsonLd(resolvedOrigin, imagePath);
  const localBusiness = buildLocalBusinessJsonLd(resolvedOrigin, imagePath);
  const service = buildServiceJsonLd(resolvedOrigin, imagePath);
  const website = buildWebSiteJsonLd(resolvedOrigin);

  upsertJsonLdScriptInHead(ORGANIZATION_JSONLD_SCRIPT_ID, organization);
  upsertJsonLdScriptInHead(LOCAL_BUSINESS_JSONLD_SCRIPT_ID, localBusiness);
  upsertJsonLdScriptInHead(SERVICE_JSONLD_SCRIPT_ID, service);
  upsertJsonLdScriptInHead(WEBSITE_JSONLD_SCRIPT_ID, website);

  return { organization, localBusiness, service, website };
}
