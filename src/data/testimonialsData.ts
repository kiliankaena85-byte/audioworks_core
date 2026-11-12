import { LayaPersona } from '../engine/layaTypes';
import { CaseId } from './casesData';

export type TestimonialCategory =
  | 'all'
  | 'fmcg'
  | 'real_estate'
  | 'medical'
  | 'fast_launch';

export interface TestimonialFilterItem {
  id: TestimonialCategory;
  label: string;
}

export interface ClientTestimonial {
  id: string;
  authorName: string;
  initials: string;
  authorRole: string;
  company: string;
  category: Exclude<TestimonialCategory, 'all'>;
  /** Спокойная необрамлённая строка метаданных через разделитель · */
  projectMeta: string;
  quote: string;
  /** Конкретный измеримый результат без абстрактных обещаний */
  outcomeMetric: string;
  outcomeContext: string;
  /** Ссылка на связанный аудио-пример на странице */
  relatedHref: `#case-${CaseId}` | '#duel';
  relatedLabel: string;
}

export const TESTIMONIAL_FILTERS: readonly TestimonialFilterItem[] = [
  { id: 'all', label: 'Все отзывы' },
  { id: 'fmcg', label: 'Ритейл и FMCG' },
  { id: 'real_estate', label: 'Девелопмент и ЖК' },
  { id: 'medical', label: 'Медицина' },
  { id: 'fast_launch', label: 'Запуск за 24 часа' },
] as const;

export const CLIENT_TESTIMONIALS: readonly ClientTestimonial[] = [
  {
    id: 'dmitrogorsky-fmcg',
    authorName: 'Алексей Соколов',
    initials: 'АС',
    authorRole: 'Директор по маркетингу',
    company: 'ГК «Дмитрогорский продукт»',
    category: 'fmcg',
    projectMeta: 'Ритейл и FMCG · Ролик под ключ · 21 сек',
    quote:
      'Раньше мы отдавали на станции обычную дикторскую начитку, и ролик растворялся между объявлениями про шины и распродажи. В AudioWorks пересобрали подачу через короткую утреннюю сцену, живой саунд-дизайн и точную паузу — в итоге ролик прошёл юристов четырёх радиосетей с первого дубля и заметно прибавил запоминаемости бренду.',
    outcomeMetric: '4 радиосети с 1-го дубля',
    outcomeContext: 'Модерация и паспорта музыки без единой правки со стороны станций',
    relatedHref: '#case-dmitrogorsky',
    relatedLabel: 'Послушать кейс в портфолио',
  },
  {
    id: 'forma-estate',
    authorName: 'Елена Вершинина',
    initials: 'ЕВ',
    authorRole: 'Коммерческий директор',
    company: 'Девелоперская группа «Форма Квартала»',
    category: 'real_estate',
    projectMeta: 'Девелопмент бизнес-класса · Аудио-кино · 20 сек',
    quote:
      'В проектах бизнес-класса нельзя кричать про скидки и проценты — это мгновенно обесценивает архитектуру. Команда нашла сдержанный актёрский тембр и так деликатно встроила обязательный юридический дисклеймер, что он не разрушил ощущение тишины. В отделе продаж клиенты впервые начали упоминать радиоролик при визите.',
    outcomeMetric: '+38% целевых обращений',
    outcomeContext: 'Прирост звонков с деловых радиостанций за первые 3 недели флайта',
    relatedHref: '#case-business-estate',
    relatedLabel: 'Послушать ролик квартала',
  },
  {
    id: 'zerno-fast-launch',
    authorName: 'Илья Кравцов',
    initials: 'ИК',
    authorRole: 'Основатель сети кофеен',
    company: '«Зерно и Свет»',
    category: 'fast_launch',
    projectMeta: 'HoReCa · Пересборка 15-секундного спота · 15 сек',
    quote:
      'До старта утреннего эфира оставались сутки, а на руках был перегруженный шаблон на 37 слов. Продюсер убедил сократить текст почти вдвое, оставить живой звук помола и полусекундную тишину в начале. Когда мы включили старый и новый варианты рядом в одном окне — разница оказалась колоссальной.',
    outcomeMetric: '24 часа от голосового ТЗ до эфира',
    outcomeContext: 'Полная пересборка сценария, запись актёра и мастеринг под радиоэфир',
    relatedHref: '#duel',
    relatedLabel: 'Сравнить оба ролика 15 сек',
  },
  {
    id: 'veramed-clinics',
    authorName: 'Марина Лебедева',
    initials: 'МЛ',
    authorRole: 'Руководитель бренда',
    company: 'Сеть многопрофильных клиник «ВераМед»',
    category: 'medical',
    projectMeta: 'Медицина · Серия эфирных роликов по ЭДО · 15 сек',
    quote:
      'Медицинская реклама в эфире часто звучит тревожно и казённо из-за строгих рамок закона. Ребята подобрали тёплый голос кинодубляжа, заранее выверили формулировки с юристами и передали полный пакет документов по ЭДО. Уже третий сезонный флайт запускаем голосовой заметкой за полминуты.',
    outcomeMetric: '100% комплаенс ФЗ «О рекламе»',
    outcomeContext: 'Три сезонных флайта подряд без задержек эфирной модерации',
    relatedHref: '#case-medical-clinics',
    relatedLabel: 'Перейти к кейсу клиники',
  },
];

/**
 * Возвращает список отзывов с учётом выбранного фильтра и текущего профиля Laya AI:
 * в режиме `all` первым встаёт релевантный отраслевой кейс клиента.
 */
export function getTestimonialsForFilterAndPersona(
  filter: TestimonialCategory,
  persona: LayaPersona
): ClientTestimonial[] {
  if (filter !== 'all') {
    return CLIENT_TESTIMONIALS.filter((item) => item.category === filter);
  }

  const byId = new Map(CLIENT_TESTIMONIALS.map((item) => [item.id, item]));

  let orderedIds: string[];
  if (persona === 'real_estate') {
    orderedIds = [
      'forma-estate',
      'dmitrogorsky-fmcg',
      'zerno-fast-launch',
      'veramed-clinics',
    ];
  } else if (persona === 'price_searcher' || persona === 'returning_vip') {
    orderedIds = [
      'zerno-fast-launch',
      'dmitrogorsky-fmcg',
      'forma-estate',
      'veramed-clinics',
    ];
  } else {
    orderedIds = [
      'dmitrogorsky-fmcg',
      'forma-estate',
      'zerno-fast-launch',
      'veramed-clinics',
    ];
  }

  return orderedIds
    .map((id) => byId.get(id))
    .filter((item): item is ClientTestimonial => Boolean(item));
}
