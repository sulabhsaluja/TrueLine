'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { generateSummary } = require('../../src/report/summary');

test('generateSummary: produces correct JSON shape and percentages', () => {
  const classified = [
    { record: { source: 'bank' }, category: 'MATCHED' },
    { record: { source: 'ledger' }, category: 'MATCHED' },
    { record: { source: 'gateway' }, category: 'AMOUNT_MISMATCH' },
    { record: { source: 'bank' }, category: 'MISSING_COUNTERPART' }
  ];

  const validationObject = {
    matchRate: 75.00,
    matrix: {
      'CLEAN_MATCH': { MATCHED: 2, AMOUNT_MISMATCH: 0, DATE_MISMATCH: 0, MISSING_COUNTERPART: 0, DUPLICATE_CANDIDATE: 0, UNRESOLVED: 0 },
      'AMOUNT_MISMATCH': { MATCHED: 0, AMOUNT_MISMATCH: 1, DATE_MISMATCH: 0, MISSING_COUNTERPART: 0, DUPLICATE_CANDIDATE: 0, UNRESOLVED: 0 },
      'MISSING_COUNTERPART': { MATCHED: 0, AMOUNT_MISMATCH: 0, DATE_MISMATCH: 0, MISSING_COUNTERPART: 1, DUPLICATE_CANDIDATE: 0, UNRESOLVED: 0 }
    }
  };

  const startTime = Date.now() - 50; // Simulate 50ms processing
  const summary = generateSummary(classified, validationObject, 4, startTime);

  assert.ok(summary.processing_time_ms >= 50);
  assert.strictEqual(summary.match_rate.matched, 2);
  assert.strictEqual(summary.match_rate.total_classified, 4);
  assert.strictEqual(summary.match_rate.percentage, 50); // 2/4 is 50%

  assert.strictEqual(summary.categories.MATCHED.count, 2);
  assert.strictEqual(summary.categories.MATCHED.percentage, 50);
  assert.strictEqual(summary.categories.AMOUNT_MISMATCH.count, 1);
  assert.strictEqual(summary.categories.AMOUNT_MISMATCH.percentage, 25);
  assert.strictEqual(summary.categories.MISSING_COUNTERPART.count, 1);
  assert.strictEqual(summary.categories.MISSING_COUNTERPART.percentage, 25);
  
  assert.strictEqual(summary.source_volume.bank, 2);
  assert.strictEqual(summary.source_volume.ledger, 1);
  assert.strictEqual(summary.source_volume.gateway, 1);
  assert.strictEqual(summary.source_volume.total_ingested, 4);

  assert.strictEqual(summary.known_divergences.ground_truth_match_rate_percentage, 75);
  assert.deepStrictEqual(summary.known_divergences.confusion_matrix.CLEAN_MATCH, {
    MATCHED: 2, AMOUNT_MISMATCH: 0, DATE_MISMATCH: 0, MISSING_COUNTERPART: 0, DUPLICATE_CANDIDATE: 0, UNRESOLVED: 0
  });
  assert.deepStrictEqual(summary.known_divergences.confusion_matrix.AMOUNT_MISMATCH, {
    MATCHED: 0, AMOUNT_MISMATCH: 1, DATE_MISMATCH: 0, MISSING_COUNTERPART: 0, DUPLICATE_CANDIDATE: 0, UNRESOLVED: 0
  });
});

test('generateSummary: 0% match rate calculates correctly', () => {
  const classified = [
    { record: { source: 'bank' }, category: 'UNRESOLVED' },
    { record: { source: 'ledger' }, category: 'DATE_MISMATCH' }
  ];

  const summary = generateSummary(classified, null, 2, Date.now());
  
  assert.strictEqual(summary.match_rate.matched, 0);
  assert.strictEqual(summary.match_rate.percentage, 0);
  assert.strictEqual(summary.categories.MATCHED.count, 0);
  assert.strictEqual(summary.categories.MATCHED.percentage, 0);
  assert.strictEqual(summary.categories.UNRESOLVED.count, 1);
  assert.strictEqual(summary.categories.UNRESOLVED.percentage, 50);
});

test('generateSummary: empty array handles 0 divisions', () => {
  const classified = [];
  const summary = generateSummary(classified, null, 0, Date.now());
  
  assert.strictEqual(summary.match_rate.matched, 0);
  assert.strictEqual(summary.match_rate.total_classified, 0);
  assert.strictEqual(summary.match_rate.percentage, 0); // No NaN
  assert.strictEqual(summary.categories.MATCHED.count, 0);
  assert.strictEqual(summary.categories.MATCHED.percentage, 0); // No NaN
});

test('generateSummary: throws on sum mismatch (drops)', () => {
  const classified = [
    { record: { source: 'bank' }, category: 'MATCHED' }
  ];
  // Passing totalIngested=2 when only 1 record classified means 1 record dropped somewhere
  assert.throws(() => {
    generateSummary(classified, null, 2, Date.now());
  }, /Integrity error: sum of categories \(1\) does not match total ingested records \(2\)/);
});
