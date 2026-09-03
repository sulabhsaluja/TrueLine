/**
 * tests/ingest/normalizer.test.js
 *
 * Unit tests for src/ingest/normalizer.js
 * Run: node --test tests/ingest/normalizer.test.js
 */

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeBank,
  normalizeLedger,
  normalizeGateway,
  parseAmountPaisa,
  parseDateIso,
  NormalizationError,
} = require('../../src/ingest/normalizer');

// Helper: assert fn() throws a NormalizationError, optionally checking .field
function assertNormErr(fn, expectedField) {
  let threw = false;
  try { fn(); } catch (err) {
    threw = true;
    assert.ok(
      err instanceof NormalizationError,
      'Expected NormalizationError but got ' + err.constructor.name
    );
    if (expectedField) {
      assert.strictEqual(err.field, expectedField,
        'Expected error on field "' + expectedField + '" but got "' + err.field + '"');
    }
  }
  assert.ok(threw, 'Expected NormalizationError but nothing was thrown');
}

// ============================================================================
// parseAmountPaisa
// ============================================================================

test('parseAmountPaisa: "1234.56" -> 123456 paisa', () => {
  assert.strictEqual(parseAmountPaisa('1234.56'), 123456);
});

test('parseAmountPaisa: integer string "500" -> 50000 paisa', () => {
  assert.strictEqual(parseAmountPaisa('500'), 50000);
});

test('parseAmountPaisa: strips surrounding whitespace', () => {
  assert.strictEqual(parseAmountPaisa('  999.99  '), 99999);
});

test('parseAmountPaisa: handles trailing single decimal "277183.8" -> 27718380 paisa', () => {
  assert.strictEqual(parseAmountPaisa('277183.8'), 27718380);
});

test('parseAmountPaisa: throws NormalizationError for empty string', () => {
  assertNormErr(() => parseAmountPaisa(''), 'amount');
});

test('parseAmountPaisa: throws NormalizationError for null', () => {
  assertNormErr(() => parseAmountPaisa(null), 'amount');
});

test('parseAmountPaisa: throws NormalizationError for non-numeric text "abc"', () => {
  assertNormErr(() => parseAmountPaisa('abc'), 'amount');
});

test('parseAmountPaisa: throws NormalizationError for negative amount "-100"', () => {
  assertNormErr(() => parseAmountPaisa('-100'), 'amount');
});

// ============================================================================
// parseDateIso
// ============================================================================

test('parseDateIso: accepts valid "2026-07-15"', () => {
  assert.strictEqual(parseDateIso('2026-07-15'), '2026-07-15');
});

test('parseDateIso: strips surrounding whitespace', () => {
  assert.strictEqual(parseDateIso('  2026-08-01  '), '2026-08-01');
});

test('parseDateIso: throws on empty string', () => {
  assertNormErr(() => parseDateIso(''), 'date');
});

test('parseDateIso: throws on DD/MM/YYYY format', () => {
  assertNormErr(() => parseDateIso('15/07/2026'), 'date');
});

test('parseDateIso: throws on impossible calendar day 2026-02-30', () => {
  assertNormErr(() => parseDateIso('2026-02-30'), 'date');
});

test('parseDateIso: uses custom fieldName in error message', () => {
  let thrownField = null;
  try { parseDateIso('', 'settlement_date'); } catch (e) { thrownField = e.field; }
  assert.strictEqual(thrownField, 'settlement_date');
});

// ============================================================================
// normalizeBank
// ============================================================================

test('normalizeBank: well-formed row normalizes correctly', () => {
  const raw = {
    date: '2026-07-11',
    amount: '451270.21',
    utr: 'IMPS530613729',
    narration: 'Payment for services rendered',
  };
  const r = normalizeBank(raw);
  assert.strictEqual(r.source, 'bank');
  assert.strictEqual(r.source_ref_id, 'IMPS530613729');
  assert.strictEqual(r.amount_paisa, 45127021);
  assert.strictEqual(r.date_iso, '2026-07-11');
  assert.strictEqual(r.counterparty_or_narration, 'Payment for services rendered');
  assert.deepEqual(r.raw_row, raw);
});

test('normalizeBank: missing amount -> NormalizationError on "amount"', () => {
  assertNormErr(
    () => normalizeBank({ date: '2026-07-11', amount: '', utr: 'IMPS999', narration: 'T' }),
    'amount'
  );
});

test('normalizeBank: bad date format DD-MM-YYYY -> NormalizationError on "date"', () => {
  assertNormErr(
    () => normalizeBank({ date: '11-07-2026', amount: '1000.00', utr: 'NEFT1', narration: 'T' }),
    'date'
  );
});

