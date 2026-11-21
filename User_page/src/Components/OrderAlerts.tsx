import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../Util/api'
import RateOrder from './RateOrder'
import { useAppSelector } from '../Util/hook'
import { ORDERS_CHANGED_EVENT, rejectionLine } from '../Util/orderText'
import {
  enableAlerts, getAlertState, hasPushSubscription, isIOS, isStandalone,
  type AlertState,
} from '../Util/pushClient'

// Watches the student's orders from anywhere in the app and tells them when food is ready
// or an order is declined. The service worker covers the case where the app is closed.

interface WatchedOrder {
  _id: string
  orderNumber?: number
  status: string
  rejectionReason?: string | null
  rejectionNote?: string
  rating?: number | null
}

interface AlertContent {
  key: string          // used to avoid telling the student twice
  orderId: string
  title: string
  body: string
  kind: 'ready' | 'declined' | 'preparing'
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const ACTIVE = ['pending', 'preparing', 'ready']
const POLL_MS = 45_000
const DAY = 86_400_000

function remembered(key: string, days: number): boolean {
  try {
    const t = Number(localStorage.getItem(key) || 0)
    return t > 0 && Date.now() - t < days * DAY
  } catch { return false }
}
function remember(key: string) {
  try { localStorage.setItem(key, String(Date.now())) } catch { /* private mode */ }
}

function numberLabel(n?: number): string {
  return n ? ` #${n}` : ''
}

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const tone = (freq: number, at: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at)
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.28)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + at)
      osc.stop(ctx.currentTime + at + 0.3)
    }
    tone(880, 0)
    tone(1175, 0.18)
    setTimeout(() => ctx.close().catch(() => undefined), 800)
  } catch { /* browsers may block sound until the page is tapped */ }
}

