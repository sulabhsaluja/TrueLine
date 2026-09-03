'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { runFuzzyMatch, determineFuzzyReason } = require('../../src/match/fuzzy_match');

function makeRecord(source, ref_id, amount_paisa, date_iso) {
  return { source, source_ref_id: ref_id, amount_paisa, date_iso, counterparty_or_narration: 'test', raw_row: {} };
}

function makeExactGroup(groupKey, records) {
  return {
    group_key: groupKey,
    reason: 'EXACT',
    records: records,
    audit_entry: { rule: 'EXACT' }
  };
}

// ---------------------------------------------------------------------------
// Existing Pairwise / Free Clustering Tests
// ---------------------------------------------------------------------------

test('Free pair: FUZZY_AMOUNT fires correctly (same date, amount off by 45)', () => {
  const b = makeRecord('bank', 'B1', 100000, '2026-07-01');
  const l = makeRecord('ledger', 'L1', 100045, '2026-07-01');
  const res = runFuzzyMatch([], [b, l]);
  assert.strictEqual(res.fuzzy_matches.length, 1);
  assert.strictEqual(res.fuzzy_matches[0].reason, 'FUZZY_AMOUNT');
  assert.strictEqual(res.fuzzy_matches[0].records.length, 2);
  assert.strictEqual(res.ambiguous.length, 0);
  assert.strictEqual(res.still_pending.length, 0);
});

test('Free pair: FUZZY_AMOUNT does NOT fire beyond tolerance (amount off by 150)', () => {
  const b = makeRecord('bank', 'B1', 100000, '2026-07-01');
  const l = makeRecord('ledger', 'L1', 100150, '2026-07-01');
  const res = runFuzzyMatch([], [b, l]);
  assert.strictEqual(res.fuzzy_matches.length, 0);
  assert.strictEqual(res.still_pending.length, 2);
});

test('Free pair: FUZZY_DATE fires correctly (same amount, date off by 2 days)', () => {
  const b = makeRecord('bank', 'B1', 100000, '2026-07-01');
  const l = makeRecord('ledger', 'L1', 100000, '2026-07-03');
  const res = runFuzzyMatch([], [b, l]);
  assert.strictEqual(res.fuzzy_matches.length, 1);
  assert.strictEqual(res.fuzzy_matches[0].reason, 'FUZZY_DATE');
});

test('Free pair: FUZZY_DATE does NOT fire beyond tolerance (date off by 3 days)', () => {
  const b = makeRecord('bank', 'B1', 100000, '2026-07-01');
  const l = makeRecord('ledger', 'L1', 100000, '2026-07-04');
  const res = runFuzzyMatch([], [b, l]);
  assert.strictEqual(res.fuzzy_matches.length, 0);
  assert.strictEqual(res.still_pending.length, 2);
});

test('Free pair: FUZZY_BOTH fires correctly (amount off by 30, date off by 1)', () => {
  const b = makeRecord('bank', 'B1', 100000, '2026-07-01');
  const l = makeRecord('ledger', 'L1', 100030, '2026-07-02');
  const res = runFuzzyMatch([], [b, l]);
  assert.strictEqual(res.fuzzy_matches.length, 1);
  assert.strictEqual(res.fuzzy_matches[0].reason, 'FUZZY_BOTH');
});

test('Free pair: Ambiguous intra-source (two same-source pending plausibly match one other-source)', () => {
  const b1 = makeRecord('bank', 'B1', 100000, '2026-07-01');
  const b2 = makeRecord('bank', 'B2', 100050, '2026-07-01');
  const l = makeRecord('ledger', 'L1', 100020, '2026-07-01');
  const res = runFuzzyMatch([], [b1, b2, l]);
  assert.strictEqual(res.fuzzy_matches.length, 0);
  assert.strictEqual(res.ambiguous.length, 3);
  assert.strictEqual(res.ambiguous[0]._fuzzy_skip_reason, 'AMBIGUOUS_INTRA_SOURCE');
});

test('Still pending: A record with genuinely no candidate lands in still_pending', () => {
  const b = makeRecord('bank', 'B1', 100000, '2026-07-01');
  const res = runFuzzyMatch([], [b]);
  assert.strictEqual(res.still_pending.length, 1);
});

test('Bug check: EXACT match reached fuzzy logic throws error', () => {
  const b = makeRecord('bank', 'B1', 100000, '2026-07-01');
  const l = makeRecord('ledger', 'L1', 100000, '2026-07-01');
  assert.throws(() => runFuzzyMatch([], [b, l]), /Bug: EXACT match reached fuzzy logic/);
});

test('Free pair: Loose chain is marked as AMBIGUOUS_CHAIN', () => {
  const b = makeRecord('bank', 'B1', 100000, '2026-07-01');
  const l = makeRecord('ledger', 'L1', 100080, '2026-07-01');
  const g = makeRecord('gateway', 'G1', 100150, '2026-07-01');
  const res = runFuzzyMatch([], [b, l, g]);
  assert.strictEqual(res.fuzzy_matches.length, 0);
  assert.strictEqual(res.ambiguous.length, 3);
  assert.strictEqual(res.ambiguous[0]._fuzzy_skip_reason, 'AMBIGUOUS_CHAIN');
});

