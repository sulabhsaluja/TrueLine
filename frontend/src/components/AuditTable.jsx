import { Fragment, useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import { format, isValid } from 'date-fns';
import { ChevronDown, ChevronRight, Search, ArrowUpDown, SearchX } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { StatusBadge } from './Badge';
import { OPERATE, useCalmMotion } from '../lib/motion';

/**
 * Audit trail.
 *
 * Rendered as a real <table>. The previous implementation built a div grid
 * wrapped in @tanstack/react-virtual, which caused three problems at once:
 * expanded detail was absolutely positioned inside a virtual row and so
 * overlapped the rows beneath it; sort controls were divs with onClick and
 * emoji arrows, unreachable by keyboard and silent to screen readers; and no
 * assistive technology announced the thing as a table at all.
 *
 * Virtualization was measured against the real fixture: 177 audit entries for
 * a 60-transaction batch. That is far below the point where virtualization
 * earns its complexity, so it is gone. If batch sizes grow by an order of
 * magnitude this is the place to reconsider — see MAX_RENDERED below, which
 * keeps a pathological batch from locking the tab.
 */

const MAX_RENDERED = 500;

function formatTime(value) {
  const date = new Date(value);
  return isValid(date) ? format(date, 'HH:mm:ss') : '—';
}

export function AuditTable({ data }) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState([]);
  const [expanded, setExpanded] = useState({});
  // A height collapse is precisely the movement vestibular users ask to avoid,
  // and MotionConfig's reduced-motion handling covers transform and layout but
  // not an explicit height tween. Guarded here directly.
  const calm = useCalmMotion();

  const rowsData = useMemo(() => data ?? [], [data]);

  const columns = useMemo(
    () => [
      {
        accessorKey: 'decided_at',
        header: 'Time',
        cell: (info) => <span className="cell-time">{formatTime(info.getValue())}</span>,
      },
      {
        accessorKey: 'reason_code',
        header: 'Rule',
        cell: (info) => <StatusBadge code={info.getValue()} />,
      },
      {
        accessorKey: 'group_key',
        header: 'Group Key',
        cell: (info) => {
          const value = info.getValue();
          return value
            ? <code className="mono cell-key">{value}</code>
            : <span className="faint">—</span>;
        },
      },
      {
        accessorKey: 'involved_sources',
        header: 'Sources',
        enableSorting: false,
        cell: (info) => {
          const sources = info.getValue() ?? [];
          if (sources.length === 0) return <span className="faint text-xs">None recorded</span>;
          return (
            <ul className="source-list">
              {sources.map((s, i) => (
                <li key={i}>
                  <span className="source-name">{s.source}</span>
                  <span className="source-ref">{s.source_ref_id}</span>
                </li>
              ))}
            </ul>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: rowsData,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const allRows = table.getRowModel().rows;
  const rows = allRows.slice(0, MAX_RENDERED);
  const truncated = allRows.length - rows.length;

  const toggleRow = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div>
      <div className="table-toolbar">
        <label className="field">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Filter by rule, key or reference…"
            aria-label="Filter the audit trail"
          />
        </label>
        <span className="result-count" role="status" aria-live="polite">
          {allRows.length === rowsData.length
            ? `${rowsData.length} decisions`
            : `${allRows.length} of ${rowsData.length} decisions`}
        </span>
      </div>

      {allRows.length === 0 ? (
        <div className="empty-state">
          <SearchX size={22} className="empty-state-icon" aria-hidden="true" />
          <div className="empty-state-title">Nothing matches that filter</div>
          <p className="text-sm">
            {rowsData.length} decisions were logged in this run.
          </p>
        </div>
      ) : (
        <div className="data-table-scroll">
          <table className="data-table">
            <caption className="visually-hidden">
              Audit trail: every match and exception decision, the rule that
              produced it, and the source records involved.
            </caption>
            <thead>
              <tr>
                {table.getHeaderGroups()[0].headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  const ariaSort =
                    sorted === 'asc' ? 'ascending'
                    : sorted === 'desc' ? 'descending'
                    : 'none';

                  return (
                    <th key={header.id} scope="col" aria-sort={canSort ? ariaSort : undefined}>
                      {canSort ? (
                        <button
                          type="button"
                          className="th-sort"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <ArrowUpDown size={11} className="th-sort-icon" aria-hidden="true" />
                        </button>
                      ) : (
                        <span className="th-static">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                      )}
                    </th>
                  );
                })}
                <th scope="col">
                  <span className="th-static visually-hidden">Detail</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const isOpen = Boolean(expanded[row.id]);
                const detailId = `audit-detail-${row.id}`;
                const original = row.original ?? {};

                return (
                  <Fragment key={row.id}>
                    <tr
                      className={`is-interactive${isOpen ? ' is-expanded' : ''}`}
                      onClick={() => toggleRow(row.id)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                      <td>
                        {/* The button is the real control: it carries the
                            keyboard affordance and the aria wiring. The row
                            click is a convenience on top of it. */}
                        <button
                          type="button"
                          className="btn-icon"
                          aria-expanded={isOpen}
                          aria-controls={detailId}
                          onClick={(e) => { e.stopPropagation(); toggleRow(row.id); }}
                        >
                          {isOpen
                            ? <ChevronDown size={14} aria-hidden="true" />
                            : <ChevronRight size={14} aria-hidden="true" />}
                          <span className="visually-hidden">
                            {isOpen ? 'Hide' : 'Show'} decision detail
                          </span>
                        </button>
                      </td>
                    </tr>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <tr id={detailId}>
                          <td colSpan={columns.length + 1} className="detail-cell">
                            <motion.div
                              initial={calm ? false : { height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={calm ? { opacity: 0 } : { height: 0, opacity: 0 }}
                              transition={{ duration: calm ? 0 : OPERATE.duration, ease: OPERATE.ease }}
                              style={{ overflow: 'hidden' }}
                            >
                              <div className="detail-inner">
                                <div className="detail-grid">
                                  <div className="detail-item">
                                    <span className="label">Rule applied</span>
                                    <span className="detail-value">{original.rule ?? original.reason_code ?? '—'}</span>
                                  </div>
                                  <div className="detail-item">
                                    <span className="label">Reason code</span>
                                    <span className="detail-value">{original.reason_code ?? '—'}</span>
                                  </div>
                                  <div className="detail-item">
                                    <span className="label">Decided at</span>
                                    <span className="detail-value">{original.decided_at ?? '—'}</span>
                                  </div>
                                  <div className="detail-item">
                                    <span className="label">Group key</span>
                                    <span className="detail-value">{original.group_key ?? '—'}</span>
                                  </div>
                                </div>

                                {original.detail && (
                                  <p className="text-sm" style={{ marginBottom: 'var(--space-4)' }}>
                                    {original.detail}
                                  </p>
                                )}

                                <details>
                                  <summary className="text-xs muted" style={{ cursor: 'pointer', marginBottom: 'var(--space-2)' }}>
                                    Raw audit record
                                  </summary>
                                  <pre className="code-block"><code>{JSON.stringify(original, null, 2)}</code></pre>
                                </details>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {truncated > 0 && (
        <div className="panel-note">
          Showing the first {MAX_RENDERED} of {allRows.length} matching decisions.
          Narrow the filter to see the rest — nothing has been dropped, the full
          set is in the exported audit trail.
        </div>
      )}
    </div>
  );
}
