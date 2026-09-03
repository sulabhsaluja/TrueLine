import { CheckCircle2, AlertTriangle, HelpCircle, Copy, FileX, CircleSlash } from 'lucide-react';
import { describeCode, CATEGORIES } from '../lib/categories';

/**
 * Badge — the only way a status is rendered anywhere in this app.
 *
 * Colour comes from data-tone, which resolves against the token layer, so a
 * category cannot be one colour here and another colour in the chart. Every
 * PRD 6.3 category has an explicit branch below: the previous implementation
 * handled four and let DUPLICATE_CANDIDATE and UNRESOLVED fall through to a
 * grey default, which is precisely the junk-drawer behaviour claude.md
 * section 5 forbids.
 */

const ICONS = {
  MATCHED: CheckCircle2,
  AMOUNT_MISMATCH: AlertTriangle,
  DATE_MISMATCH: AlertTriangle,
  MISSING_COUNTERPART: FileX,
  DUPLICATE_CANDIDATE: Copy,
  UNRESOLVED: CircleSlash,
};

export function Badge({ tone = 'neutral', icon: Icon, children, title }) {
  return (
    <span className="badge" data-tone={tone} title={title}>
      {Icon ? <Icon size={11} aria-hidden="true" /> : <span className="badge-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

/**
 * StatusBadge — renders a classification category or a match reason code.
 * Unknown codes are shown verbatim rather than being coerced into a bucket,
 * so an unexpected value from the engine stays visible instead of hiding.
 */
export function StatusBadge({ code }) {
  const meta = describeCode(code);
  const isKnownCategory = Boolean(CATEGORIES[code]);
  const Icon = ICONS[code] ?? HelpCircle;

  return (
    <Badge tone={meta.tone} icon={Icon} title={meta.hint}>
      {isKnownCategory ? meta.label : code}
    </Badge>
  );
}
