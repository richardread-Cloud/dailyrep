import { evaluate, withRepRange, withTarget, type ProgressState } from '../domain/progression';
import { STARTER_PROGRAM } from '../domain/starterProgram';
import { defaultIncrement, fmtNum, fmtWeight, type Unit } from '../domain/units';
import { customExercise, libraryExercise, registerCustomExercise, type CustomDef, type LibraryExercise } from '../lib/library';
import {
  db, type CustomExercise, type ExerciseResult, type ExerciseState, type LoggedSet, type Session, type SessionUi, type Settings, type Slot, type Template,
} from './db';

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const DEFAULT_SETTINGS: Settings = { id: 'me', unit: 'kg', nextTemplate: 0, onboarded: false };

// ---------- settings ----------

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('me')) ?? DEFAULT_SETTINGS;
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  await db.settings.put({ ...(await getSettings()), ...patch });
}

// ---------- exercises ----------

/** A Built-in Exercise, or one of the Lifter's Custom Exercises read straight from the database. */
async function findExercise(id: string): Promise<LibraryExercise | undefined> {
  const lib = libraryExercise(id);
  if (lib) return lib;
  const custom = await db.customExercises.get(id);
  return custom && customExercise(custom);
}

function newExerciseState(lib: LibraryExercise, unit: Unit): ExerciseState {
  const id = lib.id;
  return {
    id,
    repMin: lib.min,
    repMax: lib.max,
    increment: defaultIncrement(lib.inc, unit),
    restSec: lib.rest,
    targetWeight: lib.equipment === 'bodyweight' ? 0 : null,
    best: null,
    stallCount: 0,
    updatedAt: Date.now(),
  };
}

/** Create a Lifter's state for any of these Exercises that don't have one yet. */
export async function ensureExercises(ids: string[]): Promise<void> {
  const { unit } = await getSettings();
  const existing = new Set((await db.exercises.bulkGet(ids)).filter(Boolean).map((e) => e!.id));
  const fresh: ExerciseState[] = [];
  for (const id of new Set(ids)) {
    if (existing.has(id)) continue;
    const lib = await findExercise(id);
    if (!lib) throw new Error(`Unknown exercise: ${id}`);
    fresh.push(newExerciseState(lib, unit));
  }
  if (fresh.length) await db.exercises.bulkPut(fresh);
}

/** Make a Custom Exercise and the Lifter's state for it. Returns its id. */
export async function createCustomExercise(def: Omit<CustomDef, 'id'>): Promise<string> {
  const name = def.name.trim();
  if (!name) throw new Error('Give the exercise a name.');
  const id = `custom-${uid()}`;
  const row: CustomExercise = { ...def, name, id, updatedAt: Date.now() };
  await db.customExercises.put(row);
  registerCustomExercise(row);
  await ensureExercises([id]);
  return id;
}

/** Rename or regroup a Custom Exercise. Its settings, target and history stay as they are. */
export async function updateCustomExercise(id: string, patch: Partial<Pick<CustomExercise, 'name' | 'group' | 'perSide'>>): Promise<void> {
  const cur = await db.customExercises.get(id);
  if (!cur) return;
  const name = patch.name?.trim();
  const row: CustomExercise = { ...cur, ...patch, name: name || cur.name, updatedAt: Date.now() };
  await db.customExercises.put(row);
  registerCustomExercise(row);
}

export async function setTarget(exerciseId: string, weight: number): Promise<void> {
  const ex = await db.exercises.get(exerciseId);
  if (!ex) return;
  const next = withTarget(weight);
  await db.exercises.put({ ...ex, ...next, updatedAt: Date.now() });
}

export async function updateExerciseSettings(
  exerciseId: string,
  patch: Pick<ExerciseState, 'repMin' | 'repMax' | 'increment' | 'restSec'>,
): Promise<void> {
  const ex = await db.exercises.get(exerciseId);
  if (!ex) return;
  let next: ExerciseState = { ...ex, ...patch, updatedAt: Date.now() };
  if (patch.repMin !== ex.repMin || patch.repMax !== ex.repMax) {
    next = { ...next, ...withRepRange({ targetWeight: ex.targetWeight ?? 0, best: ex.best, stallCount: ex.stallCount }, patch.repMin, patch.repMax), targetWeight: ex.targetWeight };
  }
  await db.exercises.put(next);
}

// ---------- templates (the Cycle is the Templates in order) ----------

export async function cycle(): Promise<Template[]> {
  return db.templates.orderBy('order').toArray();
}

