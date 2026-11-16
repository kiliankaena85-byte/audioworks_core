import {
  Check,
  Copy,
  Download,
  FileText,
  Printer,
  Save,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  counterpartyToDocumentMetaPatch,
  type CounterpartyLookupResult,
  formatKonturExternInvoiceCsv,
  resolveOfflineCounterpartyByInn,
} from '../../data/konturIntegrationCore';
import {
  assembleProductionDocumentSuite,
  BrandedDocumentKind,
  createDefaultStudioLegalProfiles,
  formatProductionSuitePlainSummary,
  FZ38_DISCLAIMER_STATUS_OPTIONS,
  Fz38DisclaimerStatus,
  OrderDocumentMeta,
  StudioEntityKind,
  StudioLegalProfilesConfig,
  StudioTaxRegimeId,
  TAX_REGIME_OPTIONS,
} from '../../data/studioDocumentsCore';
import { resolveNextTabIdOnArrowKey } from '../../security/adminSessionStandards';
import {
  ContractViewVariant,
  SwissA4DocumentSheets,
} from './SwissA4DocumentSheets';

export interface BrandedDocumentSuiteInput {
  orderId?: string;
  orderNumber: string;
  createdAtIso: string;
  formatLabel: string;
  baseBudgetRub: number;
  defaultDurationSec?: number;
  contact: string;
  companyOrInn: string;
  briefText: string;
  documentMeta?: OrderDocumentMeta | null;
}

interface BrandedDocumentSuiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'client' | 'admin';
  order: BrandedDocumentSuiteInput;
  legalProfiles?: Partial<StudioLegalProfilesConfig> | null;
  initialDoc?: BrandedDocumentKind;
  onSaveOrderDocumentMeta?: (
    orderId: string,
    nextMeta: OrderDocumentMeta,
    nextBudgetRub?: number
  ) => Promise<void> | void;
}

const DOC_TABS: readonly {
  id: BrandedDocumentKind;
  shortLabel: string;
  desktopLabel: string;
}[] = [
  { id: 'kp', shortLabel: 'КП', desktopLabel: 'Коммерческое предложение' },
  {
    id: 'contract',
    shortLabel: 'Договор + Прил.',
    desktopLabel: 'Договор и Приложение №1',
  },
  { id: 'invoice', shortLabel: 'Счёт', desktopLabel: 'Счёт на оплату' },
  {
    id: 'passport',
    shortLabel: 'Паспорт прав',
    desktopLabel: 'Паспорт ролика (РАО / ВОИС)',
  },
] as const;

