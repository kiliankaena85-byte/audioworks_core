import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  XCircle,
} from 'lucide-react';
import { RADIO_SCIENCE_PILLARS } from '../../data/hotAirPackages';
import {
  LOCAL_EDITORIAL_IMAGES,
  RADIO_MISTAKE_ARTICLES,
  RadioMistakeArticle,
} from '../../data/multiPageContentData';
import { AIRTIME_SALES_ENABLED } from '../../data/platformFeatures';
import { PlatformRoute } from '../../data/platformRouter';
import { ApproachSection } from '../ApproachSection';

interface ApproachPageProps {
  articleSlug?: string;
  onNavigate: (route: PlatformRoute) => void;
  onStartOrder: () => void;
}

function MistakeArticleDetailView({
  article,
  onNavigate,
  onStartOrder,
}: {
  article: RadioMistakeArticle;
  onNavigate: (route: PlatformRoute) => void;
  onStartOrder: () => void;
}) {
  const currentIndex = RADIO_MISTAKE_ARTICLES.findIndex((a) => a.slug === article.slug);
  const nextArticle =
    RADIO_MISTAKE_ARTICLES[(currentIndex + 1) % RADIO_MISTAKE_ARTICLES.length];

  return (
    <article
      data-testid={`mistake-article-${article.slug}`}
      className="py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-12"
    >
      <div className="max-w-5xl mx-auto space-y-12 sm:space-y-16">
        {/* Хлебные крошки */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#111111]/10 dark:border-white/10 pb-6">
          <button
            type="button"
            onClick={() => onNavigate({ kind: 'approach' })}
            className="min-h-[42px] inline-flex items-center gap-2 text-sm font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72 hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Ко всем разборам и методологии</span>
          </button>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58 tabular-nums">
            <span>{article.indexLabel}</span>
            <span aria-hidden="true" className="opacity-40">
              ·
            </span>
            <span>{article.categoryKicker}</span>
            <span aria-hidden="true" className="opacity-40">
              ·
            </span>
            <span>{article.readingTime}</span>
          </div>
        </div>

        {/* Заголовок статьи и главная цифра потерь/выигрыша */}
        <header className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          <div className="lg:col-span-8 space-y-5">
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.07] text-[#111111] dark:text-[#F4F3EF] editorial-balance">
              {article.title}
            </h1>
            <p className="text-lg sm:text-xl leading-relaxed text-[#111111]/74 dark:text-[#F4F3EF]/74 editorial-pretty">
              {article.subtitle}
            </p>
          </div>

          <div className="lg:col-span-4 rounded-3xl p-6 sm:p-7 bg-[#EFECE5]/80 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 space-y-2">
            <p className="text-xs font-semibold text-[#111111]/55 dark:text-[#F4F3EF]/55">
              Ключевой индикатор внимания
            </p>
            <p className="text-4xl sm:text-5xl font-bold tracking-tight tabular-nums text-[#FF4820]">
              {article.impactStatValue}
            </p>
            <p className="text-sm leading-snug text-[#111111]/76 dark:text-[#F4F3EF]/76">
              {article.impactStatLabel}
            </p>
          </div>
        </header>

        {/* Диагностика проблемы (журнальная ширина строки max-w-3xl) */}
        <section className="max-w-3xl space-y-6">
          <p className="text-base sm:text-lg leading-relaxed text-[#111111]/86 dark:text-[#F4F3EF]/86 editorial-pretty">
            {article.summary}
          </p>

          <div className="space-y-4 pt-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
              Почему возникает эта ошибка в эфире
            </h2>
            <ul className="space-y-3.5">
              {article.problemDiagnosis.map((point, idx) => (
                <li
                  key={point}
                  className="flex items-start gap-3.5 text-sm sm:text-base leading-relaxed text-[#111111]/78 dark:text-[#F4F3EF]/78"
                >
                  <span className="font-bold tabular-nums text-[#FF4820] shrink-0 mt-0.5">
                    0{idx + 1}.
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Сравнение сценариев «До и После» */}
        <section aria-label="Сравнение сценариев до и после" className="space-y-5">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
            Сравнение текстов в реальном рекламном блоке
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
            {/* Типичная ошибка */}
            <div className="rounded-3xl p-6 sm:p-8 bg-[#EFECE5]/75 dark:bg-[#15151A] border border-[#111111]/12 dark:border-white/12 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 text-xs font-semibold tabular-nums text-[#111111]/60 dark:text-[#F4F3EF]/60">
                  <span className="inline-flex items-center gap-1.5 text-[#111111]/80 dark:text-[#F4F3EF]/80">
                    <XCircle className="w-4 h-4 text-[#111111]/55 dark:text-[#F4F3EF]/55 shrink-0" aria-hidden="true" />
                    <span>{article.badScriptExample.label}</span>
                  </span>
                  <span>{article.badScriptExample.chronometry}</span>
                </div>

                <blockquote className="text-base sm:text-lg leading-relaxed text-[#111111]/85 dark:text-[#F4F3EF]/85 editorial-pretty">
                  {article.badScriptExample.text}
                </blockquote>
              </div>

              <p className="pt-4 border-t border-[#111111]/10 dark:border-white/10 text-xs sm:text-sm text-[#111111]/66 dark:text-[#F4F3EF]/66">
                <strong className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                  Разбор промаха:
                </strong>{' '}
                {article.badScriptExample.flawNote}
              </p>
            </div>

            {/* Решение FMWorks */}
            <div className="rounded-3xl p-6 sm:p-8 bg-[#141418] text-[#F4F3EF] border border-white/12 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 text-xs font-semibold tabular-nums text-white/70">
                  <span className="inline-flex items-center gap-1.5 text-[#FFB38A]">
                    <Check className="w-4 h-4 text-[#FF4820] shrink-0" aria-hidden="true" />
                    <span>{article.goodScriptExample.label}</span>
                  </span>
                  <span>{article.goodScriptExample.chronometry}</span>
                </div>

                <blockquote className="text-base sm:text-lg font-medium leading-relaxed text-white editorial-pretty">
                  {article.goodScriptExample.text}
                </blockquote>
              </div>

              <p className="pt-4 border-t border-white/12 text-xs sm:text-sm text-white/76">
                <strong className="font-semibold text-white">За счёт чего работает:</strong>{' '}
                {article.goodScriptExample.winNote}
              </p>
            </div>
          </div>
        </section>

        {/* Нейрофизиологическое объяснение + чек-лист продюсера */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 pt-4 border-t border-[#111111]/10 dark:border-white/10">
          <div className="lg:col-span-5 space-y-3">
            <p className="text-xs font-semibold text-[#FF4820]">Данные нейроисследований</p>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
              Механика слуховой памяти
            </h2>
            <p className="text-sm sm:text-base leading-relaxed text-[#111111]/74 dark:text-[#F4F3EF]/74 editorial-pretty">
              {article.neuroExplanation}
            </p>
          </div>

          <div className="lg:col-span-7 rounded-3xl p-6 sm:p-8 bg-[#EFECE5]/70 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 space-y-4">
            <h3 className="text-lg sm:text-xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
              Чек-лист самопроверки перед записью ролика
            </h3>
            <ul className="space-y-3">
              {article.producerChecklist.map((rule) => (
                <li
                  key={rule}
                  className="flex items-start gap-3 text-sm sm:text-base leading-relaxed text-[#111111]/82 dark:text-[#F4F3EF]/82"
                >
                  <Check
                    className="w-4 h-4 text-[#FF4820] shrink-0 mt-1"
                    aria-hidden="true"
                  />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Переход к следующему разбору или заказу сценария */}
        <footer className="pt-8 border-t border-[#111111]/10 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          {nextArticle && nextArticle.slug !== article.slug && (
            <button
              type="button"
              onClick={() =>
                onNavigate({ kind: 'mistake-detail', articleSlug: nextArticle.slug })
              }
              className="text-left group cursor-pointer space-y-1 max-w-md"
            >
              <span className="block text-xs font-semibold text-[#111111]/55 dark:text-[#F4F3EF]/55">
                Следующий разбор · {nextArticle.indexLabel}
              </span>
              <span className="inline-flex items-center gap-2 text-base sm:text-lg font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF] group-hover:text-[#FF4820] transition-colors">
                <span>{nextArticle.title}</span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </span>
            </button>
          )}

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onStartOrder}
              className="min-h-[46px] px-6 py-3 rounded-full bg-[#FF4820] hover:bg-[#E63D18] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Заказать сценарий и ролик</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate({ kind: 'cases' })}
              className="min-h-[46px] px-5 py-3 rounded-full bg-[#EFECE5] dark:bg-[#17171D] hover:bg-[#111111] hover:text-white dark:hover:bg-white dark:hover:text-[#111111] text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Слушать готовые кейсы</span>
              <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>
          </div>
        </footer>
      </div>
    </article>
  );
}

export function ApproachPage({
  articleSlug,
  onNavigate,
  onStartOrder,
}: ApproachPageProps) {
  if (articleSlug) {
    const matched = RADIO_MISTAKE_ARTICLES.find((item) => item.slug === articleSlug);
    if (matched) {
      return (
        <MistakeArticleDetailView
          article={matched}
          onNavigate={onNavigate}
          onStartOrder={onStartOrder}
        />
      );
    }
  }

  return (
    <div data-testid="approach-page-root">
      {/* Редакционная шапка раздела «О подходе и исследованиях» */}
      <section className="pt-12 pb-6 sm:pt-16 sm:pb-10 px-4 sm:px-6 lg:px-12">
        <div className="max-w-7xl mx-auto space-y-5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58">
            <span>Методология FMWorks</span>
            <span aria-hidden="true" className="opacity-40">
              ·
            </span>
            <span>Нейрофизиология слуха и драматургия</span>
            <span aria-hidden="true" className="opacity-40">
              ·
            </span>
            <span className="tabular-nums">5 практических разборов со сценариями</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.06] text-[#111111] dark:text-[#F4F3EF] max-w-4xl editorial-balance">
            Как удерживать внимание водителя и не сливать эфирный бюджет на звуковой шум.
          </h1>
        </div>
      </section>

      {/* Базовые принципы и данные исследований (сохраняем всю анимацию и вёрстку блока) */}
      <ApproachSection />

      {/* Наука медиапланирования: правило 5+ касаний и горизонт 3 месяцев */}
      <section
        id="effective-frequency-science"
        aria-labelledby="effective-frequency-heading"
        className="py-16 sm:py-24 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10 px-4 sm:px-6 lg:px-12"
      >
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="max-w-3xl space-y-3">
            <p className="text-xs sm:text-sm font-semibold text-[#FF4820]">
              Исследования эффективной частоты · Честная математика эфира
            </p>
            <h2
              id="effective-frequency-heading"
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.08] text-[#111111] dark:text-[#F4F3EF] editorial-balance"
            >
              Почему один выход равен нулю, а узнаваемость строится минимум три месяца.
            </h2>
            <p className="text-base sm:text-lg text-[#111111]/72 dark:text-[#F4F3EF]/72 leading-relaxed">
              Мы не продаём клиенту «попробовать один месяц» под имиджевую задачу, чтобы вы не ушли разочарованными. У каждой бизнес-цели есть научно доказанный порог контактов и минимальный срок работы.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {RADIO_SCIENCE_PILLARS.map((pillar) => (
              <article
                key={pillar.index}
                className="rounded-3xl p-6 sm:p-8 bg-[#EFECE5]/75 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 flex flex-col justify-between gap-5"
              >
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-[#FF4820] tabular-nums">
                    {pillar.index} · {pillar.metricAnchor}
                  </p>
                  <h3 className="text-xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                    {pillar.title}
                  </h3>
                  <p className="text-sm sm:text-base leading-relaxed text-[#111111]/74 dark:text-[#F4F3EF]/74">
                    {pillar.summary}
                  </p>
                </div>

                <p className="pt-4 border-t border-[#111111]/10 dark:border-white/10 text-xs sm:text-sm font-medium leading-relaxed text-[#111111]/86 dark:text-[#F4F3EF]/86">
                  {pillar.practicalRule}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Экспертный раздел: Разбор 5 типовых ошибок в радиорекламе */}
      <section
        id="radio-mistakes"
        aria-labelledby="radio-mistakes-heading"
        className="scroll-mt-24 py-20 sm:py-28 lg:py-36 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 space-y-12 lg:space-y-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-7 space-y-4">
              <p className="text-sm font-medium text-[#111111]/55 dark:text-[#F4F3EF]/55">
                Редакционный практикум для маркетологов и собственников
              </p>
              <h2
                id="radio-mistakes-heading"
                className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.08] text-[#111111] dark:text-[#F4F3EF] editorial-balance"
              >
                5 ошибок в сценариях и медиаплане, из-за которых радио «не сработало».
              </h2>
              <p className="text-base sm:text-lg text-[#111111]/70 dark:text-[#F4F3EF]/70 max-w-2xl editorial-pretty">
                В каждом материале мы разбираем реальную механику потери внимания в автомобильном
                потоке, сравниваем слабый и сильный текст посекундно и даём короткий чек-лист
                проверки.
              </p>
            </div>

            <div className="lg:col-span-5">
              <div className="relative overflow-hidden rounded-3xl aspect-[16/10] bg-[#141418] border border-[#111111]/10 dark:border-white/10">
                <img
                  src={LOCAL_EDITORIAL_IMAGES.radioAttention}
                  alt="Акустические деревянные панели вещательной студии в тёплом архитектурном свете"
                  decoding="async"
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (!img.dataset.fallbackApplied) {
                      img.dataset.fallbackApplied = '1';
                      img.src = LOCAL_EDITORIAL_IMAGES.studioHero;
                    }
                  }}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Журнальный реестр разборов */}
          <div className="divide-y divide-[#111111]/12 dark:divide-white/12 border-t border-b border-[#111111]/12 dark:border-white/12">
            {RADIO_MISTAKE_ARTICLES.map((article) => (
              <article
                key={article.slug}
                data-testid={`mistake-card-${article.slug}`}
                className="group py-8 sm:py-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start"
              >
                <div className="lg:col-span-3 space-y-2 tabular-nums">
                  <p className="text-xs font-semibold text-[#111111]/55 dark:text-[#F4F3EF]/55">
                    {article.indexLabel} · {article.readingTime}
                  </p>
                  <p className="text-3xl sm:text-4xl font-bold tracking-tight text-[#FF4820]">
                    {article.impactStatValue}
                  </p>
                  <p className="text-xs sm:text-sm text-[#111111]/66 dark:text-[#F4F3EF]/66 leading-snug">
                    {article.impactStatLabel}
                  </p>
                </div>

                <div className="lg:col-span-6 space-y-3">
                  <p className="text-xs font-medium text-[#111111]/55 dark:text-[#F4F3EF]/55">
                    {article.categoryKicker}
                  </p>
                  <h3 className="text-xl sm:text-2xl lg:text-[1.65rem] font-bold tracking-tight leading-snug text-[#111111] dark:text-[#F4F3EF] group-hover:text-[#FF4820] transition-colors editorial-balance">
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate({ kind: 'mistake-detail', articleSlug: article.slug })
                      }
                      className="text-left cursor-pointer"
                    >
                      {article.title}
                    </button>
                  </h3>
                  <p className="text-sm sm:text-base leading-relaxed text-[#111111]/72 dark:text-[#F4F3EF]/72 editorial-pretty">
                    {article.summary}
                  </p>
                </div>

                <div className="lg:col-span-3 flex lg:justify-end items-center pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({ kind: 'mistake-detail', articleSlug: article.slug })
                    }
                    className="min-h-[44px] px-5 py-2.5 rounded-full bg-[#EFECE5] dark:bg-[#17171D] group-hover:bg-[#111111] group-hover:text-white dark:group-hover:bg-[#F4F3EF] dark:group-hover:text-[#0D0D0F] text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <span>Читать разбор</span>
                    <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Спокойный переход к проверке своего брифа или подбору эфира */}
      <section className="py-16 sm:py-20 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10 px-4 sm:px-6 lg:px-12">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF] editorial-balance">
              Хотите проверить свой текущий ролик или написать новый без штампов?
            </h2>
            <p className="text-sm sm:text-base text-[#111111]/68 dark:text-[#F4F3EF]/68">
              Приложите текст или надиктуйте задачу на странице оформления — продюсер предложит
              три точных сценария с расчётом хронометража до секунды.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onStartOrder}
              className="min-h-[46px] px-6 py-3 rounded-full bg-[#FF4820] hover:bg-[#E63D18] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Передать задачу продюсеру</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>

            {AIRTIME_SALES_ENABLED ? (
              <button
                type="button"
                onClick={() => onNavigate({ kind: 'hot-air' })}
                className="min-h-[46px] px-5 py-3 rounded-full border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>Открыть медиапланер эфира</span>
                <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate({ kind: 'pricing' })}
                className="min-h-[46px] px-5 py-3 rounded-full border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>Тарифы и регламент выпуска</span>
                <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
