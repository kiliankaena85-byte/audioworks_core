import {
  CUSTOM_CONSULT_PRICING_ROW,
  EDITORIAL_PRICING_ROWS,
  type OrderFormatId,
} from './pricingData';

export type VisualPackageId =
  | 'voice_style'
  | 'turnkey'
  | 'cinema'
  | 'custom_consult';

export type PricingChartDimension =
  | 'overview'
  | 'chronometry'
  | 'complexity'
  | 'timeline';

export interface PackageComplexityAxis {
  id: 'script_depth' | 'voice_acting' | 'sound_design' | 'legal_resizes';
  label: string;
  shortLabel: string;
  score: number; // 0..100
  deliverableSummary: string;
}

export interface PackageTimelinePhase {
  id: 'script' | 'recording' | 'mixing' | 'clearance';
  label: string;
  hoursMin: number;
  hoursMax: number;
  sharePercent: number;
  note: string;
}

export interface PricingPackageVisualSpec {
  id: VisualPackageId;
  title: string;
  shortTitle: string;
  subtitle: string;
  priceRub: number;
  priceFormatted: string;
  isNegotiable: boolean;
  turnaroundLabel: string;
  turnaroundHoursMin: number;
  turnaroundHoursMax: number;
  supportsUrgent1Hour: boolean;
  urgentNote: string;
  chronometry: {
    minSec: number;
    maxSec: number;
    optimalSec: number;
    rangeLabel: string;
    includedVersionsCount: number;
    includes15sResize: boolean;
    chronometryScore: number; // 0..100
    summary: string;
  };
  complexity: {
    overallScore: number; // 0..100
    levelLabel: string;
    voicesCountLabel: string;
    scriptConceptsCount: number;
    includedServiceRevisions: number;
    axes: readonly PackageComplexityAxis[];
  };
  timeline: {
    speedScore: number; // 0..100 (higher = faster turnaround)
    totalHoursTypical: number;
    phases: readonly PackageTimelinePhase[];
  };
}

export interface ChronometrySegmentBreakdown {
  id: 'hook' | 'offer' | 'cta' | 'disclaimer';
  label: string;
  seconds: number;
  sharePercent: number;
  description: string;
}

export interface PackageChronometrySimulation {
  packageId: VisualPackageId;
  targetDurationSec: number;
  hasMandatoryDisclaimer: boolean;
  isWithinRecommendedRange: boolean;
  recommendedAdjustmentNote: string;
  pricePerSecondRub: number | null;
  wordsCapacityApprox: number;
  segments: readonly ChronometrySegmentBreakdown[];
}

export const SUPPORTED_SPOT_DURATIONS_SEC = [15, 20, 25, 30] as const;
export type SupportedSpotDurationSec =
  (typeof SUPPORTED_SPOT_DURATIONS_SEC)[number];

const voiceRow = EDITORIAL_PRICING_ROWS.find((r) => r.id === 'voice_style')!;
const turnkeyRow = EDITORIAL_PRICING_ROWS.find((r) => r.id === 'turnkey')!;
const cinemaRow = EDITORIAL_PRICING_ROWS.find((r) => r.id === 'cinema')!;

