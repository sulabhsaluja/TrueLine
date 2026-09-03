/**
 * Report export.
 *
 * PRD 10 requires an exportable audit trail. Exports are writes to new files
 * only — nothing here ever touches an input source, per claude.md section 5.
 */

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next frame so the click has definitely been dispatched.
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/** Escape a value for CSV. Quotes are doubled, and anything risky is quoted. */
function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const COLUMNS = [
  'decided_at',
  'rule',
  'reason_code',
  'group_key',
  'involved_sources',
  'detail',
];

export function exportAuditCsv(auditTrail) {
  const rows = [COLUMNS.join(',')];

  (auditTrail ?? []).forEach((entry) => {
    rows.push(
      COLUMNS.map((col) => {
        if (col === 'involved_sources') {
          const sources = entry.involved_sources ?? [];
          return csvCell(sources.map((s) => `${s.source}:${s.source_ref_id}`).join(' | '));
        }
        return csvCell(entry[col]);
      }).join(',')
    );
  });

  download(
    new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' }),
    `audit-trail-${stamp()}.csv`
  );
}

export function exportRunJson({ summary, auditTrail, ingestionWarnings, aiNarrative }) {
  const payload = {
    exported_at: new Date().toISOString(),
    note: 'Reconciliation report. Source files were read only and never modified.',
    summary,
    ingestion_warnings: ingestionWarnings ?? [],
    ai_narrative: aiNarrative ?? null,
    ai_narrative_disclaimer:
      'The narrative is a language-model reading aid generated from the summary figures after matching completed. It is not a source of truth and made no match or exception decision.',
    audit_trail: auditTrail ?? [],
  };

  download(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    `reconciliation-report-${stamp()}.json`
  );
}
