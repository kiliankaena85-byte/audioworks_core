import { useEffect, useState } from 'react';
import { casePlayerEngine, CasePlayerSnapshot } from './audio/casePlayerEngine';
import { ApproachSection } from './components/ApproachSection';
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
import { FLAGSHIP_STUDIO_REEL, getOrderedCasesForPersona } from './data/casesData';
import { OrderFormatId } from './data/pricingData';
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

  const [isQuickOrderOpen, setIsQuickOrderOpen] = useState(false);
  const [drawerInitialFormat, setDrawerInitialFormat] = useState<OrderFormatId | null>(null);
  const [caseSnap, setCaseSnap] = useState<CasePlayerSnapshot>(() =>
    casePlayerEngine.getSnapshot()
  );
  const { decision } = useLayaDecision();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch {
      // Ignore storage quota errors
    }
  }, [isDark]);

  useEffect(() => {
    const unsubscribe = casePlayerEngine.subscribe(setCaseSnap);
    return () => {
      unsubscribe();
      casePlayerEngine.stop();
    };
  }, []);

  const orderedCases = getOrderedCasesForPersona(decision.choice);
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
      />

      <main>
        <HeroKotoLens />
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

      <Footer />

      <FloatingCasePlayer
        playerSnap={caseSnap}
        onStop={() => casePlayerEngine.stop()}
        onNext={() =>
          casePlayerEngine.playNextCase([FLAGSHIP_STUDIO_REEL, ...orderedCases])
        }
      />

      <LayaSimulationConsole isCasePlayerVisible={isCasePlayerVisible} />

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
      <AudioworksExperience />
    </LayaDecisionProvider>
  );
}
