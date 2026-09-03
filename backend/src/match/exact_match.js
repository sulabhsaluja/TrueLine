/**
 * src/match/exact_match.js
 *
 * Phase 3 — Exact-match rule.
 *
 * Groups all normalized records by composite key (amount_paisa, date_iso).
 * A group resolves as EXACT when:
 *   - It contains records from 2 or more DISTINCT sources, AND
 *   - No source is represented more than once (no intra-source ambiguity).
 *
 * Records that do NOT resolve here are placed in `pending` for Phase 4
 * (fuzzy matching) to attempt.
 *
 * IMPORTANT: source_ref_id is included in audit entries for
 * traceability ONLY. It is never used to decide a match.
 *
 * Coding convention (CLAUDE.md sec 3): explicit if/else — no ternary nesting,
 * no scoring functions, every branch carries a reason code.
 */

'use strict';

// ---------------------------------------------------------------------------
// Key builder
// ---------------------------------------------------------------------------

/**
 * Build the composite match key from a NormalizedRecord.
 * Using a string key makes it safe as a plain-object Map key.
 *
 * @param {NormalizedRecord} record
 * @returns {string}  e.g. "45127021|2026-07-11"
 */
function buildExactKey(record) {
  return record.amount_paisa + '|' + record.date_iso;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Run the exact-match pass over three normalized record arrays.
 *
 * @param {NormalizedRecord[]} bankRecords
 * @param {NormalizedRecord[]} ledgerRecords
 * @param {NormalizedRecord[]} gatewayRecords
 * @returns {ExactMatchResult}
 */
function runExactMatch(bankRecords, ledgerRecords, gatewayRecords) {
  // ── Step 1: bucket every record by composite key ─────────────────────────
  // groups: Map<string, NormalizedRecord[]>
  var groups = new Map();

  var allRecords = [].concat(bankRecords, ledgerRecords, gatewayRecords);

  for (var i = 0; i < allRecords.length; i++) {
    var rec = allRecords[i];
    var key = buildExactKey(rec);

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(rec);
  }

  // ── Step 2: classify each group ──────────────────────────────────────────
  var exactMatches = [];
  var pending      = [];

  groups.forEach(function(groupRecords, groupKey) {

    // Count how many records each source contributes to this group.
    var countPerSource = { bank: 0, ledger: 0, gateway: 0 };
    for (var j = 0; j < groupRecords.length; j++) {
      var src = groupRecords[j].source;
      countPerSource[src] = countPerSource[src] + 1;
    }

    var distinctSources = 0;
    var hasIntraSourceDuplicate = false;

    if (countPerSource.bank > 0)    { distinctSources++; }
    if (countPerSource.ledger > 0)  { distinctSources++; }
    if (countPerSource.gateway > 0) { distinctSources++; }

    if (countPerSource.bank > 1 || countPerSource.ledger > 1 || countPerSource.gateway > 1) {
      hasIntraSourceDuplicate = true;
    }

    // ── EXACT match: 2+ distinct sources, no source appears twice ──────────
    if (distinctSources >= 2 && !hasIntraSourceDuplicate) {
      var auditEntry = buildAuditEntry('EXACT', groupKey, groupRecords);
      exactMatches.push({
        group_key: groupKey,
        reason: 'EXACT',
        records: groupRecords,
        audit_entry: auditEntry,
      });

    // ── Ambiguous: one or more sources appear more than once ───────────────
    // Do NOT force a match. Leave all records for Phase 4 to classify
    // as DUPLICATE_CANDIDATE. Mark them so Phase 4 knows why they were skipped.
    } else if (hasIntraSourceDuplicate) {
      for (var k = 0; k < groupRecords.length; k++) {
        var pending_rec = Object.assign({}, groupRecords[k]);
        pending_rec._exact_skip_reason = 'AMBIGUOUS_INTRA_SOURCE';
        pending_rec._exact_skip_key    = groupKey;
        pending.push(pending_rec);
      }

    // ── Unmatched: only one source represented ─────────────────────────────
    // Pass through to Phase 4 (fuzzy matching) unchanged.
    } else {
      for (var m = 0; m < groupRecords.length; m++) {
        pending.push(groupRecords[m]);
      }
    }
  });

  return {
    exact_matches: exactMatches,
    pending: pending,
  };
}

// ---------------------------------------------------------------------------
// Audit entry builder
// ---------------------------------------------------------------------------

/**
 * Build a structured audit entry for one EXACT match group.
 * Pulls source + source_ref_id from each record (audit/display only).
 * Does NOT re-derive amount or date — those are already on the record.
 *
 * @param {string}             reason       Always 'EXACT' here
 * @param {string}             groupKey     The composite key string
 * @param {NormalizedRecord[]} records      The matching records
 * @returns {AuditEntry}
 */
function buildAuditEntry(reason, groupKey, records) {
  var involvedSources = records.map(function(r) {
    return {
      source:        r.source,
      source_ref_id: r.source_ref_id,
    };
  });

  return {
    rule:             reason,
    group_key:        groupKey,
    involved_sources: involvedSources,
    decided_at:       new Date().toISOString(),
    reason_code:      reason,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ExactMatchGroup
 * @property {string}             group_key   "amount_paisa|date_iso"
 * @property {string}             reason      Always 'EXACT'
 * @property {NormalizedRecord[]} records     The matched records
 * @property {AuditEntry}         audit_entry Audit trail for this decision
 */

/**
 * @typedef {Object} ExactMatchResult
 * @property {ExactMatchGroup[]}  exact_matches  Groups resolved as EXACT
 * @property {NormalizedRecord[]} pending        Records not resolved; passed to Phase 4
 */

/**
 * @typedef {Object} AuditEntry
 * @property {string} rule             'EXACT'
 * @property {string} group_key        Composite key
 * @property {Array}  involved_sources [{source, source_ref_id}, ...]
 * @property {string} decided_at       ISO timestamp
 * @property {string} reason_code      'EXACT'
 */

module.exports = {
  runExactMatch: runExactMatch,
  buildExactKey: buildExactKey,
};
