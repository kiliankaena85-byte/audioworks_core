import {
  resolveActiveStudioProfile,
  resolveSecondaryStudioProfile,
  sanitizePrivacyPolicySettings,
  sanitizeStudioLegalProfilesConfig,
  type StudioLegalProfile,
  type StudioLegalProfilesConfig,
} from '../data/studioDocumentsCore';

export interface OperatorPassportView {
  operatorTitle: string;
  shortBrandTitle: string;
  entityKindLabel: string;
  requisitesLine: string;
  hasFullRegistrationIds: boolean;
  pendingRegistrationNote: string | null;
  addressLine: string;
  websiteDomain: string;
  contactEmail: string;
  privacyEmail: string;
  phone: string;
  signatoryLine: string | null;
  rknRegistryLine: string | null;
  policyVersionDate: string;
  hostingLocationLabel: string;
  secondaryEntityDisclosure: string | null;
}

export interface PolicyProcessingPurposeBlock {
  id: string;
  numberLabel: string;
  title: string;
  subjects: string;
  dataCategories: readonly string[];
  legalBasis: string;
  actionsAndStorage: string;
  retentionAndDestruction: string;
}

export interface CookieAndStorageItem {
  id: string;
  storageKey: string;
  kindLabel: string;
  purpose: string;
  retention: string;
}

export interface StandaloneConsentDocumentView {
  heading: string;
  leadParagraph: string;
  dataItems: readonly string[];
  purposesParagraph: string;
  actionsParagraph: string;
  guaranteesAndRevocationParagraph: string;
}

function buildProfileRequisitesParts(profile: StudioLegalProfile): string[] {
  const parts: string[] = [];
  if (profile.inn) {
    parts.push(`ИНН ${profile.inn}`);
  }
  if (profile.entityKind === 'ooo' && profile.kpp) {
    parts.push(`КПП ${profile.kpp}`);
  }
  if (profile.ogrnOrOgrnip) {
    parts.push(
      `${profile.entityKind === 'ip' ? 'ОГРНИП' : 'ОГРН'} ${profile.ogrnOrOgrnip}`
    );
  }
  return parts;
}

/**
 * Формирует компактную строку открытых реквизитов владельца сайта для подвала (ст. 10 ФЗ № 149-ФЗ).
 * Если ИНН/ОГРН временно очищены администратором (этап регистрации ООО/ИП), выводит чистое наименование и город без пустых ярлыков.
 */
export function formatOperatorInlineRequisites(
  rawConfig?: Partial<StudioLegalProfilesConfig> | null
): string {
  const config = sanitizeStudioLegalProfilesConfig(rawConfig);
  const active = resolveActiveStudioProfile(config);
  const privacy = sanitizePrivacyPolicySettings(config.privacyPolicy, active.email);

  const chunks: string[] = [active.legalName];
  const reqParts = buildProfileRequisitesParts(active);
  if (reqParts.length > 0) {
    chunks.push(...reqParts);
  }
  const locationText = active.legalAddress || active.city;
  if (locationText) {
    chunks.push(locationText);
  }
  if (privacy.rknRegistryNumber) {
    chunks.push(`Реестр РКН № ${privacy.rknRegistryNumber}`);
  }
  return chunks.join(' · ');
}

/**
 * Собирает полный паспорт Оператора ПДн без хардкода реквизитов (автоматически подстраивается под ООО, ИП или двухконтурный режим).
 */
