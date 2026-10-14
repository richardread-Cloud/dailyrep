import { useMemo, useState } from 'react';
import { createCustomExercise } from '../data/repo';
import type { Equipment } from '../domain/units';
import { alternatives, customExercises, GROUPS, LIBRARY, matchesSearch, type Group } from '../lib/library';
import { CustomExerciseForm, EQUIP, equipmentLabel } from './CustomExerciseForm';
import { Demo } from './Demo';

const SAME = 'Same muscles' as const;
type Tab = Group | 'All' | typeof SAME;

/**
 * Choose a Built-in or Custom Exercise, filtered by muscle group, equipment or name, or make a new Custom Exercise.
 * With `similarTo`, it opens on the Exercises that work the same muscles as that one.
 */
export function ExercisePicker({ title, startGroup, similarTo, exclude = [], allowCreate = true, onPick, onClose }: {
  title: string;
  startGroup?: Group;
  similarTo?: string;
  exclude?: string[];
  allowCreate?: boolean;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>(similarTo ? SAME : startGroup ?? 'All');
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const list = useMemo(() => {
    const pool = tab === SAME && similarTo ? alternatives(similarTo) : [...customExercises(), ...LIBRARY];
    return pool.filter((e) => !exclude.includes(e.id) && (tab === SAME || tab === 'All' || e.group === tab)
      && (!equipment || e.equipment === equipment || (equipment === 'bodyweight' && e.bodyweightOk)) && matchesSearch(e, q));
  }, [tab, similarTo, equipment, q, exclude]);
  const tabs: Tab[] = [...(similarTo ? [SAME] : []), 'All', ...GROUPS];
  const group = tab === SAME || tab === 'All' ? null : tab;

  return (
    <div className="sheet" onClick={onClose}>
      <div className="sheet-card" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="spread"><h2>{creating ? 'New exercise' : title}</h2><button className="btn" onClick={onClose}>Close</button></div>
        {creating ? (
          <CustomExerciseForm initial={{ name: q.trim(), group, equipment: equipment ?? undefined }} submitLabel="Create and add"
            onCancel={() => setCreating(false)}
            onSubmit={async (v) => onPick(await createCustomExercise(v))} />
        ) : (
          <>
            <input type="search" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" />
            <div className="chips" role="tablist" aria-label="Muscle group">
              {tabs.map((g) => (
                <button key={g} role="tab" aria-selected={tab === g} className={`chip${tab === g ? ' on' : ''}`} onClick={() => setTab(g)}>{g}</button>
              ))}
            </div>
            <div className="chips wrap" role="radiogroup" aria-label="Equipment">
              <button role="radio" aria-checked={!equipment} className={`chip small${!equipment ? ' on' : ''}`} onClick={() => setEquipment(null)}>Any equipment</button>
              {(Object.keys(EQUIP) as Equipment[]).map((k) => (
                <button key={k} role="radio" aria-checked={equipment === k} className={`chip small${equipment === k ? ' on' : ''}`} onClick={() => setEquipment(equipment === k ? null : k)}>{EQUIP[k]}</button>
              ))}
            </div>
            {tab === SAME && <p className="small muted">Closest first. Use the equipment buttons to show only what you have.</p>}
            <div className="list">
              {list.length === 0 && <p className="empty">{tab === SAME && !equipment && !q.trim() ? 'Nothing else works the same muscles. Try a muscle group.' : 'No exercises match.'}</p>}
              {list.map((e) => (
                <button key={e.id} className="list-row" onClick={() => onPick(e.id)}>
                  <Demo id={e.id} still className="demo-mini" />
                  <span className="grow">
                    <span className="name">{e.name}</span>{e.custom && <> <span className="tag">Yours</span></>}
                    <span className="small muted" style={{ display: 'block' }}>
                      {equipmentLabel(e)} · {tab === SAME && e.form.works ? `works ${e.form.works.toLowerCase()}` : `${e.min}–${e.max} reps${e.perSide ? ' per side' : ''}`}
                    </span>
                  </span>
                  <span className="chev" aria-hidden="true">›</span>
                </button>
              ))}
            </div>
            {allowCreate && <button className="btn" onClick={() => setCreating(true)}>+ Create your own{q.trim() ? `: “${q.trim()}”` : ''}</button>}
          </>
        )}
      </div>
    </div>
  );
}
