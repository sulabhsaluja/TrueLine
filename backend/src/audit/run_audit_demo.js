'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { runPipeline } = require('../index');
const { exportAuditTrailJSON, exportAuditTrailCSV } = require('./audit_trail');

const DATA_DIR = path.resolve(__dirname, '../../data');
const OUT_DIR = path.resolve(__dirname, '../../output');

const result = runPipeline({
  bankPath:    path.join(DATA_DIR, 'bank_statement.csv'),
  ledgerPath:  path.join(DATA_DIR, 'internal_ledger.csv'),
  gatewayPath: path.join(DATA_DIR, 'gateway_export.csv')
});

const { auditTrail, classified, allRecords } = result;

if (auditTrail.length !== classified.length) {
  throw new Error(`Audit trail length (${auditTrail.length}) does not match classified records length (${classified.length})`);
}

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}
const jsonPath = path.join(OUT_DIR, 'audit_trail.json');
const csvPath = path.join(OUT_DIR, 'audit_trail.csv');

exportAuditTrailJSON(auditTrail, jsonPath);
exportAuditTrailCSV(auditTrail, csvPath);

const coverage = (auditTrail.length / allRecords.length) * 100;
const counts = {};
auditTrail.forEach(a => {
  counts[a.reason_code] = (counts[a.reason_code] || 0) + 1;
});

console.log('\n[AUDIT TRAIL DEMO]');
console.log(`Total Records Ingested: ${allRecords.length}`);
console.log(`Total Audit Entries:    ${auditTrail.length}`);
console.log(`Coverage:               ${coverage.toFixed(2)}%`);
console.log('\nCategory Breakdown:');
for (const [k, v] of Object.entries(counts)) {
  console.log(`  ${k.padEnd(20)}: ${v}`);
}
console.log('\nOutputs written to:');
console.log(`  ${jsonPath}`);
console.log(`  ${csvPath}`);
