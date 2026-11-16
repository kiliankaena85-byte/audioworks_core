import { ArrowRight, Check, Mic2, Pause, Play, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CasePlayerSnapshot } from '../audio/lazyAudioEngines';
import type { BrandCasePoster } from '../data/casesData';
import type { IndustryVerticalSlug } from '../data/platformRouter';
import { getStudioFormatDisplayMeta, type OrderFormatId } from '../data/pricingData';
import {
  filterVoiceArchetypes,
  getVoiceArchetypeById,
  toVoiceDemoCasePoster,
  VOICE_ARCHETYPES_CATALOG,
  VOICE_CASTING_FILTER_TABS,
  type VoiceArchetypeId,
  type VoiceArchetypeSpec,
  type VoiceCastingFilterId,
} from '../data/voiceCastingCatalog';

interface EditorialVoiceCastingProps {
  mode?: 'editorial_section';
  selectedVoiceId: VoiceArchetypeId | null;
  playerSnap: CasePlayerSnapshot;
  onTogglePlayDemo: (poster: BrandCasePoster) => void;
  onWarmPlayer?: () => void;
  onSelectVoiceForOrder: (payload: {
    voiceId: VoiceArchetypeId;
    recommendedFormatId: OrderFormatId;
    mappedIndustrySlug: IndustryVerticalSlug | null;
  }) => void;
}

interface InlineOrderVoiceCastingProps {
  mode: 'inline_order';
  selectedVoiceId: VoiceArchetypeId | null;
  onChangeSelectedVoice: (voiceId: VoiceArchetypeId | null) => void;
}

export type VoiceCastingSectionProps =
  | EditorialVoiceCastingProps
  | InlineOrderVoiceCastingProps;

