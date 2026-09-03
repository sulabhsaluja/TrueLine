import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { UploadCloud, FileText, X, CheckCircle2, Circle } from 'lucide-react';

const SLOTS = [
  { key: 'bank', label: 'Bank', expects: 'bank_statement.csv', match: 'bank' },
  { key: 'ledger', label: 'Ledger', expects: 'internal_ledger.csv', match: 'ledger' },
  { key: 'gateway', label: 'Gateway', expects: 'gateway_export.csv', match: 'gateway' },
];

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Route a dropped file to a slot by filename. Returns null when nothing matches. */
function slotForFile(fileName) {
  const lower = fileName.toLowerCase();
  const hit = SLOTS.find((slot) => lower.includes(slot.match));
  return hit ? hit.key : null;
}

export function UploadDropzone({ onFilesReady }) {
  const [files, setFiles] = useState({});
  const [previews, setPreviews] = useState({});
  /**
   * Files the user dropped that we could not route anywhere.
   * The previous build discarded these silently. In a tool whose entire pitch
   * is "no silent drops", swallowing a user's file without a word is the one
   * behaviour it cannot afford.
   */
  const [unroutable, setUnroutable] = useState([]);

  const onDrop = useCallback((accepted, rejected = []) => {
    const missed = [];

    accepted.forEach((file) => {
      const key = slotForFile(file.name);
      if (!key) {
        missed.push({ name: file.name, reason: 'Filename must contain bank, ledger or gateway.' });
        return;
      }

      setFiles((prev) => ({ ...prev, [key]: file }));

      Papa.parse(file, {
        header: true,
        preview: 3,
        skipEmptyLines: true,
        complete: (results) => {
          setPreviews((prev) => ({ ...prev, [key]: results.data }));
        },
        error: (err) => {
          // Preview failure must not block the run — the server re-parses
          // authoritatively. Surface it, keep going.
          setPreviews((prev) => ({ ...prev, [key]: null }));
          missed.push({ name: file.name, reason: `Preview unavailable: ${err.message}` });
        },
      });
    });

    rejected.forEach((r) => {
      missed.push({
        name: r.file?.name ?? 'Unknown file',
        reason: r.errors?.[0]?.message ?? 'Rejected — CSV files only.',
      });
    });

    setUnroutable(missed);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
  });

  const readyCount = SLOTS.filter((s) => files[s.key]).length;
  const allReady = readyCount === SLOTS.length;

  /**
   * Report upward on every change, not only when complete. The previous
   * implementation only fired when all three were present, so removing a file
   * left the parent holding a stale complete set.
   */
  useEffect(() => {
    onFilesReady(allReady ? files : null);
  }, [files, allReady, onFilesReady]);

  const removeFile = (key, event) => {
    event.stopPropagation();
    setFiles((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setPreviews((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const status = useMemo(() => {
    if (allReady) return 'All three sources staged. Ready to reconcile.';
    const missing = SLOTS.filter((s) => !files[s.key]).map((s) => s.label).join(', ');
    return `${readyCount} of 3 staged. Still needed: ${missing}.`;
  }, [allReady, files, readyCount]);

  return (
    <div className="stack stack-4">
      <div
        {...getRootProps()}
        className={`dropzone${isDragActive ? ' is-active' : ''}`}
        aria-label="Upload three CSV files: bank statement, internal ledger, gateway export"
      >
        <input {...getInputProps()} />
        <UploadCloud size={26} className="dropzone-icon" aria-hidden="true" />
        <p style={{ fontWeight: 600 }}>Drag and drop your 3 CSV files here</p>
        <p className="text-sm muted">
          or click to browse — files are routed by name
        </p>
      </div>

      {/* Live region: staging progress is announced without stealing focus. */}
      <p className="visually-hidden" role="status" aria-live="polite">{status}</p>

      <div className="slot-grid">
        {SLOTS.map((slot) => {
          const file = files[slot.key];
          const preview = previews[slot.key];
          const columns = preview?.[0] ? Object.keys(preview[0]).slice(0, 3) : [];

          return (
            <div key={slot.key} className={`slot${file ? ' is-filled' : ''}`}>
              <div className="slot-head">
                <span className="slot-name">
                  {file
                    ? <CheckCircle2 size={14} className="slot-icon-ok" aria-hidden="true" />
                    : <Circle size={14} className="slot-icon-wait" aria-hidden="true" />}
                  {slot.label}
                </span>
                {file && (
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={(e) => removeFile(slot.key, e)}
                    aria-label={`Remove ${file.name} from the ${slot.label} slot`}
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                )}
              </div>

              {file ? (
                <>
                  <span className="slot-file">
                    <FileText size={11} aria-hidden="true" />
                    <span className="mono">{file.name}</span>
                  </span>
                  <span className="slot-meta">{formatBytes(file.size)}</span>

                  {columns.length > 0 && (
                    <table className="preview-table">
                      <thead>
                        <tr>{columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr>
                      </thead>
                      <tbody>
                        {preview.map((row, i) => (
                          <tr key={i}>
                            {columns.map((c) => <td key={c}>{row[c]}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              ) : (
                <span className="slot-expect">{slot.expects}</span>
              )}
            </div>
          );
        })}
      </div>

      {unroutable.length > 0 && (
        <div className="callout" data-tone="caution">
          <div>
            <div className="callout-title">
              {unroutable.length} file{unroutable.length === 1 ? '' : 's'} not staged
            </div>
            <ul className="stack stack-2 text-xs" style={{ margin: 0, paddingLeft: '1.1rem' }}>
              {unroutable.map((f, i) => (
                <li key={i}>
                  <span className="mono">{f.name}</span> — {f.reason}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