export const PRICING_PACKAGE_VISUAL_SPECS: readonly PricingPackageVisualSpec[] = [
  {
    id: 'voice_style',
    title: voiceRow.title,
    shortTitle: 'Голос и стиль',
    subtitle: 'По готовому тексту заказчика',
    priceRub: voiceRow.priceRub,
    priceFormatted: voiceRow.priceFormatted,
    isNegotiable: false,
    turnaroundLabel: voiceRow.turnaround,
    turnaroundHoursMin: 24,
    turnaroundHoursMax: 48,
    supportsUrgent1Hour: true,
    urgentNote:
      'Доступен срочный выпуск от 1 часа (запись голоса и сведение без разработки сценария — по договорной цене)',
    chronometry: {
      minSec: 10,
      maxSec: 30,
      optimalSec: 15,
      rangeLabel: '10–30 сек (оптимум 15–20 сек)',
      includedVersionsCount: 1,
      includes15sResize: false,
      chronometryScore: 62,
      summary:
        'Один основной хронометраж до 30 секунд с выверкой темпа диктора под эфирный слот радиостанции.',
    },
    complexity: {
      overallScore: 54,
      levelLabel: 'Базовая студийная сборка',
      voicesCountLabel: '1 актёрский голос',
      scriptConceptsCount: 0,
      includedServiceRevisions: 1,
      axes: [
        {
          id: 'script_depth',
          label: 'Сценарий и редактура текста',
          shortLabel: 'Сценарий',
          score: 38,
          deliverableSummary:
            'Адаптация готового текста клиента под устную речь и ударения (без написания концепций с нуля)',
        },
        {
          id: 'voice_acting',
          label: 'Актёрская запись и подача',
          shortLabel: 'Голоса',
          score: 64,
          deliverableSummary:
            '1 характерный диктор или актёр дубляжа с чистой дикцией под целевую аудиторию',
        },
        {
          id: 'sound_design',
          label: 'Музыка и звуковое оформление',
          shortLabel: 'Саунд-дизайн',
          score: 56,
          deliverableSummary:
            'Лицензионная музыкальная подложка, баланс голоса и мастеринг −14 LUFS',
        },
        {
          id: 'legal_resizes',
          label: 'Паспорт прав и пакет версий',
          shortLabel: 'Права и версии',
          score: 60,
          deliverableSummary:
            'Паспорт прав РАО / ВОИС, 1 основной эфирный мастер WAV 48 кГц / 24 бит и 1 сервисный раунд доводки',
        },
      ],
    },
    timeline: {
      speedScore: 92,
      totalHoursTypical: 36,
      phases: [
        {
          id: 'script',
          label: 'Выверка готового текста и хронометража',
          hoursMin: 2,
          hoursMax: 4,
          sharePercent: 12,
          note: 'Проверка читаемости по секундомеру и разметка ударений',
        },
        {
          id: 'recording',
          label: 'Запись диктора в студии',
          hoursMin: 6,
          hoursMax: 16,
          sharePercent: 36,
          note: 'Запись нескольких дублей с разной динамикой подачи',
        },
        {
          id: 'mixing',
          label: 'Сведение с музыкой и мастеринг −14 LUFS',
          hoursMin: 8,
          hoursMax: 16,
          sharePercent: 34,
          note: 'Чистка дыхания, музыкальный баланс и соответствие РД 06.02',
        },
        {
          id: 'clearance',
          label: 'Приёмка и паспорт прав РАО / ВОИС',
          hoursMin: 4,
          hoursMax: 12,
          sharePercent: 18,
          note: 'Выдача WAV-мастера, паспорта прав и закрывающих документов в ЭДО',
        },
      ],
    },
  },
  {
    id: 'turnkey',
    title: turnkeyRow.title,
    shortTitle: 'Под ключ',
    subtitle: 'Основной формат полного цикла',
    priceRub: turnkeyRow.priceRub,
    priceFormatted: turnkeyRow.priceFormatted,
    isNegotiable: false,
    turnaroundLabel: turnkeyRow.turnaround,
    turnaroundHoursMin: 72,
    turnaroundHoursMax: 96,
    supportsUrgent1Hour: false,
    urgentNote:
      'Включает разработку 3 концепций сценария с нуля (при наличии готового текста возможен быстрый старт за 24–48 ч)',
    chronometry: {
      minSec: 10,
      maxSec: 35,
      optimalSec: 20,
      rangeLabel: '10–35 сек (оптимум 15–25 сек)',
      includedVersionsCount: 2,
      includes15sResize: false,
      chronometryScore: 82,
      summary:
        'Точный расчёт текста до доли секунды + закладка хронометража под обязательные сноски ФЗ-38 до записи диктора.',
    },
    complexity: {
      overallScore: 84,
      levelLabel: 'Полный продюсерский цикл',
      voicesCountLabel: '1–2 характерных голоса',
      scriptConceptsCount: 3,
      includedServiceRevisions: 1,
      axes: [
        {
          id: 'script_depth',
          label: 'Сценарий и редактура текста',
          shortLabel: 'Сценарий',
          score: 88,
          deliverableSummary:
            'Разработка 3 концепций сценария с нуля с разными заходами (рациональный, образный, динамичный)',
        },
        {
          id: 'voice_acting',
          label: 'Актёрская запись и подача',
          shortLabel: 'Голоса',
          score: 82,
          deliverableSummary:
            'Режиссёрская запись федерального актёра дубляжа с точной интонационной расстановкой акцентов',
        },
        {
          id: 'sound_design',
          label: 'Музыка и звуковое оформление',
          shortLabel: 'Саунд-дизайн',
          score: 84,
          deliverableSummary:
            'Фирменное звуковое оформление, звуковые акценты, лицензионная музыка и до 1 замены трека в сервисном раунде',
        },
        {
          id: 'legal_resizes',
          label: 'Паспорт прав и пакет версий',
          shortLabel: 'Права и версии',
          score: 82,
          deliverableSummary:
            'Предварительная проверка сносок ФЗ-38, паспорт РАО / ВОИС и архив всех итераций (v1, v2, master WAV)',
        },
      ],
    },
    timeline: {
      speedScore: 68,
      totalHoursTypical: 84,
      phases: [
        {
          id: 'script',
          label: 'Разработка 3 концепций сценария и ФЗ-38',
          hoursMin: 16,
          hoursMax: 24,
          sharePercent: 28,
          note: 'Подготовка 3 вариантов текста с точным хронометражем и согласование с клиентом',
        },
        {
          id: 'recording',
          label: 'Режиссёрская запись актёра дубляжа',
          hoursMin: 16,
          hoursMax: 24,
          sharePercent: 26,
          note: 'Запись утверждённой концепции под контролем звукового продюсера',
        },
        {
          id: 'mixing',
          label: 'Саунд-дизайн, сведение и мастеринг −14 LUFS',
          hoursMin: 20,
          hoursMax: 28,
          sharePercent: 28,
          note: 'Сборка фактуры, звуковых акцентов и эталонной громкости эфира',
        },
        {
          id: 'clearance',
          label: 'Сервисная доводка и паспорт прав РАО / ВОИС',
          hoursMin: 12,
          hoursMax: 20,
          sharePercent: 18,
          note: 'Финальная проверка, 1 сервисный раунд правок и выгрузка полного пакета документов',
        },
      ],
    },
  },
  {
    id: 'cinema',
    title: cinemaRow.title,
    shortTitle: 'Игровой / Мини-кино',
    subtitle: 'Многоголосая постановка + ресайз 15 сек',
    priceRub: cinemaRow.priceRub,
    priceFormatted: cinemaRow.priceFormatted,
    isNegotiable: false,
    turnaroundLabel: cinemaRow.turnaround,
    turnaroundHoursMin: 96,
    turnaroundHoursMax: 120,
    supportsUrgent1Hour: false,
    urgentNote:
      'Постановочная запись 2–3 актёров и создание короткой 15-секундной эфирной версии в комплекте',
    chronometry: {
      minSec: 15,
      maxSec: 45,
      optimalSec: 30,
      rangeLabel: '20–45 сек + эфирный ресайз 15 сек',
      includedVersionsCount: 3,
      includes15sResize: true,
      chronometryScore: 100,
      summary:
        'Полноформатный игровой ролик (25–45 сек) + короткий эфирный ресайз 15 сек для уплотнения частоты в прайм-тайм.',
    },
    complexity: {
      overallScore: 98,
      levelLabel: 'Постановочный радиоспектакль',
      voicesCountLabel: '2–3 актёра дубляжа',
      scriptConceptsCount: 3,
      includedServiceRevisions: 1,
      axes: [
        {
          id: 'script_depth',
          label: 'Сценарий и редактура текста',
          shortLabel: 'Сценарий',
          score: 98,
          deliverableSummary:
            'Драматургическая сценка с диалогом персонажей, сменой планов и отдельной адаптацией под ресайз 15 сек',
        },
        {
          id: 'voice_acting',
          label: 'Актёрская запись и подача',
          shortLabel: 'Голоса',
          score: 100,
          deliverableSummary:
            'Кастинг и режиссёрская запись 2–3 характерных актёров кинодубляжа с живым взаимодействием в диалоге',
        },
        {
          id: 'sound_design',
          label: 'Музыка и звуковое оформление',
          shortLabel: 'Саунд-дизайн',
          score: 100,
          deliverableSummary:
            'Многослойная акустическая среда (интершумы, движение в пространстве, спецэффекты и кинематографическая музыка)',
        },
        {
          id: 'legal_resizes',
          label: 'Паспорт прав и пакет версий',
          shortLabel: 'Права и версии',
          score: 96,
          deliverableSummary:
            'Полный комплект прав на всех исполнителей и фонограмму + 2 готовых эфирных мастера (полный + 15 сек)',
        },
      ],
    },
    timeline: {
      speedScore: 52,
      totalHoursTypical: 108,
      phases: [
        {
          id: 'script',
          label: 'Сценарная драматургия и диалоги (3 концепции)',
          hoursMin: 24,
          hoursMax: 30,
          sharePercent: 26,
          note: 'Разработка ролевых диалогов, тайминга реплик и сценария короткого ресайза 15 сек',
        },
        {
          id: 'recording',
          label: 'Запись ансамбля из 2–3 актёров дубляжа',
          hoursMin: 24,
          hoursMax: 32,
          sharePercent: 28,
          note: 'Синхронизация актёрских подач и темпоритма игрового диалога',
        },
        {
          id: 'mixing',
          label: 'Кинематографический саунд-дизайн и ресайз 15 сек',
          hoursMin: 28,
          hoursMax: 36,
          sharePercent: 30,
          note: 'Построение пространственной сцены, интершумов и монтаж 15-секундной версии',
        },
        {
          id: 'clearance',
          label: 'Паспорта прав на ансамбль и сдача 2 мастеров',
          hoursMin: 16,
          hoursMax: 22,
          sharePercent: 16,
          note: 'Оформление лицензионных паспортов на основной спот и короткий эфирный ресайз',
        },
      ],
    },
  },
  {
    id: 'custom_consult',
    title: CUSTOM_CONSULT_PRICING_ROW.title,
    shortTitle: 'Индивидуальный',
    subtitle: 'Договорная цена · Серии и спецзадачи',
    priceRub: 0,
    priceFormatted: CUSTOM_CONSULT_PRICING_ROW.priceFormatted,
    isNegotiable: true,
    turnaroundLabel: CUSTOM_CONSULT_PRICING_ROW.turnaround,
    turnaroundHoursMin: 1,
    turnaroundHoursMax: 120,
    supportsUrgent1Hour: true,
    urgentNote:
      'Подходит для срочных заказов от 1 часа (запись и сведение по готовому тексту), этапа «Только сценарий» или серии роликов',
    chronometry: {
      minSec: 5,
      maxSec: 60,
      optimalSec: 20,
      rangeLabel: '5–60 сек · пакет ресайзов',
      includedVersionsCount: 4,
      includes15sResize: true,
      chronometryScore: 94,
      summary:
        'Нестандартный хронометраж (например, 7, 17 или 22 сек под посекундный эфир) либо серия региональных адаптаций.',
    },
    complexity: {
      overallScore: 90,
      levelLabel: 'Гибкая конфигурация под ТЗ',
      voicesCountLabel: 'По задаче (от 1 голоса до серии)',
      scriptConceptsCount: 3,
      includedServiceRevisions: 1,
      axes: [
        {
          id: 'script_depth',
          label: 'Сценарий и редактура текста',
          shortLabel: 'Сценарий',
          score: 92,
          deliverableSummary:
            'Выделенный этап «Только сценарий», серия сценариев под разные регионы или работа строго по вашему тексту',
        },
        {
          id: 'voice_acting',
          label: 'Актёрская запись и подача',
          shortLabel: 'Голоса',
          score: 88,
          deliverableSummary:
            'Индивидуальный подбор дикторов, экспресс-запись от 1 часа или закрепление голоса за брендом на год',
        },
        {
          id: 'sound_design',
          label: 'Музыка и звуковое оформление',
          shortLabel: 'Саунд-дизайн',
          score: 88,
          deliverableSummary:
            'Аудиологотип, джингл, адаптация существующего ролика или серия региональных концовок',
        },
        {
          id: 'legal_resizes',
          label: 'Паспорт прав и пакет версий',
          shortLabel: 'Права и версии',
          score: 92,
          deliverableSummary:
            'Единый счёт и спецификация в ЭДО на весь пул роликов без дробления на мелкие доплаты',
        },
      ],
    },
    timeline: {
      speedScore: 86,
      totalHoursTypical: 24,
      phases: [
        {
          id: 'script',
          label: 'Разбор задачи с продюсером и фиксация сметы',
          hoursMin: 1,
          hoursMax: 6,
          sharePercent: 20,
          note: 'Согласование точного состава работ и стоимости до выставления счёта',
        },
        {
          id: 'recording',
          label: 'Запись голоса (в т.ч. срочный режим от 1 часа)',
          hoursMin: 1,
          hoursMax: 24,
          sharePercent: 32,
          note: 'Приоритетная сессия записи при срочном выпуске или плановая запись серии',
        },
        {
          id: 'mixing',
          label: 'Сведение, пакет ресайзов и региональных версий',
          hoursMin: 2,
          hoursMax: 36,
          sharePercent: 30,
          note: 'Сборка всех хронометражей под требования конкретных радиохолдингов',
        },
        {
          id: 'clearance',
          label: 'Комплект паспортов прав и закрытие в ЭДО',
          hoursMin: 1,
          hoursMax: 12,
          sharePercent: 18,
          note: 'Выдача всех эфирных мастеров и закрывающих документов одним пакетом',
        },
      ],
    },
  },
];

