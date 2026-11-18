import { Camera, ImagePlus, Trash2 } from 'lucide-react';
import { ChangeEvent, useEffect, useId, useRef, useState } from 'react';
import {
  CLIENT_ABSTRACT_AVATAR_PRESETS,
  type ClientAvatarPresetId,
  type ResolvedClientAvatarModel,
} from '../../data/clientAvatarLogic';

export interface CabinetProfileAvatarProps {
  avatar: ResolvedClientAvatarModel;
  isEditorOpen: boolean;
  onToggleEditor: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export function CabinetProfileAvatar({
  avatar,
  isEditorOpen,
  onToggleEditor,
  size = 'md',
}: CabinetProfileAvatarProps) {
  const [customPhotoFailed, setCustomPhotoFailed] = useState(false);
  const [abstractImageFailed, setAbstractImageFailed] = useState(false);

  useEffect(() => {
    setCustomPhotoFailed(false);
  }, [avatar.customPhotoUrl]);

  useEffect(() => {
    setAbstractImageFailed(false);
  }, [avatar.preset.imageUrl]);

  const showCustomPhoto =
    avatar.hasCustomPhoto && Boolean(avatar.customPhotoUrl) && !customPhotoFailed;

  const boxSizeClass =
    size === 'sm'
      ? 'w-9 h-9 sm:w-10 sm:h-10'
      : size === 'lg'
        ? 'w-14 h-14 sm:w-16 sm:h-16'
        : 'w-12 h-12 sm:w-14 sm:h-14';
  const initialsTextClass =
    size === 'sm'
      ? 'text-xs sm:text-sm'
      : size === 'lg'
        ? 'text-lg sm:text-xl'
        : 'text-base sm:text-lg';

  return (
    <button
      type="button"
      data-testid="cabinet-profile-avatar"
      data-avatar-mode={showCustomPhoto ? 'custom_photo' : 'abstract_initials'}
      data-avatar-preset={avatar.preset.id}
      data-avatar-initials={avatar.initials}
      aria-label={`${avatar.accessibleLabel}. Нажмите для настройки аватара профиля`}
      aria-expanded={isEditorOpen}
      onClick={onToggleEditor}
      className={`group relative ${boxSizeClass} rounded-xl overflow-hidden shrink-0 border border-[#111111]/16 dark:border-white/18 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820] cursor-pointer transition-transform duration-150 hover:scale-[1.02] ${avatar.preset.fallbackBgClass}`}
    >
      {showCustomPhoto && avatar.customPhotoUrl ? (
        <picture className="block w-full h-full">
          {avatar.customPhotoWebpUrl && (
            <source srcSet={avatar.customPhotoWebpUrl} type="image/webp" />
          )}
          <img
            src={avatar.customPhotoUrl}
            alt={avatar.accessibleLabel}
            referrerPolicy="no-referrer"
            decoding="async"
            onError={() => setCustomPhotoFailed(true)}
            data-testid="cabinet-profile-avatar-custom-img"
            className="w-full h-full object-cover"
          />
        </picture>
      ) : (
        <>
          {!abstractImageFailed && (
            <picture className="block w-full h-full">
              {avatar.preset.webpUrl && (
                <source srcSet={avatar.preset.webpUrl} type="image/webp" />
              )}
              <img
                src={avatar.preset.imageUrl}
                alt={avatar.accessibleLabel}
                referrerPolicy="no-referrer"
                decoding="async"
                onError={() => setAbstractImageFailed(true)}
                data-testid="cabinet-profile-avatar-abstract-img"
                className="w-full h-full object-cover"
              />
            </picture>
          )}
          {/* Контрастный скрим (>= 4.5:1 WCAG AA) для читаемости инициалов */}
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-br from-black/52 via-black/38 to-black/68"
          />
          <span
            data-testid="cabinet-profile-avatar-initials"
            aria-hidden="true"
            className={`absolute inset-0 flex items-center justify-center font-bold tracking-tight text-white select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${initialsTextClass}`}
          >
            {avatar.initials}
          </span>
        </>
      )}

      <span
        aria-hidden="true"
        className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center"
      >
        <Camera className="w-4 h-4 text-white" />
      </span>
    </button>
  );
}

export interface CabinetAvatarEditorStripProps {
  avatar: ResolvedClientAvatarModel;
  isSavingAvatar: boolean;
  avatarError: string | null;
  onSelectPreset: (presetId: ClientAvatarPresetId) => void;
  onUploadPhotoFile: (file: File) => void;
  onRemovePhoto: () => void;
  onClose: () => void;
}

export function CabinetAvatarEditorStrip({
  avatar,
  isSavingAvatar,
  avatarError,
  onSelectPreset,
  onUploadPhotoFile,
  onRemovePhoto,
  onClose,
}: CabinetAvatarEditorStripProps) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      onUploadPhotoFile(file);
    }
  };

  return (
    <div
      data-testid="cabinet-avatar-editor"
      className="pt-3 border-t border-[#111111]/10 dark:border-white/10 space-y-2.5"
    >
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <p className="text-xs font-semibold text-[#111111] dark:text-[#F4F3EF]">
            {avatar.hasCustomPhoto
              ? 'Установлено собственное фото профиля'
              : `Абстрактный студийный аватар по инициалам «${avatar.initials}»`}
          </p>
          <p className="text-xs text-[#111111]/74 dark:text-[#F4F3EF]/74">
            {avatar.hasCustomPhoto
              ? 'Вы можете заменить фотографию или удалить её, чтобы вернуть сгенерированный аватар с инициалами.'
              : 'Пока фото профиля не загружено, используется сгенерированная акустическая композиция на основе ваших инициалов.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            role="group"
            aria-label="Стиль абстрактного аватара"
            className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10"
          >
            {CLIENT_ABSTRACT_AVATAR_PRESETS.map((preset) => {
              const isSelected =
                !avatar.hasCustomPhoto && avatar.preset.id === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={isSavingAvatar}
                  aria-pressed={isSelected}
                  data-testid={`cabinet-avatar-preset-${preset.id}`}
                  onClick={() => onSelectPreset(preset.id)}
                  className={`min-h-[44px] sm:min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820] ${
                    isSelected
                      ? 'bg-white dark:bg-[#1C1C22] text-[#111111] dark:text-[#F4F3EF] border border-[#111111]/14 dark:border-white/16'
                      : 'text-[#111111]/74 dark:text-[#F4F3EF]/74 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`w-3.5 h-3.5 rounded-sm overflow-hidden shrink-0 border border-black/15 dark:border-white/20 ${preset.fallbackBgClass}`}
                  >
                    <img
                      src={preset.webpUrl ?? preset.imageUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  </span>
                  <span>{preset.shortLabel}</span>
                </button>
              );
            })}
          </div>

          <input
            ref={fileInputRef}
            id={fileInputId}
            data-testid="cabinet-avatar-file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={handleFileChange}
            className="sr-only"
          />

          <button
            type="button"
            disabled={isSavingAvatar}
            data-testid="cabinet-avatar-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[44px] sm:min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
          >
            <ImagePlus className="w-3.5 h-3.5 shrink-0 text-[#C83210] dark:text-[#FF6B47]" aria-hidden="true" />
            <span>{isSavingAvatar ? 'Сохраняем…' : 'Загрузить фото'}</span>
          </button>

          {avatar.hasCustomPhoto && (
            <button
              type="button"
              disabled={isSavingAvatar}
              data-testid="cabinet-avatar-remove-photo-btn"
              onClick={onRemovePhoto}
              className="min-h-[44px] sm:min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#111111]/16 dark:border-white/16 hover:border-[#B91C1C] hover:text-[#B91C1C] dark:hover:text-[#F87171] text-xs font-semibold text-[#111111]/82 dark:text-[#F4F3EF]/82 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Удалить фото</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] sm:min-h-[38px] px-2.5 py-1.5 text-xs font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72 hover:text-[#111111] dark:hover:text-[#F4F3EF] transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
          >
            Готово
          </button>
        </div>
      </div>

      {avatarError && (
        <p
          role="alert"
          data-testid="cabinet-avatar-error"
          className="text-xs font-medium text-[#B91C1C] dark:text-[#F87171]"
        >
          {avatarError}
        </p>
      )}
    </div>
  );
}
