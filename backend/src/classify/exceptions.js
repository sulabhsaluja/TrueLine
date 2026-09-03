/**
 * src/classify/exceptions.js
 *
 * Phase 5 — Exception classification.
 * Assigns exactly ONE final status to every input record.
 */

'use strict';

function getDaysDiff(d1, d2) {
  const t1 = new Date(d1 + 'T00:00:00Z').getTime();
  const t2 = new Date(d2 + 'T00:00:00Z').getTime();
  return Math.round(Math.abs(t1 - t2) / (1000 * 60 * 60 * 24));
}

function classifyRecords(updatedExactMatches, fuzzyMatches, ambiguous, stillPending, allRecords) {
  const classified = [];
  const allSources = ['bank', 'ledger', 'gateway'];

  // Helper to find a "loose candidate" in a target source
  // Meaning: same date OR same amount.
  function hasLooseCandidate(canonical, targetSource) {
    for (let i = 0; i < allRecords.length; i++) {
      const r = allRecords[i];
      if (r.source === targetSource) {
        if (r.date_iso === canonical.date_iso || r.amount_paisa === canonical.amount_paisa) {
          return true;
        }
      }
    }
    return false;
  }

  // 1. Process Groups (Exact and Fuzzy)
  const allGroups = [].concat(updatedExactMatches, fuzzyMatches);
  
  for (let i = 0; i < allGroups.length; i++) {
    const group = allGroups[i];
    const canonical = group.records[0];
    const presentSources = group.records.map(r => r.source);
    
    if (group.records.length >= 3) {
      // 3+ sources: cleanly MATCHED
      for (const r of group.records) {
        classified.push({
          record: r,
          category: 'MATCHED',
          detail: `Group resolved as ${group.reason || 'EXACT'}`,
          audit_entry: group.audit_entry
        });
      }
    } else if (group.records.length === 2) {
      // 2 sources: Missing 1 source (e.g. direct bank-to-ledger transfer with no gateway)
      const missingSource = allSources.find(s => !presentSources.includes(s));
      
      for (const r of group.records) {
        classified.push({
          record: r,
          category: 'MATCHED',
          detail: `Group resolved as ${group.reason || 'EXACT'} (2-source match, no ${missingSource})`,
          audit_entry: group.audit_entry
        });
      }
    }
  }

  // 2. Process Ambiguous Records
  for (let i = 0; i < ambiguous.length; i++) {
    const r = ambiguous[i];
    classified.push({
      record: r,
      category: 'DUPLICATE_CANDIDATE',
      detail: `Conflict: ${r._fuzzy_skip_reason || r._exact_skip_reason}`,
      audit_entry: null
    });
  }

  // 3. Process Still Pending Records
  for (let i = 0; i < stillPending.length; i++) {
    const r = stillPending[i];

    // Check if it was flagged as an intra-source duplicate in earlier phases
    if (r._exact_skip_reason === 'AMBIGUOUS_INTRA_SOURCE' || r._fuzzy_skip_reason === 'AMBIGUOUS_INTRA_SOURCE') {
      classified.push({
        record: r,
        category: 'DUPLICATE_CANDIDATE',
        detail: `Intra-source duplicate detected: ${r._fuzzy_skip_reason || r._exact_skip_reason}`,
        audit_entry: null
      });
      continue;
    }

    let candidate = null;
    let matchType = null; // 'DATE_MISMATCH' or 'AMOUNT_MISMATCH'

    // Look for a loose candidate in ANY other source
    for (let j = 0; j < allRecords.length; j++) {
      const other = allRecords[j];
      if (other.source !== r.source) {
        if (other.date_iso === r.date_iso) {
          candidate = other;
          matchType = 'AMOUNT_MISMATCH';
          break; // Prioritize AMOUNT_MISMATCH
        }
      }
    }

    if (!candidate) {
      for (let j = 0; j < allRecords.length; j++) {
        const other = allRecords[j];
        if (other.source !== r.source) {
          if (other.amount_paisa === r.amount_paisa) {
            candidate = other;
            matchType = 'DATE_MISMATCH';
            break;
          }
        }
      }
    }

    if (candidate && matchType === 'AMOUNT_MISMATCH') {
      classified.push({
        record: r,
        category: 'AMOUNT_MISMATCH',
        detail: `Found candidate in ${candidate.source} with same date but amount diff = ${Math.abs(r.amount_paisa - candidate.amount_paisa)} paisa`,
        audit_entry: null
      });
    } else if (candidate && matchType === 'DATE_MISMATCH') {
      const daysDiff = getDaysDiff(r.date_iso, candidate.date_iso);
      classified.push({
        record: r,
        category: 'DATE_MISMATCH',
        detail: `Found candidate in ${candidate.source} with same amount but date diff = ${daysDiff} days`,
        audit_entry: null
      });
    } else {
      // No loose candidate exists anywhere
      // UNRESOLVED
      classified.push({
        record: r,
        category: 'UNRESOLVED',
        detail: `Record has NO plausible counterpart in any other source`,
        audit_entry: null
      });
    }
  }

  return classified;
}

module.exports = {
  classifyRecords
};
