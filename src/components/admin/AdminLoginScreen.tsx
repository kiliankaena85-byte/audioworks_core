import { ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { BrandDomainVariant } from '../../data/brandKitData';
import { BrandLogo } from '../BrandLogo';

interface AdminLoginScreenProps {
  brandVariant: BrandDomainVariant;
  onLogin: (password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onNavigateHome: () => void;
}

export function AdminLoginScreen({
  brandVariant,
  onLogin,
  onNavigateHome,
}: AdminLoginScreenProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = password.trim();
    if (!trimmed) {
      setErrorMessage('Введите пароль студии для входа в кабинет');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    const result = await onLogin(trimmed);
    setIsSubmitting(false);

    if (!result.ok) {
      setErrorMessage(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F6F2] text-[#111111] dark:bg-[#0D0D0F] dark:text-[#F4F3EF] flex flex-col justify-between px-4 sm:px-6 py-8">
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between gap-4">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onNavigateHome();
          }}
          className="min-h-[42px] inline-flex items-center gap-2 text-sm font-medium text-[#111111]/68 dark:text-[#F4F3EF]/68 hover:text-[#111111] dark:hover:text-[#F4F3EF] transition-colors whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>На публичную витрину</span>
        </a>

        <span className="text-xs font-medium text-[#111111]/48 dark:text-[#F4F3EF]/48 whitespace-nowrap">
          Кабинет управления контентом
        </span>
      </header>

      <main className="my-auto py-12 w-full max-w-md mx-auto">
        <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-7 sm:p-9 space-y-7">
          <div className="space-y-3">
            <BrandLogo variant={brandVariant} size="md" />
            <h1 className="text-2xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
              Вход в кабинет студии
            </h1>
            <p className="text-sm leading-relaxed text-[#111111]/66 dark:text-[#F4F3EF]/66">
              Управление портфолио, аудиодорожками WAV/MP3, секцией «Дуэль 15 секунд» и коммерческими текстами сайта.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="studio-admin-password"
                className="block text-xs font-semibold text-[#111111]/78 dark:text-[#F4F3EF]/78"
              >
                Пароль студии
              </label>

              <div className="relative">
                <input
                  id="studio-admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Введите пароль доступа"
                  className="w-full min-h-[46px] pl-4 pr-11 py-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/38 dark:placeholder:text-[#F4F3EF]/36 focus:outline-none focus:border-[#FF4820]"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg inline-flex items-center justify-center text-[#111111]/55 dark:text-[#F4F3EF]/55 hover:text-[#111111] dark:hover:text-[#F4F3EF] cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>

              {errorMessage && (
                <p
                  role="alert"
                  data-testid="admin-login-error"
                  className="text-xs font-medium text-[#DC2626] dark:text-[#F87171]"
                >
                  {errorMessage}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="admin-login-submit"
              className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-[#FF4820] hover:bg-[#E63D18] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{isSubmitting ? 'Проверка доступа…' : 'Войти в кабинет'}</span>
            </button>
          </form>
        </div>
      </main>

      <footer className="max-w-5xl w-full mx-auto text-center text-xs text-[#111111]/45 dark:text-[#F4F3EF]/45">
        FMWorks · Студийная система управления портфолио и эфирными материалами
      </footer>
    </div>
  );
}
