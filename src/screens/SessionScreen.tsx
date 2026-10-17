import { useLiveQuery } from 'dexie-react-hooks';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Go } from '../App';
import { Demo, HowToSheet } from '../components/Demo';
import { ExercisePicker } from '../components/ExercisePicker';
import { db, type ExerciseState, type LoggedSet, type Session, type Slot } from '../data/db';
import {
  discardSession, finishSession, firstTimes, getSettings, lastSessionSets, logSet, sessionSets, setTarget, swapSlot, tooShort, undoLastSet, updateSessionUi,
} from '../data/repo';
import { setWarnings, targetWarning } from '../domain/checks';
import { shouldOfferDrop } from '../domain/progression';
import { fmtNum, fmtWeight, type Unit } from '../domain/units';
import { warmupSets } from '../domain/warmups';
import { libraryExercise, type LibraryExercise } from '../lib/library';
import { useGymDevice } from './useGymDevice';

const r2 = (x: number) => Math.round(x * 100) / 100;
const fmtClock = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const RING = 653.45;

interface Draft { reps: number; rir: number | null }

interface Ctx {
  session: Session;
  exercises: Record<string, ExerciseState>;
  sets: LoggedSet[];
  unit: Unit;
  /** Exercises being trained for the first time in this Session. */
  first: Record<string, boolean>;
}

/** "Check this?" warnings for the set about to be logged. */
function draftWarnings(ctx: Ctx, index: number, reps: number): string[] {
  const { slot, ex, lib, done, weight } = slotInfo(ctx, index);
  if (!ex || weight === null) return [];
  return setWarnings({ weight, reps, target: ex.targetWeight, repMin: ex.repMin, otherReps: done.map((x) => x.reps), first: !!ctx.first[slot.exerciseId], bodyweight: lib.equipment === 'bodyweight' },
    (w) => fmtWeight(w, ctx.unit, lib.equipment));
}