export async function acceptStarterProgram(): Promise<void> {
  const existing = await db.templates.count();
  const now = Date.now();
  await db.templates.bulkPut(STARTER_PROGRAM.map((t, i) => ({ id: uid(), name: t.name, order: existing + i, slots: t.slots.map((s) => ({ ...s })), updatedAt: now })));
  await ensureExercises(STARTER_PROGRAM.flatMap((t) => t.slots.map((s) => s.exerciseId)));
  await updateSettings({ onboarded: true });
}

export async function addTemplate(name: string): Promise<string> {
  const last = await db.templates.orderBy('order').last();
  const id = uid();
  await db.templates.put({ id, name, order: (last?.order ?? -1) + 1, slots: [], updatedAt: Date.now() });
  return id;
}

export async function saveTemplate(t: Template): Promise<void> {
  await ensureExercises(t.slots.map((s) => s.exerciseId));
  await db.templates.put({ ...t, updatedAt: Date.now() });
}

export async function deleteTemplate(id: string): Promise<void> {
  await db.templates.delete(id);
  const rest = await cycle();
  await db.templates.bulkPut(rest.map((t, i) => ({ ...t, order: i })));
  const s = await getSettings();
  if (s.nextTemplate >= rest.length) await updateSettings({ nextTemplate: 0 });
}

