import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  FileCheck2,
} from 'lucide-react';
import { useLayoutEffect, useState } from 'react';
import { AIRTIME_SALES_ENABLED } from '../../data/platformFeatures';
import {
  IndustryVerticalSlug,
  PlatformRoute,
} from '../../data/platformRouter';
import { OrderFormatId } from '../../data/pricingData';
import { BROADCAST_TECH_STANDARD_ROWS } from '../../data/studioDocumentsCore';
import { ChronometerFaqSection } from '../ChronometerFaqSection';
import { ClientChronometerFz38Section } from '../ClientChronometerFz38Section';
import { PricingSection } from '../PricingSection';

interface PricingPageProps {
  scrollAnchor?: string;
  navigationTick?: number;
  onSelectFormat: (formatId: OrderFormatId) => void;
  onApplyChronometerToOrder: (payload: {
    formatId: OrderFormatId;
    spotDurationSec: number;
    industryPreset: IndustryVerticalSlug | null;
    briefText: string;
  }) => void;
  onNavigate: (route: PlatformRoute) => void;
}

const SIMPLE_WORKFLOW_STEPS = [
  {
    step: '01',
    timing: '5 минут',
    title: 'Заявка и оплата',
    description:
      'Передаёте задачу текстом или голосом. Для юрлиц и ИП — договор и счёт в ЭДО, для физлиц — оплата картой.',
  },
  {
    step: '02',
    timing: 'В день старта',
    title: 'Сценарий и выбор диктора',
    description:
      'Готовим 3 разных варианта текста с проверкой по закону о рекламе и присылаем голоса актёров на выбор.',
  },
  {
    step: '03',
    timing: 'Без вашего участия',
    title: 'Запись и сведение в студии',
    description:
      'Записываем выбранного диктора с режиссёром, подбираем лицензионную музыку и выравниваем звук под эфир.',
  },
  {
    step: '04',
    timing: '24–48 ч / 3–4 дня',
    title: 'Готовый ролик и документы',
    description:
      'Отправляем мастер-файлы WAV и MP3, паспорт ролика для радиостанции и закрывающие документы в ЭДО.',
  },
] as const;

const SIMPLE_LEGAL_CARDS = [
  {
    indexLabel: 'Документ 01',
    title: 'Паспорт ролика для радиостанций',
    summary:
      'Официальная справка об авторах текста, дикторе и музыке (РАО / ВОИС). Без неё ни одна станция не поставит ролик в эфир — выдаём бесплатно к каждому заказу.',
    bullets: [
      'Принимают все федеральные и региональные радиостанции РФ',
      'Точный паспортный хронометраж секунда в секунду',
    ],
  },
  {
    indexLabel: 'Документ 02',
    title: 'Полная передача прав без доплат',
    summary:
      'Все права на сценарий, запись голоса и лицензионную музыку переходят вашей компании навсегда — без скрытых роялти и ограничений.',
    bullets: [
      'Любые города, радиостанции, ТЦ и онлайн-площадки',
      'Бессрочное использование без продления лицензии',
    ],
  },
  {
    indexLabel: 'Документ 03',
    title: 'Проверка по закону до записи',
    summary:
      'Проверяем текст на соответствие ФЗ-38 «О рекламе» ещё до похода диктора к микрофону, чтобы юристы станции не завернули готовый ролик.',
    bullets: [
      'Учитываем сноски для медицины, ЖК, финансов и акций',
      'Убираем формулировки, из-за которых отклоняют эфир',
    ],
  },
] as const;

