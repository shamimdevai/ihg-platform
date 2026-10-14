import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import * as authApi from '../../../api/customer/authApi'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
})

export default function ForgotPasswordForm() {
  const [sent, setSent] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async ({ email }) => {
    setSubmitError(null)
    try {
      await authApi.forgotPassword({ email })
      setSent(true)
    } catch (err) {
      setSubmitError(err?.response?.data?.message || 'Something went wrong. Try again.')
    }
  }

  if (sent) {
    return <p className="cx-notice">If that email exists, a reset link has been sent.</p>
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="cx-form" noValidate>
      <div>
        <label htmlFor="email" className="cx-field-label">Email</label>
        <input id="email" type="email" autoComplete="username" {...register('email')} className="cx-input" />
        {errors.email && <p className="cx-error">{errors.email.message}</p>}
      </div>

      {submitError && <p className="cx-error">{submitError}</p>}

      <button type="submit" disabled={isSubmitting} className="cx-btn cx-btn-primary cx-btn-block">
        {isSubmitting ? 'Sending…' : 'Send reset link'}
      </button>
    </form>
  )
}