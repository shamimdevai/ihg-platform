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
      setSubmitError(
        err?.response?.data?.message || 'Something went wrong. Try again.'
      )
    }
  }

  if (sent) {
    return (
      <p className="text-sm text-gray-700">
        If that email exists, a reset link has been sent.
      </p>
    )
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

      {submitError && <p className="text-sm text-red">{submitError}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-navy text-white py-2 font-medium hover:opacity-90 disabled:opacity-50"
      >
        {isSubmitting ? 'Sending…' : 'Send reset link'}
      </button>
    </form>
  )
}