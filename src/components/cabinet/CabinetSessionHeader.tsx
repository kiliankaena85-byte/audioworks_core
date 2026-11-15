import { Copy, KeyRound, LogOut } from 'lucide-react';
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
  isBindingEmail: boolean;
  bindEmailError: string | null;
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
  isBindingEmail,
  bindEmailError,
  onSubmitBindEmail,
}: CabinetSessionHeaderProps) {
  if (clientAccount) {
    const cleanDisplayName = clientAccount.displayName.trim();

    return (
      <div
        data-testid="cabinet-authenticated-bar"
        className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 px-4 py-4 sm:px-6 space-y-3"
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
                      className="text-[#111111]/40 dark:text-[#F4F3EF]/40"
                    >
                      ·
                    </span>
                  </>
                )}
                <strong
                  data-testid="cabinet-authenticated-email"
                  className={
                    cleanDisplayName
                      ? 'font-medium text-xs sm:text-sm text-[#111111]/78 dark:text-[#F4F3EF]/78 truncate'
                      : 'font-semibold text-[#111111] dark:text-[#F4F3EF] truncate'
                  }
                >
                  {clientAccount.email}
                </strong>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#111111]/64 dark:text-[#F4F3EF]/64 tabular-nums">
                <span>Профиль без пароля</span>
                <span aria-hidden="true">·</span>
                <span>Заказов: {ordersCount}</span>
                {typeof clientAccount.sessionEpoch === 'number' &&
                  clientAccount.sessionEpoch > 1 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Сессия #{clientAccount.sessionEpoch}</span>
                    </>
                  )}
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  data-testid="cabinet-toggle-avatar-editor-btn"
                  aria-expanded={isAvatarEditorOpen}
                  onClick={onToggleAvatarEditor}
                  className="font-medium text-[#111111]/82 dark:text-[#F4F3EF]/82 hover:text-[#FF4820] dark:hover:text-[#FF4820] underline decoration-[#111111]/25 dark:decoration-white/25 underline-offset-3 transition-colors cursor-pointer whitespace-nowrap shrink-0"
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
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>
                {isIssuingCrossDeviceLink
                  ? 'Создаём ссылку…'
                  : 'Ссылка для другого устройства'}
              </span>
            </button>

            <button
              type="button"
              data-testid="cabinet-open-reset-btn"
              onClick={onOpenAccessReset}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-xs font-semibold text-[#111111]/80 dark:text-[#F4F3EF]/80 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <KeyRound className="w-3.5 h-3.5 shrink-0 text-[#FF4820]" aria-hidden="true" />
              <span>Сброс доступа</span>
            </button>

            <button
              type="button"
              data-testid="cabinet-logout-btn"
              onClick={onLogout}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#DC2626] hover:text-[#DC2626] text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
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
            className="pt-2.5 border-t border-[#111111]/8 dark:border-white/8 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
          >
            <p className="text-[#111111]/72 dark:text-[#F4F3EF]/72 break-all">
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
              className="text-xs font-semibold text-[#111111]/58 dark:text-[#F4F3EF]/58 hover:text-[#111111] dark:hover:text-[#F4F3EF] cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
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
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        >
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
                Автоматическая регистрация: привязать заказы к вашей почте
              </label>
              <p className="text-xs text-[#111111]/62 dark:text-[#F4F3EF]/62">
                Укажите рабочую или личную почту один раз — профиль создастся без пароля, а{' '}
                <button
                  type="button"
                  data-testid="cabinet-toggle-avatar-editor-btn"
                  aria-expanded={isAvatarEditorOpen}
                  onClick={onToggleAvatarEditor}
                  className="font-medium text-[#111111]/82 dark:text-[#F4F3EF]/82 hover:text-[#FF4820] dark:hover:text-[#FF4820] underline decoration-[#111111]/25 dark:decoration-white/25 underline-offset-3 transition-colors cursor-pointer"
                >
                  аватар «{profileAvatar.initials}»
                </button>{' '}
                сохранится в вашем аккаунте.
              </p>
              {bindEmailError && (
                <p
                  role="alert"
                  className="text-xs font-medium text-[#DC2626] dark:text-[#F87171]"
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
              className="min-h-[40px] sm:w-56 px-3.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/16 dark:border-white/16 text-xs sm:text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
            />
            <button
              type="submit"
              disabled={isBindingEmail}
              data-testid="cabinet-bind-email-submit-btn"
              className="min-h-[40px] px-4 rounded-xl bg-[#111111] hover:bg-[#FF4820] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#FF4820] dark:hover:text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {isBindingEmail ? 'Привязываем…' : 'Привязать почту'}
            </button>
          </div>
        </form>

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
