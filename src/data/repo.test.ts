import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import {
  acceptStarterProgram, activeSession, createCustomExercise, cycle, exerciseHistory, exportAll, finishSession, getSettings, importAll,
  lastSessionSets, logSet, saveTemplate, setTarget, startSession, swapSlot, trainingReport, updateCustomExercise, updateExerciseSettings,
} from './repo';
import { libraryExercise, registerCustomExercises } from '../lib/library';

beforeEach(async () => {
  await db.delete();
  await db.open();
  registerCustomExercises([]);
});

describe('a full session', () => {
  it('starts from the Cycle, logs sets, progresses and moves to the next Template', async () => {
    await acceptStarterProgram();
    const templates = await cycle();
    expect(templates.map((t) => t.name)).toEqual(['Full Body A', 'Full Body B', 'Full Body C']);
    expect((await db.exercises.get('back-squat'))?.targetWeight).toBeNull();
    expect((await db.exercises.get('dip'))).toBeUndefined();

    await setTarget('back-squat', 80);
    const sid = await startSession(templates[0].id);
    expect((await activeSession())?.id).toBe(sid);
    for (const reps of [8, 8, 8]) await logSet(sid, 'back-squat', 80, reps, 2);

    const results = await finishSession(sid);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ exerciseId: 'back-squat', kind: 'up', nextWeight: 82.5 });
    expect((await db.exercises.get('back-squat'))?.targetWeight).toBe(82.5);
    expect((await getSettings()).nextTemplate).toBe(1);
    expect(await activeSession()).toBeUndefined();
  });

  it('shows last session’s sets for an exercise, excluding the current session', async () => {
    await acceptStarterProgram();
    const [a] = await cycle();
    await setTarget('bench-press', 60);
    const first = await startSession(a.id);
    await logSet(first, 'bench-press', 60, 8, null);
    await logSet(first, 'bench-press', 60, 7, 1);
    await finishSession(first);
    const second = await startSession(a.id);
    await logSet(second, 'bench-press', 60, 9, null);
    const last = await lastSessionSets('bench-press', second);
    expect(last.map((x) => x.reps)).toEqual([8, 7]);
    expect((await exerciseHistory('bench-press')).map((h) => h.topWeight)).toEqual([60]);
  });

  it('a swapped exercise progresses on its own and leaves the original alone', async () => {
    await acceptStarterProgram();
    const [a] = await cycle();
    const sid = await startSession(a.id);
    await swapSlot(sid, 1, 'db-bench-press');
    await setTarget('db-bench-press', 24);
    for (const reps of [12, 12, 12]) await logSet(sid, 'db-bench-press', 24, reps, null);
    await finishSession(sid);
    expect((await db.exercises.get('db-bench-press'))?.targetWeight).toBe(26);
    expect((await db.exercises.get('bench-press'))?.targetWeight).toBeNull();
  });
});

describe('custom exercises', () => {
  it('starts from equipment defaults, can be trained and progresses like any other', async () => {
    await acceptStarterProgram();
    const id = await createCustomExercise({ name: '  Hack Squat ', group: 'Legs', equipment: 'machine' });
    expect(libraryExercise(id)).toMatchObject({ name: 'Hack Squat', custom: true, equipment: 'machine' });
    expect(await db.exercises.get(id)).toMatchObject({ repMin: 10, repMax: 15, increment: 5, targetWeight: null });

    const [a] = await cycle();
    await saveTemplate({ ...a, slots: [{ exerciseId: id, sets: 2 }] });
    await setTarget(id, 100);
    // Read from the database, not the in-memory registry, so finishing works even before the app has registered it.
    registerCustomExercises([]);
    const sid = await startSession(a.id);
    for (const reps of [15, 15]) await logSet(sid, id, 100, reps, null);
    expect((await finishSession(sid))[0]).toMatchObject({ exerciseId: id, kind: 'up', nextWeight: 105 });
  });

  it('a reps-only bodyweight exercise never adds weight', async () => {
    const id = await createCustomExercise({ name: 'Bear Crawl', group: 'Core', equipment: 'bodyweight', repsOnly: true });
    expect(libraryExercise(id)).toMatchObject({ repsOnly: true, inc: null });
    expect(await db.exercises.get(id)).toMatchObject({ increment: 0, targetWeight: 0 });
  });

  it('renaming keeps its settings, and it survives a backup', async () => {
    const id = await createCustomExercise({ name: 'Hack Sqat', group: 'Legs', equipment: 'machine' });
    await setTarget(id, 90);
    await updateCustomExercise(id, { name: 'Hack Squat', group: 'Legs' });
    expect(libraryExercise(id)?.name).toBe('Hack Squat');
    const backup = JSON.stringify(await exportAll());
    await db.delete(); await db.open();
    await importAll(backup);
    expect(await db.customExercises.get(id)).toMatchObject({ name: 'Hack Squat' });
    expect((await db.exercises.get(id))?.targetWeight).toBe(90);
  });

  it('rejects a blank name', async () => {
    await expect(createCustomExercise({ name: '  ', group: 'Arms', equipment: 'cable' })).rejects.toThrow('name');
  });
});

describe('training report', () => {
  it('lists current targets, the program and every finished session’s sets', async () => {
    await acceptStarterProgram();
    const [a] = await cycle();
    await setTarget('back-squat', 80);
    const sid = await startSession(a.id);
    await logSet(sid, 'back-squat', 80, 8, 2);
    await logSet(sid, 'back-squat', 80, 7, null);
    await finishSession(sid);
    await startSession(a.id);   // unfinished: left out

    const text = await trainingReport();
    expect(text).toContain('1 finished session,');
    expect(text).toMatch(/\| Back Squat \| Legs \| 80 kg \| \d+–\d+ \| 2\.5 kg \| 1 \|/);
    expect(text).toContain('- **Full Body A**: Back Squat');
    expect(text).toContain('80 kg × 8 @RIR 2, 80 kg × 7');
    expect(text.match(/### /g)).toHaveLength(1);
  });
});

describe('exercise settings and backup', () => {
  it('changing the rep range keeps the target and resets the stall count', async () => {
    await acceptStarterProgram();
    await setTarget('back-squat', 80);
    await db.exercises.update('back-squat', { best: 7.5, stallCount: 2 });
    await updateExerciseSettings('back-squat', { repMin: 3, repMax: 5, increment: 2.5, restSec: 180 });
    expect(await db.exercises.get('back-squat')).toMatchObject({ targetWeight: 80, best: 5, stallCount: 0, repMin: 3, repMax: 5 });
  });

  it('round-trips everything through a backup', async () => {
    await acceptStarterProgram();
    await setTarget('deadlift', 120);
    const backup = JSON.stringify(await exportAll());
    await db.delete(); await db.open();
    await importAll(backup);
    expect((await db.exercises.get('deadlift'))?.targetWeight).toBe(120);
    expect(await db.templates.count()).toBe(3);
    await expect(importAll('{"hello":1}')).rejects.toThrow("isn't a DailyRep backup");
  });
});
