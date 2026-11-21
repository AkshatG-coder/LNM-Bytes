import { useEffect, useState } from 'react'
import api from '../Util/api'

interface Prefs { vegOnly: boolean; budget: number | null; notes: string }

interface Props {
  accent: string
  onClose: () => void
}

/** Food preferences BiteBot remembers: veg only, a usual meal budget, and a short note. */
export default function BiteBotPreferences({ accent, onClose }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [vegOnly, setVegOnly] = useState(false)
  const [budget, setBudget] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    let cancelled = false
    api.get('/bitebot/preferences')
      .then((res) => {
        if (cancelled) return
        const p: Prefs | undefined = res.data?.data
        if (p) {
          setVegOnly(!!p.vegOnly)
          setBudget(p.budget ? String(p.budget) : '')
          setNotes(p.notes || '')
        }
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) { setLoaded(true); setMessage({ text: 'Could not load your saved preferences.', ok: false }) }
      })
    return () => { cancelled = true }
  }, [])

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await api.put('/bitebot/preferences', { vegOnly, budget: budget.trim() === '' ? null : Number(budget), notes })
      setMessage({ text: 'Saved. BiteBot will use these from now on.', ok: true })
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message
      setMessage({ text: msg || 'Could not save. Try again.', ok: false })
    } finally {
      setSaving(false)
    }
  }

  const field = 'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500/40 bg-transparent'
  const fieldStyle = { borderColor: 'var(--border)', color: 'var(--text-main)' }

  return (
    <div
      className="absolute inset-x-0 top-[60px] z-10 mx-3 rounded-xl border p-4 shadow-xl animate-fade-in"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      role="group"
      aria-label="Food preferences"
    >
      <p className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>Your food preferences</p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>BiteBot remembers these in every chat. You can also just tell it, like "I am vegetarian".</p>

      <div className="mt-3 space-y-3">
        <label className="flex items-center justify-between gap-3 text-sm cursor-pointer" style={{ color: 'var(--text-main)' }}>
          <span>Vegetarian only</span>
          <input
            type="checkbox"
            role="switch"
            checked={vegOnly}
            disabled={!loaded}
            onChange={(e) => setVegOnly(e.target.checked)}
            className="h-5 w-5"
            style={{ accentColor: accent }}
          />
        </label>

        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Usual budget for one meal (₹)
          <input
            type="number"
            inputMode="numeric"
            min={10}
            max={2000}
            value={budget}
            disabled={!loaded}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="No limit"
            className={`${field} mt-1`}
            style={fieldStyle}
          />
        </label>

        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Anything to avoid or prefer
          <input
            type="text"
            maxLength={120}
            value={notes}
            disabled={!loaded}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="For example: no onion, less spicy"
            className={`${field} mt-1`}
            style={fieldStyle}
          />
        </label>
      </div>

      <p className="text-xs mt-3 min-h-[1rem]" role="status" style={{ color: message?.ok ? '#16a34a' : '#ef4444' }}>
        {message?.text ?? ''}
      </p>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!loaded || saving}
          className="text-xs font-semibold px-3.5 py-2 rounded-lg text-white disabled:opacity-50"
          style={{ background: accent }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold px-3.5 py-2 rounded-lg border"
          style={{ borderColor: 'var(--border)', color: 'var(--text-main)' }}
        >
          Close
        </button>
      </div>
    </div>
  )
}
