export type LayaPersona =
  | 'default'
  | 'price_searcher'
  | 'real_estate'
  | 'fmcg'
  | 'returning_vip';

export type RecommendedTier = 'voice_style' | 'turnkey' | 'cinema';

export type DeviceKind = 'desktop' | 'mobile';

/**
 * Входной цифровой след посетителя (совместим со схемой `VisitorState` пакета `pip install laya`).
 */
export interface LayaVisitorState {
  utmTerm: string;
  personaParam: string;
  utmSource: string;
  device: DeviceKind;
  visitCount: number;
  referrer: string;
  /** Явный след из пульта симуляции для точной демонстрации порогов Confidence */
  simulationTraceId?: string;
}

/**
 * Типизированный контракт решения Laya AI (System 1 Decision Engine).
 */
export interface LayaDecision {
  /** Итоговый выбранный профиль (при confidence < 0.75 всегда 'default') */
  choice: LayaPersona;
  /** Предварительная гипотеза до проверки порога уверенности */
  rawChoice: LayaPersona;
  /** Оценка горячести намерения 1..5 */
  intentScore: 1 | 2 | 3 | 4 | 5;
  /** Рекомендуемый ценовой формат (15k / 25k / 35k) */
  recommendedTier: RecommendedTier;
  /** Уверенность модели 0..1 (порог активации персонализации: 0.75) */
  confidence: number;
  /** Время принятия решения System 1 (~28 мс) */
  latencyMs: number;
  /** Сработал ли защитный фоллбэк на базовую эталонную версию */
  isFallback: boolean;
}

export interface LayaSimulationTrace {
  id: string;
  buttonLabel: string;
  traceSummary: string;
  state: LayaVisitorState;
  expectedConfidence: number;
}

export interface LayaPersonaSlot {
  id: LayaPersona;
  profileLabel: string;
  shortTriggerHint: string;
  /** Динамическая вторая строка манифеста под «Мы AudioWorks.» в стиле koto.com */
  kotoManifestoTagline: string;
  heroHeading: string;
  heroSubheading: string;
  streamCliches: string[];
  focusWords: string[];
  focusEyebrow: string;
  focusSurfaceClass: string;
  focusChordPreset: 'editorial' | 'crisp_value' | 'architectural' | 'warm_appetizing' | 'vip_velvet';
}
