import { useLiveQuery } from 'dexie-react-hooks';
import type { Go } from '../App';
import { Demo } from '../components/Demo';
import { db } from '../data/db';
import { getSettings } from '../data/repo';
import { fmtWeight } from '../domain/units';
import { libraryExercise } from '../lib/library';

/** Every Exercise the Lifter has done, most recent first. */
export function ProgressScreen({ go }: { go: Go }) {
  const data = useLiveQuery(async () => {
    const finished = new Set((await db.sessions.filter((s) => s.finishedAt !== null).toArray()).map((s) => s.id));
    const sets = (await db.sets.toArray()).filter((x) => finished.has(x.sessionId));
    const byEx = new Map<string, { last: number; top: number; sessions: Set<string> }>();
    for (const x of sets) {
      const e = byEx.get(x.exerciseId) ?? { last: 0, top: 0, sessions: new Set<string>() };
      if (x.loggedAt > e.last) e.last = x.loggedAt;
      e.sessions.add(x.sessionId);
      byEx.set(x.exerciseId, e);
    }
    for (const x of sets) {
      const e = byEx.get(x.exerciseId)!;
      if (x.loggedAt >= e.last - 4 * 3600_000) e.top = Math.max(e.top, x.weight);   // top weight in the latest session
    }
    return { rows: [...byEx.entries()].sort((a, b) => b[1].last - a[1].last), unit: (await getSettings()).unit };
  }, []);
  if (!data) return null;

  return (
    <main className="screen">
      <button className="back" style={{ alignSelf: 'start' }} onClick={() => go({ name: 'home' })}>‹ Home</button>
      <h1 className="title">Progress</h1>
      {data.rows.length === 0 ? (
        <div className="empty card"><p>Finish your first session to see your progress here.</p></div>
      ) : (
        <div className="list">
          {data.rows.map(([exId, e]) => {
            const lib = libraryExercise(exId);
            return (
              <button key={exId} className="list-row" onClick={() => go({ name: 'exercise', id: exId, from: { name: 'progress' } })}>
                <Demo id={exId} still className="demo-mini" />
                <span className="grow">
                  <span className="name">{lib?.name}</span>
                  <span className="small muted" style={{ display: 'block' }}>
                    {e.sessions.size} session{e.sessions.size === 1 ? '' : 's'} · last {new Date(e.last).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  </span>
                </span>
                <span className="num" style={{ fontSize: 20, fontWeight: 600 }}>{fmtWeight(e.top, data.unit, lib?.equipment)}</span>
                <span className="chev" aria-hidden="true">›</span>
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}
