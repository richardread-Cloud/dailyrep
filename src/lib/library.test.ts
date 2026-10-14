import { beforeEach, describe, expect, it } from 'vitest';
import { alternatives, LIBRARY, libraryExercise, matchesSearch, registerCustomExercises, type LibraryExercise } from './library';

const ids = (id: string, n = 6) => alternatives(id).slice(0, n).map((e) => e.id);

beforeEach(() => registerCustomExercises([]));

describe('alternatives', () => {
  it('ranks movements for the same main muscles first, across equipment', () => {
    expect(ids('bench-press', 4)).toEqual(['db-bench-press', 'chest-press-machine', 'dip', 'push-up']);
    expect(ids('lying-leg-curl', 3)).toEqual(['seated-leg-curl', 'romanian-deadlift', 'db-romanian-deadlift']);
    expect(ids('db-lateral-raise', 1)).toEqual(['cable-lateral-raise']);
  });

  it('keeps different parts of a muscle apart', () => {
    expect(alternatives('face-pull').map((e) => e.id)).not.toContain('db-lateral-raise');
    expect(alternatives('back-extension').map((e) => e.id)).not.toContain('inverted-row');
  });

  it('always offers a no-barbell option for the big barbell lifts', () => {
    for (const id of ['back-squat', 'bench-press', 'deadlift', 'overhead-press', 'barbell-row', 'barbell-curl']) {
      expect(alternatives(id).some((e) => e.equipment === 'dumbbell' || e.equipment === 'bodyweight'), id).toBe(true);
    }
  });

  it('offers a no-equipment option for every built-in that needs equipment', () => {
    const noKit = (e: LibraryExercise) => e.equipment === 'bodyweight' || !!e.bodyweightOk;
    const missing = LIBRARY.filter((e) => !noKit(e) && !alternatives(e.id).some(noKit)).map((e) => e.id);
    // Side shoulders need some load: nothing in the library trains them with bodyweight alone.
    expect(missing).toEqual(['db-lateral-raise', 'cable-lateral-raise']);
  });

  it('never lists the exercise itself, and every built-in except calf raises has one', () => {
    for (const e of LIBRARY) {
      expect(ids(e.id, 99)).not.toContain(e.id);
      if (e.id !== 'standing-calf-raise') expect(alternatives(e.id).length, e.id).toBeGreaterThan(0);
    }
  });

  it('matches Custom Exercises by muscle group', () => {
    registerCustomExercises([{ id: 'custom-1', name: 'Sled Push', group: 'Legs', equipment: 'machine' }]);
    expect(alternatives('custom-1').every((e) => e.group === 'Legs')).toBe(true);
    expect(alternatives('back-squat').map((e) => e.id)).toContain('custom-1');
  });
});

describe('search', () => {
  it('finds lunges by their other names', () => {
    expect(matchesSearch(libraryExercise('forward-lunge')!, 'front lunge')).toBe(true);
    expect(matchesSearch(libraryExercise('reverse-lunge')!, 'Rear')).toBe(true);
    expect(matchesSearch(libraryExercise('reverse-lunge')!, '')).toBe(true);
  });
});
