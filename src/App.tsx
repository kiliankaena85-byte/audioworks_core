import { useEffect, useState } from 'react';
import { casePlayerEngine, CasePlayerSnapshot } from './audio/casePlayerEngine';
import { contrastAudioEngine } from './audio/contrastAudioEngine';
import { SiteTextBlocksProvider } from './cms/SiteTextBlocksContext';
import { StudioCmsProvider, useStudioCms } from './cms/StudioCmsContext';
import { AdminWorkspace } from './components/admin/AdminWorkspace';
import { BrandKitModal } from './components/BrandKitModal';
import { CompactHeaderNav } from './components/CompactHeaderNav';
import { FloatingCasePlayer } from './components/FloatingCasePlayer';
import { Footer } from './components/Footer';
import { LayaSimulationConsole } from './components/LayaSimulationConsole';
import { ApproachPage } from './components/pages/ApproachPage';
import { CasesPage } from './components/pages/CasesPage';
import { HomePage } from './components/pages/HomePage';
import { HotAirPage } from './components/pages/HotAirPage';
import { OrderPage } from './components/pages/OrderPage';
import { PricingPage } from './components/pages/PricingPage';
import { RadioInventoryAdmin } from './components/RadioInventoryAdmin';
import { ReservationConfirmedModal } from './components/ReservationConfirmedModal';
import { BrandDomainVariant } from './data/brandKitData';
import {
  INDUSTRY_SOLUTIONS,
  RADIO_MISTAKE_ARTICLES,
  STATION_EDITORIAL_SEEDS,
} from './data/multiPageContentData';
import {
  OrderDraftSnapshot,
  orderDraftStore,
  resolveReservationLifecycleStatus,
} from './data/orderDraftStore';
import {
  applyRouteSeoToDocument,
  buildPlatformPath,
  parsePlatformRoute,
  PlatformRoute,
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

  // Нормализация старых хеш-ссылок (например /#hot-air -> /hot-air) при первом заходе и синхронизация popstate
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const canonical = buildPlatformPath(route);
    const currentFull = `${window.location.pathname}${window.location.hash}`;
    if (window.location.pathname === '/' && (window.location.hash || window.location.search)) {
      if (canonical !== currentFull) {
        window.history.replaceState({}, '', canonical);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const next = parsePlatformRoute(
        window.location.pathname,
        window.location.search,
        window.location.hash
      );
      if (next.kind === 'admin') {
        casePlayerEngine.stop();
        contrastAudioEngine.stopAll();
      } else if (next.kind !== 'home') {
        contrastAudioEngine.stopAll();
      }
      setRoute(next);
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
        ? STATION_EDITORIAL_SEEDS.find((s) => s.slug === route.stationSlug)
            ?.stationName
        : undefined;
    const caseClientName =
      route.kind === 'case-detail'
        ? allCases.find((c) => c.id === route.caseSlug)?.client
        : undefined;
    const industryTitle =
      route.kind === 'industry-detail'
        ? INDUSTRY_SOLUTIONS[route.industrySlug]?.shortTitle
        : undefined;
    const articleTitle =
      route.kind === 'mistake-detail'
        ? RADIO_MISTAKE_ARTICLES.find((a) => a.slug === route.articleSlug)?.title
        : undefined;

    const seoMeta = resolveRouteSeoMeta(route, {
      stationName,
      caseClientName,
      industryTitle,
      articleTitle,
    });
    applyRouteSeoToDocument(seoMeta);
  }, [route, snapshot.flagshipReel, snapshot.portfolioCases]);

  const navigateTo = (nextRoute: PlatformRoute) => {
    const targetPath = buildPlatformPath(nextRoute);
    if (typeof window !== 'undefined') {
      if (nextRoute.kind === 'admin') {
        casePlayerEngine.stop();
        contrastAudioEngine.stopAll();
      } else if (nextRoute.kind !== 'home') {
        // Останавливаем только локальный краш-тест главного экрана, а глобальный плеер кейсов продолжает играть между страницами!
        contrastAudioEngine.stopAll();
      }

      const currentUrl = `${window.location.pathname}${window.location.hash}`;
      if (currentUrl !== targetPath) {
        window.history.pushState({}, '', targetPath);
      }

      const hasScrollAnchor =
        (nextRoute.kind === 'home' && Boolean(nextRoute.scrollAnchor)) ||
        (nextRoute.kind === 'pricing' && Boolean(nextRoute.scrollAnchor));
      if (!hasScrollAnchor) {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      }
    }
    setRoute(nextRoute);
  };

  if (route.kind === 'admin') {
    return (
      <AdminWorkspace
        brandVariant={brandVariant}
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        onNavigateHome={() => navigateTo({ kind: 'home' })}
      />
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

  const reservationStatus = resolveReservationLifecycleStatus(orderDraft);
  const hasActiveHold = orderDraft.mediaReservation !== null;
  const holdStationsCount = orderDraft.mediaReservation?.stations.length ?? 0;
  const confirmedOrderNumber =
    orderDraft.confirmedReservation?.orderNumber ?? null;

  return (
    <div className="min-h-screen bg-[#F7F6F2] text-[#111111] dark:bg-[#0D0D0F] dark:text-[#F4F3EF] transition-colors duration-200 flex flex-col">
      <CompactHeaderNav
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        activeRoute={route}
        hasActiveHold={hasActiveHold}
        holdStationsCount={holdStationsCount}
        reservationStatus={reservationStatus}
        confirmedOrderNumber={confirmedOrderNumber}
        onNavigate={navigateTo}
        onOpenOrder={handleHeaderOrderClick}
        onOpenConfirmedModal={() => setIsHeaderConfirmedModalOpen(true)}
        brandVariant={brandVariant}
        onOpenBrandKit={() => setIsBrandKitOpen(true)}
      />

      <main className="flex-1">
        {route.kind === 'home' && (
          <HomePage
            scrollAnchor={route.scrollAnchor}
            brandVariant={brandVariant}
            onOpenBrandKit={() => setIsBrandKitOpen(true)}
            playerSnap={caseSnap}
            onToggleCase={(item) => casePlayerEngine.toggleCase(item)}
            onStartPreview={(item) => casePlayerEngine.startPreview(item)}
            onStopPreview={(caseId) => casePlayerEngine.stopPreview(caseId)}
            onNavigate={navigateTo}
            onStartStudioOrder={handleOpenStudioOrder}
          />
        )}

        {(route.kind === 'hot-air' || route.kind === 'station-detail') && (
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
            onSelectFormat={(formatId) => handleOpenStudioOrder(formatId)}
            onNavigate={navigateTo}
          />
        )}

        {(route.kind === 'approach' || route.kind === 'mistake-detail') && (
          <ApproachPage
            articleSlug={
              route.kind === 'mistake-detail' ? route.articleSlug : undefined
            }
            onNavigate={navigateTo}
            onStartOrder={() => handleOpenStudioOrder('turnkey')}
          />
        )}

        {route.kind === 'order' && (
          <OrderPage draft={orderDraft} onNavigate={navigateTo} />
        )}
      </main>

      <Footer
        brandVariant={brandVariant}
        onOpenBrandKit={() => setIsBrandKitOpen(true)}
        onOpenAdmin={() => navigateTo({ kind: 'admin' })}
        onNavigate={navigateTo}
      />

      {route.kind === 'hot-air' && <div className="h-[58px] sm:h-[68px]" aria-hidden="true" />}

      <FloatingCasePlayer
        playerSnap={caseSnap}
        onStop={() => casePlayerEngine.stop()}
        onNext={() => casePlayerEngine.playNextCase(playlistWithReel)}
      />

      <LayaSimulationConsole
        isCasePlayerVisible={isCasePlayerVisible}
        hasStickyBottomBar={route.kind === 'hot-air'}
        onOpenBrandKit={() => setIsBrandKitOpen(true)}
        onOpenRadioAdmin={() => setIsRadioAdminOpen(true)}
      />

      <BrandKitModal
        isOpen={isBrandKitOpen}
        onClose={() => setIsBrandKitOpen(false)}
        activeSiteVariant={brandVariant}
        onSelectSiteVariant={setBrandVariant}
      />

      <RadioInventoryAdmin
        isOpen={isRadioAdminOpen}
        onClose={() => setIsRadioAdminOpen(false)}
      />

      <ReservationConfirmedModal
        isOpen={isHeaderConfirmedModalOpen && orderDraft.confirmedReservation !== null}
        confirmed={orderDraft.confirmedReservation}
        onClose={() => setIsHeaderConfirmedModalOpen(false)}
        onNavigateHotAir={() => navigateTo({ kind: 'hot-air' })}
      />
    </div>
  );
}

export default function App() {
  return (
    <LayaDecisionProvider>
      <StudioCmsProvider>
        <SiteTextBlocksProvider>
          <FmworksExperience />
        </SiteTextBlocksProvider>
      </StudioCmsProvider>
    </LayaDecisionProvider>
  );
}
