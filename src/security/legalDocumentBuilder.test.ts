import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDefaultStudioLegalProfiles,
  sanitizeStudioLegalProfilesConfig,
} from '../data/studioDocumentsCore';
import {
  buildOperatorPassportSummary,
  buildPolicyProcessingPurposes,
  buildStandaloneConsentSpec,
  formatOperatorInlineRequisites,
  PLATFORM_COOKIE_AND_STORAGE_SPEC,
  validateCabinetEmailConsent,
} from './legalDocumentBuilder';

test('По умолчанию платформа работает в режиме ООО-only без упоминания ИП в Политике, Согласии и подвале', () => {
  const defaults = createDefaultStudioLegalProfiles();
  assert.equal(defaults.activeEntityKind, 'ooo');
  assert.equal(defaults.legalOperatingMode, 'ooo_only');

  const inlineFooter = formatOperatorInlineRequisites(defaults);
  assert.match(inlineFooter, /Общество с ограниченной ответственностью «ФМ Воркс Продакшн»/);
  assert.match(inlineFooter, /ИНН 6950241890/);
  assert.match(inlineFooter, /КПП 695001001/);
  assert.match(inlineFooter, /ОГРН 1236900008415/);
  assert.equal(inlineFooter.includes('Соколов'), false);
  assert.equal(inlineFooter.includes('ОГРНИП'), false);

  const passport = buildOperatorPassportSummary(defaults);
  assert.equal(passport.secondaryEntityDisclosure, null);
  assert.equal(passport.operatorTitle.includes('Индивидуальный предприниматель'), false);

  const consent = buildStandaloneConsentSpec(defaults);
  assert.match(consent.leadParagraph, /Общество с ограниченной ответственностью «ФМ Воркс Продакшн»/);
  assert.equal(consent.leadParagraph.includes('ИП Соколов'), false);
  assert.equal(consent.actionsParagraph.includes('ИП Соколов'), false);
});

test('Очистка ИНН/КПП/ОГРН администратором («реквизиты добавлю позже») не возвращает старый хардкод и не ломает вёрстку', () => {
  const pendingOoo = sanitizeStudioLegalProfilesConfig({
    activeEntityKind: 'ooo',
    legalOperatingMode: 'ooo_only',
    oooProfile: {
      entityKind: 'ooo',
      legalName: 'ООО «Новая Аудиостудия»',
      shortBrandTitle: 'FMWorks® (ООО «Новая Аудиостудия»)',
      inn: '',
      kpp: '',
      ogrnOrOgrnip: '',
      city: 'г. Тверь',
      legalAddress: '',
      bankName: '',
      bik: '',
      correspondentAccount: '',
      checkingAccount: '',
      signatoryRoleTitle: 'Генеральный директор',
      signatoryFullName: '',
      signatoryShortName: '',
      chiefAccountantShortName: '',
      authorityBasis: 'действующего на основании Устава',
      edoOperatorLabel: '',
      edoParticipantId: '',
      websiteDomain: 'fmworks.ru',
      email: 'legal@fmworks.ru',
      phone: '+79040000911',
      taxRegime: 'usn_no_vat',
      vatMode: 'included',
    },
    privacyPolicy: {
      privacyEmail: 'dpo@fmworks.ru',
      rknRegistryNumber: '',
      policyVersionDate: '20.11.2026',
      hostingLocationLabel: 'РФ, ЦОД г. Тверь',
      showRequisitesInFooter: true,
      cookieBannerEnabled: true,
    },
  });

  assert.equal(pendingOoo.oooProfile.inn, '');
  assert.equal(pendingOoo.oooProfile.kpp, '');
  assert.equal(pendingOoo.oooProfile.ogrnOrOgrnip, '');

  const inlineFooter = formatOperatorInlineRequisites(pendingOoo);
  assert.equal(inlineFooter, 'ООО «Новая Аудиостудия» · г. Тверь');
  assert.equal(inlineFooter.includes('ИНН '), false);
  assert.equal(inlineFooter.includes('КПП '), false);
  assert.equal(inlineFooter.includes('ОГРН '), false);

  const passport = buildOperatorPassportSummary(pendingOoo);
  assert.equal(passport.hasFullRegistrationIds, false);
  assert.ok(passport.pendingRegistrationNote && passport.pendingRegistrationNote.length > 10);
  assert.equal(passport.privacyEmail, 'dpo@fmworks.ru');
  assert.equal(passport.policyVersionDate, '20.11.2026');
  assert.equal(passport.hostingLocationLabel, 'РФ, ЦОД г. Тверь');
});

