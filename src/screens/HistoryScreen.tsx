import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import type { Go } from '../App';
import { ExercisePicker } from '../components/ExercisePicker';
import { db, type LoggedSet } from '../data/db';
import { deleteSet, getSettings, updateSet } from '../data/repo';
import { fmtWeight, type Unit } from '../domain/units';
import { libraryExercise } from '../lib/library';

const when = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/** Every Set of every finished Session, newest Session first. Tap a Set to correct it. */
export function HistoryScreen({ go }: { go: Go }) {
  const data = useLiveQuery(async () => {
    const sessions = (await db.sessions.filter((s) => s.finishedAt !== null).toArray()).sort((a, b) => b.startedAt - a.startedAt);
    const sets = await db.sets.toArray();
    const bySession = new Map<string, LoggedSet[]>();
    for (const x of sets) bySession.set(x.sessionId, [...(bySession.get(x.sessionId) ?? []), x]);
    return { sessions, bySession, unit: (await getSettings()).unit };
  }, []);
  const [editing, setEditing] = useState<LoggedSet | null>(null);
  if (!data) return null;
  const { sessions, bySession, unit } = data;

  return (
    <main className="screen">
      <button className="back" style={{ alignSelf: 'start' }} onClick={() => go({ name: 'home' })}>‹ Home</button>
      <h1 className="title">History</h1>
      {sessions.length === 0 ? (
        <div className="empty card"><p>Finish your first session to see its sets here.</p></div>
      ) : (
        <>
          <p className="small muted">Tap a set to fix its weight, reps or exercise.</p>
          {sessions.map((s) => {
            const sets = (bySession.get(s.id) ?? []).sort((a, b) => a.loggedAt - b.loggedAt || a.n - b.n);
            const ids = [...new Set(sets.map((x) => x.exerciseId))];
            return (
              <section key={s.id} className="stack" style={{ gap: 6 }}>
                <div><span className="eyebrow">{when(s.startedAt)}</span><h2 className="subtitle">{s.templateName}</h2></div>
                {ids.length === 0 ? <p className="small muted">No sets logged.</p> : (
                  <div className="list">
                    {ids.map((exId) => {
                      const lib = libraryExercise(exId);
                      return (
                        <div key={exId}>
                          <div className="h-ex">{lib?.name ?? 'Unknown exercise'}</div>
                          {sets.filter((x) => x.exerciseId === exId).map((x) => (
                            <button key={x.id} className="h-set" onClick={() => setEditing(x)} aria-label={`Edit set ${x.n} of ${lib?.name}`}>
                              <span className="l-set">Set {x.n}</span>
                              <span className="num h-val">{lib?.repsOnly ? '' : `${fmtWeight(x.weight, unit, lib?.equipment)} × `}{x.reps}{lib?.repsOnly ? ' reps' : ''}</span>
                              <span className="small muted num">{x.rir === null ? '' : `RIR ${x.rir === 4 ? '4+' : x.rir}`}</span>
                              <span className="chev" aria-hidden="true">›</span>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </>
      )}
      {editing && <SetEditor set={editing} unit={unit} onClose={() => setEditing(null)} />}
    </main>
  );
}

function SetEditor({ set, unit, onClose }: { set: LoggedSet; unit: Unit; onClose: () => void }) {
  const [exerciseId, setExerciseId] = useState(set.exerciseId);
  const [weight, setWeight] = useState(String(set.weight));
  const [reps, setReps] = useState(String(set.reps));
  const [rir, setRir] = useState(set.rir);
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lib = libraryExercise(exerciseId);
  const bw = lib?.equipment === 'bodyweight';

  const save = async () => {
    try {
      await updateSet(set.id, { exerciseId, weight: lib?.repsOnly ? 0 : Number(weight), reps: Number(reps), rir });
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'That set could not be saved.'); }
  };

  if (picking) {
    return <ExercisePicker title="Change exercise" similarTo={exerciseId} onClose={() => setPicking(false)}
      onPick={(id) => { setExerciseId(id); setPicking(false); }} />;
  }
  return (
    <div className="sheet" onClick={onClose}>
      <div className="sheet-card" role="dialog" aria-label="Edit set" onClick={(e) => e.stopPropagation()}>
        <div className="spread"><h2>Edit set</h2><button className="btn" onClick={onClose}>Cancel</button></div>
        <div className="field">
          <span>Exercise</span>
          <button className="list-row" style={{ border: '1px solid var(--line)', borderRadius: 14 }} onClick={() => setPicking(true)}>
            <span className="grow name">{lib?.name ?? 'Unknown exercise'}</span>
            <span className="link">Change</span>
          </button>
        </div>
        <div className="row">
          {!lib?.repsOnly && (
            <label className="field">
              <span>{bw ? `Added weight (${unit})` : `Weight (${unit})`}</span>
              <input type="number" inputMode="decimal" min={0} step="any" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </label>
          )}
          <label className="field">
            <span>Reps{lib?.perSide ? ' (per side)' : ''}</span>
            <input type="number" inputMode="numeric" min={0} step={1} value={reps} onChange={(e) => setReps(e.target.value)} />
          </label>
        </div>
        <div className="field">
          <span>RIR (reps in reserve)</span>
          <div className="rir-chips" style={{ justifyContent: 'start' }}>
            {[0, 1, 2, 3, 4].map((v) => (
              <button key={v} className={rir === v ? 'on' : ''} aria-pressed={rir === v} onClick={() => setRir(rir === v ? null : v)}>{v === 4 ? '4+' : v}</button>
            ))}
          </div>
        </div>
        <p className="small muted">Fixing a set doesn't change your targets. To change one, open the exercise from Progress.</p>
        {error && <p className="small" role="alert" style={{ color: 'var(--bad)' }}>{error}</p>}
        <button className="btn-primary" disabled={weight.trim() === '' || reps.trim() === ''} onClick={save}>Save</button>
        {confirmDelete ? (
          <div className="notice warn">
            <span><b>Delete this set?</b> It can't be brought back.</span>
            <div className="row">
              <button className="btn danger" onClick={async () => { await deleteSet(set.id); onClose(); }}>Delete set</button>
              <button className="btn" onClick={() => setConfirmDelete(false)}>Keep it</button>
            </div>
          </div>
        ) : <button className="link muted" onClick={() => setConfirmDelete(true)}>Delete this set</button>}
      </div>
    </div>
  );
}
