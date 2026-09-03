/**
 * Single source of truth for classification categories.
 *
 * PRD 6.3 defines exactly five exception categories plus MATCHED. Badges, the
 * exceptions chart, the legend and the audit table all read from this file, so
 * a category can never be shown in one colour here and a different colour
 * there. The previous build had DATE_MISMATCH rendering blue in the chart and
 * amber in the badge, which actively misleads a reader cross-referencing them.
 *
 * There is deliberately no OTHER / catch-all entry. claude.md section 5: a
 * missing category is a missing rule, not a reason for a junk drawer.
 */

export const CATEGORY_ORDER = [
  'MATCHED',
  'AMOUNT_MISMATCH',
  'DATE_MISMATCH',
  'MISSING_COUNTERPART',
  'DUPLICATE_CANDIDATE',
  'UNRESOLVED',
];

export const EXCEPTION_ORDER = CATEGORY_ORDER.filter((c) => c !== 'MATCHED');

/**
 * `tone` maps to the token families in tokens.css (--tone-<name>-*).
 * `label` is the human-facing string. `hint` explains the rule that fired, so
 * every status on screen can explain itself without the reader opening the code.
 */
export const CATEGORIES = {
  MATCHED: {
    label: 'Matched',
    tone: 'positive',
    hint: 'Counterpart found in another source within tolerance.',
  },
  AMOUNT_MISMATCH: {
    label: 'Amount mismatch',
    tone: 'critical',
    hint: 'Same reference, amount differs beyond the rounding tolerance.',
  },
  DATE_MISMATCH: {
    label: 'Date mismatch',
    tone: 'caution',
    hint: 'Same reference and amount, date falls outside the settlement lag window.',
  },
  MISSING_COUNTERPART: {
    label: 'Missing counterpart',
    tone: 'violet',
    hint: 'Record appears in one source only.',
  },
  DUPLICATE_CANDIDATE: {
    label: 'Duplicate candidate',
    tone: 'cyan',
    hint: 'More than one plausible match found — ambiguous, needs a human.',
  },
  UNRESOLVED: {
    label: 'Unresolved',
    tone: 'neutral',
    hint: 'No plausible match found by any rule.',
  },
};

/** Match reason codes from PRD 6.2. These describe *how* a match was made. */
export const REASON_CODES = {
  EXACT: { label: 'Exact', hint: 'Same amount and same reference ID.' },
  FUZZY_AMOUNT: { label: 'Fuzzy amount', hint: 'Amount within rounding tolerance.' },
  FUZZY_DATE: { label: 'Fuzzy date', hint: 'Date within the settlement lag window.' },
  FUZZY_BOTH: { label: 'Fuzzy both', hint: 'Amount and date both within tolerance.' },
};

/**
 * Resolve any reason_code or category string to display metadata.
 * Unknown values are surfaced verbatim with a neutral tone rather than being
 * silently relabelled — an unrecognised code is information, not noise.
 */
export function describeCode(code) {
  if (!code) {
    return { label: 'Unknown', tone: 'neutral', hint: 'No reason code recorded.' };
  }
  if (CATEGORIES[code]) return CATEGORIES[code];
  if (REASON_CODES[code]) return { ...REASON_CODES[code], tone: 'positive' };
  return {
    label: code,
    tone: 'neutral',
    hint: 'Code not recognised by the frontend — shown verbatim.',
  };
}

/** CSS custom-property reference for a tone, for use by charts (JS -> SVG fill). */
export function toneVar(tone) {
  return `var(--tone-${tone}-ink)`;
}
