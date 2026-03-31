import { Outlet, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { readAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

function AdminLayout() {
  const navigate = useNavigate();

  // Initialize theme on layout mount
  useTheme();

  // Guard: redirect to login if no valid auth in localStorage
  useEffect(() => {
    const auth = readAuth();
    if (!auth) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  return (
    <div
      className="flex min-h-screen font-sans selection:bg-primary/30 transition-colors duration-300"
      style={{ backgroundColor: 'var(--color-background)', color: 'var(--text-main)' }}
    >
      <Sidebar />
      <main className="flex-1 md:ml-64 p-4 lg:p-8 transition-all">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
