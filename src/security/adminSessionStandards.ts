/**
 * Нормативы управления привилегированной сессией администратора (OWASP ASVS 5.0 V6 / V7.3.1)
 * и клавиатурной навигации по вкладкам (WAI-ARIA 1.2 Authoring Practices).
 */

/** Абсолютный срок жизни сессии администратора B2B CRM: 12 часов (43 200 сек) по ASVS L2 */
export const STUDIO_SESSION_ABSOLUTE_TTL_MS = 12 * 60 * 60 * 1000;

/** Таймаут неактивности привилегированной сессии администратора: 30 минут по ASVS V7.3.1 */
export const STUDIO_SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export interface StudioOperatorPreset {
  id: string;
  name: string;
  roleLabel: string;
}

export const STUDIO_OPERATOR_PRESETS: readonly StudioOperatorPreset[] = [
  {
    id: 'ilya_sokolov',
    name: 'Илья Соколов',
    roleLabel: 'Ведущий продюсер',
  },
  {
    id: 'elena_gromova',
    name: 'Елена Громова',
    roleLabel: 'Договорной отдел и ЭДО',
  },
  {
    id: 'alexey_morozov',
    name: 'Алексей Морозов',
    roleLabel: 'Исполнительный продюсер',
  },
] as const;

export const DEFAULT_STUDIO_OPERATOR_NAME = STUDIO_OPERATOR_PRESETS[0].name;

/**
 * Очищает и нормализует ФИО / идентификатор сотрудника студии для записи в токен сессии и журнал аудита сделок.
 */
export function sanitizeStudioOperatorName(raw: unknown): string {
  if (typeof raw !== 'string') {
    return DEFAULT_STUDIO_OPERATOR_NAME;
  }
  const cleaned = raw
    .replace(/[\u0000-\u001F\u007F<>`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64);

  return cleaned.length >= 2 ? cleaned : DEFAULT_STUDIO_OPERATOR_NAME;
}

/**
 * Серверный реестр контроля неактивности (idle timeout) сессий администраторов по nonce токена.
 */
export function createStudioSessionActivityTracker(
  idleTimeoutMs: number = STUDIO_SESSION_IDLE_TIMEOUT_MS
) {
  const lastActiveByNonce = new Map<
    string,
    { lastActiveMs: number; absoluteExpMs: number; operatorName: string }
  >();

  const prune = (nowMs: number) => {
    for (const [nonce, meta] of lastActiveByNonce.entries()) {
      if (
        meta.absoluteExpMs <= nowMs ||
        nowMs - meta.lastActiveMs > idleTimeoutMs
      ) {
        lastActiveByNonce.delete(nonce);
      }
    }
  };

  return {
    registerSession(
      nonce: string,
      absoluteExpMs: number,
      operatorName: string,
      nowMs: number = Date.now()
    ): void {
      if (!nonce) return;
      prune(nowMs);
      lastActiveByNonce.set(nonce, {
        lastActiveMs: nowMs,
        absoluteExpMs,
        operatorName: sanitizeStudioOperatorName(operatorName),
      });
    },

    /**
     * Проверяет, не истёк ли таймаут бездействия (idle timeout), и при успехе продлевает отметку активности.
     * Если сервер перезапускался и запись в памяти отсутствует, но криптографический токен валиден и не отозван,
     * инициализирует отметку активности с текущего запроса.
     */
    verifyAndTouch(
      nonce: string,
      absoluteExpMs: number,
      fallbackOperatorName: string,
      nowMs: number = Date.now()
    ): { active: boolean; reason?: 'expired_absolute' | 'expired_idle'; operatorName: string } {
      const safeOperator = sanitizeStudioOperatorName(fallbackOperatorName);
      if (!nonce || absoluteExpMs <= nowMs) {
        if (nonce) lastActiveByNonce.delete(nonce);
        return {
          active: false,
          reason: 'expired_absolute',
          operatorName: safeOperator,
        };
      }

      const existing = lastActiveByNonce.get(nonce);
      if (!existing) {
        lastActiveByNonce.set(nonce, {
          lastActiveMs: nowMs,
          absoluteExpMs,
          operatorName: safeOperator,
        });
        return { active: true, operatorName: safeOperator };
      }

      if (nowMs - existing.lastActiveMs > idleTimeoutMs) {
        lastActiveByNonce.delete(nonce);
        return {
          active: false,
          reason: 'expired_idle',
          operatorName: existing.operatorName,
        };
      }

      existing.lastActiveMs = nowMs;
      return { active: true, operatorName: existing.operatorName };
    },

    remove(nonce: string | undefined): void {
      if (!nonce) return;
      lastActiveByNonce.delete(nonce);
    },

    size(nowMs: number = Date.now()): number {
      prune(nowMs);
      return lastActiveByNonce.size;
    },
  };
}

/**
 * Вычисляет следующую вкладку при нажатии клавиш со стрелками / Home / End согласно WAI-ARIA 1.2 Tabs Pattern.
 */
export function resolveNextTabIdOnArrowKey<T extends string>(
  tabIds: readonly T[],
  currentId: T,
  key: string
): T | null {
  if (tabIds.length === 0) return null;
  const idx = tabIds.indexOf(currentId);
  const safeIdx = idx >= 0 ? idx : 0;

  if (key === 'ArrowRight' || key === 'ArrowDown') {
    return tabIds[(safeIdx + 1) % tabIds.length];
  }
  if (key === 'ArrowLeft' || key === 'ArrowUp') {
    return tabIds[(safeIdx - 1 + tabIds.length) % tabIds.length];
  }
  if (key === 'Home') {
    return tabIds[0];
  }
  if (key === 'End') {
    return tabIds[tabIds.length - 1];
  }
  return null;
}
