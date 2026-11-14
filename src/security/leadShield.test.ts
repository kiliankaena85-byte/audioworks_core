import assert from 'node:assert/strict';
import test from 'node:test';
import { BANNED_EDITORIAL_TERMS } from '../data/studioCmsTypes';
import {
  computeLeadPayloadFingerprint,
  evaluateLeadSubmissionSecurity,
  inspectBriefForSpamSignals,
  LEAD_RATE_LIMIT_STORAGE_KEY,
  RateLimiter,
  resolveLeadFormRateScope,
  SECURITY_DEFENSE_LAYERS,
  solveLeadChallengePow,
  StorageLike,
  validateCompanyOrInnField,
  validateHumanLeadContact,
  verifyLeadChallengePow,
  verifyRussianInnChecksum,
} from './leadShield';

function createMemoryLocalStorage(): StorageLike & { dump: () => Record<string, string> } {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? (map.get(key) ?? null) : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
    dump() {
      return Object.fromEntries(map.entries());
    },
  };
}

test('Контактный фильтр пропускает реальные телефоны, @Telegram и корпоративную почту, блокируя ботов и мусор', () => {
  assert.equal(validateHumanLeadContact('Антон +7 (926) 555-44-33').valid, true);
  assert.equal(validateHumanLeadContact('Мария @maria_marketing').valid, true);
  assert.equal(validateHumanLeadContact('Илья director@company-group.ru').valid, true);

  // Одинаковые и последовательные цифры
  assert.equal(validateHumanLeadContact('+7 999 999-99-99').valid, false);
  assert.equal(validateHumanLeadContact('81234567890').valid, false);

  // Одноразовые почты и клавиатурный мусор
  assert.equal(validateHumanLeadContact('user@mailinator.com').valid, false);
  assert.equal(validateHumanLeadContact('qwerty12345').valid, false);
  assert.equal(validateHumanLeadContact('тест').valid, false);
  assert.equal(validateHumanLeadContact('Иван https://spam.biz').isLikelyBotGarbage, true);
});

test('Математическая проверка ИНН ФНС валидирует реальные 10- и 12-значные ИНН и отклоняет поддельные', () => {
  // Реальный 10-значный ИНН юрлица (7707083893) и 12-значный ИНН ИП (500100732259)
  assert.equal(verifyRussianInnChecksum('7707083893'), true);
  assert.equal(verifyRussianInnChecksum('500100732259'), true);
  assert.equal(verifyRussianInnChecksum('7707083894'), false);
  assert.equal(verifyRussianInnChecksum('0000000000'), false);

  const validCompany = validateCompanyOrInnField('ООО «СеверСтрой Девелопмент»');
  assert.equal(validCompany.valid, true);
  assert.equal(validCompany.innVerified, false);

  const validInn = validateCompanyOrInnField('ИНН 7707083893');
  assert.equal(validInn.valid, true);
  assert.equal(validInn.innVerified, true);
  assert.equal(validInn.normalizedValue, '7707083893');

  const invalidInn = validateCompanyOrInnField('7707083894');
  assert.equal(invalidInn.valid, false);
  assert.ok(invalidInn.error && invalidInn.error.includes('ИНН'));

  const wrongLenInn = validateCompanyOrInnField('123456789');
  assert.equal(wrongLenInn.valid, false);

  const combinedValid = validateCompanyOrInnField('ООО «Квартал Инвест» · ИНН 7707083893');
  assert.equal(combinedValid.valid, true);
  assert.equal(combinedValid.innVerified, true);

  const combinedInvalid = validateCompanyOrInnField('ООО «Квартал Инвест» · ИНН 7707083894');
  assert.equal(combinedInvalid.valid, false);
  assert.equal(combinedInvalid.innVerified, false);
});

test('Браузерный микро-PoW решается детерминированно и проходит серверную верификацию', () => {
  const salt = 'fmworks-salt-2026-xyz';
  const solved = solveLeadChallengePow(salt, 3);
  assert.equal(verifyLeadChallengePow(salt, solved.solution, 3), true);
  assert.equal(verifyLeadChallengePow(salt, 'wrong-nonce', 3), false);
});

