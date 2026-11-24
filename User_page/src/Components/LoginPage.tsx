import { useState } from 'react'
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'
import { useAppDispatch, useAppSelector } from '../Util/hook'
import { loginWithGoogle } from '../Util/UserReducer'
import { Navigate, useNavigate } from 'react-router-dom'

export function LoginPage() {
  const dispatch = useAppDispatch()
  const { isAuthenticated, loading } = useAppSelector((state) => state.User)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  // Signed in: go home. A phone number is no longer asked for.
  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    setError(null)
    const idToken = credentialResponse.credential ?? ''
    const result = await dispatch(loginWithGoogle(idToken))
    if (loginWithGoogle.rejected.match(result)) {
      const errMsg = result.payload as string
      setError(errMsg || "Sign-in failed. Use your @lnmiit.ac.in account.")
    } else if (loginWithGoogle.fulfilled.match(result)) {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Brand panel: ink navy, with haldi only for the logo and one phrase */}
      <div className="px-6 pt-8 pb-10 md:p-12 flex flex-col justify-between gap-10" style={{ backgroundColor: '#121B2E', color: '#EEF1F7' }}>
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="w-10 h-10 flex items-center justify-center bg-primary text-on-primary font-display font-extrabold text-xl"
            style={{
              borderRadius: 9,
              WebkitMask: 'radial-gradient(circle 5.5px at 0 50%, #0000 96%, #000) left / 51% 100% no-repeat, radial-gradient(circle 5.5px at 100% 50%, #0000 96%, #000) right / 51% 100% no-repeat',
              mask: 'radial-gradient(circle 5.5px at 0 50%, #0000 96%, #000) left / 51% 100% no-repeat, radial-gradient(circle 5.5px at 100% 50%, #0000 96%, #000) right / 51% 100% no-repeat',
            }}
          >
            L
          </span>
          <span className="font-display font-extrabold text-2xl">LNM Bytes</span>
        </div>

        <div>
          <h1 className="font-display font-extrabold text-4xl md:text-6xl leading-[1.02] max-w-lg">
            Order now. <span className="text-primary">Skip the queue.</span>
          </h1>
          <p className="mt-4 text-base md:text-lg font-semibold max-w-sm" style={{ color: '#9AA5BA' }}>
            Order from any LNMIIT canteen and pick it up when your token is called.
          </p>
        </div>

        {/* A sample token, just for show */}
        <div aria-hidden className="hidden md:block self-start -rotate-3">
          <div className="slip px-6 py-5 w-72" style={{ ['--notch-y' as string]: '3.9rem', backgroundColor: '#fff', borderColor: 'transparent', color: '#121B2E' }}>
            <div className="h-[3.4rem] flex items-baseline justify-between">
              <span className="font-display text-3xl font-extrabold tnum">#1042</span>
              <span className="text-sm font-bold">Ready in 8 min</span>
            </div>
            <div className="pt-3 space-y-1.5 text-sm font-semibold tnum" style={{ borderTop: '2px dashed #DADFE7' }}>
              <div className="flex items-end gap-2"><span>Masala Maggi</span><span className="leader" /><span>₹40</span></div>
              <div className="flex items-end gap-2"><span>Cold Coffee</span><span className="leader" /><span>₹60</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Sign in */}
      <div className="flex items-center justify-center px-6 py-12 md:p-12">
        <div className="w-full max-w-sm">
          <h2 className="text-3xl font-extrabold" style={{ color: 'var(--text-main)' }}>Sign in</h2>
          <p className="mt-2 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            Use your college Google account. Only <span className="font-bold" style={{ color: 'var(--text-main)' }}>@lnmiit.ac.in</span> addresses can order.
          </p>

          {error && (
            <div role="alert" className="mt-5 px-4 py-3 rounded-xl border text-sm font-bold" style={{ borderColor: 'var(--nonveg)', color: 'var(--nonveg)', backgroundColor: 'color-mix(in srgb, var(--nonveg) 10%, transparent)' }}>
              {error}
            </div>
          )}

          <div className="mt-6 flex">
            {loading ? (
              <div className="flex items-center gap-3 py-3">
                <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }} />
                <span className="font-bold text-sm" style={{ color: 'var(--text-muted)' }}>Signing you in…</span>
              </div>
            ) : (
              <GoogleLogin
                onSuccess={handleSuccess}
                onError={() => setError("Google sign-in failed. Try again.")}
                shape="rectangular"
                size="large"
                text="signin_with"
                logo_alignment="left"
              />
            )}
          </div>
        </div>
      </div>

    </div>
  )
}

export default LoginPage
