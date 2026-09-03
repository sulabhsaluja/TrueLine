'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { runPipeline } = require('../index');

const DATA_DIR = path.resolve(__dirname, '../../data');
const OUT_DIR = path.resolve(__dirname, '../../output');

const result = runPipeline({
  bankPath:    path.join(DATA_DIR, 'bank_statement.csv'),
  ledgerPath:  path.join(DATA_DIR, 'internal_ledger.csv'),
  gatewayPath: path.join(DATA_DIR, 'gateway_export.csv'),
  groundTruthPath: path.join(DATA_DIR, 'ground_truth.json')
});

const summary = result.summary;

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const summaryPath = path.join(OUT_DIR, 'summary.json');
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

console.log(`[REPORT DEMO] Generated summary JSON (Processing Time: ${summary.processing_time_ms}ms)`);
console.log(`Match Rate: ${summary.match_rate.percentage}%`);
console.log(`Total Classified: ${summary.match_rate.total_classified}`);
console.log(`Output written to: ${summaryPath}`);