export async function moveTemplate(id: string, dir: -1 | 1): Promise<void> {
  const list = await cycle();
  const i = list.findIndex((t) => t.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await db.templates.bulkPut(list.map((t, k) => ({ ...t, order: k })));
}

// ---------- sessions ----------

const freshUi = (): SessionUi => ({ current: 0, warm: {}, weightNow: {}, rest: null, restOver: false, drop: null });

export async function activeSession(): Promise<Session | undefined> {
  return db.sessions.filter((s) => s.finishedAt === null).first();
}

export async function startSession(templateId: string): Promise<string> {
  const t = await db.templates.get(templateId);
  if (!t) throw new Error('Template not found');
  await ensureExercises(t.slots.map((s) => s.exerciseId));
  const id = uid();
  await db.sessions.put({ id, templateId, templateName: t.name, startedAt: Date.now(), finishedAt: null, plan: t.slots.map((s) => ({ ...s })), ui: freshUi() });
  return id;
}

export async function updateSessionUi(id: string, patch: Partial<SessionUi>): Promise<void> {
  const s = await db.sessions.get(id);
  if (s) await db.sessions.put({ ...s, ui: { ...s.ui, ...patch } });
}

export async function logSet(sessionId: string, exerciseId: string, weight: number, reps: number, rir: number | null): Promise<LoggedSet> {
  const n = (await db.sets.where('sessionId').equals(sessionId).filter((x) => x.exerciseId === exerciseId).count()) + 1;
  const set: LoggedSet = { id: uid(), sessionId, exerciseId, n, weight, reps, rir, loggedAt: Date.now() };
  await db.sets.put(set);
  return set;
}

export async function undoLastSet(sessionId: string, exerciseId: string): Promise<void> {
  const sets = await sessionSets(sessionId, exerciseId);
  const last = sets.at(-1);
  if (last) await db.sets.delete(last.id);
}

export async function sessionSets(sessionId: string, exerciseId?: string): Promise<LoggedSet[]> {
  const all = await db.sets.where('sessionId').equals(sessionId).toArray();
  return all.filter((x) => !exerciseId || x.exerciseId === exerciseId).sort((a, b) => a.loggedAt - b.loggedAt || a.n - b.n);
}

/** Swap a Slot's Exercise for this Session only. Only allowed before any of its sets are logged. */
export async function swapSlot(sessionId: string, index: number, exerciseId: string): Promise<void> {
  const s = await db.sessions.get(sessionId);
  if (!s) return;
  const slot = s.plan[index];
  if ((await sessionSets(sessionId, slot.exerciseId)).length) return;
  await ensureExercises([exerciseId]);
  const plan = s.plan.map((p, i): Slot => (i === index ? { exerciseId, sets: p.sets, swappedFrom: p.swappedFrom ?? p.exerciseId } : p));
  await db.sessions.put({ ...s, plan });
}

/** Finish a Session: run Double Progression for every Exercise with logged sets and advance the Cycle. */
export async function finishSession(sessionId: string): Promise<ExerciseResult[]> {
  return db.transaction('rw', [db.sessions, db.sets, db.exercises, db.settings, db.templates, db.customExercises], async () => {
    const s = await db.sessions.get(sessionId);
    if (!s) throw new Error('Session not found');
    const { unit } = await getSettings();
    const results: ExerciseResult[] = [];
    const seen = new Set<string>();
    for (const slot of s.plan) {
      if (seen.has(slot.exerciseId)) continue;
      seen.add(slot.exerciseId);
      const sets = await sessionSets(sessionId, slot.exerciseId);
      const ex = await db.exercises.get(slot.exerciseId);
      const lib = await findExercise(slot.exerciseId);
      if (!sets.length || !ex || !lib) continue;
      const planned = s.plan.filter((p) => p.exerciseId === slot.exerciseId).reduce((a, p) => a + p.sets, 0);
      const state: ProgressState = { targetWeight: ex.targetWeight ?? sets[0].weight, best: ex.best, stallCount: ex.stallCount };
      const out = evaluate(state, { repMin: ex.repMin, repMax: ex.repMax, increment: ex.increment, repsOnly: lib.repsOnly }, sets, planned,
        (w) => fmtWeight(w, unit, lib.equipment));
      await db.exercises.put({ ...ex, ...out.next, updatedAt: Date.now() });
      results.push({ exerciseId: slot.exerciseId, kind: out.kind, summary: out.summary, detail: out.detail, nextWeight: out.next.targetWeight });
    }
    const list = await db.templates.orderBy('order').toArray();
    const idx = list.findIndex((t) => t.id === s.templateId);
    if (idx >= 0 && list.length) await updateSettings({ nextTemplate: (idx + 1) % list.length });
    await db.sessions.put({ ...s, finishedAt: Date.now(), results, ui: { ...s.ui, rest: null } });
    return results;
  });
}

export async function discardSession(sessionId: string): Promise<void> {
  await db.transaction('rw', [db.sessions, db.sets], async () => {
    await db.sets.where('sessionId').equals(sessionId).delete();
    await db.sessions.delete(sessionId);
  });
}

// ---------- history ----------

/** The sets from the most recent other Session in which this Exercise was performed. */
export async function lastSessionSets(exerciseId: string, excludeSessionId?: string): Promise<LoggedSet[]> {
  const latest = await db.sets
    .where('[exerciseId+loggedAt]').between([exerciseId, -Infinity], [exerciseId, Infinity])
    .reverse().filter((x) => x.sessionId !== excludeSessionId).first();
  if (!latest) return [];
  return sessionSets(latest.sessionId, exerciseId);
}

export interface HistoryPoint {
  sessionId: string;
  date: number;
  sets: LoggedSet[];
  topWeight: number;
  e1rm: number;
}

export async function exerciseHistory(exerciseId: string): Promise<HistoryPoint[]> {
  const sets = await db.sets.where('exerciseId').equals(exerciseId).toArray();
  const finished = new Set((await db.sessions.filter((s) => s.finishedAt !== null).toArray()).map((s) => s.id));
  const bySession = new Map<string, LoggedSet[]>();
  for (const x of sets) if (finished.has(x.sessionId)) bySession.set(x.sessionId, [...(bySession.get(x.sessionId) ?? []), x]);
  return [...bySession.entries()]
    .map(([sessionId, list]) => {
      list.sort((a, b) => a.n - b.n);
      return {
        sessionId,
        date: Math.min(...list.map((x) => x.loggedAt)),
        sets: list,
        topWeight: Math.max(...list.map((x) => x.weight)),
        e1rm: Math.max(...list.map((x) => (x.reps <= 1 ? x.weight : x.weight * (1 + x.reps / 30)))),
      };
    })
    .sort((a, b) => a.date - b.date);
}

// ---------- training report (plain text to paste into an AI assistant for analysis) ----------

const day = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Every finished Session, plus current Targets and the Cycle, as Markdown a person can paste into a chat. */
export async function trainingReport(): Promise<string> {
  const { unit } = await getSettings();
  const sessions = (await db.sessions.filter((s) => s.finishedAt !== null).toArray()).sort((a, b) => a.startedAt - b.startedAt);
  const sets = await db.sets.toArray();
  const names = new Map<string, LibraryExercise | undefined>();
  const ex = async (id: string) => {
    if (!names.has(id)) names.set(id, await findExercise(id));
    return names.get(id);
  };
  const name = async (id: string) => (await ex(id))?.name ?? id;
  const w = async (id: string, kg: number) => {
    const e = await ex(id);
    return e?.repsOnly ? 'bodyweight' : fmtWeight(kg, unit, e?.equipment);
  };

  const out: string[] = [
    '# My DailyRep training log',
    '',
    'I track my strength training in DailyRep, which uses double progression: each exercise has a target weight and a rep range;',
    'when every planned set reaches the top of the range the weight goes up by the increment, and after 3 sessions with no progress it deloads.',
    'Please analyse my progress per exercise, my current working weights, any stalls or imbalances, and suggest what to focus on next.',
    '',
    `Exported ${day(Date.now())}. Weights are in ${unit}. "RIR" = reps in reserve. "per side" = weight of one dumbbell or one side.`,
    `${sessions.length} finished session${sessions.length === 1 ? '' : 's'}${sessions.length ? `, ${day(sessions[0].startedAt)} to ${day(sessions.at(-1)!.startedAt)}` : ''}.`,
    '',
    '## Current working weights',
    '',
    '| Exercise | Group | Target | Rep range | Increment | Sessions without progress |',
    '|---|---|---|---|---|---|',
  ];
  const states = await db.exercises.toArray();
  const rows: [string, string][] = [];
  for (const s of states) {
    const e = await ex(s.id);
    const target = s.targetWeight === null ? 'not set' : await w(s.id, s.targetWeight);
    const inc = e?.repsOnly ? '—' : `${fmtNum(s.increment)} ${unit}`;
    rows.push([e?.group ?? '', `| ${e?.name ?? s.id}${e?.perSide ? ' (per side)' : ''} | ${e?.group ?? ''} | ${target} | ${s.repMin}–${s.repMax} | ${inc} | ${s.stallCount} |`]);
  }
  out.push(...rows.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1])).map((r) => r[1]));

  out.push('', '## Program (the cycle of workouts, in order)', '');
  for (const t of await cycle()) {
    const slots = await Promise.all(t.slots.map(async (s) => `${await name(s.exerciseId)} ${s.sets}×`));
    out.push(`- **${t.name}**: ${slots.join(', ') || '(empty)'}`);
  }

  out.push('', '## Session log (oldest first)');
  for (const s of sessions) {
    const mins = Math.round(((s.finishedAt ?? s.startedAt) - s.startedAt) / 60000);
    out.push('', `### ${day(s.startedAt)} — ${s.templateName} (${mins} min)`);
    const mine = sets.filter((x) => x.sessionId === s.id).sort((a, b) => a.loggedAt - b.loggedAt || a.n - b.n);
    const ids = [...new Set([...s.plan.map((p) => p.exerciseId), ...mine.map((x) => x.exerciseId)])];
    for (const id of ids) {
      const done = mine.filter((x) => x.exerciseId === id);
      const slot = s.plan.find((p) => p.exerciseId === id);
      const swapped = slot?.swappedFrom ? ` (swapped in for ${await name(slot.swappedFrom)})` : '';
      if (!done.length) { out.push(`- ${await name(id)}${swapped}: skipped`); continue; }
      const list = await Promise.all(done.map(async (x) => `${await w(id, x.weight)} × ${x.reps}${x.rir === null ? '' : ` @RIR ${x.rir}`}`));
      const result = s.results?.find((r) => r.exerciseId === id);
      out.push(`- ${await name(id)}${swapped}: ${list.join(', ')}${result ? ` → ${result.summary}` : ''}`);
    }
  }
  return out.join('\n') + '\n';
}

