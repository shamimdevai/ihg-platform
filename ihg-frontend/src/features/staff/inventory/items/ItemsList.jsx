import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import StatusBadge from '@/components/ui/StatusBadge'
import { useToast } from '@/components/ui/ToastProvider'
import { usePermission } from '@/hooks/usePermission'
import * as inventoryItemsApi from '@/api/staff/inventoryItemsApi'
import ItemForm from './ItemForm'

const activeMap = {
  true: { label: 'Active', className: 'bg-green-100 text-green-700' },
  false: { label: 'Inactive', className: 'bg-gray-200 text-gray-600' },
}

// Unlike iam:roles/iam:departments, inventory:item:write's own
// description ("Create/update/delete inventory items", RBAC_MATRIX
// §4.4) covers delete too — there's no separate delete-permission gap
// here the way there was for roles/departments (backlog items 17/18).
export default function ItemsList() {
  const canWrite = usePermission('inventory:item:write')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['inventory', 'items'],
    queryFn: inventoryItemsApi.listItems,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['inventory', 'items'] })

  const createMutation = useMutation({
    mutationFn: inventoryItemsApi.createItem,
    onSuccess: () => {
      toast({ title: 'Item created', variant: 'success' })
      invalidate()
      setFormOpen(false)
    },
    onError: (err) =>
      toast({
        title: 'Could not create item',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => inventoryItemsApi.updateItem(id, values),
    onSuccess: () => {
      toast({ title: 'Item updated', variant: 'success' })
      invalidate()
      setFormOpen(false)
      setEditing(null)
    },
    onError: (err) =>
      toast({
        title: 'Could not update item',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: inventoryItemsApi.deleteItem,
    onSuccess: () => {
      toast({ title: 'Item deleted', variant: 'success' })
      invalidate()
      setDeleting(null)
    },
    onError: (err) =>
      toast({
        title: 'Could not delete item',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (item) => {
    setEditing(item)
    setFormOpen(true)
  }
  const handleSubmit = (values) => {
    if (editing) updateMutation.mutate({ id: editing.id, values })
    else createMutation.mutate(values)
  }

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'sku', header: 'SKU', render: (row) => row.sku || '—' },
    { key: 'unit', header: 'Unit' },
    { key: 'category', header: 'Category', render: (row) => row.category || '—' },
    {
      key: 'reorder_threshold',
      header: 'Reorder Threshold',
      render: (row) => (row.reorder_threshold != null ? row.reorder_threshold : '—'),
    },
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
          <Button onClick={openCreate}>Add Item</Button>
        </div>
      )}
      <Table
        columns={columns}
        data={data}
        loading={isLoading}
        error={isError ? error?.response?.data?.message || error?.message : null}
        onRetry={refetch}
        emptyTitle="No inventory items yet"
      />
      {canWrite && (
        <ItemForm
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
          title="Delete this item?"
          description={deleting ? `"${deleting.name}" will be permanently removed.` : ''}
          confirmLabel="Delete"
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  )
}