export default function OrderAlerts() {
  const user = useAppSelector((s) => s.User.user)
  const isAuthenticated = useAppSelector((s) => s.User.isAuthenticated)
  const navigate = useNavigate()
  const location = useLocation()
  const userId = isAuthenticated ? user?.id : undefined

  const [alertState, setAlertState] = useState<AlertState>('unsupported')
  const [hasActive, setHasActive] = useState(false)
  const [wsUp, setWsUp] = useState(false)
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null)
  const [dismissedTick, setDismissedTick] = useState(0)
  const [busy, setBusy] = useState(false)

  const snapshot = useRef<Map<string, string> | null>(null)   // null until the first fetch seeds it
  const told = useRef<Set<string>>(new Set())
  const flashTimer = useRef<number | null>(null)
  const navigateRef = useRef(navigate)
  useEffect(() => { navigateRef.current = navigate }, [navigate])

  // ─── Showing an alert ─────────────────────────────────────────────────────
  const stopFlash = useCallback(() => {
    if (flashTimer.current !== null) { window.clearInterval(flashTimer.current); flashTimer.current = null }
    if (document.title.startsWith('(!)')) document.title = document.title.replace(/^\(!\)\s*/, '')
  }, [])

  const showAlert = useCallback(async (a: AlertContent) => {
    if (told.current.has(a.key)) return
    told.current.add(a.key)

    if (document.visibilityState === 'visible') {
      if (a.kind !== 'preparing') beep()
      toast.custom((t) => (
        <div
          role="status"
          className={`w-[min(92vw,22rem)] rounded-2xl border p-3.5 shadow-xl flex items-start gap-3 ${t.visible ? 'animate-fade-in' : 'opacity-0'}`}
          style={{ background: 'var(--surface)', borderColor: a.kind === 'declined' ? 'rgba(239,68,68,0.45)' : a.kind === 'ready' ? 'rgba(34,197,94,0.5)' : 'var(--border)' }}
        >
          <span
            aria-hidden
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: a.kind === 'declined' ? '#ef4444' : a.kind === 'ready' ? '#22c55e' : '#f59e0b' }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>{a.title}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{a.body}</p>
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={() => { toast.dismiss(t.id); navigateRef.current('/orders') }}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-primary text-white"
              >
                {a.kind === 'ready' ? 'Show pickup QR' : 'View order'}
              </button>
              <button
                type="button"
                onClick={() => toast.dismiss(t.id)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-main)' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ), { duration: a.kind === 'preparing' ? 6000 : 15000, id: a.key })
      return
    }

    // The tab is hidden. If this device has server push, the service worker shows the notification.
    if (a.kind === 'preparing') return
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    if (await hasPushSubscription()) {
      // Still flash the tab title so a background tab on desktop gets noticed.
    } else {
      try {
        const reg = await navigator.serviceWorker?.getRegistration('/')
        const opts = { body: a.body, icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', tag: `order-${a.orderId}`, data: { url: '/orders' } }
        if (reg) await reg.showNotification(a.title, opts)
        else new Notification(a.title, opts)
      } catch { /* ignore */ }
    }
    if (flashTimer.current === null) {
      const base = document.title
      let on = false
      flashTimer.current = window.setInterval(() => {
        on = !on
        document.title = on ? `(!) ${a.title}` : base.replace(/^\(!\)\s*/, '')
      }, 1200)
    }
  }, [])

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') stopFlash() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { document.removeEventListener('visibilitychange', onVisible); stopFlash() }
  }, [stopFlash])

  // One tap after pickup. Skipped on My Orders, where the order card asks the same thing.
  const askForRating = useCallback((orderId: string, orderNumber?: number) => {
    const key = `${orderId}:rate`
    if (told.current.has(key)) return
    told.current.add(key)
    if (document.visibilityState !== 'visible' || window.location.pathname === '/orders') return
    toast.custom((t) => (
      <div
        className={`w-[min(92vw,22rem)] rounded-2xl border p-3.5 shadow-xl ${t.visible ? 'animate-fade-in' : 'opacity-0'}`}
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <p className="text-sm font-bold text-center" style={{ color: 'var(--text-main)' }}>
          Order{numberLabel(orderNumber)} picked up
        </p>
        <RateOrder orderId={orderId} onRated={() => window.setTimeout(() => toast.dismiss(t.id), 1800)} />
        <div className="mt-2 text-center">
          <button type="button" onClick={() => toast.dismiss(t.id)} className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            Not now
          </button>
        </div>
      </div>
    ), { duration: 20000, id: key })
  }, [])

  // ─── Fetching orders and spotting changes ─────────────────────────────────
  const fetchOrders = useCallback(async () => {
    if (!userId) return
    try {
      const res = await api.get(`/order/user/${userId}`)
      if (!res.data?.success) return
      const orders: WatchedOrder[] = res.data.data || []
      const prev = snapshot.current
      const next = new Map<string, string>()
      orders.forEach((o) => next.set(o._id, o.status))
      snapshot.current = next
      setHasActive(orders.some((o) => ACTIVE.includes(o.status)))

      if (!prev) return // first fetch only records where things stand
      for (const o of orders) {
        const before = prev.get(o._id)
        if (!before || before === o.status) continue
        const n = numberLabel(o.orderNumber)
        if (o.status === 'ready') {
          void showAlert({ key: `${o._id}:ready`, orderId: o._id, kind: 'ready', title: `Order${n} is ready`, body: 'Show your pickup QR at the counter.' })
        } else if (o.status === 'cancelled' && (o.rejectionReason || o.rejectionNote)) {
          void showAlert({ key: `${o._id}:declined`, orderId: o._id, kind: 'declined', title: `Order${n} was declined`, body: rejectionLine(o) ?? 'The canteen could not take this order.' })
        } else if (o.status === 'delivered' && !o.rating) {
          askForRating(o._id, o.orderNumber)
        } else if (o.status === 'preparing') {
          void showAlert({ key: `${o._id}:preparing`, orderId: o._id, kind: 'preparing', title: `Order${n} is being prepared`, body: 'We will let you know when it is ready.' })
        }
      }
    } catch { /* offline or server asleep, try again next time */ }
  }, [userId, showAlert, askForRating])

  const fetchRef = useRef(fetchOrders)
  useEffect(() => { fetchRef.current = fetchOrders }, [fetchOrders])

  // Reset when the student changes
  useEffect(() => {
    snapshot.current = null
    told.current = new Set()
    setHasActive(false)
    if (userId) void fetchRef.current()
  }, [userId])

  // Check again on focus, on navigation, and when an order is placed
  useEffect(() => {
    if (!userId) return
    const run = () => { if (document.visibilityState === 'visible') void fetchRef.current() }
    const placed = () => { void fetchRef.current() }
    window.addEventListener('focus', run)
    document.addEventListener('visibilitychange', run)
    window.addEventListener(ORDERS_CHANGED_EVENT, placed)
    return () => {
      window.removeEventListener('focus', run)
      document.removeEventListener('visibilitychange', run)
      window.removeEventListener(ORDERS_CHANGED_EVENT, placed)
    }
  }, [userId])

  useEffect(() => {
    if (userId && location.pathname === '/orders') void fetchRef.current()
  }, [userId, location.pathname])

  // Poll only when it is needed: no live connection, or an order is in progress
  useEffect(() => {
    if (!userId || (wsUp && !hasActive)) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void fetchRef.current()
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [userId, wsUp, hasActive])

  // ─── Live connection ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    let ws: WebSocket | null = null
    let attempt = 0
    let timer: number | null = null
    let closed = false

    const wsUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8081').replace(/^http/, 'ws')

    const connect = () => {
      if (closed) return
      ws = new WebSocket(wsUrl)
      ws.onopen = () => {
        attempt = 0
        // The server trusts the signed token, not the id; userId is sent for older servers
        ws?.send(JSON.stringify({ type: 'register', userId, token: localStorage.getItem('user_token') }))
        setWsUp(true)
        void fetchRef.current() // catch anything that happened while disconnected
      }
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          const id = data.orderId ? String(data.orderId) : ''
          if (!id) return
          const n = numberLabel(data.orderNumber)
          if (data.type === 'orderReady') {
            snapshot.current?.set(id, 'ready')
            void showAlert({ key: `${id}:ready`, orderId: id, kind: 'ready', title: `Order${n} is ready`, body: 'Show your pickup QR at the counter.' })
          } else if (data.type === 'orderCancelled' && data.rejected) {
            snapshot.current?.set(id, 'cancelled')
            const body = rejectionLine({ rejectionReason: data.reason, rejectionNote: data.note }) ?? 'The canteen could not take this order.'
            void showAlert({ key: `${id}:declined`, orderId: id, kind: 'declined', title: `Order${n} was declined`, body: data.refunded ? `${body}. Your refund has started.` : body })
          } else if (data.type === 'orderDelivered') {
            snapshot.current?.set(id, 'delivered')
            askForRating(id, data.orderNumber)
          } else if (data.type === 'orderPreparing') {
            snapshot.current?.set(id, 'preparing')
            void showAlert({ key: `${id}:preparing`, orderId: id, kind: 'preparing', title: `Order${n} is being prepared`, body: 'We will let you know when it is ready.' })
          }
          if (data.type === 'orderReady' || data.type === 'orderCancelled' || data.type === 'orderPreparing' || data.type === 'orderDelivered') void fetchRef.current()
        } catch { /* not JSON */ }
      }
      const retry = () => {
        setWsUp(false)
        if (closed || timer !== null) return
        // 1s, 2s, 4s … up to 30s, with some jitter so many phones do not reconnect together
        const delay = Math.min(30_000, 1000 * 2 ** attempt) * (0.7 + Math.random() * 0.6)
        attempt += 1
        timer = window.setTimeout(() => { timer = null; connect() }, delay)
      }
      // 4401 = the server rejected our login token. Retrying cannot fix that, and the
      // polling fallback keeps alerts working until the user signs in again.
      ws.onclose = (e) => { if (e.code === 4401) { setWsUp(false); return } retry() }
      ws.onerror = () => { try { ws?.close() } catch { /* ignore */ } }
    }

    connect()
    return () => {
      closed = true
      if (timer !== null) window.clearTimeout(timer)
      try { ws?.close() } catch { /* ignore */ }
      setWsUp(false)
    }
  }, [userId, showAlert, askForRating])

  // ─── Alert permission and install prompt ──────────────────────────────────
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void getAlertState().then(async (s) => {
      if (cancelled) return
      setAlertState(s)
      // Permission was already given on this browser: make sure this account has a subscription
      if (s === 'on') await enableAlerts()
    })
    return () => { cancelled = true }
  }, [userId])

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvent(e as InstallPromptEvent) }
    const onInstalled = () => setInstallEvent(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const turnOn = async () => {
    setBusy(true)
    try {
      const s = await enableAlerts()
      setAlertState(s)
      if (s === 'on') toast.success('Alerts are on. We will tell you when your order is ready.')
      else if (s === 'blocked') toast.error('Notifications are blocked. Allow them in your browser settings to get alerts.')
    } finally { setBusy(false) }
  }

  const install = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    await installEvent.userChoice.catch(() => undefined)
    setInstallEvent(null)
  }

  // ─── Which card, if any ───────────────────────────────────────────────────
  void dismissedTick // re-evaluates the localStorage checks after a dismiss
  if (!userId) return null

  const onOrdersPage = location.pathname === '/orders'
  const iosBrowser = isIOS() && !isStandalone()
  let card: 'alerts' | 'ios' | 'install' | null = null
  if (alertState === 'off' && hasActive && !remembered('lnm:alertsPromptDismissed', 7)) card = 'alerts'
  else if (iosBrowser && hasActive && !remembered('lnm:iosHintDismissed', 14)) card = 'ios'
  else if (installEvent && onOrdersPage && !remembered('lnm:installDismissed', 14)) card = 'install'
  if (!card) return null

  const dismiss = (key: string) => { remember(key); setDismissedTick((n) => n + 1) }

  const shell = 'fixed z-40 left-3 right-20 bottom-3 sm:right-auto sm:w-80 rounded-2xl border p-4 shadow-xl animate-fade-in'
  const shellStyle = { background: 'var(--surface)', borderColor: 'var(--border)' }
  const primaryBtn = 'text-xs font-bold px-3.5 py-2 rounded-lg bg-primary text-white disabled:opacity-50'
  const ghostBtn = 'text-xs font-semibold px-3.5 py-2 rounded-lg border'
  const ghostStyle = { borderColor: 'var(--border)', color: 'var(--text-main)' }

  if (card === 'alerts') {
    return (
      <div className={shell} style={shellStyle} role="region" aria-label="Order alerts">
        <p className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>Get a ping when your order is ready</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          You can close the app or lock your phone. We will notify you the moment the canteen marks it ready.
        </p>
        <div className="mt-3 flex gap-2">
          <button type="button" className={primaryBtn} disabled={busy} onClick={turnOn}>
            {busy ? 'Turning on…' : 'Turn on alerts'}
          </button>
          <button type="button" className={ghostBtn} style={ghostStyle} onClick={() => dismiss('lnm:alertsPromptDismissed')}>
            Not now
          </button>
        </div>
      </div>
    )
  }

  if (card === 'ios') {
    return (
      <div className={shell} style={shellStyle} role="region" aria-label="Install the app">
        <p className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>Add LNM Bytes to your home screen</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          On iPhone, alerts only work from the home screen app. Tap Share, then Add to Home Screen, and open LNM Bytes from there.
        </p>
        <div className="mt-3">
          <button type="button" className={ghostBtn} style={ghostStyle} onClick={() => dismiss('lnm:iosHintDismissed')}>
            Got it
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={shell} style={shellStyle} role="region" aria-label="Install the app">
      <p className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>Install LNM Bytes</p>
      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
        Open it from your home screen and get order alerts even when the browser is closed.
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" className={primaryBtn} onClick={install}>Install</button>
        <button type="button" className={ghostBtn} style={ghostStyle} onClick={() => dismiss('lnm:installDismissed')}>Not now</button>
      </div>
    </div>
  )
}