export function buildOperatorPassportSummary(
  rawConfig?: Partial<StudioLegalProfilesConfig> | null
): OperatorPassportView {
  const config = sanitizeStudioLegalProfilesConfig(rawConfig);
  const active = resolveActiveStudioProfile(config);
  const secondary = resolveSecondaryStudioProfile(config);
  const privacy = sanitizePrivacyPolicySettings(config.privacyPolicy, active.email);

  const reqParts = buildProfileRequisitesParts(active);
  const hasFullRegistrationIds = Boolean(active.inn && active.ogrnOrOgrnip);
  const requisitesLine =
    reqParts.length > 0
      ? reqParts.join(' · ')
      : 'Регистрационные реквизиты (ИНН / ОГРН) вносятся после завершения постановки на учёт';

  const pendingRegistrationNote = hasFullRegistrationIds
    ? null
    : 'Юридические реквизиты Оператора находятся на стадии внесения и актуализируются в настоящем разделе до выставления расчётных документов.';

  const addressLine = active.legalAddress
    ? active.legalAddress
    : `${active.city}, Российская Федерация`;

  const privacyEmail = privacy.privacyEmail || active.email;

  const signatoryLine =
    active.signatoryRoleTitle && (active.signatoryFullName || active.signatoryShortName)
      ? `${active.signatoryRoleTitle}: ${active.signatoryFullName || active.signatoryShortName}`
      : null;

  const rknRegistryLine = privacy.rknRegistryNumber
    ? `Регистрационный номер в Реестре операторов ПДн Роскомнадзора: ${privacy.rknRegistryNumber}`
    : null;

  let secondaryEntityDisclosure: string | null = null;
  if (secondary) {
    const secParts = buildProfileRequisitesParts(secondary);
    const secReqSuffix = secParts.length > 0 ? ` (${secParts.join(', ')})` : '';
    secondaryEntityDisclosure = `При выборе Заказчиком соответствующего налогового контура расчётов заключение и исполнение договора по поручению и с согласия Заказчика (ч. 3 ст. 6 Закона № 152-ФЗ) может осуществляться вторым расчётным лицом студии: ${secondary.legalName}${secReqSuffix}.`;
  }

  return {
    operatorTitle: active.legalName,
    shortBrandTitle: active.shortBrandTitle,
    entityKindLabel:
      active.entityKind === 'ooo'
        ? 'Общество с ограниченной ответственностью (ООО)'
        : 'Индивидуальный предприниматель (ИП)',
    requisitesLine,
    hasFullRegistrationIds,
    pendingRegistrationNote,
    addressLine,
    websiteDomain: active.websiteDomain,
    contactEmail: active.email,
    privacyEmail,
    phone: active.phone,
    signatoryLine,
    rknRegistryLine,
    policyVersionDate: privacy.policyVersionDate,
    hostingLocationLabel: privacy.hostingLocationLabel,
    secondaryEntityDisclosure,
  };
}

/**
 * Формирует реестр всех 4 фактических целей обработки ПДн на платформе по структуре Роскомнадзора (ч. 1 ст. 18.1 152-ФЗ).
 */
