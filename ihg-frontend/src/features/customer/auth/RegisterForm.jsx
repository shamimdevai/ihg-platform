import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
      setSubmitError(
        err?.response?.data?.message || 'Could not create your account.'
      )
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
            First name
          </label>
          <input
            id="firstName"
            {...register('firstName')}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy"
          />
          {errors.firstName && (
            <p className="mt-1 text-sm text-red">{errors.firstName.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
            Last name
          </label>
          <input
            id="lastName"
            {...register('lastName')}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy"
          />
          {errors.lastName && (
            <p className="mt-1 text-sm text-red">{errors.lastName.message}</p>
          )}
        </div>
      </div>

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
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
          Phone <span className="text-gray-400">(optional)</span>
        </label>
        <input
          id="phone"
          type="tel"
          {...register('phone')}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
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
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </button>

      <div className="text-center text-sm text-gray-600">
        Already have an account?{' '}
        <a href="/shop/login" className="text-navy hover:underline">
          Sign in
        </a>
      </div>
    </form>
  )
}