export function PricingPage({
  scrollAnchor,
  navigationTick = 0,
  onSelectFormat,
  onApplyChronometerToOrder,
  onNavigate,
}: PricingPageProps) {
  const [isTechSpecsOpen, setIsTechSpecsOpen] = useState(false);

  useLayoutEffect(() => {
    if (!scrollAnchor || typeof document === 'undefined') return;
    const target = document.getElementById(scrollAnchor);
    if (target) {
      target.scrollIntoView({
        behavior: 'instant' as ScrollBehavior,
        block: 'start',
      });
    }
  }, [scrollAnchor, navigationTick]);

  const scrollToLocalId = (id: string) => {
    if (typeof document === 'undefined') return;
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div data-testid="pricing-page-root">
      {/* 1. Короткий, ясный заголовок + сразу 4 тарифа на первом экране */}
      <section className="pt-10 pb-6 sm:pt-14 sm:pb-8 px-4 sm:px-6 lg:px-12">
        <div className="max-w-7xl mx-auto space-y-5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58">
            <span>Тарифы студии</span>
            <span aria-hidden="true" className="hidden sm:inline opacity-40">
              ·
            </span>
            <span>Фиксированная цена по договору ЭДО или картой</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-end">
            <div className="lg:col-span-8 space-y-3">
              <h1 className="text-3xl sm:text-5xl lg:text-[3.25rem] font-bold tracking-tight leading-[1.06] text-[#111111] dark:text-[#F4F3EF] editorial-balance">
                Понятная стоимость ролика под вашу задачу.
              </h1>
              <p className="text-base sm:text-lg text-[#111111]/70 dark:text-[#F4F3EF]/70 max-w-2xl editorial-pretty">
                Выберите подходящий формат: озвучка вашего готового текста за
                24–48 часов или полный цикл со сценарием под ключ. Паспорт прав
                для радиостанций включён в каждый тариф.
              </p>
            </div>

            <div className="lg:col-span-4 flex flex-wrap lg:justify-end gap-x-5 gap-y-1.5 text-xs sm:text-sm font-semibold text-[#111111]/68 dark:text-[#F4F3EF]/68">
              <button
                type="button"
                data-testid="pricing-chronometer-anchor-btn"
                onClick={() => scrollToLocalId('script-chronometer')}
                className="min-h-[38px] inline-flex items-center hover:text-[#FF4820] transition-colors cursor-pointer whitespace-nowrap"
              >
                Калькулятор хронометража ↓
              </button>
              <button
                type="button"
                onClick={() => scrollToLocalId('stages-24-48')}
                className="min-h-[38px] inline-flex items-center hover:text-[#FF4820] transition-colors cursor-pointer whitespace-nowrap"
              >
                Как мы работаем ↓
              </button>
              <button
                type="button"
                onClick={() => scrollToLocalId('legal-clearance')}
                className="min-h-[38px] inline-flex items-center hover:text-[#FF4820] transition-colors cursor-pointer whitespace-nowrap"
              >
                Документы для радио ↓
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Линейка из 4 тарифов сразу под заголовком (без второго дублирующего заголовка) */}
      <PricingSection onSelectFormat={onSelectFormat} hideHeader />

      {/* Короткая подсказка про срочный выпуск от 1 часа */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 pb-14 sm:pb-20 -mt-8 sm:-mt-12">
        <p className="text-xs sm:text-sm text-[#111111]/62 dark:text-[#F4F3EF]/62">
          <strong className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
            Нужен ролик сегодня?
          </strong>{' '}
          По готовому тексту выпускаем срочные заказы от 1 часа — выберите
          «Индивидуальный проект» или позвоните продюсеру.
        </p>
      </div>

      {/* 2. Калькулятор хронометража и автоматическая проверка ФЗ-38 */}
      <ClientChronometerFz38Section onApplyToOrder={onApplyChronometerToOrder} />

      {/* 2.1. Часто задаваемые вопросы о хронометраже и нюансах ФЗ-38 */}
      <ChronometerFaqSection
        onScrollToCalculator={() => scrollToLocalId('script-chronometer')}
      />

      {/* 3. Как мы работаем — 4 простых и понятных шага */}
      <section
        id="stages-24-48"
        aria-labelledby="stages-heading"
        className="scroll-mt-24 py-16 sm:py-24 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10 px-4 sm:px-6 lg:px-12"
      >
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs sm:text-sm font-medium text-[#111111]/55 dark:text-[#F4F3EF]/55">
              Порядок работы
            </p>
            <h2
              id="stages-heading"
              className="text-2xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight leading-[1.08] text-[#111111] dark:text-[#F4F3EF] editorial-balance"
            >
              Четыре простых шага от заявки до эфира.
            </h2>
            <p className="text-sm sm:text-lg text-[#111111]/70 dark:text-[#F4F3EF]/70 editorial-pretty">
              Мы берём на себя текст, подбор актёров, студийную запись и бумаги
              для радиостанции — от вас нужно только согласовать понравившийся
              вариант.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SIMPLE_WORKFLOW_STEPS.map((item) => (
              <article
                key={item.step}
                data-testid={`production-stage-${item.step}`}
                className="rounded-3xl p-6 bg-[#EFECE5]/75 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
                    <span className="font-bold text-[#FF4820]">
                      Шаг {item.step}
                    </span>
                    <span className="font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58">
                      {item.timing}
                    </span>
                  </div>

                  <h3 className="text-lg sm:text-xl font-bold tracking-tight leading-snug text-[#111111] dark:text-[#F4F3EF]">
                    {item.title}
                  </h3>

                  <p className="text-sm leading-relaxed text-[#111111]/72 dark:text-[#F4F3EF]/72">
                    {item.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Документы и гарантия приёмки на радио + свёрнутый спойлер техтребований */}
      <section
        id="legal-clearance"
        aria-labelledby="legal-clearance-heading"
        className="scroll-mt-24 py-16 sm:py-24 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10 px-4 sm:px-6 lg:px-12"
      >
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="max-w-3xl space-y-3">
            <p className="text-xs sm:text-sm font-medium text-[#111111]/55 dark:text-[#F4F3EF]/55">
              Документы и чистые права
            </p>
            <h2
              id="legal-clearance-heading"
              className="text-2xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight leading-[1.08] text-[#111111] dark:text-[#F4F3EF] editorial-balance"
            >
              Ролик примут на любой радиостанции с первого раза.
            </h2>
            <p className="text-sm sm:text-lg text-[#111111]/70 dark:text-[#F4F3EF]/70 editorial-pretty">
              Вместе с аудиофайлами вы получаете полный пакет документов для
              радиохолдингов и бухгалтерии — без доплат за лицензии и риска
              отклонения эфира.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {SIMPLE_LEGAL_CARDS.map((doc) => (
              <article
                key={doc.indexLabel}
                className="rounded-3xl p-6 sm:p-7 bg-[#141418] text-[#F4F3EF] border border-white/10 flex flex-col justify-between gap-6"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 text-xs font-semibold text-white/58 tabular-nums">
                    <span>{doc.indexLabel}</span>
                    <FileCheck2
                      className="w-4 h-4 text-[#FF4820] shrink-0"
                      aria-hidden="true"
                    />
                  </div>

                  <h3 className="text-lg sm:text-xl font-bold tracking-tight leading-snug text-white">
                    {doc.title}
                  </h3>

                  <p className="text-sm leading-relaxed text-white/74">
                    {doc.summary}
                  </p>
                </div>

                <ul className="pt-4 border-t border-white/10 space-y-2 text-xs sm:text-sm text-white/86">
                  {doc.bullets.map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <Check
                        className="w-4 h-4 text-[#FF4820] shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          {/* Спокойная свёрнутая плашка с техпараметрами для звукорежиссёров радиостанций */}
          <div className="rounded-2xl bg-[#EFECE5]/65 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 overflow-hidden">
            <button
              type="button"
              data-testid="toggle-broadcast-tech-specs-btn"
              aria-expanded={isTechSpecsOpen}
              onClick={() => setIsTechSpecsOpen((prev) => !prev)}
              className="w-full px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left cursor-pointer hover:bg-[#111111]/[0.02] dark:hover:bg-white/[0.02] transition-colors"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]">
                  Сдаём файлы строго по техническим требованиям радиостанций РФ
                  (WAV + MP3)
                </p>
                <p className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60">
                  Параметры громкости, формата и точности хронометража для
                  звукоинженеров станции
                </p>
              </div>

              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF4820] whitespace-nowrap shrink-0">
                <span>
                  {isTechSpecsOpen
                    ? 'Скрыть техпараметры'
                    : 'Показать техпараметры мастеринга'}
                </span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    isTechSpecsOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </span>
            </button>

            {isTechSpecsOpen && (
              <div className="border-t border-[#111111]/10 dark:border-white/10 overflow-x-auto">
                <table
                  data-testid="broadcast-tech-standard-table"
                  className="w-full min-w-[560px] text-left border-collapse text-xs sm:text-sm"
                >
                  <tbody className="divide-y divide-[#111111]/10 dark:divide-white/10">
                    {BROADCAST_TECH_STANDARD_ROWS.map((row) => (
                      <tr key={row.parameter} className="align-top">
                        <td className="py-3.5 px-5 sm:px-6 w-1/3 font-semibold text-[#111111] dark:text-[#F4F3EF]">
                          {row.parameter}
                        </td>
                        <td className="py-3.5 px-5 sm:px-6 text-[#111111]/74 dark:text-[#F4F3EF]/74 leading-relaxed">
                          {row.specification}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 5. Финальный переход к заказу и ссылка на частые вопросы */}
      <section className="py-14 sm:py-20 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10 px-4 sm:px-6 lg:px-12">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="rounded-3xl p-7 sm:p-10 bg-[#141418] text-[#F4F3EF] border border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <p className="text-xs sm:text-sm font-medium text-white/60">
                Договор и счёт в ЭДО · Оплата картой · Паспорт прав РАО / ВОИС
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white editorial-balance">
                Готовы запустить ролик в работу или хотите обсудить задачу с
                продюсером?
              </h2>
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 w-full sm:w-auto min-w-0">
              <button
                type="button"
                onClick={() => onSelectFormat('turnkey')}
                className="w-full sm:w-auto min-h-[46px] px-6 py-3 rounded-full bg-[#FF4820] hover:bg-[#E63D18] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer sm:whitespace-nowrap"
              >
                <span>Заказать аудиоролик</span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>

              {AIRTIME_SALES_ENABLED ? (
                <button
                  type="button"
                  onClick={() => onNavigate({ kind: 'hot-air' })}
                  className="w-full sm:w-auto min-h-[46px] px-5 py-3 rounded-full bg-white/8 hover:bg-white/14 text-white border border-white/16 text-sm font-semibold inline-flex items-center justify-center gap-2 text-center leading-snug transition-colors cursor-pointer sm:whitespace-nowrap"
                >
                  <span>Горящий эфир со скидкой до 45%</span>
                  <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelectFormat('custom_consult')}
                  className="w-full sm:w-auto min-h-[46px] px-5 py-3 rounded-full bg-white/8 hover:bg-white/14 text-white border border-white/16 text-sm font-semibold inline-flex items-center justify-center gap-2 text-center leading-snug transition-colors cursor-pointer sm:whitespace-nowrap"
                >
                  <span>Обсудить нестандартный проект</span>
                  <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
            <p className="text-xs sm:text-sm text-[#111111]/66 dark:text-[#F4F3EF]/66">
              Остались вопросы по договору, оплате через ЭДО, правкам или
              срочному выпуску от 1 часа?
            </p>
            <button
              type="button"
              data-testid="pricing-faq-bridge-bottom-btn"
              onClick={() => onNavigate({ kind: 'faq' })}
              className="min-h-[40px] inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#111111] dark:text-[#F4F3EF] hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Ответы на частые вопросы (FAQ)</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