export function buildPolicyProcessingPurposes(
  rawConfig?: Partial<StudioLegalProfilesConfig> | null
): readonly PolicyProcessingPurposeBlock[] {
  const passport = buildOperatorPassportSummary(rawConfig);

  return [
    {
      id: 'lead_and_brief',
      numberLabel: 'Цель 01',
      title: 'Приём заявок, расчёт сметы аудиопродакшна и преддоговорная связь продюсера',
      subjects:
        'Посетители сайта, представители потенциальных заказчиков (юридических лиц, ИП и физических лиц).',
      dataCategories: [
        'Имя (фамилия, имя, отчество при указании в форме);',
        'Контактный номер телефона, адрес электронной почты или идентификатор мессенджера;',
        'Наименование и ИНН представляемой организации / ИП (при указании);',
        'Текстовое описание задачи или аудиозапись голосового брифа.',
      ],
      legalBasis:
        'Согласие субъекта персональных данных (п. 1 ч. 1 ст. 6, ст. 9 Закона № 152-ФЗ в ред. ФЗ № 156-ФЗ) и действия по инициативе субъекта для заключения договора (п. 5 ч. 1 ст. 6 Закона № 152-ФЗ). Специальные и биометрические ПДн (ст. 10–11 152-ФЗ) не собираются.',
      actionsAndStorage: `Автоматизированная и смешанная обработка (сбор, запись, систематизация, накопление, хранение, уточнение, использование для связи продюсера и формирования КП). Локализация первичной базы: ${passport.hostingLocationLabel}.`,
      retentionAndDestruction: `До перехода заявки в действующий договор либо не более 12 месяцев с момента последнего обращения (или в течение 10 рабочих дней при отзыве согласия на ${passport.privacyEmail} в порядке ч. 5 ст. 21 152-ФЗ) путём безвозвратного программного стирания/обезличивания записи.`,
    },
    {
      id: 'b2b_contracts_edo',
      numberLabel: 'Цель 02',
      title: 'Заключение и исполнение договоров, выставление счетов (ЭДО / 54-ФЗ) и передача прав РАО / ВОИС',
      subjects:
        'Контрагенты (представители юридических лиц, ИП, плательщики), подписанты договоров и закрывающих актов.',
      dataCategories: [
        'ФИО и должность представителя / подписанта Заказчика, основание полномочий;',
        'Реквизиты контрагента (ИНН, КПП, ОГРН/ОГРНИП, юридический адрес, идентификатор ЭДО);',
        'Контактный телефон и электронная почта для направления счетов, актов сдачи-приёмки и паспортов роликов.',
      ],
      legalBasis:
        'Заключение и исполнение договора, стороной или выгодоприобретателем по которому является субъект ПДн (п. 5 ч. 1 ст. 6 152-ФЗ), часть четвёртая ГК РФ (ст. 1234, 1285), Федеральный закон № 402-ФЗ «О бухгалтерском учёте» и № 54-ФЗ.',
      actionsAndStorage:
        'Формирование Договора с Приложением, Счёта на оплату, Акта сдачи-приёмки и Паспорта рекламного аудиоролика РАО/ВОИС, обмен электронными документами через российских операторов ЭДО.',
      retentionAndDestruction:
        'В течение срока действия договора и 5 (пяти) лет после окончания отчётного года хранения первичных учётных документов согласно ст. 29 Закона № 402-ФЗ, после чего записи уничтожаются из архива.',
    },
    {
      id: 'client_cabinet_auth',
      numberLabel: 'Цель 03',
      title: 'Беспарольная регистрация, вход и работа Заказчика в Личном кабинете (/cabinet)',
      subjects:
        'Зарегистрированные и гостевые пользователи Личного кабинета заказов студии.',
      dataCategories: [
        'Адрес рабочей или личной электронной почты для отправки одноразовых ссылок входа;',
        'Добровольно загруженное изображение профиля (аватар) и инициалы учётной записи;',
        'Загружаемые Заказчиком рабочие материалы проекта (документы, реквизиты, референсы) и комментарии к версиям ролика;',
        'Настройки системных уведомлений браузера о готовности демо и документов.',
      ],
      legalBasis:
        'Отдельное информированное согласие субъекта ПДн (ст. 9 Закона № 152-ФЗ в ред. ФЗ № 156-ФЗ) и исполнение обязательств по сопровождению заказов Заказчика (п. 5 ч. 1 ст. 6 Закона № 152-ФЗ).',
      actionsAndStorage: `Сбор, запись, хранение в защищённом контуре (${passport.hostingLocationLabel}), криптографическая привязка заказов к учётной записи клиента без хранения паролей.`,
      retentionAndDestruction: `На период использования Личного кабинета Заказчиком и сопровождения его архива мастер-файлов либо не позднее 10 рабочих дней с даты поступления заявления об удалении профиля / отзыве согласия на ${passport.privacyEmail}.`,
    },
    {
      id: 'security_and_cookies',
      numberLabel: 'Цель 04',
      title: 'Обеспечение информационной безопасности, защита сессий и техническая стабильность сайта',
      subjects: 'Все посетители сайта и авторизованные пользователи кабинетов.',
      dataCategories: [
        'Защищённые сессионные файлы cookie (с флагами HttpOnly и SameSite) и технические ключи localStorage;',
        'IP-адрес и технический заголовок браузера (User-Agent) для защиты форм от автоматического перебора и атак;',
        'Обезличенные показатели скорости отрисовки страниц (Core Web Vitals) на собственном сервере без сторонних рекламных счётчиков.',
      ],
      legalBasis:
        'Осуществление прав и законных интересов Оператора по защите информации в соответствии со ст. 19 Закона № 152-ФЗ (п. 7 ч. 1 ст. 6 152-ФЗ) и пользовательские настройки браузера.',
      actionsAndStorage:
        'Автоматическая проверка целостности сессии, ограничение частоты запросов (Rate Limiting), локальное хранение черновика брифа и выбранной темы оформления в браузере пользователя.',
      retentionAndDestruction:
        'Сессионные файлы cookie хранятся до выхода из кабинета (не более 30 суток); оперативные журналы защиты от перебора очищаются автоматически в срок до 90 суток.',
    },
  ];
}

/**
 * Прозрачная спецификация всех используемых на платформе технических cookie и ключей localStorage.
 */
export const PLATFORM_COOKIE_AND_STORAGE_SPEC: readonly CookieAndStorageItem[] = [
  {
    id: 'client_session_cookie',
    storageKey: 'fmworks_client_session',
    kindLabel: 'HttpOnly Cookie',
    purpose:
      'Защищённая беспарольная авторизация Заказчика в Личном кабинете (/cabinet) после перехода по одноразовой ссылке из письма.',
    retention: 'До нажатия «Выйти» (не более 30 суток)',
  },
  {
    id: 'studio_session_cookie',
    storageKey: 'fmworks_studio_session',
    kindLabel: 'HttpOnly Cookie',
    purpose:
      'Защищённая рабочая сессия сотрудников студии в закрытом административном контуре.',
    retention: 'На время рабочей смены (до выхода из сессии)',
  },
  {
    id: 'order_draft_local',
    storageKey: 'fmworks_order_draft / fmworks_client_cabinet',
    kindLabel: 'localStorage браузера',
    purpose:
      'Сохранение незавершённого черновика заказа и токенов гостевого доступа к своим заявкам в текущем браузере без передачи третьим лицам.',
    retention: 'Локально на устройстве пользователя до очистки или удаления',
  },
  {
    id: 'ui_prefs_local',
    storageKey: 'fmworks_rf_storage_notice_v1 / тема оформления',
    kindLabel: 'localStorage браузера',
    purpose:
      'Запоминание выбранной светлой/тёмной темы и факта ознакомления с уведомлением о технических cookie.',
    retention: 'Локально в браузере пользователя',
  },
] as const;

