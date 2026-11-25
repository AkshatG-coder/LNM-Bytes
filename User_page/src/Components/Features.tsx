import { Link } from 'react-router-dom'
import { Bell, ChefHat, Heart, Moon, QrCode, Radar, ReceiptIndianRupee, RefreshCcw, ShieldCheck, Smartphone, Sparkles, Star, Store, SunMoon, UtensilsCrossed, Wallet } from 'lucide-react'
import type { ComponentType } from 'react'

// A presentation page: what students can do in LNM Bytes. Public, no sign-in needed.

type Icon = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
interface Feature { icon: Icon; title: string; text: string; isNew?: boolean }
interface Group { title: string; blurb: string; features: Feature[] }

const STEPS = [
  { title: "Pick a canteen", text: "See which canteens are open, how busy they are, and what is on the menu." },
  { title: "Order and pay", text: "Add items, pay with UPI or card, or choose cash at the counter." },
  { title: "Show your QR", text: "Get a notification when it is ready and show your QR token at the counter." },
]

const GROUPS: Group[] = [
  {
    title: "Order in seconds",
    blurb: "Everything you need before you leave your room.",
    features: [
      { icon: Store, title: "Every canteen at a glance", text: "See live open or closed status, opening hours and whether night delivery is on." },
      { icon: Radar, title: "Rush Radar", text: "See the live queue, an estimated wait, and the quietest time to come.", isNew: true },
      { icon: UtensilsCrossed, title: "A menu that is easy to scan", text: "Categories, search, veg and non-veg marks, and half portions where they exist." },
      { icon: Wallet, title: "Pay your way", text: "Pay with UPI or card through Razorpay, or choose cash at the counter." },
      { icon: Moon, title: "Night delivery", text: "Order after hours and get it delivered for a small fee set by the canteen." },
      { icon: ShieldCheck, title: "Safe checkout", text: "Prices are worked out on the server, so what you see is what you pay." },
    ],
  },
  {
    title: "After you order",
    blurb: "You always know what is happening with your food.",
    features: [
      { icon: Bell, title: "Live order tracking", text: "Pending, preparing, ready. The status changes on your screen the moment the kitchen moves it." },
      { icon: Smartphone, title: "Notifications", text: "Get alerts even when the app is closed. Install it on your phone like a normal app." },
      { icon: QrCode, title: "QR pickup token", text: "Show one code at the counter. No shouting order numbers across the crowd." },
      { icon: ReceiptIndianRupee, title: "Cancel and refund", text: "Cancel until the canteen accepts. Online payments are refunded automatically." },
    ],
  },
  {
    title: "Made for campus life",
    blurb: "Small things that make it feel like yours.",
    features: [
      { icon: ChefHat, title: "BiteBot, your food assistant", text: "Ask in English or Hinglish, by typing or voice. It builds your cart and can place the order.", isNew: true },
      { icon: RefreshCcw, title: "Favourites and reorder", text: "Put your usual order back in the cart with one tap." },
      { icon: Star, title: "Ratings", text: "Rate what you ate, so everyone can see what is worth it." },
      { icon: Sparkles, title: "LNM Bytes Wrapped", text: "Your semester in food: top order, eater type and spend. Share it as a poster.", isNew: true },
      { icon: SunMoon, title: "Dark mode", text: "Easy on the eyes at night. One tap to switch." },
      { icon: Heart, title: "Built by students", text: "Made on campus, for campus." },
    ],
  },
]

const BUILT_WITH = ["React and TypeScript", "Node.js and Express", "MongoDB", "Live updates over WebSockets", "Razorpay payments", "Gemini AI", "Installable PWA"]

function Logo() {
  const mask = 'radial-gradient(circle 5px at 0 50%, #0000 96%, #000) left / 51% 100% no-repeat, radial-gradient(circle 5px at 100% 50%, #0000 96%, #000) right / 51% 100% no-repeat'
  return (
    <span aria-hidden className="w-9 h-9 flex items-center justify-center font-display font-extrabold text-lg"
      style={{ borderRadius: 8, backgroundColor: '#F5B400', color: '#121B2E', WebkitMask: mask, mask }}>L</span>
  )
}

