import { useEffect, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CheckCircle2 } from 'lucide-react';
import { CATEGORIES, EXCEPTION_ORDER } from '../lib/categories';
import { readCssVar } from '../lib/motion';

/**
 * Exceptions breakdown.
 *
 * Colours are read from the token layer at runtime rather than hardcoded here.
 * That is the fix for a real defect in the previous build: the chart drew
 * DATE_MISMATCH in blue while the badge for the same category was amber, and
 * MISSING_COUNTERPART was amber in the chart but purple as a badge. A reader
 * cross-referencing the two would have been misled.
 */

function ChartTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const share = total > 0 ? ((point.value / total) * 100).toFixed(1) : '0.0';

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-name">{point.label}</div>
      <div className="chart-tooltip-meta">
        {point.value} record{point.value === 1 ? '' : 's'} · {share}% of exceptions
      </div>
    </div>
  );
}

export function ExceptionsChart({ categories }) {
  const [palette, setPalette] = useState({});

  // Resolve the tone tokens to concrete values once mounted. Recharts writes
  // fills as SVG attributes, where var() is not reliably honoured.
  useEffect(() => {
    const next = {};
    EXCEPTION_ORDER.forEach((key) => {
      const tone = CATEGORIES[key].tone;
      next[key] = readCssVar(`--tone-${tone}-ink`, '#5a6470');
    });
    setPalette(next);
  }, []);

  const data = useMemo(() => {
    if (!categories) return [];
    return EXCEPTION_ORDER
      .filter((key) => (categories[key]?.count ?? 0) > 0)
      .map((key) => ({
        key,
        label: CATEGORIES[key].label,
        tone: CATEGORIES[key].tone,
        hint: CATEGORIES[key].hint,
        value: categories[key].count,
        percentage: categories[key].percentage,
      }));
  }, [categories]);

  const totalExceptions = data.reduce((sum, d) => sum + d.value, 0);

  if (data.length === 0) {
    return (
      <div className="empty-state">
        <CheckCircle2 size={22} className="empty-state-icon" aria-hidden="true" />
        <div className="empty-state-title">No exceptions in this batch</div>
        <p className="text-sm">
          Every ingested record found a counterpart within tolerance. Worth
          confirming against the ground-truth key before treating this as a
          clean close.
        </p>
      </div>
    );
  }

  return (
    <div className="chart-layout">
      <div className="chart-frame">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={94}
              paddingAngle={2}
              stroke="var(--paper-raised)"
              strokeWidth={2}
              /* Single sweep on mount, then static. A donut that re-animates
                 while someone is reading it is noise, not clarity. */
              isAnimationActive
              animationDuration={520}
              animationBegin={120}
            >
              {data.map((entry) => (
                <Cell key={entry.key} fill={palette[entry.key] ?? '#5a6470'} />
              ))}
            </Pie>
            <Tooltip
              content={<ChartTooltip total={totalExceptions} />}
              cursor={false}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="chart-center">
          <span className="chart-center-value">{totalExceptions}</span>
          <span className="label">Exceptions</span>
        </div>
      </div>

      {/* The legend carries the counts and the rule that fired, so the panel is
          fully readable without hovering — and remains readable in print. */}
      <ul className="legend">
        {data.map((entry) => (
          <li key={entry.key} className="legend-item" data-tone={entry.tone}>
            <span className="legend-swatch" aria-hidden="true" />
            <span>
              <span style={{ fontWeight: 500 }}>{entry.label}</span>
              <br />
              <span className="text-xs faint">{entry.hint}</span>
            </span>
            <span className="legend-count">{entry.value}</span>
            <span className="legend-pct">{entry.percentage}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
