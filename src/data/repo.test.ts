import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import {
  acceptStarterProgram, activeSession, addToTemplate, archiveExercise, createCustomExercise, cycle, deleteSet, ensureExercises, exerciseHistory,
  exercisesWithoutTarget, exportAll, finishSession, getSettings, importAll, lastSessionSets, logSet, removeEmptySessions, resolveUnplanned, saveTemplate,
  sessionSets, setTarget, shortSessions, startSession, swapSlot, trainingReport, unplannedExercises, unusedExercises, updateCustomExercise,
  updateExerciseSettings, updateSet,
} from './repo';
import { libraryExercise, registerCustomExercises } from '../lib/library';

/** Start a Session that began half an hour ago, so it's long enough to count when finished. */
async function start(templateId: string): Promise<string> {
  const id = await startSession(templateId);
  await db.sessions.update(id, { startedAt: Date.now() - 30 * 60_000 });
  return id;
}

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
    const sid = await start(templates[0].id);
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
    const first = await start(a.id);
    await logSet(first, 'bench-press', 60, 8, null);
    await logSet(first, 'bench-press', 60, 7, 1);
    await finishSession(first);
    const second = await start(a.id);
    await logSet(second, 'bench-press', 60, 9, null);
    const last = await lastSessionSets('bench-press', second);
    expect(last.map((x) => x.reps)).toEqual([8, 7]);
    expect((await exerciseHistory('bench-press')).map((h) => h.topWeight)).toEqual([60]);
  });

  it('a swapped exercise progresses on its own and leaves the original alone', async () => {
    await acceptStarterProgram();
    const [a] = await cycle();
    const sid = await start(a.id);
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
    const sid = await start(a.id);
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

describe('empty sessions', () => {
  it('finishing with no sets deletes the session and keeps the Cycle where it was', async () => {
    await acceptStarterProgram();
    const [a] = await cycle();
    const sid = await start(a.id);
    expect(await finishSession(sid)).toEqual([]);
    expect(await db.sessions.get(sid)).toBeUndefined();
    expect((await getSettings()).nextTemplate).toBe(0);
  });

  it('deleting the last set of a finished session deletes the session', async () => {
    await acceptStarterProgram();
    const [a] = await cycle();
    const sid = await start(a.id);
    const s1 = await logSet(sid, 'bench-press', 60, 8, null);
    const s2 = await logSet(sid, 'bench-press', 60, 8, null);
    await finishSession(sid);
    await deleteSet(s1.id);
    expect(await db.sessions.get(sid)).toBeDefined();
    await deleteSet(s2.id);
    expect(await db.sessions.get(sid)).toBeUndefined();
  });

  it('clears out empty finished sessions but leaves the one in progress', async () => {
    await acceptStarterProgram();
    const [a] = await cycle();
    await db.sessions.put({ id: 'old', templateId: a.id, templateName: a.name, startedAt: 1, finishedAt: 2, plan: [], ui: {} as never });
    const live = await start(a.id);
    await removeEmptySessions();
    expect(await db.sessions.get('old')).toBeUndefined();
    expect(await db.sessions.get(live)).toBeDefined();
  });
});

describe('sessions under a minute', () => {
  it("can't be finished, so they never touch progression or the Cycle", async () => {
    await acceptStarterProgram();
    const [a] = await cycle();
    await setTarget('back-squat', 80);
    const sid = await startSession(a.id);
    for (const reps of [8, 8, 8]) await logSet(sid, 'back-squat', 80, reps, null);
    await expect(finishSession(sid)).rejects.toThrow('under a minute');
    expect((await db.exercises.get('back-squat'))?.targetWeight).toBe(80);
    expect((await getSettings()).nextTemplate).toBe(0);
  });

  it("old ones don't count in the export, or as an earlier session for a Baseline", async () => {
    await acceptStarterProgram();
    const [a] = await cycle();
    await setTarget('bench-press', 60);
    // A session finished within seconds, from before they were refused.
    await db.sessions.put({ id: 'quick', templateId: a.id, templateName: a.name, startedAt: 1000, finishedAt: 5000, plan: [], ui: {} as never });
    await db.sets.put({ id: 'q1', sessionId: 'quick', exerciseId: 'bench-press', n: 1, weight: 60, reps: 8, rir: null, loggedAt: 2000 });
    expect((await shortSessions()).map((s) => s.id)).toEqual(['quick']);

    const sid = await start(a.id);
    for (const reps of [6, 6, 5]) await logSet(sid, 'bench-press', 60, reps, null);
    expect((await finishSession(sid))[0]).toMatchObject({ kind: 'baseline', summary: 'Baseline' });
    expect(await trainingReport()).toContain('1 finished session,');
  });
});

describe('Baseline', () => {
  it('only the first session of an Exercise is a Baseline', async () => {
    await acceptStarterProgram();
    const [a] = await cycle();
    await setTarget('bench-press', 60);
    const one = await start(a.id);
    for (const reps of [6, 6, 5]) await logSet(one, 'bench-press', 60, reps, null);
    expect((await finishSession(one))[0].kind).toBe('baseline');
    const two = await start(a.id);
    for (const reps of [7, 6, 6]) await logSet(two, 'bench-press', 60, reps, null);
    expect((await finishSession(two))[0].kind).toBe('prog');
  });
});

describe('program and log mismatches', () => {
  it('a one-off Swap leaves the program alone and is labelled a substitution in the export', async () => {
    await acceptStarterProgram();
    const [a] = await cycle();
    const sid = await start(a.id);
    await swapSlot(sid, 1, 'db-bench-press');
    expect((await db.templates.get(a.id))?.slots[1].exerciseId).toBe('bench-press');
    await setTarget('db-bench-press', 24);
    await logSet(sid, 'db-bench-press', 24, 10, null);
    await finishSession(sid);
    expect(await trainingReport()).toContain('Dumbbell Bench Press (substitution for Bench Press)');
  });

  it('a permanent Swap changes the program too', async () => {
    await acceptStarterProgram();
    const [a] = await cycle();
    const sid = await start(a.id);
    await swapSlot(sid, 1, 'db-bench-press', true);
    expect((await db.templates.get(a.id))?.slots[1]).toEqual({ exerciseId: 'db-bench-press', sets: 3 });
    expect((await db.sessions.get(sid))?.plan[1]).toEqual({ exerciseId: 'db-bench-press', sets: 3 });
  });

  it('finds sets logged outside the plan and settles them one-off or permanently', async () => {
    await acceptStarterProgram();
    const [a] = await cycle();
    const sid = await start(a.id);
    await logSet(sid, 'back-squat', 80, 8, null);
    const moved = await logSet(sid, 'bench-press', 60, 8, null);
    await finishSession(sid);
    await updateSet(moved.id, { exerciseId: 'db-bench-press' });   // corrected in History

    const [u] = await unplannedExercises(sid);
    expect(u.exerciseId).toBe('db-bench-press');
    expect(u.unlogged).toContain('bench-press');

    await resolveUnplanned(sid, 'db-bench-press', 'bench-press', false);
    expect((await db.sessions.get(sid))?.plan[1]).toEqual({ exerciseId: 'db-bench-press', sets: 3, swappedFrom: 'bench-press' });
    expect((await db.templates.get(a.id))?.slots[1].exerciseId).toBe('bench-press');
    expect(await unplannedExercises(sid)).toEqual([]);
  });

  it('a permanent fix replaces the Exercise in the program', async () => {
    await acceptStarterProgram();
    const [a] = await cycle();
    const sid = await start(a.id);
    const x = await logSet(sid, 'bench-press', 60, 8, null);
    await finishSession(sid);
    await updateSet(x.id, { exerciseId: 'db-bench-press' });
    await resolveUnplanned(sid, 'db-bench-press', 'bench-press', true);
    expect((await db.templates.get(a.id))?.slots[1].exerciseId).toBe('db-bench-press');
  });

  it('flags trained Exercises that are in no workout, until archived or added back', async () => {
    await acceptStarterProgram();
    const [a, b] = await cycle();
    await ensureExercises(['hip-thrust', 'leg-extension']);
    await setTarget('hip-thrust', 100);   // has a target: flagged; leg-extension was only looked at: not flagged
    expect((await unusedExercises()).map((e) => e.id)).toEqual(['hip-thrust']);
    await archiveExercise('hip-thrust');
    expect(await unusedExercises()).toEqual([]);
    await addToTemplate(b.id, 'hip-thrust');
    expect((await db.exercises.get('hip-thrust'))?.archived).toBe(false);
    expect((await db.templates.get(b.id))?.slots.at(-1)).toEqual({ exerciseId: 'hip-thrust', sets: 3 });
    expect(a).toBeDefined();
  });

  it('lists programmed Exercises with no target weight', async () => {
    await acceptStarterProgram();
    expect(await exercisesWithoutTarget()).toContain('back-squat');
    await setTarget('back-squat', 80);
    expect(await exercisesWithoutTarget()).not.toContain('back-squat');
  });
});

describe('correcting logged sets', () => {
  it('fixes weight, reps and RIR without touching the Target', async () => {
    await acceptStarterProgram();
    const [a] = await cycle();
    await setTarget('back-squat', 80);
    const sid = await start(a.id);
    const s1 = await logSet(sid, 'back-squat', 80, 8, null);
    await finishSession(sid);
    const target = (await db.exercises.get('back-squat'))?.targetWeight;
    await updateSet(s1.id, { weight: 85, reps: 6, rir: 1 });
    expect(await db.sets.get(s1.id)).toMatchObject({ weight: 85, reps: 6, rir: 1 });
    expect((await db.exercises.get('back-squat'))?.targetWeight).toBe(target);
    await expect(updateSet(s1.id, { reps: 2.5 })).rejects.toThrow('whole number');
  });

  it('moves a set to another exercise and renumbers both', async () => {
    await acceptStarterProgram();
    const [a] = await cycle();
    const sid = await start(a.id);
    const s1 = await logSet(sid, 'bench-press', 60, 8, null);
    const s2 = await logSet(sid, 'bench-press', 60, 8, null);
    const s3 = await logSet(sid, 'bench-press', 60, 7, null);
    await finishSession(sid);
    await updateSet(s2.id, { exerciseId: 'dip' });
    expect(await db.exercises.get('dip')).toBeDefined();
    expect((await sessionSets(sid, 'bench-press')).map((x) => [x.id, x.n])).toEqual([[s1.id, 1], [s3.id, 2]]);
    expect((await sessionSets(sid, 'dip')).map((x) => [x.id, x.n])).toEqual([[s2.id, 1]]);
    await deleteSet(s1.id);
    expect((await sessionSets(sid, 'bench-press')).map((x) => [x.id, x.n])).toEqual([[s3.id, 1]]);
  });
});

describe('training report', () => {
  it('lists current targets, the program and every finished session’s sets', async () => {
    await acceptStarterProgram();
    const [a] = await cycle();
    await setTarget('back-squat', 80);
    const sid = await start(a.id);
    await logSet(sid, 'back-squat', 80, 8, 2);
    await logSet(sid, 'back-squat', 80, 7, null);
    await finishSession(sid);
    await start(a.id);   // unfinished: left out

    const text = await trainingReport();
    expect(text).toContain('1 finished session,');
    expect(text).toMatch(/\| Back Squat \| Legs \| 80 kg \| \d+–\d+ \| 2\.5 kg \| 0 \|/);
    expect(text).toContain('80 kg × 7 → Baseline');
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
