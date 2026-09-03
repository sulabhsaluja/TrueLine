/**
 * src/match/fuzzy_match.js
 *
 * Phase 4.1 — Fuzzy match rule with Unified Graph.
 *
 * Evaluates records that did not match exactly in Phase 3, AND checks if they
 * can extend incomplete EXACT groups (size 2) from Phase 3.
 *
 * Uses three tolerance rules:
 *   1. FUZZY_AMOUNT: same date, amount diff <= 100 paisa (₹1)
 *   2. FUZZY_DATE: same amount, date diff <= 2 days
 *   3. FUZZY_BOTH: amount diff <= 100 paisa AND date diff <= 2 days
 */

'use strict';

function getDaysDiff(d1, d2) {
  const t1 = new Date(d1 + 'T00:00:00Z').getTime();
  const t2 = new Date(d2 + 'T00:00:00Z').getTime();
  return Math.round(Math.abs(t1 - t2) / (1000 * 60 * 60 * 24));
}

function determineFuzzyReason(records) {
  let minAmt = Infinity, maxAmt = -Infinity;
  let minTime = Infinity, maxTime = -Infinity;
  
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (r.amount_paisa < minAmt) minAmt = r.amount_paisa;
    if (r.amount_paisa > maxAmt) maxAmt = r.amount_paisa;
    
    const t = new Date(r.date_iso + 'T00:00:00Z').getTime();
    if (t < minTime) minTime = t;
    if (t > maxTime) maxTime = t;
  }
  
  const amtDiff = maxAmt - minAmt;
  const daysDiff = Math.round((maxTime - minTime) / (1000 * 60 * 60 * 24));
  
  if (amtDiff === 0 && daysDiff === 0) {
    throw new Error("Bug: EXACT match reached fuzzy logic");
  } else if (daysDiff === 0 && amtDiff <= 100) {
    return { reason: 'FUZZY_AMOUNT', detail: `amount diff = ${amtDiff} paisa, date diff = 0 days` };
  } else if (amtDiff === 0 && daysDiff <= 2) {
    return { reason: 'FUZZY_DATE', detail: `amount diff = 0 paisa, date diff = ${daysDiff} days` };
  } else if (amtDiff <= 100 && daysDiff <= 2) {
    return { reason: 'FUZZY_BOTH', detail: `amount diff = ${amtDiff} paisa, date diff = ${daysDiff} days` };
  } else {
    return null; // Group is a loose chain exceeding bounding box
  }
}

function buildFuzzyAuditEntry(reason, detail, groupKey, records) {
  const involvedSources = records.map(r => ({
    source: r.source,
    source_ref_id: r.source_ref_id
  }));

  return {
    rule: reason,
    tolerance_detail: detail,
    group_key: groupKey,
    involved_sources: involvedSources,
    decided_at: new Date().toISOString(),
    reason_code: reason,
  };
}

