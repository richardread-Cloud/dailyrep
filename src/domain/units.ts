export type Unit = 'kg' | 'lb';
export type Equipment = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight';

const r2 = (x: number) => Math.round(x * 100) / 100;

export const barWeight = (unit: Unit) => (unit === 'kg' ? 20 : 45);

/** Library increments are in kg; pick the matching common step in lb. */
export function defaultIncrement(kgIncrement: number | null, unit: Unit): number {
  if (kgIncrement === null) return 0;
  if (unit === 'kg') return kgIncrement;
  return kgIncrement >= 5 ? 10 : 5;
}

export function fmtNum(w: number): string {
  return String(r2(w));
}

/** "80 kg", or for a Bodyweight Exercise "Bodyweight" / "BW + 5 kg". */
export function fmtWeight(w: number, unit: Unit, equipment?: Equipment): string {
  if (equipment === 'bodyweight') return w > 0 ? `BW + ${fmtNum(w)} ${unit}` : 'Bodyweight';
  return `${fmtNum(w)} ${unit}`;
}
