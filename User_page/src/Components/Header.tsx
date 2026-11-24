import { useEffect, useRef, useState } from "react"
import { Link, NavLink, useNavigate } from "react-router-dom"
import { Moon, Sun, LogOut, Receipt, ShoppingBag, Sparkles, Utensils } from "lucide-react"
import { useAppSelector, useAppDispatch } from "../Util/hook"
import { useTheme } from "../Util/useTheme"
import { logout } from "../Util/UserReducer"
import { disableAlerts } from "../Util/pushClient"
import { clearChatsWithPrefix } from "../Util/chatStore"

/** The logo mark: a canteen token with a notch cut into each side. */
function TokenMark() {
  return (
    <span
      aria-hidden
      className="w-9 h-9 flex items-center justify-center bg-primary text-on-primary font-display font-extrabold text-lg"
      style={{
        borderRadius: 8,
        WebkitMask: 'radial-gradient(circle 5px at 0 50%, #0000 96%, #000) left / 51% 100% no-repeat, radial-gradient(circle 5px at 100% 50%, #0000 96%, #000) right / 51% 100% no-repeat',
        mask: 'radial-gradient(circle 5px at 0 50%, #0000 96%, #000) left / 51% 100% no-repeat, radial-gradient(circle 5px at 100% 50%, #0000 96%, #000) right / 51% 100% no-repeat',
      }}
    >
      L
    </span>
  )
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
    isActive ? 'bg-primary text-on-primary' : 'hover:bg-[var(--surface-2)]'
  }`

function CartBadge({ count, className = '' }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <span className={`tnum min-w-[1.25rem] h-5 px-1 rounded-full bg-primary text-on-primary text-[11px] font-extrabold flex items-center justify-center ${className}`}>
      {count}
    </span>
  )
}

export function Header() {
  const cart_items = useAppSelector((state) => state.Cart.items)
  const { user, isAuthenticated } = useAppSelector((state) => state.User)
  const { isDark, toggle } = useTheme()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const cartCount = cart_items.reduce((n, c) => n + c.qty, 0)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) { if (e.key === 'Escape') setMenuOpen(false); return }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close) }
  }, [menuOpen])

  async function handleLogout() {
    setMenuOpen(false)
    // Stop order alerts for this account on this device while the token is still valid
    await Promise.race([disableAlerts().catch(() => undefined), new Promise((r) => setTimeout(r, 1500))])
    clearChatsWithPrefix('lnm:bitebot:chat:')
    dispatch(logout())
    navigate('/login')
  }

  return (
    <>
      <header
        className="w-full border-b sticky top-0 z-50"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5" aria-label="LNM Bytes home">
            <TokenMark />
            <span className="font-display font-extrabold text-xl tracking-tight" style={{ color: 'var(--text-main)' }}>
              LNM Bytes
            </span>
          </Link>

          {/* Desktop navigation */}
          {isAuthenticated && (
            <nav className="hidden md:flex items-center gap-1" aria-label="Main" style={{ color: 'var(--text-main)' }}>
              <NavLink to="/" end className={navLinkClass}><Utensils className="w-4 h-4" />Canteens</NavLink>
              <NavLink to="/orders" className={navLinkClass}><Receipt className="w-4 h-4" />My orders</NavLink>
              <NavLink to="/cart" className={navLinkClass}>
                <ShoppingBag className="w-4 h-4" />Cart<CartBadge count={cartCount} className="ml-0.5" />
              </NavLink>
            </nav>
          )}

          <div className="flex items-center gap-1.5">
            <button
              id="theme-toggle-btn"
              onClick={toggle}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[var(--surface-2)]"
              style={{ color: 'var(--text-main)' }}
            >
              {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>

            {isAuthenticated && user ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="Account menu"
                  className="flex items-center rounded-full ring-2 ring-transparent focus-visible:ring-[var(--text-main)]"
                >
                  {user.picture ? (
                    <img src={user.picture} alt="" className="w-9 h-9 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center text-sm font-extrabold">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-56 rounded-xl border p-1.5 animate-fade-in"
                    style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', boxShadow: '0 12px 32px -8px rgb(0 0 0 / 0.25)' }}
                  >
                    <div className="px-3 py-2 border-b mb-1" style={{ borderColor: 'var(--border)' }}>
                      <p className="text-sm font-bold truncate" style={{ color: 'var(--text-main)' }}>{user.name}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
                    </div>
                    <Link
                      role="menuitem"
                      to="/wrapped"
                      onClick={() => setMenuOpen(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold text-left hover:bg-[var(--surface-2)]"
                      style={{ color: 'var(--text-main)' }}
                    >
                      <Sparkles className="w-4 h-4" /> My Wrapped
                    </Link>
                    <button
                      role="menuitem"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold text-left hover:bg-[var(--surface-2)]"
                      style={{ color: 'var(--text-main)' }}
                    >
                      <LogOut className="w-4 h-4" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className="px-4 h-9 flex items-center rounded-lg bg-primary text-on-primary font-extrabold text-sm hover:bg-primary-dark">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Phone navigation: a bottom bar keeps the three main places one thumb-tap away */}
      {isAuthenticated && (
        <nav
          aria-label="Main"
          className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t grid grid-cols-3"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {[
            { to: '/', label: 'Canteens', icon: Utensils, end: true },
            { to: '/orders', label: 'Orders', icon: Receipt, end: false },
            { to: '/cart', label: 'Cart', icon: ShoppingBag, end: false },
          ].map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="flex flex-col items-center gap-0.5 pt-2 pb-2.5 text-[11px] font-bold">
              {({ isActive }) => (
                <>
                  <span className={`relative flex items-center justify-center w-14 h-7 rounded-full ${isActive ? 'bg-primary text-on-primary' : ''}`}
                    style={isActive ? undefined : { color: 'var(--text-muted)' }}>
                    <Icon className="w-[18px] h-[18px]" />
                    {to === '/cart' && <CartBadge count={cartCount} className="absolute -top-1.5 right-0.5 !bg-[var(--text-main)] !text-[var(--surface)]" />}
                  </span>
                  <span style={{ color: isActive ? 'var(--text-main)' : 'var(--text-muted)' }}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      )}
    </>
  )
}