export function BrandedDocumentSuiteModal({
  isOpen,
  onClose,
  mode,
  order,
  legalProfiles,
  initialDoc = 'invoice',
  onSaveOrderDocumentMeta,
}: BrandedDocumentSuiteModalProps) {
  const [activeDoc, setActiveDoc] = useState<BrandedDocumentKind>(initialDoc);
  const [contractVariant, setContractVariant] =
    useState<ContractViewVariant>('full_with_appendix');
  const [metaDraft, setMetaDraft] = useState<OrderDocumentMeta>(
    () => order.documentMeta ?? {}
  );
  const [showEditorDrawer, setShowEditorDrawer] = useState<boolean>(
    () => mode === 'admin'
  );
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const modalContainerRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const resolvedProfiles = useMemo(
    () => legalProfiles ?? createDefaultStudioLegalProfiles(),
    [legalProfiles]
  );

  useEffect(() => {
    if (!isOpen) return;
    setActiveDoc(initialDoc);
    setMetaDraft(order.documentMeta ?? {});
    setSaveFeedback(null);
  }, [isOpen, initialDoc, order.orderNumber, order.documentMeta]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const focusTimer = window.setTimeout(() => {
      const closeBtn = modalContainerRef.current?.querySelector<HTMLElement>(
        '[data-testid="suite-close-btn"]'
      );
      closeBtn?.focus();
    }, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && modalContainerRef.current) {
        const focusable = Array.from(
          modalContainerRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const activeEl = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
          if (!activeEl || activeEl === first || !modalContainerRef.current.contains(activeEl)) {
            e.preventDefault();
            last.focus();
          }
        } else if (!activeEl || activeEl === last || !modalContainerRef.current.contains(activeEl)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const appRoot = document.getElementById('root') as (HTMLElement & { inert?: boolean }) | null;
    const prevAriaHidden = appRoot?.getAttribute('aria-hidden') ?? null;
    const prevInert = Boolean(appRoot?.inert);
    if (appRoot) {
      appRoot.setAttribute('aria-hidden', 'true');
      appRoot.inert = true;
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
      if (appRoot) {
        if (prevAriaHidden === null) {
          appRoot.removeAttribute('aria-hidden');
        } else {
          appRoot.setAttribute('aria-hidden', prevAriaHidden);
        }
        appRoot.inert = prevInert;
      }
      if (previousFocusRef.current && document.contains(previousFocusRef.current)) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  const suite = useMemo(
    () =>
      assembleProductionDocumentSuite({
        orderNumber: order.orderNumber,
        createdAtIso: order.createdAtIso,
        formatLabel: order.formatLabel,
        baseBudgetRub: order.baseBudgetRub,
        defaultDurationSec: order.defaultDurationSec,
        contact: order.contact,
        companyOrInn: order.companyOrInn,
        briefText: order.briefText,
        legalProfiles: resolvedProfiles,
        documentMeta: metaDraft,
      }),
    [order, resolvedProfiles, metaDraft]
  );

  if (!isOpen || typeof document === 'undefined') return null;

  const updateMeta = (patch: Partial<OrderDocumentMeta>) => {
    setMetaDraft((prev) => ({ ...prev, ...patch }));
    if (saveFeedback) setSaveFeedback(null);
  };

  const handlePrintPdf = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    document.body.setAttribute('data-fmworks-print-active', 'true');
    const cleanup = () => {
      document.body.removeAttribute('data-fmworks-print-active');
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    // Резервное снятие атрибута через таймаут в случае отмены / headless браузера
    window.setTimeout(cleanup, 1500);
  };

  const handleCopySummary = async () => {
    const text = formatProductionSuitePlainSummary(suite, activeDoc);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // ignore clipboard denial in headless environment
    }
    setCopiedText(true);
    window.setTimeout(() => setCopiedText(false), 2200);
  };

  const handleDownloadTxt = () => {
    const text = formatProductionSuitePlainSummary(suite, activeDoc);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FMWorks-${activeDoc.toUpperCase()}-${order.orderNumber}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDownloadKonturExternCsv = () => {
    const csv = formatKonturExternInvoiceCsv(suite);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FMWorks-KonturExtern-${order.orderNumber}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleAutoFillByInn = async (rawInnInput?: string) => {
    const digits = (rawInnInput ?? metaDraft.customerInn ?? suite.customer.inn ?? '')
      .replace(/\D/g, '')
      .slice(0, 12);
    if (digits.length !== 10 && digits.length !== 12) {
      setSaveFeedback('Введите 10 цифр (юрлицо) или 12 цифр (ИП) для автозаполнения по ИНН.');
      return;
    }
    const offline = resolveOfflineCounterpartyByInn(digits);
    if (offline) {
      updateMeta(counterpartyToDocumentMetaPatch(offline));
      setSaveFeedback(`Реквизиты по ИНН ${digits} подставлены в счёт.`);
    }
    try {
      const res = await fetch(
        `/api/public/counterparty-by-inn?inn=${encodeURIComponent(digits)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (res.ok) {
        const data = (await res.json()) as {
          ok?: boolean;
          counterparty?: CounterpartyLookupResult;
        };
        if (data?.ok && data.counterparty) {
          updateMeta(counterpartyToDocumentMetaPatch(data.counterparty));
          setSaveFeedback(
            `Реквизиты ${data.counterparty.shortName} (ИНН ${digits}) обновлены.`
          );
        }
      }
    } catch {
      // Офлайн-разбор по ФНС уже применён
    }
  };

  const handleSaveMetaToOrder = async () => {
    if (!order.orderId || !onSaveOrderDocumentMeta) return;
    setIsSaving(true);
    setSaveFeedback(null);
    try {
      const nextPrice =
        typeof metaDraft.customPriceRub === 'number' &&
        Number.isFinite(metaDraft.customPriceRub) &&
        metaDraft.customPriceRub > 0
          ? metaDraft.customPriceRub
          : undefined;
      await onSaveOrderDocumentMeta(order.orderId, metaDraft, nextPrice);
      setSaveFeedback('Параметры документа и сметы сохранены в сделку.');
    } catch (err) {
      setSaveFeedback(
        err instanceof Error ? err.message : 'Не удалось сохранить изменения'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const effectiveEntityKind: StudioEntityKind =
    metaDraft.entityKindOverride === 'ip' || metaDraft.entityKindOverride === 'ooo'
      ? metaDraft.entityKindOverride
      : suite.studio.entityKind;

  const effectiveTaxId: StudioTaxRegimeId =
    metaDraft.taxRegimeOverride && metaDraft.taxRegimeOverride !== 'default'
      ? metaDraft.taxRegimeOverride
      : suite.studio.taxRegime;

  const handleSuiteTabKeyDown = (
    e: ReactKeyboardEvent<HTMLButtonElement>,
    currentId: BrandedDocumentKind
  ) => {
    const nextId = resolveNextTabIdOnArrowKey(
      DOC_TABS.map((t) => t.id),
      currentId,
      e.key
    );
    if (!nextId) return;
    e.preventDefault();
    setActiveDoc(nextId);
    const nextEl = document.getElementById(`suite-doc-tab-${nextId}`);
    nextEl?.focus();
  };

  return createPortal(
    <div
      ref={modalContainerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="branded-suite-modal-title"
      data-testid="branded-document-suite-modal"
      className="fmworks-print-portal fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-6xl h-[94dvh] sm:h-[92vh] rounded-t-3xl sm:rounded-3xl bg-[#EFECE5] dark:bg-[#131317] text-[#111111] dark:text-[#F4F3EF] border border-[#111111]/15 dark:border-white/15 flex flex-col overflow-hidden shadow-2xl min-w-0 fmworks-print-portal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Верхняя панель управления (скрывается при печати A4) */}
        <div className="fmworks-no-print px-3.5 sm:px-6 py-3.5 bg-[#F7F6F2] dark:bg-[#18181E] border-b border-[#111111]/10 dark:border-white/10 space-y-3 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72">
                Пакет брендовых документов FMWorks® · {suite.city} · Без медиапланов (только
                продакшн)
              </p>
              <h2
                id="branded-suite-modal-title"
                className="text-sm sm:text-lg font-bold tracking-tight leading-snug"
              >
                Документы по заказу #{order.orderNumber}
              </h2>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                data-testid="suite-toggle-editor-btn"
                onClick={() => setShowEditorDrawer((prev) => !prev)}
                className={`min-h-[42px] px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  showEditorDrawer
                    ? 'bg-[#111111] text-white border-[#111111] dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                    : 'border-[#111111]/16 dark:border-white/16 hover:border-[#C83210]'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">
                  {mode === 'admin' ? 'Параметры и права' : 'Уточнить реквизиты'}
                </span>
                <span className="sm:hidden">Реквизиты</span>
              </button>

              <button
                type="button"
                aria-label="Закрыть пакет документов"
                data-testid="suite-close-btn"
                onClick={onClose}
                className="min-h-[42px] min-w-[42px] rounded-xl border border-[#111111]/14 dark:border-white/14 text-[#111111] dark:text-[#F4F3EF] inline-flex items-center justify-center hover:border-[#C83210] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* 4 вкладки документов + переключатель варианта Договора */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div
              role="tablist"
              aria-label="Выбор документа FMWorks"
              className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5"
            >
              {DOC_TABS.map((tab) => {
                const active = activeDoc === tab.id;
                return (
                  <button
                    key={tab.id}
                    id={`suite-doc-tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls="suite-doc-tabpanel"
                    tabIndex={active ? 0 : -1}
                    data-testid={`suite-tab-${tab.id}`}
                    onClick={() => setActiveDoc(tab.id)}
                    onKeyDown={(e) => handleSuiteTabKeyDown(e, tab.id)}
                    className={`min-h-[42px] sm:min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-center leading-snug ${
                      active
                        ? 'bg-[#C83210] text-white'
                        : 'bg-[#EFECE5] dark:bg-[#111115] text-[#111111]/80 dark:text-[#F4F3EF]/80 hover:text-[#111111] dark:hover:text-white'
                    }`}
                  >
                    <span className="sm:hidden">{tab.shortLabel}</span>
                    <span className="hidden sm:inline">{tab.desktopLabel}</span>
                  </button>
                );
              })}
            </div>

            {activeDoc === 'contract' && (
              <div
                role="group"
                aria-label="Формат показа договора"
                className="grid grid-cols-2 sm:inline-flex p-1 rounded-xl bg-[#EFECE5] dark:bg-[#111115] border border-[#111111]/10 dark:border-white/10 gap-1"
              >
                <button
                  type="button"
                  data-testid="contract-variant-full"
                  onClick={() => setContractVariant('full_with_appendix')}
                  className={`min-h-[36px] px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer text-center leading-tight ${
                    contractVariant === 'full_with_appendix'
                      ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                      : 'text-[#111111]/70 dark:text-[#F4F3EF]/70'
                  }`}
                >
                  Договор + Прил. №{suite.appendixNumber}
                </button>
                <button
                  type="button"
                  data-testid="contract-variant-appendix"
                  onClick={() => setContractVariant('appendix_only')}
                  className={`min-h-[36px] px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer text-center leading-tight ${
                    contractVariant === 'appendix_only'
                      ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                      : 'text-[#111111]/70 dark:text-[#F4F3EF]/70'
                  }`}
                >
                  Только Прил. №{suite.appendixNumber}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Опциональная выдвижная панель уточнения реквизитов / админских полей (скрывается при печати) */}
        {showEditorDrawer && (
          <div className="fmworks-no-print px-3.5 sm:px-6 py-3.5 bg-[#F7F6F2] dark:bg-[#16161C] border-b border-[#111111]/10 dark:border-white/10 space-y-3 shrink-0 max-h-[38vh] overflow-y-auto">
            {/* Первая строка: ИП/ООО и Налог (в админке — полный контроль; клиенту показывается тихая подстройка при необходимости) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
              {mode === 'admin' && (
                <>
                  <div className="space-y-1">
                    <label
                      htmlFor="suite-entity-select"
                      className="block font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
                    >
                      Юрлицо FMWorks (г. Тверь)
                    </label>
                    <select
                      id="suite-entity-select"
                      data-testid="suite-entity-select"
                      value={effectiveEntityKind}
                      onChange={(e) => {
                        const nextKind = e.target.value as StudioEntityKind;
                        updateMeta({
                          entityKindOverride: nextKind,
                          taxRegimeOverride:
                            nextKind === 'ip' ? 'usn_no_vat' : 'osno_vat_20',
                        });
                      }}
                      className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#101014] border border-[#111111]/16 dark:border-white/16 text-xs font-semibold"
                    >
                      <option value="ip">ИП (без КПП)</option>
                      <option value="ooo">ООО (с КПП и гл. бухом)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="suite-tax-select"
                      className="block font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
                    >
                      Налоговый режим счёта
                    </label>
                    <select
                      id="suite-tax-select"
                      data-testid="suite-tax-select"
                      value={effectiveTaxId}
                      onChange={(e) =>
                        updateMeta({
                          taxRegimeOverride: e.target.value as StudioTaxRegimeId,
                        })
                      }
                      className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#101014] border border-[#111111]/16 dark:border-white/16 text-xs font-semibold"
                    >
                      {TAX_REGIME_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.shortLabel}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="suite-custom-price"
                      className="block font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
                    >
                      Сумма сметы, ₽ (если договорная)
                    </label>
                    <input
                      id="suite-custom-price"
                      data-testid="suite-custom-price-input"
                      type="number"
                      min={0}
                      step={500}
                      value={
                        typeof metaDraft.customPriceRub === 'number'
                          ? metaDraft.customPriceRub
                          : order.baseBudgetRub || ''
                      }
                      onChange={(e) =>
                        updateMeta({
                          customPriceRub: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="Например: 35000"
                      className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#101014] border border-[#111111]/16 dark:border-white/16 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="suite-appendix-number"
                      className="block font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
                    >
                      № Договора / № Приложения
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        id="suite-appendix-number"
                        type="text"
                        value={metaDraft.frameworkContractNumber ?? suite.contractNumber}
                        onChange={(e) =>
                          updateMeta({ frameworkContractNumber: e.target.value })
                        }
                        placeholder="ДП-2026/01"
                        className="flex-1 min-w-0 min-h-[40px] px-2.5 rounded-xl bg-white dark:bg-[#101014] border border-[#111111]/16 dark:border-white/16 text-xs"
                      />
                      <input
                        aria-label="Номер Приложения"
                        type="number"
                        min={1}
                        max={999}
                        value={metaDraft.appendixNumber ?? suite.appendixNumber}
                        onChange={(e) =>
                          updateMeta({
                            appendixNumber: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        className="w-16 min-h-[40px] px-2 rounded-xl bg-white dark:bg-[#101014] border border-[#111111]/16 dark:border-white/16 text-xs text-center"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Поля контрагента (доступны как клиенту перед печатью, так и продюсеру) */}
              <div className="space-y-1">
                <label
                  htmlFor="suite-cust-name"
                  className="block font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
                >
                  Заказчик (ООО или ИП)
                </label>
                <input
                  id="suite-cust-name"
                  data-testid="suite-cust-name-input"
                  type="text"
                  value={metaDraft.customerLegalName ?? ''}
                  onChange={(e) => updateMeta({ customerLegalName: e.target.value })}
                  placeholder={suite.customer.isPlaceholder ? 'ООО «Волга»' : suite.customer.displayName}
                  className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#101014] border border-[#111111]/16 dark:border-white/16 text-xs"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="suite-cust-inn"
                    className="block font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
                  >
                    ИНН Заказчика (10/12 цифр)
                  </label>
                  <button
                    type="button"
                    data-testid="suite-autofill-inn-btn"
                    onClick={() => void handleAutoFillByInn()}
                    className="min-h-[26px] px-2 py-0.5 rounded-md text-[11px] font-semibold text-[#B82D0D] dark:text-[#FF7A5C] hover:underline cursor-pointer"
                  >
                    Заполнить по ИНН
                  </button>
                </div>
                <input
                  id="suite-cust-inn"
                  data-testid="suite-cust-inn-input"
                  type="text"
                  inputMode="numeric"
                  value={metaDraft.customerInn ?? suite.customer.inn}
                  onChange={(e) => {
                    const nextDigits = e.target.value.replace(/\D/g, '').slice(0, 12);
                    updateMeta({ customerInn: nextDigits });
                    if (nextDigits.length === 10 || nextDigits.length === 12) {
                      const resolved = resolveOfflineCounterpartyByInn(nextDigits);
                      if (resolved) {
                        void handleAutoFillByInn(nextDigits);
                      }
                    }
                  }}
                  placeholder="6663003127"
                  className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#101014] border border-[#111111]/16 dark:border-white/16 text-xs tabular-nums"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="suite-cust-kpp-ogrn"
                  className="block font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
                >
                  КПП / ОГРН Заказчика
                </label>
                <div className="flex gap-1.5">
                  <input
                    id="suite-cust-kpp-ogrn"
                    data-testid="suite-cust-kpp-input"
                    type="text"
                    inputMode="numeric"
                    disabled={suite.customer.isIpByInn}
                    value={suite.customer.isIpByInn ? '' : metaDraft.customerKpp ?? suite.customer.kpp}
                    onChange={(e) =>
                      updateMeta({
                        customerKpp: e.target.value.replace(/\D/g, '').slice(0, 9),
                      })
                    }
                    placeholder={suite.customer.isIpByInn ? 'ИП без КПП' : 'КПП'}
                    className="w-[44%] min-w-0 min-h-[40px] px-2.5 rounded-xl bg-white dark:bg-[#101014] border border-[#111111]/16 dark:border-white/16 text-xs tabular-nums disabled:opacity-50"
                  />
                  <input
                    aria-label="ОГРН или ОГРНИП Заказчика"
                    data-testid="suite-cust-ogrn-input"
                    type="text"
                    inputMode="numeric"
                    value={metaDraft.customerOgrn ?? suite.customer.ogrn}
                    onChange={(e) =>
                      updateMeta({
                        customerOgrn: e.target.value.replace(/\D/g, '').slice(0, 15),
                      })
                    }
                    placeholder={suite.customer.isIpByInn ? 'ОГРНИП (15)' : 'ОГРН (13)'}
                    className="flex-1 min-w-0 min-h-[40px] px-2.5 rounded-xl bg-white dark:bg-[#101014] border border-[#111111]/16 dark:border-white/16 text-xs tabular-nums"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="suite-cust-address"
                  className="block font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
                >
                  Юридический адрес Заказчика
                </label>
                <input
                  id="suite-cust-address"
                  data-testid="suite-cust-address-input"
                  type="text"
                  value={metaDraft.customerAddress ?? suite.customer.address}
                  onChange={(e) => updateMeta({ customerAddress: e.target.value })}
                  placeholder="Индекс, город, улица, дом, офис"
                  className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#101014] border border-[#111111]/16 dark:border-white/16 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="suite-spot-title"
                  className="block font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
                >
                  Рабочее название ролика
                </label>
                <input
                  id="suite-spot-title"
                  type="text"
                  value={metaDraft.spotWorkingTitle ?? ''}
                  onChange={(e) => updateMeta({ spotWorkingTitle: e.target.value })}
                  placeholder={suite.spotWorkingTitle}
                  className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#101014] border border-[#111111]/16 dark:border-white/16 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="suite-cust-signatory"
                  className="block font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
                >
                  Подписант Заказчика
                </label>
                <input
                  id="suite-cust-signatory"
                  type="text"
                  value={metaDraft.customerSignatory ?? suite.customer.signatory}
                  onChange={(e) => updateMeta({ customerSignatory: e.target.value })}
                  placeholder="Генеральный директор Иванов И. И."
                  className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#101014] border border-[#111111]/16 dark:border-white/16 text-xs"
                />
              </div>
            </div>

            {/* Расширенные поля продюсера для Паспорта прав РАО/ВОИС и п. 3.5 техстандарта */}
            {mode === 'admin' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs pt-2 border-t border-[#111111]/8 dark:border-white/8">
                <div className="space-y-1">
                  <label
                    htmlFor="suite-voice-talent"
                    className="block font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
                  >
                    Диктор / актёр (ст. 1317 ГК РФ)
                  </label>
                  <input
                    id="suite-voice-talent"
                    type="text"
                    value={metaDraft.voiceTalentLine ?? ''}
                    onChange={(e) => updateMeta({ voiceTalentLine: e.target.value })}
                    placeholder="Ф.И.О. диктора / номер договора"
                    className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#101014] border border-[#111111]/16 dark:border-white/16 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="suite-music-license"
                    className="block font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
                  >
                    Музыкальный трек и № лицензии
                  </label>
                  <input
                    id="suite-music-license"
                    type="text"
                    value={metaDraft.musicTitleAndComposer ?? ''}
                    onChange={(e) => updateMeta({ musicTitleAndComposer: e.target.value })}
                    placeholder="Название, автор, Royalty-Free ID"
                    className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#101014] border border-[#111111]/16 dark:border-white/16 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="suite-fz38-status"
                    className="block font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
                  >
                    Статус сносок ФЗ-38
                  </label>
                  <select
                    id="suite-fz38-status"
                    value={metaDraft.fz38DisclaimerStatus ?? 'included_in_spot'}
                    onChange={(e) =>
                      updateMeta({
                        fz38DisclaimerStatus: e.target.value as Fz38DisclaimerStatus,
                      })
                    }
                    className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#101014] border border-[#111111]/16 dark:border-white/16 text-xs font-semibold"
                  >
                    {FZ38_DISCLAIMER_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.shortLabel}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="suite-special-tech"
                    className="block font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
                  >
                    Спецпараметры площадки (п. 3.5)
                  </label>
                  <input
                    id="suite-special-tech"
                    type="text"
                    value={metaDraft.specialTechOverride ?? ''}
                    onChange={(e) => updateMeta({ specialTechOverride: e.target.value })}
                    placeholder="По умолч.: стандарт радио РФ (Раздел 3)"
                    className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#101014] border border-[#111111]/16 dark:border-white/16 text-xs"
                  />
                </div>
              </div>
            )}

            {saveFeedback && (
              <p
                role="status"
                className="text-xs font-semibold text-[#166534] dark:text-[#4ADE80]"
              >
                {saveFeedback}
              </p>
            )}
          </div>
        )}

        {/* Прокручиваемая область листа A4 (WAI-ARIA tabpanel) */}
        <div
          id="suite-doc-tabpanel"
          role="tabpanel"
          aria-labelledby={`suite-doc-tab-${activeDoc}`}
          className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 fmworks-print-portal"
        >
          <SwissA4DocumentSheets
            suite={suite}
            activeDoc={activeDoc}
            contractVariant={contractVariant}
            briefExcerpt={order.briefText}
          />
        </div>

        {/* Нижняя панель действий (скрывается при печати) */}
        <div className="fmworks-no-print px-3.5 sm:px-6 py-3 bg-[#F7F6F2] dark:bg-[#18181E] border-t border-[#111111]/10 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          <p className="text-[11px] text-[#111111]/72 dark:text-[#F4F3EF]/72">
            FMWorks® · {suite.city} · {suite.studio.websiteDomain} · Формат A4 (под ЭДО и печать)
          </p>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
            {mode === 'admin' && order.orderId && onSaveOrderDocumentMeta && (
              <button
                type="button"
                disabled={isSaving}
                data-testid="suite-save-meta-btn"
                onClick={() => void handleSaveMetaToOrder()}
                className="w-full sm:w-auto min-h-[42px] px-4 py-2 rounded-xl bg-[#111111] hover:bg-[#27272A] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{isSaving ? 'Сохранение…' : 'Сохранить в сделку'}</span>
              </button>
            )}

            <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                data-testid="suite-copy-btn"
                onClick={() => void handleCopySummary()}
                className="min-h-[40px] sm:min-h-[42px] px-3 sm:px-3.5 py-2 rounded-xl border border-[#111111]/16 dark:border-white/16 hover:border-[#C83210] text-[#111111] dark:text-[#F4F3EF] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedText ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#166534] dark:text-[#4ADE80] shrink-0" aria-hidden="true" />
                    <span>Скопировано</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Скопировать</span>
                  </>
                )}
              </button>

              <button
                type="button"
                data-testid="suite-download-txt-btn"
                onClick={handleDownloadTxt}
                className="min-h-[40px] sm:min-h-[42px] px-3 sm:px-3.5 py-2 rounded-xl border border-[#111111]/16 dark:border-white/16 hover:border-[#C83210] text-[#111111] dark:text-[#F4F3EF] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Скачать (.txt)</span>
              </button>
            </div>

            {mode === 'admin' && !suite.isNegotiablePendingPrice && (
              <button
                type="button"
                data-testid="suite-download-extern-csv-btn"
                onClick={handleDownloadKonturExternCsv}
                className="w-full sm:w-auto min-h-[40px] sm:min-h-[42px] px-3.5 py-2 rounded-xl border border-[#111111]/16 dark:border-white/16 hover:border-[#C83210] text-[#111111] dark:text-[#F4F3EF] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>CSV для Контур.Экстерна</span>
              </button>
            )}

            <button
              type="button"
              data-testid="suite-print-pdf-btn"
              onClick={handlePrintPdf}
              className="w-full sm:w-auto min-h-[42px] px-4 py-2 rounded-xl bg-[#C83210] hover:bg-[#AE2A0C] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Печать / Сохранить PDF (A4)</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function SuiteTriggerBadge({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl bg-[#C83210] hover:bg-[#AE2A0C] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer text-center leading-snug"
    >
      <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span>Фирменные бланки A4 (КП · Договор · Счёт · Паспорт)</span>
    </button>
  );
}
