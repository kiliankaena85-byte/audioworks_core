import { CheckCircle2, Copy, KeyRound, LogOut } from 'lucide-react';
import { FormEvent } from 'react';
import type { ClientAccountPublicProfile } from '../../data/clientAuthShared';
import type {
  ClientAvatarPresetId,
  ResolvedClientAvatarModel,
} from '../../data/clientAvatarLogic';
import {
  CabinetAvatarEditorStrip,
  CabinetProfileAvatar,
} from './CabinetProfileAvatar';
import type { PendingBindEmailVerification } from './useClientCabinetController';
import { PersonalDataConsentField } from '../legal/PersonalDataConsentField';

export interface CabinetSessionHeaderProps {
  clientAccount: ClientAccountPublicProfile | null;
  profileAvatar: ResolvedClientAvatarModel;
  isAvatarEditorOpen: boolean;
  isSavingAvatar: boolean;
  avatarError: string | null;
  onToggleAvatarEditor: () => void;
  onSelectAvatarPreset: (presetId: ClientAvatarPresetId) => void;
  onUploadAvatarPhoto: (file: File) => void;
  onRemoveAvatarPhoto: () => void;
  ordersCount: number;
  crossDeviceLink: {
    magicLinkUrl: string;
    magicLinkPath: string;
    copied: boolean;
  } | null;
  isIssuingCrossDeviceLink: boolean;
  onIssueCrossDeviceLink: () => void;
  onDismissCrossDeviceLink: () => void;
  onOpenAccessReset: () => void;
  onLogout: () => void;
  bindEmailInput: string;
  onChangeBindEmailInput: (value: string) => void;
  bindConsentAccepted: boolean;
  onChangeBindConsentAccepted: (checked: boolean) => void;
  isBindingEmail: boolean;
  bindEmailError: string | null;
  bindConsentError: string | null;
  pendingBindVerification?: PendingBindEmailVerification | null;
  isVerifyingMagic?: boolean;
  onConfirmPendingBind?: () => void;
  onDismissPendingBind?: () => void;
  onSubmitBindEmail: (e: FormEvent) => void;
}

