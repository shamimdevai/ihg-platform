import LoginForm from '../../features/customer/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-lg shadow p-6">
        <h1 className="text-xl font-bold text-navy mb-6 text-center">
          Sign in
        </h1>
        <LoginForm />
      </div>
    </div>
  )
}