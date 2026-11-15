import {
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Repeat,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRef } from 'react';
import {
  buildDeliverableDownloadUrls,
  buildOrderAudioVersionHistory,
  extractOrderMasterFiles,
} from '../../data/clientCabinetArchitecture';
import {
  CLIENT_DELIVERY_CHANNEL_OPTIONS,
  type ClientCabinetOrderSummary,
  type ClientDeliveryChannel,
  DELIVERY_CLOUD_OPTIONS,
  DELIVERY_MESSENGER_OPTIONS,
  formatFileSizeReadable,
  mapCrmStageToClientProgress,
  type OrderDeliverableFile,
  parseDeliveryDetailSelection,
  resolveDeliveryChannelLabel,
  validateDeliveryEmail,
} from '../../data/clientCabinetHelpers';
import type { SpotRevisionKind } from '../../data/productionApprovalWorkflow';
import { formatRubCompact } from '../../data/radioInventory';
import { CabinetApprovalConveyor } from './CabinetApprovalConveyor';
import { CabinetAudioVersionHistory } from './CabinetAudioVersionHistory';
import {
  inspectInnDigits,
  normalizeInnDigits,
} from '../order/companyDetailsHelpers';

const DELIVERABLE_KIND_LABELS: Record<OrderDeliverableFile['kind'], string> = {
  audio_master: 'Аудиомастер',
  script: 'Сценарий',
  invoice: 'Счёт / документы',
  passport: 'Паспорт прав',
  archive: 'Архив / материалы',
};

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export interface CabinetOrderCardProps {
  order: ClientCabinetOrderSummary;
  isEditingInn: boolean;
  innCompanyNameDraft: string;
  onChangeInnCompanyNameDraft: (value: string) => void;
  innDigitsDraft: string;
  onChangeInnDigitsDraft: (digits: string) => void;
  innDraftInspection: ReturnType<typeof inspectInnDigits>;
  innSaveError: string | null;
  isBusyPrefs: boolean;
  onToggleInnEditor: () => void;
  onSaveCompanyInn: () => void;
  deliveryEmailDraft: string | undefined;
  onChangeDeliveryEmailDraft: (value: string) => void;
  onUpdateDeliveryPreferences: (
    nextChannel: ClientDeliveryChannel,
    nextDetail?: string
  ) => void;
  uploadNote: string;
  onChangeUploadNote: (value: string) => void;
  isUploading: boolean;
  uploadFeedback?: { kind: 'ok' | 'error'; text: string };
  onSelectClientFile: (file: File | null) => void;
  onOpenInvoiceModal: () => void;
  onRepeatOrder: () => void;
  onForgetFromDevice: () => void;
  isSubmittingApproval?: boolean;
  onApproveScript?: (conceptId?: string) => Promise<void> | void;
  onRequestScriptChanges?: (comment: string) => Promise<void> | void;
  onAcceptSpot?: (deliverableId?: string | null) => Promise<void> | void;
  onRequestSpotRevision?: (params: {
    kind: SpotRevisionKind;
    timecodeSec: number | null;
    comment: string;
  }) => Promise<void> | void;
}

