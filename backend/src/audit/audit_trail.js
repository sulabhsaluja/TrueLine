'use strict';

const fs = require('node:fs');

function buildAuditTrail(classifiedRecords) {
  const trail = [];
  for (let i = 0; i < classifiedRecords.length; i++) {
    const item = classifiedRecords[i];
    if (item.audit_entry) {
      // Normalize existing
      const entry = Object.assign({}, item.audit_entry);
      if (entry.tolerance_detail) {
        entry.detail = entry.tolerance_detail;
        delete entry.tolerance_detail;
      } else {
        entry.detail = item.detail; // fallback if no tolerance_detail
      }
      trail.push(entry);
    } else {
      // Fallback
      trail.push({
        rule: item.category,
        group_key: null,
        involved_sources: [{ source: item.record.source, source_ref_id: item.record.source_ref_id }],
        decided_at: new Date().toISOString(),
        reason_code: item.category,
        detail: item.detail
      });
    }
  }
  return trail;
}

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function auditTrailToCSV(auditTrail) {
  const headers = ['rule', 'group_key', 'involved_sources', 'decided_at', 'reason_code', 'detail'];
  const rows = [headers.join(',')];
  
  for (let i = 0; i < auditTrail.length; i++) {
    const entry = auditTrail[i];
    const row = [
      escapeCSV(entry.rule),
      escapeCSV(entry.group_key),
      escapeCSV(entry.involved_sources.map(s => s.source + ':' + s.source_ref_id).join('|')),
      escapeCSV(entry.decided_at),
      escapeCSV(entry.reason_code),
      escapeCSV(entry.detail)
    ];
    rows.push(row.join(','));
  }
  return rows.join('\n');
}

function exportAuditTrailJSON(auditTrail, filepath) {
  fs.writeFileSync(filepath, JSON.stringify(auditTrail, null, 2), 'utf8');
}

function exportAuditTrailCSV(auditTrail, filepath) {
  const csvStr = auditTrailToCSV(auditTrail);
  fs.writeFileSync(filepath, csvStr, 'utf8');
}

module.exports = {
  buildAuditTrail,
  auditTrailToCSV,
  exportAuditTrailJSON,
  exportAuditTrailCSV
};