test('Контентный экран выявляет ссылочный спам, казино-рассылки и XSS-попытки', () => {
  const cleanBrief = inspectBriefForSpamSignals(
    'Нужен ролик 20 секунд для открытия новой стоматологии, акцент на имплантацию.'
  );
  assert.equal(cleanBrief.isBotSpam, false);

  const linkSpam = inspectBriefForSpamSignals(
    'Продвижение и рассылка https://one-spam.ru и https://two-spam.ru дешево!'
  );
  assert.equal(linkSpam.isBotSpam, true);

  const xssAttempt = inspectBriefForSpamSignals('<script>fetch("https://evil.tld")</script>');
  assert.equal(xssAttempt.isBotSpam, true);
});

test('Теневой карантин изолирует ботов с conversionAllowed=false, а реальным клиентам открывает конверсию', () => {
  const salt = 'unit-test-salt';
  const pow = solveLeadChallengePow(salt, 3);

  // 1. Бот заполнил невидимый honeypot -> карантин, рекламные пиксели заблокированы
  const honeypotBot = evaluateLeadSubmissionSecurity({
    contactLine: 'Алексей +7 926 555-44-33',
    companyLine: '7707083893',
    briefText: 'Ролик для ЖК',
    hasVoiceRecording: false,
    hasAttachedFile: false,
    isReturningFastTrack: false,
    requireBriefOrVoice: true,
    websiteTrap: 'https://bot-directory.org',
    dwellMs: 4200,
    pointerMoves: 4,
    keystrokes: 12,
    focusEvents: 2,
    challengeValid: verifyLeadChallengePow(salt, pow.solution, 3),
    nonceAlreadyUsed: false,
    powValid: true,
    isDuplicateRecentPayload: false,
  });
  assert.equal(honeypotBot.verdict, 'quarantined_bot');
  assert.equal(honeypotBot.conversionAllowed, false);

  // 2. Мгновенный HTTP-скрипт без PoW и без моторики -> карантин
  const headlessCurlBot = evaluateLeadSubmissionSecurity({
    contactLine: 'Олег +7 916 234-56-78',
    companyLine: '',
    briefText: 'Заявка на рекламу',
    hasVoiceRecording: false,
    hasAttachedFile: false,
    isReturningFastTrack: false,
    requireBriefOrVoice: true,
    websiteTrap: '',
    dwellMs: 80,
    pointerMoves: 0,
    keystrokes: 0,
    focusEvents: 0,
    challengeValid: false,
    nonceAlreadyUsed: false,
    powValid: false,
    isDuplicateRecentPayload: false,
  });
  assert.equal(headlessCurlBot.verdict, 'quarantined_bot');
  assert.equal(headlessCurlBot.conversionAllowed, false);

  // 3. Живой B2B-клиент с опечаткой в ИНН -> понятная ошибка поля, не карантин
  const humanTypo = evaluateLeadSubmissionSecurity({
    contactLine: 'Дмитрий +7 926 777-88-12',
    companyLine: '7707083899',
    briefText: 'Запуск радиокампании на 3 месяца',
    hasVoiceRecording: false,
    hasAttachedFile: false,
    isReturningFastTrack: false,
    requireBriefOrVoice: true,
    websiteTrap: '',
    dwellMs: 6400,
    pointerMoves: 15,
    keystrokes: 28,
    focusEvents: 3,
    challengeValid: true,
    nonceAlreadyUsed: false,
    powValid: true,
    isDuplicateRecentPayload: false,
  });
  assert.equal(humanTypo.verdict, 'validation_error');
  assert.ok(humanTypo.companyError);

  // 4. Верифицированный живой клиент -> verified_human и conversionAllowed = true
  const verifiedHuman = evaluateLeadSubmissionSecurity({
    contactLine: 'Дмитрий +7 926 777-88-12',
    companyLine: '7707083893',
    briefText: 'Запуск радиокампании на 3 месяца для медицинского центра',
    hasVoiceRecording: false,
    hasAttachedFile: false,
    isReturningFastTrack: false,
    requireBriefOrVoice: true,
    websiteTrap: '',
    dwellMs: 6400,
    pointerMoves: 15,
    keystrokes: 28,
    focusEvents: 3,
    challengeValid: true,
    nonceAlreadyUsed: false,
    powValid: true,
    isDuplicateRecentPayload: false,
  });
  assert.equal(verifiedHuman.verdict, 'verified_human');
  assert.equal(verifiedHuman.conversionAllowed, true);
  assert.equal(verifiedHuman.innVerified, true);

  const fp1 = computeLeadPayloadFingerprint('Дмитрий +7 926 777-88-12', '7707083893', 'Бриф');
  const fp2 = computeLeadPayloadFingerprint('  дмитрий +7 926 777-88-12 ', '7707083893', 'бриф');
  assert.equal(fp1, fp2);
});

