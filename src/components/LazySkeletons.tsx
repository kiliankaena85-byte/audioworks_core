import type { ReactNode } from 'react';
import type { RouteSkeletonVariant } from '../data/platformRouter';

export type HomeSectionSkeletonVariant =
  | 'broadcast'
  | 'cases'
  | 'duel'
  | 'approach'
  | 'testimonials-pricing';

const SURFACE_CLS =
  'rounded-3xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10';
const CONTAINER_CLS = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-12';

function Sk({ className }: { className: string }) {
  return <div aria-hidden="true" className={`fmworks-skeleton ${className}`} />;
}

function SkHeader({ withAction = true }: { withAction?: boolean }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-[#111111]/10 dark:border-white/10">
      <div className="max-w-3xl w-full space-y-3">
        <Sk className="h-4 w-56 rounded-md" />
        <Sk className="h-10 sm:h-12 w-full max-w-xl rounded-xl" />
        <Sk className="h-5 w-full max-w-2xl rounded-lg" />
      </div>
      {withAction && <Sk className="h-11 w-60 rounded-full shrink-0" />}
    </div>
  );
}

function SkCardsGrid({
  count = 3,
  withMedia = false,
  ctaRounded = 'rounded-xl',
}: {
  count?: number;
  withMedia?: boolean;
  ctaRounded?: string;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className={`${SURFACE_CLS} p-5 sm:p-6 space-y-4`}>
          {withMedia && <Sk className="h-44 w-full rounded-2xl" />}
          <Sk className="h-5 w-32 rounded-md" />
          <Sk className="h-7 w-4/5 rounded-lg" />
          <div className="space-y-2">
            <Sk className="h-4 w-full rounded-md" />
            <Sk className="h-4 w-5/6 rounded-md" />
          </div>
          <Sk className={`h-11 w-full ${ctaRounded}`} />
        </div>
      ))}
    </div>
  );
}

