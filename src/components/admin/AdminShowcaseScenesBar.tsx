import { ArrowUpRight, Sliders } from 'lucide-react';
import {
  buildShowcaseScenesMap,
  ShowcaseAudioSceneId,
} from '../../data/heroStageCms';
import { StudioCmsSnapshot } from '../../data/studioCmsTypes';

interface AdminShowcaseScenesBarProps {
  snapshot: Pick<
    StudioCmsSnapshot,
    'heroStage' | 'flagshipReel' | 'portfolioCases' | 'duel'
  >;
  activeScene: ShowcaseAudioSceneId;
  onSelectScene: (sceneId: ShowcaseAudioSceneId) => void;
  onNavigateToAnchor: (anchorHash: '#top' | '#work' | '#duel') => void;
}

export function AdminShowcaseScenesBar({
  snapshot,
  activeScene,
  onSelectScene,
  onNavigateToAnchor,
}: AdminShowcaseScenesBarProps) {
  const scenes = buildShowcaseScenesMap(snapshot);

  return (
    <section
      aria-label="Карта звуковых сцен главной страницы"
      data-testid="admin-showcase-scenes-bar"
      className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 overflow-hidden"
    >
      <div className="px-5 sm:px-6 py-3.5 border-b border-[#111111]/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-[#111111] dark:text-[#F4F3EF]">
            Пульт звуковых сцен витрины
          </span>
          <span
            aria-hidden="true"
            className="text-[#111111]/35 dark:text-[#F4F3EF]/35"
          >
            ·
          </span>
          <span className="text-[#111111]/60 dark:text-[#F4F3EF]/60">
            Наглядно показывает, какой аудиофайл на каком экране главной страницы звучит
          </span>
        </div>
        <span className="text-xs text-[#111111]/50 dark:text-[#F4F3EF]/50 tabular-nums">
          3 звуковые зоны на главной
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-[#111111]/10 dark:divide-white/10">
        {scenes.map((scene) => {
          const isActive = activeScene === scene.id;

          return (
            <div
              key={scene.id}
              data-testid={`showcase-scene-card-${scene.id}`}
              className={`p-5 flex flex-col justify-between gap-4 transition-colors ${
                isActive
                  ? 'bg-[#F7F6F2] dark:bg-[#1C1C22]'
                  : 'hover:bg-[#F7F6F2]/60 dark:hover:bg-white/[0.03]'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectScene(scene.id)}
                aria-pressed={isActive}
                className="w-full text-left space-y-2 cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
                  <span
                    className={
                      isActive
                        ? 'font-bold text-[#FF4820]'
                        : 'font-semibold text-[#111111]/60 dark:text-[#F4F3EF]/60'
                    }
                  >
                    {scene.screenBadge}
                  </span>
                  <span
                    className={
                      scene.isCustomized
                        ? 'font-semibold text-[#16A34A] dark:text-[#4ADE80]'
                        : 'text-[#111111]/48 dark:text-[#F4F3EF]/48'
                    }
                  >
                    {scene.isCustomized ? 'Свой аудиофайл' : 'Эталон студии'}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <h2 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                    {scene.title}
                  </h2>
                  <p className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58 leading-relaxed">
                    {scene.publicPlacement}
                  </p>
                </div>

                <div className="pt-1 space-y-0.5 text-xs tabular-nums">
                  <p className="font-semibold text-[#111111] dark:text-[#F4F3EF] truncate">
                    {scene.activeAudioSummary}
                  </p>
                  <p className="text-[#111111]/52 dark:text-[#F4F3EF]/52 truncate">
                    {scene.timingSummary}
                  </p>
                </div>
              </button>

              <div className="pt-3 border-t border-[#111111]/8 dark:border-white/8 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onSelectScene(scene.id)}
                  className={`text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'text-[#111111] dark:text-[#F4F3EF]'
                      : 'text-[#FF4820] hover:text-[#E63D18]'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{isActive ? 'Открыта ниже' : 'Настроить звук'}</span>
                </button>

                <button
                  type="button"
                  data-testid={`showcase-open-live-${scene.id}`}
                  onClick={() => onNavigateToAnchor(scene.anchorHash)}
                  className="text-xs font-medium text-[#111111]/62 dark:text-[#F4F3EF]/62 hover:text-[#111111] dark:hover:text-white inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>Показать на сайте</span>
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
