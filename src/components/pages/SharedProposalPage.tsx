import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Pause,
  Play,
  ShieldCheck,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { CasePlayerSnapshot } from '../../audio/lazyAudioEngines';
import { useStudioLegalConfig } from '../../context/StudioLegalConfigContext';
import type { SharedB2bProposalPublicView } from '../../data/b2bSharedProposalCore';
import {
  BRAND_CASES,
  type BrandCasePoster,
  FLAGSHIP_STUDIO_REEL,
} from '../../data/casesData';
import { orderDraftStore } from '../../data/orderDraftStore';
import type { PlatformRoute } from '../../data/platformRouter';
import type { OrderDocumentMeta } from '../../data/studioDocumentsCore';
import {
  getVoiceArchetypeById,
  toVoiceDemoCasePoster,
} from '../../data/voiceCastingCatalog';
import { CompanyDetailsForm } from '../order/CompanyDetailsForm';

const BrandedDocumentSuiteModal = lazy(() =>
  import('../documents/BrandedDocumentSuiteModal').then((m) => ({
    default: m.BrandedDocumentSuiteModal,
  }))
);

interface SharedProposalPageProps {
  shareToken?: string;
  playerSnap: CasePlayerSnapshot;
  onToggleCase: (item: BrandCasePoster) => void;
  onNavigate: (route: PlatformRoute) => void;
}

