import {
  ArrowDown,
  ArrowUp,
  Download,
  FileUp,
  ImagePlus,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { ChangeEvent, useRef, useState } from 'react';
import { UploadedImageResult } from '../../cms/studioCmsStore';
import { FaqItem } from '../../data/faqData';
import { EditorialPricingRow } from '../../data/pricingData';
import {
  formatPriceRub,
  NeuroApproachConfig,
  SiteCopyCmsConfig,
  StudioCmsSnapshot,
  validateAndNormalizeCmsSnapshot,
} from '../../data/studioCmsTypes';

type CopySubTab = 'neuro' | 'hero' | 'pricing' | 'faq' | 'backup';

interface AdminSiteCopyPanelProps {
  draft: StudioCmsSnapshot;
  onChangeNeuroApproach: (nextNeuro: NeuroApproachConfig) => void;
  onChangeSiteCopy: (nextCopy: SiteCopyCmsConfig) => void;
  onImportSnapshot: (nextSnapshot: StudioCmsSnapshot) => void;
  onResetToDefaults: () => Promise<void>;
  onUploadImage: (
    file: File
  ) => Promise<{ ok: true; result: UploadedImageResult } | { ok: false; error: string }>;
}

export function AdminSiteCopyPanel({
  draft,
  onChangeNeuroApproach,
  onChangeSiteCopy,
  onImportSnapshot,
  onResetToDefaults,
  onUploadImage,
}: AdminSiteCopyPanelProps) {
  const [subTab, setSubTab] = useState<CopySubTab>('neuro');
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: 'ok' | 'error';
    text: string;
  } | null>(null);

  const importFileRef = useRef<HTMLInputElement | null>(null);
  const studioPhotoFileRef = useRef<HTMLInputElement | null>(null);

  const { neuroApproach, siteCopy } = draft;

  const handleStudioPhotoPicked = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsUploadingPhoto(true);
    setFeedback(null);
    const res = await onUploadImage(file);
    setIsUploadingPhoto(false);

    if (!res.ok) {
      setFeedback({ kind: 'error', text: res.error });
      return;
    }

    onChangeNeuroApproach({
      ...neuroApproach,
      studioPhotoUrl: res.result.url,
    });
    setFeedback({
      kind: 'ok',
      text: `Фотография студии «${res.result.fileName}» загружена.`,
    });
  };

  const updatePricingRow = (
    index: number,
    patch: Partial<EditorialPricingRow>
  ) => {
    const nextRows = siteCopy.pricingRows.map((row, idx) => {
      if (idx !== index) return row;
      const nextPrice =
        typeof patch.priceRub === 'number' && Number.isFinite(patch.priceRub)
          ? Math.max(1000, Math.round(patch.priceRub))
          : row.priceRub;
      return {
        ...row,
        ...patch,
        priceRub: nextPrice,
        priceFormatted: formatPriceRub(nextPrice),
      };
    });
    onChangeSiteCopy({ ...siteCopy, pricingRows: nextRows });
  };

  const updateFaqAt = (index: number, patch: Partial<FaqItem>) => {
    const nextFaq = siteCopy.faqItems.map((item, idx) =>
      idx === index ? { ...item, ...patch } : item
    );
    onChangeSiteCopy({ ...siteCopy, faqItems: nextFaq });
  };

  const handleAddFaqItem = () => {
    const nextNum = siteCopy.faqItems.length + 1;
    const newItem: FaqItem = {
      id: `faq-custom-${Date.now().toString(36).slice(-5)}`,
      indexLabel: String(nextNum).padStart(2, '0'),
      question: 'Новый вопрос клиента о сроках или правах?',
      answer:
        'Подробный и прозрачный ответ студии без мелкого шрифта и сложных технических терминов.',
    };
    onChangeSiteCopy({
      ...siteCopy,
      faqItems: [...siteCopy.faqItems, newItem],
    });
  };

  const handleMoveFaq = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= siteCopy.faqItems.length) return;
    const copy = [...siteCopy.faqItems];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    onChangeSiteCopy({
      ...siteCopy,
      faqItems: copy.map((fq, idx) => ({
        ...fq,
        indexLabel: String(idx + 1).padStart(2, '0'),
      })),
    });
  };

  const handleDeleteFaq = (index: number) => {
    if (siteCopy.faqItems.length <= 1) return;
    const remaining = siteCopy.faqItems
      .filter((_, idx) => idx !== index)
      .map((fq, idx) => ({
        ...fq,
        indexLabel: String(idx + 1).padStart(2, '0'),
      }));
    onChangeSiteCopy({ ...siteCopy, faqItems: remaining });
  };

  const handleExportJson = () => {
    const payload = JSON.stringify(draft, null, 2);
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audioworks-cms-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFeedback({
      kind: 'ok',
      text: 'Резервная копия студийной CMS скачана в формате .json.',
    });
  };

  const handleImportJson = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setFeedback(null);
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const validated = validateAndNormalizeCmsSnapshot(parsed);
      if (!validated.ok) {
        setFeedback({ kind: 'error', text: validated.error });
        return;
      }
      onImportSnapshot(validated.data);
      setFeedback({
        kind: 'ok',
        text: 'Снимок CMS успешно загружен в черновик. Нажмите «Сохранить и опубликовать», чтобы применить изменения на сайте.',
      });
    } catch {
      setFeedback({
        kind: 'error',
        text: 'Не удалось прочитать JSON-файл резервной копии.',
      });
    }
  };

  const handleExecuteReset = async () => {
    setIsResetting(true);
    setFeedback(null);
    await onResetToDefaults();
    setIsResetting(false);
    setConfirmingReset(false);
    setFeedback({
      kind: 'ok',
      text: 'Все тексты, дуэль и портфолио возвращены к заводскому эталону студии AudioWorks.',
    });
  };

  const SUB_TABS: { id: CopySubTab; label: string }[] = [
    { id: 'neuro', label: 'Блок ЦНС и исследований' },
    { id: 'hero', label: 'Первый экран и манифест' },
    { id: 'pricing', label: 'Тарифы и стоимость' },
    { id: 'faq', label: 'Частые вопросы (FAQ)' },
    { id: 'backup', label: 'Резервная копия и сброс' },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-navigation bar */}
      <div
        role="tablist"
        aria-label="Разделы текстов сайта"
        className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10"
      >
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={subTab === tab.id}
            onClick={() => {
              setSubTab(tab.id);
              setFeedback(null);
              setConfirmingReset(false);
            }}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              subTab === tab.id
                ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                : 'text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#111111] dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {feedback && (
        <div
          role="status"
          className={`px-4 py-3 rounded-xl text-xs font-medium border ${
            feedback.kind === 'ok'
              ? 'bg-[#16A34A]/10 border-[#16A34A]/30 text-[#15803D] dark:text-[#4ADE80]'
              : 'bg-[#DC2626]/10 border-[#DC2626]/30 text-[#DC2626] dark:text-[#F87171]'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* 1. CNS / Neuroscience & Studio Approach Editor */}
      {subTab === 'neuro' && (
        <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-6 sm:p-8 space-y-8">
          <div className="space-y-4 pb-6 border-b border-[#111111]/10 dark:border-white/10">
            <div>
              <h2 className="text-base font-bold text-[#111111] dark:text-[#F4F3EF]">
                Главный тезис про эфирный шум и восприятие мозга
              </h2>
              <p className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60">
                Посыл секции: радиостанция даёт охват аудитории, а продакшн отвечает за то, чтобы мозг не отфильтровал ролик как фоновый шум.
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="neuro-eyebrow"
                className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
              >
                Надзаголовок секции
              </label>
              <input
                id="neuro-eyebrow"
                type="text"
                value={neuroApproach.eyebrow}
                onChange={(e) =>
                  onChangeNeuroApproach({
                    ...neuroApproach,
                    eyebrow: e.target.value,
                  })
                }
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="neuro-thesis"
                className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
              >
                Главный крупный тезис
              </label>
              <textarea
                id="neuro-thesis"
                rows={2}
                value={neuroApproach.thesis}
                onChange={(e) =>
                  onChangeNeuroApproach({
                    ...neuroApproach,
                    thesis: e.target.value,
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm font-semibold leading-relaxed text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="neuro-lead"
                className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
              >
                Поясняющий абзац (маркетингово и без воды про фильтр внимания ЦНС)
              </label>
              <textarea
                id="neuro-lead"
                rows={3}
                value={neuroApproach.leadParagraph}
                onChange={(e) =>
                  onChangeNeuroApproach({
                    ...neuroApproach,
                    leadParagraph: e.target.value,
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm leading-relaxed text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              />
            </div>
          </div>

          {/* Studies Proof Cards */}
          <div className="space-y-5 pb-6 border-b border-[#111111]/10 dark:border-white/10">
            <div>
              <h3 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                Карточки исследований внимания и памяти
              </h3>
              <p className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60">
                Реальные отраслевые замеры (Neuro-Insight, System1), подтверждающие тезис цифрами.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {neuroApproach.studies.map((study, idx) => (
                <div
                  key={study.id}
                  className="p-5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-4 space-y-1">
                      <label className="block text-xs font-semibold text-[#111111]/70 dark:text-[#F4F3EF]/70">
                        Цифра ({idx + 1})
                      </label>
                      <input
                        type="text"
                        value={study.metricValue}
                        onChange={(e) => {
                          const nextStudies = neuroApproach.studies.map((s, i) =>
                            i === idx ? { ...s, metricValue: e.target.value } : s
                          );
                          onChangeNeuroApproach({
                            ...neuroApproach,
                            studies: nextStudies,
                          });
                        }}
                        className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/14 dark:border-white/14 text-sm font-bold tabular-nums text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                      />
                    </div>

                    <div className="sm:col-span-8 space-y-1">
                      <label className="block text-xs font-semibold text-[#111111]/70 dark:text-[#F4F3EF]/70">
                        Источник исследования
                      </label>
                      <input
                        type="text"
                        value={study.sourceLabel}
                        onChange={(e) => {
                          const nextStudies = neuroApproach.studies.map((s, i) =>
                            i === idx ? { ...s, sourceLabel: e.target.value } : s
                          );
                          onChangeNeuroApproach({
                            ...neuroApproach,
                            studies: nextStudies,
                          });
                        }}
                        className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/14 dark:border-white/14 text-xs text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-[#111111]/70 dark:text-[#F4F3EF]/70">
                      Подпись метрики
                    </label>
                    <input
                      type="text"
                      value={study.metricCaption}
                      onChange={(e) => {
                        const nextStudies = neuroApproach.studies.map((s, i) =>
                          i === idx ? { ...s, metricCaption: e.target.value } : s
                        );
                        onChangeNeuroApproach({
                          ...neuroApproach,
                          studies: nextStudies,
                        });
                      }}
                      className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-[#111111]/70 dark:text-[#F4F3EF]/70">
                      Дополнительный показатель
                    </label>
                    <input
                      type="text"
                      value={study.secondaryStat}
                      onChange={(e) => {
                        const nextStudies = neuroApproach.studies.map((s, i) =>
                          i === idx ? { ...s, secondaryStat: e.target.value } : s
                        );
                        onChangeNeuroApproach({
                          ...neuroApproach,
                          studies: nextStudies,
                        });
                      }}
                      className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/14 dark:border-white/14 text-xs tabular-nums text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-[#111111]/70 dark:text-[#F4F3EF]/70">
                      Краткое объяснение простым языком
                    </label>
                    <textarea
                      rows={3}
                      value={study.summary}
                      onChange={(e) => {
                        const nextStudies = neuroApproach.studies.map((s, i) =>
                          i === idx ? { ...s, summary: e.target.value } : s
                        );
                        onChangeNeuroApproach({
                          ...neuroApproach,
                          studies: nextStudies,
                        });
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/14 dark:border-white/14 text-xs leading-relaxed text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3 Studio Pillars */}
          <div className="space-y-4 pb-6 border-b border-[#111111]/10 dark:border-white/10">
            <h3 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
              Три принципа работы студии (01–03)
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {neuroApproach.pillars.map((pillar, idx) => (
                <div
                  key={pillar.number}
                  className="p-4 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10 space-y-3"
                >
                  <div className="text-xs font-semibold text-[#FF4820] tabular-nums">
                    Принцип {pillar.number}
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-[#111111]/70 dark:text-[#F4F3EF]/70">
                      Заголовок
                    </label>
                    <input
                      type="text"
                      value={pillar.title}
                      onChange={(e) => {
                        const nextPillars = neuroApproach.pillars.map((p, i) =>
                          i === idx ? { ...p, title: e.target.value } : p
                        );
                        onChangeNeuroApproach({
                          ...neuroApproach,
                          pillars: nextPillars,
                        });
                      }}
                      className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-[#111111]/70 dark:text-[#F4F3EF]/70">
                      Текст
                    </label>
                    <textarea
                      rows={4}
                      value={pillar.body}
                      onChange={(e) => {
                        const nextPillars = neuroApproach.pillars.map((p, i) =>
                          i === idx ? { ...p, body: e.target.value } : p
                        );
                        onChangeNeuroApproach({
                          ...neuroApproach,
                          pillars: nextPillars,
                        });
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/14 dark:border-white/14 text-xs leading-relaxed text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Studio Photo & Caption */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                Фотография студии и подпись контроля качества
              </h3>
              <div>
                <input
                  ref={studioPhotoFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={handleStudioPhotoPicked}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isUploadingPhoto}
                  onClick={() => studioPhotoFileRef.current?.click()}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ImagePlus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{isUploadingPhoto ? 'Загрузка…' : 'Сменить фото студии'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75">
                  Подпись рубрики на фото
                </label>
                <input
                  type="text"
                  value={neuroApproach.studioPhotoKicker}
                  onChange={(e) =>
                    onChangeNeuroApproach({
                      ...neuroApproach,
                      studioPhotoKicker: e.target.value,
                    })
                  }
                  className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75">
                  Текст подписи на кадре
                </label>
                <input
                  type="text"
                  value={neuroApproach.studioPhotoCaption}
                  onChange={(e) =>
                    onChangeNeuroApproach({
                      ...neuroApproach,
                      studioPhotoCaption: e.target.value,
                    })
                  }
                  className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Hero & Manifesto Copy */}
      {subTab === 'hero' && (
        <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-6 sm:p-8 space-y-5">
          <div>
            <h2 className="text-base font-bold text-[#111111] dark:text-[#F4F3EF]">
              Первый экран (линза краш-теста) и манифест студии
            </h2>
            <p className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60">
              Управляйте заголовком интерактивного стенда и основным абзацем манифеста под сценой.
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="hero-clutter-kicker"
              className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
            >
              Надзаголовок в режиме «Серый эфирный блок»
            </label>
            <input
              id="hero-clutter-kicker"
              type="text"
              value={siteCopy.heroLensClutterKicker}
              onChange={(e) =>
                onChangeSiteCopy({
                  ...siteCopy,
                  heroLensClutterKicker: e.target.value,
                })
              }
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="hero-clutter-headline"
              className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
            >
              Главный заголовок внутри интерактивной сцены
            </label>
            <input
              id="hero-clutter-headline"
              type="text"
              value={siteCopy.heroLensClutterHeadline}
              onChange={(e) =>
                onChangeSiteCopy({
                  ...siteCopy,
                  heroLensClutterHeadline: e.target.value,
                })
              }
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm font-semibold text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="hero-manifesto-lead"
              className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
            >
              Текст манифеста студии под первым экраном
            </label>
            <textarea
              id="hero-manifesto-lead"
              rows={4}
              value={siteCopy.heroManifestoLead}
              onChange={(e) =>
                onChangeSiteCopy({
                  ...siteCopy,
                  heroManifestoLead: e.target.value,
                })
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm leading-relaxed text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
            />
          </div>
        </div>
      )}

      {/* 3. Pricing Formats & Rates */}
      {subTab === 'pricing' && (
        <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6 border-b border-[#111111]/10 dark:border-white/10">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75">
                Надзаголовок секции стоимости
              </label>
              <input
                type="text"
                value={siteCopy.pricingEyebrow}
                onChange={(e) =>
                  onChangeSiteCopy({ ...siteCopy, pricingEyebrow: e.target.value })
                }
                className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75">
                Подзаголовок (про договор и ЭДО)
              </label>
              <input
                type="text"
                value={siteCopy.pricingSubheading}
                onChange={(e) =>
                  onChangeSiteCopy({
                    ...siteCopy,
                    pricingSubheading: e.target.value,
                  })
                }
                className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75">
                Первая часть заголовка
              </label>
              <input
                type="text"
                value={siteCopy.pricingHeadingPrimary}
                onChange={(e) =>
                  onChangeSiteCopy({
                    ...siteCopy,
                    pricingHeadingPrimary: e.target.value,
                  })
                }
                className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm font-semibold text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75">
                Вторая часть заголовка (полутоном)
              </label>
              <input
                type="text"
                value={siteCopy.pricingHeadingMuted}
                onChange={(e) =>
                  onChangeSiteCopy({
                    ...siteCopy,
                    pricingHeadingMuted: e.target.value,
                  })
                }
                className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              />
            </div>
          </div>

          <div className="space-y-4">
            {siteCopy.pricingRows.map((row, idx) => (
              <div
                key={row.id}
                className="p-5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10 space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-4 space-y-1">
                    <label className="block text-xs font-semibold text-[#111111]/70 dark:text-[#F4F3EF]/70">
                      Название формата
                    </label>
                    <input
                      type="text"
                      value={row.title}
                      onChange={(e) =>
                        updatePricingRow(idx, { title: e.target.value })
                      }
                      className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/14 dark:border-white/14 text-sm font-semibold text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                    />
                  </div>

                  <div className="sm:col-span-3 space-y-1">
                    <label className="block text-xs font-semibold text-[#111111]/70 dark:text-[#F4F3EF]/70">
                      Стоимость (₽)
                    </label>
                    <input
                      type="number"
                      min={1000}
                      step={1000}
                      value={row.priceRub}
                      onChange={(e) =>
                        updatePricingRow(idx, {
                          priceRub: Math.max(1000, Number(e.target.value) || 15000),
                        })
                      }
                      className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/14 dark:border-white/14 text-sm font-bold tabular-nums text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="block text-xs font-semibold text-[#111111]/70 dark:text-[#F4F3EF]/70">
                      Срок сдачи
                    </label>
                    <input
                      type="text"
                      value={row.turnaround}
                      onChange={(e) =>
                        updatePricingRow(idx, { turnaround: e.target.value })
                      }
                      className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/14 dark:border-white/14 text-xs tabular-nums text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                    />
                  </div>

                  <div className="sm:col-span-3 space-y-1">
                    <label className="block text-xs font-semibold text-[#111111]/70 dark:text-[#F4F3EF]/70">
                      Пометка (необязательно)
                    </label>
                    <input
                      type="text"
                      value={row.badgeHit ?? ''}
                      onChange={(e) =>
                        updatePricingRow(idx, {
                          badgeHit: e.target.value.trim() || undefined,
                        })
                      }
                      placeholder="Основной формат"
                      className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/14 dark:border-white/14 text-xs text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#111111]/70 dark:text-[#F4F3EF]/70">
                    Что входит в смету ({row.priceFormatted})
                  </label>
                  <textarea
                    rows={2}
                    value={row.description}
                    onChange={(e) =>
                      updatePricingRow(idx, { description: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/14 dark:border-white/14 text-xs leading-relaxed text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. FAQ Editor */}
      {subTab === 'faq' && (
        <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-[#111111]/10 dark:border-white/10">
            <div>
              <h2 className="text-base font-bold text-[#111111] dark:text-[#F4F3EF]">
                Частые вопросы клиентов ({siteCopy.faqItems.length})
              </h2>
              <p className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60">
                Добавляйте, переставляйте и редактируйте ответы без технических штампов.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddFaqItem}
              className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] hover:bg-[#FF4820] dark:hover:bg-[#FF4820] dark:hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Добавить вопрос</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75">
                Надзаголовок FAQ
              </label>
              <input
                type="text"
                value={siteCopy.faqEyebrow}
                onChange={(e) =>
                  onChangeSiteCopy({ ...siteCopy, faqEyebrow: e.target.value })
                }
                className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75">
                Заголовок FAQ
              </label>
              <input
                type="text"
                value={siteCopy.faqHeading}
                onChange={(e) =>
                  onChangeSiteCopy({ ...siteCopy, faqHeading: e.target.value })
                }
                className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75">
                Подзаголовок FAQ
              </label>
              <input
                type="text"
                value={siteCopy.faqSubheading}
                onChange={(e) =>
                  onChangeSiteCopy({ ...siteCopy, faqSubheading: e.target.value })
                }
                className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              />
            </div>
          </div>

          <div className="space-y-4">
            {siteCopy.faqItems.map((item, idx) => (
              <div
                key={item.id}
                className="p-5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-[#FF4820] tabular-nums">
                    Вопрос {item.indexLabel}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveFaq(idx, -1)}
                      aria-label={`Поднять вопрос ${item.indexLabel} выше`}
                      className="w-7 h-7 rounded-md border border-[#111111]/12 dark:border-white/12 inline-flex items-center justify-center text-[#111111]/65 dark:text-[#F4F3EF]/65 disabled:opacity-30 cursor-pointer disabled:cursor-default"
                    >
                      <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === siteCopy.faqItems.length - 1}
                      onClick={() => handleMoveFaq(idx, 1)}
                      aria-label={`Опустить вопрос ${item.indexLabel} ниже`}
                      className="w-7 h-7 rounded-md border border-[#111111]/12 dark:border-white/12 inline-flex items-center justify-center text-[#111111]/65 dark:text-[#F4F3EF]/65 disabled:opacity-30 cursor-pointer disabled:cursor-default"
                    >
                      <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    {siteCopy.faqItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteFaq(idx)}
                        aria-label={`Удалить вопрос ${item.indexLabel}`}
                        className="w-7 h-7 rounded-md border border-[#DC2626]/25 inline-flex items-center justify-center text-[#DC2626] dark:text-[#F87171] hover:bg-[#DC2626]/10 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>

                <input
                  type="text"
                  aria-label={`Формулировка вопроса ${item.indexLabel}`}
                  value={item.question}
                  onChange={(e) => updateFaqAt(idx, { question: e.target.value })}
                  className="w-full min-h-[40px] px-3.5 py-2 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/14 dark:border-white/14 text-sm font-semibold text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                />

                <textarea
                  rows={3}
                  aria-label={`Ответ на вопрос ${item.indexLabel}`}
                  value={item.answer}
                  onChange={(e) => updateFaqAt(idx, { answer: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/14 dark:border-white/14 text-xs leading-relaxed text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Backup JSON Export / Import & 2-Step Factory Reset */}
      {subTab === 'backup' && (
        <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[#111111] dark:text-[#F4F3EF]">
              Резервное копирование и возврат к эталону студии
            </h2>
            <p className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60">
              Сохраните полный снимок настроек на компьютер в один файл .json или верните заводские тексты и кейсы AudioWorks.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pb-6 border-b border-[#111111]/10 dark:border-white/10">
            <button
              type="button"
              onClick={handleExportJson}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] hover:bg-[#FF4820] dark:hover:bg-[#FF4820] dark:hover:text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Экспортировать снимок (.json)</span>
            </button>

            <input
              ref={importFileRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportJson}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => importFileRef.current?.click()}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileUp className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Импортировать из .json</span>
            </button>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
              Сброс к заводскому эталону AudioWorks
            </h3>
            <p className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60 max-w-2xl">
              Восстанавливает исходное портфолио, дуэль «Зерно и Свет», блок исследований внимания ЦНС, тарифы и FAQ на сервере.
            </p>

            {!confirmingReset ? (
              <button
                type="button"
                data-testid="admin-reset-trigger-btn"
                onClick={() => setConfirmingReset(true)}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-[#DC2626]/35 text-[#DC2626] dark:text-[#F87171] hover:bg-[#DC2626]/10 text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Сбросить к эталону студии</span>
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-[#DC2626]/8 border border-[#DC2626]/25">
                <span className="text-xs font-semibold text-[#DC2626] dark:text-[#F87171]">
                  Подтвердите сброс всех пользовательских правок к эталону:
                </span>
                <button
                  type="button"
                  disabled={isResetting}
                  data-testid="admin-reset-confirm-btn"
                  onClick={handleExecuteReset}
                  className="min-h-[38px] px-4 py-1.5 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {isResetting ? 'Сброс…' : 'Да, вернуть эталон студии'}
                </button>
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={() => setConfirmingReset(false)}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-[#111111]/16 dark:border-white/16 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                >
                  Отмена
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
