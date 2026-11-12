import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

const STUDIO_EMAIL = 'hello@audioworks.ru';

function readStudioTimeHHMM(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function copyTextFallback(text: string): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.className = 'sr-only';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function Footer() {
  const [studioTime, setStudioTime] = useState<string>(() => readStudioTimeHHMM());
  const [isEmailCopied, setIsEmailCopied] = useState<boolean>(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStudioTime(readStudioTimeHHMM());
    }, 10000);
    return () => window.clearInterval(timer);
  }, []);

  const handleCopyEmail = async () => {
    let copied = false;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(STUDIO_EMAIL);
        copied = true;
      } catch {
        copied = copyTextFallback(STUDIO_EMAIL);
      }
    } else {
      copied = copyTextFallback(STUDIO_EMAIL);
    }

    if (copied || STUDIO_EMAIL) {
      setIsEmailCopied(true);
      window.setTimeout(() => {
        setIsEmailCopied(false);
      }, 2400);
    }
  };

  return (
    <footer
      id="contacts"
      className="scroll-mt-20 pt-16 pb-24 sm:py-20 lg:py-28 border-t border-[#111111]/10 dark:border-[#F4F3EF]/10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 space-y-10 sm:space-y-12 lg:space-y-16">
        {/* Единый студийный блок без гео-рамок */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 sm:gap-10">
          <div className="space-y-4 sm:space-y-5 max-w-xl">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm font-medium text-[#111111]/65 dark:text-[#F4F3EF]/65 tabular-nums">
              <span className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                Принимаем проекты онлайн
              </span>
              <span aria-hidden="true" className="opacity-40">
                ·
              </span>
              <span>
                Время студии{' '}
                <strong className="font-bold text-[#111111] dark:text-[#F4F3EF]">
                  {studioTime}
                </strong>
              </span>
            </div>

            <p className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug text-[#111111] dark:text-[#F4F3EF] editorial-balance">
              Аудиопродакшн полного цикла для амбициозных брендов.
            </p>
          </div>

          {/* Копируемый в 1 клик email hello@audioworks.ru (без горизонтального скролла на узких телефонах) */}
          <div className="flex flex-col items-start lg:items-end gap-2">
            <p className="text-xs font-medium text-[#111111]/55 dark:text-[#F4F3EF]/55">
              Прямая почта продюсеров · скопировать в 1 клик
            </p>

            <button
              type="button"
              onClick={handleCopyEmail}
              aria-label={`Скопировать адрес ${STUDIO_EMAIL}`}
              className="min-h-[48px] group flex flex-wrap items-center gap-2.5 sm:gap-3.5 text-xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF] hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors cursor-pointer text-left"
            >
              <span className="break-all sm:break-normal">{STUDIO_EMAIL}</span>
              <span
                className={`min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all shrink-0 ${
                  isEmailCopied
                    ? 'bg-[#FF4820] text-white border-[#FF4820]'
                    : 'bg-[#EFECE5] dark:bg-[#17171C] text-[#111111]/80 dark:text-[#F4F3EF]/80 border-[#111111]/12 dark:border-white/14 group-hover:border-[#FF4820]/50'
                }`}
              >
                {isEmailCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Скопировано</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Копировать</span>
                  </>
                )}
              </span>
            </button>
          </div>
        </div>

        {/* Нижняя строка копирайта */}
        <div className="pt-8 border-t border-[#111111]/10 dark:border-[#F4F3EF]/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-[#111111]/62 dark:text-[#F4F3EF]/62">
          <p className="font-medium text-[#111111] dark:text-[#F4F3EF]">
            AudioWorks<sup className="text-[10px] font-semibold ml-0.5 opacity-75">®</sup> — Аудиореклама, которая работает
          </p>

          <a
            href={`mailto:${STUDIO_EMAIL}`}
            className="min-h-[44px] inline-flex items-center hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors"
          >
            audioworks.ru
          </a>
        </div>
      </div>
    </footer>
  );
}
