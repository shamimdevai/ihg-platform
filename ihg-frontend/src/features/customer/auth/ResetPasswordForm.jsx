import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as authApi from '../../../api/customer/authApi'

const schema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

export default function ResetPasswordForm() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async ({ newPassword }) => {
    setSubmitError(null)
    if (!token) {
      setSubmitError('Missing or invalid reset link.')
      return
    }
    try {
      await authApi.resetPassword({ token, newPassword })
      navigate('/shop/login', { replace: true })
    } catch (err) {
      setSubmitError(
        err?.response?.data?.message || 'Could not reset password. The link may have expired.'
      )
    }
  }

  if (!token) {
    return <p className="cx-error">This reset link is missing a token. Please request a new one.</p>
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="cx-form" noValidate>
      <div>
        <label htmlFor="newPassword" className="cx-field-label">New password</label>
        <input id="newPassword" type="password" autoComplete="new-password" {...register('newPassword')} className="cx-input" />
        {errors.newPassword && <p className="cx-error">{errors.newPassword.message}</p>}
      </div>

      {submitError && <p className="cx-error">{submitError}</p>}

      <button type="submit" disabled={isSubmitting} className="cx-btn cx-btn-primary cx-btn-block">
        {isSubmitting ? 'Resetting…' : 'Reset password'}
      </button>
    </form>
  )
}