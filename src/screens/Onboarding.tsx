import { useState } from 'react';
import type { Go } from '../App';
import { Brand } from '../components/Brand';
import { acceptStarterProgram, updateSettings } from '../data/repo';
import { STARTER_PROGRAM } from '../domain/starterProgram';
import type { Unit } from '../domain/units';
import { libraryExercise } from '../lib/library';

/** First run: pick units, then take the Starter Program or build your own. */
export function Onboarding({ go, unit }: { go: Go; unit: Unit }) {
  const [busy, setBusy] = useState(false);

  const starter = async () => {
    setBusy(true);
    await acceptStarterProgram();
    go({ name: 'home' });
  };
  const own = async () => {
    setBusy(true);
    await updateSettings({ onboarded: true });
    go({ name: 'program' });
  };

  return (
    <main className="screen">
      <Brand big />
      <div className="stack">
        <h1 className="title">Let's set up your training</h1>
        <p className="muted">DailyRep plans each session, times your rests and adjusts your weights so you keep getting stronger, safely.</p>
      </div>

      <div className="stack">
        <span className="eyebrow">Weights in</span>
        <div className="seg" role="radiogroup" aria-label="Weight unit">
          {(['kg', 'lb'] as const).map((u) => (
            <button key={u} role="radio" aria-checked={unit === u} className={unit === u ? 'on' : ''} onClick={() => updateSettings({ unit: u })}>
              {u === 'kg' ? 'Kilograms (kg)' : 'Pounds (lb)'}
            </button>
          ))}
        </div>
      </div>

      <section className="card stack">
        <div>
          <span className="tag">Recommended</span>
          <h2 className="subtitle" style={{ marginTop: 6 }}>3-day full-body starter program</h2>
          <p className="small muted">Three workouts you rotate through, about an hour each. Main lifts for strength, accessories for size.</p>
        </div>
        {STARTER_PROGRAM.map((t) => (
          <div key={t.name}>
            <b>{t.name}</b>
            <p className="small muted">{t.slots.map((s) => `${libraryExercise(s.exerciseId)?.name} ×${s.sets}`).join(' · ')}</p>
          </div>
        ))}
        <p className="small muted">You'll enter a starting weight for each exercise the first time you do it.</p>
        <button className="btn-primary" disabled={busy} onClick={starter}>Use this program</button>
      </section>

      <button className="btn" disabled={busy} onClick={own}>Build my own program instead</button>
    </main>
  );
}
