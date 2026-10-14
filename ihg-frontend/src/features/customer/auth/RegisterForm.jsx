import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import * as authApi from '../../../api/customer/authApi'

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Enter a valid email address'),
  phone: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export default function RegisterForm() {
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async ({ firstName, lastName, email, phone, password }) => {
    setSubmitError(null)
    try {
      await authApi.register({
        email,
        password,
        firstName,
        lastName,
        phone: phone || null,
      })
      // Register does NOT log the user in — it returns a profile
      // snapshot, not tokens. Real flow is register -> verify email ->
      // login, so redirect to the verify-email notice, not straight in.
      navigate('/shop/verify-email', { state: { email }, replace: true })
    } catch (err) {
      setSubmitError(err?.response?.data?.message || 'Could not create your account.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="cx-form" noValidate>
      <div className="cx-form-row">
        <div>
          <label htmlFor="firstName" className="cx-field-label">First name</label>
          <input id="firstName" {...register('firstName')} className="cx-input" />
          {errors.firstName && <p className="cx-error">{errors.firstName.message}</p>}
        </div>
        <div>
          <label htmlFor="lastName" className="cx-field-label">Last name</label>
          <input id="lastName" {...register('lastName')} className="cx-input" />
          {errors.lastName && <p className="cx-error">{errors.lastName.message}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="email" className="cx-field-label">Email</label>
        <input id="email" type="email" autoComplete="username" {...register('email')} className="cx-input" />
        {errors.email && <p className="cx-error">{errors.email.message}</p>}
      </div>

      <div>
        <label htmlFor="phone" className="cx-field-label">
          Phone <span className="cx-muted">(optional)</span>
        </label>
        <input id="phone" type="tel" {...register('phone')} className="cx-input" />
      </div>

      <div>
        <label htmlFor="password" className="cx-field-label">Password</label>
        <input id="password" type="password" autoComplete="new-password" {...register('password')} className="cx-input" />
        {errors.password && <p className="cx-error">{errors.password.message}</p>}
      </div>

      {submitError && <p className="cx-error">{submitError}</p>}

      <button type="submit" disabled={isSubmitting} className="cx-btn cx-btn-primary cx-btn-block">
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </button>

      <div className="cx-center cx-muted" style={{ fontSize: '0.875rem' }}>
        Already have an account? <Link to="/shop/login" className="cx-link">Sign in</Link>
      </div>
    </form>
  )
}