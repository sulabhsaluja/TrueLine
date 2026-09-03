'use strict';
const path = require('node:path');
const { runPipeline } = require('../index');

const DATA_DIR = path.resolve(__dirname, '../../data');

const result = runPipeline({
  bankPath:    path.join(DATA_DIR, 'bank_statement.csv'),
  ledgerPath:  path.join(DATA_DIR, 'internal_ledger.csv'),
  gatewayPath: path.join(DATA_DIR, 'gateway_export.csv'),
  groundTruthPath: path.join(DATA_DIR, 'ground_truth.json')
});

const { classified, allRecords, validationResult } = result;

const counts = { MATCHED: 0, MISSING_COUNTERPART: 0, AMOUNT_MISMATCH: 0, DATE_MISMATCH: 0, DUPLICATE_CANDIDATE: 0, UNRESOLVED: 0 };
classified.forEach(c => {
  if (counts[c.category] !== undefined) counts[c.category]++;
});

console.log('\n[CLASSIFICATION TOTALS]');
console.log(`Total Input Records: ${allRecords.length}`);
console.log(`Total Classified:    ${classified.length}`);
for (const [k, v] of Object.entries(counts)) {
  console.log(`  ${k.padEnd(20)}: ${v}`);
}

if (classified.length !== allRecords.length) {
  console.error('ERROR: Total classified records does not match input length!');
}

console.log(validationResult.report);