function RouteFrame({
  variant,
  label,
  className = 'min-h-[68vh]',
  children,
}: {
  variant: RouteSkeletonVariant;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      data-testid="route-loading-skeleton"
      data-skeleton-variant={variant}
      className={`fmworks-panel-enter ${className}`}
    >
      <span className="sr-only">{label}…</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

export function RouteLoadingSkeleton({
  variant,
}: {
  variant: RouteSkeletonVariant;
}) {
  if (variant === 'admin') {
    return (
      <RouteFrame
        variant={variant}
        label="Загрузка кабинета продюсера"
        className="min-h-screen bg-[#F7F6F2] dark:bg-[#0D0D0F] flex"
      >
        <div className="flex w-full min-h-screen">
          <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-[#111111]/10 dark:border-white/10 p-5 space-y-6">
            <Sk className="h-8 w-36 rounded-lg" />
            <div className="space-y-2.5">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Sk key={idx} className="h-10 w-full rounded-xl" />
              ))}
            </div>
          </aside>
          <div className="flex-1 flex flex-col min-w-0">
            <div className="h-16 border-b border-[#111111]/10 dark:border-white/10 px-4 sm:px-8 flex items-center justify-between gap-4">
              <Sk className="h-6 w-52 rounded-lg" />
              <div className="flex items-center gap-2.5">
                <Sk className="h-9 w-28 rounded-xl" />
                <Sk className="h-9 w-36 rounded-xl" />
              </div>
            </div>
            <div className="max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-4 space-y-2.5">
                    <Sk className="h-3.5 w-24 rounded-md" />
                    <Sk className="h-7 w-20 rounded-lg" />
                  </div>
                ))}
              </div>
              <div className={`${SURFACE_CLS} p-5 sm:p-6 space-y-3`}>
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Sk key={idx} className="h-14 w-full rounded-2xl" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </RouteFrame>
    );
  }

  if (variant === 'sound-drop') {
    return (
      <RouteFrame
        variant={variant}
        label="Загрузка формы передачи материалов звукорежиссёром"
        className="min-h-screen bg-[#F7F6F2] dark:bg-[#0D0D0F] flex items-center justify-center px-4 py-12"
      >
        <div className={`max-w-2xl w-full ${SURFACE_CLS} p-6 sm:p-10 space-y-6`}>
          <Sk className="h-5 w-40 rounded-md" />
          <Sk className="h-9 w-3/4 rounded-xl" />
          <Sk className="h-40 w-full rounded-2xl" />
          <div className="flex justify-end">
            <Sk className="h-11 w-44 rounded-full" />
          </div>
        </div>
      </RouteFrame>
    );
  }

  return (
    <RouteFrame variant={variant} label="Загрузка раздела FMWorks">
      {variant === 'privacy' && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-12 lg:py-16 space-y-7">
          <SkHeader withAction={false} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 rounded-2xl bg-[#EFECE5] dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10">
            {Array.from({ length: 3 }).map((_, idx) => (
              <Sk key={idx} className="h-10 rounded-xl" />
            ))}
          </div>
          <div className={`${SURFACE_CLS} p-6 sm:p-10 space-y-4`}>
            <Sk className="h-7 w-72 rounded-lg" />
            <Sk className="h-4 w-full rounded-md" />
            <Sk className="h-4 w-11/12 rounded-md" />
            <Sk className="h-32 w-full rounded-2xl" />
          </div>
        </div>
      )}

      {variant === 'order' && (
        <div className={`${CONTAINER_CLS} py-8 sm:py-12 space-y-8`}>
          <SkHeader withAction={false} />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className={`lg:col-span-7 xl:col-span-8 ${SURFACE_CLS} p-6 sm:p-8 space-y-5`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Sk className="h-20 rounded-2xl" />
                <Sk className="h-20 rounded-2xl" />
              </div>
              <Sk className="h-12 w-full rounded-xl" />
              <Sk className="h-28 w-full rounded-2xl" />
            </div>
            <div className={`lg:col-span-5 xl:col-span-4 ${SURFACE_CLS} p-6 space-y-5`}>
              <Sk className="h-6 w-44 rounded-lg" />
              <Sk className="h-10 w-36 rounded-xl" />
              <Sk className="h-12 w-full rounded-full" />
            </div>
          </div>
        </div>
      )}

      {variant === 'cabinet' && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-12 space-y-6">
          <div className={`${SURFACE_CLS} p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
            <div className="space-y-2">
              <Sk className="h-4 w-36 rounded-md" />
              <Sk className="h-8 w-64 rounded-xl" />
            </div>
            <Sk className="h-10 w-40 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 3 }).map((_, idx) => (
              <Sk key={idx} className="h-10 w-36 rounded-xl" />
            ))}
          </div>
          <Sk className="h-52 w-full rounded-3xl" />
          <Sk className="h-52 w-full rounded-3xl" />
        </div>
      )}

      {variant === 'faq' && (
        <div className={`${CONTAINER_CLS} py-10 sm:py-14 space-y-8`}>
          <SkHeader />
          <Sk className="h-12 w-full max-w-2xl rounded-2xl" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-5 flex items-center justify-between gap-4">
                <Sk className="h-5 w-2/3 rounded-lg" />
                <Sk className="h-6 w-6 rounded-full shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {variant === 'pricing' && (
        <div className={`${CONTAINER_CLS} py-10 sm:py-14 space-y-10`}>
          <SkHeader />
          <SkCardsGrid count={3} ctaRounded="rounded-full" />
        </div>
      )}

      {variant === 'approach' && (
        <div className={`${CONTAINER_CLS} py-10 sm:py-14 space-y-10`}>
          <SkHeader />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <Sk className="lg:col-span-7 h-72 rounded-3xl" />
            <div className={`lg:col-span-5 ${SURFACE_CLS} p-6 space-y-4`}>
              <Sk className="h-6 w-48 rounded-lg" />
              <Sk className="h-4 w-full rounded-md" />
              <Sk className="h-24 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      )}

      {(variant === 'cases' || variant === 'hot-air') && (
        <div className={`${CONTAINER_CLS} py-10 sm:py-14 space-y-10`}>
          <SkHeader />
          <Sk className="h-56 sm:h-64 w-full rounded-3xl" />
          <SkCardsGrid count={3} withMedia />
        </div>
      )}

      {variant === 'home' && (
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-10 py-6">
          <Sk className="h-[540px] sm:h-[620px] w-full rounded-3xl" />
        </div>
      )}
    </RouteFrame>
  );
}

export function HomeSectionSkeleton({
  variant,
}: {
  variant: HomeSectionSkeletonVariant;
}) {
  return (
    <div
      aria-hidden="true"
      data-testid="home-section-skeleton"
      data-section-skeleton={variant}
      className={`${CONTAINER_CLS} py-14 sm:py-20`}
    >
      {variant === 'broadcast' && (
        <div className={`${SURFACE_CLS} p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8`}>
          <div className="lg:col-span-5 space-y-4">
            <Sk className="h-4 w-44 rounded-md" />
            <Sk className="h-9 w-4/5 rounded-xl" />
            <Sk className="h-4 w-full rounded-md" />
          </div>
          <div className="lg:col-span-7 space-y-4">
            <Sk className="h-52 w-full rounded-2xl" />
            <div className="flex flex-wrap gap-3">
              <Sk className="h-11 w-40 rounded-full" />
              <Sk className="h-11 w-44 rounded-full" />
            </div>
          </div>
        </div>
      )}

      {variant === 'cases' && (
        <div className="space-y-8">
          <div className="space-y-2.5 max-w-2xl">
            <Sk className="h-4 w-32 rounded-md" />
            <Sk className="h-9 w-80 rounded-xl" />
          </div>
          <SkCardsGrid count={3} withMedia />
        </div>
      )}

      {variant === 'duel' && (
        <div className={`${SURFACE_CLS} p-6 sm:p-10 space-y-6`}>
          <Sk className="h-8 w-72 rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Sk className="h-48 rounded-2xl" />
            <Sk className="h-48 rounded-2xl" />
          </div>
        </div>
      )}

      {variant === 'approach' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-5 space-y-4">
            <Sk className="h-4 w-36 rounded-md" />
            <Sk className="h-9 w-full rounded-xl" />
            <Sk className="h-4 w-11/12 rounded-md" />
          </div>
          <Sk className="lg:col-span-7 h-64 rounded-3xl" />
        </div>
      )}

      {variant === 'testimonials-pricing' && (
        <div className="space-y-12">
          <SkCardsGrid count={3} ctaRounded="rounded-full" />
        </div>
      )}
    </div>
  );
}
