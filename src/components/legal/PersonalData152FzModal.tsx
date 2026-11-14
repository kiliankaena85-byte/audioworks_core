import { CheckCircle2, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BrandLogo } from '../BrandLogo';

export type PersonalData152FzTab = 'policy' | 'consent';

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
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
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
              <span>Федеральный закон № 152-ФЗ «О персональных данных»</span>
            </div>
            <h2
              id="pdn-152fz-modal-title"
              className="text-base sm:text-xl font-bold tracking-tight leading-snug"
            >
              Защита и обработка персональных данных клиентов FMWorks®
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
            Текст согласия субъекта ПДн (ст. 9 152-ФЗ)
          </button>
        </div>

        {/* Содержимое документа */}
        <div className="px-4 sm:px-6 py-5 overflow-y-auto flex-1 space-y-5 text-xs sm:text-sm leading-relaxed">
          {activeTab === 'policy' ? (
            <>
              <div className="rounded-2xl p-4 bg-[#EFECE5] dark:bg-[#1B1B22] border border-[#111111]/10 dark:border-white/10 space-y-1.5 text-xs">
                <p className="font-bold text-[#111111] dark:text-[#F4F3EF]">
                  Сведения об Операторе персональных данных:
                </p>
                <p className="text-[#111111]/80 dark:text-[#F4F3EF]/80">
                  Аудиопродакшн-студия FMWorks® (ИП Соколов Артём Викторович, ИНН 695008412904, ОГРНИП
                  322695200041850 / ООО «ФМ Воркс Продакшн», ИНН 6950241890, КПП 695001001).
                </p>
                <p className="text-[#111111]/72 dark:text-[#F4F3EF]/72">
                  Адрес местонахождения: 170100, Россия, Тверская обл., г. Тверь, ул. Советская, д. 45 ·
                  Официальный сайт: fmworks.ru · Электронная почта для обращений: hello@fmworks.ru ·
                  Тел.: +7 (4822) 75-04-20.
                </p>
              </div>

              <section className="space-y-1.5">
                <h3 className="font-bold text-sm sm:text-base">
                  1. Общие положения и правовые основания
                </h3>
                <p className="text-[#111111]/80 dark:text-[#F4F3EF]/80">
                  Настоящая Политика разработана в соответствии со ст. 18.1 Федерального закона от
                  27.07.2006 № 152-ФЗ «О персональных данных» и определяет порядок обработки и защиты
                  сведений о пользователях сайта fmworks.ru при оформлении заявок на производство
                  аудиороликов, разбор эфирных материалов и подготовку договорной документации.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-bold text-sm sm:text-base">
                  2. Перечень обрабатываемых данных и цели обработки
                </h3>
                <p className="text-[#111111]/80 dark:text-[#F4F3EF]/80">
                  Оператор обрабатывает исключительно минимально необходимые данные, которые Заказчик
                  добровольно указывает в формах обратной связи: имя (ФИО представителя), контактный
                  номер телефона, никнейм мессенджера или адрес электронной почты, сведения об
                  организации / ИП (наименование, ИНН для ЭДО), а также текст или голосовую запись
                  проектного брифа. Специальные и биометрические категории персональных данных (ст. 10–11
                  152-ФЗ) студией не собираются и не обрабатываются.
                </p>
                <p className="text-[#111111]/80 dark:text-[#F4F3EF]/80">
                  Цели обработки: связь продюсера с Заказчиком в выбранное окно, расчёт сметы
                  аудиопродакшна, формирование Коммерческого предложения, Рамочного договора с
                  Приложением, Счёта на оплату (ЭДО / 54-ФЗ) и Паспорта рекламного аудиоролика.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-bold text-sm sm:text-base">
                  3. Локализация баз данных в РФ (ч. 5 ст. 18 152-ФЗ) и сетевая безопасность
                </h3>
                <p className="text-[#111111]/80 dark:text-[#F4F3EF]/80">
                  Запись, систематизация, накопление, хранение и уточнение персональных данных граждан
                  Российской Федерации осуществляются с использованием баз данных, находящихся на
                  территории Российской Федерации. Платформа использует локально размещённые на сервере
                  шрифты со свободной лицензией SIL Open Font License 1.1 без подключения к зарубежным
                  CDN-серверам (включая Google Fonts) и без скрытой трансграничной передачи IP-адресов
                  третьим лицам.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-bold text-sm sm:text-base">
                  4. Срок хранения и порядок отзыва согласия в 1 письмо
                </h3>
                <p className="text-[#111111]/80 dark:text-[#F4F3EF]/80">
                  Персональные данные хранятся не дольше, чем этого требуют цели обработки (завершение
                  консультации по заявке либо истечение установленных законодательством РФ сроков
                  хранения первичных учётных и договорных документов). Субъект персональных данных вправе
                  в любой момент отозвать согласие, направив уведомление в свободной форме на адрес{' '}
                  <strong className="text-[#111111] dark:text-[#F4F3EF]">hello@fmworks.ru</strong> —
                  обработка прекращается в сроки, установленные ч. 5 ст. 21 Закона № 152-ФЗ.
                </p>
              </section>
            </>
          ) : (
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
                  <li>номера контактного телефона, аккаунта мессенджера или электронной почты;</li>
                  <li>наименования и ИНН представляемого юридического лица или ИП (при указании);</li>
                  <li>материалов проектного брифа (текста или голосовой заметки по задаче).</li>
                </ul>
                <p className="text-[#111111]/82 dark:text-[#F4F3EF]/82">
                  Перечень действий с данными: сбор, запись, систематизация, накопление, хранение на
                  серверах на территории РФ, уточнение, использование для связи продюсера со мной,
                  подготовки расчёта стоимости, Рамочного договора, Счёта и Паспорта аудиоролика, а
                  также удаление и уничтожение по достижении цели или при отзыве согласия.
                </p>
                <p className="text-[#111111]/75 dark:text-[#F4F3EF]/75 text-xs">
                  Передача данных в рекламные рассылки третьих лиц не осуществляется. Согласие действует
                  до достижения целей обработки и может быть отозвано мною в любой момент письмом на
                  hello@fmworks.ru.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Нижняя панель действий */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-[#111111]/10 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-[#111111]/62 dark:text-[#F4F3EF]/62">
            <ShieldCheck className="w-4 h-4 text-[#FF4820] shrink-0" aria-hidden="true" />
            <span>Локализация хранения в РФ · Без спама и сторонних трекеров</span>
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
