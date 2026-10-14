import CustomerAuthCard from '../../components/customer/CustomerAuthCard'
import ForgotPasswordForm from '../../features/customer/auth/ForgotPasswordForm'

export default function ForgotPasswordPage() {
  return (
    <CustomerAuthCard title="Reset your password">
      <ForgotPasswordForm />
    </CustomerAuthCard>
  )
}