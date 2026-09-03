import { useMemo } from 'react';
import {
  ArrowLeft, Download, FileJson, Printer, TriangleAlert, Layers,
} from 'lucide-react';
import { StatCard } from './StatCard';
import { AccuracyPanel } from './AccuracyPanel';
import { ExceptionsChart } from './ExceptionsChart';
import { CategoryBreakdown } from './CategoryBreakdown';
import { AiSummaryCard } from './AiSummaryCard';
import { AuditTable } from './AuditTable';
import { exportAuditCsv, exportRunJson } from '../lib/export';

/**
 * Results — Operate mode.
 *
 * Ordered by what a controller has to decide, not by what looks impressive:
 * how big was the batch, how much of it can I trust, what went wrong, and then
 * the row-level evidence. Motion here is confined to entrance and to state
 * changes the user caused. Nothing on this page moves on its own while
 * someone is reading a number off it.
 */
export function ResultsView({ result, onReset }) {
  const { summary, auditTrail, ingestionWarnings, aiNarrative, aiNarrativeError } = result;

  const volume = summary?.source_volume ?? {};
  const matchRate = summary?.match_rate;
  const divergences = summary?.known_divergences;
  const accuracy = divergences?.ground_truth_match_rate_percentage;

  const sources = useMemo(
    () => [
      { key: 'bank', label: 'Bank', count: volume.bank ?? 0 },
      { key: 'ledger', label: 'Ledger', count: volume.ledger ?? 0 },
      { key: 'gateway', label: 'Gateway', count: volume.gateway ?? 0 },
    ],
    [volume.bank, volume.ledger, volume.gateway]
  );

  const warnings = ingestionWarnings ?? [];

  return (
    <div className="app-shell">
      <header className="masthead">
        <div className="masthead-inner">
          <div className="masthead-id">
            <span className="masthead-mark" aria-hidden="true" />
            <div>
              <span className="masthead-title">Reconciliation report</span>
              <span className="masthead-meta">
                {volume.total_ingested ?? 0} records · {sources.map((s) => `${s.label} ${s.count}`).join(' · ')}
              </span>
            </div>
          </div>

          <div className="masthead-actions">
            <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
              <Printer size={14} aria-hidden="true" />
              Print
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => exportAuditCsv(auditTrail)}>
              <Download size={14} aria-hidden="true" />
              Audit CSV
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => exportRunJson(result)}>
              <FileJson size={14} aria-hidden="true" />
              Full report
            </button>
            <button type="button" className="btn btn-primary" onClick={onReset}>
              <ArrowLeft size={14} aria-hidden="true" />
              New run
            </button>
          </div>
        </div>
      </header>

      <main id="main" className="page page-body stack stack-7">
        <section aria-labelledby="batch-heading">
          <h1 className="title-lg" id="batch-heading">Batch summary</h1>
          <p className="lede">
            Three sources reconciled against one another. Every row below carries
            the rule that decided it.
          </p>

          <div className="stat-grid" style={{ marginTop: 'var(--space-5)' }}>
            <StatCard
              label="Records processed"
              value={volume.total_ingested ?? 0}
              caption={`${sources.map((s) => `${s.count} ${s.label.toLowerCase()}`).join(', ')}`}
              delay={0}
            />
            <StatCard
              label="Matched"
              value={matchRate?.percentage ?? 0}
              suffix="%"
              decimals={2}
              caption={`${matchRate?.matched ?? 0} of ${matchRate?.total_classified ?? 0} rows paired`}
              tone="positive"
              delay={0.06}
            />
            <StatCard
              label="Classification accuracy"
              value={typeof accuracy === 'number' ? accuracy : '—'}
              suffix={typeof accuracy === 'number' ? '%' : ''}
              decimals={2}
              caption={
                typeof accuracy === 'number'
                  ? 'checked against the ground-truth key'
                  : 'no ground-truth key supplied'
              }
              tone={typeof accuracy === 'number' && accuracy < 100 ? 'caution' : undefined}
              delay={0.12}
            />
            <StatCard
              label="Processing time"
              value={summary?.processing_time_ms ?? 0}
              suffix="ms"
              caption="ingest through classification"
              delay={0.18}
            />
          </div>
        </section>

        {warnings.length > 0 && (
          <div className="callout" data-tone="caution">
            <TriangleAlert size={15} className="callout-icon" aria-hidden="true" />
            <div>
              <div className="callout-title">
                {warnings.length} row{warnings.length === 1 ? '' : 's'} could not be ingested
              </div>
              <p className="text-sm">
                The batch continued without them, and they are listed here rather
                than dropped silently. Figures above are calculated on the rows
                that did parse.
              </p>
              <ul className="stack stack-2 text-xs" style={{ margin: 'var(--space-3) 0 0', paddingLeft: '1.1rem' }}>
                {warnings.slice(0, 12).map((w, i) => (
                  <li key={i} className="mono">
                    {typeof w === 'string' ? w : JSON.stringify(w)}
                  </li>
                ))}
              </ul>
              {warnings.length > 12 && (
                <p className="text-xs muted" style={{ marginTop: 'var(--space-2)' }}>
                  {warnings.length - 12} more in the exported report.
                </p>
              )}
            </div>
          </div>
        )}

        <AccuracyPanel knownDivergences={divergences} matchRate={matchRate} />

        <section className="panel" aria-labelledby="exceptions-heading">
          <header className="panel-header">
            <div className="row">
              <Layers size={15} style={{ color: 'var(--accent)' }} aria-hidden="true" />
              <h2 className="title-sm" id="exceptions-heading">Exceptions by category</h2>
            </div>
          </header>
          <div className="panel-body stack stack-6">
            <ExceptionsChart categories={summary?.categories} />
            <CategoryBreakdown
              categories={summary?.categories}
              totalRows={matchRate?.total_classified ?? volume.total_ingested ?? 0}
            />
          </div>
        </section>

        <AiSummaryCard narrative={aiNarrative} error={aiNarrativeError} />

        <section className="panel" aria-labelledby="audit-heading">
          <header className="panel-header">
            <div>
              <h2 className="title-sm" id="audit-heading">Audit trail</h2>
              <p className="text-xs muted" style={{ marginTop: 2 }}>
                Every decision the engine made, in the order it made them.
              </p>
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => exportAuditCsv(auditTrail)}>
              <Download size={14} aria-hidden="true" />
              Export
            </button>
          </header>
          <div className="panel-body">
            <AuditTable data={auditTrail} />
          </div>
        </section>

        <footer className="page-footer">
          <p className="text-xs muted">
            Source files were read and never modified. This tool reports; it does
            not correct. Matching is rule-based end to end — no model was
            consulted to decide whether two records are the same transaction.
          </p>
        </footer>
      </main>
    </div>
  );
}
