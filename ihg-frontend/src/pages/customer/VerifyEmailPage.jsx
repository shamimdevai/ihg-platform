import CustomerAuthCard from '../../components/customer/CustomerAuthCard'
import VerifyEmailNotice from '../../features/customer/auth/VerifyEmailNotice'

export default function VerifyEmailPage() {
  return (
    <CustomerAuthCard title="Verify your email">
      <VerifyEmailNotice />
    </CustomerAuthCard>
  )
}