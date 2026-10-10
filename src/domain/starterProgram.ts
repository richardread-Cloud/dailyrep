// The Starter Program offered to a new Lifter: a 3-day full-body Cycle for strength and size.
export interface StarterTemplate {
  name: string;
  slots: { exerciseId: string; sets: number }[];
}

export const STARTER_PROGRAM: StarterTemplate[] = [
  { name: 'Full Body A', slots: [
    { exerciseId: 'back-squat', sets: 3 }, { exerciseId: 'bench-press', sets: 3 }, { exerciseId: 'barbell-row', sets: 3 },
    { exerciseId: 'db-lateral-raise', sets: 3 }, { exerciseId: 'triceps-pushdown', sets: 2 }] },
  { name: 'Full Body B', slots: [
    { exerciseId: 'romanian-deadlift', sets: 3 }, { exerciseId: 'overhead-press', sets: 3 }, { exerciseId: 'lat-pulldown', sets: 3 },
    { exerciseId: 'lying-leg-curl', sets: 3 }, { exerciseId: 'db-curl', sets: 2 }] },
  { name: 'Full Body C', slots: [
    { exerciseId: 'deadlift', sets: 3 }, { exerciseId: 'incline-db-press', sets: 3 }, { exerciseId: 'seated-cable-row', sets: 3 },
    { exerciseId: 'leg-press', sets: 3 }, { exerciseId: 'face-pull', sets: 2 }] },
];
