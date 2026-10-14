import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import type { Go } from '../App';
import { ExercisePicker } from '../components/ExercisePicker';
import { Demo } from '../components/Demo';
import { db, type Template } from '../data/db';
import { deleteTemplate, saveTemplate } from '../data/repo';
import { libraryExercise } from '../lib/library';

/** Edit one workout: its name, and each exercise with its number of sets. Changes save as you go. */
export function TemplateScreen({ id, go }: { id: string; go: Go }) {
  const t = useLiveQuery(() => db.templates.get(id), [id]);
  const [picking, setPicking] = useState(false);
  /** Index of the Slot whose Exercise is being replaced. */
  const [swapping, setSwapping] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (t === undefined) return null;

  const save = (next: Template) => saveTemplate(next);
  const setSlots = (slots: Template['slots']) => save({ ...t, slots });
  const move = (i: number, dir: -1 | 1) => {
    const s = [...t.slots];
    [s[i], s[i + dir]] = [s[i + dir], s[i]];
    void setSlots(s);
  };

  return (
    <main className="screen">
      <button className="back" style={{ alignSelf: 'start' }} onClick={() => go({ name: 'program' })}>‹ Program</button>
      <label className="field">
        <span>Workout name</span>
        <input defaultValue={t.name} onBlur={(e) => { const name = e.target.value.trim(); if (name && name !== t.name) void save({ ...t, name }); }}
          style={{ fontFamily: 'var(--display)', fontSize: 26, fontWeight: 700 }} />
      </label>

      {t.slots.length > 0 ? (
        <div className="list">
          {t.slots.map((s, i) => {
            const lib = libraryExercise(s.exerciseId);
            return (
              <div key={`${s.exerciseId}-${i}`} className="list-row" style={{ flexWrap: 'wrap' }}>
                <Demo id={s.exerciseId} still className="demo-mini" />
                <button className="grow" style={{ textAlign: 'left' }} onClick={() => go({ name: 'exercise', id: s.exerciseId, from: { name: 'template', id } })}>
                  <span className="name">{lib?.name}</span>
                  <span className="small muted" style={{ display: 'block' }}>{lib?.group} · settings and progress ›</span>
                </button>
                <div className="row" style={{ width: '100%', justifyContent: 'space-between' }}>
                  <div className="stepper" aria-label={`Sets of ${lib?.name}`}>
                    <button aria-label="One fewer set" disabled={s.sets <= 1} onClick={() => setSlots(t.slots.map((x, k) => (k === i ? { ...x, sets: x.sets - 1 } : x)))}>−</button>
                    <output>{s.sets}</output>
                    <button aria-label="One more set" disabled={s.sets >= 10} onClick={() => setSlots(t.slots.map((x, k) => (k === i ? { ...x, sets: x.sets + 1 } : x)))}>+</button>
                    <span className="small muted">sets</span>
                  </div>
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    <button className="btn small" disabled={i === 0} aria-label="Move up" onClick={() => move(i, -1)}>↑</button>
                    <button className="btn small" disabled={i === t.slots.length - 1} aria-label="Move down" onClick={() => move(i, 1)}>↓</button>
                    <button className="btn small" aria-label={`Swap ${lib?.name}`} onClick={() => setSwapping(i)}>Swap</button>
                    <button className="btn small danger" aria-label={`Remove ${lib?.name}`} onClick={() => setSlots(t.slots.filter((_, k) => k !== i))}>Remove</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : <p className="muted">No exercises yet.</p>}

      <button className="btn" onClick={() => setPicking(true)}>+ Add exercise</button>

      <div className="grow" />
      {confirmDelete ? (
        <div className="notice warn">
          <span><b>Delete {t.name}?</b> Your logged sessions and exercise progress are kept.</span>
          <div className="row">
            <button className="btn danger" onClick={async () => { await deleteTemplate(id); go({ name: 'program' }); }}>Delete workout</button>
            <button className="btn" onClick={() => setConfirmDelete(false)}>Keep it</button>
          </div>
        </div>
      ) : <button className="link muted" onClick={() => setConfirmDelete(true)}>Delete this workout</button>}

      {picking && (
        <ExercisePicker title="Add exercise" exclude={t.slots.map((s) => s.exerciseId)} onClose={() => setPicking(false)}
          onPick={async (exId) => { await setSlots([...t.slots, { exerciseId: exId, sets: 3 }]); setPicking(false); }} />
      )}
      {swapping !== null && t.slots[swapping] && (
        <ExercisePicker title={`Replace ${libraryExercise(t.slots[swapping].exerciseId)?.name ?? 'exercise'}`} similarTo={t.slots[swapping].exerciseId}
          exclude={t.slots.map((s) => s.exerciseId)} onClose={() => setSwapping(null)}
          onPick={async (exId) => { await setSlots(t.slots.map((x, k) => (k === swapping ? { ...x, exerciseId: exId } : x))); setSwapping(null); }} />
      )}
    </main>
  );
}
