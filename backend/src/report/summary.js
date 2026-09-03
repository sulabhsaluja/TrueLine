'use strict';

/**
 * Generates the Phase 7 Reporting Layer JSON payload.
 * Consumes the structured ground truth validation object.
 */
function generateSummary(classifiedRecords, validationObject, totalIngested, startTimeMs) {
  const endTimeMs = Date.now();
  const processing_time_ms = endTimeMs - startTimeMs;

  const total_classified = classifiedRecords.length;
  const categories = {
    MATCHED: 0,
    AMOUNT_MISMATCH: 0,
    DATE_MISMATCH: 0,
    MISSING_COUNTERPART: 0,
    DUPLICATE_CANDIDATE: 0,
    UNRESOLVED: 0
  };

  const source_volume = {
    bank: 0,
    ledger: 0,
    gateway: 0,
    total_ingested: totalIngested
  };

  for (let i = 0; i < classifiedRecords.length; i++) {
    const c = classifiedRecords[i];
    if (categories[c.category] !== undefined) {
      categories[c.category]++;
    } else {
      categories.UNRESOLVED++; // Fallback
    }

    if (source_volume[c.record.source] !== undefined) {
      source_volume[c.record.source]++;
    }
  }

  const totalCategories = Object.values(categories).reduce((sum, count) => sum + count, 0);
  if (totalCategories !== totalIngested) {
    throw new Error(`Integrity error: sum of categories (${totalCategories}) does not match total ingested records (${totalIngested})`);
  }

  const matched = categories.MATCHED;
  const match_percentage = total_classified > 0 ? (matched / total_classified) * 100 : 0;

  const categoryResult = {};
  for (const [cat, count] of Object.entries(categories)) {
    categoryResult[cat] = {
      count,
      percentage: total_classified > 0 ? Number(((count / total_classified) * 100).toFixed(2)) : 0
    };
  }

  let ground_truth_match_rate_percentage = 0;
  let confusion_matrix = {};

  if (validationObject) {
    ground_truth_match_rate_percentage = Number(validationObject.matchRate.toFixed(2));
    confusion_matrix = validationObject.matrix;
  }

  return {
    processing_time_ms,
    match_rate: {
      matched,
      total_classified,
      percentage: Number(match_percentage.toFixed(2))
    },
    categories: categoryResult,
    source_volume,
    known_divergences: {
      ground_truth_match_rate_percentage,
      confusion_matrix
    }
  };
}

module.exports = {
  generateSummary
};
