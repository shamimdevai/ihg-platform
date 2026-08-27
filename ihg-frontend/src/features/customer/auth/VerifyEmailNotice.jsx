import { useState, useEffect } from 'react'
import { useSearchParams, useLocation, Link } from 'react-router-dom'
import * as authApi from '../../../api/customer/authApi'

// Handles two situations on the same screen:
// 1. Arriving right after register (no token in URL yet) — show a
//    "check your email" notice + a resend option.
// 2. Arriving from the emailed verification link (?token=...) — auto-
//    submits verify-email and shows the result.
export default function VerifyEmailNotice() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const token = searchParams.get('token')
  const emailFromRegister = location.state?.email

  const [status, setStatus] = useState(token ? 'verifying' : 'pending')
  const [error, setError] = useState(null)
  const [resendEmail, setResendEmail] = useState(emailFromRegister || '')
  const [resendSent, setResendSent] = useState(false)

  useEffect(() => {
    if (!token) return
    authApi
      .verifyEmail({ token })
      .then(() => setStatus('verified'))
      .catch((err) => {
        setError(
          err?.response?.data?.message ||
            'This verification link is invalid or has expired.'
        )
        setStatus('error')
      })
  }, [token])

  const handleResend = async (e) => {
    e.preventDefault()
    if (!resendEmail) return
    try {
      await authApi.resendVerification({ email: resendEmail })
      setResendSent(true)
    } catch {
      // Endpoint always returns a generic success message regardless of
      // whether the email exists — a failure here means a real network/
      // server error, not "email not found".
      setError('Could not resend the verification email. Try again.')
    }
  }

  if (status === 'verifying') {
    return <p className="text-gray-600">Verifying your email…</p>
  }

  if (status === 'verified') {
    return (
      <div className="text-center space-y-4">
        <p className="text-gray-700">Your email has been verified.</p>
        <Link to="/shop/login" className="text-navy hover:underline">
          Continue to sign in
        </Link>
      </div>
    )
  }

  if (status === 'error') {
    return <p className="text-sm text-red">{error}</p>
  }

  // status === 'pending'
  return (
    <div className="space-y-4">
      <p className="text-gray-700">
        We've sent a verification link to{' '}
        {emailFromRegister ? <strong>{emailFromRegister}</strong> : 'your email'}
        . Click the link to activate your account.
      </p>

      {resendSent ? (
        <p className="text-sm text-gray-600">
          If that email exists and is unverified, a new link has been sent.
        </p>
      ) : (
        <form onSubmit={handleResend} className="space-y-2">
          <label htmlFor="resendEmail" className="block text-sm font-medium text-gray-700">
            Didn't get it? Resend to:
          </label>
          <input
            id="resendEmail"
            type="email"
            value={resendEmail}
            onChange={(e) => setResendEmail(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy"
          />
          <button
            type="submit"
            className="w-full rounded-md bg-navy text-white py-2 font-medium hover:opacity-90"
          >
            Resend verification email
          </button>
        </form>
      )}

      {error && <p className="text-sm text-red">{error}</p>}
    </div>
  )
}