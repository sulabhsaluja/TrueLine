import { motion } from 'motion/react';
import { Sparkles, AlertCircle, Info } from 'lucide-react';
import { OPERATE } from '../lib/motion';

/**
 * Groq narrative summary.
 *
 * PRD 6.4 requires this be "clearly labeled as a summary, not a source of
 * truth for the underlying match decisions". The previous card carried no such
 * label at all, which on a surface being judged for finance-ops trust is the
 * difference between a helpful aid and a liability. The disclaimer below is
 * therefore permanent furniture, not an error state.
 *
 * Note the three distinct terminal states. The previous implementation pulsed
 * a skeleton forever whenever narrative and error were both null, which is
 * exactly what happens when the Groq layer is disabled — an idle app looking
 * like a hung one.
 */
export function AiSummaryCard({ narrative, error, isPending = false }) {
  return (
    <section className="panel ai-panel" aria-labelledby="ai-summary-heading">
      <header className="panel-header">
        <div className="row">
          <Sparkles size={15} style={{ color: 'var(--accent)' }} aria-hidden="true" />
          <h2 className="title-sm" id="ai-summary-heading">Plain-English summary</h2>
        </div>
        <span className="badge" data-tone="neutral">Generated</span>
      </header>

      <div className="panel-body">
        {isPending ? (
          <div className="stack stack-3" aria-hidden="true">
            <div className="skeleton-line" />
            <div className="skeleton-line" />
            <div className="skeleton-line" />
          </div>
        ) : error ? (
          <div className="callout" data-tone="caution">
            <AlertCircle size={15} className="callout-icon" aria-hidden="true" />
            <div>
              <div className="callout-title">Summary unavailable</div>
              <p className="text-sm">{error}</p>
              <p className="text-sm muted" style={{ marginTop: 'var(--space-2)' }}>
                The reconciliation itself is unaffected — matching is rule-based
                and never calls a model. Every figure and every row below was
                produced without this layer.
              </p>
            </div>
          </div>
        ) : narrative ? (
          <motion.p
            className="ai-body"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: OPERATE.duration, ease: OPERATE.ease }}
          >
            {narrative}
          </motion.p>
        ) : (
          <p className="text-sm muted">
            No summary was generated for this run. The Groq layer is optional and
            sits outside the matching path.
          </p>
        )}
      </div>

      <footer className="panel-note">
        <span className="row" style={{ alignItems: 'flex-start' }}>
          <Info size={13} aria-hidden="true" style={{ marginTop: 2 }} />
          <span>
            Written by a language model from the summary figures only. It is a
            reading aid, <strong>not</strong> a source of truth. No match or
            exception decision on this page was made by a model — see the audit
            trail for the rule that produced each one.
          </span>
        </span>
      </footer>
    </section>
  );
}
