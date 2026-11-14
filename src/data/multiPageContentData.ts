import type { OrderFormatId } from './pricingData.ts';
import type { IndustryVerticalSlug } from './platformRouter.ts';
import {
  type AudienceTag,
  createSecondBasedPricingFromSlot,
  DEFAULT_RADIO_INVENTORY_SLOTS,
  type MediaClientNiche,
  type RadioInventorySlot,
  resolveSlotHotPrice,
  resolveSlotOfficialPrice,
} from './radioInventory.ts';
import type { PortfolioCaseRecord } from './studioCmsTypes.ts';

export const LOCAL_EDITORIAL_IMAGES = {
  studioHero: '/src/assets/images/hero_studio_editorial_1794399404984.jpg',
  estateCinema: '/src/assets/images/case_estate_cinema_1794399406227.jpg',
  retailCoffee: '/src/assets/images/case_retail_coffee_1794399406426.jpg',
  autoMobility: '/src/assets/images/case_auto_mobility_1794399407900.jpg',
  medicineClinic: '/src/assets/images/industry_medicine_clinic_1794514558724.jpg',
  b2bExecutive: '/src/assets/images/industry_b2b_executive_1794514561928.jpg',
  studioLegalMastering: '/src/assets/images/studio_legal_mastering_1794514561867.jpg',
  radioAttention: '/src/assets/images/editorial_radio_attention_1794514561935.jpg',
} as const;

/* ============================================================================
 * 1. КАРТОЧКИ РАДИОСТАНЦИЙ С ПОРТРЕТОМ АУДИТОРИИ И СЛОТАМИ
 * ============================================================================ */

export interface StationEditorialSeed {
  slug: string;
  stationName: string;
  shortPositioning: string;
  audienceCoreAge: string;
  incomeProfile: string;
  inCarListenSharePct: number;
  affinityIndexLabel: string;
  corePortrait: string;
  bestCategories: string[];
  editorialBuyingNote: string;
  moderationNuance: string;
}

export const STATION_EDITORIAL_SEEDS: readonly StationEditorialSeed[] = [
  {
    slug: 'business-fm',
    stationName: 'Business FM',
    shortPositioning: 'Главная деловая волна собственников, инвесторов и топ-менеджмента',
    audienceCoreAge: '30–54 года',
    incomeProfile: 'Высокий доход и владельцы бизнеса (AB / C+)',
    inCarListenSharePct: 74,
    affinityIndexLabel: 'Aff. 248 к ЛПР и сделкам с высоким чеком',
    corePortrait:
      'Руководители компаний, частные инвесторы и покупатели недвижимости бизнес-класса. Слушают короткие 15-минутные информационные циклы по пути на встречи и между переговорами.',
    bestCategories: ['ЖК бизнес- и премиум-класса', 'B2B-платформы и лизинг', 'Частная медицина и чекапы', 'Инвестиции и банки'],
    editorialBuyingNote:
      'Лучше всего работают сдержанные 15–20-секундные ролики с конкретной цифрой и без музыкальной суеты. Высокая плотность контакта достигается уже на 12–16 выходах.',
    moderationNuance:
      'Юристы станции строго проверяют подтверждение финансовых ставок, условия лизинга и реквизиты проектных деклараций застройщиков.',
  },
  {
    slug: 'monte-carlo',
    stationName: 'Радио Monte Carlo',
    shortPositioning: 'Эстетичный музыкальный эфир для аудитории с взыскательным вкусом',
    audienceCoreAge: '32–55 лет',
    incomeProfile: 'Премиальный сегмент и семейный бизнес-класс',
    inCarListenSharePct: 68,
    affinityIndexLabel: 'Aff. 215 к премиальным покупкам и архитектуре',
    corePortrait:
      'Предприниматели, архитекторы, врачи и топ-специалисты, которые избегают шумных разговорных шоу и выбирают спокойный инструментальный и мировой музыкальный фон.',
    bestCategories: ['Архитектурные кварталы и загородные дома', 'Эстетическая медицина и стоматология', 'Премиальный ритейл', 'Автомобили'],
    editorialBuyingNote:
      'Категорически противопоказана резкая акционная подача: идеальна камерная режиссура с паузой, бархатным тембром и мягким акустическим пространством.',
    moderationNuance:
      'Редакция эфира следит за эстетикой звучания: слишком резкие звуковые сигналы сирен или агрессивный крик диктора отправляются на доработку.',
  },
  {
    slug: 'avtoradio',
    stationName: 'Авторадио',
    shortPositioning: 'Максимальный автомобильный охват и лидер утреннего городского потока',
    audienceCoreAge: '28–52 года',
    incomeProfile: 'Активный средний и выше среднего доход',
    inCarListenSharePct: 82,
    affinityIndexLabel: 'Aff. 190 к автовладельцам и семейным покупкам',
    corePortrait:
      'Ежедневные водители с устойчивой привычкой включать утреннее драйв-шоу и дорожные сводки. Высокая частота семейных и бытовых решений прямо в пути.',
    bestCategories: ['Продукты питания и торговые сети', 'Автодилеры и сервис', 'Семейные жилые комплексы', 'Городские сервисы'],
    editorialBuyingNote:
      'В плотном рекламном блоке решает бытовой крючок первых 2,5 секунд и один короткий запоминаемый ориентир (бренд или поиск по двум словам).',
    moderationNuance:
      'В спонсорских включениях трафика действуют чёткие ограничения по хронометражу (до 15–20 сек), поэтому сценарий выверяется до полусекунды.',
  },
  {
    slug: 'europa-plus',
    stationName: 'Европа Плюс',
    shortPositioning: 'Динамичный федеральный охват активной городской аудитории',
    audienceCoreAge: '24–44 года',
    incomeProfile: 'Активные горожане со стабильным доходом',
    inCarListenSharePct: 64,
    affinityIndexLabel: 'Aff. 176 к ритейлу, HoReCa и цифровым сервисам',
    corePortrait:
      'Энергичные специалисты, молодые семьи и предприниматели. Слушают эфир как в автомобиле, так и в течение рабочего дня, быстро реагируют на сезонные предложения.',
    bestCategories: ['Ритейл, кофе и гастрономия', 'Онлайн-сервисы и подписки', 'Фитнес и частные клиники', 'События'],
    editorialBuyingNote:
      'Дневной интерактивный блок со среды по воскресенье даёт оптимальную стоимость тысячи контактов перед покупками выходного дня.',
    moderationNuance:
      'При упоминании акций и подарков обязательно проговаривать сроки проведения и источник подробной информации об организаторе.',
  },
  {
    slug: 'comedy-radio',
    stationName: 'Comedy Radio',
    shortPositioning: 'Высокое удержание внимания за счёт разговорного формата без переключения волны',
    audienceCoreAge: '25–45 лет',
    incomeProfile: 'Платёжеспособная аудитория (менеджеры, ИТ, предприниматели)',
    inCarListenSharePct: 71,
    affinityIndexLabel: 'Aff. 184 к удержанию во время рекламной паузы',
    corePortrait:
      'Слушатели разговорных шоу реже переключают станцию на рекламе, так как ждут продолжения диалога ведущих. Высокая доля мужской и деловой аудитории в вечернем прайме.',
    bestCategories: ['Авто и финтех', 'B2B-сервисы для малого бизнеса', 'Доставка и ритейл', 'Девелопмент комфорт+ и бизнес'],
    editorialBuyingNote:
      'Отлично работают ироничные игровые диалоги на 15–20 секунд, органично продолжающие живую разговорную интонацию эфира.',
    moderationNuance:
      'Игровые ролики не должны имитировать экстренные сообщения или голоса штатных ведущих конкретной программы без спонсорского пакета.',
  },
  {
    slug: 'kommersant-fm',
    stationName: 'Коммерсантъ FM',
    shortPositioning: 'Информационная радиостанция непрерывного вещания для управленцев и аналитиков',
    audienceCoreAge: '33–58 лет',
    incomeProfile: 'Руководители высшего звена, юристы, финансисты',
    inCarListenSharePct: 70,
    affinityIndexLabel: 'Aff. 236 к корпоративным закупкам и инвестициям',
    corePortrait:
      'Аудитория с аналитическим складом восприятия: ценит точность фактов, репутацию и спокойную аргументацию без эмоционального нажима.',
    bestCategories: ['Корпоративные финансы и консалтинг', 'Коммерческая и жилая недвижимость', 'Профильные медицинские центры', 'Премиум-авто'],
    editorialBuyingNote:
      'Рекомендуем дикторский манифест с взрослой, уверенной подачей и акцентом на надёжность, сроки или юридическую прозрачность продукта.',
    moderationNuance:
      'Любые формулировки «лидер рынка» или «номер один» принимаются только при наличии официального индустриального отчёта.',
  },
  {
    slug: 'dorozhnoe-radio',
    stationName: 'Дорожное Радио',
    shortPositioning: 'Широкий семейный и пригородный охват с высоким доверием к рекомендациям',
    audienceCoreAge: '34–60 лет',
    incomeProfile: 'Массовый семейный сегмент и домовладельцы',
    inCarListenSharePct: 76,
    affinityIndexLabel: 'Aff. 188 к семейной медицине, дому и продуктам',
    corePortrait:
      'Лояльная аудитория в ежедневных поездках и на загородных маршрутах выходного дня. Внимательно дослушивает спонсорские рубрики погоды и дорожной обстановки.',
    bestCategories: ['Многопрофильные клиники и аптеки', 'Продукты питания', 'Загородное строительство и товары для дома', 'Семейный ритейл'],
    editorialBuyingNote:
      'Спонсорство прогноза погоды обеспечивает закрепление бренда на коротком шаге кратности 5 секунд (10с, 15с, 20с) с минимальным рекламным окружением.',
    moderationNuance:
      'В спонсорских рубриках шаг хронометража кратен 5 секундам; медицинские ролики проходят обязательную проверку предупреждения о противопоказаниях.',
  },
  {
    slug: 'retro-fm',
    stationName: 'Ретро FM',
    shortPositioning: 'Зрелая платёжеспособная аудитория с высокой лояльностью к знакомым брендам',
    audienceCoreAge: '38–62 года',
    incomeProfile: 'Устойчивый семейный бюджет и сбережения',
    inCarListenSharePct: 62,
    affinityIndexLabel: 'Aff. 195 к медицинским услугам и крупным семейным покупкам',
    corePortrait:
      'Слушатели, принимающие взвешенные решения о здоровье семьи, ремонте, даче и сбережениях. Не любят торопливую молодёжную скороговорку.',
    bestCategories: ['Стоматология, офтальмология и диагностика', 'Продуктовые бренды с историей', 'Банковские вклады', 'Недвижимость'],
    editorialBuyingNote:
      'Лучший отклик дают тёплые актёрские голоса в умеренном темпе (до 2,1 слова в секунду) и мелодичное акустическое сопровождение.',
    moderationNuance:
      'Строгий контроль читаемости финальных юридических сносок: диктор должен произносить обязательный дисклеймер разборчиво, без экстремального ускорения.',
  },
  {
    slug: 'silver-rain',
    stationName: 'Серебряный Дождь',
    shortPositioning: 'Авторский интеллектуальный эфир для думающей городской аудитории',
    audienceCoreAge: '30–52 года',
    incomeProfile: 'Высокий доход, креативные индустрии и частный бизнес',
    inCarListenSharePct: 69,
    affinityIndexLabel: 'Aff. 210 к авторскому девелопменту, культуре и медицине',
    corePortrait:
      'Независимые предприниматели, ИТ-директора, врачи и ценители современной городской среды, чувствительные к любой фальши в интонации.',
    bestCategories: ['Клубные дома и архитектура', 'Частные школы и клиники', 'Технологические B2B-решения', 'Гастрономия'],
    editorialBuyingNote:
      'Работает честный разговор на равных: как будто основатель бренда лично за 20 секунд объясняет суть своего продукта умному собеседнику.',
    moderationNuance:
      'Приветствуется естественная человеческая речь; важно заранее согласовать возрастную маркировку для культурных и образовательных проектов.',
  },
  {
    slug: 'radio-jazz',
    stationName: 'Радио JAZZ',
    shortPositioning: 'Камерная волна для ценителей статуса, тишины и сложных продуктов',
    audienceCoreAge: '35–58 лет',
    incomeProfile: 'Премиальный доход и владельцы капитала',
    inCarListenSharePct: 66,
    affinityIndexLabel: 'Aff. 225 к приватным сервисам, клубным ЖК и wealth-услугам',
    corePortrait:
      'Узкое, но исключительно качественное ядро слушателей, выбирающих джазовый эфир как фильтр от суеты мегаполиса.',
    bestCategories: ['Клубная недвижимость', 'Private banking и консалтинг', 'Премиальная медицина', 'Дизайн интерьеров'],
    editorialBuyingNote:
      'Сверхсрочные квоты спонсорства трафика и погоды позволяют выйти в эфир буквально на следующее утро при наличии готового ролика с паспортом прав.',
    moderationNuance:
      'Музыкальная подложка ролика должна гармонировать с акустической эстетикой станции — используем живые инструменты из очищенных студийных библиотек.',
  },
  {
    slug: 'novoe-radio',
    stationName: 'Новое Радио',
    shortPositioning: 'Высокоэнергетичный массовый охват молодой и семейной аудитории',
    audienceCoreAge: '20–39 лет',
    incomeProfile: 'Массовый активный потребительский сегмент',
    inCarListenSharePct: 59,
    affinityIndexLabel: 'Aff. 182 к доставке, e-commerce, FMCG и промо-акциям',
    corePortrait:
      'Покупатели с быстрым импульсным откликом со смартфона: услышав чёткий оффер в утреннем шоу, сразу ищут бренд или промокод в поиске.',
    bestCategories: ['Доставка еды и маркетплейсы', 'Сетевой ритейл и кафе', 'Мобильные сервисы', 'Образование и карьера'],
    editorialBuyingNote:
      'Короткие 12–15-секундные ролики с ритмичным саунд-дизайном и звуковым логотипом в финале дают максимальную конверсию на рубль бюджета.',
    moderationNuance:
      'Для дистанционной торговли и доставки в финале ролика указываются реквизиты продавца согласно правилам дистанционной продажи.',
  },
  {
    slug: 'relax-fm',
    stationName: 'Relax FM',
    shortPositioning: 'Спокойная эмоциональная среда без стресса для здоровья, семьи и дома',
    audienceCoreAge: '30–54 года',
    incomeProfile: 'Средний+ и высокий доход, фокус на качестве жизни',
    inCarListenSharePct: 63,
    affinityIndexLabel: 'Aff. 206 к клиникам, wellness и семейным кварталам',
    corePortrait:
      'Люди, сознательно переключающиеся на мягкую волну для восстановления концентрации в дороге, дома или в кабинете.',
    bestCategories: ['Многопрофильная медицина и чекапы', 'Семейные парковые ЖК', 'Курорты и wellness', 'Товары для сна и дома'],
    editorialBuyingNote:
      'Мягкий доверительный тембр в окружении спокойного эфира запоминается глубже, чем любой громкий слоган на разговорной волне.',
    moderationNuance:
      'Станция внимательно контролирует уровень громкости и отсутствие резких частотных всплесков — наш студийный мастеринг учитывает это по умолчанию.',
  },
] as const;

