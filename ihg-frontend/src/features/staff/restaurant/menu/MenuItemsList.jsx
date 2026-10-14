import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import StatusBadge from '@/components/ui/StatusBadge'
import { useToast } from '@/components/ui/ToastProvider'
import { useAppConfig } from '@/hooks/useAppConfig'
import { usePermission } from '@/hooks/usePermission'
import * as restaurantApi from '@/api/staff/restaurantApi'
import MenuItemForm from './MenuItemForm'

const availabilityMap = {
  true: { label: 'Available', className: 'bg-green-100 text-green-700' },
  false: { label: 'Unavailable', className: 'bg-gray-200 text-gray-600' },
}

function formatPrice(price, currency) {
  const amount = Number(price).toFixed(2)
  return currency ? `${currency} ${amount}` : amount
}

function discountLabel(item) {
  if (!item.discount_type) return null
  return item.discount_type === 'percentage'
    ? `${Number(item.discount_value)}% off`
    : `${Number(item.discount_value).toFixed(2)} off`
}

export function useMenuItems({ restaurantId, categoryId, isAvailable } = {}) {
  return useQuery({
    queryKey: ['restaurant', 'menu-items', restaurantId, categoryId, isAvailable],
    queryFn: () => restaurantApi.listMenuItems({ restaurantId, categoryId, isAvailable }),
    enabled: Boolean(restaurantId),
  })
}

export function MenuItemsBrowser({ items, categories, loading, error, onRetry, onSelect }) {
  const { data: config } = useAppConfig()
  const currency = config?.currency

  const columns = [
    { key: 'name', header: 'Name' },
    {
      key: 'category_id',
      header: 'Category',
      render: (row) => categories?.find((c) => c.id === row.category_id)?.name || '—',
    },
    {
      key: 'price',
      header: 'Price',
      render: (row) =>
        row.discount_active ? (
          <span>
            <span className="line-through text-muted-foreground mr-1">
              {formatPrice(row.price, currency)}
            </span>
            <span className="font-semibold text-foreground">{formatPrice(row.effective_price, currency)}</span>
          </span>
        ) : (
          formatPrice(row.price, currency)
        ),
    },
    {
      key: 'is_available',
      header: 'Status',
      render: (row) => <StatusBadge status={String(row.is_available)} colorMap={availabilityMap} />,
    },
    ...(onSelect
      ? [
          {
            key: 'select',
            header: '',
            render: (row) => (
              <Button size="sm" onClick={() => onSelect(row)} disabled={!row.is_available}>
                Add
              </Button>
            ),
          },
        ]
      : []),
  ]

  return (
    <Table
      columns={columns}
      data={items}
      loading={loading}
      error={error}
      onRetry={onRetry}
      emptyTitle="No menu items yet"
    />
  )
}

