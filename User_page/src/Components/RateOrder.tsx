import { useState } from 'react'
import api from '../Util/api'
import { sendOrderRating } from '../Util/orderText'

interface Props {
  orderId: string
  /** The rating already saved on the order, if any. */
  rating?: number | null
  /** Called after the rating is saved. */
  onRated?: (stars: number) => void
}

const LABELS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent']

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path
        d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1L3.2 9.6l6.1-.8L12 3.2z"
        fill={filled ? '#f59e0b' : 'none'}
        stroke={filled ? '#f59e0b' : 'var(--text-muted)'}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** One tap after pickup. Feeds the star ratings shown on the menu. */
export default function RateOrder({ orderId, rating, onRated }: Props) {
  const [saved, setSaved] = useState<number | null>(rating ?? null)
  const [hover, setHover] = useState(0)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const submit = async (stars: number) => {
    if (busy) return
    setBusy(true)
    setFailed(false)
    const ok = await sendOrderRating((url, body) => api.post(url, body), orderId, stars)
    setBusy(false)
    if (ok) {
      setSaved(stars)
      onRated?.(stars)
    } else {
      setFailed(true)
    }
  }

  if (saved) {
    return (
      <div className="mt-3 flex items-center justify-center gap-2" role="status">
        <span className="flex" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className="scale-[0.7] -mx-1"><Star filled={n <= saved} /></span>
          ))}
        </span>
        <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          You rated this order {saved} out of 5. Thank you.
        </span>
      </div>
    )
  }

  const shown = hover || 0
  return (
    <div className="mt-3 text-center" role="group" aria-label="Rate this order">
      <p className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>How was your order?</p>
      <div className="mt-1.5 flex justify-center gap-0.5" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={busy}
            aria-label={`Rate ${n} out of 5, ${LABELS[n - 1]}`}
            onClick={() => submit(n)}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            className="p-1.5 rounded-lg transition-transform active:scale-90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Star filled={n <= shown} />
          </button>
        ))}
      </div>
      <p className="text-xs mt-0.5 h-4" style={{ color: failed ? '#ef4444' : 'var(--text-muted)' }} aria-live="polite">
        {failed ? 'Could not save your rating. Tap a star to try again.' : shown ? LABELS[shown - 1] : 'Tap a star'}
      </p>
    </div>
  )
}
