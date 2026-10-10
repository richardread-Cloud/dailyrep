import { useMemo, useState } from 'react';
import { GROUPS, LIBRARY, type Group } from '../lib/library';
import { Demo } from './Demo';

const EQUIP: Record<string, string> = { barbell: 'Barbell', dumbbell: 'Dumbbell', cable: 'Cable', machine: 'Machine', bodyweight: 'Bodyweight' };

/** Choose a Built-in Exercise, filtered by muscle group or name. */
export function ExercisePicker({ title, startGroup, exclude = [], onPick, onClose }: {
  title: string;
  startGroup?: Group;
  exclude?: string[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [group, setGroup] = useState<Group | 'All'>(startGroup ?? 'All');
  const [q, setQ] = useState('');
  const list = useMemo(() => LIBRARY.filter((e) =>
    !exclude.includes(e.id) && (group === 'All' || e.group === group) && e.name.toLowerCase().includes(q.trim().toLowerCase())), [group, q, exclude]);

  return (
    <div className="sheet" onClick={onClose}>
      <div className="sheet-card" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="spread"><h2>{title}</h2><button className="btn" onClick={onClose}>Close</button></div>
        <input type="search" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" />
        <div className="chips" role="tablist" aria-label="Muscle group">
          {(['All', ...GROUPS] as const).map((g) => (
            <button key={g} role="tab" aria-selected={group === g} className={`chip${group === g ? ' on' : ''}`} onClick={() => setGroup(g)}>{g}</button>
          ))}
        </div>
        <div className="list">
          {list.length === 0 && <p className="empty">No exercises match.</p>}
          {list.map((e) => (
            <button key={e.id} className="list-row" onClick={() => onPick(e.id)}>
              <Demo id={e.id} still className="demo-mini" />
              <span className="grow">
                <span className="name">{e.name}</span>
                <span className="small muted" style={{ display: 'block' }}>{EQUIP[e.equipment]} · {e.min}–{e.max} reps{e.perSide ? ' per side' : ''}</span>
              </span>
              <span className="chev" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
