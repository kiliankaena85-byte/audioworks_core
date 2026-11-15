import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Eye,
  EyeOff,
  Plus,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  ClientTestimonialCmsRecord,
  PortfolioCaseRecord,
  TestimonialsCmsConfig,
  TestimonialTrustMetric,
} from '../../data/studioCmsTypes';
import {
  createNewCmsTestimonialRecord,
  deriveAuthorInitials,
  reorderCmsTestimonials,
  TESTIMONIAL_FILTERS,
  TestimonialIndustryKey,
} from '../../data/testimonialsCms';

interface AdminTestimonialsPanelProps {
  testimonials: TestimonialsCmsConfig;
  portfolioCases: readonly PortfolioCaseRecord[];
  flagshipReel: PortfolioCaseRecord;
  onChangeTestimonials: (next: TestimonialsCmsConfig) => void;
  onNavigateToTestimonialsOnSite: () => void;
}

const CATEGORY_OPTIONS: readonly { id: TestimonialIndustryKey; label: string }[] =
  TESTIMONIAL_FILTERS.filter(
    (tab): tab is { id: TestimonialIndustryKey; label: string } => tab.id !== 'all'
  );

function getCategoryLabel(category: TestimonialIndustryKey): string {
  return (
    CATEGORY_OPTIONS.find((opt) => opt.id === category)?.label ?? 'Ритейл и FMCG'
  );
}