// ---------- backup ----------

export interface Backup {
  app: 'DailyRep';
  version: 1;
  exportedAt: string;
  settings: Settings[];
  exercises: ExerciseState[];
  templates: Template[];
  sessions: Session[];
  sets: LoggedSet[];
  /** Absent in backups made before Custom Exercises existed. */
  customExercises?: CustomExercise[];
}

const allTables = () => [db.settings, db.exercises, db.templates, db.sessions, db.sets, db.customExercises];

export async function exportAll(): Promise<Backup> {
  return {
    app: 'DailyRep', version: 1, exportedAt: new Date().toISOString(),
    settings: await db.settings.toArray(), exercises: await db.exercises.toArray(), templates: await db.templates.toArray(),
    sessions: await db.sessions.toArray(), sets: await db.sets.toArray(), customExercises: await db.customExercises.toArray(),
  };
}

export async function importAll(text: string): Promise<void> {
  const b = JSON.parse(text) as Backup;
  if (b?.app !== 'DailyRep' || b.version !== 1) throw new Error("That isn't a DailyRep backup file.");
  await db.transaction('rw', allTables(), async () => {
    await Promise.all(allTables().map((t) => t.clear()));
    await db.settings.bulkPut(b.settings);
    await db.exercises.bulkPut(b.exercises);
    await db.templates.bulkPut(b.templates);
    await db.sessions.bulkPut(b.sessions);
    await db.sets.bulkPut(b.sets);
    await db.customExercises.bulkPut(b.customExercises ?? []);
  });
}

export async function eraseAll(): Promise<void> {
  await db.transaction('rw', allTables(), async () => {
    await Promise.all(allTables().map((t) => t.clear()));
  });
}