test('RateLimiter сохраняет попытки в localStorage, разделяет лимиты заказа ролика и брони эфира и блокирует спам-флуд', () => {
  const mockStorage = createMemoryLocalStorage();
  const baseTime = 1_700_000_000_000;

  assert.equal(resolveLeadFormRateScope('production_only'), 'production_order');
  assert.equal(resolveLeadFormRateScope('air_plus_production'), 'air_booking');

  const limiter = new RateLimiter({
    windowMs: 10 * 60 * 1000,
    maxAttempts: 4,
    minIntervalMs: 1200,
    storageKey: LEAD_RATE_LIMIT_STORAGE_KEY,
    storage: mockStorage,
  });

  // 1-я отправка заказа ролика разрешена и сохраняется в localStorage
  const attempt1 = limiter.consume('production_order', baseTime);
  assert.equal(attempt1.allowed, true);
  assert.equal(attempt1.attemptsInWindow, 1);
  assert.equal(attempt1.remainingAttempts, 3);

  const rawSaved = mockStorage.getItem(LEAD_RATE_LIMIT_STORAGE_KEY);
  assert.ok(rawSaved && rawSaved.includes('production_order'));

  // Мгновенный повтор через 300 мс блокируется защитой от очереди кликов (burst_cooldown)
  const burstAttempt = limiter.consume('production_order', baseTime + 300);
  assert.equal(burstAttempt.allowed, false);
  assert.equal(burstAttempt.reason, 'burst_cooldown');
  assert.ok(burstAttempt.retryAfterSec >= 1);

  // Попытки 2, 3 и 4 с нормальным интервалом проходят
  assert.equal(limiter.consume('production_order', baseTime + 2_000).allowed, true);
  assert.equal(limiter.consume('production_order', baseTime + 4_000).allowed, true);
  const attempt4 = limiter.consume('production_order', baseTime + 6_000);
  assert.equal(attempt4.allowed, true);
  assert.equal(attempt4.remainingAttempts, 0);

  // 5-я попытка в пределах 10-минутного окна блокируется (window_limit)
  const attempt5Blocked = limiter.consume('production_order', baseTime + 10_000);
  assert.equal(attempt5Blocked.allowed, false);
  assert.equal(attempt5Blocked.reason, 'window_limit');
  assert.ok(attempt5Blocked.retryAfterSec > 500);

  // При этом форма «Бронь эфира» (air_booking) имеет независимый контур и остаётся доступной
  const airAttempt1 = limiter.consume('air_booking', baseTime + 10_000);
  assert.equal(airAttempt1.allowed, true);
  assert.equal(airAttempt1.remainingAttempts, 3);

  // Новый экземпляр RateLimiter после перезагрузки страницы читает то же состояние из localStorage
  const reloadedLimiter = new RateLimiter({
    windowMs: 10 * 60 * 1000,
    maxAttempts: 4,
    minIntervalMs: 1200,
    storageKey: LEAD_RATE_LIMIT_STORAGE_KEY,
    storage: mockStorage,
  });
  assert.equal(reloadedLimiter.check('production_order', baseTime + 15_000).allowed, false);

  // После истечения 10-минутного окна квота полностью восстанавливается
  const afterWindow = reloadedLimiter.consume('production_order', baseTime + 10 * 60 * 1000 + 7_000);
  assert.equal(afterWindow.allowed, true);
  assert.equal(afterWindow.attemptsInWindow, 1);
  assert.equal(afterWindow.remainingAttempts, 3);
});

