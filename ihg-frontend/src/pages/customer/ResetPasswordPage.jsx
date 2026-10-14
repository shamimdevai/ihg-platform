import CustomerAuthCard from '../../components/customer/CustomerAuthCard'
import ResetPasswordForm from '../../features/customer/auth/ResetPasswordForm'

export default function ResetPasswordPage() {
  return (
    <CustomerAuthCard title="Set a new password">
      <ResetPasswordForm />
    </CustomerAuthCard>
  )
}