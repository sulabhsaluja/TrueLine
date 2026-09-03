import { motion } from 'motion/react';
import CountUpPkg from 'react-countup';
const CountUp = CountUpPkg.default ?? CountUpPkg;
import { useCalmMotion } from '../lib/motion';

/**
 * A single headline figure.
 *
 * Figures are set in tabular numerals so a column of them aligns on the
 * decimal, and so a digit changing during count-up does not reflow the card.
 */
export function StatCard({ label, value, suffix = '', decimals = 0, caption, tone, delay = 0 }) {
  const calm = useCalmMotion();
  const isNumeric = typeof value === 'number' && Number.isFinite(value);

  return (
    <motion.div
      className="stat-card"
      data-tone={tone}
      initial={calm ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1], delay: calm ? 0 : delay }}
    >
      <span className="label">{label}</span>
      <span className="figure stat-value">
        {isNumeric && !calm ? (
          <CountUp end={value} decimals={decimals} duration={0.9} delay={delay} preserveValue />
        ) : (
          isNumeric ? value.toFixed(decimals) : value
        )}
        {suffix && <span className="stat-suffix">{suffix}</span>}
      </span>
      {caption && <span className="stat-caption">{caption}</span>}
    </motion.div>
  );
}
