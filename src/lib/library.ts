// Typed access to the Built-in Exercise library and the daily quotes.
// exercise-library.js and quotes.js are plain scripts carried over from the prototypes; they attach to the global object.
import './exercise-library.js';
import './quotes.js';
import type { Equipment } from '../domain/units';

export type Group = 'Legs' | 'Chest' | 'Shoulders' | 'Back' | 'Arms' | 'Core';

export interface LibraryExercise {
  id: string;
  name: string;
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
  cues: string[];
  form: { works: string; setup: string[]; mistakes: [string, string][]; safety?: string };
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
export const libraryExercise = (id: string): LibraryExercise | undefined => g.WorkoutLibrary.byId[id];
export const figSVG = (id: string, label?: string) => g.WorkoutLibrary.figSVG(id, label);
export const startDemoAnimation = () => g.WorkoutLibrary.startAnimation();
export const quoteForDate = (d: Date = new Date()) => g.DailyRepQuotes.quoteForDate(d);
