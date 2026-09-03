import { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { useCalmMotion } from '../lib/motion';

/**
 * The signature image: three sources converging into one reconciled line,
 * with the records that refuse to converge peeling off at the join.
 *
 * It is drawn rather than decorated because it is the product's actual claim.
 * A diagram that showed only clean convergence would be a lie about what
 * reconciliation is — the exceptions are the whole job, so they are drawn at
 * the same weight as the match.
 */

const SOURCES = [
  { label: 'Bank statement', y: 58 },
  { label: 'Internal ledger', y: 160 },
  { label: 'Gateway export', y: 262 },
];

const JOIN_X = 520;
const JOIN_Y = 160;

/** Source rail into the join. */
function convergePath(y) {
  return `M 168 ${y} L 330 ${y} C 420 ${y}, 430 ${JOIN_Y}, ${JOIN_X} ${JOIN_Y}`;
}

/** Exceptions peel away after the join. */
const EXCEPTIONS = [
  { d: `M ${JOIN_X} ${JOIN_Y} C 600 ${JOIN_Y}, 620 76, 726 76`, label: 'Amount mismatch' },
  { d: `M ${JOIN_X} ${JOIN_Y} C 600 ${JOIN_Y}, 620 250, 726 250`, label: 'Unresolved' },
];

export function ConvergenceDiagram() {
  const ref = useRef(null);
  const calm = useCalmMotion();
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const active = calm || inView;

  const draw = (delay) =>
    calm
      ? { initial: false, animate: { pathLength: 1, opacity: 1 } }
      : {
          initial: { pathLength: 0, opacity: 0 },
          animate: active ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 },
          transition: {
            pathLength: { duration: 1.1, ease: [0.16, 1, 0.3, 1], delay },
            opacity: { duration: 0.2, delay },
          },
        };

  return (
    <figure className="converge" ref={ref}>
      <svg viewBox="0 0 800 320" role="img" aria-labelledby="converge-title converge-desc">
        <title id="converge-title">How reconciliation resolves three sources</title>
        <desc id="converge-desc">
          Three source rails — bank statement, internal ledger and gateway export —
          converge into a single reconciled line. Two exception paths branch away
          from the join, representing records that could not be matched cleanly.
        </desc>

        {/* Source rails */}
        {SOURCES.map((source, i) => (
          <g key={source.label}>
            <motion.line
              x1="72" y1={source.y} x2="168" y2={source.y}
              className="converge-stub"
              initial={calm ? false : { opacity: 0 }}
              animate={{ opacity: active ? 1 : 0 }}
              transition={{ duration: 0.4, delay: calm ? 0 : i * 0.1 }}
            />
            <motion.path
              d={convergePath(source.y)}
              className="converge-rail"
              {...draw(0.15 + i * 0.12)}
            />
            <motion.text
              x="64" y={source.y + 4}
              textAnchor="end"
              className="converge-label"
              initial={calm ? false : { opacity: 0, x: -6 }}
              animate={active ? { opacity: 1, x: 0 } : { opacity: 0, x: -6 }}
              transition={{ duration: 0.45, delay: calm ? 0 : i * 0.1 }}
            >
              {source.label}
            </motion.text>
          </g>
        ))}

        {/* Exceptions peeling off */}
        {EXCEPTIONS.map((ex, i) => (
          <g key={ex.label}>
            <motion.path d={ex.d} className="converge-exception" {...draw(0.95 + i * 0.12)} />
            <motion.text
              x="736" y={(i === 0 ? 76 : 250) + 4}
              className="converge-label is-exception"
              initial={calm ? false : { opacity: 0 }}
              animate={{ opacity: active ? 1 : 0 }}
              transition={{ duration: 0.4, delay: calm ? 0 : 1.5 + i * 0.1 }}
            >
              {ex.label}
            </motion.text>
          </g>
        ))}

        {/* Reconciled output */}
        <motion.path
          d={`M ${JOIN_X} ${JOIN_Y} L 726 ${JOIN_Y}`}
          className="converge-out"
          {...draw(1.05)}
        />
        <motion.text
          x="736" y={JOIN_Y + 4}
          className="converge-label is-out"
          initial={calm ? false : { opacity: 0 }}
          animate={{ opacity: active ? 1 : 0 }}
          transition={{ duration: 0.4, delay: calm ? 0 : 1.6 }}
        >
          Matched
        </motion.text>

        {/* The join */}
        <motion.circle
          cx={JOIN_X} cy={JOIN_Y} r="7"
          className="converge-node"
          initial={calm ? false : { scale: 0, opacity: 0 }}
          animate={active ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 22, delay: calm ? 0 : 0.85 }}
          style={{ transformOrigin: `${JOIN_X}px ${JOIN_Y}px` }}
        />
      </svg>

      <figcaption className="converge-caption">
        Every record ends somewhere named. Nothing falls through.
      </figcaption>
    </figure>
  );
}
