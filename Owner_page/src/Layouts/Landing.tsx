import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { Sun, Moon } from 'lucide-react';

type Mode = 'login' | 'register';

// ─── Reusable input ───────────────────────────────────────────────────────────
function Field({
  label, type = 'text', placeholder, value, onChange, error,
}: {
  label: string; type?: string; placeholder: string; value: string;
  onChange: (v: string) => void; error?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-4 py-3.5 rounded-xl text-gray-800 dark:text-gray-100 font-medium
          placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 transition-all text-sm
          dark:bg-slate-700 dark:border-slate-600
          ${error ? 'bg-red-50 border border-red-200 focus:ring-red-100' : 'bg-gray-50 border border-gray-100 focus:ring-primary/20 focus:border-primary'}`}
      />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function Landing(): React.JSX.Element {
  const navigate = useNavigate();
  const { login, register, loading, error, setError } = useAuth();
  const { isDark, toggle } = useTheme();

  const [mode, setMode] = useState<Mode>('login');

  // Shared
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  // Register-only
  const [name, setName]           = useState('');
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone]         = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [upiId, setUpiId]         = useState('');

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Email and password are required.'); return; }
    const auth = await login(email, password);
    if (auth) {
      if (!auth.isApproved) {
        // Stay on landing page — waiting screen will show
        return;
      }
      // Superadmin gets their own panel
      if (auth.role === 'superadmin') {
        navigate('/superadmin');
      } else {
        navigate('/admin');
      }
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !storeName || !phone) {
      setError('All fields are required.'); return;
    }
    if (!/^\d{10}$/.test(phone)) {
      setError('Phone number must be exactly 10 digits.'); return;
    }
    if (password !== confirmPw) { setError('Passwords do not match.'); return; }
    if (password.length < 6)   { setError('Password must be at least 6 characters.'); return; }
    const auth = await register(name, email, password, storeName, phone, upiId);
    if (auth) navigate('/admin');
  };

  // ─── Auth state from localStorage ──────────────────────────────────────────
  const existingAuth = (() => {
    try {
      const token = localStorage.getItem('OWNER_TOKEN');
      const isApproved = localStorage.getItem('OWNER_IS_APPROVED') === 'true';
      const ownerName = localStorage.getItem('OWNER_NAME') || '';
      const storeName = localStorage.getItem('OWNER_STORE_NAME') || '';
      return token ? { isApproved, ownerName, storeName } : null;
    } catch { return null; }
  })();

  // ─── Waiting screen for unapproved owners ────────────────────────────────
  if (existingAuth && !existingAuth.isApproved) {
    return (
      <div
        className="relative min-h-screen flex items-center justify-center bg-cover bg-center"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1552566626-52f8b828add9?q=80&w=2070&auto=format&fit=crop')" }}
      >
        <div className="absolute inset-0 bg-primary/45 backdrop-blur-sm" />
        <div className="relative z-10 w-full max-w-md px-4">
          <div className="rounded-3xl p-10 shadow-2xl border border-white/20 text-center" style={{ backgroundColor: isDark ? '#1e293b' : '#ffffff' }}>
            <div className="text-6xl mb-6">⏳</div>
            <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100">Awaiting Approval</h2>
            <p className="mt-3 text-gray-500 font-medium">
              Hi <span className="font-black text-primary">{existingAuth.ownerName}</span>! Your account for{' '}
              <span className="font-black">{existingAuth.storeName}</span> is pending super admin approval.
            </p>
            <p className="mt-2 text-sm text-gray-400 font-medium">
              You'll be able to access your dashboard once approved. Please check back later.
            </p>
            <button
              onClick={() => {
                localStorage.removeItem('OWNER_TOKEN');
                localStorage.removeItem('OWNER_STORE_ID');
                localStorage.removeItem('OWNER_NAME');
                localStorage.removeItem('OWNER_STORE_NAME');
                localStorage.removeItem('OWNER_IS_APPROVED');
                window.location.reload();
              }}
              className="mt-8 px-6 py-3 rounded-xl font-black text-sm text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 transition-all"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center bg-cover bg-center"
      style={{ backgroundImage: "url('https://images.unsplash.com/photo-1552566626-52f8b828add9?q=80&w=2070&auto=format&fit=crop')" }}
    >
      <div className="absolute inset-0 bg-primary/45 backdrop-blur-sm" />

      {/* Theme toggle – floating top-right */}
      <button
        id="landing-theme-toggle"
        onClick={toggle}
        aria-label="Toggle dark mode"
        className={`absolute top-4 right-4 z-20 flex items-center w-14 h-7 rounded-full p-1 transition-colors duration-300 shadow-lg border ${
          isDark ? 'bg-primary border-primary/40' : 'bg-white/30 border-white/40'
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

      <div className="relative z-10 w-full max-w-md px-4 py-10">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-white/20 border border-white/30 shadow-xl backdrop-blur-md">
            <span className="text-3xl font-black text-white">L</span>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Partner Portal</h1>
          <p className="mt-2 text-white/70 font-bold text-sm uppercase tracking-widest">LNM BYTES • ADMIN</p>
        </div>

        {/* Card */}
        <div
          className="rounded-3xl p-8 shadow-2xl border border-white/20 transition-colors duration-300"
          style={{
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
          }}
        >
          {/* Tab switcher */}
          <div
            className="flex rounded-xl p-1 mb-7 border"
            style={{
              backgroundColor: isDark ? '#0f172a' : '#f9fafb',
              borderColor: isDark ? '#334155' : '#f1f5f9',
            }}
          >
            {(['login', 'register'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-black transition-all
                  ${mode === m ? 'bg-primary text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {m === 'login' ? '🔑 Sign In' : '✨ Register'}
              </button>
            ))}
          </div>

          {/* Error banner — context-aware */}
          {error && (() => {
            const isNotFound = error.toLowerCase().includes('no account') || error.toLowerCase().includes('not found');
            const isWrongPw  = error.toLowerCase().includes('incorrect password') || error.toLowerCase().includes('wrong password');
            const isServer   = error.toLowerCase().includes('server') || error.toLowerCase().includes('connect');
            const icon = isNotFound ? '🔍' : isWrongPw ? '🔑' : isServer ? '🌐' : '⚠️';
            return (
              <div className="mb-5 px-4 py-3.5 rounded-xl border flex items-start gap-3 animate-fade-in"
                style={{ backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#fff5f5', borderColor: isDark ? 'rgba(239,68,68,0.3)' : '#fecaca' }}
              >
                <span className="text-lg flex-shrink-0">{icon}</span>
                <div>
                  <p className="text-sm font-black text-red-500">
                    {isNotFound ? 'Account not found' : isWrongPw ? 'Wrong password' : isServer ? 'Connection error' : 'Error'}
                  </p>
                  <p className="text-xs font-medium mt-0.5" style={{ color: isDark ? '#fca5a5' : '#ef4444' }}>{error}</p>
                </div>
              </div>
            );
          })()}

          {/* ── LOGIN FORM ── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <Field label="Business Email" type="email" placeholder="admin@lnmbytes.com"
                value={email} onChange={setEmail}
                error={!!error && (error.toLowerCase().includes('email') || error.toLowerCase().includes('account') || error.toLowerCase().includes('required'))} />
              <Field label="Password" type="password" placeholder="••••••••"
                value={password} onChange={setPassword}
                error={!!error && (error.toLowerCase().includes('password') || error.toLowerCase().includes('incorrect'))} />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 mt-2 font-black text-white bg-primary rounded-xl hover:bg-primary-dark
                  shadow-lg shadow-primary/20 transition-all active:scale-[0.98] uppercase tracking-widest text-sm
                  disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? '⏳ Signing in...' : 'Access Dashboard →'}
              </button>
            </form>
          )}

          {/* ── REGISTER FORM ── */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              
              {/* Row 1: Name & Store */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Your Full Name" placeholder="e.g. Rahul Sharma"
                  value={name} onChange={setName} />
                <Field label="Store / Canteen Name" placeholder="e.g. LNM Bytes Canteen"
                  value={storeName} onChange={setStoreName} />
              </div>

              {/* Row 2: Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Business Email" type="email" placeholder="owner@lnmbytes.com"
                  value={email} onChange={setEmail} error={!!error && error.toLowerCase().includes('email')} />
                <Field label="Phone Number" type="tel" placeholder="10-digit number"
                  value={phone} onChange={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
                  error={phone.length > 0 && phone.length !== 10} />
              </div>

              {/* Row 3: Passwords */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 cursor-text">
                <Field label="Password (min 6 chars)" type="password" placeholder="••••••••"
                  value={password} onChange={setPassword} />
                <Field label="Confirm Password" type="password" placeholder="••••••••"
                  value={confirmPw} onChange={setConfirmPw}
                  error={password !== confirmPw && confirmPw.length > 0} />
              </div>

              {/* Row 4: Cashfree Single Column */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700/50">
                <Field label="Cashfree Vendor ID (Optional)" placeholder="Strictly alphanumeric, e.g. storename99"
                  value={upiId} onChange={setUpiId} />
              </div>

              <p className="text-[11px] text-gray-400 font-medium px-1">
                🏪 Your store will be created automatically. Phone is used as your store contact number.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 mt-1 font-black text-white bg-primary rounded-xl hover:bg-primary-dark
                  shadow-lg shadow-primary/20 transition-all active:scale-[0.98] uppercase tracking-widest text-sm
                  disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? '⏳ Creating account...' : 'Create Account →'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default Landing;