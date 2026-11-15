import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { broadcastAircheckEngine } from './audio/broadcastAircheckEngine';
import { casePlayerEngine, CasePlayerSnapshot } from './audio/casePlayerEngine';
import { contrastAudioEngine } from './audio/contrastAudioEngine';
import { SiteTextBlocksProvider } from './cms/SiteTextBlocksContext';
import { StudioCmsProvider, useStudioCms } from './cms/StudioCmsContext';
import { AdminWorkspace } from './components/admin/AdminWorkspace';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { BrandKitModal } from './components/BrandKitModal';
import { CompactHeaderNav } from './components/CompactHeaderNav';
import { FloatingCasePlayer } from './components/FloatingCasePlayer';
import { Footer } from './components/Footer';
import { PerformanceMonitor } from './components/PerformanceMonitor';
import { ApproachPage } from './components/pages/ApproachPage';
import { CasesPage } from './components/pages/CasesPage';
import { ClientCabinetPage } from './components/pages/ClientCabinetPage';
import { FaqPage } from './components/pages/FaqPage';
import { HomePage } from './components/pages/HomePage';
import { HotAirPage } from './components/pages/HotAirPage';
import { OrderPage } from './components/pages/OrderPage';
import { PricingPage } from './components/pages/PricingPage';
import { SoundEngineerDropPage } from './components/pages/SoundEngineerDropPage';
import { RadioInventoryAdmin } from './components/RadioInventoryAdmin';
import { ReservationConfirmedModal } from './components/ReservationConfirmedModal';
import { BrandDomainVariant } from './data/brandKitData';

function RouteLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-[45vh] flex items-center justify-center px-6 text-sm text-[#111111]/55 dark:text-[#F4F3EF]/55"
    >
      Загрузка раздела FMWorks…
    </div>
  );
}
import {
  SEO_ARTICLE_TITLE_BY_SLUG,
  SEO_INDUSTRY_TITLE_BY_SLUG,
  SEO_STATION_TITLE_BY_SLUG,
} from './data/seoRouteLabels';
import {
  OrderDraftSnapshot,
  orderDraftStore,
  resolveReservationLifecycleStatus,
} from './data/orderDraftStore';
import { AIRTIME_SALES_ENABLED } from './data/platformFeatures';
import {
  applyRouteSeoToDocument,
  buildPlatformPath,
  parsePlatformRoute,
  PlatformRoute,
  resolveRouteScrollAnchor,
  resolveRouteSeoMeta,
} from './data/platformRouter';
import { OrderFormatId } from './data/pricingData';
import { MediaGridReservationPayload } from './data/radioInventory';
import { orderPublishedCmsCasesForPersona } from './data/studioCmsTypes';
import { LayaDecisionProvider, useLayaDecision } from './engine/LayaContext';

const THEME_STORAGE_KEY = 'fmworks_theme_v1';
const LEGACY_THEME_STORAGE_KEY = 'audioworks_theme_v1';

