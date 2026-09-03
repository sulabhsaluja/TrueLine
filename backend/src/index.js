'use strict';

const fs = require('node:fs');
const { loadAllSources } = require('./ingest/loader');
const { runExactMatch } = require('./match/exact_match');
const { runFuzzyMatch } = require('./match/fuzzy_match');
const { classifyRecords } = require('./classify/exceptions');
const { compareWithGroundTruth } = require('./validate/ground_truth_check');
const { buildAuditTrail } = require('./audit/audit_trail');
const { generateSummary } = require('./report/summary');

/**
 * Orchestrates the full reconciliation pipeline.
 * Errors (e.g. NormalizationError, or sum mismatches in summary) propagate
 * as thrown exceptions. The frontend/caller should wrap this in a try/catch
 * and handle the error appropriately.
 * 
 * @param {Object} filePaths - Paths to data sources
 * @param {string} filePaths.bankPath
 * @param {string} filePaths.ledgerPath
 * @param {string} filePaths.gatewayPath
 * @param {string} [filePaths.groundTruthPath]
 * @returns {Object} Full pipeline state including summary and auditTrail arrays
 */
function runPipeline(filePaths) {
  const startTime = Date.now();
  
  // 1. Ingest
  const ingest = loadAllSources({
    bankPath: filePaths.bankPath,
    ledgerPath: filePaths.ledgerPath,
    gatewayPath: filePaths.gatewayPath
  });
  const allRecords = [].concat(ingest.bank, ingest.ledger, ingest.gateway);
  
  // 2. Exact Match
  const exactResult = runExactMatch(ingest.bank, ingest.ledger, ingest.gateway);
  
  // 3. Fuzzy Match
  const fuzzyResult = runFuzzyMatch(exactResult.exact_matches, exactResult.pending);
  
  // 4. Classify
  const classified = classifyRecords(
    fuzzyResult.updated_exact_matches,
    fuzzyResult.fuzzy_matches,
    fuzzyResult.ambiguous,
    fuzzyResult.still_pending,
    allRecords
  );
  
  // 5. Audit Trail
  const auditTrail = buildAuditTrail(classified);
  
  // 6. Validate & Report
  let validationResult = null;
  if (filePaths.groundTruthPath && fs.existsSync(filePaths.groundTruthPath)) {
    validationResult = compareWithGroundTruth(classified, filePaths.groundTruthPath);
  }
  
  const summary = generateSummary(classified, validationResult, allRecords.length, startTime);
  
  return { 
    ingest,
    allRecords,
    exactResult,
    fuzzyResult,
    classified,
    auditTrail,
    validationResult,
    summary
  };
}

module.exports = {
  runPipeline
};
