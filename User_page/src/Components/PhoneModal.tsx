import { useState } from 'react'
import api from '../Util/api'

interface PhoneModalProps {
  userId: string
  onComplete: () => void
}

type Step = 'enter_phone' | 'enter_otp' | 'success'

export default function PhoneModal({ userId, onComplete }: PhoneModalProps) {
  const [step, setStep] = useState<Step>('enter_phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)

  // ── Send OTP ──────────────────────────────────────────────────────────────
  async function handleSendOtp() {
    setError(null)
    if (!/^\d{10}$/.test(phone)) {
      setError('Please enter a valid 10-digit mobile number')
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/auth/otp/send', { phone })
      if (res.data?.success) {
        setStep('enter_otp')
        startResendTimer()
      } else {
        setError(res.data?.message || 'Failed to send OTP')
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to send OTP. Try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Verify OTP ────────────────────────────────────────────────────────────
  async function handleVerifyOtp() {
    setError(null)
    if (otp.length !== 6) {
      setError('Please enter the 6-digit OTP sent to your phone')
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/auth/otp/verify', { userId, phone, otp })
      if (res.data?.success) {
        setStep('success')
        setTimeout(() => onComplete(), 1500)
      } else {
        setError(res.data?.message || 'Invalid OTP')
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Incorrect or expired OTP.')
    } finally {
      setLoading(false)
    }
  }

  // ── Resend timer ──────────────────────────────────────────────────────────
  function startResendTimer() {
    setResendCooldown(30)
    const t = setInterval(() => {
      setResendCooldown(n => {
        if (n <= 1) { clearInterval(t); return 0 }
        return n - 1
      })
    }, 1000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-sm rounded-3xl p-8 shadow-2xl border animate-slide-up"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >

        {/* Success state */}
        {step === 'success' && (
          <div className="text-center py-6">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-xl font-black" style={{ color: 'var(--text-main)' }}>Phone Verified!</h2>
            <p className="mt-2 font-medium" style={{ color: 'var(--text-muted)' }}>Redirecting you to the canteen...</p>
          </div>
        )}

        {/* Step 1 — Enter phone */}
        {step === 'enter_phone' && (
          <>
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">📱</div>
              <h2 className="text-xl font-black" style={{ color: 'var(--text-main)' }}>Verify Your Mobile</h2>
              <p className="mt-2 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                We need your phone number so canteen owners can contact you about your order.
              </p>
            </div>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm font-bold text-red-600 flex gap-2">
                <span>⚠️</span> {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                Mobile Number
              </label>
              <div
                className="flex items-center rounded-xl border overflow-hidden"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}
              >
                <span className="px-3 py-3.5 font-bold text-sm border-r" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                  +91
                </span>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="9876543210"
                  value={phone}
                  onChange={e => { setPhone(e.target.value.replace(/\D/g, '')); setError(null) }}
                  className="flex-1 px-3 py-3.5 bg-transparent font-medium text-sm focus:outline-none"
                  style={{ color: 'var(--text-main)' }}
                />
              </div>
            </div>

            <button
              onClick={handleSendOtp}
              disabled={loading || phone.length !== 10}
              className="mt-6 w-full py-4 bg-primary text-white rounded-xl font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Sending OTP...' : 'Send OTP →'}
            </button>
          </>
        )}

        {/* Step 2 — Enter OTP */}
        {step === 'enter_otp' && (
          <>
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">🔐</div>
              <h2 className="text-xl font-black" style={{ color: 'var(--text-main)' }}>Enter OTP</h2>
              <p className="mt-2 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                6-digit code sent to <span className="font-black text-primary"> +91 {phone}</span>
              </p>
            </div>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm font-bold text-red-600 flex gap-2">
                <span>⚠️</span> {error}
              </div>
            )}

            <input
              type="tel"
              maxLength={6}
              placeholder="• • • • • •"
              value={otp}
              onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setError(null) }}
              className="w-full text-center text-3xl font-black tracking-[0.6em] py-4 rounded-xl border focus:outline-none focus:ring-2 focus:ring-primary/20"
              style={{
                backgroundColor: 'var(--bg)',
                borderColor: 'var(--border)',
                color: 'var(--text-main)',
              }}
            />

            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.length !== 6}
              className="mt-6 w-full py-4 bg-primary text-white rounded-xl font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Verifying...' : '✅ Verify & Continue'}
            </button>

            {/* Resend */}
            <div className="mt-4 text-center">
              {resendCooldown > 0 ? (
                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  Resend OTP in {resendCooldown}s
                </p>
              ) : (
                <button
                  onClick={() => { handleSendOtp(); }}
                  className="text-xs font-black text-primary hover:underline"
                >
                  Resend OTP
                </button>
              )}
              <button
                onClick={() => { setStep('enter_phone'); setOtp(''); setError(null) }}
                className="block mx-auto mt-2 text-xs font-medium hover:underline"
                style={{ color: 'var(--text-muted)' }}
              >
                ← Change number
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
