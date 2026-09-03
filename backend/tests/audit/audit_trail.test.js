'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { buildAuditTrail, auditTrailToCSV, exportAuditTrailJSON, exportAuditTrailCSV } = require('../../src/audit/audit_trail');

function makeClassified(category, source, ref, detail, audit_entry = null) {
  return {
    record: { source, source_ref_id: ref },
    category,
    detail,
    audit_entry
  };
}

test('buildAuditTrail: One entry per classified record, handles MATCHED + exceptions (no drops)', () => {
  const records = [
    makeClassified('MATCHED', 'bank', 'B1', 'Exact match', {
      rule: 'EXACT',
      group_key: 'key1',
      involved_sources: [{ source: 'bank', source_ref_id: 'B1' }, { source: 'ledger', source_ref_id: 'L1' }],
      decided_at: '2026-01-01',
      reason_code: 'EXACT'
    }),
    makeClassified('AMOUNT_MISMATCH', 'bank', 'B2', 'Amt diff 50', null),
    makeClassified('DATE_MISMATCH', 'ledger', 'L2', 'Date diff 3', null),
    makeClassified('UNRESOLVED', 'gateway', 'G1', 'No partner', null),
    makeClassified('DUPLICATE_CANDIDATE', 'bank', 'B3', 'Cross match', null)
  ];
  
  const trail = buildAuditTrail(records);
  assert.strictEqual(trail.length, 5);
});

test('buildAuditTrail: existing audit_entry is preserved, not overwritten by fallback', () => {
  const records = [
    makeClassified('MATCHED', 'bank', 'B1', 'Some detail', {
      rule: 'EXACT',
      group_key: 'my_key',
      involved_sources: [{ source: 'bank', source_ref_id: 'B1' }],
      decided_at: '2026-02-02',
      reason_code: 'EXACT'
    })
  ];
  const trail = buildAuditTrail(records);
  assert.strictEqual(trail.length, 1);
  assert.strictEqual(trail[0].rule, 'EXACT');
  assert.strictEqual(trail[0].group_key, 'my_key');
  assert.strictEqual(trail[0].detail, 'Some detail'); // Fallback to item detail since no tolerance_detail
});

test('buildAuditTrail: tolerance_detail from a fuzzy match entry gets folded into detail', () => {
  const records = [
    makeClassified('MATCHED', 'bank', 'B1', 'Some detail', {
      rule: 'FUZZY_DATE',
      group_key: 'my_fuzzy',
      involved_sources: [{ source: 'bank', source_ref_id: 'B1' }],
      decided_at: '2026-03-03',
      reason_code: 'FUZZY_DATE',
      tolerance_detail: 'Tolerance is 2 days'
    })
  ];
  const trail = buildAuditTrail(records);
  assert.strictEqual(trail[0].detail, 'Tolerance is 2 days');
  assert.strictEqual(trail[0].tolerance_detail, undefined);
});

test('buildAuditTrail: fallback DOES fire for null audit_entry, populates fields', () => {
  const records = [
    makeClassified('AMOUNT_MISMATCH', 'ledger', 'L9', 'Amt off by 10')
  ];
  const trail = buildAuditTrail(records);
  assert.strictEqual(trail.length, 1);
  const entry = trail[0];
  assert.strictEqual(entry.rule, 'AMOUNT_MISMATCH');
  assert.strictEqual(entry.reason_code, 'AMOUNT_MISMATCH');
  assert.strictEqual(entry.detail, 'Amt off by 10');
  assert.notStrictEqual(entry.decided_at, undefined);
  assert.strictEqual(entry.group_key, null);
  assert.deepStrictEqual(entry.involved_sources, [{ source: 'ledger', source_ref_id: 'L9' }]);
});

test('auditTrailToCSV: field containing comma/newline gets quoted, plain field does not', () => {
  const trail = [{
    rule: 'AMOUNT_MISMATCH',
    group_key: 'k1',
    involved_sources: [{ source: 'bank', source_ref_id: 'B1' }],
    decided_at: 'time1',
    reason_code: 'AMOUNT_MISMATCH',
    detail: 'Diff is 5, need check' // Has comma
  }];
  const csv = auditTrailToCSV(trail);
  const lines = csv.split('\n');
  assert.strictEqual(lines.length, 2);
  assert.match(lines[1], /"Diff is 5, need check"/);
  assert.match(lines[1], /AMOUNT_MISMATCH/); // Plain field not quoted
  assert.match(lines[1], /bank:B1/);
});

test('exportAuditTrail: JSON + CSV round-trip', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
  const jsonPath = path.join(tmpDir, 'audit.json');
  const csvPath = path.join(tmpDir, 'audit.csv');
  
  const trail = [{
    rule: 'UNRESOLVED',
    group_key: null,
    involved_sources: [{ source: 'gateway', source_ref_id: 'G99' }],
    decided_at: '2026-01-01',
    reason_code: 'UNRESOLVED',
    detail: 'Nothing'
  }];
  
  exportAuditTrailJSON(trail, jsonPath);
  exportAuditTrailCSV(trail, csvPath);
  
  const readJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  assert.strictEqual(readJson.length, 1);
  assert.strictEqual(readJson[0].rule, 'UNRESOLVED');
  
  const readCsv = fs.readFileSync(csvPath, 'utf8').split('\n');
  assert.strictEqual(readCsv.length, 2);
  assert.match(readCsv[1], /gateway:G99/);
  
  fs.rmSync(tmpDir, { recursive: true });
});