function CheckThis({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return <div className="notice warn" role="status"><span><b>Check this?</b> {warnings.join(' ')}</span></div>;
}

/** Per-Slot view of where the Lifter is. */
function slotInfo(ctx: Ctx, index: number) {
  const slot: Slot = ctx.session.plan[index];
  const ex = ctx.exercises[slot.exerciseId];
  const lib = libraryExercise(slot.exerciseId) as LibraryExercise;
  const done = ctx.sets.filter((s) => s.exerciseId === slot.exerciseId);
  const weight = ctx.session.ui.weightNow[slot.exerciseId] ?? ex?.targetWeight ?? null;
  const warm = warmupSets(ex?.targetWeight ?? null, ex?.increment ?? 0, ctx.unit, lib.equipment);
  const warmDone = Math.min(ctx.session.ui.warm[slot.exerciseId] ?? 0, warm.length);
  return { slot, ex, lib, done, weight, warm, warmDone, complete: done.length >= slot.sets };
}

export function SessionScreen({ id, go }: { id: string; go: Go }) {
  const ctx = useLiveQuery(async (): Promise<Ctx | null> => {
    const session = await db.sessions.get(id);
    if (!session) return null;
    const ids = [...new Set(session.plan.map((p) => p.exerciseId))];
    const exercises = Object.fromEntries((await db.exercises.bulkGet(ids)).filter((e): e is ExerciseState => !!e).map((e) => [e.id, e]));
    return { session, exercises, sets: await sessionSets(id), unit: (await getSettings()).unit, first: await firstTimes(ids, id) };
  }, [id]);
  const currentId = ctx ? ctx.session.plan[ctx.session.ui.current]?.exerciseId : undefined;
  const lastSets = useLiveQuery(async () => (currentId ? lastSessionSets(currentId, id) : []), [currentId, id]) ?? [];

  const [view, setView] = useState<'focus' | 'list'>('focus');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [howTo, setHowTo] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);
  /** Exercise picked as a Swap, waiting for "permanently or just today?". */
  const [swapTo, setSwapTo] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [editWeight, setEditWeight] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const fired = useRef<number | null>(null);
  const { unlock, beep } = useGymDevice();

  const rest = ctx?.session.ui.rest ?? null;
  useEffect(() => {
    if (!rest) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [rest]);
  useEffect(() => {
    if (rest && now >= rest.endsAt && fired.current !== rest.endsAt) {
      fired.current = rest.endsAt;
      beep();
      void updateSessionUi(id, { rest: null, restOver: true });
    }
  }, [rest, now, id, beep]);

  if (ctx === undefined) return null;
  if (ctx === null) {
    return <main className="screen"><p className="muted">This session no longer exists.</p><button className="btn" onClick={() => go({ name: 'home' })}>Back to start</button></main>;
  }

  const { session, unit } = ctx;
  const ui = session.ui;
  const cur = Math.min(ui.current, session.plan.length - 1);
  const totalSets = session.plan.reduce((a, s) => a + s.sets, 0);
  const doneSets = session.plan.reduce((a, s) => a + Math.min(s.sets, ctx.sets.filter((x) => x.exerciseId === s.exerciseId).length), 0);

  const draftFor = (exId: string, n: number, weight: number | null, last: LoggedSet[]): Draft => {
    const key = `${exId}-${n}`;
    if (drafts[key]) return drafts[key];
    const ex = ctx.exercises[exId], prev = last.find((x) => x.n === n);
    return { reps: prev && weight !== null && prev.weight === weight ? prev.reps : ex?.repMin ?? 8, rir: null };
  };
  const setDraft = (exId: string, n: number, d: Draft) => setDrafts((all) => ({ ...all, [`${exId}-${n}`]: d }));

  const doLog = async (index: number, d: Draft) => {
    const info = slotInfo(ctx, index);
    if (info.weight === null || !info.ex) return;
    await logSet(id, info.slot.exerciseId, info.weight, d.reps, d.rir);
    const logged = info.done.length + 1;
    const lastOfSession = index === session.plan.length - 1 && logged >= info.slot.sets;
    const finishedSlot = logged >= info.slot.sets;
    const restMs = info.ex.restSec * 1000;
    await updateSessionUi(id, {
      current: finishedSlot && index < session.plan.length - 1 ? index + 1 : index,
      drop: shouldOfferDrop(d.reps, info.ex.repMin, logged, info.slot.sets) ? info.slot.exerciseId : null,
      rest: lastOfSession ? null : { endsAt: Date.now() + restMs, durMs: restMs, exerciseId: info.slot.exerciseId },
      restOver: false,
    });
    setNow(Date.now());
  };

  const upNext = (): string => {
    const i = rest ? session.plan.findIndex((p) => p.exerciseId === rest.exerciseId) : cur;
    const info = slotInfo(ctx, Math.max(0, i));
    if (!info.complete && info.weight !== null) return `${info.lib.name} · set ${info.done.length + 1} of ${info.slot.sets} · ${fmtWeight(info.weight, unit, info.lib.equipment)}`;
    const next = session.plan.findIndex((_, k) => k > i && !slotInfo(ctx, k).complete);
    return next >= 0 ? `Next exercise: ${libraryExercise(session.plan[next].exerciseId)?.name}` : 'All sets done. Finish the session when ready.';
  };

  const restBar = rest ? (
    <div className="restbar" role="timer" aria-live="off">
      <div className="restbar-fill" style={{ width: `${Math.max(0, (rest.endsAt - now) / rest.durMs) * 100}%` }} />
      <div className="restbar-in">
        <div><div className="eyebrow">Resting</div><div className="num restbar-time">{fmtClock(rest.endsAt - now)}</div></div>
        <div className="restbar-next">{upNext()}</div>
        <div className="restbar-btns">
          <button onClick={() => adjustRest(-15)}>−15</button>
          <button onClick={() => adjustRest(15)}>+15</button>
          <button onClick={() => updateSessionUi(id, { rest: null, restOver: true })}>Skip</button>
        </div>
      </div>
    </div>
  ) : ui.restOver ? (
    <div className="restbar go"><div className="restbar-in"><b>Rest over</b><span className="restbar-next">{upNext()}</span></div></div>
  ) : null;

  function adjustRest(sec: number) {
    if (!rest) return;
    const endsAt = rest.endsAt + sec * 1000;
    if (endsAt <= Date.now()) { void updateSessionUi(id, { rest: null, restOver: true }); return; }
    void updateSessionUi(id, { rest: { ...rest, endsAt, durMs: Math.max(1000, rest.durMs + sec * 1000) } });
  }

  const finish = async () => {
    // With no sets logged the Session is deleted, so there's no summary to show.
    go((await finishSession(id)).length ? { name: 'summary', id } : { name: 'home' });
  };

  return (
    <main className="screen" onPointerDown={unlock}>
      <div className="s-top">
        <button className="back" onClick={() => go({ name: 'home' })} aria-label="Leave the session open and go back">‹ {session.templateName}</button>
        <button className="btn" onClick={() => setFinishing(true)}>Finish</button>
      </div>
      <div className="seg" role="tablist" aria-label="Session view">
        <button role="tab" aria-selected={view === 'focus'} className={view === 'focus' ? 'on' : ''} onClick={() => setView('focus')}>Current set</button>
        <button role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>
          Session <span className="num">{doneSets}/{totalSets}</span>
        </button>
      </div>

      {view === 'focus' ? (
        <Focus ctx={ctx} index={cur} now={now} lastSets={lastSets} unit={unit}
          draftFor={draftFor} setDraft={setDraft} onLog={doLog} upNext={upNext} adjustRest={adjustRest}
          editWeight={editWeight} setEditWeight={setEditWeight}
          onHowTo={setHowTo} onSwap={() => setSwapping(true)} onFinish={() => setFinishing(true)} />
      ) : (
        <ListView ctx={ctx} draftFor={draftFor} setDraft={setDraft} onLog={doLog}
          onOpen={(i) => { void updateSessionUi(id, { current: i }); setView('focus'); window.scrollTo(0, 0); }} />
      )}
      {view === 'list' && restBar}

      {howTo && <HowToSheet id={howTo} onClose={() => setHowTo(null)} />}
      {swapping && currentId && (
        <ExercisePicker title="Swap exercise" similarTo={currentId}
          exclude={session.plan.map((p) => p.exerciseId)}
          onClose={() => setSwapping(false)}
          onPick={(exId) => { setSwapTo(exId); setSwapping(false); }} />
      )}
      {swapTo && currentId && (
        <div className="sheet" onClick={() => setSwapTo(null)}>
          <div className="sheet-card" role="dialog" aria-label="Swap permanently or one-off" onClick={(e) => e.stopPropagation()}>
            <h2>Swap permanently, or one-off substitution?</h2>
            <p>{libraryExercise(swapTo)?.name} in place of {libraryExercise(session.plan[cur].swappedFrom ?? currentId)?.name}.</p>
            <button className="btn-primary" onClick={async () => { await swapSlot(id, cur, swapTo); setSwapTo(null); }}>Just today</button>
            <button className="btn" onClick={async () => { await swapSlot(id, cur, swapTo, true); setSwapTo(null); }}>Permanently: change {session.templateName}</button>
            <button className="link muted" onClick={() => setSwapTo(null)}>Cancel</button>
          </div>
        </div>
      )}
      {finishing && (
        <div className="sheet" onClick={() => setFinishing(false)}>
          <div className="sheet-card" role="dialog" aria-label="Finish session" onClick={(e) => e.stopPropagation()}>
            {doneSets && tooShort(session, Date.now()) ? (
              <>
                <h2>Delete this session?</h2>
                <p>It's lasted under a minute, so it won't count as a session or change any targets.</p>
                <button className="btn-primary" onClick={async () => { await discardSession(id); go({ name: 'home' }); }}>Delete session</button>
              </>
            ) : (
              <>
                <h2>Finish session?</h2>
                <p>{doneSets
                  ? `${doneSets} of ${totalSets} sets logged. DailyRep will update your targets for every exercise you did. Exercises with no sets are left as they are.`
                  : "No sets logged, so this session won't be saved and you'll stay on the same workout next time."}</p>
                <button className="btn-primary" onClick={finish}>Finish and see results</button>
              </>
            )}
            <button className="btn" onClick={() => setFinishing(false)}>Keep training</button>
          </div>
        </div>
      )}
    </main>
  );
}

// ---------- Current set ----------

function LastSession({ last, now, weight, ex, unit, lib }: {
  last: LoggedSet[]; now: number; weight: number; ex: ExerciseState; unit: Unit; lib: LibraryExercise;
}) {
  if (!last.length) return <div className="last"><div className="eyebrow">Last session</div><p className="small muted">First time doing this exercise.</p></div>;
  let note: string | null = null;
  if (now >= 0) {
    const ls = last.find((x) => x.n === now + 1);
    const diff = ls ? r2(weight - ls.weight) : 0;
    note = !ls ? `No set ${now + 1} last time`
      : diff > 0 ? `Weight up ${fmtNum(diff)} ${unit} since then: aim for ${ex.repMin}+ reps`
      : diff < 0 ? `${fmtNum(-diff)} ${unit} lighter today`
      : `Same weight: beat ${ls.reps} reps`;
  }
  return (
    <div className="last">
      <div className="eyebrow">Last session</div>
      <div className="last-rows">
        {last.map((x, k) => (
          <div key={x.id} className={`last-row${k === now ? ' now' : ''}`}>
            <span className="small">Set {x.n}</span>
            <span className="num">{fmtWeight(x.weight, unit, lib.equipment)} × {x.reps}</span>
            <span className="small">{x.rir === null ? '' : `RIR ${x.rir}`}</span>
          </div>
        ))}
      </div>
      {note && <div className="last-note">{note}</div>}
    </div>
  );
}

function BigWeight({ w, unit, lib }: { w: number; unit: Unit; lib: LibraryExercise }) {
  if (lib.equipment === 'bodyweight') {
    return w > 0
      ? <div className="big-weight num bw">BW + {fmtNum(w)}<small> {unit}</small></div>
      : <div className="big-weight num bw">Bodyweight</div>;
  }
  return <div className="big-weight num">{fmtNum(w)}<small> {unit}</small></div>;
}

function Focus(p: {
  ctx: Ctx; index: number; now: number; lastSets: LoggedSet[]; unit: Unit;
  draftFor: (exId: string, n: number, weight: number | null, last: LoggedSet[]) => Draft;
  setDraft: (exId: string, n: number, d: Draft) => void;
  onLog: (index: number, d: Draft) => Promise<void>;
  upNext: () => string;
  adjustRest: (sec: number) => void;
  editWeight: string | null; setEditWeight: (v: string | null) => void;
  onHowTo: (id: string) => void; onSwap: () => void; onFinish: () => void;
}) {
  const { ctx, index, unit } = p;
  const { session } = ctx;
  const id = session.id;
  const info = slotInfo(ctx, index);
  const { slot, ex, lib, done, weight, warm, warmDone } = info;
  const rest = session.ui.rest;
  const go = (i: number) => updateSessionUi(id, { current: i, drop: null });

  let body: ReactNode;
  if (!ex) {
    body = <section className="set-card"><p className="muted">Loading…</p></section>;
  } else if (rest) {
    const left = rest.endsAt - p.now;
    body = (
      <section className="set-card">
        <div className="eyebrow">Rest</div>
        <div className="ring" role="timer" aria-label={`Rest, ${fmtClock(left)} left`}>
          <svg viewBox="0 0 240 240"><circle cx="120" cy="120" r="104" className="ring-bg" />
            <circle cx="120" cy="120" r="104" className="ring-fg" strokeDasharray={RING} strokeDashoffset={RING * (1 - Math.max(0, left / rest.durMs))} transform="rotate(-90 120 120)" /></svg>
          <div className="ring-txt num">{fmtClock(left)}</div>
        </div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn" onClick={() => p.adjustRest(-15)}>−15 s</button>
          <button className="btn" onClick={() => p.adjustRest(15)}>+15 s</button>
          <button className="btn" onClick={() => updateSessionUi(id, { rest: null, restOver: true })}>Skip</button>
        </div>
        <div className="grow" />
        <div className="upnext"><div className="eyebrow">Up next</div><div>{p.upNext()}</div></div>
      </section>
    );
  } else if (ex.targetWeight === null || p.editWeight !== null) {
    const val = p.editWeight ?? '';
    const n = Number(val);
    const ok = val.trim() !== '' && Number.isFinite(n) && n >= 0;
    body = (
      <section className="set-card">
        <div className="eyebrow">{ex.targetWeight === null ? 'Starting weight' : 'Change weight'}</div>
        <p>{ex.targetWeight === null
          ? `Pick a weight you can lift for ${ex.repMin} reps with 2 or 3 reps to spare. DailyRep adjusts it from there.`
          : 'Set a new target weight. Progress at the old weight is reset.'}</p>
        <label className="field" style={{ justifyItems: 'center' }}>
          <span>{lib.equipment === 'bodyweight' ? `Added weight (${unit}), 0 for bodyweight` : `Weight (${unit})`}</span>
          <input type="number" inputMode="decimal" min={0} step="any" value={val} autoFocus
            onChange={(e) => p.setEditWeight(e.target.value)} aria-label="Weight" />
        </label>
        {ok && lib.equipment !== 'bodyweight' && <CheckThis warnings={[targetWarning(r2(n), ex.targetWeight, (w) => fmtWeight(w, unit)) ?? ''].filter(Boolean)} />}
        <div className="grow" />
        <button className="btn-primary" disabled={!ok} onClick={async () => { await setTarget(slot.exerciseId, r2(n)); p.setEditWeight(null); }}>Save weight</button>
        {ex.targetWeight !== null && <button className="link muted" onClick={() => p.setEditWeight(null)}>Cancel</button>}
      </section>
    );
  } else if (warmDone < warm.length) {
    const w = warm[warmDone];
    body = (
      <section className="set-card">
        <div className="eyebrow">Warm-up {warmDone + 1} of {warm.length}</div>
        <div className="big-weight num">{fmtNum(w.weight)}<small> {unit}</small></div>
        <div className="big-reps num">× {w.reps}</div>
        <LastSession last={p.lastSets} now={-1} weight={weight ?? 0} ex={ex} unit={unit} lib={lib} />
        <div className="grow" />
        <button className="btn-primary" onClick={() => updateSessionUi(id, { warm: { ...session.ui.warm, [slot.exerciseId]: warmDone + 1 } })}>Done</button>
        <button className="link muted" onClick={() => updateSessionUi(id, { warm: { ...session.ui.warm, [slot.exerciseId]: warm.length } })}>Skip warm-ups</button>
      </section>
    );
  } else if (!info.complete && weight !== null) {
    const n = done.length + 1;
    const d = p.draftFor(slot.exerciseId, n, weight, p.lastSets);
    const drop = session.ui.drop === slot.exerciseId;
    body = (
      <>
        {drop && (
          <div className="notice warn" role="status">
            <span><b>Below {ex.repMin} reps.</b> Drop to {fmtWeight(r2(weight - ex.increment), unit, lib.equipment)} for the remaining sets? Next session's target stays {fmtWeight(ex.targetWeight, unit, lib.equipment)}.</span>
            <div className="row">
              <button className="btn" onClick={() => updateSessionUi(id, { drop: null, weightNow: { ...session.ui.weightNow, [slot.exerciseId]: Math.max(0, r2(weight - ex.increment)) } })}>Drop weight</button>
              <button className="btn" onClick={() => updateSessionUi(id, { drop: null })}>Keep going</button>
            </div>
          </div>
        )}
        <section className="set-card">
          {session.ui.restOver && <div className="pill-go">Rest over · go</div>}
          <div className="eyebrow">Set {n} of {slot.sets}</div>
          <BigWeight w={weight} unit={unit} lib={lib} />
          {done.length === 0 && !session.ui.weightNow[slot.exerciseId] && (
            <button className="link muted" onClick={() => p.setEditWeight(String(ex.targetWeight))}>Change weight</button>
          )}
          <LastSession last={p.lastSets} now={done.length} weight={weight} ex={ex} unit={unit} lib={lib} />
          <div className="reps-stepper">
            <button aria-label="One fewer rep" onClick={() => p.setDraft(slot.exerciseId, n, { ...d, reps: Math.max(0, d.reps - 1) })}>−</button>
            <div className="big-reps num" aria-live="polite">{d.reps}</div>
            <button aria-label="One more rep" onClick={() => p.setDraft(slot.exerciseId, n, { ...d, reps: d.reps + 1 })}>+</button>
          </div>
          <div className="small muted">reps{lib.perSide ? ' per side' : ''} · aim {ex.repMin}–{ex.repMax}</div>
          <div className="rir">
            <span className="small muted">Reps left in the tank (optional)</span>
            <div className="rir-chips">
              {[0, 1, 2, 3, 4].map((v) => (
                <button key={v} className={d.rir === v ? 'on' : ''} aria-pressed={d.rir === v}
                  onClick={() => p.setDraft(slot.exerciseId, n, { ...d, rir: d.rir === v ? null : v })}>{v === 4 ? '4+' : v}</button>
              ))}
            </div>
          </div>
          <CheckThis warnings={draftWarnings(ctx, index, d.reps)} />
          <div className="grow" />
          <button className="btn-primary" onClick={() => p.onLog(index, d)}>Done</button>
          {done.length > 0 && <button className="link muted" onClick={() => undoLastSet(id, slot.exerciseId)}>Undo last set</button>}
        </section>
      </>
    );
  } else {
    const nextOpen = session.plan.findIndex((_, k) => k !== index && !slotInfo(ctx, k).complete);
    body = (
      <section className="set-card">
        <div className="eyebrow">Exercise complete</div>
        <div className="sets-done">
          {done.map((s) => <div key={s.id} className="num">Set {s.n}: <b>{fmtWeight(s.weight, unit, lib.equipment)} × {s.reps}</b>{s.rir === null ? '' : <span className="muted"> RIR {s.rir}</span>}</div>)}
        </div>
        <button className="link muted" onClick={() => undoLastSet(id, slot.exerciseId)}>Undo last set</button>
        <div className="grow" />
        {nextOpen >= 0
          ? <button className="btn-primary" onClick={() => go(nextOpen)}>Next: {libraryExercise(session.plan[nextOpen].exerciseId)?.name}</button>
          : <button className="btn-primary" onClick={p.onFinish}>Finish session</button>}
      </section>
    );
  }

  return (
    <>
      <div className="dots">
        {session.plan.map((s, k) => (
          <button key={k} className={`dot${slotInfo(ctx, k).complete ? ' done' : ''}${k === index ? ' on' : ''}`} onClick={() => go(k)} aria-label={libraryExercise(s.exerciseId)?.name} />
        ))}
      </div>
      <div className="ex-head">
        <div>
          <div className="eyebrow">Exercise {index + 1} of {session.plan.length}{slot.swappedFrom ? ` · swapped for ${libraryExercise(slot.swappedFrom)?.name}` : ''}</div>
          <h1 className="ex-name">{lib.name}</h1>
          {done.length === 0 && <button className="link" onClick={p.onSwap}>Swap exercise</button>}
        </div>
        {lib.custom ? <Demo id={slot.exerciseId} className="demo-thumb" /> : (
          <button className="demo-thumb" onClick={() => p.onHowTo(slot.exerciseId)} aria-label={`How to do ${lib.name}`}>
            <Demo id={slot.exerciseId} />
            <span className="demo-thumb-tag">How to</span>
          </button>
        )}
      </div>
      {body}
      <nav className="s-nav">
        <button className="btn" disabled={index === 0} onClick={() => go(index - 1)}>‹ {index > 0 ? libraryExercise(session.plan[index - 1].exerciseId)?.name : 'Back'}</button>
        <button className="btn" disabled={index === session.plan.length - 1} onClick={() => go(index + 1)}>
          {index < session.plan.length - 1 ? libraryExercise(session.plan[index + 1].exerciseId)?.name : 'Next'} ›
        </button>
      </nav>
    </>
  );
}

// ---------- Whole session list ----------

function ListView({ ctx, draftFor, setDraft, onLog, onOpen }: {
  ctx: Ctx;
  draftFor: (exId: string, n: number, weight: number | null, last: LoggedSet[]) => Draft;
  setDraft: (exId: string, n: number, d: Draft) => void;
  onLog: (index: number, d: Draft) => Promise<void>;
  onOpen: (index: number) => void;
}) {
  const { session, unit } = ctx;
  const RIRS = [null, 0, 1, 2, 3, 4];
  return (
    <div className="stack">
      {session.plan.map((_, i) => {
        const { slot, ex, lib, done, weight, warm, warmDone } = slotInfo(ctx, i);
        return (
          <section key={i} className={`l-ex${i === session.ui.current ? ' on' : ''}`}>
            <button className="l-head" onClick={() => onOpen(i)}>
              <div>
                <h2 className="l-name">{lib.name}</h2>
                <div className="small muted">{ex ? `${ex.repMin}–${ex.repMax} reps · rest ${fmtClock(ex.restSec * 1000)}` : ''}</div>
                <div className="l-open">Open this exercise ›</div>
              </div>
              <span className="l-count num">{Math.min(done.length, slot.sets)}/{slot.sets}</span>
            </button>
            {warm.map((w, k) => (
              <div key={`w${k}`} className={`l-row warm${k < warmDone ? ' logged' : ''}`}>
                <span className="l-set">W</span>
                <span className="num l-w">{fmtNum(w.weight)} {unit}</span>
                <span className="num l-fixed">× {w.reps}</span><span />
                <button className="l-check" disabled={k !== warmDone} aria-label="Warm-up done"
                  onClick={() => updateSessionUi(session.id, { warm: { ...session.ui.warm, [slot.exerciseId]: warmDone + 1 } })}>{k < warmDone ? '✓' : ''}</button>
              </div>
            ))}
            {Array.from({ length: Math.max(slot.sets, done.length) }, (_, k) => {
              if (k < done.length) {
                const s = done[k];
                return (
                  <div key={s.id} className="l-row logged">
                    <span className="l-set">{k + 1}</span>
                    <span className="num l-w">{fmtWeight(s.weight, unit, lib.equipment)}</span>
                    <span className="num l-fixed">× {s.reps}</span>
                    <span className="small muted num">{s.rir === null ? '' : `RIR ${s.rir}`}</span>
                    <span className="l-check" aria-label="Logged">✓</span>
                  </div>
                );
              }
              if (k === done.length && weight !== null && ex) {
                const d = draftFor(slot.exerciseId, k + 1, weight, []);
                const warnings = draftWarnings(ctx, i, d.reps);
                return (
                  <Fragment key={`a${k}`}>
                    {warnings.length > 0 && <div className="l-warn"><CheckThis warnings={warnings} /></div>}
                    <div className="l-row active">
                      <span className="l-set">{k + 1}</span>
                      <span className="num l-w">{fmtWeight(weight, unit, lib.equipment)}</span>
                      <span className="l-step">
                        <button aria-label="One fewer rep" onClick={() => setDraft(slot.exerciseId, k + 1, { ...d, reps: Math.max(0, d.reps - 1) })}>−</button>
                        <span className="num">{d.reps}</span>
                        <button aria-label="One more rep" onClick={() => setDraft(slot.exerciseId, k + 1, { ...d, reps: d.reps + 1 })}>+</button>
                      </span>
                      <button className="l-rir num" onClick={() => setDraft(slot.exerciseId, k + 1, { ...d, rir: RIRS[(RIRS.indexOf(d.rir) + 1) % RIRS.length] })}>
                        {d.rir === null ? 'RIR –' : `RIR ${d.rir === 4 ? '4+' : d.rir}`}
                      </button>
                      <button className="l-check" aria-label="Log set" onClick={() => onLog(i, d)}>✓</button>
                    </div>
                  </Fragment>
                );
              }
              return (
                <div key={`f${k}`} className="l-row future">
                  <span className="l-set">{k + 1}</span>
                  <span className="num l-w">{weight === null ? 'Set weight first' : fmtWeight(weight, unit, lib.equipment)}</span>
                  <span /><span /><span className="l-check" />
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
