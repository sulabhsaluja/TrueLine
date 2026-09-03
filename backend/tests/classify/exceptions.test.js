'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { classifyRecords } = require('../../src/classify/exceptions');

test('classifyRecords: 3-source group is MATCHED', () => {
  const group = {
    records: [
      { source: 'bank', amount_paisa: 100, date_iso: '2026-01-01' },
      { source: 'ledger', amount_paisa: 100, date_iso: '2026-01-01' },
      { source: 'gateway', amount_paisa: 100, date_iso: '2026-01-01' }
    ]
  };
  const classified = classifyRecords([group], [], [], [], group.records);
  assert.strictEqual(classified.length, 3);
  classified.forEach(c => assert.strictEqual(c.category, 'MATCHED'));
});

test('classifyRecords: 2-source group missing 3rd, no candidate -> MATCHED', () => {
  const group = {
    records: [
      { source: 'bank', amount_paisa: 100, date_iso: '2026-01-01' },
      { source: 'ledger', amount_paisa: 100, date_iso: '2026-01-01' }
    ]
  };
  const classified = classifyRecords([group], [], [], [], group.records);
  assert.strictEqual(classified.length, 2);
  classified.forEach(c => {
    assert.strictEqual(c.category, 'MATCHED');
  });
});

test('classifyRecords: 2-source group missing 3rd, candidate exists -> MATCHED', () => {
  const group = {
    records: [
      { source: 'bank', amount_paisa: 100, date_iso: '2026-01-01' },
      { source: 'ledger', amount_paisa: 100, date_iso: '2026-01-01' }
    ]
  };
  const candidate = { source: 'gateway', amount_paisa: 150, date_iso: '2026-01-01' }; // Amount mismatch
  const allRecords = [...group.records, candidate];
  
  const classified = classifyRecords([group], [], [], [candidate], allRecords);
  
  // Group records should be MATCHED
  const groupClass = classified.filter(c => c.record.source !== 'gateway');
  assert.strictEqual(groupClass.length, 2);
  groupClass.forEach(c => assert.strictEqual(c.category, 'MATCHED'));
  
  // Candidate should be AMOUNT_MISMATCH
  const candClass = classified.find(c => c.record.source === 'gateway');
  assert.strictEqual(candClass.category, 'AMOUNT_MISMATCH');
});

test('classifyRecords: still_pending AMOUNT_MISMATCH', () => {
  const pending = [{ source: 'bank', amount_paisa: 100, date_iso: '2026-01-01' }];
  const all = [...pending, { source: 'ledger', amount_paisa: 150, date_iso: '2026-01-01' }];
  const classified = classifyRecords([], [], [], pending, all);
  assert.strictEqual(classified.length, 1);
  assert.strictEqual(classified[0].category, 'AMOUNT_MISMATCH');
});

test('classifyRecords: still_pending DATE_MISMATCH', () => {
  const pending = [{ source: 'bank', amount_paisa: 100, date_iso: '2026-01-01' }];
  const all = [...pending, { source: 'ledger', amount_paisa: 100, date_iso: '2026-01-03' }];
  const classified = classifyRecords([], [], [], pending, all);
  assert.strictEqual(classified.length, 1);
  assert.strictEqual(classified[0].category, 'DATE_MISMATCH');
});

test('classifyRecords: still_pending UNRESOLVED', () => {
  const group = {
    records: [{ source: 'bank', amount_paisa: 100, date_iso: '2026-01-01' }],
    reason: null, audit_entry: null
  };
  const classified = classifyRecords([], [], [], group.records, group.records);
  assert.strictEqual(classified.length, 1);
  assert.strictEqual(classified[0].category, 'UNRESOLVED');
});

test('classifyRecords: ambiguous DUPLICATE_CANDIDATE', () => {
  const ambiguous = [{ source: 'bank', _fuzzy_skip_reason: 'CROSS_MATCH_CONFLICT' }];
  const classified = classifyRecords([], [], ambiguous, [], ambiguous);
  assert.strictEqual(classified.length, 1);
  assert.strictEqual(classified[0].category, 'DUPLICATE_CANDIDATE');
  assert.match(classified[0].detail, /CROSS_MATCH_CONFLICT/);
});
