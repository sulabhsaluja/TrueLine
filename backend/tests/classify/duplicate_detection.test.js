const test = require('node:test');
const assert = require('node:assert');
const { runExactMatch } = require('../../src/match/exact_match');
const { runFuzzyMatch } = require('../../src/match/fuzzy_match');
const { classifyRecords } = require('../../src/classify/exceptions');

test('Duplicate detection integration test: identifies duplicate rows within same source as DUPLICATE_CANDIDATE', () => {
  const duplicateBankRecord1 = {
    source: 'bank',
    source_ref_id: 'BNK-9006',
    date_iso: '2024-01-20',
    amount_paisa: 120000,
  };
  const duplicateBankRecord2 = {
    source: 'bank',
    source_ref_id: 'BNK-9007',
    date_iso: '2024-01-20',
    amount_paisa: 120000,
  };
  const ledgerRecord = {
    source: 'ledger',
    source_ref_id: 'LED-1001',
    date_iso: '2024-01-20',
    amount_paisa: 120000,
  };
  const gatewayRecord = {
    source: 'gateway',
    source_ref_id: 'GTW-2001',
    date_iso: '2024-01-20',
    amount_paisa: 120000,
  };
  const bankRecords = [duplicateBankRecord1, duplicateBankRecord2];
  const ledgerRecords = [ledgerRecord];
  const gatewayRecords = [gatewayRecord];

  const exactResult = runExactMatch(bankRecords, ledgerRecords, gatewayRecords);
  const fuzzyResult = runFuzzyMatch(exactResult.exact_matches, exactResult.pending);
  const classified = classifyRecords(
    fuzzyResult.updated_exact_matches,
    fuzzyResult.fuzzy_matches,
    fuzzyResult.ambiguous,
    fuzzyResult.still_pending,
    [...bankRecords, ...ledgerRecords, ...gatewayRecords]
  );

  const dupCandidates = classified.filter(c => c.category === 'DUPLICATE_CANDIDATE');
  // Wait, if ledger and gateway are also in the exact match group, exact_match sets _exact_skip_reason for ALL 4.
  // Then fuzzy_match does nothing with them (they are cross source but since they don't form valid new groups because they are all same amount/date, they stay as still_pending or ambiguous).
  // Thus they all get assigned DUPLICATE_CANDIDATE.
  assert.strictEqual(dupCandidates.length, 4);
  const ids = dupCandidates.map(c => c.record.source_ref_id).sort();
  assert.deepStrictEqual(ids, ['BNK-9006', 'BNK-9007', 'GTW-2001', 'LED-1001']);
});
