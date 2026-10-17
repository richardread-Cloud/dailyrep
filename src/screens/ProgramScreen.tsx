import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import type { Go } from '../App';
import type { ExerciseState, Template } from '../data/db';
import {
  acceptStarterProgram, addTemplate, addToTemplate, archiveExercise, cycle, exercisesWithoutTarget, getSettings, moveTemplate, setTarget, unusedExercises,
} from '../data/repo';
import { fmtWeight, type Unit } from '../domain/units';
import { libraryExercise } from '../lib/library';

/** The Cycle: the Lifter's workouts in the order they rotate. */
export function ProgramScreen({ go }: { go: Go }) {
  const data = useLiveQuery(async () => ({
    templates: await cycle(), settings: await getSettings(), noTarget: await exercisesWithoutTarget(), unused: await unusedExercises(),
  }), []);
  if (!data) return null;
  const { templates, settings, noTarget, unused } = data;

  return (
    <main className="screen">
      <button className="back" style={{ alignSelf: 'start' }} onClick={() => go({ name: 'home' })}>‹ Home</button>
      <div className="stack">
        <h1 className="title">Your program</h1>
        <p className="muted small">Workouts rotate in this order. The one marked Next is suggested on the start screen.</p>
      </div>
      {templates.length > 0 ? (
        <div className="list">
          {templates.map((t, i) => (
            <div key={t.id} className="list-row">
              <button className="grow" style={{ textAlign: 'left' }} onClick={() => go({ name: 'template', id: t.id })}>
                <span className="name">{t.name}</span> {i === settings.nextTemplate && <span className="tag">Next</span>}
                <span className="small muted" style={{ display: 'block' }}>
                  {t.slots.length ? t.slots.map((s) => libraryExercise(s.exerciseId)?.name).join(' · ') : 'No exercises yet'}
                </span>
              </button>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <button className="btn small" disabled={i === 0} aria-label={`Move ${t.name} up`} onClick={() => moveTemplate(t.id, -1)}>↑</button>
                <button className="btn small" disabled={i === templates.length - 1} aria-label={`Move ${t.name} down`} onClick={() => moveTemplate(t.id, 1)}>↓</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty card">
          <p>No workouts yet. Add one and fill it with exercises, or start from the 3-day starter program.</p>
          <button className="btn" onClick={() => acceptStarterProgram()}>Add the starter program</button>
        </div>
      )}
      <button className="btn" onClick={async () => go({ name: 'template', id: await addTemplate(`Workout ${String.fromCharCode(65 + templates.length)}`) })}>
        + Add a workout
      </button>

      {noTarget.length > 0 && (
        <section className="card stack">
          <h2 className="subtitle">Set a starting weight</h2>
          <p className="small muted">These are in your program but have no target yet. Pick a weight you could lift for the bottom of the rep range with 2 or 3 reps to spare.</p>
          {noTarget.map((id) => <TargetRow key={id} id={id} unit={settings.unit} />)}
        </section>
      )}

      {unused.length > 0 && (
        <section className="card stack">
          <h2 className="subtitle">Not in any workout</h2>
          <p className="small muted">You've trained these or set a weight for them, but they aren't in your program. Add them to a workout, or archive them to hide them here. Their history is kept either way.</p>
          {unused.map((e) => <UnusedRow key={e.id} ex={e} templates={templates} unit={settings.unit} />)}
        </section>
      )}
    </main>
  );
}

function TargetRow({ id, unit }: { id: string; unit: Unit }) {
  const [val, setVal] = useState('');
  const lib = libraryExercise(id);
  const n = Number(val);
  const ok = val.trim() !== '' && Number.isFinite(n) && n >= 0;
  return (
    <div className="spread">
      <span className="name">{lib?.name}</span>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input type="number" inputMode="decimal" min={0} step="any" value={val} placeholder={unit} aria-label={`${lib?.name} target weight (${unit})`}
          style={{ width: 90 }} onChange={(e) => setVal(e.target.value)} />
        <button className="btn" disabled={!ok} onClick={() => setTarget(id, Math.round(n * 100) / 100)}>Save</button>
      </div>
    </div>
  );
}

function UnusedRow({ ex, templates, unit }: { ex: ExerciseState; templates: Template[]; unit: Unit }) {
  const [adding, setAdding] = useState(false);
  const lib = libraryExercise(ex.id);
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="spread">
        <span><span className="name">{lib?.name}</span>
          {ex.targetWeight !== null && <span className="small muted" style={{ display: 'block' }}>Target {fmtWeight(ex.targetWeight, unit, lib?.equipment)}</span>}</span>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <button className="btn small" disabled={!templates.length} onClick={() => setAdding(!adding)}>Add to…</button>
          <button className="btn small" onClick={() => archiveExercise(ex.id)}>Archive</button>
        </div>
      </div>
      {adding && (
        <div className="chips wrap">
          {templates.map((t) => <button key={t.id} className="chip small" onClick={() => addToTemplate(t.id, ex.id)}>{t.name}</button>)}
        </div>
      )}
    </div>
  );
}