export default function MenuItemsList({ restaurantId, categories }) {
  const canWrite = usePermission('restaurant:menu:write')
  const { toast } = useToast()
  const { data: config } = useAppConfig()
  const currency = config?.currency
  const queryClient = useQueryClient()
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const { data, isLoading, isError, error, refetch } = useMenuItems({
    restaurantId,
    categoryId: categoryFilter === 'all' ? undefined : categoryFilter,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['restaurant', 'menu-items', restaurantId] })

  const createMutation = useMutation({ mutationFn: restaurantApi.createMenuItem })
  const updateMutation = useMutation({ mutationFn: ({ id, values }) => restaurantApi.updateMenuItem(id, values) })
  const uploadImageMutation = useMutation({ mutationFn: ({ id, file }) => restaurantApi.uploadMenuItemImage(id, file) })
  const clearDiscountMutation = useMutation({
    mutationFn: restaurantApi.clearMenuItemDiscount,
    onSuccess: () => {
      toast({ title: 'Discount removed', variant: 'success' })
      invalidate()
    },
    onError: (err) =>
      toast({
        title: 'Could not remove discount',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })
  const deleteMutation = useMutation({
    mutationFn: restaurantApi.deleteMenuItem,
    onSuccess: () => {
      toast({ title: `"${deleteTarget?.name}" was deleted.`, variant: 'success' })
      invalidate()
      setDeleteTarget(null)
    },
    onError: (err) => {
      toast({
        title: 'Could not delete item',
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
  const openEdit = (item) => {
    setEditing(item)
    setFormOpen(true)
  }

  // Backlog follow-up: image can now be selected at CREATE time too, not
  // just edit. The backend has no combined create+image endpoint (create
  // is JSON, image upload is multipart), so this orchestrates two real
  // sequential calls under one "Create Item" click: create the item,
  // then — only if a file was actually selected — upload it. A failed
  // image upload does NOT roll back or fail the item creation; the item
  // already exists and is usable, so this surfaces as its own distinct
  // warning rather than losing the person's work.
  const handleSubmit = async (values, file) => {
    if (editing) {
      try {
        await updateMutation.mutateAsync({ id: editing.id, values })
        toast({ title: 'Item updated', variant: 'success' })
        invalidate()
        setFormOpen(false)
        setEditing(null)
      } catch (err) {
        toast({
          title: 'Could not update item',
          description: err?.response?.data?.message || err.message,
          variant: 'destructive',
        })
      }
      return
    }

    try {
      const newItem = await createMutation.mutateAsync({ ...values, restaurant_id: restaurantId })
      if (file) {
        try {
          await uploadImageMutation.mutateAsync({ id: newItem.id, file })
        } catch (err) {
          toast({
            title: 'Item created, but the image upload failed',
            description: (err?.response?.data?.message || err.message) + ' — you can retry from Edit.',
            variant: 'destructive',
          })
        }
      }
      toast({ title: 'Item created', variant: 'success' })
      invalidate()
      setFormOpen(false)
    } catch (err) {
      toast({
        title: 'Could not create item',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      })
    }
  }

  const handleUploadImage = (file) => {
    if (!editing) return
    uploadImageMutation.mutate(
      { id: editing.id, file },
      {
        onSuccess: () => {
          toast({ title: 'Image uploaded', variant: 'success' })
          invalidate()
        },
        onError: (err) =>
          toast({
            title: 'Could not upload image',
            description: err?.response?.data?.message || err.message,
            variant: 'destructive',
          }),
      }
    )
  }

  const handleClearDiscount = () => {
    if (editing) clearDiscountMutation.mutate(editing.id)
  }

  const columns = [
    { key: 'name', header: 'Name' },
    {
      key: 'category_id',
      header: 'Category',
      render: (row) => categories?.find((c) => c.id === row.category_id)?.name || '—',
    },
    {
      key: 'price',
      header: 'Price',
      render: (row) =>
        row.discount_active ? (
          <div>
            <div className="text-xs text-muted-foreground line-through">{formatPrice(row.price, currency)}</div>
            <div className="font-semibold">{formatPrice(row.effective_price, currency)}</div>
          </div>
        ) : (
          formatPrice(row.price, currency)
        ),
    },
    {
      key: 'discount',
      header: 'Discount',
      render: (row) =>
        row.discount_type ? (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              row.discount_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
            }`}
            title={row.discount_active ? 'Currently active' : 'Configured but not currently active (check schedule)'}
          >
            {discountLabel(row)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'is_available',
      header: 'Status',
      render: (row) => <StatusBadge status={String(row.is_available)} colorMap={availabilityMap} />,
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
      <div className="flex justify-between items-end mb-4 gap-4">
        <div className="w-64">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {(categories || []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canWrite && <Button onClick={openCreate}>Add Item</Button>}
      </div>

      <Table
        columns={columns}
        data={data}
        loading={isLoading}
        error={isError ? error?.response?.data?.message || error?.message : null}
        onRetry={refetch}
        emptyTitle="No menu items yet"
      />

      {canWrite && (
        <MenuItemForm
          open={formOpen}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
          }}
          onSubmit={handleSubmit}
          onUploadImage={handleUploadImage}
          onClearDiscount={handleClearDiscount}
          initialValues={editing}
          categories={categories}
          loading={createMutation.isPending || updateMutation.isPending}
          uploadingImage={uploadImageMutation.isPending}
          clearingDiscount={clearDiscountMutation.isPending}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        title="Delete menu item?"
        description={
          deleteTarget ? `This will delete "${deleteTarget.name}". This can't be undone from this screen.` : undefined
        }
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}