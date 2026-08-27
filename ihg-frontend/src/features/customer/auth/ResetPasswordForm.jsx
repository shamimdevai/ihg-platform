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
        err?.response?.data?.message ||
          'Could not reset password. The link may have expired.'
      )
    }
  }

  if (!token) {
    return (
      <p className="text-sm text-red">
        This reset link is missing a token. Please request a new one.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
          New password
        </label>
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          {...register('newPassword')}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy"
        />
        {errors.newPassword && (
          <p className="mt-1 text-sm text-red">{errors.newPassword.message}</p>
        )}
      </div>

      {submitError && <p className="text-sm text-red">{submitError}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-navy text-white py-2 font-medium hover:opacity-90 disabled:opacity-50"
      >
        {isSubmitting ? 'Resetting…' : 'Reset password'}
      </button>
    </form>
  )
}