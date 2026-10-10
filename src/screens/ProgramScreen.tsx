import { useLiveQuery } from 'dexie-react-hooks';
import type { Go } from '../App';
import { acceptStarterProgram, addTemplate, cycle, getSettings, moveTemplate } from '../data/repo';
import { libraryExercise } from '../lib/library';

/** The Cycle: the Lifter's workouts in the order they rotate. */
export function ProgramScreen({ go }: { go: Go }) {
  const data = useLiveQuery(async () => ({ templates: await cycle(), settings: await getSettings() }), []);
  if (!data) return null;
  const { templates, settings } = data;

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
    </main>
  );
}
