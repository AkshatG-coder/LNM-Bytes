import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { clearAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { Sun, Moon } from 'lucide-react';

const navItems = [
  { icon: '📊', label: 'Dashboard',     to: '/admin' },
  { icon: '🍔', label: 'Menu Editor',   to: '/admin/menu' },
  { icon: '📈', label: 'Daily Sales',   to: '/admin/sales' },
  { icon: '⚙️', label: 'Shop Settings', to: '/admin/settings' },
];

const Sidebar = () => {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { isDark, toggle } = useTheme();

  const ownerName  = localStorage.getItem('OWNER_NAME')       || 'Owner';
  const storeName  = localStorage.getItem('OWNER_STORE_NAME') || 'LNM BYTES';
  const ownerRole  = localStorage.getItem('OWNER_ROLE')       || 'owner';
  const isSuperAdmin = ownerRole === 'superadmin';
  const initials   = ownerName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const handleLogout = () => {
    clearAuth();
    navigate('/', { replace: true });
  };

  return (
    <aside
      className="hidden md:flex flex-col w-64 fixed h-full z-20 shadow-lg transition-colors duration-300"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderRight: '1px solid',
        borderColor: isDark ? '#334155' : '#f1f5f9',
      }}
    >
      {/* Logo */}
      <div
        className="p-6 flex items-center gap-3"
        style={{ borderBottom: `1px solid ${isDark ? '#334155' : '#f8fafc'}` }}
      >
        <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-black text-xl shadow-inner">
          L
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-lg font-black tracking-tighter text-primary leading-none">LNM BYTES</span>
          <span className="text-[10px] font-bold text-secondary-dark uppercase tracking-widest mt-0.5 truncate">
            Partner Portal
          </span>
        </div>
      </div>

      {/* Store name badge */}
      <div className="mx-4 mt-5 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Store</p>
        <p className="text-sm font-black text-primary mt-0.5 truncate">{storeName}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 space-y-1 mt-4">
        {navItems.map(({ icon, label, to }) => {
          const isActive = to === '/admin'
            ? location.pathname === '/admin'
            : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : isDark
                    ? 'text-slate-300 hover:bg-primary/20 hover:text-primary font-medium'
                    : 'text-gray-500 hover:bg-primary/10 hover:text-primary font-medium'
              }`}
            >
              <span className="text-lg">{icon}</span>
              <span className="font-bold text-sm tracking-tight">{label}</span>
            </NavLink>
          );
        })}

        {/* Super Admin only link */}
        {isSuperAdmin && (
          <NavLink
            to="/admin/superadmin"
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
              location.pathname.startsWith('/admin/superadmin')
                ? 'bg-yellow-500 text-white shadow-md shadow-yellow-500/20'
                : isDark
                  ? 'text-yellow-400 hover:bg-yellow-500/20 hover:text-yellow-300 font-medium'
                  : 'text-yellow-600 hover:bg-yellow-50 hover:text-yellow-700 font-medium'
            }`}
          >
            <span className="text-lg">👑</span>
            <span className="font-bold text-sm tracking-tight">Super Admin</span>
          </NavLink>
        )}
      </nav>

      {/* Bottom section: Owner profile + Theme toggle + Logout */}
      <div
        className="p-4 space-y-2"
        style={{
          borderTop: `1px solid ${isDark ? '#334155' : '#f1f5f9'}`,
          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(248,250,252,0.8)',
        }}
      >
        {/* Owner card */}
        <div
          className="flex items-center gap-3 p-3 rounded-xl border shadow-sm"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: isDark ? '#334155' : '#e2e8f0',
          }}
        >
          <div className="w-9 h-9 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-primary font-black text-xs flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p
              className="text-sm font-black truncate"
              style={{ color: isDark ? '#f1f5f9' : '#1f2937' }}
            >
              {ownerName}
            </p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Admin</p>
          </div>
        </div>

        {/* 🌗 Dark / Light Toggle */}
        <div className="flex items-center justify-between px-1 py-1">
          <span
            className="text-xs font-black uppercase tracking-widest"
            style={{ color: isDark ? '#94a3b8' : '#9ca3af' }}
          >
            {isDark ? 'Dark Mode' : 'Light Mode'}
          </span>
          <button
            id="owner-theme-toggle"
            onClick={toggle}
            aria-label="Toggle dark mode"
            className={`relative flex items-center w-14 h-7 rounded-full p-1 transition-colors duration-300 shadow-inner border ${
              isDark
                ? 'bg-primary border-primary/40'
                : 'bg-gray-100 border-gray-200'
            }`}
          >
            <span
              className={`absolute flex items-center justify-center w-5 h-5 rounded-full shadow-md transition-all duration-300 bg-white ${
                isDark ? 'translate-x-7' : 'translate-x-0'
              }`}
            >
              {isDark
                ? <Moon className="w-3 h-3 text-primary" />
                : <Sun  className="w-3 h-3 text-yellow-500" />
              }
            </span>
          </button>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all border border-transparent hover:border-red-100"
        >
          🚪 Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;