// ---------------------------------------------------------------------------
// Group Extension Tests (New from Phase 4.1 plan)
// ---------------------------------------------------------------------------

test('Group Ext: Clean extension of a 2-source EXACT group', () => {
  const b = makeRecord('bank', 'B1', 200000, '2026-08-01');
  const l = makeRecord('ledger', 'L1', 200000, '2026-08-01');
  const exactGrp = makeExactGroup('key', [b, l]); // missing gateway
  
  // Pending gateway that matches
  const g = makeRecord('gateway', 'G1', 200050, '2026-08-01'); // amt off by 50
  
  const res = runFuzzyMatch([exactGrp], [g]);
  assert.strictEqual(res.updated_exact_matches.length, 0, 'Group should be extended and moved out of exact');
  assert.strictEqual(res.fuzzy_matches.length, 1, 'Extended group goes to fuzzy matches');
  assert.strictEqual(res.fuzzy_matches[0].records.length, 3);
  assert.strictEqual(res.fuzzy_matches[0].reason, 'FUZZY_AMOUNT');
  assert.strictEqual(res.ambiguous.length, 0);
  assert.strictEqual(res.still_pending.length, 0);
});

test('Group Ext: Ambiguous group extension (2 candidates for same group)', () => {
  const b = makeRecord('bank', 'B1', 200000, '2026-08-01');
  const l = makeRecord('ledger', 'L1', 200000, '2026-08-01');
  const exactGrp = makeExactGroup('key', [b, l]); // missing gateway
  
  const g1 = makeRecord('gateway', 'G1', 200050, '2026-08-01');
  const g2 = makeRecord('gateway', 'G2', 200075, '2026-08-01');
  
  const res = runFuzzyMatch([exactGrp], [g1, g2]);
  assert.strictEqual(res.updated_exact_matches.length, 0);
  assert.strictEqual(res.fuzzy_matches.length, 0);
  assert.strictEqual(res.ambiguous.length, 4, '2 group records + 2 pending records');
  
  // Check reasons
  const grpRecs = res.ambiguous.filter(r => r.source !== 'gateway');
  const pendRecs = res.ambiguous.filter(r => r.source === 'gateway');
  assert.strictEqual(grpRecs[0]._fuzzy_skip_reason, 'AMBIGUOUS_GROUP_EXTENSION');
  assert.strictEqual(pendRecs[0]._fuzzy_skip_reason, 'AMBIGUOUS_GROUP_EXTENSION');
});

test('Group Ext: Symmetric group conflict (1 Pending matches 2 Groups)', () => {
  // Group 1 missing gateway
  const b1 = makeRecord('bank', 'B1', 200000, '2026-08-01');
  const l1 = makeRecord('ledger', 'L1', 200000, '2026-08-01');
  const grp1 = makeExactGroup('k1', [b1, l1]);
  
  // Group 2 missing gateway
  const b2 = makeRecord('bank', 'B2', 200005, '2026-08-01');
  const l2 = makeRecord('ledger', 'L2', 200005, '2026-08-01');
  const grp2 = makeExactGroup('k2', [b2, l2]);
  
  const g = makeRecord('gateway', 'G1', 200002, '2026-08-01'); // touches both groups

  const res = runFuzzyMatch([grp1, grp2], [g]);
  assert.strictEqual(res.updated_exact_matches.length, 0);
  assert.strictEqual(res.ambiguous.length, 5, '4 group records + 1 pending record');
  assert.strictEqual(res.ambiguous[0]._fuzzy_skip_reason, 'SYMMETRIC_GROUP_CONFLICT');
});

test('Group Ext: Cross-match conflict (TXN-0043 shape - Pending touches Group AND other Pending)', () => {
  const b = makeRecord('bank', 'B1', 300000, '2026-09-01');
  const l = makeRecord('ledger', 'L1', 300000, '2026-09-01');
  const exactGrp = makeExactGroup('key', [b, l]); // true exact match
  
  // Pending decoy ledger that extends the group
  const l_decoy = makeRecord('ledger', 'L_decoy', 300050, '2026-09-01'); 
  // Pending gateway that doesn't match the group, but matches the decoy ledger!
  const g_true = makeRecord('gateway', 'G_true', 300100, '2026-09-01');
  
  // l_decoy touches group (diff 50) AND touches g_true (diff 50)
  // Therefore, this is a cross-match conflict.
  
  const res = runFuzzyMatch([exactGrp], [l_decoy, g_true]);
  
  assert.strictEqual(res.updated_exact_matches.length, 0, 'Group should be marked ambiguous');
  assert.strictEqual(res.fuzzy_matches.length, 0, 'No fuzzy matches should form');
  assert.strictEqual(res.ambiguous.length, 4, '2 group + 2 pending');
  assert.strictEqual(res.ambiguous[0]._fuzzy_skip_reason, 'CROSS_MATCH_CONFLICT');
});
