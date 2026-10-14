import PageHeader from '@/components/layout/PageHeader'
import ProfileForm from '@/features/customer/profile/ProfileForm'

export default function ProfilePage() {
  return (
    <div>
      <PageHeader title="My Profile" description="View and update your account details." />
      <ProfileForm />
    </div>
  )
}