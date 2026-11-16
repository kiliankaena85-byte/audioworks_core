import { Check, Copy, Download, FileCheck2, Printer, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type {
  StudioEntityKind,
  StudioLegalProfilesConfig,
} from '../../data/studioDocumentsCore';
import {
  buildRknOperatorAct,
  type PdnDestructionActContext,
  type RknOperatorActKind,
  renderRknOperatorActPrintableHtml,
} from '../../security/rknOperatorActsBuilder';

interface AdminRknActsModalProps {
  isOpen: boolean;
  onClose: () => void;
  legalProfiles: StudioLegalProfilesConfig;
  initialActKind?: RknOperatorActKind;
  initialEntityKind?: StudioEntityKind;
  destructionContext?: PdnDestructionActContext | null;
}

const ACT_TABS: readonly { id: RknOperatorActKind; label: string }[] = [
  { id: 'rkn_notification_draft', label: '1. Уведомление РКН (ст. 22)' },
  { id: 'dpo_appointment_order', label: '2. Приказ об ответственном (ст. 22.1)' },
  { id: 'pdn_destruction_act', label: '3. Акт уничтожения ПДн (Приказ № 179)' },
] as const;

export function AdminRknActsModal({
  isOpen,
  onClose,
  legalProfiles,
  initialActKind = 'rkn_notification_draft',
  initialEntityKind,
  destructionContext = null,
}: AdminRknActsModalProps) {
  const [actKind, setActKind] = useState<RknOperatorActKind>(initialActKind);
  const [entityKind, setEntityKind] = useState<StudioEntityKind>(
    initialEntityKind ?? legalProfiles.activeEntityKind ?? 'ooo'
  );
  const [copiedFlag, setCopiedFlag] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setActKind(initialActKind);
      if (initialEntityKind) {
        setEntityKind(initialEntityKind);
      } else {
        setEntityKind(legalProfiles.activeEntityKind ?? 'ooo');
      }
    }
  }, [isOpen, initialActKind, initialEntityKind, legalProfiles.activeEntityKind]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const generatedAct = useMemo(
    () =>
      buildRknOperatorAct({
        kind: actKind,
        legalProfiles,
        entityOverride: entityKind,
        destructionContext,
      }),
    [actKind, legalProfiles, entityKind, destructionContext]
  );

  if (!isOpen) return null;

  const handleDownloadHtmlA4 = () => {
    const html = renderRknOperatorActPrintableHtml(generatedAct);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${generatedAct.suggestedFileNameBase}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyPlainText = async () => {
    const plainLines: string[] = [
      generatedAct.officialTitle,
      generatedAct.lawBasisSubtitle,
      `Оператор: ${generatedAct.operatorLegalName} (ИНН ${generatedAct.operatorInn}, ${generatedAct.operatorOgrnLabel} ${generatedAct.operatorOgrnValue})`,
      `Дата: ${generatedAct.issueDateRu} · ${generatedAct.city}`,
      '',
    ];
    for (const sec of generatedAct.sections) {
      plainLines.push(sec.heading);
      for (const p of sec.paragraphs ?? []) plainLines.push(p);
      for (const r of sec.rows ?? []) plainLines.push(`- ${r.label}: ${r.value}`);
      for (const b of sec.bullets ?? []) plainLines.push(`* ${b}`);
      plainLines.push('');
    }
    plainLines.push(
      `${generatedAct.signatoryRole}: __________________ / ${generatedAct.signatoryShortName} /`
    );

    try {
      await navigator.clipboard.writeText(plainLines.join('\n'));
      setCopiedFlag(true);
      window.setTimeout(() => setCopiedFlag(false), 2200);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-rkn-acts-modal-title"
      data-testid="admin-rkn-acts-modal"
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div className="w-full max-w-4xl rounded-3xl bg-[#F7F6F2] dark:bg-[#141418] border border-[#111111]/14 dark:border-white/14 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Верхняя панель управления пакетом 152-ФЗ */}
        <div className="px-5 py-4 sm:px-6 bg-white dark:bg-[#19191F] border-b border-[#111111]/10 dark:border-white/10 space-y-3 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#C83210]">
                <FileCheck2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Пакет локальных актов Оператора ПДн (152-ФЗ · Роскомнадзор)</span>
              </div>
              <h2
                id="admin-rkn-acts-modal-title"
                className="text-base sm:text-lg font-bold text-[#111111] dark:text-[#F4F3EF]"
              >
                Внутренние документы и акты по реквизитам студии
              </h2>
            </div>

            <button
              type="button"
              data-testid="admin-rkn-acts-close-btn"
              aria-label="Закрыть окно локальных актов 152-ФЗ"
              onClick={onClose}
              className="w-9 h-9 rounded-xl border border-[#111111]/12 dark:border-white/12 inline-flex items-center justify-center text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:border-[#C83210] cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div
              role="tablist"
              aria-label="Выбор документа 152-ФЗ"
              className="flex flex-wrap items-center gap-1.5"
            >
              {ACT_TABS.map((tab) => {
                const active = actKind === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    data-testid={`rkn-act-tab-${tab.id}`}
                    aria-selected={active}
                    onClick={() => setActKind(tab.id)}
                    className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] border-transparent'
                        : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111]/78 dark:text-[#F4F3EF]/78 border-[#111111]/12 dark:border-white/12 hover:border-[#C83210]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div
              role="group"
              aria-label="Выбор юрлица Оператора"
              className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#EFECE5] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10 text-xs"
            >
              <button
                type="button"
                data-testid="rkn-act-entity-ooo"
                aria-pressed={entityKind === 'ooo'}
                onClick={() => setEntityKind('ooo')}
                className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer whitespace-nowrap ${
                  entityKind === 'ooo'
                    ? 'bg-[#C83210] text-white'
                    : 'text-[#111111]/70 dark:text-[#F4F3EF]/70'
                }`}
              >
                Профиль ООО
              </button>
              <button
                type="button"
                data-testid="rkn-act-entity-ip"
                aria-pressed={entityKind === 'ip'}
                onClick={() => setEntityKind('ip')}
                className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer whitespace-nowrap ${
                  entityKind === 'ip'
                    ? 'bg-[#C83210] text-white'
                    : 'text-[#111111]/70 dark:text-[#F4F3EF]/70'
                }`}
              >
                Профиль ИП
              </button>
            </div>
          </div>
        </div>

        {/* Лист A4 предпросмотра документа */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <article
            data-testid="admin-rkn-act-a4-sheet"
            className="max-w-3xl mx-auto rounded-2xl bg-white text-[#111111] border border-[#111111]/14 p-6 sm:p-9 space-y-5 shadow-xs tabular-nums"
          >
            <div className="border-t-4 border-[#C83210] pt-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs">
              <div>
                <p className="font-bold text-sm text-[#111111]">
                  {generatedAct.operatorLegalName}
                </p>
                <p className="text-[#111111]/68 mt-0.5">
                  ИНН {generatedAct.operatorInn} · {generatedAct.operatorOgrnLabel}{' '}
                  {generatedAct.operatorOgrnValue} · {generatedAct.operatorAddress}
                </p>
              </div>
              <div className="sm:text-right text-[#111111]/68 shrink-0">
                <p className="font-semibold text-[#111111]">
                  Рег. № {generatedAct.documentCode}
                </p>
                <p>от {generatedAct.issueDateRu}</p>
              </div>
            </div>

            <div className="space-y-1.5 pb-3 border-b border-[#111111]/12">
              <h3 className="text-sm sm:text-base font-bold leading-snug uppercase text-[#111111]">
                {generatedAct.officialTitle}
              </h3>
              <p className="text-xs text-[#111111]/64 leading-relaxed">
                {generatedAct.lawBasisSubtitle}
              </p>
              <div className="pt-1 flex items-center justify-between text-xs font-semibold">
                <span>{generatedAct.city}</span>
                <span>«{generatedAct.issueDateRu}»</span>
              </div>
            </div>

            <div className="space-y-5 text-xs sm:text-[13px] leading-relaxed">
              {generatedAct.sections.map((sec) => (
                <section key={sec.heading} className="space-y-2.5">
                  <h4 className="font-bold text-[#111111]">{sec.heading}</h4>

                  {sec.paragraphs?.map((p) => (
                    <p key={p} className="text-[#111111]/88">
                      {p}
                    </p>
                  ))}

                  {sec.rows && sec.rows.length > 0 && (
                    <div className="overflow-x-auto border border-[#111111]/15 rounded-xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <tbody className="divide-y divide-[#111111]/12">
                          {sec.rows.map((r) => (
                            <tr key={r.label} className="align-top">
                              <th
                                scope="row"
                                className="py-2.5 px-3 w-1/3 bg-[#F7F6F2] font-semibold text-[#111111]/84 border-r border-[#111111]/12"
                              >
                                {r.label}
                              </th>
                              <td className="py-2.5 px-3 text-[#111111]/90">
                                {r.value}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {sec.bullets && sec.bullets.length > 0 && (
                    <ul className="space-y-1.5 pl-4 list-disc text-[#111111]/88">
                      {sec.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>

            <div className="pt-6 mt-4 border-t border-[#111111]/15 flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-xs">
              <div>
                <p className="font-bold">{generatedAct.signatoryRole}</p>
                <p className="text-[#111111]/68">{generatedAct.operatorLegalName}</p>
              </div>
              <div className="sm:text-right">
                <p className="font-medium">
                  __________________ / {generatedAct.signatoryShortName} /
                </p>
                <p className="text-[11px] text-[#111111]/55 mt-0.5">
                  М.П. (при наличии печати)
                </p>
              </div>
            </div>
          </article>
        </div>

        {/* Нижняя панель действий: Скачать печатный лист A4 (.html), Печать и Копировать */}
        <div className="px-5 py-3.5 sm:px-6 bg-white dark:bg-[#19191F] border-t border-[#111111]/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-[#111111]/62 dark:text-[#F4F3EF]/62">
            Подставляются актуальные реквизиты из вкладки «Реквизиты и юрлицо»
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="rkn-act-copy-btn"
              onClick={() => void handleCopyPlainText()}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#111111]/16 dark:border-white/16 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] hover:border-[#C83210] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              {copiedFlag ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
              ) : (
                <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              )}
              <span>{copiedFlag ? 'Скопировано' : 'Копировать текст'}</span>
            </button>

            <button
              type="button"
              data-testid="rkn-act-print-btn"
              onClick={() => window.print()}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#111111]/16 dark:border-white/16 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] hover:border-[#C83210] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Печать A4</span>
            </button>

            <button
              type="button"
              data-testid="rkn-act-download-html-btn"
              onClick={handleDownloadHtmlA4}
              className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#C83210] hover:bg-[#AE2A0C] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Скачать бланк A4 (.html)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
