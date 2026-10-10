import { useState } from 'react';
import type { HistoryPoint } from '../data/repo';
import { fmtNum, type Unit } from '../domain/units';

const W = 340, H = 180, PAD = { l: 36, r: 56, t: 16, b: 26 };
const day = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function niceTicks(lo: number, hi: number, n = 4): number[] {
  if (hi === lo) { hi = lo + 1; lo = Math.max(0, lo - 1); }
  const raw = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.floor(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

/** Top-set weight per Session for one Exercise. One series, so the title names it and there is no legend. */
export function ProgressChart({ points, unit }: { points: HistoryPoint[]; unit: Unit }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;
  const ys = points.map((p) => p.topWeight);
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys));
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / (points.length - 1);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.t - PAD.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.topWeight).toFixed(1)}`).join(' ');
  const last = points.length - 1;
  const xLabels = points.length <= 6 ? points.map((_, i) => i) : [0, Math.round(last / 2), last];

  const pick = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect(), sx = ((clientX - r.left) / r.width) * W;
    let best = 0;
    points.forEach((_, i) => { if (Math.abs(x(i) - sx) < Math.abs(x(best) - sx)) best = i; });
    setHover(best);
  };
  const h = hover === null ? null : points[hover];

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Top set weight over ${points.length} sessions, latest ${fmtNum(ys[last])} ${unit}`}
        onPointerMove={(e) => pick(e.clientX, e.currentTarget)} onPointerDown={(e) => pick(e.clientX, e.currentTarget)} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
            <text className="axis-label" x={PAD.l - 6} y={y(t) + 4} textAnchor="end">{fmtNum(t)}</text>
          </g>
        ))}
        {xLabels.map((i) => (
          <text key={i} className="axis-label" x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'}>{day(points[i].date)}</text>
        ))}
        {h && <line className="cross" x1={x(hover!)} x2={x(hover!)} y1={PAD.t} y2={H - PAD.b} />}
        <path className="series" d={path} />
        {points.map((p, i) => <circle key={p.sessionId} className={`pt${i === hover ? ' on' : ''}`} cx={x(i)} cy={y(p.topWeight)} r={i === hover || i === last ? 5 : 4} />)}
        <text className="end-label" x={x(last) + 9} y={y(ys[last]) + 4}>{fmtNum(ys[last])} {unit}</text>
      </svg>
      {h && (
        <div className="tip" style={{ left: `${(x(hover!) / W) * 100}%` }}>
          <b>{day(h.date)}</b> · {fmtNum(h.topWeight)} {unit}<br />
          {h.sets.map((s) => s.reps).join(' / ')} reps · est. 1RM {fmtNum(Math.round(h.e1rm * 10) / 10)}
        </div>
      )}
    </div>
  );
}
