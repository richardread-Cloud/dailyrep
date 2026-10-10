import { roundTo } from './progression';
import { barWeight, type Equipment, type Unit } from './units';

export interface WarmupSet {
  weight: number;
  reps: number;
}

const RAMP: [number, number][] = [[0.5, 8], [0.7, 5], [0.85, 3]];

/** Warm-up ramp for barbell Exercises: empty bar, then about 50%, 70% and 85% of the target, rounded to the Increment. */
export function warmupSets(target: number | null, increment: number, unit: Unit, equipment: Equipment): WarmupSet[] {
  const bar = barWeight(unit);
  if (equipment !== 'barbell' || target === null || target <= bar) return [];
  const step = increment > 0 ? increment : unit === 'kg' ? 2.5 : 5;
  const list: WarmupSet[] = [{ weight: bar, reps: 10 }];
  for (const [pct, reps] of RAMP) {
    const w = roundTo(target * pct, step);
    if (w > bar && w < target && !list.some((x) => x.weight === w)) list.push({ weight: w, reps });
  }
  return list;
}
