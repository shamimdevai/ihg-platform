import RegisterForm from '../../features/customer/auth/RegisterForm'

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-lg shadow p-6">
        <h1 className="text-xl font-bold text-navy mb-6 text-center">
          Create your account
        </h1>
        <RegisterForm />
      </div>
    </div>
  )
}