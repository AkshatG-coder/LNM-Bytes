import { ShoppingCart, Sun, Moon } from "lucide-react"
import { Link } from "react-router-dom"
import { useAppSelector } from "../Util/hook"
import { useTheme } from "../Util/useTheme"

export function Header() {
  const cart_items = useAppSelector((state) => state.Cart.items)
  const { isDark, toggle } = useTheme()

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
          {/* Logo */}
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

        {/* Right: Theme toggle + Cart */}
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
