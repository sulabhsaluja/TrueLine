import { useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

/**
 * Motion primitives.
 *
 * Two amplitudes, matching the two modes this app operates in:
 *
 *   PERSUADE (landing) — motion is allowed to be the experience. Larger
 *   travel, spring easing, scroll choreography.
 *
 *   OPERATE (results dashboard) — motion may only clarify. It shows where a
 *   thing came from and that state changed, then gets out of the way. Small
 *   travel, no springs, never loops, never applied to a figure a reader is
 *   trying to read.
 *
 * Every primitive collapses to a plain opacity-1 static render when the user
 * prefers reduced motion, and tokens.css independently clamps all durations.
 * Belt and braces, because the previous build shipped 3D tilt and infinite
 * pulse loops with no accommodation at all.
 */

/* Shared spring/tween vocabulary. Durations are in seconds for motion's API,
   deliberately mirroring the --dur-* tokens in tokens.css. */
export const EASE_OUT = [0.22, 0.61, 0.36, 1];
export const EASE_SPRING = [0.34, 1.42, 0.64, 1];

export const PERSUADE = {
  distance: 28,
  duration: 0.62,
  ease: EASE_SPRING,
  stagger: 0.075,
};

export const OPERATE = {
  distance: 8,
  duration: 0.28,
  ease: EASE_OUT,
  stagger: 0.045,
};

/**
 * True when motion should be suppressed.
 * `useReducedMotion` from motion/react tracks the media query live.
 */
export function useCalmMotion() {
  return useReducedMotion() === true;
}

/**
 * True only for devices with a precise pointer AND no reduced-motion request.
 * Gates pointer-tracking effects (tilt, cursor parallax) that are meaningless
 * on touch and actively unpleasant when a user has asked for less movement.
 */
export function usePointerEffects() {
  const calm = useCalmMotion();
  const [finePointer, setFinePointer] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    setFinePointer(mq.matches);
    const onChange = (e) => setFinePointer(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return finePointer && !calm;
}

/**
 * Variant factory for a container that staggers its children in.
 * Used with <motion.div variants={...} initial="hidden" animate/whileInView="shown">.
 */
export function staggerVariants(mode = OPERATE, { delay = 0 } = {}) {
  return {
    hidden: {},
    shown: {
      transition: { staggerChildren: mode.stagger, delayChildren: delay },
    },
  };
}

export function childVariants(mode = OPERATE) {
  return {
    hidden: { opacity: 0, y: mode.distance },
    shown: {
      opacity: 1,
      y: 0,
      transition: { duration: mode.duration, ease: mode.ease },
    },
  };
}

/**
 * Reveal — animates its children in the first time they enter the viewport.
 *
 * `once: true` is not optional. Re-triggering on every scroll pass is the
 * single most common way scroll animation turns from choreography into
 * seasickness, and on a data surface it would mean numbers re-animating while
 * someone is mid-read.
 */
export function useReveal({ amount = 0.25, once = true } = {}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once, amount });
  return { ref, inView };
}

/**
 * Resolve a CSS custom property to its computed value.
 *
 * Recharts writes colours as SVG attributes, where `var(--x)` is not reliably
 * resolved. Rather than duplicate the palette into JS — which is exactly how
 * the previous build ended up with the chart and the badges disagreeing about
 * what colour DATE_MISMATCH is — read the real computed value from the token
 * layer at runtime. tokens.css stays the single source of truth.
 */
export function readCssVar(name, fallback = '#000000') {
  if (typeof window === 'undefined' || !document?.documentElement) return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}
