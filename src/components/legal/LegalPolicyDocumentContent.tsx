import { Lock } from 'lucide-react';
import { useStudioLegalConfig } from '../../context/StudioLegalConfigContext';
import {
  buildPolicyProcessingPurposes,
  buildStandaloneConsentSpec,
  PLATFORM_COOKIE_AND_STORAGE_SPEC,
} from '../../security/legalDocumentBuilder';
import { RF_COMPLIANCE_PASSPORT_ITEMS } from '../../security/rfLegalCompliance';

export type LegalPolicyTabId = 'policy' | 'consent' | 'rf_security';

export interface LegalPolicyDocumentContentProps {
  activeTab: LegalPolicyTabId;
}

export function LegalPolicyDocumentContent({
  activeTab,
}: LegalPolicyDocumentContentProps) {
  const { legalProfiles, operatorPassport } = useStudioLegalConfig();
  const purposes = buildPolicyProcessingPurposes(legalProfiles);
  const consentSpec = buildStandaloneConsentSpec(legalProfiles);

  if (activeTab === 'consent') {
    return (
      <div className="space-y-5 text-xs sm:text-sm leading-relaxed">
        <div className="rounded-2xl p-4 sm:p-6 bg-[#EFECE5] dark:bg-[#1B1B22] border border-[#111111]/10 dark:border-white/10 space-y-3.5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#111111]/65 dark:text-[#F4F3EF]/65 tabular-nums">
            <span>Редакция от {operatorPassport.policyVersionDate}</span>
            <span aria-hidden="true">·</span>
            <span>Оформляется отдельно (ФЗ № 156-ФЗ)</span>
          </div>

          <h3 className="font-bold text-sm sm:text-base text-[#111111] dark:text-[#F4F3EF]">
            {consentSpec.heading}
          </h3>

          <p className="text-[#111111]/84 dark:text-[#F4F3EF]/84">
            {consentSpec.leadParagraph}
          </p>

          <ul className="list-disc pl-5 space-y-1.5 text-[#111111]/82 dark:text-[#F4F3EF]/82">
            {consentSpec.dataItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <p className="text-[#111111]/84 dark:text-[#F4F3EF]/84">
            {consentSpec.purposesParagraph}
          </p>

          <p className="text-[#111111]/84 dark:text-[#F4F3EF]/84">
            {consentSpec.actionsParagraph}
          </p>

          <p className="pt-2 border-t border-[#111111]/10 dark:border-white/10 text-xs text-[#111111]/76 dark:text-[#F4F3EF]/78">
            {consentSpec.guaranteesAndRevocationParagraph}
          </p>
        </div>
      </div>
    );
  }

  if (activeTab === 'rf_security') {
    return (
      <div className="space-y-6 text-xs sm:text-sm leading-relaxed">
        <div className="rounded-2xl p-4 sm:p-5 bg-[#16A34A]/[0.08] border border-[#16A34A]/25 flex items-start gap-3">
          <Lock
            className="w-5 h-5 text-[#16A34A] dark:text-[#4ADE80] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="space-y-1 text-xs sm:text-sm">
            <p className="font-bold text-[#111111] dark:text-[#F4F3EF]">
              Локализация баз данных в РФ (ч. 5 ст. 18 152-ФЗ в ред. ФЗ № 23-ФЗ) и регламент cookie
            </p>
            <p className="text-[#111111]/80 dark:text-[#F4F3EF]/80">
              Первичная запись и хранение данных ведутся по адресу размещения мощностей:{' '}
              <strong className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                {operatorPassport.hostingLocationLabel}
              </strong>
              . Сайт не передаёт IP-адреса и метаданные в рекламные или аналитические сервисы иностранных корпораций.
            </p>
          </div>
        </div>

        <section className="space-y-3">
          <h3 className="text-sm sm:text-base font-bold text-[#111111] dark:text-[#F4F3EF]">
            Используемые технические файлы cookie и ключи локального хранилища
          </h3>
          <div className="divide-y divide-[#111111]/10 dark:divide-white/10 rounded-2xl border border-[#111111]/10 dark:border-white/10 bg-[#EFECE5]/65 dark:bg-[#1B1B22]/80">
            {PLATFORM_COOKIE_AND_STORAGE_SPEC.map((item) => (
              <div
                key={item.id}
                className="p-3.5 sm:p-4 space-y-1 text-xs leading-relaxed"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 tabular-nums">
                  <code className="font-mono font-semibold text-[#111111] dark:text-[#F4F3EF]">
                    {item.storageKey}
                  </code>
                  <span className="text-[#111111]/68 dark:text-[#F4F3EF]/68">
                    {item.kindLabel} · {item.retention}
                  </span>
                </div>
                <p className="text-[#111111]/80 dark:text-[#F4F3EF]/80">
                  {item.purpose}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm sm:text-base font-bold text-[#111111] dark:text-[#F4F3EF]">
            Технические и организационные меры защиты (ст. 18.1 и ст. 19 152-ФЗ)
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {RF_COMPLIANCE_PASSPORT_ITEMS.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl p-4 bg-[#EFECE5] dark:bg-[#1B1B22] border border-[#111111]/10 dark:border-white/10 space-y-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] tabular-nums">
                  <span className="font-semibold text-[#111111]/68 dark:text-[#F4F3EF]/68">
                    {item.lawBadge}
                  </span>
                  <span className="font-bold text-[#15803D] dark:text-[#4ADE80]">
                    {item.statusLabel}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                  {item.title}
                </h4>
                <p className="text-xs text-[#111111]/80 dark:text-[#F4F3EF]/80 leading-relaxed">
                  {item.summary}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-xs sm:text-sm leading-relaxed">
      {/* Паспорт Оператора ПДн (динамически подтягивается из админ-панели ООО / ИП) */}
      <div
        data-testid="pdn-operator-passport-card"
        className="rounded-2xl p-4 sm:p-5 bg-[#EFECE5] dark:bg-[#1B1B22] border border-[#111111]/10 dark:border-white/10 space-y-2 text-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-[#111111]/65 dark:text-[#F4F3EF]/65 tabular-nums">
          <span>Сведения об Операторе персональных данных</span>
          <span>Редакция от {operatorPassport.policyVersionDate}</span>
        </div>

        <p className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
          {operatorPassport.operatorTitle}
        </p>

        <p className="text-[#111111]/82 dark:text-[#F4F3EF]/82 tabular-nums">
          {operatorPassport.entityKindLabel} · {operatorPassport.requisitesLine}
        </p>

        {operatorPassport.signatoryLine && (
          <p className="text-[#111111]/78 dark:text-[#F4F3EF]/78">
            {operatorPassport.signatoryLine}
          </p>
        )}

        <p className="text-[#111111]/78 dark:text-[#F4F3EF]/78 tabular-nums">
          Адрес: {operatorPassport.addressLine} · Сайт: {operatorPassport.websiteDomain} ·
          Эл. почта для обращений по ПДн:{' '}
          <strong className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
            {operatorPassport.privacyEmail}
          </strong>{' '}
          · Тел.: {operatorPassport.phone}
        </p>

        {operatorPassport.rknRegistryLine && (
          <p className="font-medium text-[#111111]/84 dark:text-[#F4F3EF]/84 tabular-nums">
            {operatorPassport.rknRegistryLine}
          </p>
        )}

        {operatorPassport.pendingRegistrationNote && (
          <p className="pt-1.5 border-t border-[#111111]/10 dark:border-white/10 text-[#111111]/74 dark:text-[#F4F3EF]/74">
            {operatorPassport.pendingRegistrationNote}
          </p>
        )}

        {operatorPassport.secondaryEntityDisclosure && (
          <p className="pt-1.5 border-t border-[#111111]/10 dark:border-white/10 text-[#111111]/78 dark:text-[#F4F3EF]/78">
            {operatorPassport.secondaryEntityDisclosure}
          </p>
        )}
      </div>

      <section className="space-y-1.5">
        <h3 className="font-bold text-sm sm:text-base text-[#111111] dark:text-[#F4F3EF]">
          01. Общие положения и правовые основания
        </h3>
        <p className="text-[#111111]/82 dark:text-[#F4F3EF]/82">
          Настоящая Политика в отношении обработки персональных данных разработана в соответствии с ч. 2 ст. 18.1 Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных» (с учётом изменений по ФЗ № 23-ФЗ и ФЗ № 156-ФЗ), Федеральным законом № 149-ФЗ «Об информации, информационных технологиях и о защите информации» и ч. 1 ст. 18 Федерального закона № 38-ФЗ «О рекламе». Документ действует в отношении всей информации, которую Оператор получает при использовании сайта{' '}
          <strong className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
            {operatorPassport.websiteDomain}
          </strong>
          , форм оформления заказа и Личного кабинета Заказчика.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="font-bold text-sm sm:text-base text-[#111111] dark:text-[#F4F3EF]">
          02. Цели обработки, категории субъектов, перечень данных и сроки хранения
        </h3>
        <p className="text-[#111111]/80 dark:text-[#F4F3EF]/80">
          В соответствии с требованиями Роскомнадзора Оператор не объединяет базы данных, несовместимые по целям обработки, и обрабатывает строго минимальный объём сведений по четырём целевым контурам:
        </p>

        <div className="space-y-3">
          {purposes.map((purpose) => (
            <article
              key={purpose.id}
              className="rounded-2xl p-4 bg-[#EFECE5]/75 dark:bg-[#1B1B22]/90 border border-[#111111]/10 dark:border-white/10 space-y-2 text-xs"
            >
              <p className="text-[#C83210] dark:text-[#FF7A5C] font-semibold tabular-nums">
                {purpose.numberLabel}
              </p>
              <h4 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                {purpose.title}
              </h4>
              <p className="text-[#111111]/82 dark:text-[#F4F3EF]/82">
                <strong className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                  Субъекты:
                </strong>{' '}
                {purpose.subjects}
              </p>
              <div>
                <p className="font-semibold text-[#111111] dark:text-[#F4F3EF] mb-1">
                  Обрабатываемые данные:
                </p>
                <ul className="list-disc pl-5 space-y-0.5 text-[#111111]/80 dark:text-[#F4F3EF]/80">
                  {purpose.dataCategories.map((cat) => (
                    <li key={cat}>{cat}</li>
                  ))}
                </ul>
              </div>
              <p className="text-[#111111]/80 dark:text-[#F4F3EF]/80">
                <strong className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                  Правовое основание:
                </strong>{' '}
                {purpose.legalBasis}
              </p>
              <p className="text-[#111111]/80 dark:text-[#F4F3EF]/80">
                <strong className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                  Способы и локализация:
                </strong>{' '}
                {purpose.actionsAndStorage}
              </p>
              <p className="text-[#111111]/80 dark:text-[#F4F3EF]/80">
                <strong className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                  Срок хранения и порядок уничтожения:
                </strong>{' '}
                {purpose.retentionAndDestruction}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-1.5">
        <h3 className="font-bold text-sm sm:text-base text-[#111111] dark:text-[#F4F3EF]">
          03. Локализация в РФ (ч. 5 ст. 18 152-ФЗ) и отсутствие трансграничной передачи (ст. 12)
        </h3>
        <p className="text-[#111111]/82 dark:text-[#F4F3EF]/82">
          Первичный сбор, запись, систематизация, накопление и хранение персональных данных граждан Российской Федерации осуществляются исключительно с использованием баз данных, физически расположенных на территории РФ ({operatorPassport.hostingLocationLabel}). Шрифты и медиафайлы раздаются локально со своего сервера; внешние счётчики Google Analytics, Google Fonts и зарубежные рекламные пиксели отключены. Передача прямых персональных данных в оперативные мессенджер-уведомления продюсеру программно заблокирована фильтром маскирования.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="font-bold text-sm sm:text-base text-[#111111] dark:text-[#F4F3EF]">
          04. Технические файлы cookie и локальное хранилище браузера
        </h3>
        <p className="text-[#111111]/82 dark:text-[#F4F3EF]/82">
          На сайте применяются исключительно строго необходимые технические файлы{' '}
          <code className="font-mono">cookie</code> с защитным атрибутом{' '}
          <code className="font-mono">HttpOnly</code> (для беспарольного входа Заказчика в Личный кабинет и авторизации сотрудников студии) и ключи{' '}
          <code className="font-mono">localStorage</code> (для сохранения черновика заказа и выбранной темы). Маркетинговое профилирование не ведётся. Пользователь может в любой момент ограничить приём файлов{' '}
          <code className="font-mono">cookie</code> в настройках своего браузера.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="font-bold text-sm sm:text-base text-[#111111] dark:text-[#F4F3EF]">
          05. Права субъекта ПДн, запрет навязанной рекламы и отзыв за 10 рабочих дней
        </h3>
        <p className="text-[#111111]/82 dark:text-[#F4F3EF]/82">
          Отправка заявки или вход в Личный кабинет не являются согласием на получение рекламных рассылок (ч. 1 ст. 18 ФЗ № 38-ФЗ «О рекламе»). Субъект ПДн вправе запросить перечень обрабатываемых данных, потребовать их уточнения, блокирования или отозвать согласие, направив обращение на{' '}
          <strong className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
            {operatorPassport.privacyEmail}
          </strong>
          . Оператор прекращает обработку и обеспечивает обезличивание либо безвозвратное уничтожение персональных данных в срок не позднее{' '}
          <strong className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
            10 рабочих дней
          </strong>{' '}
          с даты получения обращения (ч. 5 ст. 21 Закона № 152-ФЗ), за исключением закрытых бухгалтерских документов, обязательных к хранению по Закону № 402-ФЗ.
        </p>
      </section>
    </div>
  );
}
