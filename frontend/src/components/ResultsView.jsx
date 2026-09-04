import { useMemo } from 'react';
import { StatCard } from './StatCard';
import { ConvergenceDiagram } from './ConvergenceDiagram';
import { CategoryBreakdown } from './CategoryBreakdown';
import { AiSummaryCard } from './AiSummaryCard';
import { AuditTable } from './AuditTable';

export function ResultsView({ result }) {
  const { summary, auditTrail, aiNarrative, aiNarrativeError } = result;

  const volume = summary?.source_volume ?? {};
  const matchRate = summary?.match_rate;
  const categories = summary?.categories ?? {};
  
  const totalIngested = volume.total_ingested ?? 0;
  const matched = matchRate?.matched ?? 0;
  const matchPct = matchRate?.percentage ?? 0;
  
  // Calculate total exceptions from categories
  const totalExceptions = Object.values(categories).reduce((acc, cat) => acc + (cat.count || 0), 0);

  return (
    <div className="results-container">
      <div className="results-grid">
        <div className="results-col-left">
          <AiSummaryCard narrative={aiNarrative} error={aiNarrativeError} />
          <ConvergenceDiagram summary={summary} />
        </div>
        <div className="results-col-right">
          <div className="metrics-row">
            <StatCard
              label="ROWS INGESTED"
              value={totalIngested}
              accent={false}
            />
            <StatCard
              label="MATCH RATE"
              value={matchPct}
              suffix="%"
              decimals={1}
              accent={true}
            />
            <StatCard
              label="EXCEPTIONS"
              value={totalExceptions}
              accent={false}
            />
          </div>
          <CategoryBreakdown categories={categories} />
        </div>
      </div>
      
      <div className="results-full-width">
        <AuditTable data={auditTrail} />
      </div>
    </div>
  );
}
