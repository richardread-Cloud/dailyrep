// Typed access to the Built-in Exercise library and the daily quotes.
// exercise-library.js and quotes.js are plain scripts carried over from the prototypes; they attach to the global object.
import './exercise-library.js';
import './quotes.js';
import type { Equipment } from '../domain/units';

export type Group = 'Legs' | 'Chest' | 'Shoulders' | 'Back' | 'Arms' | 'Core';

export interface LibraryExercise {
  id: string;
  name: string;
  /** Other names it goes by, matched by search. */
  aka?: string[];
  group: Group;
  equipment: Equipment;
  /** Default Increment in kg; null for Reps-only. */
  inc: number | null;
  min: number;
  max: number;
  /** Default Rest Period in seconds. */
  rest: number;
  perSide?: boolean;
  repsOnly?: boolean;
  /** Loaded, but works without any weight too, so it counts as a no-equipment alternative. */
  bodyweightOk?: boolean;
  /** A Custom Exercise: no Demo, cues or form guidance. */
  custom?: boolean;
  cues: string[];
  form: { works: string; setup: string[]; mistakes: [string, string][]; safety?: string };
}

/** What a Lifter enters to make a Custom Exercise. */
export interface CustomDef {
  id: string;
  name: string;
  group: Group;
  equipment: Equipment;
  perSide?: boolean;
  repsOnly?: boolean;
}

interface WorkoutLibraryApi {
  LIBRARY: LibraryExercise[];
  byId: Record<string, LibraryExercise>;
  figSVG: (id: string, label?: string, phase?: number) => string;
  startAnimation: () => void;
}

export interface Quote {
  q: string;
  by: string;
}

const g = globalThis as unknown as {
  WorkoutLibrary: WorkoutLibraryApi;
  DailyRepQuotes: { QUOTES: Quote[]; quoteForDate: (d?: Date) => Quote };
};

export const LIBRARY = g.WorkoutLibrary.LIBRARY;
export const GROUPS: Group[] = ['Legs', 'Chest', 'Shoulders', 'Back', 'Arms', 'Core'];

// Starting Rep Range, Rest Period and Increment (kg) for a Custom Exercise, by equipment.
const CUSTOM_DEFAULTS: Record<Equipment, Pick<LibraryExercise, 'inc' | 'min' | 'max' | 'rest'>> = {
  barbell: { inc: 2.5, min: 6, max: 10, rest: 150 },
  dumbbell: { inc: 2, min: 8, max: 12, rest: 90 },
  cable: { inc: 2.5, min: 10, max: 15, rest: 60 },
  machine: { inc: 5, min: 10, max: 15, rest: 90 },
  bodyweight: { inc: 2.5, min: 6, max: 12, rest: 90 },
};

export function customExercise(d: CustomDef): LibraryExercise {
  const defaults = CUSTOM_DEFAULTS[d.equipment];
  const repsOnly = d.equipment === 'bodyweight' && !!d.repsOnly;
  return {
    id: d.id, name: d.name, group: d.group, equipment: d.equipment, perSide: !!d.perSide, repsOnly, custom: true,
    ...defaults, inc: repsOnly ? null : defaults.inc, ...(repsOnly ? { min: 8, max: 15, rest: 60 } : {}),
    cues: [], form: { works: '', setup: [], mistakes: [] },
  };
}

// The Lifter's Custom Exercises, kept in step with the database by App (see registerCustomExercises).
let customById: Record<string, LibraryExercise> = {};
export function registerCustomExercises(defs: CustomDef[]): void {
  customById = Object.fromEntries(defs.map((d) => [d.id, customExercise(d)]));
}
/** Register one new or changed Custom Exercise straight away, before App's query catches up. */
export function registerCustomExercise(def: CustomDef): void {
  customById = { ...customById, [def.id]: customExercise(def) };
}
export const customExercises = (): LibraryExercise[] => Object.values(customById).sort((a, b) => a.name.localeCompare(b.name));

export const libraryExercise = (id: string): LibraryExercise | undefined => g.WorkoutLibrary.byId[id] ?? customById[id];
export const matchesSearch = (e: LibraryExercise, q: string): boolean => {
  const s = q.trim().toLowerCase();
  return !s || [e.name, ...(e.aka ?? [])].some((n) => n.toLowerCase().includes(s));
};

// ---------- alternatives: other Exercises that work the same muscles ----------
// Muscles come from form.works, main muscle first. A general muscle half-matches a part of it ("Chest" and "Upper chest"),
// but two different parts don't match ("Rear shoulders" and "Side shoulders", "Lower back" and "Upper back").
const muscles = (e: LibraryExercise) => e.form.works.split(',').map((m) => m.trim().toLowerCase()).filter(Boolean);
const base = (m: string) => m.split(' ').pop()!;
const match = (a: string, b: string) => (a === b ? 1 : base(a) === base(b) && (a === base(a) || b === base(b)) ? 0.5 : 0);

/** How well `b` stands in for `a`: 0 when it doesn't work a's main muscle at all. */
function similarity(a: LibraryExercise, b: LibraryExercise): number {
  const ma = muscles(a), mb = muscles(b);
  if (!ma.length || !mb.length) return a.group === b.group ? 0.1 : 0;   // Custom Exercises: same group is all we know
  const best = (m: string) => Math.max(...mb.map((x) => match(m, x)));
  const at = mb.findIndex((x) => match(ma[0], x) > 0);
  if (at < 0) return 0;
  const score = ma.reduce((s, m, i) => s + (i === 0 ? 2 : 1) * best(m), 0);
  // Less close when b is mainly for something else, and for each muscle b works that a doesn't.
  const fit = at === 0 ? 1 : at === 1 ? 0.75 : 0.5;
  return score * fit - 0.1 * mb.filter((x) => !ma.some((m) => match(m, x))).length;
}

/** Exercises that work the same muscles as this one, closest first. */
export function alternatives(id: string): LibraryExercise[] {
  const a = libraryExercise(id);
  if (!a) return [];
  return [...LIBRARY, ...customExercises()]
    .filter((b) => b.id !== id)
    .map((b) => ({ b, s: similarity(a, b) }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s)
    .map((x) => x.b);
}

export const hasDemo =(id: string): boolean => id in g.WorkoutLibrary.byId;
export const figSVG = (id: string, label?: string) => g.WorkoutLibrary.figSVG(id, label);
export const startDemoAnimation = () => g.WorkoutLibrary.startAnimation();
export const quoteForDate = (d: Date = new Date()) => g.DailyRepQuotes.quoteForDate(d);
