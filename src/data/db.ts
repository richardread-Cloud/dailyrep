import Dexie, { type Table } from 'dexie';
import type { OutcomeKind } from '../domain/progression';
import type { Equipment, Unit } from '../domain/units';
import type { Group } from '../lib/library';

// Everything is stored on the device first (docs/adr/0002). Ids are random UUIDs so records can sync later.

export interface Settings {
  id: 'me';
  unit: Unit;
  /** Index into the Cycle (Templates by order) of the Template suggested next. */
  nextTemplate: number;
  onboarded: boolean;
}

/** A Lifter's settings and progression state for one Exercise. */
export interface ExerciseState {
  id: string;
  repMin: number;
  repMax: number;
  increment: number;
  restSec: number;
  /** null until the Lifter enters a starting weight. */
  targetWeight: number | null;
  best: number | null;
  stallCount: number;
  updatedAt: number;
}

/** An Exercise the Lifter made themselves. It has no Demo; its defaults come from its equipment. */
export interface CustomExercise {
  id: string;
  name: string;
  group: Group;
  equipment: Equipment;
  perSide?: boolean;
  repsOnly?: boolean;
  updatedAt: number;
}

export interface Slot {
  exerciseId: string;
  sets: number;
  /** Set on a Session's plan when the Lifter Swapped this Slot's Exercise for the day. */
  swappedFrom?: string;
}

export interface Template {
  id: string;
  name: string;
  order: number;
  slots: Slot[];
  updatedAt: number;
}

export interface RestTimer {
  endsAt: number;
  durMs: number;
  exerciseId: string;
}

/** Where the Lifter is within a Session, kept so a Session can be resumed after the app is closed. */
export interface SessionUi {
  current: number;
  warm: Record<string, number>;
  /** Weight in use this Session after a Drop; absent means the Target. */
  weightNow: Record<string, number>;
  rest: RestTimer | null;
  restOver: boolean;
  /** Exercise with a Drop offer showing. */
  drop: string | null;
}

export interface ExerciseResult {
  exerciseId: string;
  kind: OutcomeKind;
  summary: string;
  detail: string;
  nextWeight: number;
}

export interface Session {
  id: string;
  templateId: string;
  templateName: string;
  startedAt: number;
  finishedAt: number | null;
  plan: Slot[];
  ui: SessionUi;
  results?: ExerciseResult[];
}

/** A logged Working Set. Sets are only ever added (or the last one undone), so they never conflict when syncing. */
export interface LoggedSet {
  id: string;
  sessionId: string;
  exerciseId: string;
  n: number;
  weight: number;
  reps: number;
  rir: number | null;
  loggedAt: number;
}

export class DailyRepDB extends Dexie {
  settings!: Table<Settings, string>;
  exercises!: Table<ExerciseState, string>;
  templates!: Table<Template, string>;
  sessions!: Table<Session, string>;
  sets!: Table<LoggedSet, string>;
  customExercises!: Table<CustomExercise, string>;

  constructor(name = 'dailyrep') {
    super(name);
    this.version(1).stores({
      settings: 'id',
      exercises: 'id',
      templates: 'id, order',
      sessions: 'id, startedAt, finishedAt',
      sets: 'id, sessionId, exerciseId, [exerciseId+loggedAt]',
    });
    this.version(2).stores({ customExercises: 'id' });
  }
}

export const db = new DailyRepDB();
