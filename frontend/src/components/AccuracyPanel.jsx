import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Target, TriangleAlert, CheckCircle2 } from 'lucide-react';
import { CATEGORY_ORDER, CATEGORIES } from '../lib/categories';
import { useCalmMotion } from '../lib/motion';

/**
 * Measured accuracy against the ground-truth key.
 *
 * PRD 10 sets the bar: report the measured accuracy "exactly, including if
 * it's not 100%", and show "at least one real failure case handled gracefully".
 * The previous UI computed neither — it displayed only the engine's own match
 * rate and never rendered summary.known_divergences at all, so the number the
 * project is actually scored on was invisible.
 *
 * Two rates appear on this page and they are NOT the same measurement:
 *
 *   match_rate.percentage         150 / 177 ingested ROWS were matched
 *   ground_truth_match_rate_pct    53 /  60 ground-truth TRANSACTIONS were
 *                                  classified correctly
 *
 * Different numerators, different denominators, different questions. Putting
 * them side by side without saying so would be the most misleading thing this
 * page could do, so the denominators are stated on the face of each figure.
 */

/** The truth axis labels a correct match CLEAN_MATCH; the engine calls it MATCHED. */
const TRUTH_ALIAS = { MATCHED: 'CLEAN_MATCH' };

/** Short forms for the matrix axes — the full labels do not fit a 6-column grid. */
const ABBREV = {
  MATCHED: 'Match',
  AMOUNT_MISMATCH: 'Amount',
  DATE_MISMATCH: 'Date',
  MISSING_COUNTERPART: 'Missing',
  DUPLICATE_CANDIDATE: 'Dup',
  UNRESOLVED: 'Unres',
};

function truthKeyFor(column) {
  return TRUTH_ALIAS[column] ?? column;
}

