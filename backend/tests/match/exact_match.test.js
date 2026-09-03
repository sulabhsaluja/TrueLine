/**
 * tests/match/exact_match.test.js
 *
 * Unit tests for src/match/exact_match.js (Phase 3).
 * Uses Node built-in test runner (node:test + node:assert).
 *
 * Run:  node --test tests/match/exact_match.test.js
 *
 * All test records are constructed inline - no file I/O.
 * Covers:
 *   - 3-source group -> EXACT
 *   - 2-source group (ledger genuinely absent) -> EXACT
 *   - Near-miss: date off by 1 day -> remains pending
 *   - Near-miss: amount off by 1 paisa -> remains pending
 *   - Ambiguous: two bank records with same key -> both remain pending,
 *       flagged AMBIGUOUS_INTRA_SOURCE, neither silently matched
 */

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');

const { runExactMatch, buildExactKey } = require('../../src/match/exact_match');

// ─── Record factory ───────────────────────────────────────────────────────────
function makeRecord(source, ref_id, amount_paisa, date_iso) {
  return {
    source: source,
    source_ref_id: ref_id,
    amount_paisa: amount_paisa,
    date_iso: date_iso,
    counterparty_or_narration: 'test',
    raw_row: {},
  };
}

// ─── buildExactKey ────────────────────────────────────────────────────────────

test('buildExactKey: produces "amount_paisa|date_iso" string', function() {
  var rec = makeRecord('bank', 'UTR1', 45127021, '2026-07-11');
  assert.strictEqual(buildExactKey(rec), '45127021|2026-07-11');
});

// ─── runExactMatch: positive cases ───────────────────────────────────────────

test('runExactMatch: 3-source group resolves as EXACT', function() {
  var bankRec    = makeRecord('bank',    'UTR1',      10000000, '2026-07-15');
  var ledgerRec  = makeRecord('ledger',  'INV-001',   10000000, '2026-07-15');
  var gatewayRec = makeRecord('gateway', 'pay_001',   10000000, '2026-07-15');

  var result = runExactMatch([bankRec], [ledgerRec], [gatewayRec]);

  assert.strictEqual(result.exact_matches.length, 1, 'Expected 1 exact match group');
  assert.strictEqual(result.pending.length, 0, 'Expected 0 pending records');

  var match = result.exact_matches[0];
  assert.strictEqual(match.reason, 'EXACT');
  assert.strictEqual(match.records.length, 3);

  // Audit entry must be present and carry the right reason code
  assert.ok(match.audit_entry, 'audit_entry must be present');
  assert.strictEqual(match.audit_entry.rule, 'EXACT');
  assert.strictEqual(match.audit_entry.reason_code, 'EXACT');
  assert.strictEqual(match.audit_entry.involved_sources.length, 3);
  assert.ok(match.audit_entry.decided_at, 'decided_at timestamp must be present');

  // Audit entry uses source_ref_id, not raw amount/date
  var sources = match.audit_entry.involved_sources.map(function(s) { return s.source; });
  assert.ok(sources.includes('bank'), 'audit must include bank');
  assert.ok(sources.includes('ledger'), 'audit must include ledger');
  assert.ok(sources.includes('gateway'), 'audit must include gateway');
});

test('runExactMatch: 2-source group (no ledger record) resolves as EXACT', function() {
  var bankRec    = makeRecord('bank',    'UTR2',    20000000, '2026-07-20');
  var gatewayRec = makeRecord('gateway', 'pay_002', 20000000, '2026-07-20');

  // ledger array is empty for this transaction
  var result = runExactMatch([bankRec], [], [gatewayRec]);

  assert.strictEqual(result.exact_matches.length, 1, 'Expected 1 exact match group');
  assert.strictEqual(result.pending.length, 0, 'Expected 0 pending records');
  assert.strictEqual(result.exact_matches[0].reason, 'EXACT');
  assert.strictEqual(result.exact_matches[0].records.length, 2);
});

test('runExactMatch: group_key contains correct amount_paisa and date_iso', function() {
  var bankRec    = makeRecord('bank',    'UTR3',   99999999, '2026-08-01');
  var ledgerRec  = makeRecord('ledger',  'INV-X',  99999999, '2026-08-01');

  var result = runExactMatch([bankRec], [ledgerRec], []);
  assert.strictEqual(result.exact_matches[0].group_key, '99999999|2026-08-01');
});

test('runExactMatch: multiple independent EXACT groups returned correctly', function() {
  // Two separate transactions, each with bank + gateway match
  var b1 = makeRecord('bank',    'UTRA', 5000000, '2026-07-01');
  var g1 = makeRecord('gateway', 'pA',   5000000, '2026-07-01');
  var b2 = makeRecord('bank',    'UTRB', 7500000, '2026-07-02');
  var g2 = makeRecord('gateway', 'pB',   7500000, '2026-07-02');

  var result = runExactMatch([b1, b2], [], [g1, g2]);
  assert.strictEqual(result.exact_matches.length, 2);
  assert.strictEqual(result.pending.length, 0);
});

