import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Toaster, toast } from 'react-hot-toast';
import { LandingPage } from './components/LandingPage';
import { ResultsView } from './components/ResultsView';
import { useCalmMotion } from './lib/motion';

/**
 * App is orchestration only: it owns the staged files, the request, and which
 * of the two views is on screen. Everything visual lives in the views.
 */
export default function App() {
  const [files, setFiles] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const calm = useCalmMotion();

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

      // Parse defensively: a proxy failure or a crash can return HTML, and
      // "Unexpected token < in JSON" tells the user nothing useful.
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        throw new Error(
          response.ok
            ? 'The server replied with something that was not JSON. Is the API running?'
            : `The server returned ${response.status} ${response.statusText}.`
        );
      }

      if (!response.ok) {
        throw new Error(payload?.error ?? `The server returned ${response.status}.`);
      }

      setResult(payload);
      window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });

      const warnings = payload.ingestionWarnings?.length ?? 0;
      if (warnings > 0) {
        toast(`Reconciled with ${warnings} ingestion warning${warnings === 1 ? '' : 's'}.`, {
          icon: '!',
        });
      } else {
        toast.success('Reconciliation complete.');
      }
    } catch (err) {
      const message = err?.message ?? 'The reconciliation could not be completed.';
      setError(message);
      toast.error(message);
    } finally {
      setIsRunning(false);
    }
  }, [files, calm]);

  const reset = useCallback(() => {
    setResult(null);
    setFiles(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const fade = calm
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] },
      };

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>

      <AnimatePresence mode="wait" initial={false}>
        {result ? (
          <motion.div key="results" {...fade}>
            <ResultsView result={result} onReset={reset} />
          </motion.div>
        ) : (
          <motion.div key="landing" {...fade}>
            <LandingPage
              onFilesReady={handleFilesReady}
              onRun={run}
              isRunning={isRunning}
              ready={Boolean(files)}
              error={error}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: 'var(--paper-inverted)',
            color: 'var(--paper)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            padding: '0.7rem 1rem',
          },
        }}
      />
    </>
  );
}
