import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { Sun, Moon, LogOut } from 'lucide-react';
import TokenMark from '../components/TokenMark';
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
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text-main)' }}>
      <header className="sticky top-0 z-50 border-b" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <TokenMark size={34} />
            <div className="leading-tight">
              <p className="font-display font-extrabold text-lg tracking-tight">LNM Bytes</p>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Super admin</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-surface-2"
            >
              {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>

            <div className="flex items-center gap-2 pl-1">
              <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-display font-extrabold text-xs">{initials}</div>
              <span className="text-sm font-bold hidden sm:block">{name.split(' ')[0]}</span>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold border hover:bg-surface-2"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
            >
              <LogOut className="w-4 h-4" /> Sign out
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
