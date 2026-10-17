// Non-blocking "Check this?" warnings for a Set being entered or corrected. They never stop the Lifter saving it.

export interface SetCheckInput {
  weight: number;
  reps: number;
  /** The Exercise's Target weight; null when none is set. */
  target: number | null;
  repMin: number;
  /** Reps of the other Sets of this Exercise in the same Session. */
  otherReps: number[];
  /** No earlier finished Session included this Exercise. */
  first: boolean;
  /** Bodyweight Exercises record only the added load, so their weight isn't compared with the Target. */
  bodyweight?: boolean;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Plain-language reasons this Set looks like a typo; empty when it looks fine. */
export function setWarnings(c: SetCheckInput, fmt: (w: number) => string): string[] {
  const out: string[] = [];
  if (!c.bodyweight && c.target !== null && c.target > 0 && (c.weight < c.target * 0.2 || c.weight > c.target * 2)) {
    out.push(`${fmt(c.weight)} is a long way from your target of ${fmt(c.target)}.`);
  }
  if (c.otherReps.length) {
    const typical = median(c.otherReps);
    if (typical > 0 && Math.abs(c.reps - typical) > typical * 0.5) out.push(`${c.reps} reps is very different from your other sets (${c.otherReps.join(', ')}).`);
  }
  if (c.first && c.reps < c.repMin) out.push(`Below ${c.repMin} reps on your first session: consider lowering the target weight.`);
  return out;
}

/** Warning for a new Target typed in by hand, compared with the old one. */
export function targetWarning(next: number, current: number | null, fmt: (w: number) => string): string | null {
  if (current === null || current <= 0) return null;
  return next < current * 0.2 || next > current * 2 ? `${fmt(next)} is a long way from your current target of ${fmt(current)}.` : null;
}
