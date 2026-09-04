import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Play } from 'lucide-react';

const SLOTS = [
  { key: 'bank', label: 'Bank Statement', num: '01' },
  { key: 'ledger', label: 'Internal Ledger', num: '02' },
  { key: 'gateway', label: 'Gateway Export', num: '03' },
];

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function slotForFile(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.includes('bank')) return 'bank';
  if (lower.includes('ledger')) return 'ledger';
  if (lower.includes('gateway')) return 'gateway';
  return null;
}

export function UploadDropzone({ onFilesReady, files, onRun, isRunning }) {
  const [localFiles, setLocalFiles] = useState({});

  const onDrop = useCallback((accepted) => {
    const nextFiles = { ...localFiles };
    accepted.forEach(file => {
      const key = slotForFile(file.name);
      if (key) {
        nextFiles[key] = file;
      }
    });
    setLocalFiles(nextFiles);
  }, [localFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
  });

  const readyCount = SLOTS.filter((s) => localFiles[s.key]).length;
  const allReady = readyCount === SLOTS.length;

  useEffect(() => {
    onFilesReady(allReady ? localFiles : null);
  }, [localFiles, allReady, onFilesReady]);

  // Always render the dropzone container, but change its appearance based on state
  return (
    <div className="upload-container" {...getRootProps()}>
      <input {...getInputProps()} />
      
      {readyCount === 0 ? (
        <div className={`dropzone-area ${isDragActive ? 'is-active' : ''}`}>
          <div className="dropzone-content">
            <div className="mono-text">Drop 3x CSV files</div>
            <div className="muted mono-text" style={{ fontSize: '11px', marginTop: '8px' }}>
              auto-routed by filename
            </div>
          </div>
          <div className="drafting-stamp">CSV 3x</div>
        </div>
      ) : (
        <div className="staged-area">
          <div className="cards-row">
            {SLOTS.map((slot) => {
              const file = localFiles[slot.key];
              return (
                <div key={slot.key} className={`source-card ${file ? 'is-filled' : ''}`}>
                  <div className="card-marker">{slot.num}</div>
                  <div className="card-title">{slot.label}</div>
                  {file ? (
                    <div className="card-file-info">
                      <div className="file-name">{file.name}</div>
                      <div className="file-size">{formatBytes(file.size)}</div>
                    </div>
                  ) : (
                    <div className="card-empty-text">Awaiting {slot.label.toLowerCase()}</div>
                  )}
                </div>
              );
            })}
          </div>
          
          <div className="action-row">
            <button 
              className="btn-run" 
              onClick={(e) => { e.stopPropagation(); onRun(); }}
              disabled={!allReady || isRunning}
            >
              {isRunning ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                <Play size={14} />
              )}
              {isRunning ? 'RUNNING RECONCILIATION...' : 'RUN RECONCILIATION'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
