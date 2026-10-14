import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { useToast } from '@/components/ui/ToastProvider'
import { usePermission } from '@/hooks/usePermission'
import { useAppConfig } from '@/hooks/useAppConfig'
import * as hotelApi from '@/api/staff/hotelApi'
import ImageUploadField from '@/components/ui/ImageUploadField'

function formatRate(rate, currency) {
  const amount = Number(rate).toFixed(2)
  return currency ? `${currency} ${amount}` : amount
}

// Backlog item 7, RESOLVED — PUT and DELETE now exist for room-types.
// RoomType has no is_active column (unlike Hotel/Room), so unlike those
// two, delete here is a REAL hard delete (soft-deleted server-side) —
// blocked with a 409 if any active room still uses it.
export default function RoomTypesList({ hotelId }) {
  const canWrite = usePermission('hotel:room:write')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: config } = useAppConfig()
  const [formOpen, setFormOpen] = useState(false)
  const [editingRoomType, setEditingRoomType] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['hotel', 'room-types', hotelId],
    queryFn: () => hotelApi.listRoomTypes(hotelId),
    enabled: Boolean(hotelId),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['hotel', 'room-types', hotelId] })

  const createMutation = useMutation({
    mutationFn: (values) => hotelApi.createRoomType(hotelId, values),
    onSuccess: () => {
      toast({ title: 'Room type created', variant: 'success' })
      invalidate()
      setFormOpen(false)
    },
    onError: (err) =>
      toast({
        title: 'Could not create room type',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => hotelApi.updateRoomType(hotelId, id, values),
    onSuccess: () => {
      toast({ title: 'Room type updated', variant: 'success' })
      invalidate()
      setFormOpen(false)
      setEditingRoomType(null)
    },
    onError: (err) =>
      toast({
        title: 'Could not update room type',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => hotelApi.deleteRoomType(hotelId, id),
    onSuccess: () => {
      toast({ title: `"${deleteTarget?.name}" was deleted.`, variant: 'success' })
      invalidate()
      setDeleteTarget(null)
    },
    onError: (err) => {
      // The backend's 409 message is specific ("still used by N
      // room(s)...") — shown verbatim rather than a generic failure.
      toast({
        title: 'Could not delete room type',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      })
      setDeleteTarget(null)
    },
  })

  const openCreate = () => {
    setEditingRoomType(null)
    setFormOpen(true)
  }

  const openEdit = (roomType) => {
    setEditingRoomType(roomType)
    setFormOpen(true)
  }

  const handleFormSubmit = (values) => {
    if (editingRoomType) {
      updateMutation.mutate({ id: editingRoomType.id, values })
    } else {
      createMutation.mutate(values)
    }
  }

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'description', header: 'Description', render: (row) => row.description || '—' },
    {
      key: 'base_rate',
      header: 'Base Rate',
      render: (row) => formatRate(row.base_rate, config?.currency),
    },
    { key: 'capacity', header: 'Capacity' },
    { key: 'amenities', header: 'Amenities', render: (row) => row.amenities || '—' },
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
          <Button onClick={openCreate}>Add Room Type</Button>
        </div>
      )}
      <Table
        columns={columns}
        data={data}
        loading={isLoading}
        error={isError ? error?.response?.data?.message || error?.message : null}
        onRetry={refetch}
        emptyTitle="No room types yet"
      />
      {canWrite && (
        <RoomTypeForm
          open={formOpen}
          onClose={() => {
            setFormOpen(false)
            setEditingRoomType(null)
          }}
          onSubmit={handleFormSubmit}
          loading={createMutation.isPending || updateMutation.isPending}
          initialValues={editingRoomType}
          hotelId={hotelId}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        title="Delete room type?"
        description={
          deleteTarget
            ? `This will delete "${deleteTarget.name}". If any rooms currently use this room type, the deletion will be blocked until they're reassigned.`
            : undefined
        }
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

const roomTypeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  base_rate: z
    .string()
    .min(1, 'Base rate is required')
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, { message: 'Must be greater than 0' }),
  capacity: z
    .string()
    .optional()
    .refine((val) => val === undefined || val === '' || (!isNaN(Number(val)) && Number(val) >= 1), {
      message: 'Must be 1 or more',
    }),
  amenities: z.string().optional(),
})

function RoomTypeForm({ open, onClose, onSubmit, loading, initialValues, hotelId }) {
  const isEditing = Boolean(initialValues)
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(roomTypeSchema),
    defaultValues: { name: '', description: '', base_rate: '', capacity: '1', amenities: '' },
  })

  const submit = (values) => {
    onSubmit({
      name: values.name,
      description: values.description || null,
      base_rate: Number(values.base_rate),
      capacity: values.capacity ? Number(values.capacity) : 1,
      amenities: values.amenities || null,
    })
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEditing ? `Edit Room Type — ${initialValues.name}` : 'Add Room Type'}
    >
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate key={initialValues?.id || 'new'}>
        <div className="space-y-1">
          <Label htmlFor="rt-name">Name</Label>
          <Input
            id="rt-name"
            placeholder="e.g. Deluxe Double"
            defaultValue={initialValues?.name || ''}
            {...register('name')}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="rt-description">Description</Label>
          <Textarea id="rt-description" defaultValue={initialValues?.description || ''} {...register('description')} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="rt-base_rate">Base Rate (per night)</Label>
            <Input
              id="rt-base_rate"
              type="number"
              step="0.01"
              defaultValue={initialValues?.base_rate ?? ''}
              {...register('base_rate')}
            />
            {errors.base_rate && <p className="text-sm text-destructive">{errors.base_rate.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="rt-capacity">Capacity</Label>
            <Input
              id="rt-capacity"
              type="number"
              step="1"
              defaultValue={initialValues?.capacity ?? '1'}
              {...register('capacity')}
            />
            {errors.capacity && <p className="text-sm text-destructive">{errors.capacity.message}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="rt-amenities">Amenities</Label>
          <Input
            id="rt-amenities"
            placeholder="e.g. Wi-Fi, AC, sea view"
            defaultValue={initialValues?.amenities || ''}
            {...register('amenities')}
          />
        </div>

        {isEditing && (
          <ImageUploadField
            key={initialValues.id}
            label="Room photo"
            currentUrl={initialValues.image_url}
            onUpload={(file) => hotelApi.uploadRoomTypeImage(hotelId, initialValues.id, file)}
            onUploaded={() => queryClient.invalidateQueries({ queryKey: ['hotel', 'room-types', hotelId] })}
          />
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {isEditing ? 'Save Changes' : 'Create Room Type'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}