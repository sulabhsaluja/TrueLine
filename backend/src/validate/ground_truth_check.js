/**
 * src/validate/ground_truth_check.js
 *
 * Ground-Truth Validation Module
 * Compares the output of the classification engine against data/ground_truth.json
 */

'use strict';

const fs = require('fs');

function loadGroundTruth(filepath) {
  const data = fs.readFileSync(filepath, 'utf8');
  return JSON.parse(data);
}

function compareWithGroundTruth(classifications, groundTruthPath) {
  const gt = loadGroundTruth(groundTruthPath);
  
  // Build a lookup map of ground truth by txn_id
  const gtMap = new Map(); // txn_id -> gt object
  // And a reverse lookup from source_ref_id -> txn_id
  const refToTxn = new Map();
  
  for (const item of gt) {
    gtMap.set(item.txn_id, item);
    if (item.bank_row_id) refToTxn.set('bank:' + item.bank_row_id, item.txn_id);
    if (item.ledger_row_id) {
      // duplicate candidates have "+<decoy>" in gt row_id sometimes. Just take the primary ID.
      const id = item.ledger_row_id.split('+')[0];
      refToTxn.set('ledger:' + id, item.txn_id);
    }
    if (item.gateway_row_id) {
      const id = item.gateway_row_id.split('+')[0];
      refToTxn.set('gateway:' + id, item.txn_id);
    }
  }

  // Group classifications by txn_id
  const txnClassifications = new Map(); // txn_id -> array of classification objects
  
  for (const c of classifications) {
    const key = c.record.source + ':' + c.record.source_ref_id;
    const txnId = refToTxn.get(key);
    
    if (txnId) {
      if (!txnClassifications.has(txnId)) {
        txnClassifications.set(txnId, []);
      }
      txnClassifications.get(txnId).push(c);
    }
    // Note: Decoys in duplicate_candidate might not map back to a txn_id easily if they weren't the primary.
    // In our synthetic data, decoys are usually included in the 'true' transaction's scope.
  }

  // Build confusion matrix
  const confusion = {
    'CLEAN_MATCH': { 'MATCHED': 0, 'AMOUNT_MISMATCH': 0, 'DATE_MISMATCH': 0, 'MISSING_COUNTERPART': 0, 'DUPLICATE_CANDIDATE': 0, 'UNRESOLVED': 0 },
    'AMOUNT_MISMATCH': { 'MATCHED': 0, 'AMOUNT_MISMATCH': 0, 'DATE_MISMATCH': 0, 'MISSING_COUNTERPART': 0, 'DUPLICATE_CANDIDATE': 0, 'UNRESOLVED': 0 },
    'DATE_MISMATCH': { 'MATCHED': 0, 'AMOUNT_MISMATCH': 0, 'DATE_MISMATCH': 0, 'MISSING_COUNTERPART': 0, 'DUPLICATE_CANDIDATE': 0, 'UNRESOLVED': 0 },
    'MISSING_COUNTERPART': { 'MATCHED': 0, 'AMOUNT_MISMATCH': 0, 'DATE_MISMATCH': 0, 'MISSING_COUNTERPART': 0, 'DUPLICATE_CANDIDATE': 0, 'UNRESOLVED': 0 },
    'DUPLICATE_CANDIDATE': { 'MATCHED': 0, 'AMOUNT_MISMATCH': 0, 'DATE_MISMATCH': 0, 'MISSING_COUNTERPART': 0, 'DUPLICATE_CANDIDATE': 0, 'UNRESOLVED': 0 },
    'UNRESOLVED': { 'MATCHED': 0, 'AMOUNT_MISMATCH': 0, 'DATE_MISMATCH': 0, 'MISSING_COUNTERPART': 0, 'DUPLICATE_CANDIDATE': 0, 'UNRESOLVED': 0 }
  };

  const disagreements = [];
  let correctCount = 0;
  let totalTxns = 0;

  for (const [txnId, items] of gtMap.entries()) {
    totalTxns++;
    
    const trueCat = items.category; // "CLEAN_MATCH", "AMOUNT_MISMATCH", etc.
    
    const pipelineRecords = txnClassifications.get(txnId) || [];
    
    // Determine consensus category for this transaction from pipeline
    // Hierarchy: If any are DUPLICATE_CANDIDATE -> DUPLICATE_CANDIDATE
    // If any are AMOUNT_MISMATCH/DATE_MISMATCH -> that
    // If any MISSING_COUNTERPART/UNRESOLVED -> that
    // Else MATCHED
    let consensus = 'UNRESOLVED';
    if (pipelineRecords.length === 0) {
      consensus = 'UNRESOLVED';
    } else {
      const cats = pipelineRecords.map(c => c.category);
      if (cats.includes('DUPLICATE_CANDIDATE')) consensus = 'DUPLICATE_CANDIDATE';
      else if (cats.includes('AMOUNT_MISMATCH')) consensus = 'AMOUNT_MISMATCH';
      else if (cats.includes('DATE_MISMATCH')) consensus = 'DATE_MISMATCH';
      else if (cats.includes('MISSING_COUNTERPART')) consensus = 'MISSING_COUNTERPART';
      else if (cats.includes('UNRESOLVED')) consensus = 'UNRESOLVED';
      else if (cats.includes('MATCHED')) consensus = 'MATCHED';
    }

    // Map CLEAN_MATCH from GT to MATCHED for comparison
    const expectedConsensus = (trueCat === 'CLEAN_MATCH') ? 'MATCHED' : trueCat;

    if (confusion[trueCat] && confusion[trueCat][consensus] !== undefined) {
      confusion[trueCat][consensus]++;
    }

    if (consensus === expectedConsensus) {
      correctCount++;
    } else {
      disagreements.push({
        txn_id: txnId,
        expected: expectedConsensus,
        actual: consensus,
        detail: `Pipeline produced: ${pipelineRecords.map(r => r.category).join(', ')}`
      });
    }
  }

  const matchRate = (correctCount / totalTxns) * 100;

  let report = `\n[GROUND TRUTH VALIDATION REPORT]\n`;
  report += `Overall Match Rate: ${matchRate.toFixed(2)}% (${correctCount}/${totalTxns} transactions)\n\n`;
  report += `Confusion Breakdown (Rows = Ground Truth, Columns = Pipeline):\n`;
  report += `${"".padEnd(20)} | MATCH | AMT_M | DAT_M | MIS_C | DUP_C | UNRES |\n`;
  report += `---------------------|-------|-------|-------|-------|-------|-------|\n`;
  
  for (const gtCat of Object.keys(confusion)) {
    const row = confusion[gtCat];
    report += `${gtCat.padEnd(20)} | ${String(row['MATCHED']).padStart(5)} | ${String(row['AMOUNT_MISMATCH']).padStart(5)} | ${String(row['DATE_MISMATCH']).padStart(5)} | ${String(row['MISSING_COUNTERPART']).padStart(5)} | ${String(row['DUPLICATE_CANDIDATE']).padStart(5)} | ${String(row['UNRESOLVED']).padStart(5)} |\n`;
  }

  if (disagreements.length > 0) {
    report += `\nDisagreements:\n`;
    for (const d of disagreements) {
      report += `  ${d.txn_id}: Expected ${d.expected}, got ${d.actual} (${d.detail})\n`;
    }
  }

  return {
    report,
    matrix: confusion,
    matchRate,
    correctCount,
    totalTxns
  };
}

module.exports = {
  compareWithGroundTruth
};
