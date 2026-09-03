import { useRef } from 'react';
import { motion, useInView, useScroll, useTransform } from 'motion/react';
import { ArrowDown, ArrowRight, Play, ShieldCheck, ScrollText, Lock } from 'lucide-react';
import { UploadDropzone } from './UploadDropzone';
import { ConvergenceDiagram } from './ConvergenceDiagram';
import { useCalmMotion, PERSUADE } from '../lib/motion';

/**
 * Landing — Persuade mode.
 *
 * Scroll choreography is deliberate here and deliberately absent on the
 * results page. This surface has to earn a run; that one has to be read while
 * someone reconciles real money.
 *
 * Every claim below is checkable in the source. No invented benchmark numbers,
 * no fabricated customer count — on a finance-controls tool, an unverifiable
 * stat on the landing page undermines the exact thing being sold.
 */

/**
 * Reveal wraps its children in the element the surrounding markup requires,
 * not always a div. A div sitting between <ol> and <li> is invalid HTML and
 * costs the list its semantics in a screen reader, which is a real price to
 * pay for an entrance animation.
 */
const REVEAL_TAGS = {
  div: motion.div,
  li: motion.li,
  article: motion.article,
  section: motion.section,
};

function Reveal({ children, delay = 0, className, as = 'div', y = PERSUADE.distance }) {
  const ref = useRef(null);
  const calm = useCalmMotion();
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const Tag = REVEAL_TAGS[as] ?? motion.div;
  const Plain = as;

  if (calm) return <Plain className={className} ref={ref}>{children}</Plain>;

  return (
    <Tag
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: PERSUADE.duration, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </Tag>
  );
}

const STAGES = [
  {
    n: '01',
    title: 'Ingest',
    body: 'Three source schemas normalised into one shape. A row that will not parse is logged with its line number and reason, and the batch keeps going — it is never dropped in silence.',
  },
  {
    n: '02',
    title: 'Exact match',
    body: 'Reference, amount and date agree across sources. These resolve first and are tagged EXACT, so the cheap certain wins are off the table before anything fuzzy runs.',
  },
  {
    n: '03',
    title: 'Fuzzy match',
    body: 'Amount tolerance, settlement lag and normalised references, applied in that order. Each match carries FUZZY_AMOUNT, FUZZY_DATE or FUZZY_BOTH — you always know which rule bent.',
  },
  {
    n: '04',
    title: 'Classify',
    body: 'Everything still unmatched is filed into exactly one of five named categories. There is no "other" bucket; a record the rules cannot explain becomes Unresolved, which is a decision, not a shrug.',
  },
  {
    n: '05',
    title: 'Report',
    body: 'Batch summary, a status and reason code for every input row, the exception list by category, and an exportable audit trail — measured against a ground-truth key the engine never sees.',
  },
];

const PRINCIPLES = [
  {
    icon: ScrollText,
    title: 'Readable, not clever',
    body: 'The matching logic is plain if/else, top to bottom. No scoring function, no weighted black box. If you cannot read why two records matched, the tool has failed regardless of its accuracy.',
  },
  {
    icon: ShieldCheck,
    title: 'No model decides money',
    body: 'The matching engine makes zero model calls. A language model may write a plain-English summary afterwards, clearly labelled as a reading aid — it never decides whether two records are the same transaction.',
  },
  {
    icon: Lock,
    title: 'Reads only, writes nothing',
    body: 'Source files are opened, never modified. This reconciles and reports; it does not auto-correct. Any future write capability would sit behind an explicit confirmation, never a silent convenience.',
  },
];

