import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import type { Go, Route } from '../App';
import { CustomExerciseForm, equipmentLabel } from '../components/CustomExerciseForm';
import { Demo, HowToSheet } from '../components/Demo';
import { ExercisePicker } from '../components/ExercisePicker';
import { ProgressChart } from '../components/ProgressChart';
import { db } from '../data/db';
import { ensureExercises, exerciseHistory, getSettings, setTarget, updateCustomExercise, updateExerciseSettings } from '../data/repo';
import { fmtNum, fmtWeight } from '../domain/units';
import { alternatives, libraryExercise } from '../lib/library';

const fmtRest = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const day = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** One Exercise: its Demo, the Lifter's settings and target, and its history. */
export function ExerciseScreen({ id, back, go }: { id: string; back: Route; go: Go }) {
  const lib = libraryExercise(id);
  useEffect(() => { void ensureExercises([id]); }, [id]);
  const data = useLiveQuery(async () => ({ ex: await db.exercises.get(id), history: await exerciseHistory(id), unit: (await getSettings()).unit }), [id]);
  const [howTo, setHowTo] = useState(false);
  const [editing, setEditing] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const alts = useMemo(() => alternatives(id), [id, lib]);
  const openAlt = (altId: string) => go({ name: 'exercise', id: altId, from: { name: 'exercise', id, from: back } });
  const [target, setTargetText] = useState<string | null>(null);
  if (!lib || !data?.ex) return null;
  const { ex, history, unit } = data;
  const bw = lib.equipment === 'bodyweight';

  const save = (patch: Partial<Pick<typeof ex, 'repMin' | 'repMax' | 'increment' | 'restSec'>>) =>
    updateExerciseSettings(id, { repMin: ex.repMin, repMax: ex.repMax, increment: ex.increment, restSec: ex.restSec, ...patch });
  const targetVal = target ?? (ex.targetWeight === null ? '' : String(ex.targetWeight));
  const targetNum = Number(targetVal);
  const targetChanged = target !== null && targetVal.trim() !== '' && Number.isFinite(targetNum) && targetNum >= 0 && targetNum !== ex.targetWeight;

  return (
    <main className="screen">
      <button className="back" style={{ alignSelf: 'start' }} onClick={() => go(back)}>‹ Back</button>
      <div className="ex-head">
        <div>
          <span className="eyebrow">{lib.group}{lib.custom ? ' · your exercise' : ''}</span>
          <h1 className="ex-name">{lib.name}</h1>
          {lib.custom
            ? <button className="link" onClick={() => setEditing(true)}>Edit name and group</button>
            : <button className="link" onClick={() => setHowTo(true)}>How to do it</button>}
        </div>
        {lib.custom ? <Demo id={id} className="demo-thumb" /> : (
          <button className="demo-thumb" onClick={() => setHowTo(true)} aria-label={`How to do ${lib.name}`}>
            <Demo id={id} /><span className="demo-thumb-tag">How to</span>
          </button>
        )}
      </div>

      <section className="card stack">
        <h2 className="subtitle">Next session</h2>
        {lib.repsOnly ? (
          <p className="small muted">Reps only: no added weight. When every set reaches the top of the range, raise the range or move to a harder exercise.</p>
        ) : (
          <div className="row">
            <label className="field">
              <span>{bw ? `Added weight (${unit})` : `Target weight (${unit})`}</span>
              <input type="number" inputMode="decimal" min={0} step="any" value={targetVal} placeholder="Not set" onChange={(e) => setTargetText(e.target.value)} />
            </label>
            {targetChanged && <button className="btn" style={{ alignSelf: 'end' }} onClick={async () => { await setTarget(id, targetNum); setTargetText(null); }}>Save</button>}
          </div>
        )}
        {ex.stallCount > 0 && <p className="small muted">{ex.stallCount} session{ex.stallCount === 1 ? '' : 's'} without progress (a deload comes after 3).</p>}
      </section>

      <section className="card stack">
        <h2 className="subtitle">Settings</h2>
        <div className="stack" style={{ gap: 6 }}>
          <span>Rep range</span>
          <div className="row" style={{ flexWrap: 'nowrap', justifyContent: 'space-between' }}>
            <div className="stepper"><button aria-label="Lower minimum" disabled={ex.repMin <= 1} onClick={() => save({ repMin: ex.repMin - 1 })}>−</button><output>{ex.repMin}</output>
              <button aria-label="Raise minimum" disabled={ex.repMin >= ex.repMax} onClick={() => save({ repMin: ex.repMin + 1 })}>+</button></div>
            <span className="muted">to</span>
            <div className="stepper"><button aria-label="Lower maximum" disabled={ex.repMax <= ex.repMin} onClick={() => save({ repMax: ex.repMax - 1 })}>−</button><output>{ex.repMax}</output>
              <button aria-label="Raise maximum" disabled={ex.repMax >= 30} onClick={() => save({ repMax: ex.repMax + 1 })}>+</button></div>
          </div>
        </div>
        <div className="spread">
          <span>Rest</span>
          <div className="stepper"><button aria-label="Shorter rest" disabled={ex.restSec <= 15} onClick={() => save({ restSec: ex.restSec - 15 })}>−</button>
            <output>{fmtRest(ex.restSec)}</output><button aria-label="Longer rest" disabled={ex.restSec >= 600} onClick={() => save({ restSec: ex.restSec + 15 })}>+</button></div>
        </div>
        {!lib.repsOnly && (
          <div className="spread">
            <span>Weight step</span>
            <div className="stepper"><button aria-label="Smaller step" disabled={ex.increment <= 0.5} onClick={() => save({ increment: Math.max(0.5, ex.increment - 0.5) })}>−</button>
              <output>{fmtNum(ex.increment)}</output><button aria-label="Bigger step" disabled={ex.increment >= 20} onClick={() => save({ increment: ex.increment + 0.5 })}>+</button>
              <span className="small muted">{unit}</span></div>
          </div>
        )}
        <p className="small muted">Changing the rep range keeps your weight and restarts the stall count.</p>
      </section>

      <section className="stack">
        <h2 className="subtitle">Top set weight</h2>
        {history.length >= 2 ? <ProgressChart points={history} unit={unit} /> : <p className="small muted">The chart appears after two sessions.</p>}
        {history.length > 0 && (
          <table className="history">
            <thead><tr><th>Date</th><th>Sets</th><th>Top</th></tr></thead>
            <tbody>
              {[...history].reverse().slice(0, 12).map((h) => (
                <tr key={h.sessionId}>
                  <td>{day(h.date)}</td>
                  <td className="num">{h.sets.map((s) => s.reps).join(' / ')}</td>
                  <td className="num">{fmtWeight(h.topWeight, unit, lib.equipment)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="stack">
        <div>
          <h2 className="subtitle">Alternatives</h2>
          <p className="small muted">{alts.length ? 'Work the same muscles, for when the equipment is busy or missing.' : 'Nothing else in the library works the same muscles.'}</p>
        </div>
        {alts.length > 0 && (
          <div className="list">
            {alts.slice(0, 5).map((a) => (
              <button key={a.id} className="list-row" onClick={() => openAlt(a.id)}>
                <Demo id={a.id} still className="demo-mini" />
                <span className="grow">
                  <span className="name">{a.name}</span>
                  <span className="small muted" style={{ display: 'block' }}>{equipmentLabel(a)}</span>
                </span>
                <span className="chev" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        )}
        {alts.length > 5 && <button className="btn" onClick={() => setBrowsing(true)}>All {alts.length} alternatives</button>}
      </section>

      {browsing && <ExercisePicker title="Alternatives" similarTo={id} allowCreate={false} onClose={() => setBrowsing(false)} onPick={openAlt} />}
      {howTo && <HowToSheet id={id} onClose={() => setHowTo(false)} />}
      {editing && (
        <div className="sheet" onClick={() => setEditing(false)}>
          <div className="sheet-card" role="dialog" aria-label={`Edit ${lib.name}`} onClick={(e) => e.stopPropagation()}>
            <h2>Edit exercise</h2>
            <CustomExerciseForm editing initial={{ name: lib.name, group: lib.group, equipment: lib.equipment, perSide: lib.perSide, repsOnly: lib.repsOnly }}
              submitLabel="Save" onCancel={() => setEditing(false)}
              onSubmit={async (v) => { await updateCustomExercise(id, { name: v.name, group: v.group, perSide: v.perSide }); setEditing(false); }} />
          </div>
        </div>
      )}
    </main>
  );
}