export function VoiceCastingSection(props: VoiceCastingSectionProps) {
  const [activeFilter, setActiveFilter] = useState<VoiceCastingFilterId>('all');
  const [isInlineOpen, setIsInlineOpen] = useState<boolean>(false);

  const filteredVoices = useMemo(
    () => filterVoiceArchetypes(activeFilter),
    [activeFilter]
  );

  const selectedVoiceSpec = useMemo(
    () => getVoiceArchetypeById(props.selectedVoiceId),
    [props.selectedVoiceId]
  );

  if (props.mode === 'inline_order') {
    return (
      <div
        data-testid="order-inline-voice-casting"
        className="rounded-2xl px-3.5 py-3 bg-[#EFECE5]/55 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 space-y-2.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <Mic2
              className="w-3.5 h-3.5 text-[#FF4820] shrink-0"
              aria-hidden="true"
            />
            {selectedVoiceSpec ? (
              <span className="text-[#111111] dark:text-[#F4F3EF]">
                Выбран референс голоса:{' '}
                <strong>
                  {selectedVoiceSpec.title} ({selectedVoiceSpec.code})
                </strong>
              </span>
            ) : (
              <span className="text-[#111111]/74 dark:text-[#F4F3EF]/74">
                Референс голоса дубляжа (по желанию — пришлём 3 живых кастинга)
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {selectedVoiceSpec && (
              <button
                type="button"
                data-testid="order-clear-voice-btn"
                onClick={() => props.onChangeSelectedVoice(null)}
                className="inline-flex items-center gap-1 text-xs text-[#111111]/55 dark:text-[#F4F3EF]/55 hover:text-[#FF4820] cursor-pointer whitespace-nowrap"
              >
                <X className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Сбросить</span>
              </button>
            )}
            <button
              type="button"
              data-testid="order-toggle-voice-picker-btn"
              aria-expanded={isInlineOpen}
              onClick={() => setIsInlineOpen((prev) => !prev)}
              className="font-semibold text-[#FF4820] hover:underline cursor-pointer whitespace-nowrap"
            >
              {isInlineOpen
                ? 'Скрыть базу голосов'
                : selectedVoiceSpec
                  ? 'Сменить тембр →'
                  : 'Выбрать тембр (6) →'}
            </button>
          </div>
        </div>

        {isInlineOpen && (
          <div className="pt-2.5 border-t border-[#111111]/10 dark:border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {VOICE_ARCHETYPES_CATALOG.map((voice) => {
              const isChosen = props.selectedVoiceId === voice.id;
              return (
                <button
                  key={voice.id}
                  type="button"
                  data-testid={`order-voice-option-${voice.id}`}
                  aria-pressed={isChosen}
                  onClick={() => {
                    props.onChangeSelectedVoice(isChosen ? null : voice.id);
                    setIsInlineOpen(false);
                  }}
                  className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                    isChosen
                      ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] border-transparent'
                      : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111] dark:text-[#F4F3EF] border-[#111111]/12 dark:border-white/12 hover:border-[#FF4820]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-bold tabular-nums">
                    <span className="truncate">{voice.title}</span>
                    <span className="opacity-65 shrink-0">{voice.code}</span>
                  </div>
                  <p className="text-[11px] opacity-72 mt-0.5 leading-snug">
                    {voice.genderLabel} · {voice.registerHzLabel} ·{' '}
                    {voice.bestForSectors}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <section
      id="voice-casting"
      data-testid="voice-casting-section"
      aria-labelledby="voice-casting-heading"
      onMouseEnter={props.onWarmPlayer}
      className="scroll-mt-24 py-20 sm:py-28 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10 px-4 sm:px-6 lg:px-12"
    >
      <div className="max-w-7xl mx-auto space-y-10 lg:space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-end">
          <div className="lg:col-span-8 space-y-3.5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm font-medium text-[#111111]/56 dark:text-[#F4F3EF]/56">
              <span>Кастинг голосов кинодубляжа</span>
              <span aria-hidden="true" className="opacity-40">
                ·
              </span>
              <span className="tabular-nums">Запись в тракте Neumann U87</span>
              <span aria-hidden="true" className="opacity-40">
                ·
              </span>
              <span>Закрепление тембра в КП и договоре</span>
            </div>

            <h2
              id="voice-casting-heading"
              className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.06] text-[#111111] dark:text-[#F4F3EF] editorial-balance"
            >
              Выберите эталонный тембр — и закрепите его за вашим роликом.
            </h2>
            <p className="text-base sm:text-lg text-[#111111]/70 dark:text-[#F4F3EF]/70 max-w-3xl editorial-pretty">
              Мы не работаем с потоковыми «радийными зазывалами». Послушайте характер
              актёрской подачи по рубрикам и прикрепите понравившийся архетип к заявке —
              продюсер подберёт 3 близких живых голоса под ваш сценарий.
            </p>
          </div>

          <div className="lg:col-span-4 lg:text-right text-xs sm:text-sm text-[#111111]/64 dark:text-[#F4F3EF]/64 tabular-nums">
            {selectedVoiceSpec ? (
              <p className="font-semibold text-[#FF4820]">
                В вашем заказе: {selectedVoiceSpec.title} ({selectedVoiceSpec.code})
              </p>
            ) : (
              <p>Нажмите «Слушать тембр» или клавишу Пробел для паузы</p>
            )}
          </div>
        </div>

        {/* Фильтры по типу тембра и бизнес-задаче */}
        <div
          role="tablist"
          aria-label="Фильтр голосов дубляжа по тембру и задаче"
          className="flex flex-wrap items-center gap-2"
        >
          {VOICE_CASTING_FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                data-testid={`voice-filter-${tab.id}`}
                aria-selected={isActive}
                onClick={() => setActiveFilter(tab.id)}
                className={`min-h-[40px] px-4 py-2 rounded-full text-xs sm:text-sm font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] border-transparent'
                    : 'bg-[#EFECE5]/65 dark:bg-[#15151A] text-[#111111]/78 dark:text-[#F4F3EF]/78 border-[#111111]/10 dark:border-white/10 hover:border-[#FF4820]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Сетка карточек актёрских архетипов */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVoices.map((voice: VoiceArchetypeSpec) => {
            const poster = toVoiceDemoCasePoster(voice);
            const isPlayingThis =
              props.playerSnap.activeCase?.id === poster.id &&
              props.playerSnap.isPlaying;
            const isChosen = props.selectedVoiceId === voice.id;
            const formatMeta = getStudioFormatDisplayMeta(
              voice.recommendedFormatId
            );

            return (
              <article
                key={voice.id}
                data-testid={`voice-card-${voice.id}`}
                className={`rounded-3xl p-6 sm:p-7 border flex flex-col justify-between gap-6 transition-colors ${
                  isChosen
                    ? 'bg-[#EFECE5] dark:bg-[#191920] border-[#FF4820]'
                    : 'bg-[#EFECE5]/65 dark:bg-[#15151A] border-[#111111]/10 dark:border-white/10'
                }`}
              >
                <div className="space-y-4">
                  {/* Строгая необрамлённая строка метаданных через разделитель · */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58 tabular-nums">
                    <span className="font-bold text-[#FF4820]">{voice.code}</span>
                    <span aria-hidden="true" className="opacity-40">
                      ·
                    </span>
                    <span>{voice.genderLabel}</span>
                    <span aria-hidden="true" className="opacity-40">
                      ·
                    </span>
                    <span>{voice.registerHzLabel}</span>
                    <span aria-hidden="true" className="opacity-40">
                      ·
                    </span>
                    <span>{voice.tempoWpmLabel}</span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xl font-bold tracking-tight leading-snug text-[#111111] dark:text-[#F4F3EF]">
                      {voice.title}
                    </h3>
                    <p className="text-xs sm:text-sm font-medium text-[#111111]/78 dark:text-[#F4F3EF]/78">
                      {voice.timbreSummary}
                    </p>
                  </div>

                  <p className="text-xs sm:text-sm italic text-[#111111]/72 dark:text-[#F4F3EF]/72 leading-relaxed pt-3 border-t border-[#111111]/10 dark:border-white/10">
                    {voice.auditionQuote}
                  </p>

                  <p className="text-xs text-[#111111]/64 dark:text-[#F4F3EF]/64 leading-relaxed">
                    {voice.directorNote}
                  </p>
                </div>

                <div className="space-y-4 pt-4 border-t border-[#111111]/10 dark:border-white/10">
                  <p className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60 leading-snug">
                    Ниши: {voice.bestForSectors} · Формат: {formatMeta.title}
                  </p>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      data-testid={`voice-play-btn-${voice.id}`}
                      aria-label={
                        isPlayingThis
                          ? `Пауза демо голоса ${voice.title}`
                          : `Слушать демо голоса ${voice.title}`
                      }
                      onClick={() => props.onTogglePlayDemo(poster)}
                      className={`min-h-[42px] px-4 py-2 rounded-full text-xs font-semibold inline-flex items-center justify-center gap-2 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        isPlayingThis
                          ? 'bg-[#FF4820] text-white border-[#FF4820]'
                          : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111] dark:text-[#F4F3EF] border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820]'
                      }`}
                    >
                      {isPlayingThis ? (
                        <Pause className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      ) : (
                        <Play className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span>
                        {isPlayingThis ? 'Пауза' : `Слушать (${poster.durationSec}с)`}
                      </span>
                    </button>

                    <button
                      type="button"
                      data-testid={`voice-select-btn-${voice.id}`}
                      onClick={() =>
                        props.onSelectVoiceForOrder({
                          voiceId: voice.id,
                          recommendedFormatId: voice.recommendedFormatId,
                          mappedIndustrySlug: voice.mappedIndustrySlug,
                        })
                      }
                      className={`flex-1 min-h-[42px] px-4 py-2 rounded-full text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                        isChosen
                          ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                          : 'bg-[#111111] hover:bg-[#FF4820] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#FF4820] dark:hover:text-white'
                      }`}
                    >
                      {isChosen ? (
                        <>
                          <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>В заказе · Перейти</span>
                        </>
                      ) : (
                        <>
                          <span>Выбрать в заказ</span>
                          <ArrowRight
                            className="w-3.5 h-3.5 shrink-0"
                            aria-hidden="true"
                          />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
