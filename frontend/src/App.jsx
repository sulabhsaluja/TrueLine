import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Toaster, toast } from 'react-hot-toast';
import { RefreshCw } from 'lucide-react';
import { UploadDropzone } from './components/UploadDropzone';
import { ResultsView } from './components/ResultsView';

export default function App() {
  const [files, setFiles] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFilesReady = useCallback((next) => {
    setFiles(next);
    setError(null);
  }, []);

  const run = useCallback(async () => {
    if (!files) return;

    setIsRunning(true);
    setError(null);

    const body = new FormData();
    body.append('bank', files.bank);
    body.append('ledger', files.ledger);
    body.append('gateway', files.gateway);

    try {
      const response = await fetch('/api/reconcile', { method: 'POST', body });
      
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        throw new Error('The server replied with something that was not JSON. Is the API running?');
      }

      if (!response.ok) {
        throw new Error(payload?.error ?? `The server returned ${response.status}.`);
      }

      setResult(payload);
      toast.success('Reconciliation complete');
    } catch (err) {
      const message = err?.message ?? 'The reconciliation could not be completed.';
      setError(message);
      toast.error(message);
    } finally {
      setIsRunning(false);
    }
  }, [files]);

  const reset = useCallback(() => {
    setResult(null);
    setFiles(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <main className="app-shell">
      <div className="blueprint-grid" aria-hidden="true" />
      
      {/* 1. TOP BAR */}
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand-lockup">
            <div className="brand-mark">
              <img src="/logo.jpeg" alt="TrueLine Logo" className="brand-logo" />
            </div>
            <div className="brand-text">
              <div className="brand-name">TRUE<span className="coral">·</span>LINE</div>
              <div className="brand-sub">FINANCE CONTROL / 026</div>
            </div>
          </div>
          <div className="status-lockup">
            <span className="status-dot"></span>
            <span className="status-text">ENGINE ONLINE</span>
          </div>
        </div>
      </header>

      {/* 2. HERO */}
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-eyebrow">
            <div className="coral-line"></div>
            <span>DETERMINISTIC RECONCILIATION WORKSPACE</span>
          </div>
          <h1 className="hero-headline">
            Make every<br/>
            <span className="coral marker-text">cent</span> accountable.
          </h1>
          <p className="hero-body">
            A finance controller’s second set of eyes. Drop three source files, trace every decision, and ship a clean batch with confidence.
          </p>
          <div className="hero-meta">
            <div className="meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
              EXPLAINABLE BY DESIGN
            </div>
            <div className="meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
              AI SUMMARY LAYER
            </div>
          </div>
        </div>
        <div className="hero-diagram">
          <div className="orbit-stage">
            <div className="orbit"></div>
            <div className="orbit-two"></div>
            <div className="orbit-center">
              <span className="marker-text sigma">∑</span>
              <div className="center-text">TRACE<br/>EVERYTHING</div>
            </div>
            <div className="orbit-node node-a marker-text">$</div>
            <div className="orbit-node node-b marker-text">✓</div>
            <div className="orbit-node node-c marker-text">#</div>
          </div>
        </div>
      </section>

      {/* 3. FEED SECTION */}
      <section className="workspace">
        <div className="section-kicker">
          <span className="kicker-num">01</span>
          <div className="kicker-text">
            <span className="kicker-title">FEED THE CONTROL ROOM</span>
            <span className="kicker-subtitle">CSV sources / normalized on ingest</span>
          </div>
          <hr className="kicker-rule" />
        </div>

        <UploadDropzone 
          onFilesReady={handleFilesReady} 
          files={files} 
          onRun={run} 
          isRunning={isRunning} 
        />
        
        {error && (
          <div className="error-callout">
            <strong>Reconciliation failed:</strong> {error}
          </div>
        )}
      </section>

      {/* 4. RESULTS SECTION */}
      <AnimatePresence>
        {result && (
          <motion.section 
            className="results"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <div className="section-kicker" style={{ marginTop: '42px' }}>
              <span className="kicker-num">02</span>
              <div className="kicker-text">
                <span className="kicker-title">BATCH READOUT</span>
                <span className="kicker-subtitle">audited / explainable / ready for review</span>
              </div>
              <hr className="kicker-rule" />
              <button className="btn-new-batch" onClick={reset}>
                <RefreshCw size={14} /> NEW BATCH
              </button>
            </div>

            <ResultsView result={result} />
          </motion.section>
        )}
      </AnimatePresence>

      {/* 5. FOOTER */}
      <footer>
        <div className="footer-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            TRUE·LINE / BUILT FOR THE LAST MILE OF CLOSE
            <div style={{ marginTop: '8px', opacity: 0.8 }}>
              <a href="mailto:support@reconagent.local" style={{ color: 'inherit', textDecoration: 'underline', marginRight: '16px' }}>support@reconagent.local</a>
              <a href="tel:+18005550199" style={{ color: 'inherit', textDecoration: 'underline' }}>+1 (800) 555-0199</a>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>RULES: REF + AMOUNT ±1 + DATE ±2D</div>
        </div>
      </footer>

      <Toaster position="bottom-center" toastOptions={{
        style: { background: 'var(--ink)', color: 'var(--paper)', fontSize: '14px', borderRadius: '4px' }
      }} />
    </main>
  );
}
