import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import './index.css';
import App from './App.jsx';

/**
 * The QueryClientProvider and the second Toaster that used to live here are
 * gone: nothing consumed the query client, and two Toaster instances meant
 * every toast rendered twice, in two different positions. App owns the single
 * styled Toaster now.
 *
 * MotionConfig reducedMotion="user" is the safety net. The motion library does
 * not consult the OS preference on its own — without this, honouring it depends
 * on every component remembering to call useCalmMotion, and two of them had
 * already forgotten. This makes the accommodation the default and the
 * per-component guards a refinement rather than the only line of defence.
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);