test('normalizeBank: blank UTR -> NormalizationError on "utr"', () => {
  assertNormErr(
    () => normalizeBank({ date: '2026-07-11', amount: '500.00', utr: '', narration: 'T' }),
    'utr'
  );
});

test('normalizeBank: near-miss - whitespace-padded amount is accepted', () => {
  const r = normalizeBank({ date: '2026-07-01', amount: '  1000.00  ', utr: 'UPI1234', narration: 'X' });
  assert.strictEqual(r.amount_paisa, 100000);
});

// ============================================================================
// normalizeLedger
// ============================================================================

test('normalizeLedger: well-formed row normalizes correctly', () => {
  const raw = {
    invoice_id: 'INV-2026-0046',
    amount: '288057.33',
    date: '2026-07-31',
    customer_vendor: 'Infosys Ltd',
  };
  const r = normalizeLedger(raw);
  assert.strictEqual(r.source, 'ledger');
  assert.strictEqual(r.source_ref_id, 'INV-2026-0046');
  assert.strictEqual(r.amount_paisa, 28805733);
  assert.strictEqual(r.date_iso, '2026-07-31');
  assert.strictEqual(r.counterparty_or_narration, 'Infosys Ltd');
  assert.deepEqual(r.raw_row, raw);
});

test('normalizeLedger: non-numeric amount "N/A" -> NormalizationError on "amount"', () => {
  assertNormErr(
    () => normalizeLedger({ invoice_id: 'INV-01', amount: 'N/A', date: '2026-07-01', customer_vendor: 'Corp' }),
    'amount'
  );
});

test('normalizeLedger: whitespace-only invoice_id -> NormalizationError on "invoice_id"', () => {
  assertNormErr(
    () => normalizeLedger({ invoice_id: '   ', amount: '1000.00', date: '2026-07-01', customer_vendor: 'Corp' }),
    'invoice_id'
  );
});

test('normalizeLedger: impossible date month 13 -> NormalizationError on "date"', () => {
  assertNormErr(
    () => normalizeLedger({ invoice_id: 'INV-X', amount: '500.00', date: '2026-13-01', customer_vendor: 'Corp' }),
    'date'
  );
});

test('normalizeLedger: near-miss - customer_vendor with special chars is accepted', () => {
  const r = normalizeLedger({ invoice_id: 'INV-1', amount: '999.50', date: '2026-08-01', customer_vendor: 'TCS & Partners (Pvt.)' });
  assert.strictEqual(r.counterparty_or_narration, 'TCS & Partners (Pvt.)');
});

// ============================================================================
// normalizeGateway
// ============================================================================

test('normalizeGateway: well-formed row normalizes correctly', () => {
  const raw = {
    payment_id: 'pay_26978995874443',
    amount: '351576.04',
    status: 'captured',
    settlement_date: '2026-07-20',
  };
  const r = normalizeGateway(raw);
  assert.strictEqual(r.source, 'gateway');
  assert.strictEqual(r.source_ref_id, 'pay_26978995874443');
  assert.strictEqual(r.amount_paisa, 35157604);
  assert.strictEqual(r.date_iso, '2026-07-20');
  assert.strictEqual(r.counterparty_or_narration, 'captured');
  assert.deepEqual(r.raw_row, raw);
});

test('normalizeGateway: null payment_id -> NormalizationError on "payment_id"', () => {
  assertNormErr(
    () => normalizeGateway({ payment_id: null, amount: '1000.00', status: 'settled', settlement_date: '2026-07-20' }),
    'payment_id'
  );
});

test('normalizeGateway: wrong settlement_date format -> NormalizationError on "settlement_date"', () => {
  assertNormErr(
    () => normalizeGateway({ payment_id: 'pay_1', amount: '500.00', status: 'settled', settlement_date: '20-07-2026' }),
    'settlement_date'
  );
});

test('normalizeGateway: blank status -> NormalizationError on "status"', () => {
  assertNormErr(
    () => normalizeGateway({ payment_id: 'pay_2', amount: '750.00', status: '', settlement_date: '2026-07-01' }),
    'status'
  );
});

test('normalizeGateway: near-miss - settlement_date at fixture boundary 2026-08-20 is accepted', () => {
  const r = normalizeGateway({ payment_id: 'pay_999', amount: '100.00', status: 'settled', settlement_date: '2026-08-20' });
  assert.strictEqual(r.date_iso, '2026-08-20');
});
