import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import type { Go, Route } from '../App';
import { Demo, HowToSheet } from '../components/Demo';
import { ProgressChart } from '../components/ProgressChart';
import { db } from '../data/db';
import { ensureExercises, exerciseHistory, getSettings, setTarget, updateExerciseSettings } from '../data/repo';
import { fmtNum, fmtWeight } from '../domain/units';
import { libraryExercise } from '../lib/library';

const fmtRest = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const day = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** One Exercise: its Demo, the Lifter's settings and target, and its history. */
export function ExerciseScreen({ id, back, go }: { id: string; back: Route; go: Go }) {
  const lib = libraryExercise(id);
  useEffect(() => { void ensureExercises([id]); }, [id]);
  const data = useLiveQuery(async () => ({ ex: await db.exercises.get(id), history: await exerciseHistory(id), unit: (await getSettings()).unit }), [id]);
  const [howTo, setHowTo] = useState(false);
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
          <span className="eyebrow">{lib.group}</span>
          <h1 className="ex-name">{lib.name}</h1>
          <button className="link" onClick={() => setHowTo(true)}>How to do it</button>
        </div>
        <button className="demo-thumb" onClick={() => setHowTo(true)} aria-label={`How to do ${lib.name}`}>
          <Demo id={id} /><span className="demo-thumb-tag">How to</span>
        </button>
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

      {howTo && <HowToSheet id={id} onClose={() => setHowTo(false)} />}
    </main>
  );
}