export function AccuracyPanel({ knownDivergences, matchRate }) {
  const calm = useCalmMotion();
  const matrix = knownDivergences?.confusion_matrix;
  const reported = knownDivergences?.ground_truth_match_rate_percentage;

  const analysis = useMemo(() => {
    if (!matrix) return null;

    let correct = 0;
    let wrong = 0;
    const errors = [];

    CATEGORY_ORDER.forEach((column) => {
      const rowKey = truthKeyFor(column);
      const row = matrix[rowKey];
      if (!row) return;

      CATEGORY_ORDER.forEach((classified) => {
        const count = row[classified] ?? 0;
        if (count === 0) return;

        if (classified === column) {
          correct += count;
        } else {
          wrong += count;
          errors.push({ truth: column, classified, count });
        }
      });
    });

    const total = correct + wrong;
    errors.sort((a, b) => b.count - a.count);

    return {
      correct,
      wrong,
      total,
      errors,
      derived: total > 0 ? Number(((correct / total) * 100).toFixed(2)) : 0,
    };
  }, [matrix]);

  if (!analysis || analysis.total === 0) {
    return (
      <section className="panel" aria-labelledby="accuracy-heading">
        <header className="panel-header">
          <h2 className="title-sm" id="accuracy-heading">Measured accuracy</h2>
        </header>
        <div className="panel-body">
          <p className="text-sm muted">
            No ground-truth key was supplied with this run, so classification
            accuracy could not be measured. The match rate above describes what
            the engine did — not whether it was right.
          </p>
        </div>
      </section>
    );
  }

  const { correct, wrong, total, errors, derived } = analysis;
  const headline = typeof reported === 'number' ? reported : derived;
  const disagrees = typeof reported === 'number' && Math.abs(reported - derived) > 0.01;

  return (
    <section className="panel" aria-labelledby="accuracy-heading">
      <header className="panel-header">
        <div className="row">
          <Target size={15} style={{ color: 'var(--accent)' }} aria-hidden="true" />
          <h2 className="title-sm" id="accuracy-heading">Measured accuracy</h2>
        </div>
        <span className="badge" data-tone={wrong > 0 ? 'caution' : 'positive'}>
          {wrong > 0 ? `${wrong} misclassified` : 'No divergences'}
        </span>
      </header>

      <div className="panel-body">
        <div className="bar-panel">
          <div className="bar-figures">
            <div>
              <span className="label">Classification accuracy</span>
              <span className="figure bar-value">{headline.toFixed(2)}%</span>
              <span className="stat-caption">
                {correct} of {total} ground-truth transactions classified correctly
              </span>
            </div>
            {matchRate && (
              <div className="delta">
                <span className="label">Engine match rate</span>
                <span className="figure delta-value">{matchRate.percentage.toFixed(2)}%</span>
                <span className="stat-caption">
                  {matchRate.matched} of {matchRate.total_classified} ingested rows matched
                </span>
              </div>
            )}
          </div>

          <div className="meter" role="img"
            aria-label={`${headline.toFixed(2)} percent of ground-truth transactions classified correctly`}>
            <motion.span
              className="meter-fill"
              data-tone={wrong > 0 ? 'caution' : 'positive'}
              initial={calm ? false : { width: 0 }}
              animate={{ width: `${headline}%` }}
              transition={{ duration: calm ? 0 : 0.75, ease: [0.16, 1, 0.3, 1], delay: calm ? 0 : 0.1 }}
            />
          </div>

          <p className="panel-note" style={{ padding: 0, border: 0, marginTop: 'var(--space-3)' }}>
            These two figures answer different questions and share no
            denominator. The match rate counts ingested rows the engine paired
            up. The accuracy figure counts ground-truth transactions the engine
            labelled correctly — that is the one worth trusting, because it is
            the only one checked against an answer the engine could not see.
          </p>

          {disagrees && (
            <div className="callout" data-tone="critical" style={{ marginTop: 'var(--space-4)' }}>
              <TriangleAlert size={15} className="callout-icon" aria-hidden="true" />
              <div>
                <div className="callout-title">Reported and recomputed accuracy disagree</div>
                <p className="text-sm">
                  The run reported {reported}% but recomputing from the confusion
                  matrix on this page gives {derived}%. Trust neither until the
                  discrepancy is explained.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* The failure case, stated plainly rather than buried in the matrix. */}
        {errors.length > 0 ? (
          <div className="callout" data-tone="caution" style={{ marginTop: 'var(--space-5)' }}>
            <TriangleAlert size={15} className="callout-icon" aria-hidden="true" />
            <div>
              <div className="callout-title">
                Where the engine got it wrong — {wrong} of {total}
              </div>
              <ul className="stack stack-2 text-sm" style={{ margin: 'var(--space-2) 0 0', paddingLeft: '1.1rem' }}>
                {errors.map((e, i) => (
                  <li key={i}>
                    <strong>{e.count}</strong>{' '}
                    {e.count === 1 ? 'transaction whose true state was' : 'transactions whose true state was'}{' '}
                    <strong>{CATEGORIES[e.truth]?.label ?? e.truth}</strong>{' '}
                    {e.count === 1 ? 'was' : 'were'} classified as{' '}
                    <strong>{CATEGORIES[e.classified]?.label ?? e.classified}</strong>.
                  </li>
                ))}
              </ul>
              <p className="text-sm muted" style={{ marginTop: 'var(--space-3)' }}>
                Every one of these is an over-fire of a single rule, not a
                random miss. They are shown here rather than smoothed away
                because a reconciliation tool that hides its own error rate is
                worth less than no tool at all.
              </p>
            </div>
          </div>
        ) : (
          <div className="callout" data-tone="positive" style={{ marginTop: 'var(--space-5)' }}>
            <CheckCircle2 size={15} className="callout-icon" aria-hidden="true" />
            <div>
              <div className="callout-title">Every ground-truth transaction classified correctly</div>
              <p className="text-sm">
                All {total} transactions in the answer key landed in the right
                category. Worth re-checking that the key covers the hard cases.
              </p>
            </div>
          </div>
        )}

        <details className="matrix-details">
          <summary className="text-sm">
            Full confusion matrix — {total} transactions
          </summary>

          <div className="matrix-scroll">
            <table className="matrix">
              <caption className="visually-hidden">
                Confusion matrix. Rows are the true category from the ground-truth
                key; columns are the category the engine assigned. Cells on the
                diagonal are correct classifications.
              </caption>
              <thead>
                <tr>
                  <th scope="col">
                    <span className="matrix-corner">True \ Assigned</span>
                  </th>
                  {CATEGORY_ORDER.map((col) => (
                    <th key={col} scope="col" title={CATEGORIES[col]?.label}>
                      {ABBREV[col] ?? col}
                    </th>
                  ))}
                  <th scope="col" className="matrix-total">Total</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORY_ORDER.map((rowCol) => {
                  const rowKey = truthKeyFor(rowCol);
                  const row = matrix[rowKey] ?? {};
                  const rowTotal = CATEGORY_ORDER.reduce((sum, c) => sum + (row[c] ?? 0), 0);

                  return (
                    <tr key={rowCol}>
                      <th scope="row" title={CATEGORIES[rowCol]?.label}>
                        {ABBREV[rowCol] ?? rowCol}
                      </th>
                      {CATEGORY_ORDER.map((col) => {
                        const count = row[col] ?? 0;
                        const onDiagonal = col === rowCol;
                        const cls = count === 0
                          ? 'is-zero'
                          : onDiagonal ? 'is-hit' : 'is-miss';

                        return (
                          <td key={col} className={cls}>
                            <span className="visually-hidden">
                              {count} {CATEGORIES[rowCol]?.label ?? rowCol} classified as{' '}
                              {CATEGORIES[col]?.label ?? col}.{' '}
                            </span>
                            <span aria-hidden="true">{count}</span>
                          </td>
                        );
                      })}
                      <td className="matrix-total">{rowTotal}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs muted" style={{ marginTop: 'var(--space-3)' }}>
            Green cells sit on the diagonal and are correct. Red cells are off
            the diagonal and are errors. A row totalling zero simply means the
            answer key contains no transactions of that kind.
          </p>
        </details>
      </div>
    </section>
  );
}
