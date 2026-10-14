import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import StatusBadge from '@/components/ui/StatusBadge'
import { useToast } from '@/components/ui/ToastProvider'
import { usePermission } from '@/hooks/usePermission'
import * as inventorySuppliersApi from '@/api/staff/inventorySuppliersApi'
import SupplierForm from './SupplierForm'

const activeMap = {
  true: { label: 'Active', className: 'bg-green-100 text-green-700' },
  false: { label: 'Inactive', className: 'bg-gray-200 text-gray-600' },
}

export default function SuppliersList() {
  const canWrite = usePermission('inventory:supplier:write')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['inventory', 'suppliers'],
    queryFn: inventorySuppliersApi.listSuppliers,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['inventory', 'suppliers'] })

  const createMutation = useMutation({
    mutationFn: inventorySuppliersApi.createSupplier,
    onSuccess: () => {
      toast({ title: 'Supplier created', variant: 'success' })
      invalidate()
      setFormOpen(false)
    },
    onError: (err) =>
      toast({
        title: 'Could not create supplier',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => inventorySuppliersApi.updateSupplier(id, values),
    onSuccess: () => {
      toast({ title: 'Supplier updated', variant: 'success' })
      invalidate()
      setFormOpen(false)
      setEditing(null)
    },
    onError: (err) =>
      toast({
        title: 'Could not update supplier',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: inventorySuppliersApi.deleteSupplier,
    onSuccess: () => {
      toast({ title: 'Supplier deleted', variant: 'success' })
      invalidate()
      setDeleting(null)
    },
    onError: (err) =>
      toast({
        title: 'Could not delete supplier',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (supplier) => {
    setEditing(supplier)
    setFormOpen(true)
  }
  const handleSubmit = (values) => {
    if (editing) updateMutation.mutate({ id: editing.id, values })
    else createMutation.mutate(values)
  }

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'contact_name', header: 'Contact', render: (row) => row.contact_name || '—' },
    { key: 'email', header: 'Email', render: (row) => row.email || '—' },
    { key: 'phone', header: 'Phone', render: (row) => row.phone || '—' },
    {
      key: 'is_active',
      header: 'Status',
      render: (row) => <StatusBadge status={String(row.is_active)} colorMap={activeMap} />,
    },
    ...(canWrite
      ? [
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
      : []),
  ]

  return (
    <div>
      {canWrite && (
        <div className="flex justify-end mb-4">
          <Button onClick={openCreate}>Add Supplier</Button>
        </div>
      )}
      <Table
        columns={columns}
        data={data}
        loading={isLoading}
        error={isError ? error?.response?.data?.message || error?.message : null}
        onRetry={refetch}
        emptyTitle="No suppliers yet"
      />
      {canWrite && (
        <SupplierForm
          open={formOpen}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
          }}
          onSubmit={handleSubmit}
          initialValues={editing}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      )}
      {canWrite && (
        <ConfirmDialog
          open={Boolean(deleting)}
          onClose={() => setDeleting(null)}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          title="Delete this supplier?"
          description={deleting ? `"${deleting.name}" will be permanently removed.` : ''}
          confirmLabel="Delete"
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  )
}