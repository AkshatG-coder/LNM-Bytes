import { useCallback, useEffect, useState } from 'react';
import api from '../hooks/api';
import { getStoreId } from '../hooks/config';
import { BarList, Card, Heatmap, Skeleton, SplitBar, StatTile, TrendChart, type DayPoint } from '../components/InsightCharts';

interface Kpis {
  revenue: number; orders: number; avgOrderValue: number; students: number;
  repeatRate: number; rejectionRate: number; avgRating: number | null; ratingCount: number; medianPickupMinutes: number | null;
}
interface InsightsData {
  days: number; from: string; to: string;
  kpis: Kpis; previous: Kpis; hasPrevious: boolean;
  perDay: DayPoint[];
  heatmap: number[][];
  peak: { weekday: string; hour: string; orders: number } | null;
  topItems: { name: string; qty: number; revenue: number; category: string }[];
  slowItems: { name: string; qty: number; revenue: number }[];
  categories: { category: string; revenue: number; qty: number }[];
  payments: { cash: { orders: number; revenue: number }; online: { orders: number; revenue: number } };
  ratings: { distribution: number[]; lowRated: { name: string; rating: number; count: number }[] };
  rejections: { code: string; label: string; count: number }[];
  regulars: { name: string; orders: number; spend: number }[];
}

