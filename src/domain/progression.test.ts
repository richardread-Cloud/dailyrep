import { describe, expect, it } from 'vitest';
import { deloadWeight, evaluate, shouldOfferDrop, withRepRange, type ProgressState, type Rules, type WorkSet } from './progression';

const BENCH: Rules = { repMin: 8, repMax: 12, increment: 2.5 };
const LATERAL: Rules = { repMin: 10, repMax: 15, increment: 2 };

// Run a series of Sessions; each is a list of reps (at the current target) with an optional RIR on the last set.
function run(start: number, rules: Rules, sessions: (number[] | [number[], number])[], planned = 3) {
  let state: ProgressState = { targetWeight: start, best: null, stallCount: 0 };
  const kinds: string[] = [];
  for (const s of sessions) {
    const [reps, lastRir] = Array.isArray(s[0]) ? (s as [number[], number]) : [s as number[], null];
    const sets: WorkSet[] = reps.map((r, i) => ({ weight: state.targetWeight, reps: r, rir: i === reps.length - 1 ? lastRir : null }));
    const out = evaluate(state, rules, sets, planned === 3 ? reps.length : planned);
    kinds.push(out.kind);
    state = out.next;
  }
  return { state, kinds };
}

describe('Double Progression (scenarios accepted in the prototype)', () => {
  it('happy path: weight goes up only when every set hits the top', () => {
    const { state, kinds } = run(60, BENCH, [[10, 9, 8], [11, 10, 9], [12, 11, 10], [12, 12, 12], [9, 8, 8]]);
    expect(kinds).toEqual(['prog', 'prog', 'prog', 'up', 'prog']);
    expect(state.targetWeight).toBe(62.5);
  });

  it('ground to failure: RIR 0 on the last set holds the weight', () => {
    const { state, kinds } = run(60, BENCH, [[11, 11, 10], [[12, 12, 12], 0], [[12, 12, 12], 1]]);
    expect(kinds).toEqual(['prog', 'hold', 'up']);
    expect(state.targetWeight).toBe(62.5);
  });

  it('always grinding: repeated holds that match the best eventually deload', () => {
    const { state, kinds } = run(60, BENCH, [[11, 11, 10], [[12, 12, 12], 0], [[12, 12, 12], 0], [[12, 12, 12], 0], [[12, 12, 12], 0]]);
    expect(kinds).toEqual(['prog', 'hold', 'hold', 'hold', 'deload']);
    expect(state.targetWeight).toBe(55);
  });

  it('three bad weeks: stall then deload about 10%', () => {
    const { state, kinds } = run(60, BENCH, [[10, 9, 8], [9, 9, 8], [10, 8, 8], [9, 9, 8]]);
    expect(kinds).toEqual(['prog', 'none', 'none', 'deload']);
    expect(state).toEqual({ targetWeight: 55, best: null, stallCount: 0 });
  });

  it('mid-session drop counts as no progress and keeps the target', () => {
    const state: ProgressState = { targetWeight: 60, best: 9, stallCount: 0 };
    const out = evaluate(state, BENCH, [{ weight: 60, reps: 9, rir: null }, { weight: 60, reps: 6, rir: null }, { weight: 57.5, reps: 8, rir: null }], 3);
    expect(out.kind).toBe('none');
    expect(out.next).toEqual({ targetWeight: 60, best: 9, stallCount: 1 });
  });

  it('fewer sets today: judged on average reps per set', () => {
    let state: ProgressState = { targetWeight: 60, best: null, stallCount: 0 };
    const sets = (reps: number[]) => reps.map((r) => ({ weight: 60, reps: r, rir: null }));
    state = evaluate(state, BENCH, sets([10, 9, 8]), 3).next;
    const two = evaluate(state, BENCH, sets([10, 9]), 2);
    expect(two.kind).toBe('prog');
    expect(evaluate(two.next, BENCH, sets([10, 9, 9]), 3).kind).toBe('none');
  });

  it('small dumbbells: a deload is always at least one increment', () => {
    const { state } = run(8, LATERAL, [[12, 11, 10], [11, 11, 10], [11, 10, 10], [11, 11, 10]]);
    expect(state.targetWeight).toBe(6);
    expect(deloadWeight(60, 2.5)).toBe(55);
  });

  it('changing the rep range keeps the weight, clamps the best and resets the stall', () => {
    expect(withRepRange({ targetWeight: 60, best: 11, stallCount: 2 }, 5, 8)).toEqual({ targetWeight: 60, best: 8, stallCount: 0 });
  });
});

describe('Bodyweight and Reps-only Exercises', () => {
  it('a Bodyweight Exercise adds weight on top of bodyweight', () => {
    const { state } = run(0, { repMin: 5, repMax: 8, increment: 2.5 }, [[8, 8, 8]]);
    expect(state.targetWeight).toBe(2.5);
  });

  it('a Reps-only Exercise never changes weight; topping the range prompts instead', () => {
    const rules: Rules = { repMin: 10, repMax: 20, increment: 0, repsOnly: true };
    const { state, kinds } = run(0, rules, [[15, 14, 12], [20, 20, 20]]);
    expect(kinds).toEqual(['prog', 'top']);
    expect(state.targetWeight).toBe(0);
  });

  it('a Reps-only stall shows a notice instead of a deload', () => {
    const rules: Rules = { repMin: 10, repMax: 20, increment: 0, repsOnly: true };
    const { state, kinds } = run(0, rules, [[15, 15, 15], [14, 14, 14], [15, 14, 14], [15, 15, 15]]);
    expect(kinds.at(-1)).toBe('stall');
    expect(state).toEqual({ targetWeight: 0, best: 15, stallCount: 0 });
  });
});

describe('Drop offer', () => {
  it('offers a drop only below the range with sets still to go', () => {
    expect(shouldOfferDrop(6, 8, 2, 3)).toBe(true);
    expect(shouldOfferDrop(6, 8, 3, 3)).toBe(false);
    expect(shouldOfferDrop(8, 8, 1, 3)).toBe(false);
  });
});
