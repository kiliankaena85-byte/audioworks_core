import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDiadocDraftPostMessagePayload,
  counterpartyToDocumentMetaPatch,
  formatKonturExternInvoiceCsv,
  parseDadataPartyResponse,
  parseDiadocGetOrganizationsResponse,
  parseKonturFocusReqResponse,
  resolveOfflineCounterpartyByInn,
} from './konturIntegrationCore.ts';
import { assembleProductionDocumentSuite } from './studioDocumentsCore.ts';

test('resolveOfflineCounterpartyByInn находит эталонные карточки СКБ Контур и ИП, а также отклоняет невалидный ИНН', () => {
  const kontur = resolveOfflineCounterpartyByInn('6663003127');
  assert.ok(kontur);
  assert.equal(kontur.entityKind, 'legal_entity');
  assert.equal(kontur.shortName, 'АО «ПФ "СКБ Контур"»');
  assert.equal(kontur.kpp, '668601001');
  assert.equal(kontur.ogrn, '1026605606620');
  assert.equal(kontur.diadoc.hasBox, true);
  assert.ok(kontur.diadoc.boxId.startsWith('2BM-6663003127'));

  const ip = resolveOfflineCounterpartyByInn('500100732259');
  assert.ok(ip);
  assert.equal(ip.entityKind, 'sole_proprietor');
  assert.equal(ip.kpp, '');
  assert.equal(ip.ogrn.length, 15);
  assert.equal(ip.diadoc.hasBox, true);

  const invalid = resolveOfflineCounterpartyByInn('7707083894');
  assert.equal(invalid, null);
});

test('parseDadataPartyResponse, parseKonturFocusReqResponse и parseDiadocGetOrganizationsResponse корректно разбирают ответы шлюзов', () => {
  const dadata = parseDadataPartyResponse(
    {
      suggestions: [
        {
          value: 'ООО «Радио Волна»',
          data: {
            inn: '6950241890',
            kpp: '695001001',
            ogrn: '1236900008415',
            type: 'LEGAL',
            name: {
              full_with_opf: 'Общество с ограниченной ответственностью «Радио Волна»',
              short_with_opf: 'ООО «Радио Волна»',
            },
            address: {
              unrestricted_value: '170100, Тверская обл., г. Тверь, ул. Советская, д. 12',
            },
            management: {
              post: 'Генеральный директор',
              name: 'Петров Илья Сергеевич',
            },
            state: { status: 'ACTIVE' },
          },
        },
      ],
    },
    '6950241890'
  );
  assert.ok(dadata);
  assert.equal(dadata.shortName, 'ООО «Радио Волна»');
  assert.equal(dadata.kpp, '695001001');
  assert.equal(dadata.signatory, 'Генеральный директор Петров Илья Сергеевич');

  const focus = parseKonturFocusReqResponse(
    [
      {
        inn: '6663003127',
        ogrn: '1026605606620',
        UL: {
          kpp: '668601001',
          legalName: {
            full: 'Акционерное общество «ПФ "СКБ Контур"»',
            short: 'АО «ПФ "СКБ Контур"»',
          },
          heads: [{ position: 'Генеральный директор', fio: 'Мармузов М. Ю.' }],
        },
      },
    ],
    '6663003127'
  );
  assert.ok(focus);
  assert.equal(focus.kpp, '668601001');
  assert.equal(focus.source, 'kontur_focus');

  const diadoc = parseDiadocGetOrganizationsResponse({
    Organizations: [
      {
        IsRoaming: false,
        Boxes: [{ BoxId: '2BM-6663003127-668601001-0000000000001' }],
      },
    ],
  });
  assert.ok(diadoc);
  assert.equal(diadoc.hasBox, true);
  assert.equal(diadoc.isRoaming, false);
  assert.equal(diadoc.boxId, '2BM-6663003127-668601001-0000000000001');
});

test('buildDiadocDraftPostMessagePayload формирует безопасный черновик IsDraft=true и formatKonturExternInvoiceCsv выгружает UTF-8 BOM CSV', () => {
  const cp = resolveOfflineCounterpartyByInn('6663003127')!;
  const metaPatch = counterpartyToDocumentMetaPatch(cp, { wantsDiadocDuplicate: true });
  const suite = assembleProductionDocumentSuite({
    orderNumber: 'FM-9042',
    createdAtIso: '2026-04-18T10:00:00.000Z',
    formatLabel: 'Продакшн под ключ (20 сек)',
    baseBudgetRub: 25000,
    contact: 'Елена +7 912 345-67-89',
    companyOrInn: 'АО «ПФ "СКБ Контур"» · ИНН 6663003127',
    briefText: 'Имиджевый ролик для конференции',
    documentMeta: metaPatch,
  });

  const payload = buildDiadocDraftPostMessagePayload({
    suite,
    fromBoxId: '2BM-695008412904-FMWORKS',
    toBoxId: cp.diadoc.boxId,
    invoiceTextContent: 'СЧЁТ НА ОПЛАТУ № СЧ-2026/9042-1',
  });

  assert.equal(payload.IsDraft, true);
  assert.equal(payload.FromBoxId, '2BM-695008412904-FMWORKS');
  assert.equal(payload.ToBoxId, cp.diadoc.boxId);
  assert.equal(payload.NonformalizedDocuments.length, 1);
  assert.equal(payload.NonformalizedDocuments[0].TotalSum, '25000.00');
  assert.equal(payload.NonformalizedDocuments[0].CustomDocumentId, 'FM-9042');
  const decoded = Buffer.from(
    payload.NonformalizedDocuments[0].SignedContent.Content,
    'base64'
  ).toString('utf8');
  assert.match(decoded, /СЧЁТ НА ОПЛАТУ/);

  const csv = formatKonturExternInvoiceCsv(suite);
  assert.ok(csv.startsWith('\uFEFFНомер счета;Дата счета;'));
  assert.match(csv, /6663003127;668601001;1026605606620/);
  assert.match(csv, /25000,00/);
});
