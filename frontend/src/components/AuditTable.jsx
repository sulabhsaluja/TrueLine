import { Fragment, useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import { format, isValid } from 'date-fns';
import { Search, ArrowUpDown } from 'lucide-react';

const MAX_RENDERED = 500;

function formatTime(value) {
  const date = new Date(value);
  return isValid(date) ? format(date, 'HH:mm:ss') : '—';
}

function getDecisionPillClass(code) {
  if (!code) return 'pill-matched';
  const c = code.toLowerCase();
  if (c.includes('exception') || c.includes('unresolved') || c.includes('mismatch')) {
    return 'pill-exception';
  }
  return 'pill-matched';
}

function getSourcePillClass(source) {
  if (!source) return '';
  const s = source.toLowerCase();
  if (s.includes('bank')) return 'pill-bank';
  if (s.includes('ledger')) return 'pill-ledger';
  if (s.includes('gateway')) return 'pill-gateway';
  return '';
}

export function AuditTable({ data }) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState([]);

  const rowsData = useMemo(() => data ?? [], [data]);

  const columns = useMemo(
    () => [
      {
        accessorKey: 'decided_at',
        header: 'TIME',
        cell: (info) => formatTime(info.getValue()),
      },
      {
        accessorKey: 'reason_code',
        header: 'DECISION',
        cell: (info) => {
          const val = info.getValue() || 'MATCHED';
          return (
            <span className={`pill ${getDecisionPillClass(val)}`}>
              {val}
            </span>
          );
        },
      },
      {
        accessorKey: 'group_key',
        header: 'GROUP KEY',
        cell: (info) => info.getValue() || '—',
      },
      {
        accessorKey: 'involved_sources',
        header: 'SOURCES',
        enableSorting: false,
        cell: (info) => {
          const sources = info.getValue() ?? [];
          if (sources.length === 0) return 'None recorded';
          return (
            <div className="source-pills">
              {sources.map((s, i) => (
                <span key={i} className={`pill ${getSourcePillClass(s.source)}`}>
                  {s.source_ref_id || s.source}
                </span>
              ))}
            </div>
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

  return (
    <div className="audit-section">
      <div className="audit-header">
        <div className="mono-text" style={{ fontSize: '11px', letterSpacing: '0.05em' }}>
          ROW-LEVEL AUDIT TRAIL
        </div>
        <div className="audit-controls">
          <div className="search-box">
            <Search size={12} className="muted" />
            <input
              className="mono-text"
              type="text"
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Filter rules, keys..."
            />
          </div>
        </div>
      </div>

      <div className="table-scroll-container">
        <table className="blueprint-table">
          <thead>
            <tr>
              {table.getHeaderGroups()[0].headers.map((header) => {
                const canSort = header.column.getCanSort();
                return (
                  <th key={header.id}>
                    {canSort ? (
                      <button
                        className="th-sort-btn mono-text"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <ArrowUpDown size={10} style={{ opacity: 0.5 }} />
                      </button>
                    ) : (
                      <span className="mono-text">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="mono-text">
            {rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