test('Переключение в режим ip_only или both корректно меняет Оператора ПДн и номер РКН без правок кода', () => {
  const ipOnly = sanitizeStudioLegalProfilesConfig({
    activeEntityKind: 'ooo', // при ip_only принудительно переключается на ip
    legalOperatingMode: 'ip_only',
    ipProfile: {
      entityKind: 'ip',
      legalName: 'ИП Иванов Пётр Сергеевич',
      shortBrandTitle: 'FMWorks® (ИП Иванов П. С.)',
      inn: '695011223344',
      kpp: '999999999',
      ogrnOrOgrnip: '324695200099111',
      city: 'г. Тверь',
      legalAddress: '170100, г. Тверь, ул. Советская, д. 10',
      bankName: 'АО «ТБанк»',
      bik: '044525974',
      correspondentAccount: '30101810145250000974',
      checkingAccount: '40802810900001482910',
      signatoryRoleTitle: 'Индивидуальный предприниматель',
      signatoryFullName: 'Иванов Пётр Сергеевич',
      signatoryShortName: 'Иванов П. С.',
      chiefAccountantShortName: '',
      authorityBasis: 'действующий на основании ОГРНИП',
      edoOperatorLabel: 'Контур.Диадок',
      edoParticipantId: '2BM-IP-IVANOV',
      websiteDomain: 'fmworks.ru',
      email: 'ip@fmworks.ru',
      phone: '+79040000911',
      taxRegime: 'usn_no_vat',
      vatMode: 'included',
    },
    privacyPolicy: {
      privacyEmail: 'ip@fmworks.ru',
      rknRegistryNumber: '69-26-014892',
      policyVersionDate: '16.11.2026',
      hostingLocationLabel: 'Российская Федерация',
      showRequisitesInFooter: true,
      cookieBannerEnabled: true,
    },
  });

  assert.equal(ipOnly.activeEntityKind, 'ip');
  assert.equal(ipOnly.ipProfile.kpp, '');
  const footerLine = formatOperatorInlineRequisites(ipOnly);
  assert.match(footerLine, /ИП Иванов Пётр Сергеевич/);
  assert.match(footerLine, /ИНН 695011223344/);
  assert.match(footerLine, /ОГРНИП 324695200099111/);
  assert.match(footerLine, /Реестр РКН № 69-26-014892/);
  assert.equal(footerLine.includes('КПП'), false);
  assert.equal(footerLine.includes('ФМ Воркс'), false);

  const bothMode = sanitizeStudioLegalProfilesConfig({
    ...ipOnly,
    legalOperatingMode: 'both',
    activeEntityKind: 'ooo',
  });
  const bothPassport = buildOperatorPassportSummary(bothMode);
  assert.equal(bothPassport.entityKindLabel, 'Общество с ограниченной ответственностью (ООО)');
  assert.ok(
    bothPassport.secondaryEntityDisclosure &&
      bothPassport.secondaryEntityDisclosure.includes('ИП Иванов Пётр Сергеевич') &&
      bothPassport.secondaryEntityDisclosure.includes('ч. 3 ст. 6 Закона № 152-ФЗ')
  );
});

test('Реестр целей Политики и таблица cookie охватывают Личный кабинет, аватары, HttpOnly cookie и сроки хранения', () => {
  const purposes = buildPolicyProcessingPurposes();
  assert.equal(purposes.length, 4);
  const joined = JSON.stringify(purposes);
  assert.match(joined, /\/cabinet/);
  assert.match(joined, /аватар/);
  assert.match(joined, /HttpOnly/);
  assert.match(joined, /Core Web Vitals/);
  assert.match(joined, /10 рабочих дней/);
  assert.match(joined, /402-ФЗ/);

  assert.ok(
    PLATFORM_COOKIE_AND_STORAGE_SPEC.some(
      (item) => item.storageKey === 'fmworks_client_session'
    )
  );
  const specKeysJoined = PLATFORM_COOKIE_AND_STORAGE_SPEC.map((i) => i.storageKey).join(' ');
  for (const key of [
    'fmworks_order_draft_v1',
    'fmworks_client_cabinet_v1',
    'fmworks_cabinet_device_avatar_v1',
    'fmworks_lead_rate_limiter_v1',
    'fmworks_theme_v1',
    'fmworks_hero_volume_v1',
    'audioworks_laya_visits_v1',
  ]) {
    assert.ok(specKeysJoined.includes(key), `Missing storage key in spec: ${key}`);
  }
});

test('validateCabinetEmailConsent блокирует отправку без галочки 152-ФЗ (156-ФЗ) и при некорректном e-mail', () => {
  const noConsent = validateCabinetEmailConsent({
    email: 'client@company.ru',
    consentAccepted: false,
  });
  assert.equal(noConsent.valid, false);
  assert.equal(noConsent.emailError, null);
  assert.match(noConsent.consentError ?? '', /152-ФЗ/);

  const badEmail = validateCabinetEmailConsent({
    email: 'not-an-email',
    consentAccepted: true,
  });
  assert.equal(badEmail.valid, false);
  assert.ok(badEmail.emailError);
  assert.equal(badEmail.consentError, null);

  const ok = validateCabinetEmailConsent({
    email: 'client@company.ru',
    consentAccepted: true,
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.emailError, null);
  assert.equal(ok.consentError, null);
});
