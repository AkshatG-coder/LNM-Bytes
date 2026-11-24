import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, Share2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../Util/api'
import { plural, rupees, shareWrapped } from '../Util/wrappedShare'
import type { WrappedData } from '../Util/wrappedShare'

type Tone = 'ink' | 'haldi'

interface Slide {
  key: string
  tone: Tone
  body: ReactNode
}

const TONES: Record<Tone, { bg: string; fg: string; soft: string }> = {
  ink: { bg: '#121B2E', fg: '#FFF8E1', soft: 'rgba(255,248,225,0.68)' },
  haldi: { bg: '#F5B400', fg: '#121B2E', soft: 'rgba(18,27,46,0.72)' },
}

const Kicker = ({ children }: { children: ReactNode }) => (
  <p className="text-xs font-extrabold uppercase tracking-[0.18em]" style={{ opacity: 0.75 }}>{children}</p>
)
const Big = ({ children, size = 'text-7xl' }: { children: ReactNode; size?: string }) => (
  <p className={`font-display font-extrabold leading-none tnum ${size}`}>{children}</p>
)

function buildSlides(d: WrappedData): Slide[] {
  const slides: Slide[] = []

  slides.push({
    key: 'intro', tone: 'haldi',
    body: (
      <>
        <Kicker>LNM Bytes Wrapped</Kicker>
        <div>
          <h1 className="font-display font-extrabold text-5xl leading-[1.05]">{d.firstName}, here is your semester in food.</h1>
          <p className="mt-4 text-base font-semibold" style={{ opacity: 0.75 }}>{d.period.label}</p>
        </div>
        <p className="text-sm font-bold" style={{ opacity: 0.75 }}>Tap to continue</p>
      </>
    ),
  })

  slides.push({
    key: 'orders', tone: 'ink',
    body: (
      <>
        <Kicker>You ordered</Kicker>
        <div>
          <Big size="text-8xl">{d.orders.toLocaleString('en-IN')}</Big>
          <p className="mt-2 font-display font-extrabold text-3xl">{d.orders === 1 ? 'time' : 'times'}</p>
          <p className="mt-5 text-base font-semibold" style={{ color: TONES.ink.soft }}>
            {plural(d.items, 'item')} across {plural(d.activeDays, 'day')}.
            {d.uniqueItems > 1 ? ` ${d.uniqueItems} different dishes.` : ''}
          </p>
        </div>
        {d.topPercent !== null
          ? <p className="text-lg font-extrabold">That puts you in the top {d.topPercent}% of LNM Bytes.</p>
          : <span />}
      </>
    ),
  })

  if (d.topItems[0]) {
    const [first, ...rest] = d.topItems
    slides.push({
      key: 'item', tone: 'haldi',
      body: (
        <>
          <Kicker>Your signature order</Kicker>
          <div>
            <h2 className="font-display font-extrabold text-5xl leading-[1.05] break-words">{first.name}</h2>
            <p className="mt-4 text-xl font-bold">{plural(first.qty, 'time')}. Nobody can say you are not loyal.</p>
          </div>
          {rest.length > 0
            ? (
              <ol className="space-y-1.5 text-base font-bold">
                {rest.map((it, i) => (
                  <li key={it.name} className="flex justify-between gap-3 border-t pt-1.5" style={{ borderColor: 'rgba(18,27,46,0.25)' }}>
                    <span className="truncate">{i + 2}. {it.name}</span><span className="tnum">x{it.qty}</span>
                  </li>
                ))}
              </ol>
            )
            : <span />}
        </>
      ),
    })
  }

  if (d.persona) {
    slides.push({
      key: 'persona', tone: 'ink',
      body: (
        <>
          <Kicker>Your eater type</Kicker>
          <div>
            <h2 className="font-display font-extrabold text-5xl leading-[1.05]" style={{ color: '#F5B400' }}>{d.persona.title}</h2>
            <p className="mt-4 text-xl font-semibold">{d.persona.line}</p>
          </div>
          <p className="text-sm font-bold" style={{ color: TONES.ink.soft }}>
            {d.persona.share}% of your orders came at this time of day.
            {d.nightDeliveries > 0 ? ` You also had ${plural(d.nightDeliveries, 'night delivery', 'night deliveries')}.` : ''}
          </p>
        </>
      ),
    })
  }

  if (d.topStoreName || d.longestStreak > 1) {
    slides.push({
      key: 'place', tone: 'haldi',
      body: (
        <>
          <Kicker>Your habits</Kicker>
          <div className="space-y-6">
            {d.topStoreName && (
              <div>
                <p className="text-sm font-bold" style={{ opacity: 0.75 }}>Home canteen</p>
                <h2 className="font-display font-extrabold text-4xl leading-tight">{d.topStoreName}</h2>
                <p className="text-sm font-semibold" style={{ opacity: 0.75 }}>{plural(d.topStoreOrders, 'order')} there</p>
              </div>
            )}
            {d.longestStreak > 1 && (
              <div>
                <p className="text-sm font-bold" style={{ opacity: 0.75 }}>Longest streak</p>
                <h2 className="font-display font-extrabold text-4xl leading-tight">{plural(d.longestStreak, 'day')} in a row</h2>
              </div>
            )}
          </div>
          {d.busiestWeekday ? <p className="text-lg font-extrabold">{d.busiestWeekday}s are your day.</p> : <span />}
        </>
      ),
    })
  }

  slides.push({
    key: 'spend', tone: 'ink',
    body: (
      <>
        <Kicker>You spent</Kicker>
        <div>
          <Big size="text-7xl">{rupees(d.spent)}</Big>
          <p className="mt-5 text-base font-semibold" style={{ color: TONES.ink.soft }}>
            That is about {rupees(d.avgOrder)} an order. Your biggest order was {rupees(d.biggestOrder)}.
          </p>
        </div>
        <span />
      </>
    ),
  })

  return slides
}

