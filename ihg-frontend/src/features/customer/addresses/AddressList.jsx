import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import StatusBadge from '@/components/ui/StatusBadge'
import { useToast } from '@/components/ui/ToastProvider'
import * as addressesApi from '@/api/customer/addressesApi'
import AddressForm from './AddressForm'

const defaultMap = {
  true: { label: 'Default', className: 'bg-green-100 text-green-700' },
  false: { label: '', className: 'bg-transparent' },
}

// Deliberately the SAME query key ['customer', 'addresses'] Phase 27's
// AddressSelect.jsx already uses — this is what makes a create/edit/
// delete here show up immediately in the checkout address picker too
// (and vice versa), confirming both screens share one cache rather than
// diverging. Don't change this key without updating AddressSelect.jsx.
const ADDRESSES_QUERY_KEY = ['customer', 'addresses']

export default function AddressList() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ADDRESSES_QUERY_KEY,
    queryFn: addressesApi.listAddresses,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ADDRESSES_QUERY_KEY })

  const createMutation = useMutation({
    mutationFn: addressesApi.createAddress,
    onSuccess: () => {
      toast({ title: 'Address added', variant: 'success' })
      invalidate()
      setFormOpen(false)
    },
    onError: (err) =>
      toast({
        title: 'Could not add this address',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => addressesApi.updateAddress(id, values),
    onSuccess: () => {
      toast({ title: 'Address updated', variant: 'success' })
      invalidate()
      setFormOpen(false)
      setEditing(null)
    },
    onError: (err) =>
      toast({
        title: 'Could not update this address',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: addressesApi.deleteAddress,
    onSuccess: () => {
      toast({ title: 'Address deleted', variant: 'success' })
      invalidate()
      setDeleting(null)
    },
    onError: (err) =>
      toast({
        title: 'Could not delete this address',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (address) => {
    setEditing(address)
    setFormOpen(true)
  }
  const handleSubmit = (values) => {
    if (editing) updateMutation.mutate({ id: editing.id, values })
    else createMutation.mutate(values)
  }

  const columns = [
    { key: 'label', header: 'Label' },
    {
      key: 'address',
      header: 'Address',
      render: (row) =>
        [row.address_line1, row.address_line2].filter(Boolean).join(', '),
    },
    {
      key: 'location',
      header: 'City / Country',
      render: (row) => [row.city, row.state, row.country].filter(Boolean).join(', '),
    },
    {
      key: 'is_default',
      header: '',
      render: (row) =>
        row.is_default ? <StatusBadge status="true" colorMap={defaultMap} /> : null,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleting(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={openCreate}>Add Address</Button>
      </div>

      <Table
        columns={columns}
        data={data}
        loading={isLoading}
        error={isError ? error?.response?.data?.message || error?.message : null}
        onRetry={refetch}
        emptyTitle="No saved addresses yet"
      />

      <AddressForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        initialValues={editing}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleteMutation.mutate(deleting.id)}
        title="Delete this address?"
        description={deleting ? `"${deleting.label}" will be permanently removed.` : ''}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}