test('useRateLimit отслеживает точные интервалы между сабмитами в localStorage для OrderPage и RadioInventoryAdmin', async () => {
  const { createRateLimitController } = await import('./useRateLimit');
  const mockStorage = createMemoryLocalStorage();
  const t0 = 1_710_000_000_000;

  const orderLimit = createRateLimitController({
    scope: 'production_order',
    maxAttempts: 4,
    windowMs: 10 * 60 * 1000,
    minIntervalMs: 1200,
    storage: mockStorage,
  });

  const quotaImportLimit = createRateLimitController({
    scope: 'quota_import',
    maxAttempts: 5,
    windowMs: 5 * 60 * 1000,
    minIntervalMs: 1500,
    storage: mockStorage,
  });

  // Первый сабмит в OrderPage: lastIntervalMs === null
  const firstOrder = orderLimit.recordAttempt('production_order', t0);
  assert.equal(firstOrder.allowed, true);
  assert.equal(firstOrder.lastIntervalMs, null);
  assert.equal(firstOrder.remainingAttempts, 3);

  // Повторный сабмит в OrderPage через 450 мс (< 1200 мс) блокируется по интервалу
  const rapidOrder = orderLimit.recordAttempt('production_order', t0 + 450);
  assert.equal(rapidOrder.allowed, false);
  assert.equal(rapidOrder.reason, 'burst_cooldown');
  assert.equal(rapidOrder.lastIntervalMs, 450);

  // Сабмит в OrderPage через 1800 мс (>= 1200 мс) проходит и фиксирует точный интервал 1800 мс
  const secondOrder = orderLimit.recordAttempt('production_order', t0 + 1800);
  assert.equal(secondOrder.allowed, true);
  assert.equal(secondOrder.lastIntervalMs, 1800);
  assert.equal(secondOrder.remainingAttempts, 2);

  // Импорт квот в RadioInventoryAdmin использует тот же localStorage, но изолированный контур quota_import
  const firstImport = quotaImportLimit.recordAttempt('quota_import', t0 + 500);
  assert.equal(firstImport.allowed, true);
  assert.equal(firstImport.lastIntervalMs, null);
  assert.equal(firstImport.remainingAttempts, 4);

  // Слишком частый повторный клик публикации квот через 600 мс (< 1500 мс) блокируется
  const rapidImport = quotaImportLimit.recordAttempt('quota_import', t0 + 1100);
  assert.equal(rapidImport.allowed, false);
  assert.equal(rapidImport.reason, 'burst_cooldown');
  assert.equal(rapidImport.lastIntervalMs, 600);
  assert.ok(rapidImport.retryAfterSec >= 1);

  // Публикация следующей партии квот через 2000 мс (>= 1500 мс) проходит штатно
  const secondImport = quotaImportLimit.recordAttempt('quota_import', t0 + 2500);
  assert.equal(secondImport.allowed, true);
  assert.equal(secondImport.lastIntervalMs, 2000);
  assert.equal(secondImport.remainingAttempts, 3);
});

test('Описания 7 контуров безопасности не содержат запрещённых редакционных штампов и гео-привязок', () => {
  assert.equal(SECURITY_DEFENSE_LAYERS.length, 7);
  const serialized = JSON.stringify(SECURITY_DEFENSE_LAYERS).toLowerCase();
  for (const banned of BANNED_EDITORIAL_TERMS) {
    assert.equal(
      serialized.includes(banned),
      false,
      `Обнаружено запрещённое слово "${banned}" в SECURITY_DEFENSE_LAYERS`
    );
  }
});
