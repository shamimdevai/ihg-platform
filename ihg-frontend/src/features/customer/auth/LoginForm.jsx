import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
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
      const redirectTo = location.state?.from?.pathname || '/shop'
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setSubmitError(
        err?.response?.data?.message || 'Invalid email or password.'
      )
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          {...register('email')}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy"
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy"
        />
        {errors.password && (
          <p className="mt-1 text-sm text-red">{errors.password.message}</p>
        )}
      </div>

      {submitError && <p className="text-sm text-red">{submitError}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-navy text-white py-2 font-medium hover:opacity-90 disabled:opacity-50"
      >
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>

      <div className="flex justify-between text-sm">
        <a href="/shop/forgot-password" className="text-navy hover:underline">
          Forgot your password?
        </a>
        <a href="/shop/register" className="text-navy hover:underline">
          Create an account
        </a>
      </div>
    </form>
  )
}