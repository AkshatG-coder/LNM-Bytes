import { Link } from 'react-router-dom'
import { BarChart3, Bell, BotMessageSquare, ClipboardList, Hourglass, LineChart, Lightbulb, Mail, Moon, ScanLine, Settings2, Store, UtensilsCrossed, Wallet } from 'lucide-react'
import type { ComponentType } from 'react'

// A presentation page: what canteen owners can do in LNM Bytes. Public, no sign-in needed.

type Icon = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
interface Feature { icon: Icon; title: string; text: string; isNew?: boolean }
interface Group { title: string; blurb: string; features: Feature[] }

const STEPS = [
  { title: "Order arrives", text: "A new order shows up with a sound, already paid or marked as cash." },
  { title: "Accept and cook", text: "Accept it, mark it preparing, then ready. The student is told at every step." },
  { title: "Scan to hand over", text: "Scan the student's QR code. It cannot be used twice." },
]

const GROUPS: Group[] = [
  {
    title: "Run the counter",
    blurb: "Everything for the lunch rush.",
    features: [
      { icon: ClipboardList, title: "Live order board", text: "New orders appear instantly with a sound. Tabs for new, preparing, ready and cancelled orders." },
      { icon: Bell, title: "Accept, reject, ready", text: "Reject with a reason. Students get notified, and online payments are refunded automatically." },
      { icon: ScanLine, title: "QR hand-over", text: "Scan the pickup token to confirm the right student has the right order." },
      { icon: Hourglass, title: "Pause app orders", text: "Too busy? Pause online orders in one tap while the counter keeps working." },
    ],
  },
  {
    title: "Know your canteen",
    blurb: "Numbers that tell you what to cook and when.",
    features: [
      { icon: Lightbulb, title: "Demand hints", text: "Tuesday lunch: you usually sell about 40 rolls. Hints come from your own past weeks." },
      { icon: BarChart3, title: "Daily sales", text: "Today's orders and what you earned, in one place, ready for closing time." },
      { icon: LineChart, title: "Insights", text: "Sales trend, busiest hours, top items and ratings over the last 7 to 90 days." },
      { icon: Mail, title: "Weekly email", text: "Get a summary of your week in your inbox every Monday morning, if you turn it on." },
    ],
  },
  {
    title: "Set it up your way",
    blurb: "Change it yourself, no developer needed.",
    features: [
      { icon: UtensilsCrossed, title: "Menu editor", text: "Add items, categories and half portions. Mark something unavailable when it runs out." },
      { icon: Settings2, title: "Shop settings", text: "Opening hours, status, contact details and food type, with a live preview of what students see." },
      { icon: Moon, title: "Night delivery", text: "Turn it on and set your own delivery charge for after-hours orders." },
      { icon: Wallet, title: "Online and cash payments", text: "Students can pay in the app or at the counter. You see every order either way." },
      { icon: BotMessageSquare, title: "BiteBot for owners", text: "Ask about sales, top items or what to prepare, by typing or voice.", isNew: true },
      { icon: Store, title: "Many canteens, one platform", text: "A super admin adds canteens and approves new owners." },
    ],
  },
]

const BUILT_WITH = ["React and TypeScript", "Node.js and Express", "MongoDB", "Live updates over WebSockets", "Razorpay payments", "Gemini AI", "Web push notifications"]

function Logo() {
  const mask = 'radial-gradient(circle 5px at 0 50%, #0000 96%, #000) left / 51% 100% no-repeat, radial-gradient(circle 5px at 100% 50%, #0000 96%, #000) right / 51% 100% no-repeat'
  return (
    <span aria-hidden className="w-9 h-9 flex items-center justify-center font-display font-extrabold text-lg"
      style={{ borderRadius: 8, backgroundColor: '#F5B400', color: '#121B2E', WebkitMask: mask, mask }}>L</span>
  )
}

