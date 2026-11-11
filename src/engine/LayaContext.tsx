import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import {
  evaluateLayaDecision,
  LAYA_CONTENT_DICTIONARY,
  LAYA_SIMULATION_TRACES,
  readVisitorStateFromLocation,
} from './layaEngine';
import {
  LayaDecision,
  LayaPersona,
  LayaPersonaSlot,
  LayaSimulationTrace,
  LayaVisitorState,
} from './layaTypes';

interface LayaContextValue {
  visitorState: LayaVisitorState;
  decision: LayaDecision;
  slot: LayaPersonaSlot;
  activeTraceId: string | null;
  selectSimulationTrace: (trace: LayaSimulationTrace) => void;
  selectPersonaProfile: (persona: LayaPersona) => void;
}

const LayaDecisionContext = createContext<LayaContextValue | null>(null);

const VISITS_STORAGE_KEY = 'audioworks_laya_visits_v1';

function buildInitialVisitorState(): LayaVisitorState {
  if (typeof window === 'undefined') {
    return LAYA_SIMULATION_TRACES[0].state;
  }

  let visits = 1;
  try {
    const prev = Number(window.localStorage.getItem(VISITS_STORAGE_KEY) || '0');
    visits = Number.isFinite(prev) && prev >= 0 ? Math.min(prev + 1, 3) : 1;
    window.localStorage.setItem(VISITS_STORAGE_KEY, String(visits));
  } catch {
    visits = 1;
  }

  const parsed = readVisitorStateFromLocation(
    window.location.search,
    window.innerWidth,
    document.referrer,
    visits
  );

  if (!parsed.utmTerm && !parsed.personaParam && !parsed.utmSource) {
    return { ...LAYA_SIMULATION_TRACES[0].state, visitCount: visits };
  }

  return parsed;
}

export function LayaDecisionProvider({ children }: { children: ReactNode }) {
  const [visitorState, setVisitorState] = useState<LayaVisitorState>(() =>
    buildInitialVisitorState()
  );

  const decision = useMemo(() => evaluateLayaDecision(visitorState), [visitorState]);
  const slot = LAYA_CONTENT_DICTIONARY[decision.choice];

  const selectSimulationTrace = (trace: LayaSimulationTrace) => {
    setVisitorState(trace.state);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('persona');
      url.searchParams.delete('utm_term');
      if (trace.id === 'yandex_price') {
        url.searchParams.set('utm_term', 'озвучка радио цена');
      } else if (trace.state.personaParam && trace.state.personaParam !== 'default') {
        url.searchParams.set('persona', trace.state.personaParam);
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  const selectPersonaProfile = (persona: LayaPersona) => {
    const matchingTrace = LAYA_SIMULATION_TRACES.find(
      (t) =>
        (persona === 'default' && t.id === 'guest_low_conf') ||
        (persona === 'price_searcher' && t.id === 'yandex_price') ||
        t.state.personaParam === persona
    );

    if (matchingTrace) {
      selectSimulationTrace(matchingTrace);
      return;
    }

    setVisitorState((prev) => ({
      ...prev,
      personaParam: persona,
      simulationTraceId: undefined,
    }));
  };

  const value = useMemo<LayaContextValue>(
    () => ({
      visitorState,
      decision,
      slot,
      activeTraceId: visitorState.simulationTraceId ?? null,
      selectSimulationTrace,
      selectPersonaProfile,
    }),
    [visitorState, decision, slot]
  );

  return <LayaDecisionContext.Provider value={value}>{children}</LayaDecisionContext.Provider>;
}

export function useLayaDecision(): LayaContextValue {
  const ctx = useContext(LayaDecisionContext);
  if (!ctx) {
    throw new Error('useLayaDecision must be used inside <LayaDecisionProvider>');
  }
  return ctx;
}