export default function Wrapped() {
  const [period, setPeriod] = useState<'semester' | 'all'>('semester')
  const [data, setData] = useState<WrappedData | null>(null)
  const [error, setError] = useState(false)
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(false)
    setIndex(0)
    api.get('/order/wrapped', { params: { period } })
      .then((res) => { if (!cancelled) { if (res.data?.success) setData(res.data.data); else setError(true) } })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [period, reloadKey])

  const slides = data?.ready ? buildSlides(data) : []
  const total = slides.length + 1 // the last page is the share poster
  const next = useCallback(() => setIndex((i) => Math.min(i + 1, total - 1)), [total])
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev])

  async function share() {
    if (!data) return
    setBusy(true)
    try {
      const result = await shareWrapped(data)
      if (result === 'downloaded') toast.success('Saved to your downloads.')
    } catch {
      toast.error('The card could not be made. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const toggle = (
    <div className="mt-4 flex justify-center gap-2" role="group" aria-label="Period">
      {([['semester', 'This semester'], ['all', 'All time']] as const).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => setPeriod(id)}
          aria-pressed={period === id}
          className={`px-3.5 h-9 rounded-full text-sm font-bold border ${period === id ? 'bg-primary text-on-primary border-transparent' : ''}`}
          style={period === id ? undefined : { borderColor: 'var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--surface)' }}
        >
          {label}
        </button>
      ))}
    </div>
  )

  if (error) {
    return (
      <div className="max-w-md mx-auto px-4 pt-16 text-center">
        <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text-main)' }}>Your Wrapped could not load</h1>
        <p className="mt-2 font-medium" style={{ color: 'var(--text-muted)' }}>Check your connection and try again.</p>
        <button onClick={() => setReloadKey((k) => k + 1)} className="mt-5 px-5 h-11 rounded-xl bg-primary text-on-primary font-extrabold">Try again</button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="max-w-sm mx-auto px-4 pt-8" aria-busy="true" aria-label="Loading your Wrapped">
        <div className="h-[34rem] rounded-3xl animate-pulse" style={{ backgroundColor: 'var(--surface-2)' }} />
      </div>
    )
  }

  if (!data.ready) {
    return (
      <div className="max-w-md mx-auto px-4 pt-12 pb-10 text-center">
        <h1 className="text-3xl font-extrabold" style={{ color: 'var(--text-main)' }}>Your Wrapped is warming up</h1>
        <p className="mt-2 font-medium" style={{ color: 'var(--text-muted)' }}>
          Order {data.needed} more time{data.needed === 1 ? '' : 's'} {period === 'semester' ? 'this semester ' : ''}to unlock it.
          You have placed {data.orders} so far.
        </p>
        <Link to="/" className="inline-flex items-center mt-6 px-5 h-11 rounded-xl bg-primary text-on-primary font-extrabold hover:bg-primary-dark">
          Find something to eat
        </Link>
        {toggle}
      </div>
    )
  }

  const onShareCard = index === slides.length
  const slide = slides[index]
  const tone = TONES[slide ? slide.tone : 'ink']

  return (
    <div className="max-w-sm mx-auto px-4 pt-6 pb-10">
      <div
        className="relative rounded-3xl overflow-hidden flex flex-col h-[34rem] max-h-[calc(100svh-19rem)] min-h-[24rem] md:max-h-[calc(100svh-13rem)]"
        style={{ backgroundColor: tone.bg, color: tone.fg }}
        aria-live="polite"
      >
        <div className="flex gap-1.5 p-4 pb-0" aria-hidden>
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className="h-1 flex-1 rounded-full" style={{ backgroundColor: tone.fg, opacity: i <= index ? 0.95 : 0.25 }} />
          ))}
        </div>

        <div className="flex-1 px-6 py-7 flex flex-col justify-between animate-fade-in" key={index}>
          {onShareCard ? (
            <>
              <Kicker>Share it</Kicker>
              <div>
                <h2 className="font-display font-extrabold text-4xl leading-[1.05]">{plural(data.orders, 'order')}. {rupees(data.spent)}.</h2>
                {data.persona && <p className="mt-2 font-display font-extrabold text-2xl" style={{ color: '#F5B400' }}>{data.persona.title}</p>}
                <p className="mt-4 text-base font-semibold" style={{ color: TONES.ink.soft }}>
                  Make a poster of this and post it. Your friends can find theirs on LNM Bytes.
                </p>
              </div>
              <button
                type="button"
                onClick={share}
                disabled={busy}
                className="h-12 rounded-xl font-extrabold flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ backgroundColor: '#F5B400', color: '#121B2E' }}
              >
                {typeof navigator !== 'undefined' && 'canShare' in navigator ? <Share2 className="w-5 h-5" aria-hidden /> : <Download className="w-5 h-5" aria-hidden />}
                {busy ? 'Making your card…' : 'Share my Wrapped'}
              </button>
            </>
          ) : slide.body}
        </div>

        {/* Tap zones for phones; the visible buttons below do the same for everyone else */}
        <button type="button" className="absolute inset-y-16 left-0 w-1/3" onClick={prev} aria-label="Previous" tabIndex={-1} />
        <button type="button" className="absolute inset-y-16 right-0 w-2/3" onClick={next} aria-label="Next" tabIndex={-1} />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button type="button" onClick={prev} disabled={index === 0} aria-label="Previous card"
          className="w-11 h-11 rounded-full border flex items-center justify-center disabled:opacity-30"
          style={{ borderColor: 'var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--surface)' }}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <p className="text-sm font-bold tnum" style={{ color: 'var(--text-muted)' }}>{index + 1} of {total}</p>
        <button type="button" onClick={next} disabled={index === total - 1} aria-label="Next card"
          className="w-11 h-11 rounded-full border flex items-center justify-center disabled:opacity-30"
          style={{ borderColor: 'var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--surface)' }}>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      {toggle}
    </div>
  )
}