// ─── runExactMatch: near-miss cases (must NOT resolve as EXACT) ───────────────

test('near-miss: date off by 1 day -> both records remain pending', function() {
  // bank sees 2026-07-15, gateway sees 2026-07-16 -> different keys -> no EXACT
  var bankRec    = makeRecord('bank',    'UTR_NM1', 10000000, '2026-07-15');
  var gatewayRec = makeRecord('gateway', 'pay_NM1', 10000000, '2026-07-16');

  var result = runExactMatch([bankRec], [], [gatewayRec]);

  assert.strictEqual(result.exact_matches.length, 0, 'Should NOT produce an EXACT match');
  assert.strictEqual(result.pending.length, 2, 'Both records must be pending for Phase 4');
});

test('near-miss: amount off by 1 paisa -> both records remain pending', function() {
  // bank has 10000000 paisa, ledger has 10000001 paisa -> different keys -> no EXACT
  var bankRec   = makeRecord('bank',   'UTR_NM2', 10000000, '2026-07-15');
  var ledgerRec = makeRecord('ledger', 'INV_NM2', 10000001, '2026-07-15');

  var result = runExactMatch([bankRec], [ledgerRec], []);

  assert.strictEqual(result.exact_matches.length, 0, 'Should NOT produce an EXACT match');
  assert.strictEqual(result.pending.length, 2, 'Both records must be pending for Phase 4');
});

test('near-miss: exact amount but both gateway and bank absent -> lone ledger stays pending', function() {
  var ledgerRec = makeRecord('ledger', 'INV_LONE', 88000000, '2026-08-10');
  var result = runExactMatch([], [ledgerRec], []);
  assert.strictEqual(result.exact_matches.length, 0);
  assert.strictEqual(result.pending.length, 1);
  // Must NOT have a skip reason (it's just unmatched, not ambiguous)
  assert.ok(!result.pending[0]._exact_skip_reason, 'lone record should not be flagged ambiguous');
});

// ─── runExactMatch: ambiguous / duplicate case ────────────────────────────────

test('ambiguous: two bank records with same key -> both pending, flagged AMBIGUOUS, NOT matched', function() {
  // Two bank rows with identical amount_paisa + date_iso
  var bank1 = makeRecord('bank', 'UTR_DUP_A', 32066042, '2026-07-08');
  var bank2 = makeRecord('bank', 'UTR_DUP_B', 32066042, '2026-07-08');
  // One matching ledger and gateway
  var ledgerRec  = makeRecord('ledger',  'INV_DUP',  32066042, '2026-07-08');
  var gatewayRec = makeRecord('gateway', 'pay_DUP',  32066042, '2026-07-08');

  var result = runExactMatch([bank1, bank2], [ledgerRec], [gatewayRec]);

  // The whole group must NOT be forced into an EXACT match
  assert.strictEqual(result.exact_matches.length, 0, 'Should NOT produce an EXACT match when a source has duplicates');

  // ALL four records must be in pending
  assert.strictEqual(result.pending.length, 4, 'All 4 records (including ledger + gateway) must be pending');

  // All pending records in this group must be flagged AMBIGUOUS_INTRA_SOURCE
  var allFlagged = result.pending.every(function(r) {
    return r._exact_skip_reason === 'AMBIGUOUS_INTRA_SOURCE';
  });
  assert.ok(allFlagged, 'Every pending record from an ambiguous group must carry _exact_skip_reason');
});

test('ambiguous: two gateway records with same key -> none matched, all pending flagged', function() {
  var g1 = makeRecord('gateway', 'pay_G1', 50000000, '2026-07-22');
  var g2 = makeRecord('gateway', 'pay_G2', 50000000, '2026-07-22');
  var bankRec = makeRecord('bank', 'UTR_G', 50000000, '2026-07-22');

  var result = runExactMatch([bankRec], [], [g1, g2]);

  assert.strictEqual(result.exact_matches.length, 0, 'Ambiguous gateway group must not be matched');
  assert.strictEqual(result.pending.length, 3);
  var flagged = result.pending.filter(function(r) { return r._exact_skip_reason === 'AMBIGUOUS_INTRA_SOURCE'; });
  assert.strictEqual(flagged.length, 3, 'All 3 records in the ambiguous group must be flagged');
});

// ─── empty inputs ─────────────────────────────────────────────────────────────

test('runExactMatch: all-empty input returns empty result', function() {
  var result = runExactMatch([], [], []);
  assert.strictEqual(result.exact_matches.length, 0);
  assert.strictEqual(result.pending.length, 0);
});
