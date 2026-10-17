import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import type { Go } from '../App';
import { ExercisePicker } from '../components/ExercisePicker';
import { db, type LoggedSet } from '../data/db';
import {
  counts, deleteSet, discardSession, firstTimes, getSettings, resolveUnplanned, sessionSets, unplannedExercises, updateSet,
} from '../data/repo';
import { setWarnings } from '../domain/checks';
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
    const unplanned = new Map(await Promise.all(sessions.map(async (s) => [s.id, await unplannedExercises(s.id)] as const)));
    return { sessions, bySession, unplanned, unit: (await getSettings()).unit };
  }, []);
  const [editing, setEditing] = useState<LoggedSet | null>(null);
  const [confirmShort, setConfirmShort] = useState(false);
  if (!data) return null;
  const { sessions, bySession, unplanned, unit } = data;
  const short = sessions.filter((s) => !counts(s));

  return (
    <main className="screen">
      <button className="back" style={{ alignSelf: 'start' }} onClick={() => go({ name: 'home' })}>‹ Home</button>
      <h1 className="title">History</h1>
      {sessions.length === 0 ? (
        <div className="empty card"><p>Finish your first session to see its sets here.</p></div>
      ) : (
        <>
          <p className="small muted">Tap a set to fix its weight, reps or exercise.</p>
          {short.length > 0 && (
            <div className="notice warn">
              <span><b>{short.length} session{short.length === 1 ? '' : 's'} lasted under a minute</b> and {short.length === 1 ? "doesn't" : "don't"} count. Delete {short.length === 1 ? 'it' : 'them'}?</span>
              {confirmShort ? (
                <div className="row">
                  <button className="btn danger" onClick={async () => { for (const s of short) await discardSession(s.id); setConfirmShort(false); }}>Delete {short.length === 1 ? 'it' : 'them'}</button>
                  <button className="btn" onClick={() => setConfirmShort(false)}>Keep</button>
                </div>
              ) : <div className="row"><button className="btn" onClick={() => setConfirmShort(true)}>Delete…</button></div>}
            </div>
          )}
          {sessions.map((s) => {
            const sets = (bySession.get(s.id) ?? []).sort((a, b) => a.loggedAt - b.loggedAt || a.n - b.n);
            const ids = [...new Set(sets.map((x) => x.exerciseId))];
            const swappedFrom = new Map(s.plan.filter((p) => p.swappedFrom).map((p) => [p.exerciseId, p.swappedFrom]));
            return (
              <section key={s.id} className="stack" style={{ gap: 6 }}>
                <div>
                  <span className="eyebrow">{when(s.startedAt)}</span>
                  <h2 className="subtitle">{s.templateName} {!counts(s) && <span className="tag">Under a minute</span>}</h2>
                </div>
                {(unplanned.get(s.id) ?? []).map((u) => <Unplanned key={u.exerciseId} sessionId={s.id} templateName={s.templateName} item={u} />)}
                {ids.length === 0 ? <p className="small muted">No sets logged.</p> : (
                  <div className="list">
                    {ids.map((exId) => {
                      const lib = libraryExercise(exId);
                      return (
                        <div key={exId}>
                          <div className="h-ex">{lib?.name ?? 'Unknown exercise'}{swappedFrom.get(exId) && <span className="small muted"> · substitution for {libraryExercise(swappedFrom.get(exId)!)?.name}</span>}</div>
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

/** An Exercise logged in a Session that wasn't in its plan: make it a permanent Swap or a one-off substitution. */
function Unplanned({ sessionId, templateName, item }: { sessionId: string; templateName: string; item: { exerciseId: string; unlogged: string[] } }) {
  const [replaces, setReplaces] = useState<string | null>(item.unlogged.length === 1 ? item.unlogged[0] : null);
  const name = (id: string) => libraryExercise(id)?.name ?? 'Unknown exercise';
  return (
    <div className="notice info">
      <span><b>{name(item.exerciseId)} isn't in {templateName}.</b>{' '}
        {item.unlogged.length ? 'Swap permanently, or one-off substitution?' : 'Add it to the program, or keep it as a one-off?'}</span>
      {item.unlogged.length > 1 && (
        <div className="chips wrap" role="radiogroup" aria-label="Instead of">
          {item.unlogged.map((id) => (
            <button key={id} role="radio" aria-checked={replaces === id} className={`chip small${replaces === id ? ' on' : ''}`} onClick={() => setReplaces(id)}>Instead of {name(id)}</button>
          ))}
        </div>
      )}
      {item.unlogged.length === 1 && <span className="small muted">In place of {name(item.unlogged[0])}.</span>}
      <div className="row">
        <button className="btn" disabled={item.unlogged.length > 0 && !replaces} onClick={() => resolveUnplanned(sessionId, item.exerciseId, replaces, true)}>
          {item.unlogged.length ? 'Swap permanently' : 'Add to program'}
        </button>
        <button className="btn" disabled={item.unlogged.length > 0 && !replaces} onClick={() => resolveUnplanned(sessionId, item.exerciseId, replaces, false)}>One-off</button>
      </div>
    </div>
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
  const facts = useLiveQuery(async () => ({
    ex: await db.exercises.get(exerciseId),
    others: (await sessionSets(set.sessionId, exerciseId)).filter((x) => x.id !== set.id).map((x) => x.reps),
    first: (await firstTimes([exerciseId], set.sessionId))[exerciseId],
  }), [exerciseId, set.id, set.sessionId]);
  const warnings = facts?.ex && weight.trim() !== '' && reps.trim() !== ''
    ? setWarnings({ weight: Number(weight), reps: Number(reps), target: facts.ex.targetWeight, repMin: facts.ex.repMin, otherReps: facts.others, first: facts.first, bodyweight: bw },
      (w) => fmtWeight(w, unit, lib?.equipment))
    : [];

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
        {warnings.length > 0 && <div className="notice warn" role="status"><span><b>Check this?</b> {warnings.join(' ')}</span></div>}
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