export default function Features() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text-main)' }}>
      {/* Hero */}
      <header style={{ backgroundColor: '#121B2E', color: '#FFF8E1' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-14 sm:pb-20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Logo />
              <span className="font-display font-extrabold text-lg whitespace-nowrap">LNM Bytes</span>
              <span className="text-[11px] font-extrabold uppercase tracking-wider hidden sm:inline-flex px-2 h-6 items-center rounded-full" style={{ backgroundColor: 'rgba(245,180,0,0.18)', color: '#F5B400' }}>Owners</span>
            </div>
            <Link to="/" className="px-4 h-10 inline-flex items-center rounded-lg font-extrabold text-sm whitespace-nowrap" style={{ backgroundColor: '#F5B400', color: '#121B2E' }}>
              Open the dashboard
            </Link>
          </div>

          <p className="mt-12 sm:mt-16 text-xs font-extrabold uppercase tracking-[0.2em]" style={{ color: '#F5B400' }}>Features</p>
          <h1 className="mt-3 font-display font-extrabold leading-[1.02] text-5xl sm:text-7xl max-w-3xl">Run the counter, not the crowd.</h1>
          <p className="mt-5 text-base sm:text-xl font-medium max-w-2xl" style={{ color: 'rgba(255,248,225,0.72)' }}>Take orders, cook in order, hand over with a scan, and see how your canteen is really doing.</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* How it works */}
        <section className="-mt-8 sm:-mt-10" aria-labelledby="how">
          <h2 id="how" className="sr-only">How it works</h2>
          <ol className="grid gap-3 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border p-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <span className="inline-flex w-8 h-8 rounded-lg items-center justify-center font-display font-extrabold" style={{ backgroundColor: '#F5B400', color: '#121B2E' }}>{i + 1}</span>
                <p className="mt-3 font-display font-extrabold text-xl">{s.title}</p>
                <p className="mt-1 text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Feature groups */}
        {GROUPS.map((g) => (
          <section key={g.title} className="mt-12 sm:mt-16" aria-labelledby={`g-${g.title}`}>
            <h2 id={`g-${g.title}`} className="font-display font-extrabold text-3xl sm:text-4xl">{g.title}</h2>
            <p className="mt-1 font-medium" style={{ color: 'var(--color-text-muted)' }}>{g.blurb}</p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.features.map((f) => (
                <li key={f.title} className="rounded-2xl border p-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#F5B400', color: '#121B2E' }}>
                      <f.icon className="w-5 h-5" aria-hidden />
                    </span>
                    {f.isNew && (
                      <span className="text-[11px] font-extrabold uppercase tracking-wider px-2 h-6 inline-flex items-center rounded-full" style={{ backgroundColor: '#121B2E', color: '#F5B400' }}>New</span>
                    )}
                  </div>
                  <h3 className="mt-4 font-display font-extrabold text-xl leading-tight">{f.title}</h3>
                  <p className="mt-1.5 text-sm sm:text-base font-medium" style={{ color: 'var(--color-text-muted)' }}>{f.text}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {/* Built with */}
        <section className="mt-12 sm:mt-16" aria-labelledby="built">
          <h2 id="built" className="font-display font-extrabold text-3xl sm:text-4xl">Built with</h2>
          <ul className="mt-5 flex flex-wrap gap-2">
            {BUILT_WITH.map((t) => (
              <li key={t} className="px-3.5 h-10 inline-flex items-center rounded-full border text-sm font-bold" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>{t}</li>
            ))}
          </ul>
        </section>

        <footer className="mt-14 mb-12 rounded-3xl p-8 sm:p-10 text-center" style={{ backgroundColor: '#121B2E', color: '#FFF8E1' }}>
          <p className="font-display font-extrabold text-3xl sm:text-4xl">A calmer counter starts here.</p>
          <Link to="/" className="mt-5 inline-flex items-center px-6 h-12 rounded-xl font-extrabold" style={{ backgroundColor: '#F5B400', color: '#121B2E' }}>Open the dashboard</Link>
        </footer>
      </main>
    </div>
  )
}
