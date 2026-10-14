import { useLocation } from 'react-router-dom'
import CustomerAuthCard from '../../components/customer/CustomerAuthCard'
import LoginForm from '../../features/customer/auth/LoginForm'

export default function LoginPage() {
  const location = useLocation()
  const notices = []
  if (location.state?.sessionExpired) notices.push('Your session expired — please log in again.')
  if (location.state?.loggedOutElsewhere) notices.push('You were logged out in another tab or window.')

  return (
    <CustomerAuthCard title="Sign in" notices={notices}>
      <LoginForm />
    </CustomerAuthCard>
  )
}