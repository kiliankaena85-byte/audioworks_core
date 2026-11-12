import {
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { formatRubCompact } from '../../data/radioInventory';
import {
  SECURITY_DEFENSE_LAYERS,
  SecurityDefenseLayerSpec,
} from '../../security/leadShield';

const ADMIN_TOKEN_STORAGE_KEY = 'audioworks_cms_session_token_v1';

interface VerifiedLeadRow {
  id: string;
  orderNumber: string;
  createdAt: string;
  checkoutMode: 'air_plus_production' | 'production_only';
  formatLabel: string;
  totalBudgetRub: number | null;
  contact: string;
  companyOrInn: string;
  innVerified: boolean;
  channel: string;
  briefExcerpt: string;
  hasVoiceRecording: boolean;
  hasAttachedFile: boolean;
}

interface QuarantinedBotRow {
  id: string;
  createdAt: string;
  ipHash: string;
  riskScore: number;
  reasons: string[];
  maskedContact: string;
  briefPreview: string;
}

interface SecurityOverviewPayload {
  layers: readonly SecurityDefenseLayerSpec[];
  stats: {
    verifiedCount: number;
    quarantinedCount: number;
    rateLimitedCount: number;
    authBruteForceBlocks: number;
    aiQuotaShieldBlocks: number;
  };
  verifiedLeads: VerifiedLeadRow[];
  quarantinedLeads: QuarantinedBotRow[];
}

function readAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return (
      window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ||
      window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

function formatDateTimeShort(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const REASON_LABELS_RU: Record<string, string> = {
  honeypot_filled: 'Ловушка Honeypot',
  invalid_challenge_signature: 'Поддельный или отсутствующий токен',
  replayed_challenge_nonce: 'Повтор одноразового токена',
  invalid_pow_solution: 'Не пройден браузерный PoW',
  instant_subsecond_submit: 'Мгновенный скрипт (<150 мс)',
  fast_submit_timing: 'Сверхбыстрая отправка',
  zero_human_interaction: 'Нулевая моторика ввода',
  duplicate_payload_flood: 'Повтор идентичной заявки',
  xss_or_sql_injection_pattern: 'Попытка инъекции кода',
  multiple_external_links: 'Массовые внешние ссылки',
  spam_url_shortener: 'Спам-сокращатель ссылок',
  prohibited_spam_lexicon: 'Спам-лексика / рассылка',
  contact_injection_or_link: 'Ссылка или инъекция в контакте',
  company_injection_or_link: 'Ссылка или инъекция в реквизитах',
};

export function AdminSecurityPanel() {
  const [overview, setOverview] = useState<SecurityOverviewPayload>({
    layers: SECURITY_DEFENSE_LAYERS,
    stats: {
      verifiedCount: 0,
      quarantinedCount: 0,
      rateLimitedCount: 0,
      authBruteForceBlocks: 0,
      aiQuotaShieldBlocks: 0,
    },
    verifiedLeads: [],
    quarantinedLeads: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);

  const fetchOverview = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = readAdminToken();
      const res = await fetch('/api/cms/security/overview', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const data = (await res.json()) as Partial<SecurityOverviewPayload> & { ok?: boolean };
      if (data && data.stats) {
        setOverview({
          layers: Array.isArray(data.layers) ? data.layers : SECURITY_DEFENSE_LAYERS,
          stats: data.stats,
          verifiedLeads: Array.isArray(data.verifiedLeads) ? data.verifiedLeads : [],
          quarantinedLeads: Array.isArray(data.quarantinedLeads) ? data.quarantinedLeads : [],
        });
      }
    } catch {
      // Оставляем локальный срез контуров при временной недоступности сети
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOverview();
  }, [fetchOverview]);

  const handleClearQuarantine = async () => {
    if (isClearing) return;
    setIsClearing(true);
    try {
      const token = readAdminToken();
      const res = await fetch('/api/cms/security/clear-quarantine', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        setOverview((prev) => ({
          ...prev,
          quarantinedLeads: [],
        }));
      }
    } finally {
      setIsClearing(false);
    }
  };

  const totalBlockedAttempts =
    overview.stats.quarantinedCount +
    overview.stats.rateLimitedCount +
    overview.stats.aiQuotaShieldBlocks +
    overview.stats.authBruteForceBlocks;

  return (
    <div data-testid="admin-security-panel" className="space-y-8">
      {/* KPI сводка антиспам-периметра */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="rounded-2xl p-5 bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 space-y-1">
          <p className="text-xs font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58">
            Верифицированные заявки
          </p>
          <p
            data-testid="security-stat-verified"
            className="text-3xl font-bold text-[#111111] dark:text-[#F4F3EF]"
          >
            {overview.stats.verifiedCount}
          </p>
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            Прошли PoW и проверку контакта
          </p>
        </div>

        <div className="rounded-2xl p-5 bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 space-y-1">
          <p className="text-xs font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58">
            Ботов в теневом карантине
          </p>
          <p
            data-testid="security-stat-quarantined"
            className="text-3xl font-bold text-[#FF4820]"
          >
            {overview.stats.quarantinedCount}
          </p>
          <p className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58">
            Пиксели рекламы не обучены на спаме
          </p>
        </div>

        <div className="rounded-2xl p-5 bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 space-y-1">
          <p className="text-xs font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58">
            Отражено Flood и AI-атак
          </p>
          <p className="text-3xl font-bold text-[#111111] dark:text-[#F4F3EF]">
            {totalBlockedAttempts}
          </p>
          <p className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58">
            Лимит IP: {overview.stats.rateLimitedCount} · Защита квот: {overview.stats.aiQuotaShieldBlocks}
          </p>
        </div>

        <div className="rounded-2xl p-5 bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 flex flex-col justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58">
              Активных рубежей защиты
            </p>
            <p className="text-3xl font-bold text-[#111111] dark:text-[#F4F3EF] mt-1">
              {overview.layers.length} / 7
            </p>
          </div>
          <button
            type="button"
            data-testid="security-refresh-btn"
            onClick={() => void fetchOverview()}
            className="self-start inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF4820] hover:underline cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Обновить журнал</span>
          </button>
        </div>
      </div>

      {/* Две колонки журналов: Чистые лиды клиентов vs Карантин ботов */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section
          aria-labelledby="verified-leads-heading"
          className="lg:col-span-7 rounded-2xl p-5 sm:p-6 bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 space-y-4"
        >
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#111111]/10 dark:border-white/10">
            <div className="flex items-center gap-2">
              <CheckCircle2
                className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0"
                aria-hidden="true"
              />
              <h2 id="verified-leads-heading" className="text-base font-bold">
                Чистые заявки клиентов ({overview.verifiedLeads.length})
              </h2>
            </div>
            <span className="text-xs text-[#111111]/55 dark:text-[#F4F3EF]/55">
              Допущены к конверсии и продюсеру
            </span>
          </div>

          {overview.verifiedLeads.length === 0 ? (
            <p className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58 py-6">
              Верифицированных заявок в текущей сессии пока нет. Оформите тестовую бронь на странице заказа, чтобы увидеть запись и проверку ИНН.
            </p>
          ) : (
            <div
              data-testid="verified-leads-list"
              className="divide-y divide-[#111111]/8 dark:divide-white/8 text-xs tabular-nums"
            >
              {overview.verifiedLeads.map((lead) => (
                <div key={lead.id} className="py-3.5 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-sm text-[#111111] dark:text-[#F4F3EF]">
                      #{lead.orderNumber} · {lead.contact}
                    </span>
                    <span className="text-[#111111]/54 dark:text-[#F4F3EF]/54">
                      {formatDateTimeShort(lead.createdAt)}
                      {lead.totalBudgetRub !== null
                        ? ` · ${formatRubCompact(lead.totalBudgetRub)}`
                        : ''}
                    </span>
                  </div>
                  <p className="text-[#111111]/72 dark:text-[#F4F3EF]/72">
                    {lead.formatLabel}
                    {lead.companyOrInn ? ` · Реквизиты: ${lead.companyOrInn}` : ''}
                    {lead.innVerified ? ' (ИНН подтверждён по ключу ФНС)' : ''}
                  </p>
                  {lead.briefExcerpt && (
                    <p className="text-[#111111]/56 dark:text-[#F4F3EF]/56 line-clamp-2">
                      Задача: {lead.briefExcerpt}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section
          aria-labelledby="quarantine-bots-heading"
          className="lg:col-span-5 rounded-2xl p-5 sm:p-6 bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 space-y-4"
        >
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#111111]/10 dark:border-white/10">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#FF4820] shrink-0" aria-hidden="true" />
              <h2 id="quarantine-bots-heading" className="text-base font-bold">
                Теневой карантин спама ({overview.quarantinedLeads.length})
              </h2>
            </div>

            {overview.quarantinedLeads.length > 0 && (
              <button
                type="button"
                data-testid="clear-quarantine-btn"
                disabled={isClearing}
                onClick={() => void handleClearQuarantine()}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#111111]/62 dark:text-[#F4F3EF]/62 hover:text-[#DC2626] cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Очистить</span>
              </button>
            )}
          </div>

          {overview.quarantinedLeads.length === 0 ? (
            <p className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58 py-6">
              В карантине пусто — все бот-отправки изолируются здесь без передачи сигнала конверсии в рекламные кабинеты.
            </p>
          ) : (
            <div
              data-testid="quarantined-leads-list"
              className="divide-y divide-[#111111]/8 dark:divide-white/8 text-xs tabular-nums"
            >
              {overview.quarantinedLeads.map((bot) => (
                <div key={bot.id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#FF4820]">
                      Риск {bot.riskScore}/100 · IP #{bot.ipHash}
                    </span>
                    <span className="text-[#111111]/52 dark:text-[#F4F3EF]/52">
                      {formatDateTimeShort(bot.createdAt)}
                    </span>
                  </div>
                  <p className="text-[#111111]/75 dark:text-[#F4F3EF]/75">
                    Причины:{' '}
                    {bot.reasons
                      .map((r) => REASON_LABELS_RU[r] ?? r)
                      .join(' · ')}
                  </p>
                  <p className="text-[#111111]/52 dark:text-[#F4F3EF]/52 truncate">
                    Контакт: {bot.maskedContact} · Конверсия рекламы: заблокирована
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Матрица круглого стола специалистов по безопасности */}
      <section
        aria-labelledby="roundtable-layers-heading"
        className="rounded-2xl p-5 sm:p-6 bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 space-y-5"
      >
        <div className="space-y-1 pb-3 border-b border-[#111111]/10 dark:border-white/10">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#FF4820] shrink-0" aria-hidden="true" />
            <h2 id="roundtable-layers-heading" className="text-base font-bold">
              Архитектура защиты рекламного бюджета и форм (7 контуров)
            </h2>
          </div>
          <p className="text-xs text-[#111111]/62 dark:text-[#F4F3EF]/62">
            Многоуровневая фильтрация работает незаметно для B2B-клиента без визуальных капч и защищает платный трафик от скликивания и мусорных лидов.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {overview.layers.map((layer) => (
            <div
              key={layer.id}
              className="rounded-xl p-4 bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/8 dark:border-white/8 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-[#111111]/58 dark:text-[#F4F3EF]/58">
                <span>
                  {layer.code} · {layer.roleTitle}
                </span>
                <span className="text-emerald-700 dark:text-emerald-400">Активен</span>
              </div>
              <h3 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                {layer.title}
              </h3>
              <p className="text-xs leading-relaxed text-[#111111]/70 dark:text-[#F4F3EF]/70">
                {layer.summary}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