export function SharedProposalPage({
  shareToken,
  playerSnap,
  onToggleCase,
  onNavigate,
}: SharedProposalPageProps) {
  const { legalProfiles } = useStudioLegalConfig();
  const [proposal, setProposal] = useState<SharedB2bProposalPublicView | null>(
    null
  );
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(shareToken));

  // Поля реквизитов юрлица (ИНН / ООО) для моментального формирования счёта A4 руководителем или бухгалтерией
  const [companyName, setCompanyName] = useState<string>('');
  const [companyInn, setCompanyInn] = useState<string>('');
  const [wantsDiadoc, setWantsDiadoc] = useState<boolean>(false);
  const [resolvedMeta, setResolvedMeta] = useState<OrderDocumentMeta | null>(
    null
  );
  const [isDocModalOpen, setIsDocModalOpen] = useState<boolean>(false);
  const [docInitialTab, setDocInitialTab] = useState<'kp' | 'invoice'>('invoice');

  useEffect(() => {
    if (!shareToken) {
      setIsLoading(false);
      setProposal(null);
      setErrorText(
        'Ссылка коммерческого предложения не содержит защищённого кода. Сформируйте актуальную ссылку на странице заказа.'
      );
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setErrorText(null);

    fetch(`/api/public/shared-proposals/${encodeURIComponent(shareToken)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          proposal?: SharedB2bProposalPublicView;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !json.ok || !json.proposal) {
          setProposal(null);
          setErrorText(
            json.error ||
              'Карточка коммерческого предложения не найдена или срок её действия (14 дней) истёк.'
          );
        } else {
          setProposal(json.proposal);
          if (json.proposal.corporateEntityHint) {
            setCompanyName(json.proposal.corporateEntityHint);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErrorText(
            'Не удалось загрузить коммерческое предложение. Проверьте соединение и обновите страницу.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [shareToken]);

  const demoAudioPoster: BrandCasePoster = useMemo(() => {
    if (proposal?.selectedVoiceId) {
      const voice = getVoiceArchetypeById(proposal.selectedVoiceId);
      if (voice) return toVoiceDemoCasePoster(voice);
    }
    if (proposal?.demoCaseId) {
      const matchedCase = BRAND_CASES.find(
        (c) => c.id === proposal.demoCaseId && c.audioUrl
      );
      if (matchedCase) return matchedCase;
    }
    return FLAGSHIP_STUDIO_REEL;
  }, [proposal]);

  const isPlayingDemo =
    playerSnap.activeCase?.id === demoAudioPoster.id && playerSnap.isPlaying;

  const handleApproveAndProceedToOrder = () => {
    if (!proposal) {
      onNavigate({ kind: 'order' });
      return;
    }
    orderDraftStore.prepareProductionOrder({
      formatId: proposal.selectedFormatId,
      spotDurationSec: proposal.spotDurationSec,
      selectedVoiceId: proposal.selectedVoiceId,
      industryPreset: proposal.industrySlug,
      briefHint: proposal.scrubbedTaskSummary,
      returnPath: `/proposal?token=${encodeURIComponent(shareToken ?? '')}`,
    });
    if (companyName.trim() || companyInn.trim()) {
      orderDraftStore.updateDraft({
        wantsInvoiceNow: true,
        companyName: companyName.trim(),
        companyInn: companyInn.trim(),
        wantsDiadocDuplicate: wantsDiadoc,
        resolvedCounterpartyMeta: resolvedMeta,
      });
    }
    onNavigate({ kind: 'order' });
  };

  return (
    <section
      data-testid="shared-proposal-page"
      className="py-10 sm:py-16 px-4 sm:px-6 lg:px-12"
    >
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Верхняя навигационная строка */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onNavigate({ kind: 'home' })}
            className="min-h-[40px] inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:text-[#FF4820] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>На сайт студии FMWorks</span>
          </button>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium text-[#111111]/60 dark:text-[#F4F3EF]/60 tabular-nums">
            <ShieldCheck
              className="w-3.5 h-3.5 text-[#FF4820] shrink-0"
              aria-hidden="true"
            />
            <span>Защищённая карточка согласования B2B</span>
            <span aria-hidden="true" className="opacity-40">
              ·
            </span>
            <span>0 персональных данных в ссылке (152-ФЗ)</span>
          </div>
        </div>

        {isLoading ? (
          <div
            data-testid="shared-proposal-loading"
            className="rounded-3xl p-8 sm:p-12 bg-[#EFECE5]/75 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 space-y-4"
          >
            <p className="text-sm font-medium text-[#111111]/65 dark:text-[#F4F3EF]/65">
              Загрузка спецификации коммерческого предложения…
            </p>
          </div>
        ) : errorText || !proposal ? (
          <div
            data-testid="shared-proposal-error"
            className="rounded-3xl p-8 sm:p-12 bg-[#EFECE5]/75 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 space-y-5 max-w-2xl"
          >
            <p className="text-xs font-semibold text-[#FF4820]">
              Согласование коммерческого предложения
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
              Ссылка недействительна или устарела
            </h1>
            <p className="text-sm sm:text-base text-[#111111]/72 dark:text-[#F4F3EF]/72 leading-relaxed">
              {errorText}
            </p>
            <button
              type="button"
              data-testid="shared-proposal-go-order-btn"
              onClick={() => onNavigate({ kind: 'order' })}
              className="min-h-[46px] px-6 py-2.5 rounded-full bg-[#FF4820] hover:bg-[#E63D18] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Собрать актуальное КП на странице заказа</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* Левая колонка: редакционная спецификация КП и аудио-референс */}
            <div className="lg:col-span-7 rounded-3xl p-6 sm:p-10 bg-[#EFECE5]/80 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 space-y-8 tabular-nums">
              <div className="space-y-3 pb-6 border-b border-[#111111]/10 dark:border-white/10">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold text-[#FF4820]">
                  <span>КП № {proposal.kpNumber}</span>
                  <span aria-hidden="true" className="opacity-40">
                    ·
                  </span>
                  <span>Код проекта {proposal.orderNumber}</span>
                  {proposal.corporateEntityHint && (
                    <>
                      <span aria-hidden="true" className="opacity-40">
                        ·
                      </span>
                      <span className="text-[#111111] dark:text-[#F4F3EF]">
                        Для {proposal.corporateEntityHint}
                      </span>
                    </>
                  )}
                </div>

                <h1
                  data-testid="shared-proposal-heading"
                  className="text-2xl sm:text-4xl font-bold tracking-tight leading-[1.1] text-[#111111] dark:text-[#F4F3EF] editorial-balance"
                >
                  {proposal.formatTitle} · ролик {proposal.spotDurationSec} сек
                </h1>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-[#111111]/68 dark:text-[#F4F3EF]/68">
                  <span>Срок сдачи: {proposal.turnaroundLabel}</span>
                  <span aria-hidden="true" className="opacity-40">
                    ·
                  </span>
                  <span>{proposal.taxLegalLabel}</span>
                  {proposal.industryTitle && (
                    <>
                      <span aria-hidden="true" className="opacity-40">
                        ·
                      </span>
                      <span>Отрасль: {proposal.industryTitle}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Краткая обезличенная сводка задачи */}
              <div className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[#111111]/55 dark:text-[#F4F3EF]/55">
                  Задача на продакшн (обезличена по ст. 12, 18.1 152-ФЗ)
                </h2>
                <p
                  data-testid="shared-proposal-task-summary"
                  className="text-sm sm:text-base text-[#111111]/88 dark:text-[#F4F3EF]/88 leading-relaxed"
                >
                  {proposal.scrubbedTaskSummary}
                </p>
                {proposal.selectedVoiceLabel && (
                  <p className="text-xs sm:text-sm font-semibold text-[#FF4820] pt-1">
                    Закреплённый референс тембра: {proposal.selectedVoiceLabel}
                  </p>
                )}
              </div>

              {/* Аудио-демо качества звучания прямо в карточке руководителя */}
              <div className="rounded-2xl p-4 sm:p-5 bg-[#141418] text-[#F4F3EF] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-medium text-white/60">
                    Эталон студийного звучания FMWorks (−14 LUFS)
                  </p>
                  <p className="text-sm sm:text-base font-bold text-white truncate">
                    {demoAudioPoster.client}
                  </p>
                  <p className="text-xs text-white/65 truncate">
                    {demoAudioPoster.headline}
                  </p>
                </div>

                <button
                  type="button"
                  data-testid="shared-proposal-play-demo-btn"
                  onClick={() => onToggleCase(demoAudioPoster)}
                  className="min-h-[44px] px-5 py-2.5 rounded-full bg-[#FF4820] hover:bg-[#E63D18] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {isPlayingDemo ? (
                    <Pause className="w-4 h-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <Play className="w-4 h-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>
                    {isPlayingDemo
                      ? 'Пауза демо'
                      : `Послушать референс (${demoAudioPoster.durationSec}с)`}
                  </span>
                </button>
              </div>

              {/* Что входит в стоимость и юридические гарантии */}
              <div className="space-y-3 pt-2 border-t border-[#111111]/10 dark:border-white/10">
                <h2 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                  Комплект сдачи и юридическая чистота для эфира:
                </h2>
                <ul className="space-y-2.5 text-xs sm:text-sm text-[#111111]/82 dark:text-[#F4F3EF]/82">
                  {proposal.deliverables.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check
                        className="w-4 h-4 text-[#FF4820] shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Реквизиты Исполнителя */}
              <div className="pt-4 border-t border-[#111111]/10 dark:border-white/10 text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60 space-y-1">
                <p className="font-semibold text-[#111111]/80 dark:text-[#F4F3EF]/80">
                  Исполнитель: {proposal.studioLegalName} (ИНН {proposal.studioInn})
                </p>
                <p>
                  {proposal.studioCity} · {proposal.studioPhone} ·{' '}
                  {proposal.studioEmail} · Действительно до{' '}
                  {new Date(proposal.expiresAtIso).toLocaleDateString('ru-RU')}
                </p>
              </div>
            </div>

            {/* Правая колонка: бюджет, мгновенный счёт A4 по ИНН и согласование запуска */}
            <aside className="lg:col-span-5 lg:sticky lg:top-24 rounded-3xl p-6 sm:p-8 bg-[#EFECE5] dark:bg-[#16161B] border border-[#111111]/12 dark:border-white/12 space-y-6 tabular-nums">
              <div className="pb-5 border-b border-[#111111]/10 dark:border-white/10 space-y-1.5">
                <p className="text-xs font-medium text-[#111111]/60 dark:text-[#F4F3EF]/60">
                  Итоговая стоимость по договору
                </p>
                <div
                  data-testid="shared-proposal-total-price"
                  className="text-3xl sm:text-4xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]"
                >
                  {proposal.totalPayableFormatted}
                </div>
                <p className="text-xs text-[#111111]/64 dark:text-[#F4F3EF]/64">
                  {proposal.paymentTermsLabel} · ЭДО Контур.Диадок / СБИС
                </p>
              </div>

              {/* Ввод ИНН для моментального формирования Счёта и Договора A4 прямо на экране руководителя */}
              <div className="space-y-3">
                <p className="text-xs sm:text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                  Сформировать счёт на оплату A4 по ИНН компании:
                </p>
                <CompanyDetailsForm
                  idPrefix="shared-proposal-company"
                  hideCardSwitch
                  companyName={companyName}
                  companyInn={companyInn}
                  paymentChannel="edo_invoice"
                  wantsDiadocDuplicate={wantsDiadoc}
                  onChangeWantsDiadocDuplicate={setWantsDiadoc}
                  onResolvedCounterparty={(patch) =>
                    setResolvedMeta((prev) => ({ ...(prev ?? {}), ...patch }))
                  }
                  onChangeCompanyName={setCompanyName}
                  onChangeCompanyInn={setCompanyInn}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    data-testid="shared-proposal-open-invoice-btn"
                    onClick={() => {
                      setDocInitialTab('invoice');
                      setIsDocModalOpen(true);
                    }}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#111111] hover:bg-[#FF4820] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#FF4820] dark:hover:text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Открыть счёт (A4)</span>
                  </button>

                  <button
                    type="button"
                    data-testid="shared-proposal-open-kp-btn"
                    onClick={() => {
                      setDocInitialTab('kp');
                      setIsDocModalOpen(true);
                    }}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <FileText
                      className="w-3.5 h-3.5 text-[#FF4820] shrink-0"
                      aria-hidden="true"
                    />
                    <span>Печатный бланк КП</span>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-[#111111]/10 dark:border-white/10 space-y-2.5">
                <button
                  type="button"
                  data-testid="shared-proposal-approve-launch-btn"
                  onClick={handleApproveAndProceedToOrder}
                  className="w-full min-h-[48px] px-5 py-3 rounded-full bg-[#FF4820] hover:bg-[#E63D18] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>Согласовать и запустить заказ</span>
                  <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                </button>
                <p className="text-[11px] text-[#111111]/58 dark:text-[#F4F3EF]/58 leading-relaxed">
                  Параметры КП, хронометраж {proposal.spotDurationSec} сек и
                  введённый ИНН автоматически перенесутся в форму запуска проекта.
                </p>
              </div>
            </aside>
          </div>
        )}
      </div>

      {proposal && isDocModalOpen && (
        <Suspense fallback={null}>
          <BrandedDocumentSuiteModal
            isOpen={isDocModalOpen}
            onClose={() => setIsDocModalOpen(false)}
            mode="client"
            initialDoc={docInitialTab}
            legalProfiles={legalProfiles}
            order={{
              orderNumber: proposal.orderNumber,
              createdAtIso: proposal.createdAtIso,
              formatLabel: `${proposal.formatTitle} (${proposal.spotDurationSec} сек)`,
              baseBudgetRub: proposal.totalPayableRub,
              defaultDurationSec: proposal.spotDurationSec,
              contact: 'Согласование КП руководителем',
              companyOrInn:
                [
                  companyName.trim() || proposal.corporateEntityHint,
                  companyInn.trim() ? `ИНН ${companyInn.trim()}` : '',
                ]
                  .filter(Boolean)
                  .join(' · '),
              briefText: proposal.scrubbedTaskSummary,
              documentMeta: {
                ...(resolvedMeta ?? {}),
                spotExactDurationSec: proposal.spotDurationSec,
                ...(proposal.selectedVoiceLabel
                  ? { voiceTalentLine: proposal.selectedVoiceLabel }
                  : {}),
                wantsDiadocDuplicate: wantsDiadoc,
              },
            }}
          />
        </Suspense>
      )}
    </section>
  );
}
