'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { runPipeline } = require('../src/index');

const DATA_DIR = path.resolve(__dirname, '../data');

test('runPipeline end-to-end against real dataset', () => {
  const result = runPipeline({
    bankPath:    path.join(DATA_DIR, 'bank_statement.csv'),
    ledgerPath:  path.join(DATA_DIR, 'internal_ledger.csv'),
    gatewayPath: path.join(DATA_DIR, 'gateway_export.csv'),
    groundTruthPath: path.join(DATA_DIR, 'ground_truth.json')
  });

  // Verify full end-to-end execution
  assert.strictEqual(result.ingest.summary.total_ok, 177);
  assert.strictEqual(result.allRecords.length, 177);
  assert.strictEqual(result.classified.length, 177);
  assert.strictEqual(result.auditTrail.length, 177);
  
  // Verify final report summary
  assert.strictEqual(result.summary.match_rate.matched, 150);
  assert.strictEqual(result.summary.match_rate.percentage, 84.75);
  
  // Verify ground truth passed properly
  assert.strictEqual(result.summary.known_divergences.ground_truth_match_rate_percentage, 88.33);
});
