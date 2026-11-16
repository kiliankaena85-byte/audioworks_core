import {
  createDefaultStudioLegalProfiles,
  resolveActiveStudioProfile,
  type StudioEntityKind,
  type StudioLegalProfile,
  type StudioLegalProfilesConfig,
} from '../data/studioDocumentsCore.ts';

export type RknOperatorActKind =
  | 'rkn_notification_draft'
  | 'dpo_appointment_order'
  | 'pdn_destruction_act';

export interface RknActFieldRow {
  label: string;
  value: string;
}

export interface RknActSection {
  heading: string;
  paragraphs?: readonly string[];
  rows?: readonly RknActFieldRow[];
  bullets?: readonly string[];
}

export interface GeneratedRknOperatorAct {
  kind: RknOperatorActKind;
  documentCode: string;
  shortTabLabel: string;
  officialTitle: string;
  lawBasisSubtitle: string;
  issueDateRu: string;
  city: string;
  operatorLegalName: string;
  operatorInn: string;
  operatorOgrnLabel: string;
  operatorOgrnValue: string;
  operatorAddress: string;
  signatoryRole: string;
  signatoryFullName: string;
  signatoryShortName: string;
  sections: readonly RknActSection[];
  suggestedFileNameBase: string;
}

export interface PdnDestructionActContext {
  orderNumber?: string | null;
  anonymizedAtIso?: string | null;
  destructionReason?: string | null;
  operatorActorLabel?: string | null;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateRu(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function formatDateTimeRu(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function resolveTargetStudioProfile(
  config: Partial<StudioLegalProfilesConfig> | null | undefined,
  entityOverride?: StudioEntityKind
): {
  profile: StudioLegalProfile;
  fullConfig: StudioLegalProfilesConfig;
} {
  const defaults = createDefaultStudioLegalProfiles();
  const merged: StudioLegalProfilesConfig = {
    ...defaults,
    ...(config ?? {}),
    ipProfile: { ...defaults.ipProfile, ...(config?.ipProfile ?? {}) },
    oooProfile: { ...defaults.oooProfile, ...(config?.oooProfile ?? {}) },
    privacyPolicy: {
      ...defaults.privacyPolicy!,
      ...(config?.privacyPolicy ?? {}),
    },
  };
  const profile = entityOverride
    ? entityOverride === 'ip'
      ? merged.ipProfile
      : merged.oooProfile
    : resolveActiveStudioProfile(merged);
  return { profile, fullConfig: merged };
}

/**
 * Генерирует пакет из 3 обязательных внутренних локальных актов Оператора по 152-ФЗ (с подстановкой ООО / ИП):
 * 1) Проект сведений для Уведомления Роскомнадзора (ч. 3 ст. 22 152-ФЗ);
 * 2) Приказ / Распоряжение о назначении ответственного и утверждении Политики ПДн (ст. 18.1, ст. 22.1 152-ФЗ);
 * 3) Акт об уничтожении / обезличивании ПДн (ч. 5 ст. 21 152-ФЗ, Приказ РКН от 28.10.2022 № 179).
 */
export function buildRknOperatorAct(params: {
  kind: RknOperatorActKind;
  legalProfiles?: Partial<StudioLegalProfilesConfig> | null;
  entityOverride?: StudioEntityKind;
  destructionContext?: PdnDestructionActContext | null;
  nowIso?: string;
}): GeneratedRknOperatorAct {
  const nowIso =
    params.destructionContext?.anonymizedAtIso ||
    params.nowIso ||
    new Date().toISOString();
  const issueDateRu = formatDateRu(nowIso);
  const dateCompact = nowIso.slice(0, 10).replace(/-/g, '');
  const { profile, fullConfig } = resolveTargetStudioProfile(
    params.legalProfiles,
    params.entityOverride
  );

  const isIp = profile.entityKind === 'ip';
  const ogrnLabel = isIp ? 'ОГРНИП' : 'ОГРН';
  const ogrnValue = profile.ogrnOrOgrnip || 'указывается по листу записи ЕГРЮЛ/ЕГРИП';
  const innValue = profile.inn || 'указывается по свидетельству ФНС';
  const kppPart = !isIp && profile.kpp ? `, КПП ${profile.kpp}` : '';
  const privacyEmail =
    fullConfig.privacyPolicy?.privacyEmail || profile.email || 'art@artmspektr.ru';
  const hostingLocation =
    fullConfig.privacyPolicy?.hostingLocationLabel ||
    'Российская Федерация (серверные мощности в контуре РФ)';
  const rknRegNumber =
    fullConfig.privacyPolicy?.rknRegistryNumber?.trim() ||
    'подаётся через портал pd.rkn.gov.ru';
  const domain = profile.websiteDomain || 'fmworks.ru';
  const fullSignatory =
    profile.signatoryFullName?.trim() || profile.signatoryShortName;

  if (params.kind === 'rkn_notification_draft') {
    return {
      kind: 'rkn_notification_draft',
      documentCode: `РКН-22-${dateCompact}`,
      shortTabLabel: '1. Бланк уведомления РКН (ст. 22)',
      officialTitle:
        'КАРТОЧКА СВЕДЕНИЙ ДЛЯ УВЕДОМЛЕНИЯ РОСКОМНАДЗОРА ОБ ОБРАБОТКЕ ПЕРСОНАЛЬНЫХ ДАННЫХ',
      lawBasisSubtitle:
        'Подготовлено в соответствии с ч. 3 ст. 22 Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных» для переноса на портал pd.rkn.gov.ru',
      issueDateRu,
      city: profile.city || 'г. Тверь',
      operatorLegalName: profile.legalName,
      operatorInn: innValue,
      operatorOgrnLabel: ogrnLabel,
      operatorOgrnValue: ogrnValue,
      operatorAddress: profile.legalAddress,
      signatoryRole: profile.signatoryRoleTitle,
      signatoryFullName: fullSignatory,
      signatoryShortName: profile.signatoryShortName,
      suggestedFileNameBase: `FMWorks-RKN-Notification-22FZ-${dateCompact}`,
      sections: [
        {
          heading: '1. Сведения об Операторе персональных данных',
          rows: [
            {
              label: 'Тип оператора',
              value: isIp
                ? 'Индивидуальный предприниматель'
                : 'Юридическое лицо (коммерческая организация)',
            },
            { label: 'Полное наименование', value: profile.legalName },
            {
              label: 'ИНН / Регистрационный номер',
              value: `ИНН ${innValue}${kppPart} · ${ogrnLabel} ${ogrnValue}`,
            },
            { label: 'Адрес местонахождения', value: profile.legalAddress },
            {
              label: 'Регион осуществления деятельности',
              value: 'Тверская область и вся территория Российской Федерации (дистанционно по ЭДО)',
            },
            {
              label: 'Регистрационный номер в реестре РКН',
              value: rknRegNumber,
            },
          ],
        },
        {
          heading: '2. Цели обработки, категории ПДн и субъектов (ст. 22 152-ФЗ)',
          rows: [
            {
              label: 'Цель обработки № 1',
              value:
                'Подготовка, заключение и исполнение гражданско-правовых договоров на производство аудиороликов, выставление счетов и обмен актами в ЭДО',
            },
            {
              label: 'Категории субъектов ПДн',
              value:
                'Контрагенты (ИП), уполномоченные представители юридических лиц — заказчиков, посетители сайта, направившие заявку на расчёт заказа',
            },
            {
              label: 'Обрабатываемые категории ПДн',
              value:
                'Иные категории ПДн: имя (ФИО представителя), контактный номер телефона, адрес электронной почты, никнейм мессенджера, должность и реквизиты представляемого юрлица (ИНН). Специальные и биометрические ПДн НЕ обрабатываются.',
            },
            {
              label: 'Правовое основание обработки',
              value:
                'п. 1 и п. 5 ч. 1 ст. 6 Закона № 152-ФЗ; ст. 432–434, гл. 37, ст. 1234, 1288 ГК РФ; согласие субъекта ПДн на сайте ' +
                domain,
            },
            {
              label: 'Перечень действий с ПДн',
              value:
                'Сбор, запись, систематизация, накопление, хранение, уточнение (обновление, изменение), извлечение, использование, блокирование, удаление, уничтожение, обезличивание (смешанная обработка с передачей по внутренней сети)',
            },
          ],
        },
        {
          heading:
            '3. Локализация баз данных в РФ (ч. 5 ст. 18) и отсутствие трансграничной передачи (ст. 12)',
          rows: [
            {
              label: 'Сведения о местонахождении базы данных ПДн граждан РФ',
              value: `Российская Федерация · ${hostingLocation}`,
            },
            {
              label: 'Трансграничная передача персональных данных (ст. 12 152-ФЗ)',
              value:
                'НЕ ОСУЩЕСТВЛЯЕТСЯ (зарубежные счётчики Google Analytics, Google Fonts, reCAPTCHA отключены; внешние оперативные оповещения обезличены)',
            },
            {
              label: 'Ответственный за организацию обработки ПДн (ст. 22.1)',
              value: `${profile.signatoryRoleTitle} ${fullSignatory} · тел. ${profile.phone} · e-mail: ${privacyEmail}`,
            },
            {
              label: 'Условие прекращения обработки и срок хранения',
              value:
                'Достижение целей исполнения договора и истечение сроков хранения первичных учётных документов (5 лет по 402-ФЗ и НК РФ) либо получение отзыва согласия по ст. 21 152-ФЗ',
            },
          ],
        },
        {
          heading: '4. Описание мер по обеспечению безопасности ПДн (ст. 18.1, ст. 19 152-ФЗ)',
          bullets: [
            'Издана и опубликована в открытом доступе на странице https://' +
              domain +
              '/privacy Политика в отношении обработки персональных данных.',
            'Применяется шифрование трафика по протоколу TLS (HTTPS), криптографическое хеширование одноразовых токенов доступа (SHA-256) и защита cookie флагами HttpOnly / SameSite.',
            'Реализован механизм принудительного обезличивания ПДн в журнале сделок по ч. 5 ст. 21 152-ФЗ с формированием акта по Приказу РКН № 179.',
          ],
        },
      ],
    };
  }

  if (params.kind === 'dpo_appointment_order') {
    const docHeadingWord = isIp ? 'РАСПОРЯЖЕНИЕ' : 'ПРИКАЗ';
    return {
      kind: 'dpo_appointment_order',
      documentCode: `01-ПДн/${nowIso.slice(0, 4)}`,
      shortTabLabel: '2. Приказ об ответственном (ст. 22.1)',
      officialTitle: `${docHeadingWord} № 01-ПДн/${nowIso.slice(0, 4)} «О назначении ответственного за организацию обработки персональных данных и утверждении Политики ПДн»`,
      lawBasisSubtitle:
        'Во исполнение требований ст. 18.1, ст. 19 и ст. 22.1 Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных»',
      issueDateRu,
      city: profile.city || 'г. Тверь',
      operatorLegalName: profile.legalName,
      operatorInn: innValue,
      operatorOgrnLabel: ogrnLabel,
      operatorOgrnValue: ogrnValue,
      operatorAddress: profile.legalAddress,
      signatoryRole: profile.signatoryRoleTitle,
      signatoryFullName: fullSignatory,
      signatoryShortName: profile.signatoryShortName,
      suggestedFileNameBase: `FMWorks-Order-22_1FZ-DPO-${dateCompact}`,
      sections: [
        {
          heading: 'Преамбула',
          paragraphs: [
            `В целях обеспечения законности и безопасности при обработке персональных данных представителей корпоративных заказчиков и посетителей веб-сайта https://${domain}, а также соблюдения запрета на несанкционированную трансграничную передачу данных (ст. 12, ч. 5 ст. 18 Федерального закона № 152-ФЗ), ${
              isIp ? 'РАСПОРЯЖАЮСЬ:' : 'ПРИКАЗЫВАЮ:'
            }`,
          ],
        },
        {
          heading: 'Распорядительная часть',
          bullets: [
            `1. Возложить функции лица, ответственного за организацию обработки персональных данных у Оператора (${profile.legalName}, ИНН ${innValue}), на: ${profile.signatoryRoleTitle} — ${fullSignatory} (контактный адрес для обращений субъектов ПДн и Роскомнадзора: ${privacyEmail}).`,
            `2. Утвердить и ввести в действие с «${issueDateRu}» Политику в отношении обработки персональных данных и обеспечить неограниченный доступ к ней по постоянному адресу https://${domain}/privacy (ч. 2 ст. 18.1 152-ФЗ).`,
            '3. Установить запрет на подключение на сайте и в клиентских формах зарубежных аналитических скриптов, шрифтовых CDN и сервисов капчи, влекущих трансграничную передачу IP-адресов граждан РФ без соблюдения процедуры ст. 12 152-ФЗ.',
            '4. Обязать сотрудников и привлекаемых по договорам звукорежиссёров работать со сделками через обезличенные технические листы (/sound-drop) без пересылки персональных данных заказчиков в открытых каналах.',
            '5. При достижении целей обработки либо поступлении отзыва согласия субъекта ПДн производить необратимое обезличивание/уничтожение записи в реестре CRM в срок не более 10 рабочих дней с оформлением Акта по форме Приказа Роскомнадзора от 28.10.2022 № 179.',
            '6. Контроль за исполнением настоящего документа оставляю за собой.',
          ],
        },
      ],
    };
  }

  // 3. Акт об уничтожении / обезличивании ПДн (Приказ РКН № 179)
  const targetOrderNo = params.destructionContext?.orderNumber?.trim();
  const actSuffix = targetOrderNo
    ? targetOrderNo.replace(/[^A-Za-zА-Яа-яЁё0-9-]/g, '')
    : dateCompact;
  const reasonText =
    params.destructionContext?.destructionReason?.trim() ||
    (targetOrderNo
      ? `Достижение цели обработки персональных данных / обращение субъекта ПДн по сделке #${targetOrderNo} (ч. 4–5 ст. 21 Закона № 152-ФЗ)`
      : 'Достижение целей обработки персональных данных / плановое прекращение хранения анкет (ч. 4 ст. 21 Закона № 152-ФЗ)');

  return {
    kind: 'pdn_destruction_act',
    documentCode: `АКТ-УПДн-${actSuffix}`,
    shortTabLabel: '3. Акт уничтожения ПДн (Приказ РКН № 179)',
    officialTitle: `АКТ № АКТ-УПДн-${actSuffix} ОБ УНИЧТОЖЕНИИ (ОБЕЗЛИЧИВАНИИ) ПЕРСОНАЛЬНЫХ ДАННЫХ`,
    lawBasisSubtitle:
      'Составлен по обязательным требованиям Приказа Роскомнадзора от 28.10.2022 № 179 и ч. 5 ст. 21 Федерального закона № 152-ФЗ (срок хранения акта — 3 года)',
    issueDateRu,
    city: profile.city || 'г. Тверь',
    operatorLegalName: profile.legalName,
    operatorInn: innValue,
    operatorOgrnLabel: ogrnLabel,
    operatorOgrnValue: ogrnValue,
    operatorAddress: profile.legalAddress,
    signatoryRole: profile.signatoryRoleTitle,
    signatoryFullName: fullSignatory,
    signatoryShortName: profile.signatoryShortName,
    suggestedFileNameBase: `FMWorks-Act-RK179-${actSuffix}`,
    sections: [
      {
        heading:
          '1. Обязательные сведения об Операторе и ответственном лице (п. 3 Приказа РКН № 179)',
        rows: [
          {
            label: 'Наименование и адрес Оператора',
            value: `${profile.legalName}, ИНН ${innValue}${kppPart}, ${ogrnLabel} ${ogrnValue}; адрес: ${profile.legalAddress}`,
          },
          {
            label: 'Лицо, осуществившее уничтожение ПДн',
            value: `${profile.signatoryRoleTitle} ${fullSignatory}${
              params.destructionContext?.operatorActorLabel
                ? ` (учётная запись оператора: ${params.destructionContext.operatorActorLabel})`
                : ''
            }`,
          },
          {
            label: 'Наименование информационной системы ПДн (ИСПДн)',
            value: `ИСПДн «Реестр коммерческих заказов и клиентский кабинет ${domain}» (сервер в контуре РФ)`,
          },
        ],
      },
      {
        heading:
          '2. Сведения об уничтоженных (обезличенных) записях и способе уничтожения',
        rows: [
          {
            label: 'Идентификатор записи / объём субъектов ПДн',
            value: targetOrderNo
              ? `Карточка заказа #${targetOrderNo} и связанные записи журнала заявок (1 субъект ПДн — представитель заказчика)`
              : 'Записи реестра заявок с истёкшим сроком достижения цели обработки (согласно выгрузке системного журнала ИСПДн)',
          },
          {
            label: 'Перечень категорий уничтоженных ПДн',
            value:
              'Имя (ФИО), контактный номер телефона, адрес электронной почты, идентификатор мессенджера, персональные примечания брифа и клиентская сессия кабинета',
          },
          {
            label: 'Вид материального носителя и способ уничтожения',
            value:
              'Электронная запись в базе данных ИСПДн; необратимое программное удаление и перезапись полей ПДн маркером «[ПДН УДАЛЕНЫ ПО 152-ФЗ]» без возможности восстановления исходных значений',
          },
          {
            label: 'Причина уничтожения персональных данных',
            value: reasonText,
          },
          {
            label: 'Дата и время совершения операции в ИСПДн',
            value: formatDateTimeRu(nowIso),
          },
        ],
      },
      {
        heading: '3. Подтверждение выгрузки из журнала регистрации событий ИСПДн',
        paragraphs: [
          `Настоящим подтверждается, что персональные данные субъекта в ИСПДн «${domain}» уничтожены в полном объёме без возможности восстановления. Одновременно сформирована запись в электронном журнале безопасности ИСПДн (событие order_pdn_anonymized), которая вместе с настоящим Актом подлежит хранению в течение 3 (трёх) лет в соответствии с п. 8 Требований, утверждённых Приказом Роскомнадзора от 28.10.2022 № 179.`,
        ],
      },
    ],
  };
}

/**
 * Формирует автономный печатный лист A4 в формате HTML для сохранения в архив Оператора или печати в PDF.
 */
export function renderRknOperatorActPrintableHtml(
  act: GeneratedRknOperatorAct
): string {
  const sectionsHtml = act.sections
    .map((sec) => {
      const paras = (sec.paragraphs ?? [])
        .map((p) => `<p class="para">${escapeHtml(p)}</p>`)
        .join('');
      const rows =
        sec.rows && sec.rows.length > 0
          ? `<table class="spec-table"><tbody>${sec.rows
              .map(
                (r) =>
                  `<tr><th>${escapeHtml(r.label)}</th><td>${escapeHtml(r.value)}</td></tr>`
              )
              .join('')}</tbody></table>`
          : '';
      const bullets =
        sec.bullets && sec.bullets.length > 0
          ? `<ul class="bullets">${sec.bullets
              .map((b) => `<li>${escapeHtml(b)}</li>`)
              .join('')}</ul>`
          : '';
      return `<section class="sec"><h2>${escapeHtml(sec.heading)}</h2>${paras}${rows}${bullets}</section>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(act.officialTitle)}</title>
  <style>
    @page { size: A4 portrait; margin: 16mm 18mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color: #111111; line-height: 1.45; font-size: 12px; max-width: 780px; margin: 0 auto; padding: 24px; }
    .topbar { border-top: 4px solid #C83210; padding-top: 12px; display: flex; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
    .op-name { font-weight: 700; font-size: 13px; }
    .op-req { color: #444; font-size: 11px; margin-top: 3px; }
    .doc-code { text-align: right; font-size: 11px; color: #444; white-space: nowrap; }
    h1 { font-size: 15px; line-height: 1.3; margin: 12px 0 6px; text-transform: uppercase; }
    .subtitle { font-size: 11px; color: #555; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #DDD; }
    .meta-line { display: flex; justify-content: space-between; font-weight: 600; margin-bottom: 14px; font-size: 12px; }
    .sec { margin-bottom: 16px; }
    h2 { font-size: 12.5px; margin: 0 0 8px; color: #111; }
    .para { margin: 0 0 8px; text-align: justify; }
    .spec-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    .spec-table th, .spec-table td { border: 1px solid #D4D2CC; padding: 6px 8px; vertical-align: top; text-align: left; font-size: 11.5px; }
    .spec-table th { width: 34%; background: #F7F6F2; font-weight: 600; color: #222; }
    .bullets { margin: 0; padding-left: 18px; }
    .bullets li { margin-bottom: 6px; text-align: justify; }
    .sig-box { margin-top: 28px; padding-top: 14px; border-top: 1px solid #CCC; display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; }
  </style>
</head>
<body>
  <div class="topbar">
    <div>
      <div class="op-name">${escapeHtml(act.operatorLegalName)}</div>
      <div class="op-req">ИНН ${escapeHtml(act.operatorInn)} · ${escapeHtml(act.operatorOgrnLabel)} ${escapeHtml(act.operatorOgrnValue)} · ${escapeHtml(act.operatorAddress)}</div>
    </div>
    <div class="doc-code">Рег. № ${escapeHtml(act.documentCode)}<br/>от ${escapeHtml(act.issueDateRu)}</div>
  </div>
  <h1>${escapeHtml(act.officialTitle)}</h1>
  <div class="subtitle">${escapeHtml(act.lawBasisSubtitle)}</div>
  <div class="meta-line"><span>${escapeHtml(act.city)}</span><span>«${escapeHtml(act.issueDateRu)}»</span></div>
  ${sectionsHtml}
  <div class="sig-box">
    <div><strong>${escapeHtml(act.signatoryRole)}</strong><br/>${escapeHtml(act.operatorLegalName)}</div>
    <div>__________________ / ${escapeHtml(act.signatoryShortName)} /<br/><span style="font-size:10px;color:#666;">М.П. (при наличии печати)</span></div>
  </div>
</body>
</html>`;
}
