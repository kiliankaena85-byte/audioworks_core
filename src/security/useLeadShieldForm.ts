import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_LEAD_MAX_ATTEMPTS,
  DEFAULT_LEAD_MIN_INTERVAL_MS,
  DEFAULT_LEAD_WINDOW_MS,
  evaluateLeadSubmissionSecurity,
  LeadSecurityVerdict,
  resolveLeadFormRateScope,
  solveLeadChallengePow,
} from './leadShield';
import { useRateLimit } from './useRateLimit';

export interface ServerLeadChallenge {
  challengeToken: string;
  salt: string;
  difficulty: number;
  issuedAt: number;
  expiresAt: number;
}

export interface SubmitProtectedLeadInput {
  source: 'order_page' | 'standalone_hold_modal' | 'quick_order_drawer';
  checkoutMode: 'air_plus_production' | 'production_only';
  orderNumberCandidate: string;
  formatLabel: string;
  totalBudgetRub?: number;
  contactLine: string;
  companyLine: string;
  briefText: string;
  hasVoiceRecording: boolean;
  hasAttachedFile: boolean;
  isReturningFastTrack: boolean;
  requireBriefOrVoice: boolean;
  /** Если вызывающий компонент (например, OrderPage) уже зафиксировал попытку через useRateLimit */
  skipClientRateConsume?: boolean;
}

export interface SubmitProtectedLeadResult {
  ok: boolean;
  verdict: LeadSecurityVerdict | 'rate_limited';
  orderNumber: string;
  conversionAllowed: boolean;
  verifiedConversionSeal: string | null;
  innVerified: boolean;
  remainingAttempts?: number;
  retryAfterSec?: number;
  contactError?: string;
  companyError?: string;
  taskError?: string;
  rateLimitError?: string;
}

