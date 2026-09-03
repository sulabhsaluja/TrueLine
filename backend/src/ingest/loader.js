/**
 * src/ingest/loader.js
 *
 * File-I/O layer: reads the three source CSVs, streams each row through the
 * appropriate normalizer, and returns a structured result object.
 *
 * This is the ONLY place in the ingestion layer that touches the filesystem.
 * Normalizer functions in normalizer.js are pure and have no file access.
 *
 * Return shape:
 * {
 *   bank:    NormalizedRecord[],
 *   ledger:  NormalizedRecord[],
 *   gateway: NormalizedRecord[],
 *   skipped: SkippedRow[],
 *   summary: { bank_ok, bank_skipped, ledger_ok, ledger_skipped,
 *              gateway_ok, gateway_skipped, total_ok, total_skipped }
 * }
 *
 * Does NOT perform any cross-source matching - that is Phase 3/4.
 */

'use strict';

const fs   = require('node:fs');
const path = require('node:path');
const { parse } = require('csv-parse/sync');

const {
  normalizeBank,
  normalizeLedger,
  normalizeGateway,
  NormalizationError,
} = require('./normalizer');

/**
 * @typedef {Object} SkippedRow
 * @property {string} source       'bank' | 'ledger' | 'gateway'
 * @property {string} file         Absolute path to the CSV
 * @property {number} row_number   1-based row index (header = 0)
 * @property {string} reason       Human-readable failure reason
 * @property {string} field        Which field caused the failure
 * @property {*}      raw_value    The bad value
 * @property {Object} raw_row      Full raw row for context
 */

/**
 * Read one CSV file and normalize every row.
 * Per-row NormalizationErrors are caught and logged in skipped[].
 * I/O errors (file missing etc.) are rethrown - they are config failures.
 */
function loadSource(filePath, sourceName, normalizeFn) {
  const absolutePath = path.resolve(filePath);
  const raw = fs.readFileSync(absolutePath, 'utf-8');

  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: false,
  });

  const records = [];
  const skipped = [];

  rows.forEach(function(rawRow, index) {
    const rowNumber = index + 1;
    try {
      records.push(normalizeFn(rawRow));
    } catch (err) {
      if (err instanceof NormalizationError) {
        const skip = {
          source: sourceName,
          file: absolutePath,
          row_number: rowNumber,
          reason: err.message,
          field: err.field,
          raw_value: err.rawValue,
          raw_row: rawRow,
        };
        skipped.push(skip);
        console.warn(
          '[INGEST] SKIP row ' + rowNumber + ' in ' + path.basename(filePath) +
          ': field="' + err.field + '" value="' + err.rawValue + '" - ' + err.message
        );
      } else {
        throw err;
      }
    }
  });

  return { records: records, skipped: skipped };
}

/**
 * Load and normalize all three source files.
 *
 * @param {Object} options
 * @param {string} options.bankPath
 * @param {string} options.ledgerPath
 * @param {string} options.gatewayPath
 * @returns {IngestResult}
 */
function loadAllSources(options) {
  console.log('[INGEST] Starting ingestion...');

  const bankResult    = loadSource(options.bankPath,    'bank',    normalizeBank);
  const ledgerResult  = loadSource(options.ledgerPath,  'ledger',  normalizeLedger);
  const gatewayResult = loadSource(options.gatewayPath, 'gateway', normalizeGateway);

  const allSkipped = bankResult.skipped.concat(ledgerResult.skipped, gatewayResult.skipped);

  const summary = {
    bank_ok:         bankResult.records.length,
    bank_skipped:    bankResult.skipped.length,
    ledger_ok:       ledgerResult.records.length,
    ledger_skipped:  ledgerResult.skipped.length,
    gateway_ok:      gatewayResult.records.length,
    gateway_skipped: gatewayResult.skipped.length,
    total_ok:        bankResult.records.length + ledgerResult.records.length + gatewayResult.records.length,
    total_skipped:   allSkipped.length,
  };

  console.log('[INGEST] Ingestion complete.');
  console.log('[INGEST] Summary:', JSON.stringify(summary));

  if (allSkipped.length > 0) {
    console.warn('[INGEST] WARNING: ' + allSkipped.length + ' row(s) skipped due to malformed data.');
  }

  return {
    bank:    bankResult.records,
    ledger:  ledgerResult.records,
    gateway: gatewayResult.records,
    skipped: allSkipped,
    summary: summary,
  };
}

/**
 * @typedef {Object} IngestResult
 * @property {NormalizedRecord[]} bank
 * @property {NormalizedRecord[]} ledger
 * @property {NormalizedRecord[]} gateway
 * @property {SkippedRow[]}       skipped
 * @property {Object}             summary
 */

module.exports = { loadAllSources: loadAllSources };
