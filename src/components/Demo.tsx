import { useEffect, useRef, useState } from 'react';
import { figSVG, hasDemo, libraryExercise } from '../lib/library';

const initials = (name: string) => name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

/** An exercise Demo figure. `still` skips the animation (used in long lists). A Custom Exercise shows its initials instead. */
export function Demo({ id, still = false, className }: { id: string; still?: boolean; className?: string }) {
  const lib = libraryExercise(id);
  if (!lib) return null;
  if (!hasDemo(id)) return <span className={`${className ?? ''} demo-none`} aria-hidden="true">{initials(lib.name)}</span>;
  let html = figSVG(id, `Animation of ${lib.name}`);
  if (still) html = html.replace('<svg ', '<svg data-still="" ');
  return <span className={className} style={{ display: 'block' }} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** The large how-to view: the Demo with a live label, the rep cues in time with it, set-up and common mistakes. */
export function HowToSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const lib = libraryExercise(id);
  const figRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<{ label: string; cue: number } | null>(null);

  useEffect(() => {
    const el = figRef.current;
    if (!el) return;
    const on = (ev: Event) => {
      const d = (ev as CustomEvent).detail as { label: string; cue: number; still: boolean };
      if (!d.still) setStage({ label: d.label, cue: d.cue });
    };
    el.addEventListener('figstage', on);
    const key = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => { el.removeEventListener('figstage', on); window.removeEventListener('keydown', key); };
  }, [onClose]);

  if (!lib || lib.custom) return null;
  return (
    <div className="sheet" onClick={onClose}>
      <div className="sheet-card" role="dialog" aria-label={`How to do ${lib.name}`} onClick={(e) => e.stopPropagation()}>
        <div className="spread" style={{ alignItems: 'start' }}>
          <div>
            <h2>{lib.name}</h2>
            <p className="small muted">Works: {lib.form.works.toLowerCase()}</p>
          </div>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
        <div className="howto-fig" ref={figRef}>
          <Demo id={id} />
          <span className="phase" aria-hidden="true">{stage?.label ?? ''}</span>
        </div>
        <section>
          <h3>The rep</h3>
          <ol className={stage ? 'live' : ''}>
            {lib.cues.map((c, i) => <li key={i} className={stage?.cue === i ? 'on' : ''}>{c}</li>)}
          </ol>
        </section>
        <section>
          <h3>Set-up</h3>
          <ul>{lib.form.setup.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </section>
        <section>
          <h3>Common mistakes</h3>
          <ul className="faults">{lib.form.mistakes.map(([fault, fix], i) => <li key={i}><b>{fault}.</b> <span>{fix}</span></li>)}</ul>
        </section>
        {lib.form.safety && <p className="safety">{lib.form.safety}</p>}
      </div>
    </div>
  );
}