export function LandingPage({ onFilesReady, onRun, isRunning, ready, error }) {
  const calm = useCalmMotion();
  const heroRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, calm ? 0 : 64]);
  const heroFade = useTransform(scrollYProgress, [0, 0.8], [1, calm ? 1 : 0.15]);

  const scrollToUpload = () => {
    document.getElementById('upload')?.scrollIntoView({
      behavior: calm ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  const headline = ['Three sources.', 'One reconciled truth.', 'Every row explained.'];

  return (
    <div className="app-shell">
      <header className="masthead is-landing">
        <div className="masthead-inner">
          <div className="masthead-id">
            <span className="masthead-mark" aria-hidden="true" />
            <span className="masthead-title">Reconciliation Control</span>
          </div>
          <button type="button" className="btn btn-secondary" onClick={scrollToUpload}>
            Run a reconciliation
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main id="main" className="page">
        <section className="hero" ref={heroRef}>
          <motion.div className="hero-inner" style={calm ? undefined : { y: heroY, opacity: heroFade }}>
            <motion.span
              className="eyebrow"
              initial={calm ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              Finance controls · Reconciliation
            </motion.span>

            <h1 className="display">
              {headline.map((line, i) => (
                <span className="display-line" key={line}>
                  <motion.span
                    className={i === 2 ? 'is-accent' : undefined}
                    initial={calm ? false : { y: '110%' }}
                    animate={{ y: '0%' }}
                    transition={{
                      duration: 0.85,
                      ease: [0.16, 1, 0.3, 1],
                      delay: calm ? 0 : 0.12 + i * 0.09,
                    }}
                  >
                    {line}
                  </motion.span>
                </span>
              ))}
            </h1>

            <motion.p
              className="lede hero-lede"
              initial={calm ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: calm ? 0 : 0.5 }}
            >
              Bank statement, internal ledger and gateway export, matched by rules
              you can read top to bottom. Every match carries the rule that
              produced it. Every exception lands in one of five named categories.
            </motion.p>

            <motion.div
              className="hero-actions"
              initial={calm ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: calm ? 0 : 0.6 }}
            >
              <button type="button" className="btn btn-primary btn-lg" onClick={scrollToUpload}>
                <Play size={15} aria-hidden="true" />
                Run a reconciliation
              </button>
              <span className="hero-note">Three CSVs · nothing leaves your machine</span>
            </motion.div>

            <motion.ul
              className="hero-facts"
              initial={calm ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: calm ? 0 : 0.75 }}
            >
              <li><strong>5</strong> exception categories</li>
              <li><strong>4</strong> match reason codes</li>
              <li><strong>0</strong> model calls in the matching path</li>
            </motion.ul>
          </motion.div>

          <motion.div
            className="scroll-cue"
            aria-hidden="true"
            initial={calm ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: calm ? 0 : 1.1, duration: 0.5 }}
          >
            <ArrowDown size={14} />
          </motion.div>
        </section>

        <section className="section section-converge" aria-labelledby="converge-heading">
          <Reveal>
            <h2 className="title-lg" id="converge-heading">
              Reconciliation is mostly about what <em>doesn&rsquo;t</em> match.
            </h2>
            <p className="lede section-lede">
              Matching the clean majority is the easy part. The value is in
              naming the remainder precisely enough that someone can act on it
              before close.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <ConvergenceDiagram />
          </Reveal>
        </section>

        <section className="section" aria-labelledby="pipeline-heading">
          <Reveal>
            <h2 className="title-lg" id="pipeline-heading">Five stages, in order</h2>
            <p className="lede section-lede">
              Each stage hands the next a smaller, better-understood pile. Nothing
              is revisited once decided, and every decision is written down.
            </p>
          </Reveal>

          <ol className="pipeline">
            {STAGES.map((stage, i) => (
              <Reveal as="li" className="pipeline-step" key={stage.n} delay={i * 0.06}>
                <span className="pipeline-n figure">{stage.n}</span>
                <div>
                  <h3 className="title-sm">{stage.title}</h3>
                  <p className="text-sm">{stage.body}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </section>

        <section className="section" aria-labelledby="principles-heading">
          <Reveal>
            <h2 className="title-lg" id="principles-heading">What it refuses to do</h2>
            <p className="lede section-lede">
              Constraints are the product. A reconciliation tool earns trust by
              what it will not quietly do on your behalf.
            </p>
          </Reveal>

          <div className="principle-grid">
            {PRINCIPLES.map((p, i) => (
              <Reveal as="article" className="principle" key={p.title} delay={i * 0.08}>
                <p.icon size={18} className="principle-icon" aria-hidden="true" />
                <h3 className="title-sm">{p.title}</h3>
                <p className="text-sm">{p.body}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="section section-upload" id="upload" aria-labelledby="upload-heading">
          <Reveal>
            <h2 className="title-lg" id="upload-heading">Reconcile a batch</h2>
            <p className="lede section-lede">
              Drop the three CSVs. Files are routed by name — anything with{' '}
              <span className="mono">bank</span>, <span className="mono">ledger</span> or{' '}
              <span className="mono">gateway</span> in the filename lands in the
              right slot.
            </p>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="upload-card">
              <UploadDropzone onFilesReady={onFilesReady} />

              {error && (
                <div className="callout" data-tone="critical" style={{ marginTop: 'var(--space-5)' }}>
                  <div>
                    <div className="callout-title">Reconciliation failed</div>
                    <p className="text-sm">{error}</p>
                    <p className="text-sm muted" style={{ marginTop: 'var(--space-2)' }}>
                      Your files were not modified. Fix the issue and run again.
                    </p>
                  </div>
                </div>
              )}

              <div className="upload-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  onClick={onRun}
                  disabled={!ready || isRunning}
                >
                  {isRunning ? (
                    <>
                      <span className="spinner" aria-hidden="true" />
                      Reconciling…
                    </>
                  ) : (
                    <>
                      <Play size={15} aria-hidden="true" />
                      Reconcile
                    </>
                  )}
                </button>
                <span className="text-sm muted" role="status" aria-live="polite">
                  {isRunning
                    ? 'Matching in progress — this runs locally and takes well under a second.'
                    : ready
                      ? 'All three sources staged.'
                      : 'Stage all three sources to continue.'}
                </span>
              </div>
            </div>
          </Reveal>
        </section>

        <footer className="page-footer">
          <p className="text-xs muted">
            Source files are read and never modified. Matching is rule-based end
            to end — no model is consulted to decide whether two records are the
            same transaction.
          </p>
        </footer>
      </main>
    </div>
  );
}
