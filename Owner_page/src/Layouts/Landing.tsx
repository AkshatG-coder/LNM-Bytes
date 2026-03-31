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
  const [confirmPw, setConfirmPw] = useState('');

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Email and password are required.'); return; }
    const auth = await login(email, password);
    if (auth) navigate('/admin');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !storeName) {
      setError('All fields are required.'); return;
    }
    if (password !== confirmPw) { setError('Passwords do not match.'); return; }
    if (password.length < 6)   { setError('Password must be at least 6 characters.'); return; }
    const auth = await register(name, email, password, storeName);
    if (auth) navigate('/admin');
  };

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

          {/* Error banner */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3">
              <span className="text-red-400 flex-shrink-0 mt-0.5">⚠️</span>
              <span className="text-sm font-bold text-red-600">{error}</span>
            </div>
          )}

          {/* ── LOGIN FORM ── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <Field label="Business Email" type="email" placeholder="admin@lnmbytes.com"
                value={email} onChange={setEmail} error={!!error} />
              <Field label="Password" type="password" placeholder="••••••••"
                value={password} onChange={setPassword} error={!!error} />
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
              <Field label="Your Full Name" placeholder="e.g. Rahul Sharma"
                value={name} onChange={setName} />
              <Field label="Store Name" placeholder="e.g. LNM Bytes Canteen"
                value={storeName} onChange={setStoreName} />
              <Field label="Business Email" type="email" placeholder="owner@lnmbytes.com"
                value={email} onChange={setEmail} error={!!error} />
              <Field label="Password (min 6 chars)" type="password" placeholder="••••••••"
                value={password} onChange={setPassword} />
              <Field label="Confirm Password" type="password" placeholder="••••••••"
                value={confirmPw} onChange={setConfirmPw}
                error={password !== confirmPw && confirmPw.length > 0} />

              <p className="text-[11px] text-gray-400 font-medium px-1">
                🏪 Your store will be created automatically. You can update the details from Settings.
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