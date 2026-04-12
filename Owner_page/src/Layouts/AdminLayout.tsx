import { Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { readAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { Menu } from 'lucide-react';

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
      className="flex min-h-screen font-sans selection:bg-primary/30 transition-colors duration-300"
      style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text-main)' }}
    >
      {/* Mobile Top Header */}
      <div 
        className="md:hidden fixed top-0 w-full z-40 flex items-center justify-between p-4 border-b shadow-sm transition-colors duration-300" 
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center font-black text-lg shadow-inner">
            L
          </div>
          <span className="text-xl font-black tracking-tighter text-primary leading-none">LNM BYTES</span>
        </div>
        <button 
          onClick={() => setIsMobileOpen(true)} 
          className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-all active:scale-95"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      <Sidebar isMobileOpen={isMobileOpen} closeMobile={() => setIsMobileOpen(false)} />
      
      <main className="flex-1 md:ml-64 p-4 mt-16 md:mt-0 lg:p-8 transition-all relative z-0">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
