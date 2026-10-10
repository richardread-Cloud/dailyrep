// Double Progression for one Exercise, run when a Session is finished.
// Ported from prototypes/progression-PROTOTYPE.html; the rules are recorded in docs/adr/0001.

export interface ProgressState {
  /** Weight for the next Session; for a Bodyweight Exercise it is the load added on top (0 = bodyweight only). */
  targetWeight: number;
  /** Best average reps per Working Set achieved at the current target weight. */
  best: number | null;
  /** Consecutive Sessions without progress. */
  stallCount: number;
}

export interface Rules {
  repMin: number;
  repMax: number;
  increment: number;
  /** Reps-only Exercises never change weight. */
  repsOnly?: boolean;
}

export interface WorkSet {
  weight: number;
  reps: number;
  rir: number | null;
}

export type OutcomeKind = 'up' | 'hold' | 'prog' | 'none' | 'deload' | 'top' | 'stall';

export interface Outcome {
  kind: OutcomeKind;
  /** Short label, e.g. "Weight up to 82.5 kg". */
  summary: string;
  /** One or two plain sentences on why. */
  detail: string;
  avgReps: number;
  next: ProgressState;
}

export const STALL_LIMIT = 3;

const r2 = (x: number) => Math.round(x * 100) / 100;
export const roundTo = (x: number, inc: number) => r2(Math.round(x / inc) * inc);
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const defaultFmt = (w: number) => `${r2(w)} kg`;

/** Weight after a Deload: about 10% off, rounded to the Increment, and always at least one Increment lighter. */
export function deloadWeight(weight: number, increment: number): number {
  return r2(Math.max(0, Math.min(roundTo(weight * 0.9, increment), weight - increment)));
}

export function evaluate(
  state: ProgressState,
  rules: Rules,
  sets: WorkSet[],
  plannedSets: number,
  fmt: (w: number) => string = defaultFmt,
): Outcome {
  const tw = state.targetWeight;
  const dropped = sets.some((s) => s.weight < tw);
  const complete = sets.length >= plannedSets;
  const atTarget = sets.filter((s) => s.weight >= tw);
  const avgReps = atTarget.length ? avg(atTarget.map((s) => s.reps)) : 0;
  const allAtTop = !dropped && complete && sets.every((s) => s.reps >= rules.repMax);
  const lastRir = sets.length ? sets[sets.length - 1].rir : null;
  const improved = !dropped && complete && (state.best === null || avgReps > state.best);
  const bestTxt = state.best === null ? 'your first session at this weight' : `your best of ${r2(state.best)}`;

  // Reps-only: the weight never moves. Topping the range or stalling only produces a prompt.
  if (rules.repsOnly) {
    const stallCount = improved ? 0 : state.stallCount + 1;
    const best = improved ? avgReps : state.best;
    if (allAtTop) {
      return { kind: 'top', avgReps, summary: 'Top of the rep range',
        detail: `Every set reached ${rules.repMax}. Raise the rep range or move to a harder exercise.`,
        next: { targetWeight: tw, best, stallCount: 0 } };
    }
    if (stallCount >= STALL_LIMIT) {
      return { kind: 'stall', avgReps, summary: 'Stalled',
        detail: `${STALL_LIMIT} sessions without more reps. Try a lower rep range or an easier variation for a while.`,
        next: { targetWeight: tw, best, stallCount: 0 } };
    }
    return improved
      ? { kind: 'prog', avgReps, summary: 'Progress: more reps', detail: `Average ${r2(avgReps)} reps a set beats ${bestTxt}.`, next: { targetWeight: tw, best, stallCount } }
      : { kind: 'none', avgReps, summary: `No progress (${stallCount} of ${STALL_LIMIT})`, detail: `Average ${r2(avgReps)} reps a set didn't beat ${bestTxt}.`, next: { targetWeight: tw, best, stallCount } };
  }

  if (allAtTop && lastRir !== 0) {
    const w = r2(tw + rules.increment);
    return { kind: 'up', avgReps, summary: `Weight up to ${fmt(w)}`,
      detail: `Every set reached ${rules.repMax} reps${lastRir === null ? '' : ` with ${lastRir} left on the last set`}. Next time aim for ${rules.repMin}+ reps at ${fmt(w)}.`,
      next: { targetWeight: w, best: null, stallCount: 0 } };
  }

  let stallCount = improved ? 0 : state.stallCount + 1;
  let best = improved ? avgReps : state.best;
  let kind: OutcomeKind, summary: string, detail: string;
  if (allAtTop) {
    kind = 'hold'; summary = 'Held: last set went to failure';
    detail = `Every set reached ${rules.repMax}, but the last set was all-out (RIR 0). Stay at ${fmt(tw)} one more session.`;
  } else if (dropped) {
    kind = 'none'; summary = `No progress (${stallCount} of ${STALL_LIMIT})`;
    detail = `You dropped the weight during the session. The target stays ${fmt(tw)}.`;
  } else if (!complete) {
    kind = 'none'; summary = `No progress (${stallCount} of ${STALL_LIMIT})`;
    detail = `Only ${sets.length} of ${plannedSets} sets were logged.`;
  } else if (improved) {
    kind = 'prog'; summary = 'Progress: more reps';
    detail = `Average ${r2(avgReps)} reps a set beats ${bestTxt}. Stay at ${fmt(tw)} and keep adding reps.`;
  } else {
    kind = 'none'; summary = `No progress (${stallCount} of ${STALL_LIMIT})`;
    detail = `Average ${r2(avgReps)} reps a set didn't beat ${bestTxt}.`;
  }
  let targetWeight = tw;
  if (stallCount >= STALL_LIMIT) {
    targetWeight = deloadWeight(tw, rules.increment);
    kind = 'deload';
    summary = `Deload to ${fmt(targetWeight)}`;
    detail = `${STALL_LIMIT} sessions in a row without progress. Drop to ${fmt(targetWeight)}, aim for ${rules.repMin}+ reps and build back up.`;
    best = null;
    stallCount = 0;
  }
  return { kind, summary, detail, avgReps, next: { targetWeight, best, stallCount } };
}

/** Changing the Rep Range keeps the weight, clamps the best into the new range and resets the stall count. */
export function withRepRange(state: ProgressState, repMin: number, repMax: number): ProgressState {
  const best = state.best === null ? null : Math.min(Math.max(state.best, repMin), repMax);
  return { ...state, best, stallCount: 0 };
}

/** Setting a new target by hand starts fresh at that weight. */
export function withTarget(targetWeight: number): ProgressState {
  return { targetWeight, best: null, stallCount: 0 };
}

/** A Set below the Rep Range with sets still to go offers a Drop of one Increment for the rest of the Session. */
export function shouldOfferDrop(reps: number, repMin: number, setsLogged: number, plannedSets: number): boolean {
  return reps < repMin && setsLogged < plannedSets;
}

/** Estimated 1RM (Epley). */
export const estimate1RM = (weight: number, reps: number) => (reps <= 1 ? weight : weight * (1 + reps / 30));
