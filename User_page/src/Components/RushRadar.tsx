import { Radar } from 'lucide-react'
import { RUSH_COPY, useRush, waitText } from '../Util/useRush'
import type { Rush } from '../Util/useRush'

/** Small pill for the canteen list: "Busy, about 15 min wait". */
export function RushChip({ storeId }: { storeId: string }) {
  const rush = useRush(storeId)
  if (!rush) return null
  const copy = RUSH_COPY[rush.level]
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full text-xs font-extrabold border"
      style={{ borderColor: 'var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--surface)' }}
      title="Live queue at this canteen"
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: copy.color }} aria-hidden />
      {copy.title}<span className="font-semibold" style={{ color: 'var(--text-muted)' }}>, {waitText(rush)}</span>
    </span>
  )
}

function summary(rush: Rush): string {
  if (!rush.hours.length) return ''
  const busy = rush.hours.filter((h) => h.level === 'busy').map((h) => h.label)
  const quiet = rush.hours.filter((h) => h.level === 'quiet').map((h) => h.label)
  return `Usually busy at ${busy.join(', ') || 'no hour in particular'}. Usually quiet at ${quiet.join(', ') || 'no hour in particular'}.`
}

/** Full card for the menu page: live queue, the next few hours, and the best time to come. */
export function RushRadar({ storeId }: { storeId: string }) {
  const rush = useRush(storeId)
  if (!rush) return null

  const copy = RUSH_COPY[rush.level]
  const peak = Math.max(...rush.hours.map((h) => h.typical), 0.1)

  return (
    <div className="mt-4 max-w-md rounded-2xl border p-4" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Radar className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} aria-hidden />
          <p className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Rush radar</p>
        </div>
        <p className="flex items-center gap-2 text-sm font-extrabold" style={{ color: 'var(--text-main)' }}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: copy.color }} aria-hidden />
          {copy.title} now
        </p>
      </div>

      <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
        {rush.activeOrders > 0
          ? `${rush.activeOrders} order${rush.activeOrders === 1 ? '' : 's'} in the kitchen, ${waitText(rush)}.`
          : 'Nobody is waiting. Orders go straight to the kitchen.'}
      </p>

      {rush.hours.length > 0 && (
        <>
          <div role="img" aria-label={summary(rush)} className="mt-4 flex items-end gap-2 h-20">
            {rush.hours.map((h) => (
              <div key={h.hour} className="flex-1 h-full flex flex-col justify-end items-center gap-1">
                <div
                  className="w-full rounded-t-md"
                  style={{
                    height: `${Math.max(8, Math.round((h.typical / peak) * 100))}%`,
                    backgroundColor: RUSH_COPY[h.level].color,
                    opacity: h.isNow ? 1 : 0.65,
                    outline: rush.bestHour?.hour === h.hour ? '2px solid var(--text-main)' : undefined,
                    outlineOffset: 1,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-2 text-[11px] font-bold tnum" style={{ color: 'var(--text-muted)' }} aria-hidden>
            {rush.hours.map((h) => (
              <span key={h.hour} className="flex-1 text-center whitespace-nowrap" style={h.isNow ? { color: 'var(--text-main)' } : undefined}>
                {h.isNow ? 'Now' : h.label.replace(' ', '')}
              </span>
            ))}
          </div>

          <p className="mt-3 text-sm font-bold" style={{ color: 'var(--text-main)' }}>
            {rush.nowIsBest
              ? 'Now is the quietest time for the next few hours.'
              : rush.bestHour
                ? `Quieter around ${rush.bestHour.label}.`
                : 'Pretty steady for the next few hours.'}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            Based on the last {rush.basedOnDays} similar day{rush.basedOnDays === 1 ? '' : 's'}.
          </p>
        </>
      )}
    </div>
  )
}
