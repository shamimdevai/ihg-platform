import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Checkbox } from '@/components/ui/Checkbox'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'

// Backlog item 7, RESOLVED: now also supports EDIT mode via
// `initialValues` — a general PUT /hotel/rooms/{room_id} endpoint now
// exists (room_number/floor/room_type_id/is_active), separate from the
// status-only transition still handled by RoomsList.jsx's own
// RoomStatusModal. hotel_id is intentionally never part of this form's
// edit payload — a room never moves to a different hotel, and the real
// backend RoomUpdate schema has no hotel_id field.
const schema = z.object({
  room_type_id: z.string().min(1, 'Room type is required'),
  room_number: z.string().min(1, 'Room number is required'),
  floor: z.string().optional(),
  is_active: z.boolean(),
})

export default function RoomForm({ open, onClose, onSubmit, loading, hotelId, roomTypes = [], initialValues }) {
  const isEditing = Boolean(initialValues)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { room_type_id: '', room_number: '', floor: '', is_active: true },
  })

  useEffect(() => {
    if (open) {
      reset(
        initialValues
          ? {
              room_type_id: initialValues.room_type_id,
              room_number: initialValues.room_number,
              floor: initialValues.floor || '',
              is_active: initialValues.is_active,
            }
          : { room_type_id: '', room_number: '', floor: '', is_active: true }
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialValues])

  const submit = (values) => {
    if (isEditing) {
      onSubmit({
        room_type_id: values.room_type_id,
        room_number: values.room_number,
        floor: values.floor || null,
        is_active: values.is_active,
      })
    } else {
      onSubmit({
        hotel_id: hotelId,
        room_type_id: values.room_type_id,
        room_number: values.room_number,
        floor: values.floor || null,
        is_active: values.is_active,
      })
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEditing ? `Edit Room ${initialValues.room_number}` : 'Add Room'}
    >
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <div className="space-y-1">
          <Label htmlFor="room_type_id">Room Type</Label>
          <Controller
            name="room_type_id"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="room_type_id">
                  <SelectValue placeholder="Select a room type" />
                </SelectTrigger>
                <SelectContent>
                  {roomTypes.map((rt) => (
                    <SelectItem key={rt.id} value={rt.id}>
                      {rt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.room_type_id && <p className="text-sm text-destructive">{errors.room_type_id.message}</p>}
          {roomTypes.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No room types exist yet for this hotel — add one on the Room Types tab first.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="room_number">Room Number</Label>
            <Input id="room_number" placeholder="e.g. 204" {...register('room_number')} />
            {errors.room_number && <p className="text-sm text-destructive">{errors.room_number.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="floor">Floor</Label>
            <Input id="floor" placeholder="Optional" {...register('floor')} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Controller
            name="is_active"
            control={control}
            render={({ field }) => (
              <Checkbox id="is_active" checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
          <Label htmlFor="is_active">Active</Label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} disabled={!isEditing && roomTypes.length === 0}>
            {isEditing ? 'Save Changes' : 'Create Room'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}