import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import type { Go } from '../App';
import { Brand } from '../components/Brand';
import { activeSession, cycle, discardSession, getSettings, startSession } from '../data/repo';
import { quoteForDate } from '../lib/library';

/** The opening screen: today's quote, the next workout in the Cycle and a way in. */
export function Home({ go }: { go: Go }) {
  const data = useLiveQuery(async () => ({ templates: await cycle(), settings: await getSettings(), active: await activeSession() }), []);
  const [choosing, setChoosing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const quote = quoteForDate(new Date());

  if (!data) return null;
  const { templates, settings, active } = data;
  const next = templates[settings.nextTemplate] ?? templates[0];
  const start = async (templateId: string) => go({ name: 'session', id: await startSession(templateId) });

  return (
    <main className="screen">
      <Brand big />
      <figure className="open-quote">
        <span className="open-mark" aria-hidden="true">&ldquo;</span>
        <blockquote className={`open-q${quote.q.length > 70 ? ' long' : ''}`}>{quote.q}</blockquote>
        <figcaption className="open-by">{quote.by}</figcaption>
      </figure>

      {active ? (
        <div className="stack">
          <div className="open-today"><span className="eyebrow">In progress</span><h2>{active.templateName}</h2></div>
          <button className="btn-primary" onClick={() => go({ name: 'session', id: active.id })}>Resume session</button>
          {confirmDiscard ? (
            <div className="notice warn">
              <span><b>Discard this session?</b> Sets you've logged in it will be deleted and nothing will progress.</span>
              <div className="row">
                <button className="btn danger" onClick={() => { discardSession(active.id); setConfirmDiscard(false); }}>Discard session</button>
                <button className="btn" onClick={() => setConfirmDiscard(false)}>Keep it</button>
              </div>
            </div>
          ) : <button className="link muted" onClick={() => setConfirmDiscard(true)}>Discard this session</button>}
        </div>
      ) : next ? (
        <div className="stack">
          <div className="spread" style={{ alignItems: 'end' }}>
            <div className="open-today"><span className="eyebrow">Today</span><h2>{next.name}</h2></div>
            <span className="num muted" style={{ fontSize: 20, fontWeight: 600 }}>
              {next.slots.length} exercises · {next.slots.reduce((a, s) => a + s.sets, 0)} sets
            </span>
          </div>
          <button className="btn-primary" disabled={!next.slots.length} onClick={() => start(next.id)}>Start session</button>
          {templates.length > 1 && (choosing ? (
            <div className="list">
              {templates.map((t) => (
                <button key={t.id} className="list-row" disabled={!t.slots.length} onClick={() => start(t.id)}>
                  <span className="grow"><span className="name">{t.name}</span>
                    <span className="small muted" style={{ display: 'block' }}>{t.slots.length} exercises</span></span>
                  <span className="chev" aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          ) : <button className="link muted" onClick={() => setChoosing(true)}>Do a different workout</button>)}
        </div>
      ) : (
        <div className="stack">
          <p className="muted">You don't have any workouts yet.</p>
          <button className="btn-primary" onClick={() => go({ name: 'program' })}>Build your program</button>
        </div>
      )}

      <nav className="open-nav" aria-label="Main">
        <button onClick={() => go({ name: 'program' })}>Program</button>
        <button onClick={() => go({ name: 'progress' })}>Progress</button>
        <button onClick={() => go({ name: 'settings' })}>Settings</button>
      </nav>
    </main>
  );
}
