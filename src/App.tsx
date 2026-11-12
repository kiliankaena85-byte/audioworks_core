import { useEffect, useState } from 'react';
import { casePlayerEngine, CasePlayerSnapshot } from './audio/casePlayerEngine';
import { contrastAudioEngine } from './audio/contrastAudioEngine';
import { SiteTextBlocksProvider } from './cms/SiteTextBlocksContext';
import { StudioCmsProvider, useStudioCms } from './cms/StudioCmsContext';
import { AdminWorkspace } from './components/admin/AdminWorkspace';
import { ApproachSection } from './components/ApproachSection';
import { BrandKitModal } from './components/BrandKitModal';
import { CasesGallery } from './components/CasesGallery';
import { CompactHeaderNav } from './components/CompactHeaderNav';
import { FaqSection } from './components/FaqSection';
import { FifteenSecDuel } from './components/FifteenSecDuel';
import { FloatingCasePlayer } from './components/FloatingCasePlayer';
import { Footer } from './components/Footer';
import { HeroKotoLens } from './components/HeroKotoLens';
import { LayaSimulationConsole } from './components/LayaSimulationConsole';
import { PricingSection } from './components/PricingSection';
import { QuickOrderDrawer } from './components/QuickOrderDrawer';
import { TestimonialsSection } from './components/TestimonialsSection';
import { BrandDomainVariant } from './data/brandKitData';
import { OrderFormatId } from './data/pricingData';
import {
  orderPublishedCmsCasesForPersona,
  resolveAppRoute,
} from './data/studioCmsTypes';
import { LayaDecisionProvider, useLayaDecision } from './engine/LayaContext';

const THEME_STORAGE_KEY = 'audioworks_theme_v1';

function AudioworksExperience() {
  // Светлая тема (#F7F6F2) включена по умолчанию
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
    } catch {
      return false;
    }
  });

  const [route, setRoute] = useState<'public' | 'admin'>(() =>
    typeof window === 'undefined'
      ? 'public'
      : resolveAppRoute(window.location.pathname)
  );

  const [isQuickOrderOpen, setIsQuickOrderOpen] = useState(false);
  const [isBrandKitOpen, setIsBrandKitOpen] = useState(false);
  const [brandVariant, setBrandVariant] =
    useState<BrandDomainVariant>('audioworks_reg');
  const [drawerInitialFormat, setDrawerInitialFormat] = useState<OrderFormatId | null>(null);
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
    const handlePopState = () => {
      const next = resolveAppRoute(window.location.pathname);
      if (next === 'admin') {
        casePlayerEngine.stop();
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

  const navigateTo = (targetPath: '/' | '/admin') => {
    if (typeof window !== 'undefined') {
      if (targetPath === '/admin') {
        casePlayerEngine.stop();
        contrastAudioEngine.stopAll();
      }
      if (window.location.pathname !== targetPath) {
        window.history.pushState({}, '', targetPath);
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    setRoute(resolveAppRoute(targetPath));
  };

  if (route === 'admin') {
    return (
      <AdminWorkspace
        brandVariant={brandVariant}
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        onNavigateHome={() => navigateTo('/')}
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

  const handleOpenQuickOrder = (formatId: OrderFormatId | null = null) => {
    setDrawerInitialFormat(formatId);
    setIsQuickOrderOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#F7F6F2] text-[#111111] dark:bg-[#0D0D0F] dark:text-[#F4F3EF] transition-colors duration-200">
      <CompactHeaderNav
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        isQuickOrderOpen={isQuickOrderOpen}
        onOpenQuickOrder={() => handleOpenQuickOrder(null)}
        brandVariant={brandVariant}
        onOpenBrandKit={() => setIsBrandKitOpen(true)}
      />

      <main>
        <HeroKotoLens
          brandVariant={brandVariant}
          onOpenBrandKit={() => setIsBrandKitOpen(true)}
        />
        <FifteenSecDuel />
        <CasesGallery
          playerSnap={caseSnap}
          onToggleCase={(item) => casePlayerEngine.toggleCase(item)}
          onStartPreview={(item) => casePlayerEngine.startPreview(item)}
          onStopPreview={(caseId) => casePlayerEngine.stopPreview(caseId)}
        />
        <ApproachSection />
        <PricingSection onSelectFormat={(formatId) => handleOpenQuickOrder(formatId)} />
        <TestimonialsSection onOpenQuickOrder={() => handleOpenQuickOrder(null)} />
        <FaqSection />
      </main>

      <Footer
        brandVariant={brandVariant}
        onOpenBrandKit={() => setIsBrandKitOpen(true)}
        onOpenAdmin={() => navigateTo('/admin')}
      />

      <FloatingCasePlayer
        playerSnap={caseSnap}
        onStop={() => casePlayerEngine.stop()}
        onNext={() => casePlayerEngine.playNextCase(playlistWithReel)}
      />

      <LayaSimulationConsole
        isCasePlayerVisible={isCasePlayerVisible}
        onOpenBrandKit={() => setIsBrandKitOpen(true)}
      />

      <BrandKitModal
        isOpen={isBrandKitOpen}
        onClose={() => setIsBrandKitOpen(false)}
        activeSiteVariant={brandVariant}
        onSelectSiteVariant={setBrandVariant}
      />

      <QuickOrderDrawer
        isOpen={isQuickOrderOpen}
        initialFormat={drawerInitialFormat}
        onClose={() => setIsQuickOrderOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <LayaDecisionProvider>
      <StudioCmsProvider>
        <SiteTextBlocksProvider>
          <AudioworksExperience />
        </SiteTextBlocksProvider>
      </StudioCmsProvider>
    </LayaDecisionProvider>
  );
}
