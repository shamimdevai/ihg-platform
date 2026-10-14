import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useCustomerAuth } from '../../../hooks/useCustomerAuth'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export default function LoginForm() {
  const { login } = useCustomerAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [submitError, setSubmitError] = useState(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async ({ email, password }) => {
    setSubmitError(null)
    try {
      await login(email, password)
      // Keep the query string so e.g. /shop/book?roomTypeId=… survives login.
      const from = location.state?.from
      const redirectTo = from ? `${from.pathname}${from.search || ''}${from.hash || ''}` : '/shop'
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setSubmitError(err?.response?.data?.message || 'Invalid email or password.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="cx-form" noValidate>
      <div>
        <label htmlFor="email" className="cx-field-label">Email</label>
        <input id="email" type="email" autoComplete="username" {...register('email')} className="cx-input" />
        {errors.email && <p className="cx-error">{errors.email.message}</p>}
      </div>

      <div>
        <label htmlFor="password" className="cx-field-label">Password</label>
        <input id="password" type="password" autoComplete="current-password" {...register('password')} className="cx-input" />
        {errors.password && <p className="cx-error">{errors.password.message}</p>}
      </div>

      {submitError && <p className="cx-error">{submitError}</p>}

      <button type="submit" disabled={isSubmitting} className="cx-btn cx-btn-primary cx-btn-block">
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>

      <div className="cx-links-row">
        <Link to="/shop/forgot-password" className="cx-link">Forgot your password?</Link>
        <Link to="/shop/register" className="cx-link">Create an account</Link>
      </div>
    </form>
  )
}