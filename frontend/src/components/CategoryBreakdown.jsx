import { EXCEPTION_ORDER, CATEGORIES } from '../lib/categories';
import { StatusBadge } from './Badge';

/**
 * The exception list, broken down by category.
 *
 * Every one of the five PRD 6.3 categories is listed on every run, including
 * the ones with a count of zero. The chart necessarily hides empty slices, so
 * without this a reader could not tell the difference between "this category
 * found nothing" and "this tool does not have that category" — and confirming
 * the five categories all exist is exactly what claude.md section 5 is about.
 */
export function CategoryBreakdown({ categories, totalRows }) {
  if (!categories) return null;

  const exceptionTotal = EXCEPTION_ORDER.reduce(
    (sum, key) => sum + (categories[key]?.count ?? 0),
    0
  );

  return (
    <div className="breakdown">
      <table className="breakdown-table">
        <caption className="visually-hidden">
          Every exception category defined by the specification, with the number
          of records that landed in it.
        </caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col" className="num">Records</th>
            <th scope="col" className="num">Share of batch</th>
          </tr>
        </thead>
        <tbody>
          {EXCEPTION_ORDER.map((key) => {
            const entry = categories[key] ?? { count: 0, percentage: 0 };
            const isEmpty = entry.count === 0;

            return (
              <tr key={key} className={isEmpty ? 'is-empty' : undefined}>
                <th scope="row">
                  <StatusBadge code={key} />
                  <span className="breakdown-hint">{CATEGORIES[key].hint}</span>
                </th>
                <td className="num figure">{entry.count}</td>
                <td className="num figure muted">{entry.percentage}%</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">All exceptions</th>
            <td className="num figure">{exceptionTotal}</td>
            <td className="num figure muted">
              {totalRows > 0 ? ((exceptionTotal / totalRows) * 100).toFixed(2) : '0.00'}%
            </td>
          </tr>
        </tfoot>
      </table>

      <p className="text-xs muted" style={{ marginTop: 'var(--space-3)' }}>
        Five categories, fixed. Nothing is ever filed under a catch-all — a
        record the rules cannot explain becomes <em>Unresolved</em>, which is a
        named outcome that demands review, not a junk drawer.
      </p>
    </div>
  );
}
