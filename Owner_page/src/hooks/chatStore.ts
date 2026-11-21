// Keeps a chat on this device so it is still there after a refresh.
// Only the text is kept. Cards (order drafts, pending orders) go stale, so they are not restored.

export interface StoredMessage {
  role: 'user' | 'assistant'
  text: string
  /** milliseconds since 1970 */
  at: number
}

const MAX_MESSAGES = 40
const MAX_AGE_MS = 24 * 60 * 60 * 1000

export function loadChat(key: string, now = Date.now()): StoredMessage[] | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return null
    const fresh = data.filter(
      (m): m is StoredMessage =>
        m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' && typeof m.at === 'number' && now - m.at < MAX_AGE_MS,
    )
    return fresh.length ? fresh.slice(-MAX_MESSAGES) : null
  } catch {
    return null
  }
}

export function saveChat(key: string, messages: StoredMessage[]): void {
  try {
    const keep = messages.filter((m) => m.text.trim()).slice(-MAX_MESSAGES)
    if (keep.length === 0) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(keep))
  } catch {
    /* storage full or blocked: the chat still works, it just will not survive a refresh */
  }
}

export function clearChat(key: string): void {
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}

/** Removes every saved chat that starts with `prefix`, e.g. on sign out. */
export function clearChatsWithPrefix(prefix: string): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(prefix)) keys.push(k)
    }
    keys.forEach((k) => localStorage.removeItem(k))
  } catch { /* ignore */ }
}