export function stationNameToSlug(stationName: string): string {
  const found = STATION_EDITORIAL_SEEDS.find(
    (s) => s.stationName.toLowerCase() === stationName.trim().toLowerCase()
  );
  if (found) return found.slug;

  const translitMap: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
    и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };

  return stationName
    .trim()
    .toLowerCase()
    .split('')
    .map((ch) => translitMap[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'station';
}

export interface StationCatalogProfile extends StationEditorialSeed {
  frequencyFm: string;
  audienceTags: AudienceTag[];
  slots: RadioInventorySlot[];
  minRatePerSecRub: number;
  minPackageHotPriceRub: number;
  maxDiscountPercent: number;
  totalStationOTS: number;
}

/**
 * Собирает живой каталог карточек радиостанций, объединяя редакционные портреты аудитории
 * с актуальными слотами и посекундными ставками из хранилища эфирных квот.
 */
export function buildStationCatalogProfiles(
  inventorySlots: readonly RadioInventorySlot[] = DEFAULT_RADIO_INVENTORY_SLOTS
): StationCatalogProfile[] {
  const visibleSlots = inventorySlots.filter((s) => !s.isHidden);
  const grouped = new Map<string, RadioInventorySlot[]>();

  for (const slot of visibleSlots) {
    const slug = stationNameToSlug(slot.station);
    const list = grouped.get(slug) ?? [];
    list.push(slot);
    grouped.set(slug, list);
  }

  const profiles: StationCatalogProfile[] = [];

  for (const [slug, slots] of grouped.entries()) {
    const primary = slots[0]!;
    const seed = STATION_EDITORIAL_SEEDS.find((s) => s.slug === slug);

    const tagSet = new Set<AudienceTag>();
    let minRatePerSecRub = Number.POSITIVE_INFINITY;
    let minPackageHotPriceRub = Number.POSITIVE_INFINITY;
    let maxDiscountPercent = 0;
    let totalStationOTS = 0;

    for (const sl of slots) {
      sl.audienceTags.forEach((t) => tagSet.add(t));
      const pricing = sl.secondBasedPricing ?? createSecondBasedPricingFromSlot(sl);
      const quote1Sec = pricing.calculateCost(Math.max(10, pricing.minDurationSeconds));
      const slotHotPrice = resolveSlotHotPrice(sl);
      const slotOfficialPrice = resolveSlotOfficialPrice(sl);
      minRatePerSecRub = Math.min(minRatePerSecRub, sl.pricePerSecond || quote1Sec.clientRatePerSecRub);
      minPackageHotPriceRub = Math.min(minPackageHotPriceRub, slotHotPrice);
      const disc =
        slotOfficialPrice > 0
          ? Math.round(((slotOfficialPrice - slotHotPrice) / slotOfficialPrice) * 100)
          : 0;
      maxDiscountPercent = Math.max(maxDiscountPercent, disc);
      totalStationOTS += sl.reachOTS;
    }

    profiles.push({
      slug,
      stationName: seed?.stationName ?? primary.station,
      shortPositioning: seed?.shortPositioning ?? primary.formatDesc,
      audienceCoreAge: seed?.audienceCoreAge ?? '25–54 года',
      incomeProfile: seed?.incomeProfile ?? 'Платёжеспособная городская аудитория',
      inCarListenSharePct: seed?.inCarListenSharePct ?? 68,
      affinityIndexLabel: seed?.affinityIndexLabel ?? 'Высокий индекс целевого охвата',
      corePortrait: seed?.corePortrait ?? primary.formatDesc,
      bestCategories: seed?.bestCategories ?? ['Ритейл и услуги', 'Недвижимость', 'Медицина', 'B2B'],
      editorialBuyingNote:
        seed?.editorialBuyingNote ??
        'Гибкий выбор утренних, дневных и вечерних блоков с честным посекундным пересчётом хронометража.',
      moderationNuance:
        seed?.moderationNuance ??
        'Стандартная юридическая проверка по ФЗ «О рекламе» и паспорту музыкального оформления.',
      frequencyFm: primary.frequencyFm,
      audienceTags: Array.from(tagSet),
      slots,
      minRatePerSecRub: Number.isFinite(minRatePerSecRub) ? Math.round(minRatePerSecRub) : 350,
      minPackageHotPriceRub: Number.isFinite(minPackageHotPriceRub) ? minPackageHotPriceRub : 68_000,
      maxDiscountPercent,
      totalStationOTS,
    });
  }

  return profiles;
}

/* ============================================================================
 * 2. ДЕТАЛЬНЫЕ РАЗБОРЫ КЕЙСОВ СО СЦЕНАРИЯМИ, ТАЙМКОДАМИ И ЦИФРАМИ
 * ============================================================================ */

export interface TimedScriptCue {
  timecode: string;
  layerLabel: string;
  spokenOrFoley: string;
  directorNote: string;
}

export interface CaseMetricBadge {
  value: string;
  label: string;
  context: string;
}

export interface CaseDetailedBreakdown {
  caseId: string;
  industrySlug: IndustryVerticalSlug;
  industryLabel: string;
  formatLabel: string;
  recommendedOrderTier: OrderFormatId;
  spotSeconds: number;
  clientChallenge: string;
  dramaticSolution: string;
  legalAdaptationNote: string;
  scriptCues: TimedScriptCue[];
  metrics: CaseMetricBadge[];
  recommendedStations: string[];
}

export const CASE_DETAILED_BREAKDOWNS: Record<string, CaseDetailedBreakdown> = {
  dmitrogorsky: {
    caseId: 'dmitrogorsky',
    industrySlug: 'retail-fmcg',
    industryLabel: 'Ритейл и FMCG',
    formatLabel: 'Игровая микро-сцена + фактурный саунд-дизайн',
    recommendedOrderTier: 'turnkey',
    spotSeconds: 21,
    clientChallenge:
      'Выделить линейку мясных и молочных завтраков в плотном утреннем автомобильном прайме среди десятка однотипных продуктовых объявлений со словом «вкусно» и перечнем скидок.',
    dramaticSolution:
      'Отказались от бодрого рекламного зазывалы. Открыли ролик полусекундной акустической паузой и крупным тактильным звуком хрустящей корочки и утреннего кофе, переключив воображение водителя до появления бренда.',
    legalAdaptationNote:
      'Нестандартный хронометраж 21 секунда позволил сохранить живое дыхание актёра и спокойно закрыть бренд-пэкшот без спешки, оплатив на станциях ровно 21 секунду по посекундной ставке.',
    scriptCues: [
      {
        timecode: '00:00–00:02',
        layerLabel: 'Крючок и звук',
        spokenOrFoley: '[Короткая пауза 0.4с. Крупный тёплый хруст свежей горячей корочки и глоток утреннего кофе]',
        directorNote: 'Контраст с предыдущим громким роликом в блоке мгновенно включает слуховой фокус.',
      },
      {
        timecode: '00:02–00:09',
        layerLabel: 'Сцена узнавания',
        spokenOrFoley: '«Тонкая, ещё горячая корочка медленно ломается под пальцами… и весь шумный день встаёт на паузу хотя бы на пять минут».',
        directorNote: 'Камерный грудной тембр на близком плане микрофона — ощущение личного разговора.',
      },
      {
        timecode: '00:09–00:16',
        layerLabel: 'Суть продукта',
        spokenOrFoley: '«Фермерские завтраки с собственных хозяйств. Натуральный состав, к которому хочется возвращаться каждое утро».',
        directorNote: 'Только один ключевой аргумент доверия без перегруза артикулами.',
      },
      {
        timecode: '00:16–00:21',
        layerLabel: 'Звуковой якорь',
        spokenOrFoley: '«Дмитрогорский продукт. Настоящее — слышно сразу. Спрашивайте в супермаркетах у дома».',
        directorNote: 'Чёткая фиксация названия бренда и места покупки в последние 5 секунд.',
      },
    ],
    metrics: [
      {
        value: '4 сети',
        label: 'модерация с 1-го дубля',
        context: 'Принято юристами четырёх радиохолдингов без правок',
      },
      {
        value: '21 сек',
        label: 'точный хронометраж',
        context: 'Экономия 30% эфирного бюджета относительно 30-секундного слота',
      },
      {
        value: '+27%',
        label: 'узнаваемость марки',
        context: 'Рост спонтанного вспоминания бренда по итогам 4-недельного флайта',
      },
    ],
    recommendedStations: ['Авторадио', 'Европа Плюс', 'Дорожное Радио'],
  },
  'business-estate': {
    caseId: 'business-estate',
    industrySlug: 'real-estate',
    industryLabel: 'ЖК и девелопмент',
    formatLabel: 'Атмосферное аудио-кино с интегрированным дисклеймером',
    recommendedOrderTier: 'cinema',
    spotSeconds: 20,
    clientChallenge:
      'Вывести в деловой радиоэфир новый пул видовых резиденций бизнес-класса, не скатываясь в дешёвую риторику «ликвидации квартир» и не разрушив статус проекта длинной юридической сноской по 214-ФЗ.',
    dramaticSolution:
      'Построили 20-секундный звуковой переход: шум вечерней магистрали физически отсекается мягким закрытием тяжёлой входной двери и сменяется тишиной приватного соснового двора.',
    legalAdaptationNote:
      'Обязательные сведения о застройщике и проектной декларации на наш.дом.рф записаны тем же благородным голосом в выверенном темпе 4,2 сек — кристально разборчиво для юристов станций и органично для слушателя.',
    scriptCues: [
      {
        timecode: '00:00–00:03',
        layerLabel: 'Акустический переход',
        spokenOrFoley: '[Гул вечернего проспекта мягко обрывается щелчком массивной двери — наступает глубокая тишина и шелест сосен]',
        directorNote: 'Физически демонстрируем главную ценность квартала за 3 секунды без лишних прилагательных.',
      },
      {
        timecode: '00:03–00:11',
        layerLabel: 'Образ резиденции',
        spokenOrFoley: '«Когда город остаётся за порогом, начинается ваше собственное время. Приватный квартал с двором-парком и террасами на верхних этажах».',
        directorNote: 'Спокойная интонация равного собеседника для аудитории деловых станций.',
      },
      {
        timecode: '00:11–00:16',
        layerLabel: 'Точка входа',
        spokenOrFoley: '«Персональный показ резиденций в эти выходные. Найдите в поиске: Форма Квартала».',
        directorNote: 'Двухсловный поисковый якорь вместо диктовки семизначного телефона за рулём.',
      },
      {
        timecode: '00:16–00:20',
        layerLabel: 'Дисклеймер 214-ФЗ',
        spokenOrFoley: '«Застройщик ООО СЗ Форма. Проектная декларация на сайте наш.дом.рф».',
        directorNote: 'Выверенный юридический финал на 4,0 сек со 100% соблюдением ФЗ-38.',
      },
    ],
    metrics: [
      {
        value: '+38%',
        label: 'целевых звонков',
        context: 'Прирост обращений в офис продаж за первые 3 недели эфира',
      },
      {
        value: '2 слова',
        label: 'поисковый якорь',
        context: 'Рост брендовых запросов в поиске в часы вечернего прайма на 44%',
      },
      {
        value: '20 сек',
        label: 'выверенный слот',
        context: 'Полный баланс имиджевой сцены и обязательного блока 214-ФЗ',
      },
    ],
    recommendedStations: ['Business FM', 'Радио Monte Carlo', 'Серебряный Дождь'],
  },
  'medical-clinics': {
    caseId: 'medical-clinics',
    industrySlug: 'medicine',
    industryLabel: 'Медицина и клиники',
    formatLabel: 'Доверительный актёрский тембр + комплаенс ст. 24 ФЗ',
    recommendedOrderTier: 'turnkey',
    spotSeconds: 15,
    clientChallenge:
      'Запустить сезонную кампанию кардиологических и семейных чекапов так, чтобы не звучать пугающе или казённо, и уложить в 15 секунд строгое медицинское предупреждение о противопоказаниях.',
    dramaticSolution:
      'Пригласили актрису кинодубляжа с тёплым, обволакивающим тембром. Сместили акцент с симптомов болезни на спокойную заботу о близких и понятный маршрут диагностики за один утренний визит.',
    legalAdaptationNote:
      'В медицинских аудиороликах предупреждение «Имеются противопоказания, необходима консультация специалиста» обязано звучать чётко и без маскирующих эффектов. Мы выделили под него чистые 3,2 секунды в финале.',
    scriptCues: [
      {
        timecode: '00:00–00:04',
        layerLabel: 'Тёплый контакт',
        spokenOrFoley: '«Самый ценный подарок родителям и себе — спокойная уверенность, что со здоровьем всё в порядке».',
        directorNote: 'Мягкая улыбка в голосе без тревожных интонаций и медицинских клише.',
      },
      {
        timecode: '00:04–00:11',
        layerLabel: 'Конкретика услуги',
        spokenOrFoley: '«Полный чекап организма за одно утро без очередей в клиниках ВераМед. Запись онлайн: ВераМед точка ру».',
        directorNote: 'Одна услуга + одно преимущество скорости + простой домен.',
      },
      {
        timecode: '00:11–00:15',
        layerLabel: 'Комплаенс ст. 24 ФЗ',
        spokenOrFoley: '«Имеются противопоказания. Необходима консультация специалиста. 18 плюс».',
        directorNote: 'Чистая дикция на сухой подложке — мгновенное согласование юристами.',
      },
    ],
    metrics: [
      {
        value: '100%',
        label: 'комплаенс ФЗ-38',
        context: 'Три сезонных флайта подряд без единого возврата с модерации',
      },
      {
        value: '15 сек',
        label: 'компактный формат',
        context: 'Высокая недельная частота контакта при умеренном бюджете',
      },
      {
        value: '−24%',
        label: 'стоимость записи',
        context: 'Снижение цены обращения на комплексный чекап во втором месяце',
      },
    ],
    recommendedStations: ['Relax FM', 'Дорожное Радио', 'Ретро FM'],
  },
  'audioworks-reel': {
    caseId: 'audioworks-reel',
    industrySlug: 'b2b-finance',
    industryLabel: 'Демонстрация режиссуры FMWorks',
    formatLabel: 'Флагманский эфирный шоурил студии (1:19)',
    recommendedOrderTier: 'cinema',
    spotSeconds: 79,
    clientChallenge:
      'За 79 секунд наглядно продемонстрировать маркетологам и собственникам бизнеса пропасть между потоковой дикторской начиткой и режиссёрским аудиопродакшном.',
    dramaticSolution:
      'Ролик начинается с реалистичной имитации серого рекламного шума, резко обрывается полусекундной тишиной и последовательно разворачивает три кинематографичные акустические сцены в голове слушателя.',
    legalAdaptationNote:
      'Вся музыкальная партитура и шумовые фактуры созданы из лицензионно очищенных библиотек с полным правом коммерческой трансляции в эфире и digital.',
    scriptCues: [
      {
        timecode: '00:00–00:07',
        layerLabel: 'Краш-тест шума',
        spokenOrFoley: '[Поток типичных радийных штампов резко обрывается выключателем — 0.5 сек абсолютной тишины]',
        directorNote: 'Приём акустического сброса внимания слушателя в потоке.',
      },
      {
        timecode: '00:07–00:36',
        layerLabel: 'Сцена 1 · Вкус',
        spokenOrFoley: 'Тактильная гастрономическая миниатюра с живым дыханием и близким микрофоном.',
        directorNote: 'Демонстрация работы с FMCG, ритейлом и HoReCa.',
      },
      {
        timecode: '00:36–00:56',
        layerLabel: 'Сцена 2 · Статус',
        spokenOrFoley: 'Переход из городского трафика в тишину приватного архитектурного квартала.',
        directorNote: 'Демонстрация подачи для девелопмента, банков и B2B.',
      },
      {
        timecode: '00:56–01:19',
        layerLabel: 'Финал FMWorks',
        spokenOrFoley: 'Манифест студии: аудиореклама, которая включает кино в воображении и окупает эфир.',
        directorNote: 'Фирменный звуковой автограф студии FMWorks.',
      },
    ],
    metrics: [
      {
        value: 'От 24–48 ч',
        label: 'по готовому тексту',
        context: '3–4 раб. дня под ключ после договора и предоплаты',
      },
      {
        value: '3 сцены',
        label: 'жанровый диапазон',
        context: 'От камерного минимализма до многослойного игрового кино',
      },
      {
        value: 'ЭДО',
        label: 'белый документооборот',
        context: 'Полная передача исключительных прав в день сдачи проекта',
      },
    ],
    recommendedStations: ['Business FM', 'Авторадио', 'Радио Monte Carlo'],
  },
};

export function getCaseDetailedBreakdown(
  caseRecord: Pick<PortfolioCaseRecord, 'id' | 'client' | 'tag' | 'summary' | 'durationSec'>
): CaseDetailedBreakdown {
  const existing = CASE_DETAILED_BREAKDOWNS[caseRecord.id];
  if (existing) return existing;

  return {
    caseId: caseRecord.id,
    industrySlug: 'retail-fmcg',
    industryLabel: caseRecord.tag || 'Коммерческий эфир',
    formatLabel: 'Студийный продакшн под ключ',
    recommendedOrderTier: 'turnkey',
    spotSeconds: caseRecord.durationSec || 20,
    clientChallenge: `Выделить предложение бренда «${caseRecord.client}» в плотном рекламном блоке и обеспечить мгновенное считывание ключевой выгоды с первого прослушивания.`,
    dramaticSolution: caseRecord.summary,
    legalAdaptationNote:
      'Хронометраж выверен до десятой доли секунды, оформлен лицензионный паспорт музыкальной подложки и проверены формулировки по ФЗ «О рекламе».',
    scriptCues: [
      {
        timecode: '00:00–00:03',
        layerLabel: 'Крючок внимания',
        spokenOrFoley: 'Контрастное интонационное вступление без рекламных клише первых секунд.',
        directorNote: 'Захват селективного внимания водителя или офисного слушателя.',
      },
      {
        timecode: '00:03–00:14',
        layerLabel: 'Раскрытие оффера',
        spokenOrFoley: caseRecord.summary,
        directorNote: 'Фокус строго на одной главной выгоде клиента.',
      },
      {
        timecode: `00:14–00:${String(Math.max(15, caseRecord.durationSec)).padStart(2, '0')}`,
        layerLabel: 'Пэкшот и контакт',
        spokenOrFoley: `Чёткая фиксация имени бренда «${caseRecord.client}» и простого целевого действия.`,
        directorNote: 'Юридически чистый финал под требования радиостанций.',
      },
    ],
    metrics: [
      {
        value: `${caseRecord.durationSec} сек`,
        label: 'точный хронометраж',
        context: 'Без переплаты за лишние секунды в эфирной сетке',
      },
      {
        value: '1-й дубль',
        label: 'прохождение юристов',
        context: 'Полный комплект документов и паспорт ролика',
      },
      {
        value: '3–4 дня',
        label: 'продакшн под ключ',
        context: 'Или от 24–48 ч по утверждённому тексту после оплаты',
      },
    ],
    recommendedStations: ['Business FM', 'Авторадио', 'Европа Плюс'],
  };
}

/* ============================================================================
 * 3. ОТРАСЛЕВЫЕ РЕШЕНИЯ (ЖК, МЕДИЦИНА, РИТЕЙЛ, B2B)
 * ============================================================================ */

export interface IndustrySolutionSpec {
  slug: IndustryVerticalSlug;
  shortTitle: string;
  fullTitle: string;
  kicker: string;
  heroSummary: string;
  coverImageUrl: string;
  coverImageAlt: string;
  mediaNiche: MediaClientNiche;
  recommendedTier: OrderFormatId;
  optimalDurationRange: string;
  defaultDurationSec: number;
  listenerContext: string;
  keyMistakeToAvoid: string;
  legalComplianceRules: string[];
  sampleBenchmarkScript: {
    title: string;
    durationSec: number;
    lines: string[];
  };
  recommendedStationSlugs: string[];
  relatedCaseIds: string[];
  kpiBenchmarks: { value: string; label: string }[];
}

export const INDUSTRY_SOLUTIONS: Record<IndustryVerticalSlug, IndustrySolutionSpec> = {
  'real-estate': {
    slug: 'real-estate',
    shortTitle: 'ЖК и девелопмент',
    fullTitle: 'Аудиореклама для жилых комплексов и девелоперов',
    kicker: 'Отраслевой стандарт · Девелопмент и недвижимость',
    heroSummary:
      'Продаём атмосферу жизни и статус архитектуры в утреннем и вечернем деловом прайме — с безупречной упаковкой проектных деклараций и ипотечных условий без потери драматургии.',
    coverImageUrl: LOCAL_EDITORIAL_IMAGES.estateCinema,
    coverImageAlt: 'Современная фасадная архитектура жилого квартала в мягком вечернем свете',
    mediaNiche: 'real_estate',
    recommendedTier: 'cinema',
    optimalDurationRange: '20–25 сек',
    defaultDurationSec: 22,
    listenerContext:
      'Покупатель квартиры бизнес- или комфорт-класса слушает радио за рулём на привычном маршруте «дом — деловой центр». Именно в пробке он острее всего ощущает ценность приватного двора, паркинга и экономии времени в пути.',
    keyMistakeToAvoid:
      'Попытка за 20 секунд перечислить ставку, первый взнос, площадь, адрес, телефон и 8 секунд скороговорки по 214-ФЗ — в итоге проект бизнес-класса начинает звучать как уличная распродажа.',
    legalComplianceRules: [
      'Точное наименование застройщика (ООО «СЗ ...») и отсылка к проектной декларации на портале наш.дом.рф (ч. 7 ст. 28 ФЗ-38).',
      'При упоминании ипотечного платежа или ставки — указание банка, диапазона полной стоимости кредита (ПСК) и базовых параметров расчёта.',
      'Запрет на несогласованные превосходные степени («самый зелёный район», «лучшие видовые характеристики») без документального подтверждения.',
    ],
    sampleBenchmarkScript: {
      title: 'Эталонный 22-секундный спот для старта новой очереди ЖК',
      durationSec: 22,
      lines: [
        '[00–03с] Звук шагов по гравию парковой аллеи и пение птиц после мягкого закрытия двери авто.',
        '[03–12с] Диктор (спокойный баритон): «Возвращаться домой туда, где сосны выше этажей, а до делового центра — пятнадцать минут без светофоров».',
        '[12–18с] «Видовые квартиры новой очереди в квартале Лесной Берег. Найдите в поиске: Лесной Берег».',
        '[18–22с] «Застройщик ООО СЗ Лесной Берег. Проектная декларация на сайте наш.дом.рф».',
      ],
    },
    recommendedStationSlugs: ['business-fm', 'monte-carlo', 'silver-rain', 'kommersant-fm'],
    relatedCaseIds: ['business-estate', 'audioworks-reel'],
    kpiBenchmarks: [
      { value: '20–22 сек', label: 'идеальный хронометраж со сноской 214-ФЗ' },
      { value: '+35–45%', label: 'рост брендового поиска в часы вечернего прайма' },
      { value: '0 правок', label: 'при прохождении юристов деловых радиостанций' },
    ],
  },
  medicine: {
    slug: 'medicine',
    shortTitle: 'Медицина и клиники',
    fullTitle: 'Аудиореклама для клиник, стоматологии и диагностики',
    kicker: 'Отраслевой стандарт · Частная медицина и здоровье',
    heroSummary:
      'Выстраиваем спокойное человеческое доверие к врачам и диагностике без пугающих интонаций и гарантируем 100% соблюдение статьи 24 ФЗ «О рекламе» на всех радиосетях.',
    coverImageUrl: LOCAL_EDITORIAL_IMAGES.medicineClinic,
    coverImageAlt: 'Светлый архитектурный холл современной частной клиники с натуральным деревом и дневным светом',
    mediaNiche: 'medicine',
    recommendedTier: 'turnkey',
    optimalDurationRange: '15–20 сек',
    defaultDurationSec: 17,
    listenerContext:
      'Решение записаться на чекап, МРТ или приём к профильному специалисту часто откладывается из-за внутренней тревоги. Тёплый, уверенный актёрский голос снимает барьер и переводит намерение в онлайн-запись.',
    keyMistakeToAvoid:
      'Тревожная музыка, запугивание осложнениями или обещание «гарантированного излечения» (прямое нарушение ч. 1 ст. 24 ФЗ «О рекламе», ведущее к мгновенному отклонению ролика станцией).',
    legalComplianceRules: [
      'Обязательное предупреждение «Имеются противопоказания, необходима консультация специалиста» (не менее 3 секунд чистого разборчивого звучания в радиоролике).',
      'Исключение любых гарантий положительного эффекта лечения, ссылок на конкретные случаи исцеления пациентов и образов медицинских работников в запрещённых контекстах.',
      'Предварительная сверка формулировок услуг с номенклатурой действующей медицинской лицензии клиники.',
    ],
    sampleBenchmarkScript: {
      title: 'Эталонный 17-секундный ролик комплексной диагностики',
      durationSec: 17,
      lines: [
        '[00–05с] Тёплый женский голос кинодубляжа: «Проверить сердце и сосуды без очередей и больничной суеты — за одно спокойное утро субботы».',
        '[05–13с] «Кардиологический чекап экспертного класса в сети клиник ВераМед. Удобная запись на сайте ВераМед точка ру».',
        '[13–17с] «Имеются противопоказания. Необходима консультация специалиста. 18 плюс».',
      ],
    },
    recommendedStationSlugs: ['relax-fm', 'dorozhnoe-radio', 'retro-fm', 'monte-carlo'],
    relatedCaseIds: ['medical-clinics'],
    kpiBenchmarks: [
      { value: '3,2 сек', label: 'чистый тайминг обязательного предупреждения' },
      { value: '17 сек', label: 'честная посекундная оплата без переплаты за 30с' },
      { value: '24 часа', label: 'быстрый запуск сезонных медицинских программ' },
    ],
  },
  'retail-fmcg': {
    slug: 'retail-fmcg',
    shortTitle: 'Ритейл и FMCG',
    fullTitle: 'Аудиореклама для продуктовых брендов, торговых сетей и HoReCa',
    kicker: 'Отраслевой стандарт · Продукты, ритейл и гастрономия',
    heroSummary:
      'Создаём физическое ощущение вкуса и свежести через тактильный саунд-дизайн и короткие высокочастотные форматы 12–21 сек перед точкой покупки.',
    coverImageUrl: LOCAL_EDITORIAL_IMAGES.retailCoffee,
    coverImageAlt: 'Ремесленная подача утреннего кофе и свежей выпечки в тёплом студийном свете',
    mediaNiche: 'fmcg_retail',
    recommendedTier: 'turnkey',
    optimalDurationRange: '12–21 сек',
    defaultDurationSec: 15,
    listenerContext:
      'Радио — единственный медиаканал, который сопровождает покупателя непосредственно за 15–30 минут до заезда в супермаркет, пекарню или торговый центр вечером в будни и в выходные.',
    keyMistakeToAvoid:
      'Шумный список из пяти товарных позиций со старыми и новыми ценами: слушатель не удерживает в памяти больше одного яркого вкусового образа и одного короткого повода зайти.',
    legalComplianceRules: [
      'При проведении стимулирующих акций и розыгрышей — чёткое указание сроков акции и источника информации об организаторе, правилах, призах и порядке их получения.',
      'Для доставки и интернет-магазинов — корректные юридические реквизиты продавца (ОГРН / наименование и адрес для дистанционной торговли).',
      'Акустический баланс: аппетитные шумовые детали (хруст, шипение, помол зерна) сводятся так, чтобы звучать естественно на любой автомобильной акустике.',
    ],
    sampleBenchmarkScript: {
      title: 'Эталонный 15-секундный гастрономический спот для утреннего трафика',
      durationSec: 15,
      lines: [
        '[00–02с] Пауза 0.4с + живой звук свежего помола зерна и пара кофемашины.',
        '[02–10с] «Семь утра звучат иначе, когда в руке горячий фильтр из зёрен свежей обжарки и тёплый миндальный круассан».',
        '[10–15с] «Кофейни Зерно и Свет — по пути на вашу работу. Заезжайте сегодня утром».',
      ],
    },
    recommendedStationSlugs: ['avtoradio', 'europa-plus', 'novoe-radio', 'dorozhnoe-radio'],
    relatedCaseIds: ['dmitrogorsky'],
    kpiBenchmarks: [
      { value: '12–15 сек', label: 'максимальная частота выходов на рубль бюджета' },
      { value: 'Чт–Вс', label: 'пиковые дни конверсии в заезд в торговую сеть' },
      { value: '2,2×', label: 'выше запоминаемость ролика с живым саунд-дизайном' },
    ],
  },
  'b2b-finance': {
    slug: 'b2b-finance',
    shortTitle: 'B2B и финансы',
    fullTitle: 'Аудиореклама для банков, лизинга, логистики и B2B-сервисов',
    kicker: 'Отраслевой стандарт · B2B, финтех и корпоративный сектор',
    heroSummary:
      'Выходим напрямую на директоров, главных бухгалтеров и собственников компаний в деловом радиоэфире — языком твёрдых цифр, выгоды и уважения ко времени ЛПР.',
    coverImageUrl: LOCAL_EDITORIAL_IMAGES.b2bExecutive,
    coverImageAlt: 'Руководитель бизнеса в салоне автомобиля во время утренней деловой поездки',
    mediaNiche: 'b2b_finance',
    recommendedTier: 'voice_style',
    optimalDurationRange: '15–25 сек',
    defaultDurationSec: 20,
    listenerContext:
      'Собственники бизнеса и финансовые директора перегружены холодными звонками и баннерами, но ежедневно включают деловые новости за рулём с 08:00 до 10:00 и с 18:00 до 20:00.',
    keyMistakeToAvoid:
      'Абстрактные корпоративные штампы («индивидуальный подход», «комплексные решения нового поколения», «динамично развивающийся партнёр») — мозг управленца отфильтровывает их мгновенно.',
    legalComplianceRules: [
      'Статья 28 ФЗ «О рекламе»: полное наименование финансовой организации (АО / ООО) и номер генеральной лицензии Банка России при рекламе банковских и страховых продуктов.',
      'Запрет на умолчание существенных условий, влияющих на итоговую доходность вклада или стоимость финансирования/лизинга.',
      'Точная сверка терминологии для B2B-продуктов (расчётно-кассовое обслуживание, факторинг, коммерческий лизинг только для юридических лиц и ИП).',
    ],
    sampleBenchmarkScript: {
      title: 'Эталонный 20-секундный B2B-спот для деловой радиостанции',
      durationSec: 20,
      lines: [
        '[00–04с] Уверенный деловой тембр: «Обновить коммерческий автопарк компании до конца квартала — без заморозки оборотных средств».',
        '[04–13с] «Лизинг грузового и легкового транспорта для бизнеса с одобрением по двум документам за один рабочий день».',
        '[13–17с] «Рассчитайте график платежей сегодня: Вектор Лизинг точка ру».',
        '[17–20с] «ООО Вектор Лизинг. Услуги предоставляются юридическим лицам и ИП».',
      ],
    },
    recommendedStationSlugs: ['business-fm', 'kommersant-fm', 'comedy-radio', 'radio-jazz'],
    relatedCaseIds: ['audioworks-reel', 'business-estate'],
    kpiBenchmarks: [
      { value: '70%+', label: 'доля прослушивания ЛПР в утреннем и вечернем авто' },
      { value: '1 цифра', label: 'фокус на одном измеримом бизнес-результате' },
      { value: 'ЭДО', label: 'закрывающие документы и права для бухгалтерии' },
    ],
  },
};

/* ============================================================================
 * 4. ЭТАПЫ ПРОДАКШНА (24–48Ч), ЮРИДИЧЕСКАЯ ОЧИСТКА ПРАВ И МОДЕРАЦИЯ
 * ============================================================================ */

export interface ProductionStageItem {
  stepNumber: string;
  timeWindow: string;
  title: string;
  description: string;
  clientAction: string;
  deliverable: string;
}

export const PRODUCTION_STAGES_24_48H: readonly ProductionStageItem[] = [
  {
    stepNumber: '01',
    timeWindow: 'Заявка → Договор',
    title: 'Проверка реквизитов, рамочный договор и 100% предоплата',
    description:
      'Вы передаёте задачу голосом или текстом и вводите ИНН компании (либо выбираете оплату картой / СБП физлица по 54-ФЗ). Продюсер проверяет контрагента и подтверждает старт, после чего вы сразу скачиваете готовый рамочный договор-оферту и счёт для ЭДО. Без договора и предоплаты сценарии не разрабатываются.',
    clientAction: 'Отправить бриф с реквизитами, скачать договор-счёт и провести предоплату',
    deliverable: 'Одобренная заявка, рамочный договор-оферта и счёт ЭДО / ссылка ЮKassa',
  },
  {
    stepNumber: '02',
    timeWindow: 'Старт после оплаты · 2–8 ч',
    title: 'Три концепции сценария и кастинг дикторов после предоплаты',
    description:
      'Сразу после поступления предоплаты копирайтер готовит три разноплановых сценария с выверкой по реальному темпу речи и обязательным дисклеймерам ФЗ-38, а продюсер собирает 3–5 свежих проб голосов кино и дубляжа.',
    clientAction: 'Выбрать лучший из 3 сценариев и голос актёра озвучивания',
    deliverable: '3 сценария с посекундным таймингом + кастинг-пробы дикторов',
  },
  {
    stepNumber: '03',
    timeWindow: 'Запись',
    title: 'Режиссёрская запись характерных голосов кино и дубляжа',
    description:
      'Записываем выбранного актёра с участием режиссёра: добиваемся естественной человеческой интонации без фальшивого «радийного пафоса», делаем несколько актёрских дублей с разной подачей ключевой фразы и пэкшота.',
    clientAction: 'Никакого участия не требуется — студия полностью ведёт сессию',
    deliverable: 'Чистые студийные дубли актёрской начитки в эталонном качестве',
  },
  {
    stepNumber: '04',
    timeWindow: 'От 24–48 ч по тексту · 3–4 дня под ключ',
    title: 'Саунд-дизайн, паспорт прав РАО/ВОИС и закрытие в ЭДО',
    description:
      'Собираем звуковую сцену, подбираем лицензионно чистую музыку, выравниваем громкость под радиоэфир и автомобильную акустику, передаём мастер-файлы и закрываем отчуждение исключительных прав актом в ЭДО.',
    clientAction: 'Прослушать готовый мастер-ролик и подписать акт в ЭДО',
    deliverable: 'Вещательный WAV/MP3 мастер-файл + Паспорт ролика + передача прав',
  },
] as const;

export interface LegalDeliverableCard {
  indexLabel: string;
  title: string;
  summary: string;
  includedItems: string[];
}

export const LEGAL_RIGHTS_DELIVERABLES: readonly LegalDeliverableCard[] = [
  {
    indexLabel: 'Документ 01',
    title: 'Паспорт рекламного аудиоролика для всех радиохолдингов',
    summary:
      'Ни одна радиостанция не поставит ролик в эфир без официальной справки об авторах текста, исполнителях и музыкальных произведениях. Мы готовим её автоматически к каждому проекту.',
    includedItems: [
      'Точные сведения об авторе сценария, дикторе и изготовителе фонограммы',
      'Каталожные номера, авторы и правообладатели музыкальной подложки для отчётности РАО и ВОИС',
      'Точный паспортный хронометраж ролика до секунды под эфирный лист станции',
    ],
  },
  {
    indexLabel: 'Документ 02',
    title: 'Отчуждение прав и чистые лицензии без скрытых роялти',
    summary:
      'Все имущественные права на созданный сценарий и финальную фонограмму переходят вашей компании по договору с момента оплаты — без ограничений по числу радиостанций и срокам ротации.',
    includedItems: [
      'Очищенная коммерческая лицензия на музыку и звуковые фактуры (Broadcast & Digital)',
      'Письменное согласие и передача смежных прав от актёров озвучивания',
      'Свободное использование ролика на радио, в торговых залах и легальных стримингах',
    ],
  },
  {
    indexLabel: 'Документ 03',
    title: 'Предварительный пре-чек по ФЗ-38 «О рекламе» до записи',
    summary:
      'Проверяем сценарий глазами эфирного юриста ещё на этапе текста, чтобы вам никогда не пришлось экстренно переписывать ролик за ночь до старта рекламной кампании.',
    includedItems: [
      'Проверка обязательных дисклеймеров для недвижимости (214-ФЗ), медицины (ст. 24) и финансов (ст. 28)',
      'Устранение неподтверждённых сравнений («лучший», «первый», «самый выгодный»)',
      'Корректные возрастные отметки, сведения об организаторах акций и дистанционной торговле',
    ],
  },
] as const;

export interface ModerationRuleRow {
  sector: string;
  mandatoryRequirement: string;
  howFmworksSolves: string;
}

export const MODERATION_COMPLIANCE_RULES: readonly ModerationRuleRow[] = [
  {
    sector: 'Жилые комплексы и апартаменты',
    mandatoryRequirement: 'Наименование застройщика + ссылка на проектную декларацию на наш.дом.рф; при упоминании ипотеки — банк и условия ПСК.',
    howFmworksSolves: 'Закладываем 3,8–4,5 сек на разборчивый юридический финал и убираем лишние финансовые триггеры, если цель ролика — имидж и поиск бренда.',
  },
  {
    sector: 'Медицинские центры и стоматология',
    mandatoryRequirement: 'Чёткое предупреждение о противопоказаниях и необходимости консультации специалиста; отсутствие гарантий излечения.',
    howFmworksSolves: 'Записываем предупреждение на чистом фоне без звуковых эффектов длительностью от 3,2 сек, сверяя термины с лицензией клиники.',
  },
  {
    sector: 'Банки, инвестиции и B2B-лизинг',
    mandatoryRequirement: 'Организационно-правовая форма, номер лицензии ЦБ РФ (для банков) и указание всех условий, влияющих на стоимость продукта.',
    howFmworksSolves: 'Фокусируем сценарий на сервисной скорости и выгоде для юрлиц, чтобы не перегружать 20-секундный спот десятисекундной тарифной сноской.',
  },
  {
    sector: 'Ритейл, доставка и акции с подарками',
    mandatoryRequirement: 'Сроки проведения акции, сайт или источник подробных правил, а при доставке — ОГРН и наименование юридического лица.',
    howFmworksSolves: 'Интегрируем короткую ритмичную сноску в финальные 3 секунды без разрушения аппетитной игровой части ролика.',
  },
] as const;

/* ============================================================================
 * 5. ЭКСПЕРТНЫЙ РАЗДЕЛ: РАЗБОРЫ ОШИБОК В РАДИОРЕКЛАМЕ
 * ============================================================================ */

export interface RadioMistakeArticle {
  slug: string;
  indexLabel: string;
  readingTime: string;
  categoryKicker: string;
  title: string;
  subtitle: string;
  impactStatValue: string;
  impactStatLabel: string;
  summary: string;
  problemDiagnosis: string[];
  badScriptExample: {
    label: string;
    chronometry: string;
    text: string;
    flawNote: string;
  };
  goodScriptExample: {
    label: string;
    chronometry: string;
    text: string;
    winNote: string;
  };
  neuroExplanation: string;
  producerChecklist: string[];
}

export const RADIO_MISTAKE_ARTICLES: readonly RadioMistakeArticle[] = [
  {
    slug: 'phonebook-syndrome',
    indexLabel: 'Разбор 01',
    readingTime: '4 мин чтения',
    categoryKicker: 'Когнитивная нагрузка · Конверсия контакта',
    title: 'Синдром телефонного справочника: почему два контакта в ролике обнуляют звонки',
    subtitle: 'Как попытка одновременно продиктовать телефон, адрес, сайт и соцсети лишает водителя возможности запомнить хотя бы название вашего бренда.',
    impactStatValue: '−64%',
    impactStatLabel: 'падение запоминаемости бренда при 3+ контактах в финале',
    summary:
      'В 85% случаев радио слушают за рулём или на ходу, когда руки заняты и записать семизначный номер физически невозможно. Как только диктор начинает скороговоркой зачитывать адрес и два канала связи, рабочая память человека сбрасывает весь ролик целиком.',
    problemDiagnosis: [
      'Слуховая кратковременная память удерживает не более одной простой связки «бренд — действие» в условиях дорожного движения.',
      'Сложные домены с дефисами и латинскими буквами на слух воспринимаются с ошибками, а телефонные номера без уникальной рифмы забываются через 6 секунд.',
      'Каждая секунда, потраченная на диктовку улицы, корпуса и телефона, отнимает время у эмоционального крючка и сути вашего предложения.',
    ],
    badScriptExample: {
      label: 'Типичный шаблон (слив эфирного бюджета)',
      chronometry: '20 сек · 46 слов',
      text: '«Стоматология Дента-Люкс-Плюс! Профессиональная гигиена и имплантация со скидкой 15%! Ждём вас на улице Строителей, дом 14, корпус 2, звоните 295-48-17, заходите на сайт denta-defis-lux24 точка ру!»',
      flawNote: 'Четыре конкурирующих ориентира за 6 секунд: водитель не запомнил ни название, ни адрес, ни сложный сайт.',
    },
    goodScriptExample: {
      label: 'Режиссура FMWorks (один звуковой якорь)',
      chronometry: '17 сек · 28 слов',
      text: '«Улыбаться на фотографиях открыто — без долгого ожидания и боли. Бережная имплантация во сне в клинике Дента Люкс. Просто наберите в поиске два слова: Дента Люкс. Имеются противопоказания, проконсультируйтесь со специалистом».',
      winNote: 'Один чёткий двухсловный поисковый якорь «Дента Люкс» даёт кратный рост переходов со смартфона на первой же остановке.',
    },
    neuroExplanation:
      'По данным исследований слухового внимания System1 и Radiocentre, ролики с единственным вербальным ориентиром формируют в 2,1 раза более прочный след в долговременной памяти, чем объявления со списком реквизитов связи.',
    producerChecklist: [
      'Оставьте в сценарии ровно один способ найти вас (лучше всего — уникальное двухсловное имя в поиске или короткий кириллический ориентир).',
      'Произнесите название бренда минимум дважды: в смысловой связке с выгодой и в финальном пэкшоте.',
      'Проверьте название на слух: если слово можно написать тремя разными способами — добавьте короткую образную ассоциацию.',
    ],
  },
  {
    slug: 'fake-radio-euphoria',
    indexLabel: 'Разбор 02',
    readingTime: '5 мин чтения',
    categoryKicker: 'Актёрская подача · Доверие к бренду',
    title: 'Фальшивый радио-восторг: как дежурная дикторская подача включает рекламную глухоту',
    subtitle: 'Почему искусственно бодрый голос «продавца с ярмарки» заставляет мозг отключить внимание за первые полторы секунды.',
    impactStatValue: '1,6 сек',
    impactStatLabel: 'нужно мозгу, чтобы распознать рекламный штамп и отключить фокус',
    summary:
      'За двадцать лет слушатели выработали мгновенный защитный рефлекс на специфическую «рекламную интонацию» — неестественно завышенный тон, форсированную улыбку и восклицательный знак после каждого слова.',
    problemDiagnosis: [
      'Когда голос звучит так, как живые люди никогда не разговаривают в реальной жизни, нервная система автоматически маркирует сигнал как неважный фоновый шум.',
      'Для дорогих продуктов (недвижимость, медицина, финансы, автомобили) суетливый восторг диктора напрямую разрушает ощущение надёжности и статуса компании.',
      'Громкость и напор не равны заметности: когда в блоке кричат пять роликов подряд, выигрывает тот, кто неожиданно переходит на спокойный, уверенный полутон.',
    ],
    badScriptExample: {
      label: 'Наигранная подача из нулевых',
      chronometry: '15 сек · форсированный крик',
      text: '«Внимание-внимание! Грандиозное событие этой осени! Только три дня невероятные условия на квартиры мечты! Спешите, количество ограничено!»',
      flawNote: 'Ноль конкретики, стопроцентный штамп: слушатель мысленно «выключает звук» уже на слове «грандиозное».',
    },
    goodScriptExample: {
      label: 'Живое актёрское дыхание FMWorks',
      chronometry: '15 сек · камерный план',
      text: '[Пауза 0.4с] «Тихий утренний кофе на собственной террасе с видом на воду… звучит убедительнее любых громких обещаний. Ключи этой осенью в квартале Речной Свет».',
      winNote: 'Естественная пауза дыхания и голос актёра дубляжа создают доверие равного собеседника.',
    },
    neuroExplanation:
      'Нейрофизиологический эффект коктейльной вечеринки доказывает: слуховая кора выделяет из шума естественную человеческую речь с микропаузами дыхания и подавляет механически равномерную скороговорку.',
    producerChecklist: [
      'Записывайте актёров кино и дубляжа вместо потоковых дикторов рекламных объявлений.',
      'Прочитайте текст вслух спокойным разговорным голосом: если фраза звучит неестественно за ужином с другом — перепишите её.',
      'Используйте акустическую паузу 0,3–0,5 секунды перед главным смысловым акцентом.',
    ],
  },
  {
    slug: 'lost-first-three-seconds',
    indexLabel: 'Разбор 03',
    readingTime: '4 мин чтения',
    categoryKicker: 'Драматургия старта · Селективное внимание',
    title: 'Потерянные первые 3 секунды: почему нельзя начинать ролик с названия компании',
    subtitle: 'Главная ошибка заказчиков, которые просят поставить имя своего бренда первым словом радиоролика.',
    impactStatValue: '72%',
    impactStatLabel: 'слушателей пропускают первые 2,5 секунды ролика мимо сознания',
    summary:
      'В момент старта вашего ролика слушатель ещё думает о дороге, рабочем письме или предыдущей песне. Если вы открываете спот незнакомым названием ООО или общим приветствием, к третьей секунде человек уже не знает, о ком шла речь.',
    problemDiagnosis: [
      'Внимание слушателя сначала нужно «разбудить» узнаваемой жизненной ситуацией или характерным звуком, и только после включения фокуса называть бренд.',
      'Абстрактные вступления («Вы давно искали надёжного партнёра?», «Компания Альфа представляет…») тратят самые дорогие секунды эфира впустую.',
      'Первая секунда обязана отвечать на немой вопрос человека: «Почему это касается лично меня прямо сейчас?».',
    ],
    badScriptExample: {
      label: 'Старт с неизвестного имени и штампа',
      chronometry: '00:00–00:05',
      text: '«Группа компаний СтройИнвестТехнолоджи уже пятнадцать лет успешно работает на рынке и рада предложить…»',
      flawNote: 'Пять секунд оплаченного прайма ушли на самопрезентацию, которая не решает ни одной задачи слушателя.',
    },
    goodScriptExample: {
      label: 'Старт с точного контекста клиента',
      chronometry: '00:00–00:05',
      text: '«Склад переполнен перед сезоном, а отгружать товар сетям нужно уже в понедельник? Запустите дополнительную линию хранения за 48 часов с…»',
      winNote: 'Директор по логистике за рулём мгновенно узнаёт свою боль и дослушивает название бренда в финале.',
    },
    neuroExplanation:
      'Исследование Hear and Now (Neuro-Insight) фиксирует скачок вовлечённости мозга на +23%, когда ролик в первые 3 секунды синхронизируется с текущим бытовым или деловым контекстом человека.',
    producerChecklist: [
      'Никогда не начинайте ролик с названия компании (исключение — федеральные бренды со знанием марки выше 80%).',
      'Открывайте сценарий конкретной ситуацией, тактильным звуком или неожиданным фактом.',
      'Переносите имя бренда в середину и финал ролика, когда внимание слушателя уже полностью захвачено.',
    ],
  },
  {
    slug: 'disclaimer-ate-the-offer',
    indexLabel: 'Разбор 04',
    readingTime: '5 мин чтения',
    categoryKicker: 'Юридический тайминг · Посекундная экономика',
    title: 'Юридический хвост, съевший оффер: ошибки расчёта хронометража в ЖК и медицине',
    subtitle: 'Как длинная обязательная сноска превращает 15-секундный ролик в неразборчивую кашу — и как честный хронометраж 17–22 сек спасает кампанию.',
    impactStatValue: '30–45%',
    impactStatLabel: 'времени короткого ролика может занять непродуманный дисклеймер',
    summary:
      'В недвижимости, медицине и финансах закон требует обязательных предупреждений и реквизитов. Когда сценарист пишет текст «на глаз» под стандартные 15 секунд, а в конце добавляет юридический абзац, на сам продукт остаётся всего 8 секунд скороговорки.',
    problemDiagnosis: [
      'Искусственное программное ускорение голоса делает ролик комичным и часто приводит к отказу эфирных юристов из-за неразборчивости обязательной информации.',
      'Покупка полного 30-секундного слота ради двух лишних фраз приводит к переплате до 40% эфирного бюджета.',
      'Лишние триггерные слова в тексте (например, случайное упоминание слова «рассрочка» или «кредит» без цифр) автоматически обязывают добавлять огромный банковский дисклеймер.',
    ],
    badScriptExample: {
      label: 'Перегруженный 15-секундный слот',
      chronometry: '15 сек · 7 сек ушло на сноску',
      text: '8 секунд скомканного рассказа про ЖК + 7 секунд пулемётной скороговорки про банк, ставку, ПСК, первый взнос, застройщика и проектную декларацию.',
      flawNote: 'Имидж проекта разрушен суетой, а суть предложения потонула в юридических терминах.',
    },
    goodScriptExample: {
      label: 'Чистая архитектура хронометража 21 сек',
      chronometry: '21 сек · посекундный тариф',
      text: 'Убираем слово «ипотека» из имиджевого спота (оставляя только застройщика и наш.дом.рф на 3,8 сек) и выкупаем честный слот 21 сек вместо переплаты за 30 сек.',
      winNote: '17 секунд чистой атмосферной сцены + спокойный юридический финал + экономия бюджета на каждом выходе.',
    },
    neuroExplanation:
      'Умеренный темп речи (2,0–2,3 слова в секунду) сохраняет авторитетность голоса и позволяет слушателю без усилия считать смысл как основного сообщения, так и финального бренда.',
    producerChecklist: [
      'Проверяйте сценарий на юридические слова-триггеры до утверждения хронометража.',
      'Используйте честный посекундный расчёт эфира (17с, 21с, 22с) на линейных слотах вместо зажатия в 15с или переплаты за 30с.',
      'Записывайте обязательный дисклеймер разборчиво и достойно — это часть репутации вашего бренда.',
    ],
  },
  {
    slug: 'wrong-daypart-trap',
    indexLabel: 'Разбор 05',
    readingTime: '4 мин чтения',
    categoryKicker: 'Медиапланирование · Окупаемость слотов',
    title: 'Ловушка утреннего прайма: когда дневные и вечерние слоты дают в 1,8 раза больше заявок',
    subtitle: 'Почему не стоит слепо выкупать только утреннее время на одной радиостанции и как гибко собирать сетку по тайм-слотам.',
    impactStatValue: '1,8×',
    impactStatLabel: 'выигрыш по стоимости целевого контакта при гибкой сборке слотов',
    summary:
      'Многие рекламодатели по инерции требуют «только утренний прайм с 8 до 10», переплачивая за максимальный аукционный спрос даже там, где их клиент принимает решение вечером по пути домой или в пятницу днём.',
    problemDiagnosis: [
      'Утром человек спешит на планерку или везёт детей в школу — он отлично фиксирует быстрые продукты и B2B-задачи, но редко готов тут же звонить в отдел продаж загородного посёлка.',
      'Покупка сплошного пакетного размещения «на весь день» на одной радиостанции размывает бюджет на нецелевые часы.',
      'Отсутствие достаточной частоты (менее 10–12 выходов во флайте) приводит к тому, что слушатель пересекается с роликом всего один раз и не переходит порог запоминания.',
    ],
    badScriptExample: {
      label: 'Слепая пакетная закупка',
      chronometry: 'Весь бюджет в 1 утренний блок',
      text: 'Выкуп 6 дорогих утренних выходов для семейной клиники или вечернего ресторана без присутствия в четверг–воскресенье.',
      flawNote: 'Низкая частота контакта и попадание в момент, когда аудитория не готова к записи или визиту.',
    },
    goodScriptExample: {
      label: 'Точечная сборка вариаций в FMWorks',
      chronometry: 'Вечерний драйв + Дневной блок Ср–Вс',
      text: 'Отключаем лишний утренний прайм и комбинируем вечерний поток возвращения домой на деловой волне с дневным блоком четверга–субботы на семейной станции.',
      winNote: 'В 1,8 раза больше выходов за тот же бюджет и точное попадание в окно принятия решения о покупке.',
    },
    neuroExplanation:
      'Эффективная частота радиокампании начинается от 3+ реальных контактов одного слушателя с роликом за неделю — именно поэтому 16 выходов в точном тайм-слоте всегда обыгрывают 5 разрозненных выходов по всей сетке.',
    producerChecklist: [
      'Выбирайте на радиостанции только те тайм-слоты (утро, день, вечер, выходные), которые совпадают со сценарием покупки вашего продукта.',
      'Держите плотность не ниже 12–16 выходов на выбранной волне, прежде чем добавлять третью или четвёртую радиостанцию.',
      'Используйте горящие эфирные квоты с дисконтом до 45%, чтобы кратно увеличить частоту контактов в рамках тестового бюджета.',
    ],
  },
] as const;
