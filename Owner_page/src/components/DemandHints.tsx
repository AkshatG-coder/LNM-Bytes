import { useEffect, useState } from 'react';
import api from '../hooks/api';
import { getStoreId } from '../hooks/config';

interface Hint {
  slot: string;
  slotLabel: string;
  weekday: string;
  isNow: boolean;
  sampleDays: number;
  typicalOrders: number;
  items: { name: string; qty: number }[];
  peakHour: string | null;
}

/** "Tuesday lunch: you usually sell about 40 rolls". Averages from the same weekday over recent weeks. */
export default function DemandHints() {
  const [hints, setHints] = useState<Hint[]>([]);

  useEffect(() => {
    const storeId = getStoreId();
    if (!storeId) return;
    let cancelled = false;
    api.get(`/order/demand/${storeId}`)
      .then((res) => {
        const list = res.data?.success ? res.data.data?.hints : [];
        if (!cancelled && Array.isArray(list)) setHints(list);
      })
      .catch(() => { /* hints are optional, so stay quiet */ });
    return () => { cancelled = true; };
  }, []);

  if (hints.length === 0) return null;

  return (
    <section aria-label="What to prepare" className="mb-8">
      <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--color-text-main)' }}>
        What to prepare
        <span className="font-normal ml-2" style={{ color: 'var(--color-text-muted)' }}>
          Usual sales for this time, from recent weeks
        </span>
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {hints.map((h) => (
          <div
            key={h.slot + h.weekday}
            className="rounded-2xl border p-4"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-base font-bold" style={{ color: 'var(--color-text-main)' }}>
                {h.weekday} {h.slotLabel}
              </p>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-md"
                style={h.isNow
                  ? { background: 'rgba(79,70,229,0.12)', color: '#4f46e5' }
                  : { background: 'var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                {h.isNow ? 'Now' : 'Next'}
              </span>
            </div>

            <ul className="mt-3 space-y-1.5">
              {h.items.map((i) => (
                <li key={i.name} className="flex items-baseline gap-2 text-sm" style={{ color: 'var(--color-text-main)' }}>
                  <span className="font-bold w-10 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{i.qty}</span>
                  <span>{i.name}</span>
                </li>
              ))}
            </ul>

            <p className="mt-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              About {h.typicalOrders} orders{h.peakHour ? `, busiest around ${h.peakHour}` : ''}. Based on the last {h.sampleDays} {h.weekday}s.
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
