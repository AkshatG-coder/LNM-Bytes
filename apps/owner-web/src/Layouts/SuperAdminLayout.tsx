import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { Sun, Moon } from 'lucide-react';
import SuperAdminPanel from './SuperAdminPanel';

function SuperAdminLayout() {
  const navigate = useNavigate();
  const { isDark, toggle } = useTheme();

  const token    = localStorage.getItem('OWNER_TOKEN');
  const role     = localStorage.getItem('OWNER_ROLE');
  const name     = localStorage.getItem('OWNER_NAME') || 'Super Admin';
  const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  // Guard: only superadmin may access this layout
  useEffect(() => {
    if (!token || token === 'pending' || role !== 'superadmin') {
      navigate('/', { replace: true });
    }
  }, [navigate, token, role]);

  function handleLogout() {
    clearAuth();
    navigate('/', { replace: true });
  }

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{ backgroundColor: 'var(--color-background)', color: 'var(--text-main)' }}
    >
      {/* ── Top bar ── */}
      <header
        className="sticky top-0 z-50 border-b shadow-sm"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: isDark ? '#334155' : '#f1f5f9',
        }}
      >
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">

          {/* Branding */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white font-black text-base shadow-md">
              L
            </div>
            <div className="leading-tight">
              <p className="text-sm font-black text-primary tracking-tight leading-none">LNM BYTES</p>
              <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest">Super Admin</p>
            </div>
          </div>

          {/* Right: theme + avatar + logout */}
          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <button
              onClick={toggle}
              aria-label="Toggle dark mode"
              className={`relative flex items-center w-12 h-6 rounded-full p-0.5 transition-colors duration-300 border ${
                isDark ? 'bg-primary border-primary/40' : 'bg-gray-100 border-gray-200'
              }`}
            >
              <span className={`absolute flex items-center justify-center w-5 h-5 rounded-full shadow bg-white transition-all duration-300 ${isDark ? 'translate-x-6' : 'translate-x-0'}`}>
                {isDark
                  ? <Moon className="w-3 h-3 text-primary" />
                  : <Sun  className="w-3 h-3 text-yellow-500" />
                }
              </span>
            </button>

            {/* Avatar */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border"
              style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}
            >
              <div className="w-7 h-7 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center text-yellow-600 font-black text-xs">
                {initials}
              </div>
              <span className="text-sm font-bold hidden sm:block" style={{ color: 'var(--text-main)' }}>
                {name.split(' ')[0]}
              </span>
              <span
                className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ backgroundColor: isDark ? 'rgba(234,179,8,0.15)' : '#fef9c3', color: '#ca8a04' }}
              >
                👑 SuperAdmin
              </span>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-xl text-xs font-black text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </header>

      {/* ── Content — only the approve/reject panel ── */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        <SuperAdminPanel />
      </main>
    </div>
  );
}

export default SuperAdminLayout;