export default function Features() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-main)' }}>
      {/* Hero */}
      <header style={{ backgroundColor: '#121B2E', color: '#FFF8E1' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-14 sm:pb-20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Logo />
              <span className="font-display font-extrabold text-lg whitespace-nowrap">LNM Bytes</span>
              <span className="text-[11px] font-extrabold uppercase tracking-wider hidden sm:inline-flex px-2 h-6 items-center rounded-full" style={{ backgroundColor: 'rgba(245,180,0,0.18)', color: '#F5B400' }}>Students</span>
            </div>
            <Link to="/" className="px-4 h-10 inline-flex items-center rounded-lg font-extrabold text-sm whitespace-nowrap" style={{ backgroundColor: '#F5B400', color: '#121B2E' }}>
              Open the app
            </Link>
          </div>

          <p className="mt-12 sm:mt-16 text-xs font-extrabold uppercase tracking-[0.2em]" style={{ color: '#F5B400' }}>Features</p>
          <h1 className="mt-3 font-display font-extrabold leading-[1.02] text-5xl sm:text-7xl max-w-3xl">Skip the queue.</h1>
          <p className="mt-5 text-base sm:text-xl font-medium max-w-2xl" style={{ color: 'rgba(255,248,225,0.72)' }}>Order from any canteen on campus, pay in the app or at the counter, and pick up when it is ready.</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* How it works */}
        <section className="-mt-8 sm:-mt-10" aria-labelledby="how">
          <h2 id="how" className="sr-only">How it works</h2>
          <ol className="grid gap-3 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border p-5" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                <span className="inline-flex w-8 h-8 rounded-lg items-center justify-center font-display font-extrabold" style={{ backgroundColor: '#F5B400', color: '#121B2E' }}>{i + 1}</span>
                <p className="mt-3 font-display font-extrabold text-xl">{s.title}</p>
                <p className="mt-1 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Feature groups */}
        {GROUPS.map((g) => (
          <section key={g.title} className="mt-12 sm:mt-16" aria-labelledby={`g-${g.title}`}>
            <h2 id={`g-${g.title}`} className="font-display font-extrabold text-3xl sm:text-4xl">{g.title}</h2>
            <p className="mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>{g.blurb}</p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.features.map((f) => (
                <li key={f.title} className="rounded-2xl border p-5" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#F5B400', color: '#121B2E' }}>
                      <f.icon className="w-5 h-5" aria-hidden />
                    </span>
                    {f.isNew && (
                      <span className="text-[11px] font-extrabold uppercase tracking-wider px-2 h-6 inline-flex items-center rounded-full" style={{ backgroundColor: '#121B2E', color: '#F5B400' }}>New</span>
                    )}
                  </div>
                  <h3 className="mt-4 font-display font-extrabold text-xl leading-tight">{f.title}</h3>
                  <p className="mt-1.5 text-sm sm:text-base font-medium" style={{ color: 'var(--text-muted)' }}>{f.text}</p>
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
              <li key={t} className="px-3.5 h-10 inline-flex items-center rounded-full border text-sm font-bold" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>{t}</li>
            ))}
          </ul>
        </section>

        <footer className="mt-14 mb-12 rounded-3xl p-8 sm:p-10 text-center" style={{ backgroundColor: '#121B2E', color: '#FFF8E1' }}>
          <p className="font-display font-extrabold text-3xl sm:text-4xl">Your canteen, without the queue.</p>
          <Link to="/" className="mt-5 inline-flex items-center px-6 h-12 rounded-xl font-extrabold" style={{ backgroundColor: '#F5B400', color: '#121B2E' }}>Open the app</Link>
        </footer>
      </main>
    </div>
  )
}