export function AdminTestimonialsPanel({
  testimonials,
  portfolioCases,
  flagshipReel,
  onChangeTestimonials,
  onNavigateToTestimonialsOnSite,
}: AdminTestimonialsPanelProps) {
  const [selectedId, setSelectedId] = useState<string>(
    () => testimonials.items[0]?.id ?? ''
  );

  const activeItem = useMemo(() => {
    return (
      testimonials.items.find((item) => item.id === selectedId) ??
      testimonials.items[0] ??
      null
    );
  }, [testimonials.items, selectedId]);

  const publishedCount = useMemo(
    () => testimonials.items.filter((item) => item.published !== false).length,
    [testimonials.items]
  );

  const availableAudioCases = useMemo(() => {
    const list: PortfolioCaseRecord[] = [];
    if (flagshipReel.published !== false) {
      list.push(flagshipReel);
    }
    for (const c of portfolioCases) {
      if (c.published !== false) {
        list.push(c);
      }
    }
    return list;
  }, [flagshipReel, portfolioCases]);

  const patchConfig = (patch: Partial<TestimonialsCmsConfig>) => {
    onChangeTestimonials({
      ...testimonials,
      ...patch,
    });
  };

  const patchItem = (
    itemId: string,
    patch: Partial<ClientTestimonialCmsRecord>
  ) => {
    onChangeTestimonials({
      ...testimonials,
      items: testimonials.items.map((entry) =>
        entry.id === itemId ? { ...entry, ...patch } : entry
      ),
    });
  };

  const handleAddTestimonial = () => {
    const created = createNewCmsTestimonialRecord(testimonials.items);
    const nextItems = [...testimonials.items, created].map((item, idx) => ({
      ...item,
      sortOrder: idx + 1,
    }));
    onChangeTestimonials({
      ...testimonials,
      items: nextItems,
    });
    setSelectedId(created.id);
  };

  const handleMoveTestimonial = (index: number, direction: 'up' | 'down') => {
    const reordered = reorderCmsTestimonials(
      testimonials.items,
      index,
      direction
    );
    onChangeTestimonials({
      ...testimonials,
      items: reordered,
    });
  };

  const handleTogglePublished = (item: ClientTestimonialCmsRecord) => {
    if (item.published && publishedCount <= 1) {
      return;
    }
    patchItem(item.id, { published: !item.published });
  };

  const handleDeleteTestimonial = (item: ClientTestimonialCmsRecord) => {
    if (testimonials.items.length <= 1) return;
    if (item.published && publishedCount <= 1) return;

    const remaining = testimonials.items
      .filter((entry) => entry.id !== item.id)
      .map((entry, idx) => ({
        ...entry,
        sortOrder: idx + 1,
      }));
    onChangeTestimonials({
      ...testimonials,
      items: remaining,
    });
    if (selectedId === item.id && remaining[0]) {
      setSelectedId(remaining[0].id);
    }
  };

  const handleMetricChange = (
    metricId: string,
    patch: Partial<TestimonialTrustMetric>
  ) => {
    patchConfig({
      trustMetrics: testimonials.trustMetrics.map((m) =>
        m.id === metricId ? { ...m, ...patch } : m
      ),
    });
  };

  const handleAddTrustMetric = () => {
    if (testimonials.trustMetrics.length >= 4) return;
    const nextMetric: TestimonialTrustMetric = {
      id: `metric-${Date.now().toString(36).slice(-5)}`,
      value: '3+ волны',
      label: 'среднее число повторных сезонных запусков с постоянными заказчиками',
    };
    patchConfig({
      trustMetrics: [...testimonials.trustMetrics, nextMetric],
    });
  };

  const handleRemoveTrustMetric = (metricId: string) => {
    if (testimonials.trustMetrics.length <= 1) return;
    patchConfig({
      trustMetrics: testimonials.trustMetrics.filter((m) => m.id !== metricId),
    });
  };

  return (
    <div data-testid="admin-testimonials-panel" className="space-y-6">
      {/* Top StudioCMS Testimonials Management Workspace */}
      <section
        aria-labelledby="admin-testimonials-list-heading"
        className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 overflow-hidden"
      >
        <div className="px-5 sm:px-6 py-4 border-b border-[#111111]/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <h2
                id="admin-testimonials-list-heading"
                className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]"
              >
                Карточки отзывов клиентов на главной (#testimonials)
              </h2>
              <span
                aria-hidden="true"
                className="text-[#111111]/35 dark:text-[#F4F3EF]/35"
              >
                ·
              </span>
              <span className="text-[#111111]/62 dark:text-[#F4F3EF]/62 tabular-nums">
                Опубликовано {publishedCount} из {testimonials.items.length}
              </span>
            </div>
            <p className="text-xs text-[#111111]/56 dark:text-[#F4F3EF]/56">
              Каждый отзыв динамически подгружается на главную страницу, участвует в отраслевой фильтрации и может проигрывать связанный аудиоролик из портфолио.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="admin-preview-testimonials-btn"
              onClick={onNavigateToTestimonialsOnSite}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] hover:border-[#FF4820] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Показать #testimonials</span>
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            </button>

            <button
              type="button"
              data-testid="admin-add-testimonial-btn"
              onClick={handleAddTestimonial}
              disabled={testimonials.items.length >= 24}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] hover:bg-[#FF4820] hover:text-white dark:hover:bg-[#FF4820] dark:hover:text-white disabled:opacity-45 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Добавить отзыв</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#111111]/10 dark:divide-white/10">
          {/* Left Master List */}
          <div className="lg:col-span-5 divide-y divide-[#111111]/8 dark:divide-white/8">
            {testimonials.items.map((item, idx) => {
              const isSelected = activeItem?.id === item.id;
              const isLastPublished = item.published && publishedCount <= 1;

              return (
                <div
                  key={item.id}
                  data-testid={`admin-testimonial-row-${item.id}`}
                  className={`p-4 sm:p-5 transition-colors ${
                    isSelected
                      ? 'bg-[#F7F6F2] dark:bg-[#1B1B22]'
                      : 'hover:bg-[#F7F6F2]/60 dark:hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className="min-w-0 flex-1 text-left space-y-1.5 cursor-pointer"
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] tabular-nums">
                        <span className="font-bold text-[#111111]/48 dark:text-[#F4F3EF]/48">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span aria-hidden="true" className="text-current/30">
                          ·
                        </span>
                        <span className="font-medium text-[#111111]/62 dark:text-[#F4F3EF]/62">
                          {getCategoryLabel(item.category)}
                        </span>
                        <span aria-hidden="true" className="text-current/30">
                          ·
                        </span>
                        <span
                          className={
                            item.published
                              ? 'font-semibold text-[#16A34A] dark:text-[#4ADE80]'
                              : 'font-medium text-[#111111]/45 dark:text-[#F4F3EF]/45'
                          }
                        >
                          {item.published ? 'На главной' : 'Черновик'}
                        </span>
                      </div>

                      <p className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF] truncate">
                        {item.authorName} · {item.company}
                      </p>

                      <p className="text-xs text-[#FF4820] font-semibold tabular-nums truncate">
                        {item.outcomeMetric}
                      </p>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveTestimonial(idx, 'up')}
                        aria-label={`Поднять отзыв ${item.authorName} выше`}
                        className="w-8 h-8 rounded-lg border border-[#111111]/10 dark:border-white/10 inline-flex items-center justify-center text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:text-[#111111] dark:hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-default"
                      >
                        <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        disabled={idx === testimonials.items.length - 1}
                        onClick={() => handleMoveTestimonial(idx, 'down')}
                        aria-label={`Опустить отзыв ${item.authorName} ниже`}
                        className="w-8 h-8 rounded-lg border border-[#111111]/10 dark:border-white/10 inline-flex items-center justify-center text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:text-[#111111] dark:hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-default"
                      >
                        <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        disabled={isLastPublished}
                        onClick={() => handleTogglePublished(item)}
                        aria-label={
                          item.published
                            ? `Скрыть отзыв ${item.authorName} с главной страницы`
                            : `Опубликовать отзыв ${item.authorName} на главной странице`
                        }
                        title={
                          isLastPublished
                            ? 'На главной странице должен оставаться хотя бы один опубликованный отзыв'
                            : undefined
                        }
                        className="w-8 h-8 rounded-lg border border-[#111111]/10 dark:border-white/10 inline-flex items-center justify-center text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:text-[#111111] dark:hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-default"
                      >
                        {item.published ? (
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Detail Editor */}
          <div className="lg:col-span-7 p-5 sm:p-6">
            {activeItem ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#111111]/10 dark:border-white/10">
                  <div>
                    <h3 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                      Редактирование отзыва: {activeItem.authorName}
                    </h3>
                    <p className="text-xs text-[#111111]/55 dark:text-[#F4F3EF]/55">
                      ID карточки: {activeItem.id}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={activeItem.published && publishedCount <= 1}
                      onClick={() => handleTogglePublished(activeItem)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] hover:border-[#FF4820] disabled:opacity-40 cursor-pointer disabled:cursor-default whitespace-nowrap shrink-0"
                    >
                      {activeItem.published ? 'Снять с публикации' : 'Опубликовать'}
                    </button>

                    <button
                      type="button"
                      data-testid={`admin-delete-testimonial-${activeItem.id}`}
                      disabled={
                        testimonials.items.length <= 1 ||
                        (activeItem.published && publishedCount <= 1)
                      }
                      onClick={() => handleDeleteTestimonial(activeItem)}
                      aria-label={`Удалить отзыв ${activeItem.authorName}`}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#DC2626]/25 text-xs font-semibold text-[#DC2626] dark:text-[#F87171] hover:bg-[#DC2626]/8 disabled:opacity-35 inline-flex items-center gap-1.5 cursor-pointer disabled:cursor-default whitespace-nowrap shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Удалить</span>
                    </button>
                  </div>
                </div>

                {/* Author & Organization */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  <div className="sm:col-span-6 space-y-1.5">
                    <label
                      htmlFor="cms-testimonial-author-name"
                      className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
                    >
                      Имя и фамилия спикера
                    </label>
                    <input
                      id="cms-testimonial-author-name"
                      data-testid="cms-testimonial-author-name"
                      type="text"
                      value={activeItem.authorName}
                      onChange={(e) => {
                        const nextName = e.target.value;
                        const prevAuto = deriveAuthorInitials(activeItem.authorName);
                        const shouldSyncInitials =
                          !activeItem.initials || activeItem.initials === prevAuto;
                        patchItem(activeItem.id, {
                          authorName: nextName,
                          ...(shouldSyncInitials
                            ? { initials: deriveAuthorInitials(nextName) }
                            : {}),
                        });
                      }}
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-sm text-[#111111] dark:text-[#F4F3EF]"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label
                      htmlFor="cms-testimonial-initials"
                      className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
                    >
                      Инициалы
                    </label>
                    <input
                      id="cms-testimonial-initials"
                      type="text"
                      maxLength={4}
                      value={activeItem.initials}
                      onChange={(e) =>
                        patchItem(activeItem.id, {
                          initials: e.target.value.toUpperCase(),
                        })
                      }
                      className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-sm font-bold text-center text-[#111111] dark:text-[#F4F3EF]"
                    />
                  </div>

                  <div className="sm:col-span-4 space-y-1.5">
                    <label
                      htmlFor="cms-testimonial-category"
                      className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
                    >
                      Отраслевая рубрика
                    </label>
                    <select
                      id="cms-testimonial-category"
                      data-testid="cms-testimonial-category"
                      value={activeItem.category}
                      onChange={(e) =>
                        patchItem(activeItem.id, {
                          category: e.target.value as TestimonialIndustryKey,
                        })
                      }
                      className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-sm text-[#111111] dark:text-[#F4F3EF]"
                    >
                      {CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-6 space-y-1.5">
                    <label
                      htmlFor="cms-testimonial-role"
                      className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
                    >
                      Должность спикера
                    </label>
                    <input
                      id="cms-testimonial-role"
                      type="text"
                      value={activeItem.authorRole}
                      onChange={(e) =>
                        patchItem(activeItem.id, { authorRole: e.target.value })
                      }
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-sm text-[#111111] dark:text-[#F4F3EF]"
                    />
                  </div>

                  <div className="sm:col-span-6 space-y-1.5">
                    <label
                      htmlFor="cms-testimonial-company"
                      className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
                    >
                      Компания или бренд
                    </label>
                    <input
                      id="cms-testimonial-company"
                      data-testid="cms-testimonial-company"
                      type="text"
                      value={activeItem.company}
                      onChange={(e) =>
                        patchItem(activeItem.id, { company: e.target.value })
                      }
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-sm text-[#111111] dark:text-[#F4F3EF]"
                    />
                  </div>
                </div>

                {/* Metadata & Provenance */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="cms-testimonial-project-meta"
                      className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
                    >
                      Формат и хронометраж (через ·)
                    </label>
                    <input
                      id="cms-testimonial-project-meta"
                      type="text"
                      value={activeItem.projectMeta}
                      onChange={(e) =>
                        patchItem(activeItem.id, { projectMeta: e.target.value })
                      }
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-sm text-[#111111] dark:text-[#F4F3EF]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="cms-testimonial-provenance"
                      className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
                    >
                      Подтверждение (ЭДО / паспорта / эфир)
                    </label>
                    <input
                      id="cms-testimonial-provenance"
                      type="text"
                      value={activeItem.verifiedProvenance}
                      onChange={(e) =>
                        patchItem(activeItem.id, {
                          verifiedProvenance: e.target.value,
                        })
                      }
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-sm text-[#111111] dark:text-[#F4F3EF]"
                    />
                  </div>
                </div>

                {/* Quote */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="cms-testimonial-quote"
                    className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
                  >
                    Текст отзыва (задача до обращения → что сделала студия → результат)
                  </label>
                  <textarea
                    id="cms-testimonial-quote"
                    data-testid="cms-testimonial-quote"
                    rows={4}
                    value={activeItem.quote}
                    onChange={(e) =>
                      patchItem(activeItem.id, { quote: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-sm leading-relaxed text-[#111111] dark:text-[#F4F3EF]"
                  />
                </div>

                {/* Quantified Outcome */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  <div className="sm:col-span-5 space-y-1.5">
                    <label
                      htmlFor="cms-testimonial-outcome-metric"
                      className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
                    >
                      Измеримый показатель
                    </label>
                    <input
                      id="cms-testimonial-outcome-metric"
                      data-testid="cms-testimonial-outcome-metric"
                      type="text"
                      value={activeItem.outcomeMetric}
                      onChange={(e) =>
                        patchItem(activeItem.id, {
                          outcomeMetric: e.target.value,
                        })
                      }
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]"
                    />
                  </div>

                  <div className="sm:col-span-7 space-y-1.5">
                    <label
                      htmlFor="cms-testimonial-outcome-context"
                      className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
                    >
                      Контекст и период результата
                    </label>
                    <input
                      id="cms-testimonial-outcome-context"
                      type="text"
                      value={activeItem.outcomeContext}
                      onChange={(e) =>
                        patchItem(activeItem.id, {
                          outcomeContext: e.target.value,
                        })
                      }
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-sm text-[#111111] dark:text-[#F4F3EF]"
                    />
                  </div>
                </div>

                {/* Audio Case Link & Related Navigation */}
                <div className="pt-4 border-t border-[#111111]/10 dark:border-white/10 grid grid-cols-1 sm:grid-cols-12 gap-4">
                  <div className="sm:col-span-5 space-y-1.5">
                    <label
                      htmlFor="cms-testimonial-linked-case"
                      className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
                    >
                      Аудиоролик из портфолио в карточке
                    </label>
                    <select
                      id="cms-testimonial-linked-case"
                      value={activeItem.linkedCaseId ?? ''}
                      onChange={(e) => {
                        const nextCaseId = e.target.value || undefined;
                        const updates: Partial<ClientTestimonialCmsRecord> = {
                          linkedCaseId: nextCaseId,
                        };
                        if (
                          nextCaseId &&
                          (activeItem.relatedHref === '#work' ||
                            activeItem.relatedHref.startsWith('#case-'))
                        ) {
                          updates.relatedHref = `#case-${nextCaseId}`;
                        }
                        patchItem(activeItem.id, updates);
                      }}
                      className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-sm text-[#111111] dark:text-[#F4F3EF]"
                    >
                      <option value="">Без кнопки аудиоплеера</option>
                      {availableAudioCases.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.client} ({c.durationSec} сек)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-4 space-y-1.5">
                    <label
                      htmlFor="cms-testimonial-related-label"
                      className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
                    >
                      Подпись ссылки на разбор
                    </label>
                    <input
                      id="cms-testimonial-related-label"
                      type="text"
                      value={activeItem.relatedLabel}
                      onChange={(e) =>
                        patchItem(activeItem.id, {
                          relatedLabel: e.target.value,
                        })
                      }
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-sm text-[#111111] dark:text-[#F4F3EF]"
                    />
                  </div>

                  <div className="sm:col-span-3 space-y-1.5">
                    <label
                      htmlFor="cms-testimonial-related-href"
                      className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
                    >
                      Внутренний адрес
                    </label>
                    <input
                      id="cms-testimonial-related-href"
                      type="text"
                      value={activeItem.relatedHref}
                      onChange={(e) =>
                        patchItem(activeItem.id, {
                          relatedHref: e.target.value,
                        })
                      }
                      className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-sm font-mono text-[#111111] dark:text-[#F4F3EF]"
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Section Header Copy & Trust Metrics Editor */}
      <section
        aria-labelledby="admin-testimonials-copy-heading"
        className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-5 sm:p-6 space-y-6"
      >
        <div className="space-y-0.5 pb-4 border-b border-[#111111]/10 dark:border-white/10">
          <h2
            id="admin-testimonials-copy-heading"
            className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]"
          >
            Заголовок секции, показатели доверия и призыв к действию
          </h2>
          <p className="text-xs text-[#111111]/56 dark:text-[#F4F3EF]/56">
            Управляет вводной шапкой секции отзывов, цифрами надёжности продакшна и нижней строкой быстрого заказа на главной странице.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="cms-testimonials-eyebrow"
              className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
            >
              Надзаголовок секции
            </label>
            <input
              id="cms-testimonials-eyebrow"
              type="text"
              value={testimonials.eyebrow}
              onChange={(e) => patchConfig({ eyebrow: e.target.value })}
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-sm text-[#111111] dark:text-[#F4F3EF]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="cms-testimonials-heading-primary"
              className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
            >
              Первая строка заголовка H2
            </label>
            <input
              id="cms-testimonials-heading-primary"
              data-testid="cms-testimonials-heading-primary"
              type="text"
              value={testimonials.headingPrimary}
              onChange={(e) => patchConfig({ headingPrimary: e.target.value })}
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="cms-testimonials-heading-muted"
              className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
            >
              Вторая строка заголовка (акцент полутоном)
            </label>
            <input
              id="cms-testimonials-heading-muted"
              type="text"
              value={testimonials.headingMuted}
              onChange={(e) => patchConfig({ headingMuted: e.target.value })}
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-sm text-[#111111] dark:text-[#F4F3EF]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="cms-testimonials-subheading"
            className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
          >
            Подзаголовок секции
          </label>
          <textarea
            id="cms-testimonials-subheading"
            rows={2}
            value={testimonials.subheading}
            onChange={(e) => patchConfig({ subheading: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-sm text-[#111111] dark:text-[#F4F3EF]"
          />
        </div>

        {/* Quantified Trust Metrics */}
        <div className="pt-4 border-t border-[#111111]/10 dark:border-white/10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-[#111111] dark:text-[#F4F3EF]">
              Цифры доверия над отзывами ({testimonials.trustMetrics.length}/4)
            </h3>
            <button
              type="button"
              disabled={testimonials.trustMetrics.length >= 4}
              onClick={handleAddTrustMetric}
              className="min-h-[34px] px-3 py-1.5 rounded-lg border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] hover:border-[#FF4820] disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer disabled:cursor-default whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Добавить показатель</span>
            </button>
          </div>

          <div className="space-y-3">
            {testimonials.trustMetrics.map((metric, idx) => (
              <div
                key={metric.id}
                className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
              >
                <div className="sm:col-span-3 space-y-1">
                  <label
                    htmlFor={`cms-trust-metric-val-${metric.id}`}
                    className="block text-xs font-medium text-[#111111]/65 dark:text-[#F4F3EF]/65"
                  >
                    Значение #{idx + 1}
                  </label>
                  <input
                    id={`cms-trust-metric-val-${metric.id}`}
                    type="text"
                    value={metric.value}
                    onChange={(e) =>
                      handleMetricChange(metric.id, { value: e.target.value })
                    }
                    className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-sm font-bold tabular-nums text-[#111111] dark:text-[#F4F3EF]"
                  />
                </div>

                <div className="sm:col-span-8 space-y-1">
                  <label
                    htmlFor={`cms-trust-metric-lbl-${metric.id}`}
                    className="block text-xs font-medium text-[#111111]/65 dark:text-[#F4F3EF]/65"
                  >
                    Пояснение показателя #{idx + 1}
                  </label>
                  <input
                    id={`cms-trust-metric-lbl-${metric.id}`}
                    type="text"
                    value={metric.label}
                    onChange={(e) =>
                      handleMetricChange(metric.id, { label: e.target.value })
                    }
                    className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-sm text-[#111111] dark:text-[#F4F3EF]"
                  />
                </div>

                <div className="sm:col-span-1 flex justify-end">
                  <button
                    type="button"
                    disabled={testimonials.trustMetrics.length <= 1}
                    onClick={() => handleRemoveTrustMetric(metric.id)}
                    aria-label={`Удалить показатель ${metric.value}`}
                    className="w-10 h-10 rounded-xl border border-[#111111]/12 dark:border-white/12 inline-flex items-center justify-center text-[#111111]/60 dark:text-[#F4F3EF]/60 hover:text-[#DC2626] disabled:opacity-30 cursor-pointer disabled:cursor-default"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Conversion Strip Copy */}
        <div className="pt-4 border-t border-[#111111]/10 dark:border-white/10 grid grid-cols-1 sm:grid-cols-12 gap-4">
          <div className="sm:col-span-8 space-y-1.5">
            <label
              htmlFor="cms-testimonials-cta-prompt"
              className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
            >
              Вопрос перед кнопкой заказа под отзывами
            </label>
            <input
              id="cms-testimonials-cta-prompt"
              type="text"
              value={testimonials.ctaPrompt}
              onChange={(e) => patchConfig({ ctaPrompt: e.target.value })}
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-sm text-[#111111] dark:text-[#F4F3EF]"
            />
          </div>

          <div className="sm:col-span-4 space-y-1.5">
            <label
              htmlFor="cms-testimonials-cta-button"
              className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
            >
              Текст кнопки действия
            </label>
            <input
              id="cms-testimonials-cta-button"
              type="text"
              value={testimonials.ctaButtonLabel}
              onChange={(e) => patchConfig({ ctaButtonLabel: e.target.value })}
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
