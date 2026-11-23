import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, UtensilsCrossed, TrendingUp, Lightbulb, ScanLine, Settings, Crown, LogOut, Sun, Moon, X } from 'lucide-react';
import { clearAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import TokenMark from './TokenMark';

const navItems = [
  { Icon: LayoutDashboard, label: 'Orders',        to: '/admin' },
  { Icon: UtensilsCrossed, label: 'Menu',          to: '/admin/menu' },
  { Icon: TrendingUp,      label: 'Daily sales',   to: '/admin/sales' },
  { Icon: Lightbulb,       label: 'Insights',      to: '/admin/insights' },
  { Icon: ScanLine,        label: 'Scan QR',       to: '/admin/scan' },
  { Icon: Settings,        label: 'Shop settings', to: '/admin/settings' },
];

const Sidebar = ({ isMobileOpen, closeMobile }: { isMobileOpen?: boolean; closeMobile?: () => void }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark, toggle } = useTheme();

  const ownerName = localStorage.getItem('OWNER_NAME') || 'Owner';
  const storeName = localStorage.getItem('OWNER_STORE_NAME') || 'Your canteen';
  const ownerRole = localStorage.getItem('OWNER_ROLE') || 'owner';
  const isSuperAdmin = ownerRole === 'superadmin';
  const initials = ownerName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const handleLogout = () => {
    clearAuth();
    navigate('/', { replace: true });
  };

  const linkCls = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold ${
      active ? 'bg-primary text-on-primary' : 'hover:bg-surface-2'
    }`;

  return (
    <>
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={closeMobile} aria-hidden />
      )}

      <aside
        aria-label="Main"
        className={`flex flex-col w-64 fixed h-full z-50 border-r transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-main)' }}
      >
        <div className="px-5 h-16 flex items-center gap-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <TokenMark size={36} />
          <div className="min-w-0 leading-tight">
            <p className="font-display font-extrabold text-lg tracking-tight">LNM Bytes</p>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Partner portal</p>
          </div>
          <button onClick={closeMobile} aria-label="Close menu" className="md:hidden ml-auto w-9 h-9 rounded-lg flex items-center justify-center hover:bg-surface-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* The canteen's own "token": which store you are managing */}
        <div className="mx-4 mt-4 px-3 py-2.5 rounded-lg bg-surface-2">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Managing</p>
          <p className="font-display font-bold truncate">{storeName}</p>
        </div>

        <nav className="flex-1 px-4 mt-4 space-y-1 overflow-y-auto">
          {navItems.map(({ Icon, label, to }) => {
            const isActive = to === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(to);
            return (
              <NavLink key={to} to={to} onClick={closeMobile} className={linkCls(isActive)} aria-current={isActive ? 'page' : undefined}>
                <Icon className="w-[18px] h-[18px]" />
                {label}
              </NavLink>
            );
          })}

          {isSuperAdmin && (
            <NavLink to="/admin/superadmin" onClick={closeMobile} className={linkCls(location.pathname.startsWith('/admin/superadmin'))}>
              <Crown className="w-[18px] h-[18px]" />
              Super admin
            </NavLink>
          )}
        </nav>

        <div className="p-4 space-y-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-3 px-1 py-1">
            <div className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center font-display font-extrabold text-xs flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold truncate">{ownerName}</p>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{isSuperAdmin ? 'Super admin' : 'Owner'}</p>
            </div>
            <button
              id="owner-theme-toggle"
              onClick={toggle}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-surface-2"
            >
              {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold border hover:bg-surface-2"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