async function fetchServerChallenge(): Promise<ServerLeadChallenge | null> {
  try {
    const res = await fetch('/api/security/challenge', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<ServerLeadChallenge> & { ok?: boolean };
    if (
      data &&
      typeof data.challengeToken === 'string' &&
      typeof data.salt === 'string'
    ) {
      return {
        challengeToken: data.challengeToken,
        salt: data.salt,
        difficulty: typeof data.difficulty === 'number' ? data.difficulty : 3,
        issuedAt: typeof data.issuedAt === 'number' ? data.issuedAt : Date.now(),
        expiresAt:
          typeof data.expiresAt === 'number' ? data.expiresAt : Date.now() + 3600_000,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function useLeadShieldForm(
  defaultCheckoutMode: 'air_plus_production' | 'production_only' = 'production_only'
) {
  const [websiteTrap, setWebsiteTrap] = useState('');
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);

  const defaultScope = resolveLeadFormRateScope(defaultCheckoutMode);
  const {
    countdownSec: rateLimitCountdownSec,
    remainingAttempts,
    checkRateLimit,
    recordAttempt,
    triggerCooldown,
    syncState,
  } = useRateLimit({
    scope: defaultScope,
    maxAttempts: DEFAULT_LEAD_MAX_ATTEMPTS,
    windowMs: DEFAULT_LEAD_WINDOW_MS,
    minIntervalMs: DEFAULT_LEAD_MIN_INTERVAL_MS,
  });

  const mountedAtRef = useRef<number>(Date.now());
  const pointerMovesRef = useRef<number>(0);
  const keystrokesRef = useRef<number>(0);
  const focusEventsRef = useRef<number>(0);
  const challengeRef = useRef<ServerLeadChallenge | null>(null);
  const inflightChallengeRef = useRef<Promise<ServerLeadChallenge | null> | null>(null);

  const refreshChallenge = useCallback((): Promise<ServerLeadChallenge | null> => {
    const promise = fetchServerChallenge().then((ch) => {
      challengeRef.current = ch;
      inflightChallengeRef.current = null;
      return ch;
    });
    inflightChallengeRef.current = promise;
    return promise;
  }, []);

  useEffect(() => {
    mountedAtRef.current = Date.now();
    syncState(resolveLeadFormRateScope(defaultCheckoutMode));
    void refreshChallenge();
  }, [defaultCheckoutMode, refreshChallenge, syncState]);

  const registerPointerActivity = useCallback(() => {
    if (pointerMovesRef.current < 120) {
      pointerMovesRef.current += 1;
    }
  }, []);

  const registerKeyActivity = useCallback(() => {
    if (keystrokesRef.current < 500) {
      keystrokesRef.current += 1;
    }
  }, []);

  const registerFocusActivity = useCallback(() => {
    if (focusEventsRef.current < 80) {
      focusEventsRef.current += 1;
    }
  }, []);

  const resetShieldAfterOrder = useCallback(() => {
    mountedAtRef.current = Date.now();
    setWebsiteTrap('');
    syncState(resolveLeadFormRateScope(defaultCheckoutMode));
    void refreshChallenge();
  }, [defaultCheckoutMode, refreshChallenge, syncState]);

  const submitProtectedLead = useCallback(
    async (input: SubmitProtectedLeadInput): Promise<SubmitProtectedLeadResult> => {
      const rateScope = resolveLeadFormRateScope(input.checkoutMode);

      if (!input.skipClientRateConsume) {
        // 1. Клиентский useRateLimit (localStorage): проверяем лимит до обработки и сетевого запроса
        const preRateCheck = checkRateLimit(rateScope);
        if (!preRateCheck.allowed) {
          return {
            ok: false,
            verdict: 'rate_limited',
            orderNumber: input.orderNumberCandidate,
            conversionAllowed: false,
            verifiedConversionSeal: null,
            innVerified: false,
            remainingAttempts: 0,
            retryAfterSec: preRateCheck.retryAfterSec,
            rateLimitError: preRateCheck.message,
          };
        }
      }

      // 2. Быстрая клиентская предпроверка полей (не списывает квоту localStorage при опечатке живого клиента)
      if (!websiteTrap.trim()) {
        const localPrecheck = evaluateLeadSubmissionSecurity({
          contactLine: input.contactLine,
          companyLine: input.companyLine,
          briefText: input.briefText,
          hasVoiceRecording: input.hasVoiceRecording,
          hasAttachedFile: input.hasAttachedFile,
          isReturningFastTrack: input.isReturningFastTrack,
          requireBriefOrVoice: input.requireBriefOrVoice,
          websiteTrap: '',
          dwellMs: Math.max(500, Date.now() - mountedAtRef.current),
          pointerMoves: Math.max(1, pointerMovesRef.current),
          keystrokes: keystrokesRef.current,
          focusEvents: Math.max(1, focusEventsRef.current),
          challengeValid: true,
          nonceAlreadyUsed: false,
          powValid: true,
          isDuplicateRecentPayload: false,
        });

        if (localPrecheck.verdict === 'validation_error') {
          const snapshotRate = syncState(rateScope);
          return {
            ok: false,
            verdict: 'validation_error',
            orderNumber: input.orderNumberCandidate,
            conversionAllowed: false,
            verifiedConversionSeal: null,
            innVerified: false,
            remainingAttempts: snapshotRate.remainingAttempts,
            contactError: localPrecheck.contactError,
            companyError: localPrecheck.companyError,
            taskError: localPrecheck.taskError,
          };
        }
      }

      // 3. Фиксируем попытку отправки в localStorage через useRateLimit (если ещё не списана вызывающей формой)
      const consumedLocalRate = input.skipClientRateConsume
        ? syncState(rateScope)
        : recordAttempt(rateScope);
      if (!input.skipClientRateConsume && !consumedLocalRate.allowed) {
        return {
          ok: false,
          verdict: 'rate_limited',
          orderNumber: input.orderNumberCandidate,
          conversionAllowed: false,
          verifiedConversionSeal: null,
          innVerified: false,
          remainingAttempts: 0,
          retryAfterSec: consumedLocalRate.retryAfterSec,
          rateLimitError: consumedLocalRate.message,
        };
      }

      setIsSubmittingLead(true);
      try {
        let activeChallenge = challengeRef.current;
        if (!activeChallenge || activeChallenge.expiresAt <= Date.now()) {
          activeChallenge =
            (await (inflightChallengeRef.current ?? refreshChallenge())) ?? null;
        }

        const pow = activeChallenge
          ? solveLeadChallengePow(activeChallenge.salt, activeChallenge.difficulty)
          : { solution: '', hashHex: '', iterations: 0 };

        const dwellMs = Math.max(0, Date.now() - mountedAtRef.current);

        const response = await fetch('/api/orders/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...input,
            rateScope,
            clientRemainingAttempts: consumedLocalRate.remainingAttempts,
            websiteTrap,
            dwellMs,
            pointerMoves: pointerMovesRef.current,
            keystrokes: keystrokesRef.current,
            focusEvents: focusEventsRef.current,
            challengeToken: activeChallenge?.challengeToken ?? '',
            powSolution: pow.solution,
          }),
        });

        const payload = (await response.json()) as {
          ok?: boolean;
          verdict?: LeadSecurityVerdict | 'rate_limited';
          orderNumber?: string;
          conversionAllowed?: boolean;
          verifiedConversionSeal?: string | null;
          innVerified?: boolean;
          contactError?: string;
          companyError?: string;
          taskError?: string;
          error?: string;
          retryAfterSec?: number;
          rateLimit?: {
            remainingAttempts?: number;
            maxAttempts?: number;
            retryAfterSec?: number;
          };
          nextChallenge?: ServerLeadChallenge;
        };

        if (payload?.nextChallenge?.challengeToken) {
          challengeRef.current = payload.nextChallenge;
        } else if (response.ok) {
          void refreshChallenge();
        }

        if (response.status === 429 || payload.verdict === 'rate_limited') {
          const waitSec =
            payload.retryAfterSec ?? payload.rateLimit?.retryAfterSec ?? 60;
          const errMessage =
            payload.error ??
            `Превышен лимит отправок с одного адреса. Повторите через ${waitSec} сек.`;
          triggerCooldown(waitSec, errMessage);
          return {
            ok: false,
            verdict: 'rate_limited',
            orderNumber: input.orderNumberCandidate,
            conversionAllowed: false,
            verifiedConversionSeal: null,
            innVerified: false,
            remainingAttempts: 0,
            retryAfterSec: waitSec,
            rateLimitError: errMessage,
          };
        }

        if (!response.ok || payload.verdict === 'validation_error') {
          return {
            ok: false,
            verdict: 'validation_error',
            orderNumber: input.orderNumberCandidate,
            conversionAllowed: false,
            verifiedConversionSeal: null,
            innVerified: false,
            remainingAttempts: consumedLocalRate.remainingAttempts,
            contactError: payload.contactError,
            companyError: payload.companyError,
            taskError: payload.taskError,
          };
        }

        const finalVerdict: LeadSecurityVerdict =
          payload.verdict === 'quarantined_bot' ? 'quarantined_bot' : 'verified_human';

        const conversionAllowed =
          finalVerdict === 'verified_human' && payload.conversionAllowed === true;

        if (typeof window !== 'undefined' && conversionAllowed && payload.verifiedConversionSeal) {
          window.dispatchEvent(
            new CustomEvent('fmworks:verified-lead-conversion', {
              detail: {
                orderNumber: payload.orderNumber ?? input.orderNumberCandidate,
                seal: payload.verifiedConversionSeal,
              },
            })
          );
        }

        return {
          ok: true,
          verdict: finalVerdict,
          orderNumber: payload.orderNumber ?? input.orderNumberCandidate,
          conversionAllowed,
          verifiedConversionSeal: payload.verifiedConversionSeal ?? null,
          innVerified: Boolean(payload.innVerified),
          remainingAttempts:
            payload.rateLimit?.remainingAttempts ??
            consumedLocalRate.remainingAttempts ??
            DEFAULT_LEAD_MAX_ATTEMPTS,
        };
      } catch {
        const fallbackEval = evaluateLeadSubmissionSecurity({
          contactLine: input.contactLine,
          companyLine: input.companyLine,
          briefText: input.briefText,
          hasVoiceRecording: input.hasVoiceRecording,
          hasAttachedFile: input.hasAttachedFile,
          isReturningFastTrack: input.isReturningFastTrack,
          requireBriefOrVoice: input.requireBriefOrVoice,
          websiteTrap,
          dwellMs: Math.max(0, Date.now() - mountedAtRef.current),
          pointerMoves: Math.max(1, pointerMovesRef.current),
          keystrokes: keystrokesRef.current,
          focusEvents: Math.max(1, focusEventsRef.current),
          challengeValid: true,
          nonceAlreadyUsed: false,
          powValid: true,
          isDuplicateRecentPayload: false,
        });

        if (fallbackEval.verdict === 'validation_error') {
          return {
            ok: false,
            verdict: 'validation_error',
            orderNumber: input.orderNumberCandidate,
            conversionAllowed: false,
            verifiedConversionSeal: null,
            innVerified: false,
            remainingAttempts: consumedLocalRate.remainingAttempts,
            contactError: fallbackEval.contactError,
            companyError: fallbackEval.companyError,
            taskError: fallbackEval.taskError,
          };
        }

        return {
          ok: true,
          verdict: fallbackEval.verdict,
          orderNumber: input.orderNumberCandidate,
          conversionAllowed: fallbackEval.conversionAllowed,
          verifiedConversionSeal: null,
          innVerified: fallbackEval.innVerified,
          remainingAttempts: consumedLocalRate.remainingAttempts,
        };
      } finally {
        setIsSubmittingLead(false);
      }
    },
    [checkRateLimit, recordAttempt, refreshChallenge, syncState, triggerCooldown, websiteTrap]
  );

  return {
    websiteTrap,
    setWebsiteTrap,
    isSubmittingLead,
    rateLimitCountdownSec,
    remainingAttempts,
    registerPointerActivity,
    registerKeyActivity,
    registerFocusActivity,
    resetShieldAfterOrder,
    submitProtectedLead,
  };
}
