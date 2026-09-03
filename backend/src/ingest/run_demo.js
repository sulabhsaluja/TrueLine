/**
 * src/ingest/run_demo.js
 *
 * CLI demo for Phase 2: loads all three sources, prints one sample
 * normalized record per source, and shows the ingestion summary.
 * Not part of application logic - for manual verification only.
 *
 * Run:  node src/ingest/run_demo.js
 *  or:  npm run ingest:demo
 */

'use strict';

const path = require('node:path');
const { loadAllSources } = require('./loader');

const DATA_DIR = path.resolve(__dirname, '../../data');

const result = loadAllSources({
  bankPath:    path.join(DATA_DIR, 'bank_statement.csv'),
  ledgerPath:  path.join(DATA_DIR, 'internal_ledger.csv'),
  gatewayPath: path.join(DATA_DIR, 'gateway_export.csv'),
});

console.log('\n========== INGESTION SUMMARY ==========');
console.log(JSON.stringify(result.summary, null, 2));

console.log('\n========== SAMPLE: bank (first record) ==========');
console.log(JSON.stringify(result.bank[0], null, 2));

console.log('\n========== SAMPLE: ledger (first record) ==========');
console.log(JSON.stringify(result.ledger[0], null, 2));

console.log('\n========== SAMPLE: gateway (first record) ==========');
console.log(JSON.stringify(result.gateway[0], null, 2));

if (result.skipped.length > 0) {
  console.log('\n========== SKIPPED ROWS ==========');
  result.skipped.forEach(function(s) { console.log(JSON.stringify(s, null, 2)); });
} else {
  console.log('\n[INGEST] No rows skipped - all rows parsed successfully.');
}
