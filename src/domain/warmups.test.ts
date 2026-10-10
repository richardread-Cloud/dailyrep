import { describe, expect, it } from 'vitest';
import { warmupSets } from './warmups';

describe('warm-up ramp', () => {
  it('ramps from the empty bar to about 85% of the target', () => {
    expect(warmupSets(80, 2.5, 'kg', 'barbell')).toEqual([
      { weight: 20, reps: 10 }, { weight: 40, reps: 8 }, { weight: 55, reps: 5 }, { weight: 67.5, reps: 3 }]);
  });

  it('rounds to the exercise increment', () => {
    expect(warmupSets(100, 5, 'kg', 'barbell').map((s) => s.weight)).toEqual([20, 50, 70, 85]);
  });

  it('only for barbell exercises with a target above the bar', () => {
    expect(warmupSets(20, 2.5, 'kg', 'barbell')).toEqual([]);
    expect(warmupSets(null, 2.5, 'kg', 'barbell')).toEqual([]);
    expect(warmupSets(30, 2, 'kg', 'dumbbell')).toEqual([]);
  });

  it('uses a 45 lb bar in pounds', () => {
    expect(warmupSets(185, 5, 'lb', 'barbell')[0]).toEqual({ weight: 45, reps: 10 });
  });
});
