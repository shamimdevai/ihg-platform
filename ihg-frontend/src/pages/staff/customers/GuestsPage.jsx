import PageHeader from '@/components/layout/PageHeader';
import GuestList from '@/features/staff/customers/GuestList';

export default function GuestsPage() {
  return (
    <div>
      <PageHeader
        title="Hotel Guests"
        description="Walk-in guest records — created and managed by staff. Guests do not have their own login."
      />
      <GuestList />
    </div>
  );
}