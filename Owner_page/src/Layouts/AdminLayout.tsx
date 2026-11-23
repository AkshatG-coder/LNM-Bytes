import { Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import CopilotChat from '../components/CopilotChat';
import { readAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { Menu } from 'lucide-react';
import TokenMark from '../components/TokenMark';

function AdminLayout() {
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Initialize theme on layout mount
  useTheme();

  // Guard: redirect to login if no valid auth in localStorage
  useEffect(() => {
    const auth = readAuth();
    if (!auth || !auth.token) {
      navigate('/', { replace: true });
      return;
    }
    // Superadmin must go to their own panel
    if (auth.role === 'superadmin') {
      navigate('/superadmin', { replace: true });
      return;
    }
    // Unapproved owners go back to login/waiting
    if (!auth.isApproved) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  return (
    <div
      className="flex min-h-screen font-sans selection:bg-primary/40"
      style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text-main)' }}
    >
      {/* Mobile top bar */}
      <div
        className="md:hidden fixed top-0 w-full z-40 h-14 flex items-center justify-between px-4 border-b"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-2.5">
          <TokenMark size={32} />
          <span className="font-display font-extrabold text-lg tracking-tight">LNM Bytes</span>
        </div>
        <button
          onClick={() => setIsMobileOpen(true)}
          aria-label="Open menu"
          className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-surface-2"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      <Sidebar isMobileOpen={isMobileOpen} closeMobile={() => setIsMobileOpen(false)} />

      <main className="flex-1 min-w-0 md:ml-64 px-4 pb-8 pt-20 md:pt-8 lg:px-8 relative z-0">
        <Outlet />
      </main>

      {/* AI Copilot: floating chat available on every admin page */}
      <CopilotChat />
    </div>
  );
}

export default AdminLayout;
