import { motion } from 'motion/react';
import { LAYA_CONTENT_DICTIONARY, VALID_PERSONAS } from '../engine/layaEngine';
import { useLayaDecision } from '../engine/LayaContext';
import { HeroCinemaStage } from './HeroCinemaStage';

export function HeroSection() {
  const { decision, slot, selectPersonaProfile } = useLayaDecision();

  return (
    <section id="top" className="pt-8 pb-16 lg:pt-10 lg:pb-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Bold Editorial H1 & Two-Line Bureau Subheading */}
        <div className="max-w-4xl mb-7 lg:mb-8">
          <motion.h1
            key={slot.heroHeading}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="text-[clamp(2.1rem,3.7vw,3.5rem)] font-bold tracking-tight leading-[1.06] text-[#111111] dark:text-[#F4F3EF] editorial-balance mb-3.5"
          >
            {slot.heroHeading}
          </motion.h1>

          <motion.p
            key={slot.heroSubheading}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="text-base sm:text-lg leading-relaxed text-[#111111]/72 dark:text-[#F4F3EF]/72 max-w-3xl editorial-pretty"
          >
            {slot.heroSubheading}
          </motion.p>
        </div>

        {/* Widescreen Interactive Cinema Stage: «Обычный эфир vs. Почерк AudioWorks» */}
        <HeroCinemaStage slot={slot} />

        {/* Subtle Laya AI System 1 Profile Switcher below the stage */}
        <div className="mt-8 pt-5 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10 flex flex-wrap items-center justify-between gap-4">
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Профили адаптации Laya AI"
          >
            {VALID_PERSONAS.map((personaId) => {
              const item = LAYA_CONTENT_DICTIONARY[personaId];
              const isActive = decision.choice === personaId;
              return (
                <button
                  key={personaId}
                  type="button"
                  onClick={() => selectPersonaProfile(personaId)}
                  aria-pressed={isActive}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                      : 'text-[#111111]/60 dark:text-[#F4F3EF]/60 hover:text-[#111111] dark:hover:text-[#F4F3EF] hover:bg-[#111111]/5 dark:hover:bg-[#F4F3EF]/8'
                  }`}
                >
                  {item.profileLabel}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-[#111111]/50 dark:text-[#F4F3EF]/50 tabular-nums">
            Laya System 1 · {decision.latencyMs} мс · уверенность{' '}
            {Math.round(decision.confidence * 100)}%
            {decision.isFallback ? ' (эталон)' : ''}
          </p>
        </div>
      </div>
    </section>
  );
}
