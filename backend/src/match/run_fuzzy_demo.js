'use strict';
const path = require('node:path');
const { runPipeline } = require('../index');

const DATA_DIR = path.resolve(__dirname, '../../data');
const pipeline = runPipeline({
  bankPath:    path.join(DATA_DIR, 'bank_statement.csv'),
  ledgerPath:  path.join(DATA_DIR, 'internal_ledger.csv'),
  gatewayPath: path.join(DATA_DIR, 'gateway_export.csv')
});

const exactResult = pipeline.exactResult;
const fuzzyResult = pipeline.fuzzyResult;

console.log('\n[FUZZY-MATCH DEMO] Exact Match output (after group extensions):');
console.log('  EXACT match groups:   ' + fuzzyResult.updated_exact_matches.length);
console.log('  Initial pending records: ' + exactResult.pending.length);

let fuzzyAmount = 0, fuzzyDate = 0, fuzzyBoth = 0;
fuzzyResult.fuzzy_matches.forEach(m => {
  if (m.reason === 'FUZZY_AMOUNT') fuzzyAmount++;
  else if (m.reason === 'FUZZY_DATE') fuzzyDate++;
  else if (m.reason === 'FUZZY_BOTH') fuzzyBoth++;
});

console.log('\n[FUZZY-MATCH DEMO] Fuzzy Match Results:');
console.log('  FUZZY_AMOUNT groups:  ' + fuzzyAmount);
console.log('  FUZZY_DATE groups:    ' + fuzzyDate);
console.log('  FUZZY_BOTH groups:    ' + fuzzyBoth);
console.log('  Total fuzzy matches:  ' + fuzzyResult.fuzzy_matches.length);
console.log('  Ambiguous records:    ' + fuzzyResult.ambiguous.length);
console.log('  Still pending:        ' + fuzzyResult.still_pending.length);

if (fuzzyResult.fuzzy_matches.length > 0) {
  console.log('\nSample Fuzzy Match:');
  console.log(JSON.stringify(fuzzyResult.fuzzy_matches[0], null, 2));
}

if (fuzzyResult.ambiguous.length > 0) {
  console.log('\nSample Ambiguous Record:');
  console.log(JSON.stringify(fuzzyResult.ambiguous[0], null, 2));
}

if (fuzzyResult.still_pending.length > 0) {
  console.log('\nSample Still Pending Record:');
  console.log(JSON.stringify(fuzzyResult.still_pending[0], null, 2));
}
