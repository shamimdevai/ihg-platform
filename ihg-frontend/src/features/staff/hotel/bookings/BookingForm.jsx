import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { usePermission } from '@/hooks/usePermission'

// CREATE ONLY — there is no general PUT for a booking anywhere in this
// phase's slice. Once created, a booking can only be moved forward
// through the three narrow actions BookingsList.jsx exposes (cancel,
// check-in, check-out) — check_in_date/check_out_date/room/guest can
// never be edited afterward through any endpoint given this phase.
const schema = z
  .object({
    room_id: z.string().min(1, 'Room is required'),
    guest_id: z.string().min(1, 'Guest is required'),
    check_in_date: z.string().min(1, 'Check-in date is required'),
    check_out_date: z.string().min(1, 'Check-out date is required'),
    num_guests: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((v) => v.check_out_date >= v.check_in_date, {
    message: 'Check-out date cannot be before check-in date',
    path: ['check_out_date'],
  })

// `rooms` passed in is already filtered to status=available by the
// caller (BookingsPage.jsx) — same client-side-only limitation flagged
// in Open Question (5)/Phase 13's AvailabilitySearch: this is "rooms
// currently marked available", not a true check-in/check-out date-range
// overlap check, since no such endpoint exists yet. The backend is
// still the final authority — a room double-booked between two
// overlapping stays would be rejected server-side, not caught here.
export default function BookingForm({ open, onClose, onSubmit, loading, rooms = [], guests = [] }) {
  // Guest selection degrades to a plain UUID text input if the caller
  // doesn't hold customers:guests:read — mirrors Phase 11's ItemForm/
  // StockList precedent for cross-domain, permission-gated lookups. In
  // practice every role holding hotel:booking:write today (Admin,
  // Reception) also holds customers:guests:read, so this is a
  // defensive fallback, not something exercised by any current seeded
  // role.
  const canReadGuests = usePermission('customers:guests:read')

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      room_id: '',
      guest_id: '',
      check_in_date: '',
      check_out_date: '',
      num_guests: '',
      notes: '',
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        room_id: '',
        guest_id: '',
        check_in_date: '',
        check_out_date: '',
        num_guests: '',
        notes: '',
      })
    }
  }, [open, reset])

  const submit = (values) => {
    onSubmit({
      room_id: values.room_id,
      guest_id: values.guest_id,
      check_in_date: values.check_in_date,
      check_out_date: values.check_out_date,
      num_guests: values.num_guests ? Number(values.num_guests) : null,
      notes: values.notes || null,
    })
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="New Booking">
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <div className="space-y-1">
          <Label htmlFor="room_id">Room</Label>
          <Controller
            name="room_id"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="room_id">
                  <SelectValue placeholder="Select an available room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      Room {r.room_number}
                      {r.floor ? ` — Floor ${r.floor}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.room_id && <p className="text-sm text-destructive">{errors.room_id.message}</p>}
          {rooms.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No rooms are currently marked available for this hotel.
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="guest_id">Guest</Label>
          {canReadGuests ? (
            <>
              <Controller
                name="guest_id"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="guest_id">
                      <SelectValue placeholder="Select a guest" />
                    </SelectTrigger>
                    <SelectContent>
                      {guests.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.first_name} {g.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {guests.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No guests exist yet — add one under Hotel Guests first.
                </p>
              )}
            </>
          ) : (
            <Input id="guest_id" placeholder="Guest ID (UUID)" {...register('guest_id')} />
          )}
          {errors.guest_id && <p className="text-sm text-destructive">{errors.guest_id.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="check_in_date">Check-in Date</Label>
            <Input id="check_in_date" type="date" {...register('check_in_date')} />
            {errors.check_in_date && (
              <p className="text-sm text-destructive">{errors.check_in_date.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="check_out_date">Check-out Date</Label>
            <Input id="check_out_date" type="date" {...register('check_out_date')} />
            {errors.check_out_date && (
              <p className="text-sm text-destructive">{errors.check_out_date.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="num_guests">Number of Guests</Label>
          <Input id="num_guests" type="number" min="1" placeholder="Optional" {...register('num_guests')} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" placeholder="Optional" {...register('notes')} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} disabled={rooms.length === 0}>
            Create Booking
          </Button>
        </div>
      </form>
    </Modal>
  )
}