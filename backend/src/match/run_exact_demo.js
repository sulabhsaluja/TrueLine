'use strict';
const path = require('node:path');
const { runPipeline } = require('../index');

const DATA_DIR = path.resolve(__dirname, '../../data');
const pipeline = runPipeline({
  bankPath:    path.join(DATA_DIR, 'bank_statement.csv'),
  ledgerPath:  path.join(DATA_DIR, 'internal_ledger.csv'),
  gatewayPath: path.join(DATA_DIR, 'gateway_export.csv')
});

const ingest = pipeline.ingest;
const result = pipeline.exactResult;

console.log('\n[EXACT-MATCH DEMO] Ingested:');
console.log('  bank:    ' + ingest.bank.length    + ' records');
console.log('  ledger:  ' + ingest.ledger.length  + ' records');
console.log('  gateway: ' + ingest.gateway.length + ' records');
console.log('  total:   ' + ingest.summary.total_ok + ' records');

// ----------------------------------------------------
var exactCount   = result.exact_matches.length;
var pendingCount = result.pending.length;

var totalUnderlying = exactCount + 0;
var pendingKeys = new Set();
result.pending.forEach(function(r) { pendingKeys.add(r.amount_paisa + '|' + r.date_iso); });
var pendingGroupCount = pendingKeys.size;

var pendingBySrc = { bank: 0, ledger: 0, gateway: 0 };
result.pending.forEach(function(r) { pendingBySrc[r.source]++; });

var ambiguousCount = result.pending.filter(function(r) {
  return r._exact_skip_reason === 'AMBIGUOUS_INTRA_SOURCE';
}).length;

console.log('\n[EXACT-MATCH DEMO] Results:');
console.log('  EXACT match groups:   ' + exactCount);
console.log('  Pending records:      ' + pendingCount +
  ' (' + pendingGroupCount + ' distinct keys, ' + ambiguousCount + ' flagged ambiguous)');
console.log('  Pending by source:    bank=' + pendingBySrc.bank +
  '  ledger=' + pendingBySrc.ledger + '  gateway=' + pendingBySrc.gateway);

// ----------------------------------------------------
if (result.exact_matches.length > 0) {
  console.log('\n[EXACT-MATCH DEMO] Sample EXACT match (first group):');
  var sample = result.exact_matches[0];
  console.log('  group_key: ' + sample.group_key);
  sample.records.forEach(function(r) {
    console.log('    ' + r.source + '  ref=' + r.source_ref_id +
      '  amount_paisa=' + r.amount_paisa + '  date=' + r.date_iso);
  });
  console.log('  audit:');
  console.log('    rule=' + sample.audit_entry.rule +
    '  decided_at=' + sample.audit_entry.decided_at);
  sample.audit_entry.involved_sources.forEach(function(s) {
    console.log('    -> ' + s.source + ' / ' + s.source_ref_id);
  });
}

// ----------------------------------------------------
if (result.pending.length > 0) {
  console.log('\n[EXACT-MATCH DEMO] Sample PENDING record (first):');
  var p = result.pending[0];
  console.log('  source=' + p.source + '  ref=' + p.source_ref_id +
    '  amount_paisa=' + p.amount_paisa + '  date=' + p.date_iso);
  if (p._exact_skip_reason) {
    console.log('  flagged: ' + p._exact_skip_reason + '  key=' + p._exact_skip_key);
  }
}

console.log('\n[EXACT-MATCH DEMO] Done. Pending records pass to Phase 4 (fuzzy matching).');
