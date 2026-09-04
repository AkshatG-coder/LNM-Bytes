import { useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { useAppDispatch, useAppSelector } from '../Util/hook'
import { loginWithGoogle } from '../Util/UserReducer'
import { Navigate, useNavigate } from 'react-router-dom'
import PhoneModal from './PhoneModal'

export function LoginPage() {
  const dispatch = useAppDispatch()
  const { isAuthenticated, user, loading } = useAppSelector((state) => state.User)
  const [error, setError] = useState<string | null>(null)
  const [showPhoneModal, setShowPhoneModal] = useState(false)
  const navigate = useNavigate()

  // Already authenticated with phone → go home
  if (isAuthenticated && user?.phone) {
    return <Navigate to="/" replace />
  }

  // Authenticated but no phone → show phone modal immediately
  if (isAuthenticated && !user?.phone && !showPhoneModal) {
    // Trigger it on next render
    setTimeout(() => setShowPhoneModal(true), 0)
  }

  const handleSuccess = async (credentialResponse: any) => {
    setError(null)
    const idToken = credentialResponse.credential
    const result = await dispatch(loginWithGoogle(idToken))
    if (loginWithGoogle.rejected.match(result)) {
      const errMsg = result.payload as string
      setError(errMsg || "Login failed. Only @lnmiit.ac.in emails are allowed.")
    } else if (loginWithGoogle.fulfilled.match(result)) {
      const { user: loggedUser } = result.payload.data
      if (!loggedUser.phone) {
        setShowPhoneModal(true)
      } else {
        navigate('/')
      }
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, var(--bg) 0%, color-mix(in srgb, var(--bg) 80%, var(--primary)) 100%)'
      }}
    >
      {/* Blobs */}
      <div className="absolute top-0 left-0 w-72 h-72 rounded-full bg-primary/10 blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-secondary/10 blur-3xl translate-x-1/3 translate-y-1/3" />

      <div
        className="relative z-10 w-full max-w-md mx-4 rounded-3xl p-8 shadow-2xl border"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-white text-2xl font-black shadow-lg shadow-primary/30 mb-4">
            L
          </div>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--text-main)' }}>
            LNM BYTES
          </h1>
          <p className="mt-1 font-bold text-sm" style={{ color: 'var(--text-muted)' }}>
            LNMIIT Campus Canteen Services
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Sign in to continue
          </span>
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3">
            <span className="text-red-400 flex-shrink-0">⚠️</span>
            <span className="text-sm font-bold text-red-600">{error}</span>
          </div>
        )}

        {/* Google Login */}
        <div className="flex justify-center">
          {loading ? (
            <div className="flex items-center gap-3 py-4">
              <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
              <span className="font-bold text-sm" style={{ color: 'var(--text-muted)' }}>Signing you in...</span>
            </div>
          ) : (
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={() => setError("Google sign-in failed. Please try again.")}
              shape="rectangular"
              size="large"
              text="signin_with"
              logo_alignment="left"
            />
          )}
        </div>

        {/* Info */}
        <div
          className="mt-6 px-4 py-3 rounded-xl border text-center"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
        >
          <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
            🔒 Only <span className="text-primary">@lnmiit.ac.in</span> email addresses are allowed
          </p>
        </div>
      </div>

      {/* Phone modal */}
      {showPhoneModal && user && (
        <PhoneModal userId={user.id} onComplete={() => { setShowPhoneModal(false); navigate('/'); }} />
      )}
    </div>
  )
}

export default LoginPage
