'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('fs');
const os = require('os');
const { compareWithGroundTruth } = require('../../src/validate/ground_truth_check');

test('compareWithGroundTruth correctly builds confusion breakdown', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-test-'));
  const gtPath = path.join(tmpDir, 'ground_truth.json');
  
  const gtData = [
    { txn_id: 'T1', category: 'CLEAN_MATCH', bank_row_id: 'B1', ledger_row_id: 'L1', gateway_row_id: 'G1' },
    { txn_id: 'T2', category: 'AMOUNT_MISMATCH', bank_row_id: 'B2', ledger_row_id: 'L2', gateway_row_id: 'G2' }
  ];
  fs.writeFileSync(gtPath, JSON.stringify(gtData));

  // Pipeline output
  const classifications = [
    { record: { source: 'bank', source_ref_id: 'B1' }, category: 'MATCHED' },
    { record: { source: 'ledger', source_ref_id: 'L1' }, category: 'MATCHED' },
    { record: { source: 'gateway', source_ref_id: 'G1' }, category: 'MATCHED' },
    // Simulate pipeline getting T2 wrong (UNRESOLVED instead of AMOUNT_MISMATCH)
    { record: { source: 'bank', source_ref_id: 'B2' }, category: 'UNRESOLVED' },
    { record: { source: 'ledger', source_ref_id: 'L2' }, category: 'UNRESOLVED' },
    { record: { source: 'gateway', source_ref_id: 'G2' }, category: 'UNRESOLVED' }
  ];

  const result = compareWithGroundTruth(classifications, gtPath);
  const report = result.report;
  
  // T1 should be correct, T2 incorrect
  assert.match(report, /Overall Match Rate: 50.00%/);
  
  // Check confusion matrix output strings
  // CLEAN_MATCH -> MATCHED should be 1
  assert.match(report, /CLEAN_MATCH.*\|\s+1\s+\|\s+0/);
  // AMOUNT_MISMATCH -> UNRESOLVED should be 1
  assert.match(report, /AMOUNT_MISMATCH.*\|\s+0\s+\|\s+0\s+\|\s+0\s+\|\s+0\s+\|\s+0\s+\|\s+1\s+\|/);

  fs.rmSync(tmpDir, { recursive: true });
});
