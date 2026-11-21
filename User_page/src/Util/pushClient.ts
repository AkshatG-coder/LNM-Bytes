import api from './api'

export type AlertState = 'unsupported' | 'blocked' | 'off' | 'on'

export function isIOS(): boolean {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** True when the site runs as an installed app (home screen), not in a browser tab. */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return
  const register = () => navigator.serviceWorker.register('/sw.js').catch(() => { /* not fatal */ })
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  try {
    const reg = await navigator.serviceWorker.getRegistration('/')
    return (await reg?.pushManager.getSubscription()) ?? null
  } catch {
    return null
  }
}

export async function hasPushSubscription(): Promise<boolean> {
  return (await currentSubscription()) !== null
}

export async function getAlertState(): Promise<AlertState> {
  if (!('Notification' in window)) return 'unsupported'
  // iPhones only allow notifications for an installed app.
  if (isIOS() && !isStandalone()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  if (Notification.permission !== 'granted') return 'off'
  return 'on'
}

/**
 * Asks for permission and, when the server has push keys, subscribes this device.
 * Without server keys the permission still allows alerts while the app is open.
 */
export async function enableAlerts(): Promise<AlertState> {
  if (!('Notification' in window)) return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission === 'denied') return 'blocked'
  if (permission !== 'granted') return 'off'

  if (!pushSupported()) return 'on'
  try {
    const keyRes = await api.get('/push/public-key')
    const publicKey: string | null = keyRes.data?.data?.publicKey ?? null
    if (!publicKey) return 'on'

    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      })
    }
    await api.post('/push/subscribe', sub.toJSON())
  } catch (e) {
    // Alerts while the app is open still work.
    console.warn('Push subscribe failed:', e)
  }
  return 'on'
}

/** Removes this device's subscription. Pass `server: false` when the user is already signed out. */
export async function disableAlerts(server = true): Promise<void> {
  const sub = await currentSubscription()
  if (!sub) return
  const endpoint = sub.endpoint
  try { await sub.unsubscribe() } catch { /* ignore */ }
  if (server) {
    try { await api.post('/push/unsubscribe', { endpoint }) } catch { /* ignore */ }
  }
}
