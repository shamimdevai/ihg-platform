import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Checkbox } from '@/components/ui/Checkbox'
import StatusBadge from '@/components/ui/StatusBadge'
import { useToast } from '@/components/ui/ToastProvider'
import { usePermission } from '@/hooks/usePermission'
import * as restaurantApi from '@/api/staff/restaurantApi'

const activeMap = {
  true: { label: 'Active', className: 'bg-green-100 text-green-700' },
  false: { label: 'Inactive', className: 'bg-gray-200 text-gray-600' },
}

// Backlog item 8, RESOLVED: PUT and DELETE both now exist — Edit and
// Delete added below. Delete is a real hard delete (blocked with a 409
// if any active menu item still belongs to this category), per explicit
// decision — mirrors RoomType's precedent rather than Hotel/Room's
// deactivate-only treatment, even though is_active also exists here.
export default function MenuCategoriesList({ restaurantId }) {
  const canWrite = usePermission('restaurant:menu:write')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['restaurant', 'menu-categories', restaurantId],
    queryFn: () => restaurantApi.listMenuCategories(restaurantId),
    enabled: Boolean(restaurantId),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['restaurant', 'menu-categories', restaurantId] })

  const createMutation = useMutation({
    mutationFn: restaurantApi.createMenuCategory,
    onSuccess: () => {
      toast({ title: 'Category created', variant: 'success' })
      invalidate()
      setFormOpen(false)
    },
    onError: (err) =>
      toast({
        title: 'Could not create category',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => restaurantApi.updateMenuCategory(id, values),
    onSuccess: () => {
      toast({ title: 'Category updated', variant: 'success' })
      invalidate()
      setFormOpen(false)
      setEditing(null)
    },
    onError: (err) =>
      toast({
        title: 'Could not update category',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: restaurantApi.deleteMenuCategory,
    onSuccess: () => {
      toast({ title: `"${deleteTarget?.name}" was deleted.`, variant: 'success' })
      invalidate()
      setDeleteTarget(null)
    },
    onError: (err) => {
      // The backend's 409 message is specific ("still has N menu
      // item(s) in it...") — shown verbatim, not a generic failure.
      toast({
        title: 'Could not delete category',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      })
      setDeleteTarget(null)
    },
  })

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (category) => {
    setEditing(category)
    setFormOpen(true)
  }

  const handleSubmit = (values) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, values })
    } else {
      createMutation.mutate({ ...values, restaurant_id: restaurantId })
    }
  }

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'display_order', header: 'Display Order' },
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
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                  Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(row)}>
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
          <Button onClick={openCreate}>Add Category</Button>
        </div>
      )}
      <Table
        columns={columns}
        data={data}
        loading={isLoading}
        error={isError ? error?.response?.data?.message || error?.message : null}
        onRetry={refetch}
        emptyTitle="No menu categories yet"
      />
      {canWrite && (
        <CategoryForm
          open={formOpen}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
          }}
          onSubmit={handleSubmit}
          loading={createMutation.isPending || updateMutation.isPending}
          initialValues={editing}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        title="Delete category?"
        description={
          deleteTarget
            ? `This will delete "${deleteTarget.name}". If any menu items are still in this category, the deletion will be blocked until they're moved.`
            : undefined
        }
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  display_order: z
    .string()
    .optional()
    .refine((val) => val === undefined || val === '' || (!isNaN(Number(val)) && Number.isInteger(Number(val))), {
      message: 'Must be a whole number',
    }),
  is_active: z.boolean(),
})

function CategoryForm({ open, onClose, onSubmit, loading, initialValues }) {
  const isEditing = Boolean(initialValues)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', display_order: '0', is_active: true },
  })

  useEffect(() => {
    if (open) {
      reset(
        initialValues
          ? {
              name: initialValues.name,
              display_order: String(initialValues.display_order ?? 0),
              is_active: initialValues.is_active,
            }
          : { name: '', display_order: '0', is_active: true }
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialValues])

  const submit = (values) => {
    onSubmit({
      name: values.name,
      display_order: values.display_order ? Number(values.display_order) : 0,
      is_active: values.is_active,
    })
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title={isEditing ? `Edit Category — ${initialValues.name}` : 'Add Category'}>
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <div className="space-y-1">
          <Label htmlFor="category-name">Name</Label>
          <Input id="category-name" {...register('name')} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="category-display_order">Display Order</Label>
          <Input id="category-display_order" type="number" step="1" {...register('display_order')} />
          {errors.display_order && (
            <p className="text-sm text-destructive">{errors.display_order.message}</p>
          )}
          <p className="text-xs text-muted-foreground">Lower numbers appear first on the menu.</p>
        </div>
        <div className="flex items-center gap-2">
          <Controller
            name="is_active"
            control={control}
            render={({ field }) => (
              <Checkbox id="category-is_active" checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
          <Label htmlFor="category-is_active">Active</Label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {isEditing ? 'Save Changes' : 'Create Category'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}