import { useEffect, useState } from 'react'
import api from './api'

export type RushLevel = 'quiet' | 'moderate' | 'busy'

export interface RushHour {
  hour: number
  label: string
  typical: number
  level: RushLevel
  isNow: boolean
}

export interface Rush {
  level: RushLevel
  activeOrders: number
  waitMin: number
  hours: RushHour[]
  bestHour: { hour: number; label: string } | null
  nowIsBest: boolean
  basedOnDays: number
}

const POLL_MS = 60_000

/** Live rush for one canteen. Refreshes every minute while the tab is visible; null until loaded or on error. */
export function useRush(storeId: string | undefined, enabled = true): Rush | null {
  const [rush, setRush] = useState<Rush | null>(null)

  useEffect(() => {
    if (!storeId || !enabled) return
    let cancelled = false

    const load = () => {
      if (document.visibilityState === 'hidden') return
      api.get(`/order/rush/${storeId}`)
        .then((res) => { if (!cancelled && res.data?.success) setRush(res.data.data as Rush) })
        .catch(() => { /* the radar is a nicety: stay quiet if it fails */ })
    }

    load()
    const timer = setInterval(load, POLL_MS)
    document.addEventListener('visibilitychange', load)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', load)
    }
  }, [storeId, enabled])

  return rush
}

export const RUSH_COPY: Record<RushLevel, { title: string; color: string }> = {
  quiet: { title: 'Quiet', color: 'var(--veg)' },
  moderate: { title: 'Getting busy', color: 'var(--primary)' },
  busy: { title: 'Busy', color: 'var(--nonveg)' },
}

export function waitText(rush: Rush): string {
  return rush.waitMin > 0 ? `about ${rush.waitMin} min wait` : 'no wait'
}
