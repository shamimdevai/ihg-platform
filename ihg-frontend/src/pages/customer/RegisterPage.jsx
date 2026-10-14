import CustomerAuthCard from '../../components/customer/CustomerAuthCard'
import RegisterForm from '../../features/customer/auth/RegisterForm'

export default function RegisterPage() {
  return (
    <CustomerAuthCard title="Create your account">
      <RegisterForm />
    </CustomerAuthCard>
  )
}