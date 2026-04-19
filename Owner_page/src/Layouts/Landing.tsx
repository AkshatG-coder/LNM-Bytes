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

// ─── Password field with show/hide toggle ─────────────────────────────────────
function PasswordField({
  label, placeholder, value, onChange, error,
}: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; error?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-4 py-3.5 pr-12 rounded-xl text-gray-800 dark:text-gray-100 font-medium
            placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 transition-all text-sm
            dark:bg-slate-700 dark:border-slate-600
            ${error ? 'bg-red-50 border border-red-200 focus:ring-red-100' : 'bg-gray-50 border border-gray-100 focus:ring-primary/20 focus:border-primary'}`}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors p-1"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function Landing(): React.JSX.Element {
  const navigate = useNavigate();
  const { login, register, resetPassword, forgotSendOtp, forgotVerifyOtp, forgotResetPassword, loading, error, setError } = useAuth();
  const { isDark, toggle } = useTheme();

  const [mode, setMode] = useState<Mode>('login');
  const [showForgot, setShowForgot] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Shared
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  // Register-only
  const [name, setName]           = useState('');
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone]         = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [upiId, setUpiId]         = useState('');

  // ── Forgot-password 3-step wizard state ──────────────────────────────────
  const [fpStep, setFpStep]               = useState<1 | 2 | 3>(1);
  const [fpEmail, setFpEmail]             = useState('');
  const [fpOtp, setFpOtp]                 = useState(['', '', '', '', '', '']);
  const [otpResetToken, setOtpResetToken] = useState('');
  const [fpNewPw, setFpNewPw]             = useState('');
  const [fpConfirmPw, setFpConfirmPw]     = useState('');
  const [fpTimer, setFpTimer]             = useState(0);

  // Timer countdown after OTP is sent
  React.useEffect(() => {
    if (fpTimer <= 0) return;
    const t = setTimeout(() => setFpTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [fpTimer]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setShowForgot(false);
    setResetSuccess(false);
  };

  const openForgot = () => {
    setShowForgot(true);
    setFpStep(1);
    setFpEmail(email);
    setFpOtp(['', '', '', '', '', '']);
    setOtpResetToken('');
    setFpNewPw('');
    setFpConfirmPw('');
    setFpTimer(0);
    setError(null);
    setResetSuccess(false);
  };

  const closeForgot = () => {
    setShowForgot(false);
    setError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Email and password are required.'); return; }
    const auth = await login(email, password);
    if (auth) {
      if (!auth.isApproved) return;
      if (auth.role === 'superadmin') navigate('/superadmin');
      else navigate('/admin');
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

  // ── Forgot Step 1: send OTP ──────────────────────────────────────────────
  const handleFpSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fpEmail) { setError('Please enter your account email.'); return; }
    const ok = await forgotSendOtp(fpEmail);
    if (ok) {
      setFpStep(2);
      setFpTimer(60); // 1-min countdown
      setFpOtp(['', '', '', '', '', '']);
    }
  };

  // ── Forgot Step 2: verify OTP ────────────────────────────────────────────
  const handleFpVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpStr = fpOtp.join('');
    if (otpStr.length < 6) { setError('Please enter all 6 digits of the OTP.'); return; }
    const token = await forgotVerifyOtp(fpEmail, otpStr);
    if (token) {
      setOtpResetToken(token);
      setFpStep(3);
      setFpNewPw('');
      setFpConfirmPw('');
    }
  };

  // ── Forgot Step 3: reset password ────────────────────────────────────────
  const handleFpResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fpNewPw || !fpConfirmPw) { setError('Please fill both password fields.'); return; }
    if (fpNewPw !== fpConfirmPw) { setError('Passwords do not match.'); return; }
    if (fpNewPw.length < 6) { setError('Password must be at least 6 characters.'); return; }
    const ok = await forgotResetPassword(otpResetToken, fpNewPw);
    if (ok) {
      setResetSuccess(true);
      setShowForgot(false);
      setPassword('');
      setEmail(fpEmail);
    }
  };

  // ── OTP input box handler ─────────────────────────────────────────────────
  const handleOtpChange = (index: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...fpOtp];
    next[index] = val;
    setFpOtp(next);
    if (val && index < 5) {
      document.getElementById(`otp-box-${index + 1}`)?.focus();
    }
  };
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !fpOtp[index] && index > 0) {
      document.getElementById(`otp-box-${index - 1}`)?.focus();
    }
  };
  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setFpOtp(pasted.split(''));
      document.getElementById('otp-box-5')?.focus();
      e.preventDefault();
    }
  };

  const fpTimerStr = fpTimer > 0
    ? `${String(Math.floor(fpTimer / 60)).padStart(2, '0')}:${String(fpTimer % 60).padStart(2, '0')}`
    : null;

  // ─── Auth state from localStorage ──────────────────────────────────────────
  const existingAuth = React.useMemo(() => {
    try {
      const token = localStorage.getItem('OWNER_TOKEN');
      const isApproved = localStorage.getItem('OWNER_IS_APPROVED') === 'true';
      const ownerName = localStorage.getItem('OWNER_NAME') || '';
      const storeName = localStorage.getItem('OWNER_STORE_NAME') || '';
      const role = localStorage.getItem('OWNER_ROLE') || '';
      return token ? { isApproved, ownerName, storeName, role, token } : null;
    } catch { return null; }
  }, []);

  // ─── Auto-redirect if fully logged in ────────────────────────────────────
  React.useEffect(() => {
    if (existingAuth && existingAuth.isApproved && existingAuth.token && existingAuth.token !== 'pending') {
      if (existingAuth.role === 'superadmin') {
        navigate('/superadmin');
      } else {
        navigate('/admin');
      }
    }
  }, [existingAuth, navigate]);

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
          {/* ── FORGOT PASSWORD FORM ── */}
          {showForgot ? (
            <>
              <div className="flex items-center gap-3 mb-6">
                <button
                  type="button"
                  onClick={closeForgot}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-400 hover:text-gray-600"
                  aria-label="Go back"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
                <div>
                  <h2 className="text-base font-black text-gray-800 dark:text-gray-100">Reset Password</h2>
                  <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                    {fpStep === 1 && "We'll send a verification code to your email."}
                    {fpStep === 2 && "Enter the 6-digit code sent to your email."}
                    {fpStep === 3 && "Create a new strong password."}
                  </p>
                </div>
              </div>

              {error && (
                <div className="mb-5 px-4 py-3 rounded-xl border flex items-start gap-3 flex-shrink-0"
                  style={{ backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#fff5f5', borderColor: isDark ? 'rgba(239,68,68,0.3)' : '#fecaca' }}
                >
                  <span className="text-lg flex-shrink-0">⚠️</span>
                  <p className="text-sm font-medium text-red-500 break-words">{error}</p>
                </div>
              )}

              {/* Step 1: Email */}
              {fpStep === 1 && (
                <form onSubmit={handleFpSendOtp} className="space-y-4">
                  <Field label="Your Account Email" type="email" placeholder="owner@lnmbytes.com"
                    value={fpEmail} onChange={setFpEmail} />
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 mt-2 font-black text-white bg-primary rounded-xl hover:bg-primary-dark
                      shadow-lg shadow-primary/20 transition-all active:scale-[0.98] uppercase tracking-widest text-sm
                      disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? '⏳ Sending OTP...' : 'Send Verification Code →'}
                  </button>
                </form>
              )}

              {/* Step 2: OTP */}
              {fpStep === 2 && (
                <form onSubmit={handleFpVerifyOtp} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                      Enter OTP
                    </label>
                    <div className="flex gap-2 justify-between" onPaste={handleOtpPaste}>
                      {fpOtp.map((digit, i) => (
                        <input
                          key={i}
                          id={`otp-box-${i}`}
                          type="text"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(i, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(i, e)}
                          className={`w-full aspect-square text-center text-xl font-black rounded-xl border
                            focus:outline-none focus:ring-2 transition-all
                            dark:bg-slate-700 dark:text-white dark:border-slate-600
                            ${error ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-primary/20 focus:border-primary'}`}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between items-center px-1 mt-2">
                      <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className={`${fpTimer > 0 ? 'animate-ping' : ''} absolute inline-flex h-full w-full rounded-full bg-primary opacity-75`}></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                        Expires in {fpTimerStr || '00:00'}
                      </span>
                      {fpTimer === 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            forgotSendOtp(fpEmail).then(ok => { if (ok) { setFpTimer(60); setFpOtp(['','','','','','']); } });
                          }}
                          className="text-xs font-bold text-primary hover:underline"
                        >
                          Resend Code
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading || fpTimer === 0}
                    className="w-full py-4 mt-2 font-black text-white bg-primary rounded-xl hover:bg-primary-dark
                      shadow-lg shadow-primary/20 transition-all active:scale-[0.98] uppercase tracking-widest text-sm
                      disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? '⏳ Verifying...' : 'Verify OTP →'}
                  </button>
                </form>
              )}

              {/* Step 3: New Password */}
              {fpStep === 3 && (
                <form onSubmit={handleFpResetPassword} className="space-y-4">
                  <div className="space-y-4">
                    <PasswordField label="New Password (min 6 chars)" placeholder="Choose a strong password"
                      value={fpNewPw} onChange={setFpNewPw} />
                    <PasswordField label="Confirm New Password" placeholder="Type it again"
                      value={fpConfirmPw} onChange={setFpConfirmPw}
                      error={fpConfirmPw.length > 0 && fpNewPw !== fpConfirmPw} />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 mt-2 font-black text-white bg-primary rounded-xl hover:bg-primary-dark
                      shadow-lg shadow-primary/20 transition-all active:scale-[0.98] uppercase tracking-widest text-sm
                      disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? '⏳ Resetting...' : 'Set New Password →'}
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
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

              {/* Success banner after password reset */}
              {resetSuccess && (
                <div className="mb-5 px-4 py-3.5 rounded-xl border flex items-start gap-3 animate-fade-in"
                  style={{ backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : '#f0fdf4', borderColor: isDark ? 'rgba(34,197,94,0.3)' : '#bbf7d0' }}
                >
                  <span className="text-lg flex-shrink-0">✅</span>
                  <div>
                    <p className="text-sm font-black text-green-600 dark:text-green-400">Password reset successful!</p>
                    <p className="text-xs font-medium mt-0.5 text-green-500">Your email is pre-filled. Enter your new password to sign in.</p>
                  </div>
                </div>
              )}

              {/* Error banner */}
              {error && !resetSuccess && (() => {
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
                  <PasswordField label="Password" placeholder="••••••••"
                    value={password} onChange={setPassword}
                    error={!!error && (error.toLowerCase().includes('password') || error.toLowerCase().includes('incorrect'))} />

                  {/* Forgot password link */}
                  <div className="flex justify-end -mt-2">
                    <button
                      type="button"
                      onClick={openForgot}
                      className="text-xs font-bold text-primary hover:underline transition-all"
                    >
                      Forgot password?
                    </button>
                  </div>

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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <PasswordField label="Password (min 6 chars)" placeholder="••••••••"
                      value={password} onChange={setPassword} />
                    <PasswordField label="Confirm Password" placeholder="••••••••"
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
                    className="w-full py-4 mt-2 font-black text-white bg-primary rounded-xl hover:bg-primary-dark
                      shadow-lg shadow-primary/20 transition-all active:scale-[0.98] uppercase tracking-widest text-sm
                      disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? '⏳ Creating account...' : 'Create Account →'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Landing;