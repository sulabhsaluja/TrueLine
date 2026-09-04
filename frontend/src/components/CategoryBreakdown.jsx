import { useState } from 'react';
import { EXCEPTION_ORDER, CATEGORIES } from '../lib/categories';

export function CategoryBreakdown({ categories }) {
  const [expanded, setExpanded] = useState(null);

  if (!categories) return null;

  // Find max count to scale the horizontal bars
  const maxCount = Math.max(
    ...EXCEPTION_ORDER.map(key => categories[key]?.count ?? 0)
  );

  return (
    <div className="field-notes">
      <div className="field-notes-header mono-text">EXCEPTION FIELD NOTES</div>
      <ul className="taxonomy-list">
        {EXCEPTION_ORDER.map((key, index) => {
          const entry = categories[key] ?? { count: 0, percentage: 0 };
          const isEmpty = entry.count === 0;
          const isExpanded = expanded === key;
          
          const barWidth = maxCount > 0 ? (entry.count / maxCount) * 100 : 0;
          const numLabel = `0${index + 1}`;

          return (
            <li 
              key={key} 
              className={`taxonomy-item ${isExpanded ? 'is-expanded' : ''} ${isEmpty ? 'is-empty' : ''}`}
              onClick={() => setExpanded(isExpanded ? null : key)}
            >
              <div className="taxonomy-row">
                <span className="taxonomy-marker">{numLabel}</span>
                <span className="taxonomy-name mono-text">{CATEGORIES[key].label || key}</span>
                <span className="taxonomy-count tabular-nums">{entry.count}</span>
              </div>
              
              {!isEmpty && (
                <div className="taxonomy-bar-container">
                  <div className="taxonomy-bar" style={{ width: `${barWidth}%` }}></div>
                </div>
              )}
              
              {isExpanded && (
                <div className="taxonomy-detail mono-text">
                  {CATEGORIES[key].hint}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