export function getPricingPackageVisualSpec(
  formatId: OrderFormatId | VisualPackageId
): PricingPackageVisualSpec {
  const normalizedId: VisualPackageId =
    formatId === 'adaptation' ? 'custom_consult' : formatId;
  return (
    PRICING_PACKAGE_VISUAL_SPECS.find((spec) => spec.id === normalizedId) ??
    PRICING_PACKAGE_VISUAL_SPECS[1]
  );
}

/**
 * Рассчитывает посекундную структуру ролика для выбранного пакета и хронометража (10..60 сек),
 * показывая распределение секунд между хуком, оффером, контактами и обязательной сноской ФЗ-38.
 */
export function computeChronometryStructureForPackage(
  packageId: OrderFormatId | VisualPackageId,
  rawDurationSec: number,
  hasMandatoryDisclaimer = true
): PackageChronometrySimulation {
  const spec = getPricingPackageVisualSpec(packageId);
  const targetDurationSec = Math.max(
    10,
    Math.min(60, Math.round(Number.isFinite(rawDurationSec) ? rawDurationSec : 20))
  );

  const isWithinRecommendedRange =
    targetDurationSec >= spec.chronometry.minSec &&
    targetDurationSec <= spec.chronometry.maxSec;

  const disclaimerSec = hasMandatoryDisclaimer
    ? targetDurationSec <= 15
      ? 3
      : targetDurationSec <= 25
        ? 3.5
        : 4
    : 0;

  const remainingSec = Math.max(6, targetDurationSec - disclaimerSec);

  // В игровом ролике («Мини-кино») больше времени уходит на сюжетный вход и диалог,
  // а в «Голос и стиль» — сразу плотная подача оффера.
  const hookRatio =
    spec.id === 'cinema' ? 0.34 : spec.id === 'turnkey' ? 0.28 : 0.22;
  const ctaRatio = spec.id === 'cinema' ? 0.2 : 0.24;

  const hookSec = Math.round(remainingSec * hookRatio * 10) / 10;
  const ctaSec = Math.round(remainingSec * ctaRatio * 10) / 10;
  const offerSec =
    Math.round(Math.max(3, remainingSec - hookSec - ctaSec) * 10) / 10;

  const segments: ChronometrySegmentBreakdown[] = [
    {
      id: 'hook',
      label:
        spec.id === 'cinema'
          ? 'Сюжетный диалог и захват внимания'
          : 'Интонационный вход и захват внимания',
      seconds: hookSec,
      sharePercent: Math.round((hookSec / targetDurationSec) * 100),
      description:
        spec.id === 'cinema'
          ? 'Живая сценка на 2–3 голоса с атмосферой места действия'
          : 'Первые секунды, выделяющие сообщение в рекламном блоке',
    },
    {
      id: 'offer',
      label: 'Коммерческое ядро и выгода предложения',
      seconds: offerSec,
      sharePercent: Math.round((offerSec / targetDurationSec) * 100),
      description:
        'Ключевой аргумент, условия и отстройка без перегруза лишними цифрами',
    },
    {
      id: 'cta',
      label: 'Призыв к действию и запоминание бренда',
      seconds: ctaSec,
      sharePercent: Math.round((ctaSec / targetDurationSec) * 100),
      description:
        'Чёткая фиксация названия компании, сайта или простого ориентира',
    },
  ];

  if (disclaimerSec > 0) {
    segments.push({
      id: 'disclaimer',
      label: 'Обязательная сноска ФЗ-38',
      seconds: disclaimerSec,
      sharePercent: Math.max(
        1,
        100 -
          segments.reduce((acc, item) => acc + item.sharePercent, 0)
      ),
      description:
        'Юридический дисклеймер (медицина, финансы, застройщики, акции), уложенный без потери смысла',
    });
  } else {
    const sumPercent = segments.reduce((acc, item) => acc + item.sharePercent, 0);
    if (sumPercent !== 100 && segments.length > 0) {
      segments[1].sharePercent += 100 - sumPercent;
    }
  }

  // Нормативная плотность речи для разборчивого эфира: ~2.1 слова в секунду чистого времени (без сноски)
  const wordsCapacityApprox = Math.round(
    remainingSec * (spec.id === 'cinema' ? 1.95 : 2.15) +
      (disclaimerSec > 0 ? disclaimerSec * 3.1 : 0)
  );

  const pricePerSecondRub =
    spec.priceRub > 0 ? Math.round(spec.priceRub / targetDurationSec) : null;

  const recommendedAdjustmentNote = isWithinRecommendedRange
    ? spec.chronometry.includes15sResize && targetDurationSec >= 25
      ? `Оптимально для «${spec.shortTitle}»: вы получаете полный ролик ${targetDurationSec} сек + короткий эфирный ресайз 15 сек в комплекте.`
      : `Хронометраж ${targetDurationSec} сек оптимально укладывается в норматив пакета «${spec.shortTitle}» (~${wordsCapacityApprox} слов).`
    : targetDurationSec < spec.chronometry.minSec
      ? `Для ${targetDurationSec} сек плотность диалога в «${spec.shortTitle}» будет сжатой — рекомендуем от ${spec.chronometry.minSec} сек или пакет «Голос и стиль».`
      : `Хронометраж ${targetDurationSec} сек превышает базовый порог ${spec.chronometry.maxSec} сек — рекомендуем «Игровой ролик» или индивидуальный расчёт.`;

  return {
    packageId: spec.id,
    targetDurationSec,
    hasMandatoryDisclaimer,
    isWithinRecommendedRange,
    recommendedAdjustmentNote,
    pricePerSecondRub,
    wordsCapacityApprox,
    segments,
  };
}