function runFuzzyMatch(exactGroups, pendingRecords) {
  const extendableGroups = [];
  const untouchedGroups = [];
  
  for (let i = 0; i < exactGroups.length; i++) {
    const g = exactGroups[i];
    if (g.records.length === 2) {
      extendableGroups.push(g);
    } else {
      untouchedGroups.push(g);
    }
  }

  const groupEdges = Array.from({ length: extendableGroups.length }, () => []);
  const pendingEdgesToGroups = Array.from({ length: pendingRecords.length }, () => []);
  const pendingEdgesToPending = Array.from({ length: pendingRecords.length }, () => []);

  // 1. Build Group ↔ Pending edges
  for (let i = 0; i < extendableGroups.length; i++) {
    const group = extendableGroups[i];
    const canonical = group.records[0];
    
    const presentSources = new Set(group.records.map(r => r.source));
    const allSources = ['bank', 'ledger', 'gateway'];
    const missingSource = allSources.find(s => !presentSources.has(s));

    for (let j = 0; j < pendingRecords.length; j++) {
      const p = pendingRecords[j];
      if (p.source === missingSource) {
        const amtDiff = Math.abs(p.amount_paisa - canonical.amount_paisa);
        const daysDiff = getDaysDiff(p.date_iso, canonical.date_iso);
        if (amtDiff <= 100 && daysDiff <= 2) {
          groupEdges[i].push(j);
          pendingEdgesToGroups[j].push(i);
        }
      }
    }
  }

  // 2. Build Pending ↔ Pending edges
  for (let i = 0; i < pendingRecords.length; i++) {
    for (let j = i + 1; j < pendingRecords.length; j++) {
      const p1 = pendingRecords[i];
      const p2 = pendingRecords[j];
      if (p1.source !== p2.source) {
        const amtDiff = Math.abs(p1.amount_paisa - p2.amount_paisa);
        const daysDiff = getDaysDiff(p1.date_iso, p2.date_iso);
        if (amtDiff <= 100 && daysDiff <= 2) {
          pendingEdgesToPending[i].push(j);
          pendingEdgesToPending[j].push(i);
        }
      }
    }
  }

  // 3. Conflict Resolution
  const groupState = new Array(extendableGroups.length).fill('AVAILABLE');
  const pendingState = new Array(pendingRecords.length).fill('AVAILABLE');

  // Identify Ambiguous Group Extensions
  for (let i = 0; i < extendableGroups.length; i++) {
    if (groupEdges[i].length > 1) {
      groupState[i] = 'AMBIGUOUS_GROUP_EXTENSION';
      for (const pIdx of groupEdges[i]) {
        pendingState[pIdx] = 'AMBIGUOUS_GROUP_EXTENSION';
      }
    }
  }

  // Identify Symmetric Group Conflicts and Cross-Match Conflicts
  for (let j = 0; j < pendingRecords.length; j++) {
    const pGroups = pendingEdgesToGroups[j];
    const pPendings = pendingEdgesToPending[j];
    
    if (pGroups.length > 1) {
      pendingState[j] = 'SYMMETRIC_GROUP_CONFLICT';
      for (const gIdx of pGroups) {
        groupState[gIdx] = 'SYMMETRIC_GROUP_CONFLICT';
        for (const otherPIdx of groupEdges[gIdx]) {
          pendingState[otherPIdx] = 'SYMMETRIC_GROUP_CONFLICT';
        }
      }
    }

    if (pGroups.length > 0 && pPendings.length > 0) {
      pendingState[j] = 'CROSS_MATCH_CONFLICT';
      for (const gIdx of pGroups) {
        groupState[gIdx] = 'CROSS_MATCH_CONFLICT';
        for (const otherPIdx of groupEdges[gIdx]) {
          pendingState[otherPIdx] = 'CROSS_MATCH_CONFLICT';
        }
      }
      for (const otherPIdx of pPendings) {
        pendingState[otherPIdx] = 'CROSS_MATCH_CONFLICT';
      }
    }
  }

  const updated_exact_matches = [...untouchedGroups];
  const fuzzy_matches = [];
  const ambiguous = [];
  const still_pending = [];

  // 4. Execute clean extensions or move ambiguous groups
  for (let i = 0; i < extendableGroups.length; i++) {
    const group = extendableGroups[i];
    if (groupState[i] !== 'AVAILABLE' && groupState[i] !== 'EXTENDED') {
      // Group was flagged as a conflict.
      for (const r of group.records) {
        const rc = Object.assign({}, r);
        rc._fuzzy_skip_reason = groupState[i];
        ambiguous.push(rc);
      }
    } else if (groupState[i] === 'AVAILABLE') {
      if (groupEdges[i].length === 1) {
        const pIdx = groupEdges[i][0];
        if (pendingState[pIdx] === 'AVAILABLE') {
          // CLEAN EXTENSION
          groupState[i] = 'EXTENDED';
          pendingState[pIdx] = 'EXTENDED';
          
          const pendingRec = pendingRecords[pIdx];
          const canonical = group.records[0];
          const amtDiff = Math.abs(pendingRec.amount_paisa - canonical.amount_paisa);
          const daysDiff = getDaysDiff(pendingRec.date_iso, canonical.date_iso);
          
          let reasonCode;
          if (amtDiff === 0 && daysDiff === 0) reasonCode = 'EXACT'; // Should never happen
          else if (daysDiff === 0) reasonCode = 'FUZZY_AMOUNT';
          else if (amtDiff === 0) reasonCode = 'FUZZY_DATE';
          else reasonCode = 'FUZZY_BOTH';

          const extendedRecords = [...group.records, pendingRec];
          const groupKey = extendedRecords.map(r => r.amount_paisa + '|' + r.date_iso).sort().join('__');
          
          const auditEntry = buildFuzzyAuditEntry(
            reasonCode, 
            `Group Extended: amount diff = ${amtDiff} paisa, date diff = ${daysDiff} days`, 
            groupKey, 
            extendedRecords
          );

          fuzzy_matches.push({
            group_key: groupKey,
            reason: reasonCode,
            tolerance_detail: auditEntry.tolerance_detail,
            records: extendedRecords,
            audit_entry: auditEntry
          });
        } else {
          updated_exact_matches.push(group);
        }
      } else {
        updated_exact_matches.push(group);
      }
    }
  }

  // Handle ambiguous pending records
  for (let j = 0; j < pendingRecords.length; j++) {
    if (pendingState[j] !== 'AVAILABLE' && pendingState[j] !== 'EXTENDED') {
      const rc = Object.assign({}, pendingRecords[j]);
      rc._fuzzy_skip_reason = pendingState[j];
      ambiguous.push(rc);
    }
  }

  // 5. Free Pairwise Clustering
  const freePendingIndices = [];
  for (let j = 0; j < pendingRecords.length; j++) {
    if (pendingState[j] === 'AVAILABLE') {
      freePendingIndices.push(j);
    }
  }

  const freeNodes = freePendingIndices.map(j => pendingRecords[j]);
  const freeAdj = Array.from({ length: freeNodes.length }, () => []);

  for (let u = 0; u < freeNodes.length; u++) {
    for (let v = u + 1; v < freeNodes.length; v++) {
      const origU = freePendingIndices[u];
      const origV = freePendingIndices[v];
      if (pendingEdgesToPending[origU].includes(origV)) {
        freeAdj[u].push(v);
        freeAdj[v].push(u);
      }
    }
  }

  const visited = new Array(freeNodes.length).fill(false);
  const components = [];
  for (let i = 0; i < freeNodes.length; i++) {
    if (!visited[i]) {
      const comp = [];
      const q = [i];
      visited[i] = true;
      while (q.length > 0) {
        const curr = q.shift();
        comp.push(curr);
        for (const neighbor of freeAdj[curr]) {
          if (!visited[neighbor]) {
            visited[neighbor] = true;
            q.push(neighbor);
          }
        }
      }
      components.push(comp.map(idx => freeNodes[idx]));
    }
  }

  for (let i = 0; i < components.length; i++) {
    const comp = components[i];
    
    if (comp.length === 1) {
      still_pending.push(comp[0]);
      continue;
    }

    const srcCounts = { bank: 0, ledger: 0, gateway: 0 };
    for (let j = 0; j < comp.length; j++) {
      srcCounts[comp[j].source]++;
    }

    if (srcCounts.bank > 1 || srcCounts.ledger > 1 || srcCounts.gateway > 1) {
      for (let j = 0; j < comp.length; j++) {
        const rc = Object.assign({}, comp[j]);
        rc._fuzzy_skip_reason = 'AMBIGUOUS_INTRA_SOURCE';
        ambiguous.push(rc);
      }
      continue;
    }

    const evalResult = determineFuzzyReason(comp);
    if (!evalResult) {
      for (let j = 0; j < comp.length; j++) {
        const rc = Object.assign({}, comp[j]);
        rc._fuzzy_skip_reason = 'AMBIGUOUS_CHAIN';
        ambiguous.push(rc);
      }
      continue;
    }
    
    const groupKey = comp.map(r => r.amount_paisa + '|' + r.date_iso).sort().join('__');
    const auditEntry = buildFuzzyAuditEntry(evalResult.reason, evalResult.detail, groupKey, comp);
    
    fuzzy_matches.push({
      group_key: groupKey,
      reason: evalResult.reason,
      tolerance_detail: evalResult.detail,
      records: comp,
      audit_entry: auditEntry
    });
  }

  return {
    updated_exact_matches,
    fuzzy_matches,
    ambiguous,
    still_pending
  };
}

module.exports = {
  runFuzzyMatch,
  determineFuzzyReason
};