export function CabinetSessionHeader({
  clientAccount,
  profileAvatar,
  isAvatarEditorOpen,
  isSavingAvatar,
  avatarError,
  onToggleAvatarEditor,
  onSelectAvatarPreset,
  onUploadAvatarPhoto,
  onRemoveAvatarPhoto,
  ordersCount,
  crossDeviceLink,
  isIssuingCrossDeviceLink,
  onIssueCrossDeviceLink,
  onDismissCrossDeviceLink,
  onOpenAccessReset,
  onLogout,
  bindEmailInput,
  onChangeBindEmailInput,
  bindConsentAccepted,
  onChangeBindConsentAccepted,
  isBindingEmail,
  bindEmailError,
  bindConsentError,
  pendingBindVerification,
  isVerifyingMagic = false,
  onConfirmPendingBind,
  onDismissPendingBind,
  onSubmitBindEmail,
}: CabinetSessionHeaderProps) {
  if (clientAccount) {
    const cleanDisplayName = clientAccount.displayName.trim();

    return (
      <div
        data-testid="cabinet-authenticated-bar"
        className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 px-4 py-3.5 sm:px-6 space-y-3"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <CabinetProfileAvatar
              avatar={profileAvatar}
              isEditorOpen={isAvatarEditorOpen}
              onToggleEditor={onToggleAvatarEditor}
            />

            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-[#111111] dark:text-[#F4F3EF]">
                {cleanDisplayName && (
                  <>
                    <span
                      data-testid="cabinet-authenticated-name"
                      className="font-semibold truncate max-w-[260px] sm:max-w-[340px]"
                    >
                      {cleanDisplayName}
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-[#111111]/45 dark:text-[#F4F3EF]/45"
                    >
                      ·
                    </span>
                  </>
                )}
                <strong
                  data-testid="cabinet-authenticated-email"
                  className={
                    cleanDisplayName
                      ? 'font-medium text-xs sm:text-sm text-[#111111]/82 dark:text-[#F4F3EF]/82 truncate'
                      : 'font-semibold text-[#111111] dark:text-[#F4F3EF] truncate'
                  }
                >
                  {clientAccount.email}
                </strong>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72 tabular-nums">
                <span>Защищённый вход по почте</span>
                <span aria-hidden="true">·</span>
                <span>Проектов в кабинете: {ordersCount}</span>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  data-testid="cabinet-toggle-avatar-editor-btn"
                  aria-expanded={isAvatarEditorOpen}
                  onClick={onToggleAvatarEditor}
                  className="font-medium text-[#111111]/86 dark:text-[#F4F3EF]/86 hover:text-[#C83210] dark:hover:text-[#FF6B47] underline decoration-[#111111]/30 dark:decoration-white/30 underline-offset-3 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                >
                  {profileAvatar.hasCustomPhoto
                    ? 'Изменить фото профиля'
                    : `Аватар «${profileAvatar.initials}»`}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isIssuingCrossDeviceLink}
              data-testid="cabinet-cross-device-link-btn"
              onClick={onIssueCrossDeviceLink}
              className="min-h-[44px] sm:min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
            >
              <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>
                {isIssuingCrossDeviceLink
                  ? 'Создаём ссылку…'
                  : 'Открыть на телефоне'}
              </span>
            </button>

            <button
              type="button"
              data-testid="cabinet-open-reset-btn"
              onClick={onOpenAccessReset}
              className="min-h-[44px] sm:min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-xs font-semibold text-[#111111]/85 dark:text-[#F4F3EF]/85 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
            >
              <KeyRound className="w-3.5 h-3.5 shrink-0 text-[#C83210] dark:text-[#FF6B47]" aria-hidden="true" />
              <span>Защита сессий</span>
            </button>

            <button
              type="button"
              data-testid="cabinet-logout-btn"
              onClick={onLogout}
              className="min-h-[44px] sm:min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#111111]/16 dark:border-white/16 hover:border-[#B91C1C] hover:text-[#B91C1C] dark:hover:text-[#F87171] text-xs font-semibold text-[#111111]/80 dark:text-[#F4F3EF]/80 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Выйти</span>
            </button>
          </div>
        </div>

        {isAvatarEditorOpen && (
          <CabinetAvatarEditorStrip
            avatar={profileAvatar}
            isSavingAvatar={isSavingAvatar}
            avatarError={avatarError}
            onSelectPreset={onSelectAvatarPreset}
            onUploadPhotoFile={onUploadAvatarPhoto}
            onRemovePhoto={onRemoveAvatarPhoto}
            onClose={onToggleAvatarEditor}
          />
        )}

        {crossDeviceLink && (
          <div
            data-testid="cabinet-cross-device-link-panel"
            className="pt-2.5 border-t border-[#111111]/10 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
          >
            <p className="text-[#111111]/78 dark:text-[#F4F3EF]/78 break-all">
              {crossDeviceLink.copied
                ? 'Одноразовая ссылка скопирована в буфер обмена (действует 30 мин): '
                : 'Одноразовая ссылка для телефона или другого ПК (действует 30 мин): '}
              <code className="font-mono text-[#111111] dark:text-[#F4F3EF]">
                {crossDeviceLink.magicLinkUrl}
              </code>
            </p>
            <button
              type="button"
              onClick={onDismissCrossDeviceLink}
              className="min-h-[36px] text-xs font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72 hover:text-[#111111] dark:hover:text-[#F4F3EF] cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              Скрыть
            </button>
          </div>
        )}
      </div>
    );
  }

  if (ordersCount > 0) {
    return (
      <div
        data-testid="cabinet-bind-email-card"
        className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 p-4 sm:px-6 space-y-3"
      >
        <form
          onSubmit={onSubmitBindEmail}
          className="space-y-3"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <CabinetProfileAvatar
                avatar={profileAvatar}
                isEditorOpen={isAvatarEditorOpen}
                onToggleEditor={onToggleAvatarEditor}
              />

              <div className="space-y-0.5 min-w-0">
                <label
                  htmlFor="cabinet-bind-email-input"
                  className="block text-xs sm:text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]"
                >
                  Сохранить заказы в постоянном профиле по почте
                </label>
                <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
                  Привяжите рабочую или личную почту, чтобы заказы не зависели от одного браузера, а{' '}
                  <button
                    type="button"
                    data-testid="cabinet-toggle-avatar-editor-btn"
                    aria-expanded={isAvatarEditorOpen}
                    onClick={onToggleAvatarEditor}
                    className="font-medium text-[#111111]/86 dark:text-[#F4F3EF]/86 hover:text-[#C83210] dark:hover:text-[#FF6B47] underline decoration-[#111111]/30 dark:decoration-white/30 underline-offset-3 transition-colors cursor-pointer"
                  >
                    аватар «{profileAvatar.initials}»
                  </button>{' '}
                  сохранился в вашем аккаунте.
                </p>
                {bindEmailError && (
                  <p
                    role="alert"
                    className="text-xs font-medium text-[#B91C1C] dark:text-[#F87171]"
                  >
                    {bindEmailError}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              <input
                id="cabinet-bind-email-input"
                data-testid="cabinet-bind-email-input"
                type="email"
                value={bindEmailInput}
                onChange={(e) => onChangeBindEmailInput(e.target.value)}
                placeholder="name@company.ru"
                className="min-h-[44px] sm:min-h-[40px] sm:w-56 px-3.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/16 dark:border-white/16 text-xs sm:text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              />
              <button
                type="submit"
                disabled={isBindingEmail}
                data-testid="cabinet-bind-email-submit-btn"
                className="min-h-[44px] sm:min-h-[40px] px-4 rounded-xl bg-[#111111] hover:bg-[#C83210] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#FF4820] dark:hover:text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
              >
                {isBindingEmail ? 'Отправляем ссылку…' : 'Привязать почту'}
              </button>
            </div>
          </div>

          <PersonalDataConsentField
            id="cabinet-bind-pdn-consent"
            checked={bindConsentAccepted}
            onChange={onChangeBindConsentAccepted}
            error={bindConsentError ?? undefined}
            compact
            testIdPrefix="cabinet-bind-pdn-consent"
          />
        </form>

        {pendingBindVerification && (
          <div
            data-testid="cabinet-bind-verification-panel"
            className="pt-3 border-t border-[#111111]/10 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-start gap-2 min-w-0 text-[#111111]/80 dark:text-[#F4F3EF]/80">
              <CheckCircle2
                className="w-4 h-4 text-[#166534] dark:text-[#4ADE80] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>
                {pendingBindVerification.deliveryMode === 'local_preview' &&
                pendingBindVerification.magicLinkPath ? (
                  <>
                    Подтвердите владение почтой{' '}
                    <strong className="text-[#111111] dark:text-[#F4F3EF]">
                      {pendingBindVerification.email}
                    </strong>
                    , чтобы безопасно привязать локальные заказы к профилю:
                  </>
                ) : (
                  <>
                    Одноразовая ссылка подтверждения отправлена на{' '}
                    <strong className="text-[#111111] dark:text-[#F4F3EF]">
                      {pendingBindVerification.email}
                    </strong>{' '}
                    (действует 30 минут). Перейдите по ней из письма.
                  </>
                )}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {pendingBindVerification.deliveryMode === 'local_preview' &&
                pendingBindVerification.magicLinkPath &&
                onConfirmPendingBind && (
                  <button
                    type="button"
                    disabled={isVerifyingMagic}
                    data-testid="cabinet-bind-confirm-magic-btn"
                    onClick={onConfirmPendingBind}
                    className="min-h-[44px] sm:min-h-[38px] px-4 py-1.5 rounded-xl bg-[#C83210] hover:bg-[#B02A0C] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                  >
                    {isVerifyingMagic
                      ? 'Подтверждаем…'
                      : 'Подтвердить почту и привязать →'}
                  </button>
                )}

              {onDismissPendingBind && (
                <button
                  type="button"
                  onClick={onDismissPendingBind}
                  className="min-h-[38px] px-2.5 text-xs font-semibold text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:text-[#111111] dark:hover:text-[#F4F3EF] cursor-pointer whitespace-nowrap shrink-0"
                >
                  Скрыть
                </button>
              )}
            </div>
          </div>
        )}

        {isAvatarEditorOpen && (
          <CabinetAvatarEditorStrip
            avatar={profileAvatar}
            isSavingAvatar={isSavingAvatar}
            avatarError={avatarError}
            onSelectPreset={onSelectAvatarPreset}
            onUploadPhotoFile={onUploadAvatarPhoto}
            onRemovePhoto={onRemoveAvatarPhoto}
            onClose={onToggleAvatarEditor}
          />
        )}
      </div>
    );
  }

  return null;
}
