import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Table from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { usePermission } from '@/hooks/usePermission';
import { listGuests } from '@/api/staff/hotelGuestsApi';
import GuestForm from './GuestForm';

export default function GuestList() {
  const canWrite = usePermission('customers:guests:write');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState(null);

  const {
    data: guests = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['hotelGuests'],
    queryFn: listGuests,
  });

  // No search endpoint exists — client-side filter only, same pattern as
  // every other list screen so far (no pagination/search on the backend yet).
  const filteredGuests = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return guests;
    return guests.filter((g) =>
      [g.first_name, g.last_name, g.email, g.phone]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(term))
    );
  }, [guests, search]);

  const columns = [
    { key: 'name', header: 'Name', render: (row) => `${row.first_name} ${row.last_name}` },
    { key: 'email', header: 'Email', render: (row) => row.email || '—' },
    { key: 'phone', header: 'Phone', render: (row) => row.phone || '—' },
    {
      key: 'identification_number',
      header: 'ID / Passport',
      render: (row) => row.identification_number || '—',
    },
    { key: 'nationality', header: 'Nationality', render: (row) => row.nationality || '—' },
    {
      key: 'is_vip',
      header: 'VIP',
      render: (row) =>
        row.is_vip ? (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            VIP
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'customer_id',
      header: 'Linked Account',
      render: (row) => (row.customer_id ? 'Yes' : 'No'),
    },
    ...(canWrite
      ? [
          {
            key: 'actions',
            header: '',
            render: (row) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingGuest(row);
                  setFormOpen(true);
                }}
              >
                Edit
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Search by name, email, or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        {canWrite && (
          <Button
            onClick={() => {
              setEditingGuest(null);
              setFormOpen(true);
            }}
          >
            Add Guest
          </Button>
        )}
      </div>

      <Table
        columns={columns}
        data={filteredGuests}
        loading={isLoading}
        error={isError ? 'Could not load guests.' : null}
        onRetry={refetch}
        emptyTitle={search ? 'No guests match your search' : 'No guests yet'}
      />

      {canWrite && (
        <GuestForm
          open={formOpen}
          guest={editingGuest}
          onClose={() => {
            setFormOpen(false);
            setEditingGuest(null);
          }}
        />
      )}
    </div>
  );
}