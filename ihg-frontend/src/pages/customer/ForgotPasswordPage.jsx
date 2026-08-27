import ForgotPasswordForm from '../../features/customer/auth/ForgotPasswordForm'

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-lg shadow p-6">
        <h1 className="text-xl font-bold text-navy mb-6 text-center">
          Reset your password
        </h1>
        <ForgotPasswordForm />
      </div>
    </div>
  )
}