function FmworksExperience() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved =
        window.localStorage.getItem(THEME_STORAGE_KEY) ??
        window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
      return saved === 'dark';
    } catch {
      return false;
    }
  });

  const [route, setRoute] = useState<PlatformRoute>(() =>
    typeof window === 'undefined'
      ? { kind: 'home' }
      : parsePlatformRoute(
          window.location.pathname,
          window.location.search,
          window.location.hash
        )
  );

  const [orderDraft, setOrderDraft] = useState<OrderDraftSnapshot>(() =>
    orderDraftStore.getSnapshot()
  );

  const [isBrandKitOpen, setIsBrandKitOpen] = useState(false);
  const [isRadioAdminOpen, setIsRadioAdminOpen] = useState(false);
  const [isHeaderConfirmedModalOpen, setIsHeaderConfirmedModalOpen] =
    useState(false);
  const [navigationTick, setNavigationTick] = useState<number>(0);
  const [brandVariant, setBrandVariant] =
    useState<BrandDomainVariant>('fmworks_reg');
  const [caseSnap, setCaseSnap] = useState<CasePlayerSnapshot>(() =>
    casePlayerEngine.getSnapshot()
  );
  const { decision } = useLayaDecision();
  const { snapshot } = useStudioCms();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch {
      // Ignore storage quota errors
    }
  }, [isDark]);

  useEffect(() => {
    const unsubscribeDraft = orderDraftStore.subscribe(setOrderDraft);
    return unsubscribeDraft;
  }, []);

  const hasNormalizedInitialUrlRef = useRef(false);

  // Нормализация URL при первом заходе (включая скрытый /hot-air -> / и старые хеш-ссылки)
  useEffect(() => {
    if (typeof window === 'undefined' || hasNormalizedInitialUrlRef.current) return;
    hasNormalizedInitialUrlRef.current = true;
    const lowerPath = window.location.pathname.toLowerCase();
    if (!AIRTIME_SALES_ENABLED && lowerPath.startsWith('/hot-air')) {
      window.history.replaceState({}, '', '/');
      return;
    }
    const canonical = buildPlatformPath(route);
    const currentFull = `${window.location.pathname}${window.location.hash}`;
    if (window.location.pathname === '/' && (window.location.hash || window.location.search)) {
      if (canonical !== currentFull) {
        window.history.replaceState({}, '', canonical);
      }
    }
  }, [route]);

  useEffect(() => {
    const handlePopState = () => {
      const next = parsePlatformRoute(
        window.location.pathname,
        window.location.search,
        window.location.hash
      );
      if (next.kind === 'admin' || next.kind === 'sound-drop') {
        casePlayerEngine.stop();
        contrastAudioEngine.stopAll();
        broadcastAircheckEngine.stop();
      } else if (next.kind !== 'home') {
        contrastAudioEngine.stopAll();
        broadcastAircheckEngine.stop();
      }
      setRoute(next);
      setNavigationTick((prev) => prev + 1);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const unsubscribe = casePlayerEngine.subscribe(setCaseSnap);
    return () => {
      unsubscribe();
      casePlayerEngine.stop();
    };
  }, []);

  // Динамическое обновление SEO-тегов, OpenGraph, canonical и Schema.org JSON-LD на каждом маршруте
  useEffect(() => {
    const allCases = [snapshot.flagshipReel, ...snapshot.portfolioCases];
    const stationName =
      route.kind === 'station-detail'
        ? SEO_STATION_TITLE_BY_SLUG[route.stationSlug]
        : undefined;
    const caseClientName =
      route.kind === 'case-detail'
        ? allCases.find((c) => c.id === route.caseSlug)?.client
        : undefined;
    const industryTitle =
      route.kind === 'industry-detail'
        ? SEO_INDUSTRY_TITLE_BY_SLUG[route.industrySlug]
        : undefined;
    const articleTitle =
      route.kind === 'mistake-detail'
        ? SEO_ARTICLE_TITLE_BY_SLUG[route.articleSlug]
        : undefined;

    const seoMeta = resolveRouteSeoMeta(route, {
      stationName,
      caseClientName,
      industryTitle,
      articleTitle,
    });
    applyRouteSeoToDocument(seoMeta);
  }, [route, snapshot.flagshipReel, snapshot.portfolioCases]);

  const navigateTo = (
    nextRoute: PlatformRoute,
    options?: { replace?: boolean }
  ) => {
    const effectiveRoute: PlatformRoute =
      !AIRTIME_SALES_ENABLED &&
      (nextRoute.kind === 'hot-air' || nextRoute.kind === 'station-detail')
        ? { kind: 'home' }
        : nextRoute;
    const targetPath = buildPlatformPath(effectiveRoute);
    if (typeof window !== 'undefined') {
      if (
        effectiveRoute.kind === 'admin' ||
        effectiveRoute.kind === 'sound-drop'
      ) {
        casePlayerEngine.stop();
        contrastAudioEngine.stopAll();
        broadcastAircheckEngine.stop();
      } else if (effectiveRoute.kind !== 'home') {
        // Останавливаем только локальный краш-тест и эфирный стенд главного экрана, а глобальный плеер кейсов продолжает играть между страницами!
        contrastAudioEngine.stopAll();
        broadcastAircheckEngine.stop();
      }

      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (currentUrl !== targetPath) {
        if (options?.replace) {
          window.history.replaceState({}, '', targetPath);
        } else {
          window.history.pushState({}, '', targetPath);
        }
      }

      const scrollAnchor = resolveRouteScrollAnchor(effectiveRoute);
      if (!scrollAnchor && !options?.replace) {
        const previousPath = buildPlatformPath(route);
        const isExactSameRoute = previousPath === targetPath;
        window.scrollTo({
          top: 0,
          left: 0,
          behavior: isExactSameRoute ? 'smooth' : ('instant' as ScrollBehavior),
        });
      }
    }
    setRoute(effectiveRoute);
    setNavigationTick((prev) => prev + 1);
  };

  useLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const scrollAnchor = resolveRouteScrollAnchor(route);
    if (scrollAnchor) {
      const target = document.getElementById(scrollAnchor);
      if (target) {
        target.scrollIntoView({
          behavior: 'instant' as ScrollBehavior,
          block: 'start',
        });
      }
      return;
    }
    if (navigationTick > 0) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [route, navigationTick]);

  const currentRoutePath = buildPlatformPath(route);

  if (route.kind === 'sound-drop') {
    return (
      <>
        <PerformanceMonitor routeKey={currentRoutePath} />
        <Suspense fallback={<RouteLoadingFallback />}>
          <SoundEngineerDropPage
            dropToken={route.dropToken}
            isDark={isDark}
            onToggleTheme={() => setIsDark((prev) => !prev)}
          />
        </Suspense>
      </>
    );
  }

  if (route.kind === 'admin') {
    return (
      <>
        <PerformanceMonitor routeKey={currentRoutePath} />
        <Suspense fallback={<RouteLoadingFallback />}>
          <AdminWorkspace
            brandVariant={brandVariant}
            onSelectBrandVariant={setBrandVariant}
            onOpenBrandKit={() => setIsBrandKitOpen(true)}
            isDark={isDark}
            onToggleTheme={() => setIsDark((prev) => !prev)}
            onNavigateHome={() => navigateTo({ kind: 'home' })}
          />
          {isBrandKitOpen && (
            <BrandKitModal
              isOpen={isBrandKitOpen}
              onClose={() => setIsBrandKitOpen(false)}
              activeSiteVariant={brandVariant}
              onSelectSiteVariant={setBrandVariant}
            />
          )}
        </Suspense>
      </>
    );
  }

  const orderedCases = orderPublishedCmsCasesForPersona(
    snapshot.portfolioCases,
    decision.choice
  );
  const playlistWithReel =
    snapshot.flagshipReel.published !== false
      ? [snapshot.flagshipReel, ...orderedCases]
      : orderedCases;

  const isCasePlayerVisible =
    caseSnap.isPlaying &&
    caseSnap.playbackMode === 'full' &&
    caseSnap.activeCase !== null;

  const currentReturnPath =
    typeof window !== 'undefined' && route.kind !== 'order'
      ? window.location.pathname || '/'
      : '/';

  const handleOpenStudioOrder = (formatId: OrderFormatId | null = null) => {
    orderDraftStore.prepareProductionOrder({
      formatId,
      returnPath: currentReturnPath,
    });
    navigateTo({ kind: 'order' });
  };

  const handleHeaderOrderClick = () => {
    if (!AIRTIME_SALES_ENABLED) {
      handleOpenStudioOrder(null);
      return;
    }
    if (route.kind !== 'order') {
      orderDraftStore.updateDraft({ returnPath: currentReturnPath });
    }
    navigateTo({ kind: 'order' });
  };

  const handleReserveMediaGrid = (
    payload: MediaGridReservationPayload,
    returnPath = '/hot-air'
  ) => {
    orderDraftStore.prepareMediaReservationOrder(payload, { returnPath });
    navigateTo({ kind: 'order' });
  };

  return (
    <div className="min-h-screen bg-[#F7F6F2] text-[#111111] dark:bg-[#0D0D0F] dark:text-[#F4F3EF] transition-colors duration-200 flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2.5 focus:rounded-xl focus:bg-[#FF4820] focus:text-white focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        Перейти к основному контенту
      </a>
      <PerformanceMonitor routeKey={currentRoutePath} />
      <CompactHeaderNav
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        activeRoute={route}
        onNavigate={navigateTo}
        onOpenOrder={handleHeaderOrderClick}
        brandVariant={brandVariant}
        {...(AIRTIME_SALES_ENABLED
          ? {
              hasActiveHold: orderDraft.mediaReservation !== null,
              holdStationsCount: orderDraft.mediaReservation?.stations.length ?? 0,
              reservationStatus: resolveReservationLifecycleStatus(orderDraft),
              confirmedOrderNumber:
                orderDraft.confirmedReservation?.orderNumber ?? null,
              onOpenConfirmedModal: () => setIsHeaderConfirmedModalOpen(true),
            }
          : {})}
      />

      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <Suspense fallback={<RouteLoadingFallback />}>
          {route.kind === 'home' && (
            <HomePage
              scrollAnchor={route.scrollAnchor}
              navigationTick={navigationTick}
              brandVariant={brandVariant}
              playerSnap={caseSnap}
              onToggleCase={(item) => casePlayerEngine.toggleCase(item)}
              onStartPreview={(item) => casePlayerEngine.startPreview(item)}
              onStopPreview={(caseId) => casePlayerEngine.stopPreview(caseId)}
              onNavigate={navigateTo}
              onStartStudioOrder={handleOpenStudioOrder}
            />
          )}

          {AIRTIME_SALES_ENABLED &&
            (route.kind === 'hot-air' || route.kind === 'station-detail') && (
              <HotAirPage
                stationSlug={
                  route.kind === 'station-detail' ? route.stationSlug : undefined
                }
                isCasePlayerVisible={isCasePlayerVisible}
                onNavigate={navigateTo}
                onReserveMediaGrid={handleReserveMediaGrid}
              />
            )}

          {(route.kind === 'cases' ||
            route.kind === 'case-detail' ||
            route.kind === 'industry-detail') && (
            <CasesPage
              caseSlug={route.kind === 'case-detail' ? route.caseSlug : undefined}
              industrySlug={
                route.kind === 'industry-detail' ? route.industrySlug : undefined
              }
              scrollAnchor={route.kind === 'cases' ? route.scrollAnchor : undefined}
              navigationTick={navigationTick}
              playerSnap={caseSnap}
              onToggleCase={(item) => casePlayerEngine.toggleCase(item)}
              onStartPreview={(item) => casePlayerEngine.startPreview(item)}
              onStopPreview={(caseId) => casePlayerEngine.stopPreview(caseId)}
              onNavigate={navigateTo}
            />
          )}

          {route.kind === 'pricing' && (
            <PricingPage
              scrollAnchor={route.scrollAnchor}
              navigationTick={navigationTick}
              onSelectFormat={(formatId) => handleOpenStudioOrder(formatId)}
              onNavigate={navigateTo}
            />
          )}

          {(route.kind === 'approach' || route.kind === 'mistake-detail') && (
            <ApproachPage
              articleSlug={
                route.kind === 'mistake-detail' ? route.articleSlug : undefined
              }
              scrollAnchor={route.kind === 'approach' ? route.scrollAnchor : undefined}
              navigationTick={navigationTick}
              onNavigate={navigateTo}
              onStartOrder={() => handleOpenStudioOrder('turnkey')}
            />
          )}

          {route.kind === 'faq' && (
            <FaqPage
              scrollAnchor={route.scrollAnchor}
              navigationTick={navigationTick}
              onNavigate={navigateTo}
              onStartOrder={(formatId) => handleOpenStudioOrder(formatId ?? null)}
            />
          )}

          {route.kind === 'order' && (
            <OrderPage draft={orderDraft} onNavigate={navigateTo} />
          )}

          {route.kind === 'cabinet' && (
            <ClientCabinetPage
              subroute={route.subroute}
              magicToken={route.magicToken}
              onNavigate={navigateTo}
            />
          )}
        </Suspense>
      </main>

      <Footer
        brandVariant={brandVariant}
        onOpenAdmin={() => navigateTo({ kind: 'admin' })}
        onOpenOrder={handleHeaderOrderClick}
        onNavigate={navigateTo}
      />

      {AIRTIME_SALES_ENABLED && route.kind === 'hot-air' && (
        <div className="h-[58px] sm:h-[68px]" aria-hidden="true" />
      )}

      <FloatingCasePlayer
        playerSnap={caseSnap}
        onStop={() => casePlayerEngine.stop()}
        onNext={() => casePlayerEngine.playNextCase(playlistWithReel)}
      />
    

      {AIRTIME_SALES_ENABLED && isRadioAdminOpen && (
        <Suspense fallback={null}>
          <RadioInventoryAdmin
            isOpen={isRadioAdminOpen}
            onClose={() => setIsRadioAdminOpen(false)}
          />
        </Suspense>
      )}

      {AIRTIME_SALES_ENABLED &&
        isHeaderConfirmedModalOpen &&
        orderDraft.confirmedReservation !== null && (
          <Suspense fallback={null}>
            <ReservationConfirmedModal
              isOpen
              confirmed={orderDraft.confirmedReservation}
              onClose={() => setIsHeaderConfirmedModalOpen(false)}
              onNavigateHotAir={() => navigateTo({ kind: 'hot-air' })}
            />
          </Suspense>
        )}
    </div>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <LayaDecisionProvider>
        <StudioCmsProvider>
          <SiteTextBlocksProvider>
            <FmworksExperience />
          </SiteTextBlocksProvider>
        </StudioCmsProvider>
      </LayaDecisionProvider>
    </AppErrorBoundary>
  );
}