const RANGES = [7, 14, 30, 60, 90];
const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
// Short form for tiles: ₹12.4K, ₹2.4L (lakh), ₹1.2Cr
const inrShort = (n: number) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)}L` : n >= 1e4 ? `₹${(n / 1e3).toFixed(1)}K` : inr(n);
// A fixed colour per category, so the same food keeps the same colour everywhere
const CATEGORY_COLOR: Record<string, string> = {
  snacks: 'var(--viz-1)', meals: 'var(--viz-2)', drinks: 'var(--viz-3)', dessert: 'var(--viz-4)', other: 'var(--viz-other)',
};

function pct(cur: number, prev: number) {
  return prev > 0 ? { amount: ((cur - prev) / prev) * 100, unit: '%' as const } : null;
}

export default function Insights() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<InsightsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<'revenue' | 'orders'>('revenue');

  const load = useCallback(async () => {
    const storeId = getStoreId();
    if (!storeId) { setError('No store is linked to this account.'); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/order/insights/${storeId}`, { params: { days }, timeout: 30000 });
      if (!res.data?.success) throw new Error('bad response');
      setData(res.data.data as InsightsData);
    } catch {
      setError('Could not load insights. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  const k = data?.kpis;
  const p = data?.previous;
  const hasPrev = !!data?.hasPrevious;

  const highlights: string[] = [];
  if (data && data.kpis.orders > 0) {
    if (data.peak) highlights.push(`Your busiest time is ${data.peak.weekday} ${data.peak.hour}, with ${data.peak.orders} orders in the last ${data.days} days.`);
    if (data.topItems[0]) highlights.push(`${data.topItems[0].name} earns the most: ${inr(data.topItems[0].revenue)} from ${data.topItems[0].qty} sold.`);
    const slow = data.slowItems[0];
    if (slow && slow.qty <= 3) highlights.push(`${slow.name} sold ${slow.qty === 0 ? 'nothing' : `only ${slow.qty}`} in this period. Promote it or take it off the menu.`);
    if (data.kpis.rejectionRate >= 5 && data.rejections[0]) highlights.push(`${data.kpis.rejectionRate}% of orders were rejected, mostly because: ${data.rejections[0].label.toLowerCase()}.`);
  }

  return (
    <div className="viz animate-fade-in pb-10">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--color-text-main)' }}>Insights</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {data ? `${data.from} to ${data.to}. Cancelled and unpaid orders are not counted as sales.` : 'How your canteen is doing'}
          </p>
        </div>
        <div role="radiogroup" aria-label="Time range" className="inline-flex rounded-xl border p-1 gap-1" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          {RANGES.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={days === r} onClick={() => setDays(r)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
              style={days === r ? { background: 'var(--color-primary)', color: 'white' } : { color: 'var(--color-text-muted)' }}>
              {r} days
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div className="mb-6 p-4 rounded-xl border text-sm font-semibold flex items-center justify-between gap-3" style={{ borderColor: 'var(--viz-bad)', color: 'var(--viz-bad)' }}>
          <span>{error}</span>
          <button type="button" onClick={load} className="px-3 py-1.5 rounded-lg text-xs font-bold border" style={{ borderColor: 'currentColor' }}>Try again</button>
        </div>
      )}

      {loading && !data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
          <Skeleton className="h-72" />
        </div>
      )}

      {data && k && p && (
        <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {k.orders === 0 ? (
            <div className="rounded-2xl border p-10 text-center" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
              <p className="font-bold" style={{ color: 'var(--color-text-main)' }}>No sales in the last {data.days} days</p>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Insights appear here once students start ordering. Try a longer range.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
                <StatTile label="Revenue" value={inrShort(k.revenue)} title={inr(k.revenue)} delta={hasPrev ? pct(k.revenue, p.revenue) : null} />
                <StatTile label="Orders" value={k.orders.toLocaleString('en-IN')} delta={hasPrev ? pct(k.orders, p.orders) : null} />
                <StatTile label="Average order" value={inr(k.avgOrderValue)} delta={hasPrev ? pct(k.avgOrderValue, p.avgOrderValue) : null} />
                <StatTile label="Returning students" value={`${k.repeatRate}%`} note={`${k.students} students ordered`}
                  delta={hasPrev && p.students ? { amount: k.repeatRate - p.repeatRate, unit: ' pts' } : null} />
                <StatTile label="Rejected orders" value={`${k.rejectionRate}%`} goodWhenUp={false}
                  delta={hasPrev ? { amount: k.rejectionRate - p.rejectionRate, unit: ' pts' } : null} />
                <StatTile label="Rating" value={k.avgRating ? `${k.avgRating.toFixed(1)} / 5` : 'No ratings'} note={k.ratingCount ? `${k.ratingCount} ratings` : 'Students rate after pickup'}
                  delta={hasPrev && k.avgRating && p.avgRating ? { amount: k.avgRating - p.avgRating, unit: ' pts' } : null} />
              </div>

              {highlights.length > 0 && (
                <ul className="mb-6 rounded-2xl border p-4 space-y-1.5 text-sm" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-main)' }}>
                  {highlights.map((h) => <li key={h} className="flex gap-2"><span aria-hidden style={{ color: 'var(--viz-1)' }}>●</span><span>{h}</span></li>)}
                </ul>
              )}

              <div className="grid gap-4 lg:grid-cols-3 mb-4">
                <div className="lg:col-span-2">
                  <Card title={metric === 'revenue' ? 'Revenue per day' : 'Orders per day'}
                    subtitle={`Today is still in progress.${k.medianPickupMinutes !== null ? ` Half of orders are picked up within ${k.medianPickupMinutes} minutes of ordering.` : ''}`}
                    right={
                      <div role="radiogroup" aria-label="Measure" className="inline-flex rounded-lg border p-0.5 gap-0.5" style={{ borderColor: 'var(--color-border)' }}>
                        {(['revenue', 'orders'] as const).map((m) => (
                          <button key={m} type="button" role="radio" aria-checked={metric === m} onClick={() => setMetric(m)}
                            className="px-2.5 py-1 rounded-md text-xs font-bold capitalize"
                            style={metric === m ? { background: 'var(--color-primary)', color: 'white' } : { color: 'var(--color-text-muted)' }}>{m}</button>
                        ))}
                      </div>
                    }>
                    <TrendChart data={data.perDay} metric={metric} />
                  </Card>
                </div>
                <Card title="Sales by category" subtitle="Share of revenue">
                  <SplitBar parts={data.categories.map((c) => ({ label: c.category, value: c.revenue, color: CATEGORY_COLOR[c.category] ?? CATEGORY_COLOR.other }))} />
                  <div className="mt-6">
                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>How students pay</p>
                    <SplitBar parts={[
                      { label: 'cash', value: data.payments.cash.revenue, color: 'var(--viz-1)' },
                      { label: 'online', value: data.payments.online.revenue, color: 'var(--viz-2)' },
                    ]} />
                  </div>
                </Card>
              </div>

              <div className="mb-4">
                <Card title="When orders come in" subtitle="Orders by weekday and hour, over the whole period">
                  <Heatmap grid={data.heatmap} />
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2 mb-4">
                <Card title="Best sellers" subtitle="By revenue">
                  <BarList format={inr} rows={data.topItems.map((i) => ({ label: i.name, value: i.revenue, sub: `${i.qty} sold` }))} />
                </Card>
                <Card title="Slow movers" subtitle="Menu items with the fewest sales">
                  <BarList rows={data.slowItems.map((i) => ({ label: i.name, value: i.qty, sub: i.qty === 0 ? 'No orders in this period' : undefined }))}
                    format={(n) => `${n} sold`} />
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Card title="Ratings" subtitle={k.ratingCount ? `${k.ratingCount} ratings after pickup` : 'No ratings yet'}>
                  <BarList rows={[5, 4, 3, 2, 1].map((s) => ({ label: `${s} star${s > 1 ? 's' : ''}`, value: data.ratings.distribution[s - 1] }))} emptyText="No ratings yet." />
                  {data.ratings.lowRated.length > 0 && (
                    <div className="mt-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      <p className="font-semibold mb-1">Lowest rated items</p>
                      {data.ratings.lowRated.map((r) => (
                        <p key={r.name} style={{ color: 'var(--color-text-main)' }}>{r.name}: {r.rating.toFixed(1)} from {r.count} ratings</p>
                      ))}
                    </div>
                  )}
                </Card>
                <Card title="Rejected orders" subtitle="Why orders were turned down">
                  <BarList rows={data.rejections.map((r) => ({ label: r.label, value: r.count }))} emptyText="No rejected orders. Nice." />
                </Card>
                <Card title="Regular students" subtitle="Most orders in this period">
                  {data.regulars.length === 0 ? <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Nothing to show yet.</p> : (
                    <table className="w-full text-sm" style={{ color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
                      <thead><tr className="text-xs" style={{ color: 'var(--color-text-muted)' }}><th className="text-left font-semibold pb-1">Student</th><th className="text-right font-semibold pb-1">Orders</th><th className="text-right font-semibold pb-1">Spent</th></tr></thead>
                      <tbody>
                        {data.regulars.map((s) => (
                          <tr key={s.name + s.orders + s.spend} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                            <td className="py-1.5 truncate max-w-[9rem]">{s.name}</td><td className="text-right">{s.orders}</td><td className="text-right">{inr(s.spend)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