/**
 * Генерирует текст отдельного предметного согласия по ст. 9 152-ФЗ (в ред. ФЗ № 156-ФЗ) и ч. 1 ст. 18 38-ФЗ,
 * динамически подставляя реквизиты текущего Оператора (ООО или ИП) из настроек админ-панели.
 */
export function buildStandaloneConsentSpec(
  rawConfig?: Partial<StudioLegalProfilesConfig> | null
): StandaloneConsentDocumentView {
  const passport = buildOperatorPassportSummary(rawConfig);
  const reqInline = passport.hasFullRegistrationIds ? `, ${passport.requisitesLine}` : '';

  return {
    heading:
      'Согласие на обработку персональных данных (ст. 9 Федерального закона № 152-ФЗ в ред. ФЗ № 156-ФЗ)',
    leadParagraph: `Устанавливая отметку согласия в форме на сайте ${passport.websiteDomain}, я действую свободно, своей волей и в своём интересе и предоставляю конкретное, предметное, информированное, сознательное и однозначное согласие Оператору — ${passport.operatorTitle}${reqInline} (адрес: ${passport.addressLine}, эл. почта для обращений: ${passport.privacyEmail}) — на обработку моих персональных данных отдельно от иных договоров и соглашений:`,
    dataItems: [
      'имени (фамилии, имени, отчества при указании);',
      'номера контактного телефона, адреса электронной почты и/или идентификатора мессенджера;',
      'наименования и ИНН представляемого юридического лица или ИП (при указании);',
      'текстовых и голосовых материалов проектного брифа, рабочих файлов заказа и добровольно загруженного изображения профиля (аватара) в Личном кабинете;',
      'технических сессионных идентификаторов (защищённых файлов cookie и параметров сессии) для авторизации в Личном кабинете.',
    ],
    purposesParagraph:
      'Цели обработки: 1) приём и расчёт заявки, обратная связь продюсера по проекту; 2) подготовка и исполнение Договора с Приложением, Счёта (ЭДО / 54-ФЗ), Акта сдачи-приёмки и Паспорта рекламного аудиоролика РАО/ВОИС; 3) беспарольная регистрация, вход и сопровождение моих заказов в Личном кабинете на сайте.',
    actionsParagraph: `Перечень действий с данными: сбор, запись, систематизация, накопление, хранение на серверах в РФ (${passport.hostingLocationLabel}), уточнение (обновление, изменение), извлечение, использование, блокирование, обезличивание, удаление и уничтожение с использованием средств автоматизации и без них.${
      passport.secondaryEntityDisclosure ? ` ${passport.secondaryEntityDisclosure}` : ''
    }`,
    guaranteesAndRevocationParagraph: `Настоящее согласие НЕ включает согласие на получение рекламных рассылок (ч. 1 ст. 18 ФЗ № 38-ФЗ «О рекламе») и НЕ допускает трансграничную передачу моих персональных данных в сервисы Google или зарубежные рекламные сети. Согласие действует до достижения целей обработки (по первичным бухгалтерским документам — в сроки Закона № 402-ФЗ) и может быть в любой момент отозвано мною путём направления письменного или электронного уведомления на адрес ${passport.privacyEmail} с прекращением обработки и уничтожением/обезличиванием данных в срок не позднее 10 рабочих дней (ч. 5 ст. 21 Закона № 152-ФЗ).`,
  };
}

/**
 * Чистая проверка формы входа/привязки почты в Личном кабинете по требованиям 152-ФЗ / 156-ФЗ.
 */
export function validateCabinetEmailConsent(params: {
  email: string;
  consentAccepted: boolean;
}): {
  valid: boolean;
  emailError: string | null;
  consentError: string | null;
} {
  const trimmed = (params.email || '').trim().toLowerCase();
  const isEmailValid =
    trimmed.length >= 5 &&
    trimmed.length <= 160 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);

  const emailError = isEmailValid
    ? null
    : 'Укажите корректный адрес электронной почты (например, name@company.ru).';

  const consentError = params.consentAccepted
    ? null
    : 'Подтвердите согласие на обработку персональных данных (152-ФЗ) перед отправкой.';

  return {
    valid: isEmailValid && params.consentAccepted,
    emailError,
    consentError,
  };
}
