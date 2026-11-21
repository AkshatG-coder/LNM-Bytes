import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
const num = (n: number) => Math.round(n).toLocaleString('en-IN');

// ─── Stat tile ───────────────────────────────────────────────────────────────
export function StatTile({ label, value, delta, goodWhenUp = true, note, title }: {
  label: string;
  value: string;
  /** Full value shown on hover when `value` is shortened. */
  title?: string;
  /** Change versus the period before, as a percentage or a number of points. */
  delta?: { amount: number; unit: '%' | ' pts' } | null;
  goodWhenUp?: boolean;
  note?: string;
}) {
  const hasDelta = delta && Number.isFinite(delta.amount) && Math.abs(delta.amount) >= 0.05;
  const up = hasDelta && delta!.amount > 0;
  const good = hasDelta ? (up === goodWhenUp) : true;
  return (
    <div className="rounded-2xl border p-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
      <p className="mt-1 text-2xl font-black truncate" style={{ color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }} title={title ?? value}>{value}</p>
      <p className="mt-1 text-xs h-4" style={{ color: 'var(--color-text-muted)' }}>
        {hasDelta ? (
          <span style={{ color: good ? 'var(--viz-good)' : 'var(--viz-bad)', fontWeight: 700 }}>
            {up ? '▲' : '▼'} {up ? '+' : '−'}{Math.abs(delta!.amount).toFixed(delta!.unit === '%' ? 0 : 1)}{delta!.unit}
          </span>
        ) : null}
        {hasDelta ? ' vs previous period' : note ?? ''}
      </p>
    </div>
  );
}

// ─── Card wrapper ────────────────────────────────────────────────────────────
export function Card({ title, subtitle, children, right }: { title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border p-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-bold" style={{ color: 'var(--color-text-main)' }}>{title}</h2>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    setWidth(ref.current.clientWidth);
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

// ─── Trend line (one measure at a time, so one axis) ─────────────────────────
export interface DayPoint { date: string; label: string; revenue: number; orders: number }

function niceMax(v: number) {
  if (v <= 0) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

function shortDate(iso: string) {
  return new Date(iso + 'T12:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}

export function TrendChart({ data, metric }: { data: DayPoint[]; metric: 'revenue' | 'orders' }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 220;
  const pad = { l: 44, r: 12, t: 12, b: 24 };
  const w = Math.max(width, 240);
  const values = data.map((d) => d[metric]);
  const max = niceMax(Math.max(...values, 0));
  const x = (i: number) => pad.l + (data.length <= 1 ? 0 : (i / (data.length - 1)) * (w - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / max) * (height - pad.t - pad.b);
  const fmt = metric === 'revenue' ? inr : num;
  const tickFmt = (v: number) => (metric === 'revenue' && v >= 1000 ? `₹${v / 1000}K` : metric === 'revenue' ? `₹${v}` : String(v));

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d[metric]).toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor((w - pad.l) / 70))));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.round(((px - pad.l) / (w - pad.l - pad.r)) * (data.length - 1));
    setHover(Math.min(data.length - 1, Math.max(0, i)));
  };
  const last = data.length - 1;
  const h = hover !== null ? data[hover] : null;

  return (
    <div ref={ref} className="relative" style={{ minHeight: height }}>
      {width > 0 && (
        <svg width={w} height={height} role="img" aria-label={`${metric === 'revenue' ? 'Revenue' : 'Orders'} per day`}
          onPointerMove={onMove} onPointerLeave={() => setHover(null)} style={{ touchAction: 'pan-y' }}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="var(--viz-grid)" strokeWidth="1" />
              <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-text-muted)">{tickFmt(t)}</text>
            </g>
          ))}
          {data.map((d, i) => i % labelEvery === 0 && (
            <text key={d.date} x={x(i)} y={height - 6} textAnchor="middle" fontSize="11" fill="var(--color-text-muted)">{shortDate(d.date)}</text>
          ))}
          <path d={area} fill="var(--viz-1)" opacity="0.1" />
          <path d={line} fill="none" stroke="var(--viz-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {/* end value, the one label that is always shown */}
          <circle cx={x(last)} cy={y(data[last][metric])} r="4" fill="var(--viz-1)" stroke="var(--color-surface)" strokeWidth="2" />
          {h && hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height - pad.b} stroke="var(--color-text-muted)" strokeWidth="1" />
              <circle cx={x(hover)} cy={y(h[metric])} r="5" fill="var(--viz-1)" stroke="var(--color-surface)" strokeWidth="2" />
            </g>
          )}
        </svg>
      )}
      {h && hover !== null && (
        <div className="pointer-events-none absolute rounded-lg border px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: Math.min(Math.max(x(hover) - 60, 0), w - 130), top: 0, backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-main)' }}>
          <p className="font-bold">{h.label}, {shortDate(h.date)}</p>
          <p style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(h[metric])}{metric === 'revenue' ? ` from ${h.orders} orders` : ' orders'}</p>
        </div>
      )}
      <details className="mt-3">
        <summary className="text-xs font-semibold cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>View as table</summary>
        <div className="mt-2 max-h-56 overflow-auto">
          <table className="w-full text-xs" style={{ color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
            <thead><tr style={{ color: 'var(--color-text-muted)' }}><th className="text-left py-1">Date</th><th className="text-right">Orders</th><th className="text-right">Revenue</th></tr></thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.date} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="py-1">{d.label}, {shortDate(d.date)}</td><td className="text-right">{d.orders}</td><td className="text-right">{inr(d.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

// ─── Horizontal bars (values at the tip) ─────────────────────────────────────
export function BarList({ rows, format = num, emptyText = 'Nothing to show yet.' }: {
  rows: { label: string; value: number; sub?: string }[];
  format?: (n: number) => string;
  emptyText?: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  if (rows.length === 0) return <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{emptyText}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate" style={{ color: 'var(--color-text-main)' }} title={r.label}>{r.label}</span>
            <span className="font-bold shrink-0" style={{ color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>{format(r.value)}</span>
          </div>
          <div className="mt-1 h-2.5 rounded-r" style={{ width: '100%' }}>
            <div className="h-full" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: 'var(--viz-1)', borderRadius: '0 4px 4px 0' }} />
          </div>
          {r.sub && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{r.sub}</p>}
        </li>
      ))}
    </ul>
  );
}