export function CabinetOrderCard({
  order,
  isEditingInn,
  innCompanyNameDraft,
  onChangeInnCompanyNameDraft,
  innDigitsDraft,
  onChangeInnDigitsDraft,
  innDraftInspection,
  innSaveError,
  isBusyPrefs,
  onToggleInnEditor,
  onSaveCompanyInn,
  deliveryEmailDraft,
  onChangeDeliveryEmailDraft,
  onUpdateDeliveryPreferences,
  uploadNote,
  onChangeUploadNote,
  isUploading,
  uploadFeedback,
  onSelectClientFile,
  onOpenInvoiceModal,
  onRepeatOrder,
  onForgetFromDevice,
  isSubmittingApproval = false,
  onApproveScript,
  onRequestScriptChanges,
  onAcceptSpot,
  onRequestSpotRevision,
}: CabinetOrderCardProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const progress = mapCrmStageToClientProgress(order.stage);
  const audioHistory = buildOrderAudioVersionHistory(order);
  const { supplementaryFiles } = extractOrderMasterFiles(order);
  const parsedSel = parseDeliveryDetailSelection(
    order.preferredDeliveryChannel,
    order.preferredDeliveryDetail
  );

  return (
    <article
      data-testid={`cabinet-order-card-${order.orderNumber}`}
      className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 p-5 sm:p-7 space-y-6"
    >
      {/* Шапка карточки заказа */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-5 border-b border-[#111111]/10 dark:border-white/10">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[#111111]/62 dark:text-[#F4F3EF]/62 tabular-nums">
            <span className="font-bold text-[#111111] dark:text-[#F4F3EF]">
              #{order.orderNumber}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-[#FF4820]">
              {progress.badgeLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span>от {formatShortDate(order.createdAt)}</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
            {order.formatLabel}
          </h2>

          <p className="text-xs sm:text-sm text-[#111111]/68 dark:text-[#F4F3EF]/68">
            Контакт: <strong>{order.contact}</strong>
            {order.companyOrInn ? (
              <>
                {' '}
                · Компания: <strong>{order.companyOrInn}</strong>
              </>
            ) : (
              <> · Заявка оформлена без ИНН</>
            )}
          </p>
        </div>

        <div className="flex flex-wrap lg:flex-col items-start lg:items-end justify-between gap-2 shrink-0">
          <p className="text-2xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF] tabular-nums">
            {order.totalBudgetRub > 0
              ? formatRubCompact(order.totalBudgetRub)
              : 'Договорная'}
          </p>
          <button
            type="button"
            data-testid={`cabinet-invoice-btn-${order.orderNumber}`}
            onClick={onOpenInvoiceModal}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#111111] hover:bg-[#FF4820] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#FF4820] dark:hover:text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Открыть / скачать счёт (A4)</span>
          </button>
        </div>
      </div>

      {/* Пошаговый конвейер согласования сценария и готового ролика (3 этапа) */}
      {order.approvalWorkflow ? (
        <CabinetApprovalConveyor
          orderNumber={order.orderNumber}
          workflow={order.approvalWorkflow}
          latestDeliverableId={
            audioHistory.latestVersion?.file.id ??
            order.deliverables[0]?.id ??
            null
          }
          isSubmitting={isSubmittingApproval}
          onApproveScript={(conceptId) => onApproveScript?.(conceptId)}
          onRequestScriptChanges={(comment) =>
            onRequestScriptChanges?.(comment)
          }
          onAcceptSpot={(deliverableId) => onAcceptSpot?.(deliverableId)}
          onRequestSpotRevision={(params) => onRequestSpotRevision?.(params)}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75">
              {progress.summaryText}
            </p>
            <span className="text-xs font-semibold text-[#111111]/55 dark:text-[#F4F3EF]/55 tabular-nums">
              Этап {progress.stepIndex + 1} из {progress.totalSteps}
            </span>
          </div>

          <ol className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {progress.steps.map((step, idx) => (
              <li
                key={step.key}
                className={`rounded-xl px-3 py-2.5 border text-xs transition-colors ${
                  step.done
                    ? 'bg-[#16A34A]/8 border-[#16A34A]/30 text-[#15803D] dark:text-[#4ADE80]'
                    : step.active
                      ? 'bg-[#FF4820]/10 border-[#FF4820]/45 text-[#111111] dark:text-[#F4F3EF] font-semibold'
                      : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] border-[#111111]/8 dark:border-white/8 text-[#111111]/50 dark:text-[#F4F3EF]/50'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {step.done ? (
                    <CheckCircle2
                      className="w-3.5 h-3.5 shrink-0 text-[#16A34A] dark:text-[#4ADE80]"
                      aria-hidden="true"
                    />
                  ) : (
                    <span
                      className={`w-4 h-4 rounded-full text-[10px] font-bold inline-flex items-center justify-center shrink-0 tabular-nums ${
                        step.active
                          ? 'bg-[#FF4820] text-white'
                          : 'bg-[#111111]/10 dark:bg-white/10'
                      }`}
                    >
                      {idx + 1}
                    </span>
                  )}
                  <span className="leading-tight">{step.label}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Основная сетка: Готовые файлы слева, Управление заказом справа */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF] tabular-nums">
              Материалы и версии ролика ({order.deliverables.length})
            </h3>
            {order.cloudDiskUrl && (
              <a
                href={order.cloudDiskUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`cabinet-cloud-link-${order.orderNumber}`}
                className="min-h-[34px] px-3 py-1.5 rounded-lg bg-[#FF4820]/10 hover:bg-[#FF4820]/18 text-xs font-semibold text-[#FF4820] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <FolderOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Открыть папку на диске</span>
                <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
              </a>
            )}
          </div>

          {order.deliverables.length === 0 ? (
            <div className="py-3.5 border-t border-b border-[#111111]/8 dark:border-white/8 text-xs text-[#111111]/64 dark:text-[#F4F3EF]/64 leading-relaxed">
              Все итерации аудиоролика (черновой дубль v1, правки v2 и финальный
              мастер WAV) появятся здесь по мере записи и сведения, а также придут
              выбранным способом:{' '}
              <strong className="text-[#111111] dark:text-[#F4F3EF]">
                {resolveDeliveryChannelLabel(
                  order.preferredDeliveryChannel,
                  order.preferredDeliveryDetail
                )}
              </strong>
              .
            </div>
          ) : (
            <div className="space-y-4">
              {audioHistory.hasAudioVersions && (
                <CabinetAudioVersionHistory
                  orderNumber={order.orderNumber}
                  rescueToken={order.rescueToken}
                  history={audioHistory}
                  supplementaryCount={supplementaryFiles.length}
                  variant="active_card"
                  defaultExpandLatestAudio={true}
                />
              )}

              {supplementaryFiles.length > 0 && (
                <ul className="divide-y divide-[#111111]/8 dark:divide-white/8 border-t border-b border-[#111111]/8 dark:border-white/8">
                  {supplementaryFiles.map((file) => {
                    const { downloadHref } = buildDeliverableDownloadUrls(
                      order.orderNumber,
                      order.rescueToken,
                      file.id
                    );

                    return (
                      <li
                        key={file.id}
                        data-testid={`cabinet-deliverable-${file.id}`}
                        className="py-3 flex flex-wrap items-center justify-between gap-2.5"
                      >
                        <div className="flex items-start gap-2.5 flex-1 min-w-[200px]">
                          <FileText
                            className="w-4 h-4 text-[#FF4820] shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm font-semibold leading-snug text-[#111111] dark:text-[#F4F3EF] break-words">
                              {file.title}
                            </p>
                            <p className="text-[11px] text-[#111111]/56 dark:text-[#F4F3EF]/56 break-all sm:break-normal mt-0.5 tabular-nums">
                              {DELIVERABLE_KIND_LABELS[file.kind] ?? 'Файл'} ·{' '}
                              {file.fileName} ·{' '}
                              {formatFileSizeReadable(file.sizeBytes)}
                            </p>
                          </div>
                        </div>

                        <a
                          href={downloadHref}
                          download={file.fileName}
                          data-testid={`cabinet-download-deliverable-${file.id}`}
                          className="min-h-[34px] px-3 py-1.5 rounded-lg border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Скачать</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {order.briefText && (
            <div className="pt-2 space-y-1">
              <p className="text-xs font-semibold text-[#111111]/60 dark:text-[#F4F3EF]/60">
                Текст задачи по заказу
              </p>
              <p className="text-xs sm:text-sm text-[#111111]/82 dark:text-[#F4F3EF]/82 leading-relaxed">
                {order.briefText}
              </p>
            </div>
          )}
        </div>

        {/* Правая колонка */}
        <div className="lg:col-span-5 space-y-5 lg:border-l lg:border-[#111111]/10 lg:dark:border-white/10 lg:pl-6">
          {/* Канал получения готового ролика */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-[#111111] dark:text-[#F4F3EF]">
              Куда отправить готовый ролик
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {CLIENT_DELIVERY_CHANNEL_OPTIONS.map((opt) => {
                const selected = order.preferredDeliveryChannel === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={isBusyPrefs}
                    data-testid={`cabinet-delivery-${order.orderNumber}-${opt.id}`}
                    onClick={() => {
                      if (opt.id === 'email') {
                        const currentDraft =
                          deliveryEmailDraft ??
                          (order.preferredDeliveryChannel === 'email'
                            ? order.preferredDeliveryDetail ?? ''
                            : '');
                        const fallbackEmail =
                          currentDraft ||
                          order.clientEmail ||
                          order.contact.match(
                            /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
                          )?.[0] ||
                          '';
                        onChangeDeliveryEmailDraft(fallbackEmail);
                        if (validateDeliveryEmail(fallbackEmail)) {
                          onUpdateDeliveryPreferences('email', fallbackEmail);
                        } else {
                          onUpdateDeliveryPreferences('email', '');
                        }
                        return;
                      }
                      const nextDefaultDetail =
                        opt.id === 'messenger'
                          ? 'Telegram'
                          : opt.id === 'cloud'
                            ? 'Яндекс Диск'
                            : '';
                      onUpdateDeliveryPreferences(opt.id, nextDefaultDetail);
                    }}
                    aria-pressed={selected}
                    className={`min-h-[38px] px-2.5 py-1.5 rounded-lg border text-xs font-medium text-left transition-colors cursor-pointer inline-flex items-center justify-between gap-1 ${
                      selected
                        ? 'bg-[#111111] text-white border-[#111111] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:border-[#F4F3EF]'
                        : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111]/78 dark:text-[#F4F3EF]/78 border-[#111111]/12 dark:border-white/12 hover:border-[#FF4820]/50'
                    }`}
                  >
                    <span className="truncate">{opt.shortLabel}</span>
                    {selected && (
                      <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>

            {order.preferredDeliveryChannel === 'messenger' && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {DELIVERY_MESSENGER_OPTIONS.filter((m) => m.id !== 'other').map(
                  (m) => {
                    const active = parsedSel.messenger === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        disabled={isBusyPrefs}
                        data-testid={`cabinet-messenger-${order.orderNumber}-${m.id}`}
                        onClick={() =>
                          onUpdateDeliveryPreferences('messenger', m.label)
                        }
                        className={`min-h-[28px] px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-[#FF4820] text-white border-[#FF4820]'
                            : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111]/75 dark:text-[#F4F3EF]/75 border-[#111111]/12 dark:border-white/12 hover:border-[#FF4820]'
                        }`}
                      >
                        {m.label}
                      </button>
                    );
                  }
                )}
                {parsedSel.messenger === 'other' && parsedSel.messengerOther && (
                  <span className="text-[11px] font-semibold text-[#FF4820]">
                    Выбран: {parsedSel.messengerOther}
                  </span>
                )}
              </div>
            )}

            {order.preferredDeliveryChannel === 'cloud' && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {DELIVERY_CLOUD_OPTIONS.filter((c) => c.id !== 'other').map(
                  (c) => {
                    const active = parsedSel.cloud === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={isBusyPrefs}
                        data-testid={`cabinet-cloud-${order.orderNumber}-${c.id}`}
                        onClick={() => onUpdateDeliveryPreferences('cloud', c.label)}
                        className={`min-h-[28px] px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-[#FF4820] text-white border-[#FF4820]'
                            : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111]/75 dark:text-[#F4F3EF]/75 border-[#111111]/12 dark:border-white/12 hover:border-[#FF4820]'
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  }
                )}
                {parsedSel.cloud === 'other' && parsedSel.cloudOther && (
                  <span className="text-[11px] font-semibold text-[#FF4820]">
                    Выбрано: {parsedSel.cloudOther}
                  </span>
                )}
              </div>
            )}

            {order.preferredDeliveryChannel === 'email' && (
              <div className="flex items-center gap-1.5 pt-0.5">
                <input
                  type="email"
                  aria-label="Почта для получения ролика"
                  data-testid={`cabinet-email-input-${order.orderNumber}`}
                  value={
                    deliveryEmailDraft ?? order.preferredDeliveryDetail ?? ''
                  }
                  onChange={(e) => onChangeDeliveryEmailDraft(e.target.value)}
                  placeholder="name@company.ru"
                  className="flex-1 min-w-0 min-h-[34px] px-2.5 rounded-lg bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs"
                />
                <button
                  type="button"
                  disabled={isBusyPrefs}
                  data-testid={`cabinet-email-save-${order.orderNumber}`}
                  onClick={() =>
                    onUpdateDeliveryPreferences(
                      'email',
                      deliveryEmailDraft ?? order.preferredDeliveryDetail ?? ''
                    )
                  }
                  className="min-h-[34px] px-3 rounded-lg bg-[#FF4820] hover:bg-[#E63D18] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  ОК
                </button>
              </div>
            )}
          </div>

          {/* Реквизиты организации для счёта */}
          <div className="space-y-2 pt-3 border-t border-[#111111]/8 dark:border-white/8">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#111111] dark:text-[#F4F3EF]">
                Реквизиты для счёта и акта
              </p>
              <button
                type="button"
                data-testid={`cabinet-edit-inn-btn-${order.orderNumber}`}
                onClick={onToggleInnEditor}
                className="text-xs font-semibold text-[#FF4820] hover:underline cursor-pointer whitespace-nowrap shrink-0"
              >
                {isEditingInn
                  ? 'Отмена'
                  : order.companyOrInn
                    ? 'Изменить ИНН'
                    : '+ Добавить ИНН'}
              </button>
            </div>

            {!isEditingInn ? (
              <p className="text-xs text-[#111111]/68 dark:text-[#F4F3EF]/68">
                {order.companyOrInn
                  ? order.companyOrInn
                  : 'ИНН пока не указан — добавьте его здесь, если потребуется выставить счёт на юрлицо или ИП.'}
              </p>
            ) : (
              <div className="space-y-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 p-3">
                <input
                  type="text"
                  aria-label="Название компании или ИП"
                  value={innCompanyNameDraft}
                  onChange={(e) => onChangeInnCompanyNameDraft(e.target.value)}
                  placeholder="ООО «Компания» или ИП"
                  className="w-full min-h-[38px] px-3 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/14 dark:border-white/14 text-xs"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="ИНН организации или ИП"
                  value={innDigitsDraft}
                  onChange={(e) =>
                    onChangeInnDigitsDraft(normalizeInnDigits(e.target.value))
                  }
                  placeholder="ИНН (10 или 12 цифр)"
                  className="w-full min-h-[38px] px-3 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/14 dark:border-white/14 text-xs tabular-nums"
                />
                {innDraftInspection.statusMessage && (
                  <p
                    className={`text-[11px] ${
                      innDraftInspection.checksumValid
                        ? 'text-[#16A34A] dark:text-[#4ADE80]'
                        : 'text-[#111111]/60 dark:text-[#F4F3EF]/60'
                    }`}
                  >
                    {innDraftInspection.statusMessage}
                  </p>
                )}
                {innSaveError && (
                  <p className="text-[11px] font-medium text-[#DC2626] dark:text-[#F87171]">
                    {innSaveError}
                  </p>
                )}
                <button
                  type="button"
                  disabled={isBusyPrefs}
                  data-testid={`cabinet-save-inn-btn-${order.orderNumber}`}
                  onClick={onSaveCompanyInn}
                  className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-[#FF4820] hover:bg-[#E63D18] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {isBusyPrefs
                    ? 'Сохранение…'
                    : 'Сохранить реквизиты и обновить счёт'}
                </button>
              </div>
            )}
          </div>

          {/* Загрузка клиентских файлов */}
          <div className="space-y-2.5 pt-3 border-t border-[#111111]/8 dark:border-white/8">
            <p className="text-xs font-semibold text-[#111111] dark:text-[#F4F3EF]">
              Передать материалы к заказу (текст, логотип, референс)
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                aria-label="Комментарий к файлу"
                value={uploadNote}
                onChange={(e) => onChangeUploadNote(e.target.value)}
                placeholder="Комментарий (необязательно)"
                className="flex-1 min-h-[38px] px-3 rounded-lg bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-xs"
              />
              <input
                ref={fileInputRef}
                type="file"
                data-testid={`cabinet-file-input-${order.orderNumber}`}
                aria-label={`Загрузить файл к заказу ${order.orderNumber}`}
                onChange={(e) => {
                  const selected = e.target.files?.[0] ?? null;
                  onSelectClientFile(selected);
                  e.target.value = '';
                }}
                className="sr-only"
              />
              <button
                type="button"
                disabled={isUploading}
                data-testid={`cabinet-upload-btn-${order.orderNumber}`}
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isUploading ? 'Загрузка…' : 'Загрузить файл'}</span>
              </button>
            </div>

            {uploadFeedback && (
              <p
                className={`text-[11px] font-medium ${
                  uploadFeedback.kind === 'ok'
                    ? 'text-[#16A34A] dark:text-[#4ADE80]'
                    : 'text-[#DC2626] dark:text-[#F87171]'
                }`}
              >
                {uploadFeedback.text}
              </p>
            )}

            {order.clientUploads.length > 0 && (
              <ul className="space-y-1.5 pt-1">
                {order.clientUploads.map((up) => (
                  <li
                    key={up.id}
                    className="flex items-center justify-between gap-2 text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72 bg-[#F7F6F2] dark:bg-[#0D0D0F] px-2.5 py-1.5 rounded-lg"
                  >
                    <span className="truncate">
                      {up.fileName}
                      {up.note ? ` · ${up.note}` : ''}
                    </span>
                    <span className="text-[11px] text-[#111111]/50 dark:text-[#F4F3EF]/50 shrink-0 tabular-nums">
                      {formatFileSizeReadable(up.sizeBytes)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Действия с заказом */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#111111]/8 dark:border-white/8">
            <button
              type="button"
              data-testid={`cabinet-repeat-btn-${order.orderNumber}`}
              onClick={onRepeatOrder}
              className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-[#FF4820]/10 hover:bg-[#FF4820]/18 text-xs font-semibold text-[#FF4820] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Повторить заказ</span>
            </button>

            <button
              type="button"
              onClick={onForgetFromDevice}
              aria-label={`Убрать заказ ${order.orderNumber} из этого браузера`}
              className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs text-[#111111]/48 dark:text-[#F4F3EF]/48 hover:text-[#DC2626] inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Скрыть с устройства</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
