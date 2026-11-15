import { CheckCircle2, Lock, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { RF_COMPLIANCE_PASSPORT_ITEMS } from '../../security/rfLegalCompliance';
import { BrandLogo } from '../BrandLogo';

export type PersonalData152FzTab = 'policy' | 'consent' | 'rf_security';

interface PersonalData152FzModalProps {
  isOpen: boolean;
  initialTab?: PersonalData152FzTab;
  onClose: () => void;
  onAcceptConsent?: () => void;
}

export function PersonalData152FzModal({
  isOpen,
  initialTab = 'policy',
  onClose,
  onAcceptConsent,
}: PersonalData152FzModalProps) {
  const [activeTab, setActiveTab] = useState<PersonalData152FzTab>(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdn-152fz-modal-title"
      data-testid="pdn-152fz-modal"
      className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-3xl max-h-[92dvh] sm:max-h-[88vh] rounded-t-3xl sm:rounded-3xl bg-[#F7F6F2] dark:bg-[#141418] text-[#111111] dark:text-[#F4F3EF] border border-[#111111]/14 dark:border-white/14 flex flex-col overflow-hidden shadow-2xl min-w-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка документа */}
        <div className="px-4 sm:px-6 py-4 border-b border-[#111111]/10 dark:border-white/10 flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#111111]/62 dark:text-[#F4F3EF]/62">
              <BrandLogo variant="fmworks_reg" size="sm" />
              <span aria-hidden="true">·</span>
              <span>152-ФЗ «О персональных данных» · Законы РФ</span>
            </div>
            <h2
              id="pdn-152fz-modal-title"
              className="text-base sm:text-xl font-bold tracking-tight leading-snug"
            >
              Политика обработки и защиты персональных данных (152-ФЗ)
            </h2>
          </div>

          <button
            type="button"
            aria-label="Закрыть документ о персональных данных"
            data-testid="pdn-152fz-close-btn"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl border border-[#111111]/12 dark:border-white/12 inline-flex items-center justify-center text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:text-[#111111] dark:hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Переключатель вкладок */}
        <div
          role="tablist"
          aria-label="Разделы правовой информации 152-ФЗ"
          className="px-4 sm:px-6 pt-3 pb-2 border-b border-[#111111]/8 dark:border-white/8 flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'policy'}
            data-testid="pdn-tab-policy"
            onClick={() => setActiveTab('policy')}
            className={`min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-center leading-snug ${
              activeTab === 'policy'
                ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                : 'bg-[#EFECE5] dark:bg-[#1C1C22] text-[#111111]/75 dark:text-[#F4F3EF]/75 hover:text-[#111111] dark:hover:text-white'
            }`}
          >
            Политика обработки ПДн (ст. 18.1 152-ФЗ)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'consent'}
            data-testid="pdn-tab-consent"
            onClick={() => setActiveTab('consent')}
            className={`min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-center leading-snug ${
              activeTab === 'consent'
                ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                : 'bg-[#EFECE5] dark:bg-[#1C1C22] text-[#111111]/75 dark:text-[#F4F3EF]/75 hover:text-[#111111] dark:hover:text-white'
            }`}
          >
            Текст согласия субъекта ПДн (ст. 9)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'rf_security'}
            data-testid="pdn-tab-rf-security"
            onClick={() => setActiveTab('rf_security')}
            className={`min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-center leading-snug ${
              activeTab === 'rf_security'
                ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                : 'bg-[#EFECE5] dark:bg-[#1C1C22] text-[#111111]/75 dark:text-[#F4F3EF]/75 hover:text-[#111111] dark:hover:text-white'
            }`}
          >
            Локализация и защита данных в РФ
          </button>
        </div>

        {/* Содержимое документа */}
        <div className="px-4 sm:px-6 py-5 overflow-y-auto flex-1 space-y-5 text-xs sm:text-sm leading-relaxed">
          {activeTab === 'policy' && (
            <>
              <div className="rounded-2xl p-4 bg-[#EFECE5] dark:bg-[#1B1B22] border border-[#111111]/10 dark:border-white/10 space-y-1.5 text-xs">
                <p className="font-bold text-[#111111] dark:text-[#F4F3EF]">
                  Сведения об Операторе персональных данных:
                </p>
                <p className="text-[#111111]/80 dark:text-[#F4F3EF]/80">
                  Аудиопродакшн-студия FMWorks® (ИП Соколов Артём Викторович, ИНН 695008412904,
                  ОГРНИП 322695200041850 / ООО «ФМ Воркс Продакшн», ИНН 6950241890, КПП 695001001).
                </p>
                <p className="text-[#111111]/72 dark:text-[#F4F3EF]/72">
                  Адрес местонахождения: 170100, Россия, Тверская обл., г. Тверь, ул. Советская, д. 45
                  · Официальный сайт: fmworks.ru · Электронная почта для обращений: hello@fmworks.ru
                  · Тел.: +7 (4822) 75-04-20.
                </p>
              </div>

              <section className="space-y-1.5">
                <h3 className="font-bold text-sm sm:text-base">
                  1. Правовые основания обработки персональных данных
                </h3>
                <p className="text-[#111111]/80 dark:text-[#F4F3EF]/80">
                  Настоящая Политика разработана в соответствии со ст. 18.1 Федерального закона от
                  27.07.2006 № 152-ФЗ «О персональных данных», № 149-ФЗ «Об информации» и ч. 1 ст.
                  18 № 38-ФЗ «О рекламе».
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-bold text-sm sm:text-base">
                  2. Перечень и цели обрабатываемых данных
                </h3>
                <p className="text-[#111111]/80 dark:text-[#F4F3EF]/80">
                  Оператор обрабатывает исключительно минимально необходимые данные, которые Заказчик
                  добровольно указывает в формах обратной связи: имя, контактный телефон или почту,
                  сведения об организации / ИП (наименование, ИНН для ЭДО), а также текст или
                  голосовое описание брифа. Специальные и биометрические категории ПДн (ст. 10–11
                  152-ФЗ) не собираются.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-bold text-sm sm:text-base">
                  3. Локализация в РФ (ч. 5 ст. 18) и запрет трансграничной передачи ПДн (ст. 12)
                </h3>
                <p className="text-[#111111]/80 dark:text-[#F4F3EF]/80">
                  Первичная запись, накопление и хранение персональных данных граждан РФ осуществляются
                  в базах данных, расположенных на территории Российской Федерации. Шрифты (Golos Text,
                  Manrope, JetBrains Mono, лицензия SIL OFL 1.1) и медиафайлы раздаются локально со
                  своего сервера. Передача прямых ПДн (телефонов, e-mail, ИНН, текстов брифов) в
                  зарубежные мессенджеры и иностранные AI-сервисы программно заблокирована режимом
                  обезличивания.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-bold text-sm sm:text-base">
                  4. Права субъекта ПДн, запрет навязанной рекламы и отзыв за 10 рабочих дней
                </h3>
                <p className="text-[#111111]/80 dark:text-[#F4F3EF]/80">
                  Оформление заявки не является согласием на рекламные или массовые рассылки (ч. 1 ст.
                  18 ФЗ-38 «О рекламе»). Субъект ПДн вправе в любой момент запросить сведения об
                  обработке, уточнить или отозвать согласие письмом на{' '}
                  <strong className="text-[#111111] dark:text-[#F4F3EF]">hello@fmworks.ru</strong> —
                  данные подлежат обезличиванию или уничтожению в срок не позднее 10 рабочих дней в
                  порядке ч. 5 ст. 21 Закона № 152-ФЗ (за исключением реквизитов закрытых бухгалтерских
                  документов, хранимых по ФЗ-402).
                </p>
              </section>
            </>
          )}

          {activeTab === 'consent' && (
            <div className="space-y-4">
              <div className="rounded-2xl p-4 sm:p-5 bg-[#EFECE5] dark:bg-[#1B1B22] border border-[#111111]/10 dark:border-white/10 space-y-3">
                <p className="font-bold text-sm sm:text-base">
                  Согласие на обработку персональных данных (ст. 9 Федерального закона № 152-ФЗ)
                </p>
                <p className="text-[#111111]/82 dark:text-[#F4F3EF]/82">
                  Нажимая кнопку отправки заявки и устанавливая отметку согласия в форме на сайте
                  fmworks.ru, я действую свободно, своей волей и в своём интересе и даю конкретное,
                  предметное, информированное и однозначное согласие Оператору — аудиопродакшн-студии
                  FMWorks® (г. Тверь, ул. Советская, д. 45, эл. почта hello@fmworks.ru) — на
                  автоматизированную и смешанную обработку указанных мною данных:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-[#111111]/80 dark:text-[#F4F3EF]/80">
                  <li>имени (фамилии, имени, отчества при указании);</li>
                  <li>номера контактного телефона, аккаунта связи или электронной почты;</li>
                  <li>наименования и ИНН представляемого юридического лица или ИП (при указании);</li>
                  <li>материалов проектного брифа (текста или голосовой заметки по задаче).</li>
                </ul>
                <p className="text-[#111111]/82 dark:text-[#F4F3EF]/82">
                  Перечень действий с данными: сбор, запись, систематизация, накопление, хранение на
                  серверах на территории РФ, уточнение, использование для связи продюсера со мной,
                  подготовки расчёта стоимости, Договора с Приложением, Счёта (ЭДО / 54-ФЗ)
                  и Паспорта аудиоролика РАО/ВОИС, а также обезличивание и уничтожение по достижении
                  цели или отзыве согласия.
                </p>
                <p className="text-[#111111]/75 dark:text-[#F4F3EF]/75 text-xs">
                  Настоящее согласие НЕ допускает трансграничную передачу моих ПДн в сервисы Google,
                  зарубежные рекламные трекеры и массовые рекламные рассылки третьих лиц. Согласие
                  действует до достижения целей обработки и может быть отозвано письмом на
                  hello@fmworks.ru с прекращением обработки в сроки ч. 5 ст. 21 152-ФЗ.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'rf_security' && (
            <div className="space-y-4">
              <div className="rounded-2xl p-4 bg-[#16A34A]/[0.08] border border-[#16A34A]/25 flex items-start gap-3">
                <Lock
                  className="w-5 h-5 text-[#16A34A] dark:text-[#4ADE80] shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="space-y-1 text-xs">
                  <p className="font-bold text-[#111111] dark:text-[#F4F3EF]">
                    Технический регламент защиты персональных данных в РФ
                  </p>
                  <p className="text-[#111111]/78 dark:text-[#F4F3EF]/78">
                    Сведения о мерах локализации и информационной безопасности персональных данных на
                    сайте fmworks.ru для юристов и службы безопасности Заказчика.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {RF_COMPLIANCE_PASSPORT_ITEMS.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-2xl p-4 bg-[#EFECE5] dark:bg-[#1B1B22] border border-[#111111]/10 dark:border-white/10 space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="font-semibold text-[#111111]/65 dark:text-[#F4F3EF]/65">
                        {item.lawBadge}
                      </span>
                      <span className="font-bold text-[#16A34A] dark:text-[#4ADE80]">
                        {item.statusLabel}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                      {item.title}
                    </h3>
                    <p className="text-xs text-[#111111]/78 dark:text-[#F4F3EF]/78 leading-relaxed">
                      {item.summary}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Нижняя панель действий */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-[#111111]/10 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-[#111111]/62 dark:text-[#F4F3EF]/62">
            <ShieldCheck className="w-4 h-4 text-[#FF4820] shrink-0" aria-hidden="true" />
            <span>Локализация и обработка данных на территории РФ · 152-ФЗ</span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {onAcceptConsent && (
              <button
                type="button"
                data-testid="pdn-152fz-accept-btn"
                onClick={() => {
                  onAcceptConsent();
                  onClose();
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FF4820] hover:bg-[#E63C17] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-center leading-snug"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Подтвердить согласие и вернуться</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-[#111111]/16 dark:border-white/16 text-xs sm:text-sm font-semibold inline-flex items-center justify-center transition-colors cursor-pointer text-center"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
