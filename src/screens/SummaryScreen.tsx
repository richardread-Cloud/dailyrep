import { useLiveQuery } from 'dexie-react-hooks';
import type { Go } from '../App';
import { db } from '../data/db';
import { getSettings, sessionSets } from '../data/repo';
import { fmtWeight } from '../domain/units';
import { libraryExercise } from '../lib/library';

/** After finishing: what changed for each Exercise and why. */
export function SummaryScreen({ id, go }: { id: string; go: Go }) {
  const data = useLiveQuery(async () => ({ session: await db.sessions.get(id), sets: await sessionSets(id), unit: (await getSettings()).unit }), [id]);
  if (!data) return null;
  const { session, sets, unit } = data;
  if (!session) return null;
  const mins = session.finishedAt ? Math.round((session.finishedAt - session.startedAt) / 60000) : 0;

  return (
    <main className="screen">
      <div className="stack">
        <span className="eyebrow">Session complete</span>
        <h1 className="title">{session.templateName}</h1>
        <p className="muted">{sets.length} sets in {mins} min</p>
      </div>
      {session.results?.length ? (
        <div className="list">
          {session.results.map((r) => {
            const lib = libraryExercise(r.exerciseId);
            const done = sets.filter((s) => s.exerciseId === r.exerciseId);
            return (
              <div key={r.exerciseId} className="result">
                <div className="spread"><b>{lib?.name}</b><span className={`small kind kind-${r.kind}`}>{r.summary}</span></div>
                <span className="small muted num" style={{ fontSize: 16 }}>{done.map((s) => `${fmtWeight(s.weight, unit, lib?.equipment)} × ${s.reps}`).join(' · ')}</span>
                <span className="small">{r.detail}</span>
              </div>
            );
          })}
        </div>
      ) : <p className="muted">No sets were logged, so nothing changed.</p>}
      <div className="grow" />
      <button className="btn-primary" onClick={() => go({ name: 'home' })}>Done</button>
    </main>
  );
}
