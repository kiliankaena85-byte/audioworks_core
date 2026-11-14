import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import { Component, ErrorInfo, ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
  onResetRoute?: () => void;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  message: string;
}

/**
 * Глобальный предохранитель рендеринга React: предотвращает «белый экран»
 * и даёт пользователю мгновенный возврат на главную или повторную инициализацию.
 */
export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  public override state: AppErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  public static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Непредвиденная ошибка интерфейса',
    };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[FMWorks ErrorBoundary]', error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: '' });
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, message: '' });
    if (this.props.onResetRoute) {
      this.props.onResetRoute();
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.assign('/');
    }
  };

  public override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        data-testid="app-error-boundary"
        className="min-h-screen bg-[#F7F6F2] text-[#111111] dark:bg-[#0D0D0F] dark:text-[#F4F3EF] flex items-center justify-center p-4 sm:p-8"
      >
        <div className="max-w-lg w-full rounded-3xl bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 p-6 sm:p-8 space-y-5 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-[#FF4820]/10 text-[#FF4820] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#111111]/55 dark:text-[#F4F3EF]/55">
                FMWorks · Восстановление экрана
              </p>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                Раздел временно не смог отобразиться
              </h1>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-[#111111]/72 dark:text-[#F4F3EF]/72">
            Ваши данные формы и черновик заказа сохранены локально. Попробуйте
            повторить отрисовку раздела или вернитесь на главную страницу.
          </p>

          {this.state.message && (
            <p className="text-xs font-mono px-3 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10 text-[#111111]/65 dark:text-[#F4F3EF]/65 break-words">
              {this.state.message}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              type="button"
              data-testid="error-boundary-retry-btn"
              onClick={this.handleRetry}
              className="min-h-[44px] px-5 py-2.5 rounded-full bg-[#FF4820] hover:bg-[#E63D18] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Повторить отображение</span>
            </button>

            <button
              type="button"
              data-testid="error-boundary-home-btn"
              onClick={this.handleGoHome}
              className="min-h-[44px] px-5 py-2.5 rounded-full border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Home className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>На главную FMWorks</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
