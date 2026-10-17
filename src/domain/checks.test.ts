import { describe, expect, it } from 'vitest';
import { setWarnings, targetWarning, type SetCheckInput } from './checks';

const fmt = (w: number) => `${w} kg`;
const base: SetCheckInput = { weight: 60, reps: 8, target: 60, repMin: 6, otherReps: [], first: false };

describe('"Check this?" warnings', () => {
  it('a normal set has none', () => {
    expect(setWarnings({ ...base, otherReps: [8, 7] }, fmt)).toEqual([]);
  });

  it('flags a weight under 20% or over 200% of the target', () => {
    expect(setWarnings({ ...base, weight: 10 }, fmt)).toHaveLength(1);
    expect(setWarnings({ ...base, weight: 125 }, fmt)[0]).toContain('125 kg');
    expect(setWarnings({ ...base, weight: 12 }, fmt)).toEqual([]);
    expect(setWarnings({ ...base, weight: 120 }, fmt)).toEqual([]);
  });

  it("doesn't compare a Bodyweight Exercise's added load or a missing target", () => {
    expect(setWarnings({ ...base, weight: 200, bodyweight: true }, fmt)).toEqual([]);
    expect(setWarnings({ ...base, weight: 200, target: null }, fmt)).toEqual([]);
  });

  it('flags reps more than 50% away from the other sets (5, 5, 10)', () => {
    expect(setWarnings({ ...base, reps: 10, otherReps: [5, 5] }, fmt)[0]).toContain('very different');
    expect(setWarnings({ ...base, reps: 7, otherReps: [5, 5] }, fmt)).toEqual([]);
    expect(setWarnings({ ...base, reps: 2, otherReps: [5, 5] }, fmt)).toHaveLength(1);
  });

  it('suggests lowering the target when a first session is below the range', () => {
    expect(setWarnings({ ...base, reps: 4, first: true }, fmt)[0]).toContain('lowering the target');
    expect(setWarnings({ ...base, reps: 4, first: false }, fmt)).toEqual([]);
  });

  it('flags a hand-typed target far from the current one', () => {
    expect(targetWarning(600, 60, fmt)).toContain('600 kg');
    expect(targetWarning(70, 60, fmt)).toBeNull();
    expect(targetWarning(600, null, fmt)).toBeNull();
  });
});