// ─── One whole split into parts, with a legend ───────────────────────────────
export function SplitBar({ parts, format = inr }: {
  parts: { label: string; value: number; color: string }[];
  format?: (n: number) => string;
}) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const [hover, setHover] = useState<string | null>(null);
  if (total === 0) return <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Nothing to show yet.</p>;
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div>
      <div className="flex h-5 w-full" role="img" aria-label={shown.map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(', ')}>
        {shown.map((p, i) => (
          <div key={p.label} onPointerEnter={() => setHover(p.label)} onPointerLeave={() => setHover(null)}
            title={`${p.label}: ${format(p.value)} (${Math.round((p.value / total) * 100)}%)`}
            style={{ width: `${(p.value / total) * 100}%`, background: p.color, marginLeft: i ? 2 : 0, borderRadius: i === 0 ? '4px 0 0 4px' : i === shown.length - 1 ? '0 4px 4px 0' : 0, opacity: hover && hover !== p.label ? 0.55 : 1 }} />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {shown.map((p) => (
          <li key={p.label} className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-main)' }}>
            <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: p.color }} />
            <span className="truncate capitalize">{p.label}</span>
            <span className="ml-auto font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round((p.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Weekday x hour heatmap, one blue hue, darker means busier ───────────────
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hourText = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'am' : 'pm'}`;

export function Heatmap({ grid }: { grid: number[][] }) {
  const max = Math.max(...grid.flat(), 1);
  const [tip, setTip] = useState<{ d: number; h: number } | null>(null);
  // Hide hours with no orders at the edges of the day
  const hoursUsed = Array.from({ length: 24 }, (_, h) => grid.some((row) => row[h] > 0));
  const first = hoursUsed.indexOf(true);
  const lastIdx = hoursUsed.lastIndexOf(true);
  const hours = first === -1 ? [] : Array.from({ length: lastIdx - first + 1 }, (_, i) => first + i);
  if (hours.length === 0) return <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No orders in this period.</p>;

  return (
    <div className="relative overflow-x-auto no-scrollbar" onPointerLeave={() => setTip(null)}>
      <div style={{ minWidth: hours.length * 26 + 40 }}>
        {DAYS.map((day, d) => (
          <div key={day} className="flex items-center gap-[2px] mb-[2px]">
            <span className="w-10 text-xs shrink-0" style={{ color: 'var(--color-text-muted)' }}>{day}</span>
            {hours.map((h) => {
              const v = grid[d][h];
              return (
                <div key={h} onPointerEnter={() => setTip({ d, h })} onClick={() => setTip({ d, h })}
                  aria-label={`${day} ${hourText(h)}: ${v} orders`}
                  className="h-6 flex-1 rounded-[3px]"
                  style={{ minWidth: 22, background: v === 0 ? 'var(--viz-grid)' : `color-mix(in srgb, var(--viz-1) ${Math.round(18 + (v / max) * 82)}%, transparent)`, opacity: v === 0 ? 0.35 : 1, outline: tip && tip.d === d && tip.h === h ? '2px solid var(--color-text-main)' : 'none' }} />
              );
            })}
          </div>
        ))}
        <div className="flex gap-[2px] mt-1">
          <span className="w-10 shrink-0" />
          {hours.map((h, i) => (
            <span key={h} className="flex-1 text-[10px] text-center" style={{ minWidth: 22, color: 'var(--color-text-muted)' }}>{i % 2 === 0 ? hourText(h).replace(' ', '') : ''}</span>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs h-4" style={{ color: 'var(--color-text-main)' }} aria-live="polite">
        {tip ? <><strong>{DAYS[tip.d]} {hourText(tip.h)}</strong>: {grid[tip.d][tip.h]} orders in total</> : <span style={{ color: 'var(--color-text-muted)' }}>Hover or tap a block to see the count. Darker means busier.</span>}
      </p>
    </div>
  );
}

// Small helper so pages can show a count-up free loading skeleton
export function Skeleton({ className = '' }: { className?: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOn(true), 150); return () => clearTimeout(t); }, []);
  return <div className={`rounded-2xl animate-pulse ${className}`} style={{ backgroundColor: 'var(--color-border)', opacity: on ? 0.5 : 0 }} />;
}
