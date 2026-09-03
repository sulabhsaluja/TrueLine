/**
 * src/ingest/normalizer.js
 *
 * Pure normalization functions - no file I/O, no matching logic.
 * Converts one raw CSV row (plain object of string values) into the common
 * NormalizedRecord shape, or throws a NormalizationError.
 *
 * IMPORTANT: source_ref_id is carried for audit/display ONLY.
 * The matching engine MUST NOT use it as a join key.
 * Matching in later phases is done exclusively on amount_paisa + date_iso.
 *
 * Amount: stored as integer paisa (1 INR = 100 paisa) to eliminate
 * floating-point comparison bugs.  "1234.56" -> 123456 paisa.
 *
 * Date: normalized to ISO-8601 "YYYY-MM-DD" strings.
 */

'use strict';

// ---------------------------------------------------------------------------
// Custom error type
// ---------------------------------------------------------------------------
class NormalizationError extends Error {
  constructor(message, field, rawValue) {
    super(message);
    this.name = 'NormalizationError';
    this.field = field;
    this.rawValue = rawValue;
  }
}

// ---------------------------------------------------------------------------
// Shared field parsers
// ---------------------------------------------------------------------------

/**
 * Parse a string amount to integer paisa.
 * Accepts: "1234.56", "500", "  277183.8  ".
 * Rejects: empty strings, non-numeric text, negative values.
 */
function parseAmountPaisa(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    throw new NormalizationError(
      'amount field is missing or empty',
      'amount',
      raw
    );
  }
  const trimmed = String(raw).trim();
  const numeric = parseFloat(trimmed);
  if (isNaN(numeric)) {
    throw new NormalizationError(
      'amount is not a valid number: "' + trimmed + '"',
      'amount',
      raw
    );
  }
  if (numeric < 0) {
    throw new NormalizationError(
      'amount must not be negative: "' + trimmed + '"',
      'amount',
      raw
    );
  }
  // Round to nearest paisa to absorb sub-paisa float noise in the CSV
  return Math.round(numeric * 100);
}

/**
 * Parse a date string into ISO-8601 "YYYY-MM-DD".
 * Rejects blank, non-YYYY-MM-DD strings, and invalid calendar dates.
 */
function parseDateIso(raw, fieldName) {
  if (fieldName === undefined) { fieldName = 'date'; }
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    throw new NormalizationError(
      fieldName + ' field is missing or empty',
      fieldName,
      raw
    );
  }
  const trimmed = String(raw).trim();
  const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  if (!ISO_PATTERN.test(trimmed)) {
    throw new NormalizationError(
      fieldName + ' is not in YYYY-MM-DD format: "' + trimmed + '"',
      fieldName,
      raw
    );
  }
  const asDate = new Date(trimmed + 'T00:00:00Z');
  if (isNaN(asDate.getTime())) {
    throw new NormalizationError(
      fieldName + ' is not a real calendar date: "' + trimmed + '"',
      fieldName,
      raw
    );
  }
  // Re-serialise to catch silent calendar overflow (e.g. Feb 30 -> Mar 2)
  const reSer = asDate.toISOString().slice(0, 10);
  if (reSer !== trimmed) {
    throw new NormalizationError(
      fieldName + ' rolls over to a different date ("' + trimmed + '" -> "' + reSer + '"), likely invalid calendar day',
      fieldName,
      raw
    );
  }
  return trimmed;
}

/**
 * Require a non-blank string field.
 */
function requireString(raw, fieldName) {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    throw new NormalizationError(
      fieldName + ' field is missing or empty',
      fieldName,
      raw
    );
  }
  return String(raw).trim();
}

// ---------------------------------------------------------------------------
// Per-source normalizers
// ---------------------------------------------------------------------------

/**
 * Normalize one row from bank_statement.csv.
 * Expected columns: date, amount, utr, narration
 */
function normalizeBank(rawRow) {
  const sourceRefId  = requireString(rawRow.utr, 'utr');
  const amountPaisa  = parseAmountPaisa(rawRow.amount);
  const dateIso      = parseDateIso(rawRow.date, 'date');
  const counterparty = requireString(rawRow.narration, 'narration');
  return {
    source: 'bank',
    source_ref_id: sourceRefId,
    amount_paisa: amountPaisa,
    date_iso: dateIso,
    counterparty_or_narration: counterparty,
    raw_row: Object.assign({}, rawRow),
  };
}

/**
 * Normalize one row from internal_ledger.csv.
 * Expected columns: invoice_id, amount, date, customer_vendor
 */
function normalizeLedger(rawRow) {
  const sourceRefId  = requireString(rawRow.invoice_id, 'invoice_id');
  const amountPaisa  = parseAmountPaisa(rawRow.amount);
  const dateIso      = parseDateIso(rawRow.date, 'date');
  const counterparty = requireString(rawRow.customer_vendor, 'customer_vendor');
  return {
    source: 'ledger',
    source_ref_id: sourceRefId,
    amount_paisa: amountPaisa,
    date_iso: dateIso,
    counterparty_or_narration: counterparty,
    raw_row: Object.assign({}, rawRow),
  };
}

/**
 * Normalize one row from gateway_export.csv.
 * Expected columns: payment_id, amount, status, settlement_date
 */
function normalizeGateway(rawRow) {
  const sourceRefId  = requireString(rawRow.payment_id, 'payment_id');
  const amountPaisa  = parseAmountPaisa(rawRow.amount);
  const dateIso      = parseDateIso(rawRow.settlement_date, 'settlement_date');
  const counterparty = requireString(rawRow.status, 'status');
  return {
    source: 'gateway',
    source_ref_id: sourceRefId,
    amount_paisa: amountPaisa,
    date_iso: dateIso,
    counterparty_or_narration: counterparty,
    raw_row: Object.assign({}, rawRow),
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} NormalizedRecord
 * @property {'bank'|'ledger'|'gateway'} source
 * @property {string} source_ref_id  UTR / invoice_id / payment_id (audit only, NOT a join key)
 * @property {number} amount_paisa   Integer paisa (1 INR = 100 paisa)
 * @property {string} date_iso       ISO date "YYYY-MM-DD"
 * @property {string} counterparty_or_narration  Descriptive field per source
 * @property {Object} raw_row        Original CSV row for audit trail
 */

module.exports = {
  normalizeBank,
  normalizeLedger,
  normalizeGateway,
  parseAmountPaisa,
  parseDateIso,
  NormalizationError,
};
