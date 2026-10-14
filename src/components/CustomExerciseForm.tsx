import { useState } from 'react';
import type { Equipment } from '../domain/units';
import { GROUPS, type Group } from '../lib/library';

export const EQUIP: Record<Equipment, string> = { barbell: 'Barbell', dumbbell: 'Dumbbell', cable: 'Cable', machine: 'Machine', bodyweight: 'Bodyweight' };
export const equipmentLabel = (e: { equipment: Equipment; bodyweightOk?: boolean }) => `${EQUIP[e.equipment]}${e.bodyweightOk ? ' or bodyweight' : ''}`;

export interface CustomFormValue {
  name: string;
  group: Group | null;
  equipment: Equipment;
  perSide: boolean;
  repsOnly: boolean;
}

/**
 * Name, muscle group and equipment for a Custom Exercise.
 * Equipment and Reps-only are fixed once made (`editing`), because they change what the logged weights mean.
 */
export function CustomExerciseForm({ initial, editing = false, submitLabel, onSubmit, onCancel }: {
  initial: Partial<CustomFormValue>;
  editing?: boolean;
  submitLabel: string;
  onSubmit: (v: CustomFormValue & { group: Group }) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [v, setV] = useState<CustomFormValue>({
    name: initial.name ?? '', group: initial.group ?? null, equipment: initial.equipment ?? 'barbell',
    perSide: initial.perSide ?? false, repsOnly: initial.repsOnly ?? false,
  });
  const set = (patch: Partial<CustomFormValue>) => setV((cur) => ({ ...cur, ...patch }));
  const group = v.group;
  const ok = v.name.trim().length > 0 && group !== null;

  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); if (ok) void onSubmit({ ...v, group }); }}>
      <label className="field">
        <span>Name</span>
        <input value={v.name} maxLength={60} placeholder="e.g. Hack Squat (narrow)" onChange={(e) => set({ name: e.target.value })} autoFocus />
      </label>
      <div className="field">
        <span>Muscle group</span>
        <div className="chips wrap" role="radiogroup" aria-label="Muscle group">
          {GROUPS.map((g) => (
            <button type="button" key={g} role="radio" aria-checked={v.group === g} className={`chip${v.group === g ? ' on' : ''}`} onClick={() => set({ group: g })}>{g}</button>
          ))}
        </div>
      </div>
      {!editing && (
        <div className="field">
          <span>Equipment</span>
          <div className="chips wrap" role="radiogroup" aria-label="Equipment">
            {(Object.keys(EQUIP) as Equipment[]).map((k) => (
              <button type="button" key={k} role="radio" aria-checked={v.equipment === k} className={`chip${v.equipment === k ? ' on' : ''}`} onClick={() => set({ equipment: k })}>{EQUIP[k]}</button>
            ))}
          </div>
        </div>
      )}
      <label className="check"><input type="checkbox" checked={v.perSide} onChange={(e) => set({ perSide: e.target.checked })} /> One side at a time (reps counted per side)</label>
      {!editing && v.equipment === 'bodyweight' && (
        <label className="check"><input type="checkbox" checked={v.repsOnly} onChange={(e) => set({ repsOnly: e.target.checked })} /> Reps only (never add weight)</label>
      )}
      {!editing && <p className="small muted">Rep range, rest and weight step start from sensible defaults for the equipment. You can change them on the exercise's page.</p>}
      <button type="submit" className="btn-primary" disabled={!ok}>{submitLabel}</button>
      <button type="button" className="btn" onClick={onCancel}>Cancel</button>
    </form>
  );
}
