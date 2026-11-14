import { BrandLogo } from '../BrandLogo';
import {
  AssembledDocumentSuite,
  BrandedDocumentKind,
  BROADCAST_TECH_STANDARD_ROWS,
} from '../../data/studioDocumentsCore';

export type ContractViewVariant = 'full_with_appendix' | 'appendix_only';

interface SwissA4DocumentSheetsProps {
  suite: AssembledDocumentSuite;
  activeDoc: BrandedDocumentKind;
  contractVariant?: ContractViewVariant;
  briefExcerpt?: string;
}

function SheetBrandFooter({ suite, sheetCode }: { suite: AssembledDocumentSuite; sheetCode: string }) {
  const { studio } = suite;
  return (
    <footer className="mt-8 pt-4 border-t border-[#E5E2DC] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-[#5C5852] tabular-nums">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold text-[#111111]">FMWorks® Studio Production</span>
        <span aria-hidden="true">·</span>
        <span>{studio.city}</span>
        <span aria-hidden="true">·</span>
        <span>https://{studio.websiteDomain}</span>
        <span aria-hidden="true">·</span>
        <span>{studio.email}</span>
        <span aria-hidden="true">·</span>
        <span>{studio.phone}</span>
      </div>
      <div className="font-mono text-[10px] text-[#7A756D] shrink-0">
        {sheetCode} · Сделка #{suite.orderNumber}
      </div>
    </footer>
  );
}

function SheetBrandHeader({
  suite,
  kicker,
  title,
  docNumberLine,
}: {
  suite: AssembledDocumentSuite;
  kicker: string;
  title: string;
  docNumberLine: string;
}) {
  const { studio } = suite;
  const ogrnLabel = studio.entityKind === 'ip' ? 'ОГРНИП' : 'ОГРН';
  return (
    <header className="pb-5 mb-6 border-b border-[#111111] flex flex-col sm:flex-row sm:items-start justify-between gap-4">
      <div className="space-y-2.5 min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <BrandLogo variant="fmworks_reg" size="sm" colorMode="dark" />
          <span className="text-[11px] font-medium text-[#5C5852]">
            Аудиопродакшн полного цикла · {studio.city} · {studio.websiteDomain}
          </span>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#FF4820]">
            {kicker}
          </p>
          <h3 className="text-lg sm:text-xl font-bold tracking-tight text-[#111111] mt-0.5 leading-snug">
            {title}
          </h3>
          <p className="text-xs font-medium text-[#5C5852] mt-0.5 tabular-nums">
            {docNumberLine}
          </p>
        </div>
      </div>

      <div className="text-[11px] leading-relaxed text-[#5C5852] sm:text-right sm:max-w-[280px] tabular-nums shrink-0 space-y-0.5">
        <p className="font-semibold text-[#111111]">{studio.shortBrandTitle}</p>
        <p className="flex flex-wrap sm:justify-end gap-x-2">
          <span className="whitespace-nowrap">
            ИНН {studio.inn}
            {studio.entityKind === 'ooo' && studio.kpp ? ` · КПП ${studio.kpp}` : ''}
          </span>
          <span className="whitespace-nowrap">
            {ogrnLabel} {studio.ogrnOrOgrnip}
          </span>
        </p>
        <p className="whitespace-nowrap">
          {studio.phone} · {studio.email}
        </p>
      </div>
    </header>
  );
}

function KpSheet({
  suite,
  briefExcerpt,
}: {
  suite: AssembledDocumentSuite;
  briefExcerpt?: string;
}) {
  const { studio, customer, scope, tax } = suite;
  return (
    <article
      data-testid="a4-sheet-kp"
      className="fmworks-a4-sheet bg-white text-[#111111] w-full max-w-[794px] mx-auto p-4 sm:p-8 lg:p-10 border border-[#E5E2DC] shadow-sm text-xs leading-relaxed"
    >
      <SheetBrandHeader
        suite={suite}
        kicker={
          suite.isNegotiablePendingPrice
            ? 'Лист оценки задачи (предварительное КП)'
            : 'Коммерческое предложение'
        }
        title={
          suite.isNegotiablePendingPrice
            ? 'Предварительная студийная смета на аудиопродакшн'
            : `Производство рекламного аудиоролика · ${scope.tierTitle}`
        }
        docNumberLine={`№ ${suite.kpNumber} от ${suite.issueDateRu} · ${suite.city}`}
      />

      {/* Блок адресата и параметров проекта */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-5 mb-5 border-b border-[#E5E2DC]">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#7A756D]">
            Заказчик / Адресат
          </p>
          <p className="font-bold text-sm text-[#111111]">{customer.displayName}</p>
          {customer.inn && (
            <p className="text-[#5C5852] tabular-nums">
              ИНН {customer.inn}
              {customer.kpp ? ` · КПП ${customer.kpp}` : ''}
            </p>
          )}
          <p className="text-[#5C5852]">Контакт: {customer.contact}</p>
        </div>

        <div className="space-y-1 sm:text-right tabular-nums">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#7A756D]">
            Параметры студийного релиза
          </p>
          <p className="font-semibold text-[#111111]">{suite.spotWorkingTitle}</p>
          <p className="text-[#5C5852]">
            Хронометраж: {suite.spotDurationSec} сек ({suite.spotDurationFormatted})
          </p>
          <p className="text-[#5C5852]">Срок готовности: {scope.turnaroundLabel}</p>
        </div>
      </div>

      {briefExcerpt?.trim() && (
        <div className="mb-5 p-3.5 bg-[#FAF9F6] border border-[#E5E2DC] space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#7A756D]">
            Исходная задача Заказчика по брифу
          </p>
          <p className="text-[#111111] whitespace-pre-line">{briefExcerpt.trim()}</p>
        </div>
      )}

      {/* Таблица состава работ */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full border-collapse text-left tabular-nums min-w-[460px]">
          <thead>
            <tr className="border-y border-[#111111] bg-[#FAF9F6] text-[11px] font-bold">
              <th className="py-2 px-2.5 w-10">№</th>
              <th className="py-2 px-2.5">Этап и состав студийных работ</th>
              <th className="py-2 px-2.5 w-28">Срок</th>
              <th className="py-2 px-2.5 w-32 text-right">Стоимость</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E2DC]">
            {scope.kpLineItems.map((row) => (
              <tr key={row.code}>
                <td className="py-2.5 px-2.5 font-mono text-[#5C5852] align-top">
                  {row.code}
                </td>
                <td className="py-2.5 px-2.5 align-top font-medium text-[#111111]">
                  {row.title}
                </td>
                <td className="py-2.5 px-2.5 align-top text-[#5C5852]">
                  {row.turnaround}
                </td>
                <td className="py-2.5 px-2.5 align-top text-right font-semibold">
                  {row.priceNote}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Итоговая стоимость и стандарты */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-start pt-4 border-t border-[#111111]">
        <div className="sm:col-span-7 space-y-2 text-[11px] text-[#5C5852]">
          <p className="font-bold text-[#111111]">Что гарантировано в стоимости продакшна:</p>
          <ul className="space-y-1 list-disc pl-4">
            <li>{scope.conceptsCountLabel}</li>
            <li>{scope.voiceCastLabel}</li>
            <li>{scope.soundAndMusicLabel}</li>
            <li>{scope.revisionsIncludedLabel}</li>
            <li>
              Передача мастера в стандарте радиостанций РФ (WAV 44 100 Гц / 16 bit Stereo + MP3
              320 kbps, -14…-11 LUFS) и оформление бессрочного Паспорта прав РАО / ВОИС.
            </li>
          </ul>
        </div>

        <div className="sm:col-span-5 p-4 bg-[#FAF9F6] border border-[#E5E2DC] space-y-2 tabular-nums">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#7A756D]">
            Условия запуска и бюджет
          </p>
          {suite.isNegotiablePendingPrice ? (
            <>
              <p className="text-base font-bold text-[#FF4820]">Договорная цена</p>
              <p className="text-[11px] text-[#5C5852]">
                Финальная стоимость фиксируется в Приложении № {suite.appendixNumber} после
                15-минутного уточнения объёма работ с продюсером. Старт работ — после 100%
                предоплаты.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[#5C5852]">Итого по смете:</span>
                <span className="text-lg font-bold text-[#111111]">
                  {tax.formattedTotalRub}
                </span>
              </div>
              <p className="text-[11px] text-[#5C5852]">{tax.taxLegalLabel}</p>
              <p className="text-[11px] font-medium text-[#111111]">
                {tax.totalInWordsRu}
              </p>
              <p className="text-[11px] text-[#5C5852] pt-1 border-t border-[#E5E2DC]">
                Порядок оплаты: 100% предоплата до начала разработки сценариев и записи. Закрытие
                актом в {studio.edoOperatorLabel}.
              </p>
            </>
          )}
        </div>
      </div>

      <SheetBrandFooter suite={suite} sheetCode={`КП № ${suite.kpNumber}`} />
    </article>
  );
}

function ContractAndAppendixSheet({
  suite,
  contractVariant,
}: {
  suite: AssembledDocumentSuite;
  contractVariant: ContractViewVariant;
}) {
  const { studio, customer, scope, tax } = suite;
  const ogrnLabel = studio.entityKind === 'ip' ? 'ОГРНИП' : 'ОГРН';

  return (
    <article
      data-testid="a4-sheet-contract"
      className="fmworks-a4-sheet bg-white text-[#111111] w-full max-w-[794px] mx-auto p-4 sm:p-8 lg:p-10 border border-[#E5E2DC] shadow-sm text-[11.5px] leading-relaxed"
    >
      <SheetBrandHeader
        suite={suite}
        kicker={
          contractVariant === 'appendix_only'
            ? `Приложение № ${suite.appendixNumber} к действующему Рамочному договору`
            : 'Рамочный договор подряда на аудиопродакшн + Приложение № 1'
        }
        title={
          contractVariant === 'appendix_only'
            ? `Заказ-спецификация (Приложение № ${suite.appendixNumber}) к Договору № ${suite.contractNumber}`
            : `Рамочный договор № ${suite.contractNumber} на производство аудиопродукции`
        }
        docNumberLine={`${studio.city} · от ${suite.contractDateRu} · Приложение № ${suite.appendixNumber} от ${suite.issueDateRu}`}
      />

      {contractVariant === 'full_with_appendix' && (
        <div className="space-y-4">
          <p className="text-[#111111]">
            <strong>{studio.legalName}</strong> (ИНН {studio.inn}
            {studio.entityKind === 'ooo' && studio.kpp ? `, КПП ${studio.kpp}` : ''},{' '}
            {ogrnLabel} {studio.ogrnOrOgrnip}, {studio.legalAddress}), {studio.authorityBasis},
            именуемый в дальнейшем <strong>«Исполнитель»</strong>, с одной стороны, и{' '}
            <strong>{customer.displayName}</strong>
            {customer.inn ? ` (ИНН ${customer.inn}` : ''}
            {customer.kpp ? `, КПП ${customer.kpp}` : ''}
            {customer.inn ? ')' : ''}
            {customer.address ? `, ${customer.address}` : ''}, именуемое в дальнейшем{' '}
            <strong>«Заказчик»</strong>, с другой стороны, заключили настоящий Рамочный договор
            (далее — «Договор») о нижеследующем:
          </p>

          <section className="space-y-1">
            <h4 className="font-bold text-xs uppercase tracking-wide text-[#111111]">
              1. Предмет рамочного договора (студийный продакшн)
            </h4>
            <p>
              1.1. Исполнитель обязуется по заданиям Заказчика создавать рекламные и
              информационные аудиоролики (далее — «Произведения») и передавать Заказчику
              мастер-фонограммы с отчуждением исключительных прав в объёме Приложений, а Заказчик
              обязуется оплачивать и принимать работы. Размещение аудиороликов в эфире радиостанций
              предметом настоящего Договора не является.
            </p>
            <p>
              1.2. Конкретный перечень работ, хронометраж, сроки, стоимость и особенности заказа
              согласуются в отдельных <strong>Приложениях (Заказ-спецификациях)</strong> без
              необходимости перезаключения или переделки текста настоящего Рамочного договора при
              повторных заказах.
            </p>
          </section>

          <section className="space-y-1">
            <h4 className="font-bold text-xs uppercase tracking-wide text-[#111111]">
              2. Порядок запуска работ и приёмки (100% предоплата)
            </h4>
            <p>
              2.1. Исполнитель приступает к разработке сценариев и записи строго после подписания
              соответствующего Приложения и поступления <strong>100% предоплаты</strong> на
              расчётный счёт Исполнителя.
            </p>
            <p>
              2.2. Срок приёмки готовых мастер-фонограмм и Акта сдачи-приёмки составляет{' '}
              <strong>5 (пять) рабочих дней</strong> с даты направления. При отсутствии письменного
              мотивированного отказа с указанием конкретных технических или текстовых несоответствий
              работы считаются принятыми Заказчиком в полном объёме.
            </p>
          </section>

          {/* Ключевой Раздел 3 по запросу пользователя: Технические характеристики аудиороликов РФ прямо в Договоре */}
          <section className="space-y-2 pt-1">
            <h4 className="font-bold text-xs uppercase tracking-wide text-[#111111]">
              3. Технические характеристики и эфирный стандарт сдачи аудиороликов (ст. 721 ГК РФ)
            </h4>
            <p>
              3.1. Если иное прямо не согласовано Сторонами в Приложении (п. 3.5), каждый
              готовый аудиоролик поставляется Исполнителем в соответствии с единым базовым
              стандартом приёмки коммерческих радиостанций Российской Федерации и нормами ч. 11
              ст. 15 ФЗ-38 «О рекламе»:
            </p>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-[#E5E2DC] text-[11px] min-w-[460px]">
                <thead>
                  <tr className="bg-[#FAF9F6] border-b border-[#111111] font-bold">
                    <th className="p-2 text-left w-[34%] border-r border-[#E5E2DC]">
                      Параметр техконтроля радиостанции
                    </th>
                    <th className="p-2 text-left">
                      Обязательный норматив сдачи FMWorks®
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E2DC]">
                  {BROADCAST_TECH_STANDARD_ROWS.map((row) => (
                    <tr key={row.parameter}>
                      <td className="p-2 font-semibold align-top border-r border-[#E5E2DC] text-[#111111]">
                        {row.parameter}
                      </td>
                      <td className="p-2 align-top text-[#2C2A27]">{row.specification}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-[#5C5852]">
              3.5. При наличии у конкретной вещательной площадки (телеканал, indoor-сеть,
              медиахолдинг) специальных технических требований, отличающихся от таблицы п. 3.1,
              такие параметры указываются в Приложении и имеют приоритет при сдаче конкретного
              заказа. Исправление подтверждённого технического брака осуществляется Исполнителем
              бесплатно в течение 24 часов.
            </p>
          </section>

          <section className="space-y-1">
            <h4 className="font-bold text-xs uppercase tracking-wide text-[#111111]">
              4. Интеллектуальная собственность и Паспорт прав (РАО / ВОИС)
            </h4>
            <p>
              4.1. При условии полной оплаты по Приложению Исполнитель передаёт Заказчику
              исключительное право на созданную аудиофонограмму и сценарий (в рамках условий
              использованной коммерческой музыкальной лицензии) и выдаёт официальный{' '}
              <strong>Паспорт рекламного аудиоролика</strong> для юридической службы вещателя.
            </p>
          </section>

          {/* Раздел 5: Глубокая двусторонняя матрица ответственности сторон + Тверь */}
          <section className="space-y-1.5">
            <h4 className="font-bold text-xs uppercase tracking-wide text-[#111111]">
              5. Ответственность сторон, гарантии ФЗ-38 и разрешение споров
            </h4>
            <p>
              5.1. <strong>Гарантии Исполнителя:</strong> Исполнитель гарантирует правовую чистоту
              привлечённых дикторов (ст. 1317 ГК РФ) и музыкальных фонограмм (лицензия без доплат в
              РАО / ВОИС). При предъявлении вещателем или автором обоснованной претензии о нарушении
              смежных/авторских прав по вине Исполнителя последний самостоятельно и за свой счёт
              урегулирует претензию в пределах ст. 1301, 1311 ГК РФ.
            </p>
            <p>
              5.2. <strong>Заверения Заказчика (ст. 431.2 ГК РФ, ст. 38 ФЗ-38):</strong> Заказчик
              несёт полную ответственность за достоверность предоставленных фактов, ценовых
              предложений, товарных знаков, лицензий и обязательных рекламных сносок. Штрафы ФАС
              России за содержание сведений Заказчика и несогласованные изменения текста несут
              ответственность Заказчика.
            </p>
            <p>
              5.3. <strong>Неустойка и ограничение ответственности:</strong> за просрочку сдачи
              работ по вине Исполнителя Заказчик вправе требовать неустойку{' '}
              <strong>0,1% стоимости Приложения за каждый рабочий день просрочки, но не более 10%</strong>.
              Согласно ст. 400 ГК РФ совокупная ответственность Исполнителя ограничивается
              реальным документально подтверждённым ущербом в пределах 100% цены соответствующего
              Приложения; упущенная выгода возмещению не подлежит.
            </p>
            <p>
              5.4. <strong>Запрет эфира неоплаченных демо:</strong> демонстрационные варианты
              сценариев и черновых записей охраняются ГК РФ; их выпуск в эфир или публикация до
              полной оплаты по Приложению является нарушением исключительных прав Исполнителя.
            </p>
            <p>
              5.5. <strong>Подсудность и ЭДО:</strong> обязательный претензионный порядок —{' '}
              <strong>10 рабочих дней</strong>. При недостижении согласия спор подлежит передаче на
              рассмотрение в <strong>Арбитражный суд Тверской области ({studio.city})</strong>.
              Стороны признают юридическую силу документов в системе {studio.edoOperatorLabel} и по
              согласованным электронным адресам.
            </p>
          </section>
        </div>
      )}

      {/* ПРИЛОЖЕНИЕ № N (Заказ-спецификация) — всегда на контрастной рамке */}
      <div
        className={`${
          contractVariant === 'full_with_appendix' ? 'mt-6 pt-5 border-t-2 border-[#111111]' : ''
        } space-y-4`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#FF4820]">
              Приложение № {suite.appendixNumber} к Рамочному договору № {suite.contractNumber}
            </p>
            <h4 className="text-sm sm:text-base font-bold text-[#111111]">
              Заказ-спецификация на производство аудиоролика от {suite.issueDateRu}
            </h4>
          </div>
          <span className="font-mono text-[11px] text-[#5C5852] tabular-nums">
            {studio.city}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-[#E5E2DC] text-[11px] tabular-nums min-w-[440px]">
            <tbody className="divide-y divide-[#E5E2DC]">
              <tr>
                <td className="p-2 font-semibold bg-[#FAF9F6] w-[36%] border-r border-[#E5E2DC]">
                  Наименование проекта и файл
                </td>
                <td className="p-2">
                  {suite.spotWorkingTitle} · Мастер-файл: <span className="font-mono">{suite.spotMasterFileName}</span>
                </td>
              </tr>
              <tr>
                <td className="p-2 font-semibold bg-[#FAF9F6] border-r border-[#E5E2DC]">
                  Пакет продакшна и объём работ
                </td>
                <td className="p-2">
                  <strong>{scope.tierTitle}</strong>: {scope.conceptsCountLabel};{' '}
                  {scope.voiceCastLabel}; {scope.soundAndMusicLabel}; правки: {scope.revisionsIncludedLabel}.
                </td>
              </tr>
              <tr>
                <td className="p-2 font-semibold bg-[#FAF9F6] border-r border-[#E5E2DC]">
                  Точный хронометраж и срок
                </td>
                <td className="p-2">
                  {suite.spotDurationSec} сек ({suite.spotDurationFormatted} ±0,05 сек) · Срок: {scope.turnaroundLabel}
                </td>
              </tr>
              <tr>
                <td className="p-2 font-semibold bg-[#FAF9F6] border-r border-[#E5E2DC]">
                  Технические требования (Раздел 3)
                </td>
                <td className="p-2">{suite.specialTechNote}</td>
              </tr>
              <tr>
                <td className="p-2 font-semibold bg-[#FAF9F6] border-r border-[#E5E2DC]">
                  Стоимость по Приложению и налог
                </td>
                <td className="p-2 font-bold">
                  {suite.isNegotiablePendingPrice
                    ? 'Договорная цена (фиксируется продюсером и Заказчиком до выставления счёта)'
                    : `${tax.formattedTotalRub} (${tax.totalInWordsRu}). ${tax.taxLegalLabel}.`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Двусторонние подписи */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-[#E5E2DC] text-[11px]">
          <div className="space-y-2">
            <p className="font-bold uppercase tracking-wide text-[10px] text-[#5C5852]">
              Исполнитель ({studio.city})
            </p>
            <p className="font-semibold text-[#111111]">{studio.legalName}</p>
            <p className="text-[#5C5852]">
              ИНН {studio.inn}
              {studio.entityKind === 'ooo' && studio.kpp ? ` / КПП ${studio.kpp}` : ''} · Банк{' '}
              {studio.bankName} · Р/с {studio.checkingAccount}
            </p>
            <div className="pt-5 border-b border-[#111111]/40 flex justify-between text-[#5C5852]">
              <span>{studio.signatoryRoleTitle}</span>
              <span>/ {studio.signatoryShortName} /</span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-bold uppercase tracking-wide text-[10px] text-[#5C5852]">
              Заказчик
            </p>
            <p className="font-semibold text-[#111111]">{customer.displayName}</p>
            <p className="text-[#5C5852]">
              {customer.inn ? `ИНН ${customer.inn}` : 'ИНН: ___________________'}
              {customer.kpp ? ` / КПП ${customer.kpp}` : ''} · {customer.contact}
            </p>
            <div className="pt-5 border-b border-[#111111]/40 flex justify-between text-[#5C5852]">
              <span>Уполномоченный представитель</span>
              <span>/ {customer.signatory || '___________________'} /</span>
            </div>
          </div>
        </div>
      </div>

      <SheetBrandFooter suite={suite} sheetCode={`Договор № ${suite.contractNumber}`} />
    </article>
  );
}

function InvoiceSheet({ suite }: { suite: AssembledDocumentSuite }) {
  const { studio, customer, scope, tax } = suite;
  const ogrnLabel = studio.entityKind === 'ip' ? 'ОГРНИП' : 'ОГРН';

  return (
    <article
      data-testid="a4-sheet-invoice"
      className="fmworks-a4-sheet bg-white text-[#111111] w-full max-w-[794px] mx-auto p-4 sm:p-8 lg:p-10 border border-[#E5E2DC] shadow-sm text-xs leading-relaxed tabular-nums"
    >
      <SheetBrandHeader
        suite={suite}
        kicker="Платёжный документ (ГОСТ / Банк России · ЭДО)"
        title={`Счёт на оплату № ${suite.invoiceNumber} от ${suite.issueDateRu}`}
        docNumberLine={`Основание: Приложение № ${suite.appendixNumber} к Договору № ${suite.contractNumber} от ${suite.contractDateRu} · ${studio.city}`}
      />

      {/* Классическая таблица банковских реквизитов получателя по стандарту РФ */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full border-collapse border border-[#111111] text-[11px] min-w-[480px]">
          <tbody>
            <tr>
              <td colSpan={2} rowSpan={2} className="p-2 align-top border-r border-b border-[#111111] w-[58%]">
                <p className="text-[10px] text-[#7A756D]">Банк получателя</p>
                <p className="font-semibold text-[#111111] mt-0.5">{studio.bankName}</p>
              </td>
              <td className="p-2 border-r border-b border-[#111111] w-[12%] text-[#5C5852]">БИК</td>
              <td className="p-2 border-b border-[#111111] font-mono font-semibold">
                {studio.bik}
              </td>
            </tr>
            <tr>
              <td className="p-2 border-r border-b border-[#111111] text-[#5C5852]">К/с №</td>
              <td className="p-2 border-b border-[#111111] font-mono">
                {studio.correspondentAccount}
              </td>
            </tr>
            <tr>
              <td className="p-2 border-r border-b border-[#111111]">
                <span className="text-[10px] text-[#7A756D] mr-1.5">ИНН</span>
                <strong className="font-mono">{studio.inn}</strong>
              </td>
              <td className="p-2 border-r border-b border-[#111111]">
                <span className="text-[10px] text-[#7A756D] mr-1.5">
                  {studio.entityKind === 'ooo' ? 'КПП' : ogrnLabel}
                </span>
                <strong className="font-mono">
                  {studio.entityKind === 'ooo' ? studio.kpp : studio.ogrnOrOgrnip}
                </strong>
              </td>
              <td rowSpan={2} className="p-2 align-top border-r border-[#111111] text-[#5C5852]">
                Сч. №
              </td>
              <td rowSpan={2} className="p-2 align-top font-mono font-bold">
                {studio.checkingAccount}
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="p-2 border-r border-[#111111]">
                <p className="text-[10px] text-[#7A756D]">Получатель</p>
                <p className="font-bold text-[#111111]">{studio.legalName}</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Плательщик и ЭДО */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pb-4 mb-5 border-b border-[#E5E2DC] text-[11.5px]">
        <div className="sm:col-span-8 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#7A756D]">
            Плательщик (Заказчик)
          </p>
          <p className="font-bold text-[#111111]">
            {customer.displayName}
            {customer.inn ? `, ИНН ${customer.inn}` : ''}
            {customer.kpp ? `, КПП ${customer.kpp}` : ''}
          </p>
          {customer.address && <p className="text-[#5C5852]">{customer.address}</p>}
          <p className="text-[#5C5852]">Контакт по счёту: {customer.contact}</p>
        </div>

        <div className="sm:col-span-4 space-y-1 sm:text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#7A756D]">
            Электронный документооборот
          </p>
          <p className="font-semibold text-[#111111]">{studio.edoOperatorLabel}</p>
          <p className="font-mono text-[10.5px] text-[#5C5852] break-all">
            ID: {studio.edoParticipantId}
          </p>
        </div>
      </div>

      {suite.isNegotiablePendingPrice ? (
        <div
          data-testid="invoice-negotiable-pending-banner"
          className="p-5 bg-[#FAF9F6] border border-[#FF4820]/45 space-y-2 mb-6"
        >
          <p className="text-sm font-bold text-[#FF4820]">
            Счёт ожидает утверждения суммы продюсером (индивидуальный проект)
          </p>
          <p className="text-xs text-[#5C5852]">
            По этой заявке выбран формат «Договорная цена». Чтобы бухгалтерия не получила нулевой
            или ошибочный платёжный документ, конечная сумма сметы вводится продюсером после
            уточнения деталей задачи (или в окне продюсера в Кабинете студии).
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto mb-5">
            <table className="w-full border-collapse border border-[#E5E2DC] text-[11.5px] min-w-[460px]">
              <thead>
                <tr className="bg-[#FAF9F6] border-y border-[#111111] font-bold">
                  <th className="p-2 text-left w-10 border-r border-[#E5E2DC]">№</th>
                  <th className="p-2 text-left border-r border-[#E5E2DC]">
                    Наименование работ / услуг по студийному производству
                  </th>
                  <th className="p-2 text-center w-14 border-r border-[#E5E2DC] whitespace-nowrap">Ед.</th>
                  <th className="p-2 text-center w-20 border-r border-[#E5E2DC] whitespace-nowrap">Кол-во</th>
                  <th className="p-2 text-right w-28 whitespace-nowrap">Сумма</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#E5E2DC]">
                  <td className="p-2.5 font-mono border-r border-[#E5E2DC] align-top">1</td>
                  <td className="p-2.5 border-r border-[#E5E2DC] align-top">
                    <p className="font-semibold text-[#111111]">
                      Создание рекламного аудиоролика и передача исключительных прав по Приложению №{' '}
                      {suite.appendixNumber} к Договору № {suite.contractNumber} от{' '}
                      {suite.contractDateRu}
                    </p>
                    <p className="text-[11px] text-[#5C5852] mt-1">
                      Проект: «{suite.spotWorkingTitle}» · Пакет: {scope.tierTitle} · Хронометраж:{' '}
                      {suite.spotDurationSec} сек · Сдача с Паспортом прав РАО / ВОИС.
                    </p>
                  </td>
                  <td className="p-2.5 text-center border-r border-[#E5E2DC] align-top">усл.</td>
                  <td className="p-2.5 text-center border-r border-[#E5E2DC] align-top">1</td>
                  <td className="p-2.5 text-right font-semibold align-top">
                    {tax.formattedTotalRub}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Итоги налога и сумма прописью */}
          <div className="flex flex-col sm:flex-row justify-between gap-6 items-start pb-6 border-b border-[#E5E2DC]">
            <div className="space-y-1.5 text-[11px] text-[#5C5852] max-w-md">
              <p className="font-semibold text-[#111111]">Назначение платежа для бухгалтерии:</p>
              <p>
                Оплата по Счёту № {suite.invoiceNumber} от {suite.issueDateRu} (Прил. №{' '}
                {suite.appendixNumber} к Договору № {suite.contractNumber}).{' '}
                {tax.vatRatePercent === 0
                  ? 'Без налога (НДС).'
                  : `В т.ч. НДС ${tax.vatRatePercent}%.`}
              </p>
              <p className="pt-1 font-mono text-[10px] text-[#7A756D] break-all">
                Реквизиты импорта (ГОСТ Р 56042-2014): {suite.paymentQrPayload}
              </p>
            </div>

            <div className="w-full sm:w-72 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#5C5852]">База без НДС:</span>
                <span className="font-medium">{tax.formattedSubtotalRub}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5C5852]">
                  {tax.vatRatePercent === 0 ? 'НДС:' : `В том числе НДС ${tax.vatRatePercent}%:`}
                </span>
                <span className="font-medium">{tax.formattedVatLine}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[#111111] text-sm font-bold">
                <span>Всего к оплате:</span>
                <span>{tax.formattedTotalRub}</span>
              </div>
            </div>
          </div>

          <div className="py-3 text-xs font-bold text-[#111111]">
            Всего к оплате: {tax.totalInWordsRu}
          </div>
        </>
      )}

      {/* Подписи руководителя и бухгалтера */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-5 border-t border-[#111111] text-[11px]">
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-2 border-b border-[#111111]/40 pb-1">
            <span className="text-[#5C5852]">{studio.signatoryRoleTitle}</span>
            <span className="font-semibold text-[#111111]">/ {studio.signatoryShortName} /</span>
          </div>
        </div>
        <div className="space-y-4">
          {studio.entityKind === 'ooo' ? (
            <div className="flex items-end justify-between gap-2 border-b border-[#111111]/40 pb-1">
              <span className="text-[#5C5852]">Главный бухгалтер</span>
              <span className="font-semibold text-[#111111]">
                / {studio.chiefAccountantShortName || studio.signatoryShortName} /
              </span>
            </div>
          ) : (
            <p className="text-[11px] text-[#5C5852] pt-1">
              Индивидуальный предприниматель работает без главного бухгалтера (п. 4 ч. 2 ст. 6
              402-ФЗ «О бухгалтерском учёте»).
            </p>
          )}
        </div>
      </div>

      <SheetBrandFooter suite={suite} sheetCode={`Счёт № ${suite.invoiceNumber}`} />
    </article>
  );
}

function RadioPassportSheet({ suite }: { suite: AssembledDocumentSuite }) {
  const { studio, customer, passport } = suite;

  const eightStandardRows = [
    {
      num: '01',
      label: 'Название аудиоролика (точное имя мастер-файла)',
      value: `${suite.spotWorkingTitle} · файл: ${suite.spotMasterFileName}`,
    },
    {
      num: '02',
      label: 'Точный хронометраж (секунды и доли)',
      value: `${suite.spotDurationFormatted} (${suite.spotDurationSec} сек ровно, допуск автоматики ±0,05 сек)`,
    },
    {
      num: '03',
      label: 'Рекламодатель (Заказчик по Договору)',
      value: `${customer.displayName}${customer.inn ? `, ИНН ${customer.inn}` : ''}${
        customer.kpp ? `, КПП ${customer.kpp}` : ''
      }`,
    },
    {
      num: '04',
      label: 'Изготовитель фонограммы (Студия)',
      value: `${studio.legalName}, ИНН ${studio.inn}${
        studio.entityKind === 'ooo' && studio.kpp ? `, КПП ${studio.kpp}` : ''
      }, ${studio.city}, официальный сайт ${studio.websiteDomain}`,
    },
    {
      num: '05',
      label: 'Автор текста / сценария (ст. 1259, 1285 ГК РФ)',
      value: passport.scriptAuthorLine,
    },
    {
      num: '06',
      label: 'Исполнители / дикторы (смежные права, ст. 1317 ГК РФ)',
      value: passport.voiceTalentLine,
    },
    {
      num: '07',
      label: 'Музыкальная фонограмма, автор музыки и статус РАО / ВОИС',
      value: `${passport.musicTitleAndComposer}. Лицензия: ${passport.musicLicenseLine}`,
    },
    {
      num: '08',
      label: 'Территория, способ и срок эфирного использования',
      value: passport.territoryAndTermLine,
    },
  ];

  return (
    <article
      data-testid="a4-sheet-passport"
      className="fmworks-a4-sheet bg-white text-[#111111] w-full max-w-[794px] mx-auto p-4 sm:p-8 lg:p-10 border border-[#E5E2DC] shadow-sm text-xs leading-relaxed"
    >
      <SheetBrandHeader
        suite={suite}
        kicker="Паспорт рекламного аудиоролика · Стандарт приёмки радиостанций РФ"
        title="Сведения об авторских и смежных правах (РАО / ВОИС) и соответствии ФЗ-38"
        docNumberLine={`Паспорт № ${suite.passportNumber} от ${suite.issueDateRu} · к Приложению № ${suite.appendixNumber} Договора № ${suite.contractNumber}`}
      />

      <p className="text-[11px] text-[#5C5852] mb-4">
        Настоящий Паспорт составлен изготовителем фонограммы по единой форме юридических и
        трафик-служб коммерческих радиовещателей Российской Федерации для беспрепятственного
        допуска аудиоролика в эфир и отчётности перед РАО и ВОИС.
      </p>

      {/* Обязательные 8 строк паспорта радиовещателя */}
      <div className="overflow-x-auto mb-5">
        <table className="w-full border-collapse border border-[#111111] text-[11px] tabular-nums min-w-[460px]">
          <thead>
            <tr className="bg-[#FAF9F6] border-b border-[#111111] font-bold">
              <th className="p-2 text-left w-10 border-r border-[#E5E2DC]">№</th>
              <th className="p-2 text-left w-[36%] border-r border-[#E5E2DC]">
                Реквизит стандарта вещателя РФ
              </th>
              <th className="p-2 text-left">Заверенные сведения по мастер-ролику</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E2DC]">
            {eightStandardRows.map((row) => (
              <tr key={row.num}>
                <td className="p-2.5 font-mono text-[#5C5852] border-r border-[#E5E2DC] align-top">
                  {row.num}
                </td>
                <td className="p-2.5 font-semibold text-[#111111] border-r border-[#E5E2DC] align-top">
                  {row.label}
                </td>
                <td className="p-2.5 text-[#111111] align-top">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Подтверждение техконтроля громкости и ФЗ-38 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="p-3.5 bg-[#FAF9F6] border border-[#E5E2DC] space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#FF4820]">
            Технический контроль ФАС (ч. 11 ст. 15 ФЗ-38)
          </p>
          <p className="text-[11px] text-[#111111]">
            Мастер соответствует Разделу 3 Договора: WAV 44 100 Гц / 16 bit Stereo + MP3 320 kbps,
            интегральная громкость <strong>-14 … -11 LUFS</strong>, истинный пиковый уровень{' '}
            <strong>True Peak ≤ -0.5 dBTP</strong>, полная моносовместимость речи.
          </p>
        </div>

        <div className="p-3.5 bg-[#FAF9F6] border border-[#E5E2DC] space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#111111]">
            Правовая очистка контента (ФЗ-38 «О рекламе»)
          </p>
          <p className="text-[11px] text-[#111111]">{passport.fz38StatusLabel}</p>
        </div>
      </div>

      {/* Гарантийное заверение и подпись изготовителя */}
      <div className="pt-4 border-t border-[#111111] flex flex-col sm:flex-row sm:items-end justify-between gap-6 text-[11px]">
        <p className="text-[#5C5852] max-w-md">
          Изготовитель (студия FMWorks®, {studio.city}) подтверждает наличие оригиналов лицензионных
          документов и договоров с диктором и автором сценария на дату выпуска мастер-ролика.
        </p>

        <div className="sm:w-64 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#7A756D]">
            Утверждено Изготовителем
          </p>
          <div className="pt-4 border-b border-[#111111]/45 flex justify-between font-semibold">
            <span>{studio.signatoryRoleTitle}</span>
            <span>/ {studio.signatoryShortName} /</span>
          </div>
        </div>
      </div>

      <SheetBrandFooter suite={suite} sheetCode={`Паспорт № ${suite.passportNumber}`} />
    </article>
  );
}

export function SwissA4DocumentSheets({
  suite,
  activeDoc,
  contractVariant = 'full_with_appendix',
  briefExcerpt,
}: SwissA4DocumentSheetsProps) {
  if (activeDoc === 'kp') {
    return <KpSheet suite={suite} briefExcerpt={briefExcerpt} />;
  }
  if (activeDoc === 'contract') {
    return (
      <ContractAndAppendixSheet
        suite={suite}
        contractVariant={contractVariant}
      />
    );
  }
  if (activeDoc === 'invoice') {
    return <InvoiceSheet suite={suite} />;
  }
  return <RadioPassportSheet suite={suite} />;
}