/**
 * Вычисляет координаты вершин многоугольника (SVG polygon points) для 4-осевого радара наполнения пакета.
 */
export function buildRadarPolygonPoints(
  axes: readonly PackageComplexityAxis[],
  center = 110,
  maxRadius = 78
): {
  polygonPoints: string;
  vertices: ReadonlyArray<{
    id: PackageComplexityAxis['id'];
    label: string;
    shortLabel: string;
    score: number;
    x: number;
    y: number;
    labelX: number;
    labelY: number;
  }>;
} {
  // 4 оси: сверху (0, -1), справа (1, 0), снизу (0, 1), слева (-1, 0)
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
  ];

  const vertices = axes.slice(0, 4).map((axis, idx) => {
    const dir = directions[idx] ?? { dx: 0, dy: -1 };
    const ratio = Math.max(0.1, Math.min(1, axis.score / 100));
    const r = Math.round(maxRadius * ratio * 10) / 10;
    const x = Math.round((center + dir.dx * r) * 10) / 10;
    const y = Math.round((center + dir.dy * r) * 10) / 10;
    const labelRadius = maxRadius + 22;
    const labelX = Math.round((center + dir.dx * labelRadius) * 10) / 10;
    const labelY = Math.round((center + dir.dy * labelRadius) * 10) / 10;

    return {
      id: axis.id,
      label: axis.label,
      shortLabel: axis.shortLabel,
      score: axis.score,
      x,
      y,
      labelX,
      labelY,
    };
  });

  return {
    polygonPoints: vertices.map((v) => `${v.x},${v.y}`).join(' '),
    vertices,
  };
}
