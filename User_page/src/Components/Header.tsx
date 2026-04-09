import { ShoppingCart, Sun, Moon, LogOut } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { useAppSelector, useAppDispatch } from "../Util/hook"
import { useTheme } from "../Util/useTheme"
import { logout } from "../Util/UserReducer"

export function Header() {
  const cart_items = useAppSelector((state) => state.Cart.items)
  const { user, isAuthenticated } = useAppSelector((state) => state.User)
  const { isDark, toggle } = useTheme()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  function handleLogout() {
    dispatch(logout())
    navigate('/login')
  }

  return (
    <header
      className="w-full border-b sticky top-0 z-50 transition-colors duration-300"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">

        {/* Left: Logo / Branding */}
        <Link to="/" className="flex items-center gap-3 cursor-pointer group">
          <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-black text-lg shadow-md group-hover:scale-105 transition-transform">
            L
          </div>
          <div className="leading-tight">
            <p className="text-lg font-black text-primary tracking-tight leading-none">
              LNM BYTES
            </p>
            <p className="text-[10px] font-bold text-secondary-dark uppercase tracking-widest">
              Canteen Services
            </p>
          </div>
        </Link>

        {/* Right: Theme toggle + User info + Cart */}
        <div className="flex items-center gap-2">

          {/* 🌗 Dark / Light Toggle */}
          <button
            id="theme-toggle-btn"
            onClick={toggle}
            aria-label="Toggle dark mode"
            className={`relative flex items-center w-16 h-8 rounded-full p-1 transition-colors duration-300 shadow-inner border ${
              isDark
                ? 'bg-primary border-primary/40'
                : 'bg-gray-100 border-gray-200'
            }`}
          >
            <span
              className={`absolute flex items-center justify-center w-6 h-6 rounded-full shadow-md transition-all duration-300 ${
                isDark
                  ? 'translate-x-8 bg-white'
                  : 'translate-x-0 bg-white'
              }`}
            >
              {isDark
                ? <Moon className="w-3.5 h-3.5 text-primary" />
                : <Sun  className="w-3.5 h-3.5 text-yellow-500" />
              }
            </span>
          </button>

          {/* User avatar / login button */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              {/* Avatar */}
              <div className="flex items-center gap-2 px-2 py-1 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                {user.picture ? (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="w-7 h-7 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-black">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="hidden sm:block text-sm font-bold max-w-[100px] truncate" style={{ color: 'var(--text-main)' }}>
                  {user.name.split(' ')[0]}
                </span>
              </div>

              {/* Logout */}
              <button
                onClick={handleLogout}
                title="Logout"
                className="p-2 rounded-xl transition-colors hover:bg-red-50 hover:text-red-500"
                style={{ color: 'var(--text-muted)' }}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2 rounded-xl bg-primary text-white font-black text-sm hover:bg-primary-dark transition-colors shadow-sm"
            >
              Sign In
            </Link>
          )}

          {/* Cart Icon */}
          <Link
            to="/cart"
            className="relative flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200"
            style={{ color: 'var(--text-muted)' }}
          >
            <div className="relative">
              <ShoppingCart className="w-6 h-6" />
              {cart_items.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-accent text-white text-xs w-5 h-5 flex items-center justify-center rounded-full shadow-sm font-bold">
                  {cart_items.length}
                </span>
              )}
            </div>
            <span className="hidden sm:block text-sm font-bold">
              Cart
            </span>
          </Link>
        </div>
      </div>
    </header>
  )
}
