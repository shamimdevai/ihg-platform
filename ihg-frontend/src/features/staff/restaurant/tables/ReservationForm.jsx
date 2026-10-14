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
import PendingFeatureBanner from '@/components/ui/PendingFeatureBanner'

// CREATE ONLY — reservations move forward only through the three narrow
// actions ReservationsList.jsx exposes (seat/complete/cancel); nothing
// else about a reservation can be edited after creation.
//
// customer_id is deliberately NOT a form field — no staff-side
// customer-lookup screen exists yet anywhere in this app (same "real
// but no UI to source it from" treatment as Phase 10's
// linkGuestToCustomer()). The server accepts it as null.
//
// `tables` passed in is NOT filtered to status=available — unlike
// hotel's BookingForm, a table's real-time status reflects who's
// sitting there right now, not whether it's free at some future
// reservation_time, so filtering by live status would be actively
// misleading here. There is no date/time-overlap availability check of
// any kind in this phase's slice — flagged, not built as something
// fancier than the given endpoints support.
const schema = z.object({
  table_id: z.string().min(1, 'Table is required'),
  customer_name: z.string().min(1, 'Customer name is required'),
  customer_phone: z.string().optional(),
  reservation_time: z.string().min(1, 'Reservation date & time is required'),
  party_size: z.string().optional(),
  notes: z.string().optional(),
})

export default function ReservationForm({ open, onClose, onSubmit, loading, tables = [] }) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      table_id: '',
      customer_name: '',
      customer_phone: '',
      reservation_time: '',
      party_size: '2',
      notes: '',
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        table_id: '',
        customer_name: '',
        customer_phone: '',
        reservation_time: '',
        party_size: '2',
        notes: '',
      })
    }
  }, [open, reset])

  const submit = (values) => {
    onSubmit({
      table_id: values.table_id,
      customer_name: values.customer_name,
      customer_phone: values.customer_phone || null,
      // datetime-local gives "2026-08-25T19:00" with no timezone/seconds
      // — convert to a real ISO string before sending, per the real
      // date-time request schema.
      reservation_time: new Date(values.reservation_time).toISOString(),
      party_size: values.party_size ? Number(values.party_size) : 2,
      notes: values.notes || null,
    })
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="New Reservation">
      {/* Flag #2 (Global Context Prompt §1 Bucket B) — reservation
          endpoints are staff-authenticated only; there is no
          customer-token path to self-reserve a table anywhere in this
          slice, even though the proposal's Restaurant process opens
          with "customer reserves table". See PROGRESS.md Open
          Question #2. */}
      <PendingFeatureBanner className="mb-4">
        Customers currently cannot reserve a table directly — reservations are staff-created only. See
        Open Question #2 in PROGRESS.md.
      </PendingFeatureBanner>

      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <div className="space-y-1">
          <Label htmlFor="table_id">Table</Label>
          <Controller
            name="table_id"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="table_id">
                  <SelectValue placeholder="Select a table" />
                </SelectTrigger>
                <SelectContent>
                  {tables.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      Table {t.table_number} (seats {t.capacity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.table_id && <p className="text-sm text-destructive">{errors.table_id.message}</p>}
          {tables.length === 0 && (
            <p className="text-xs text-muted-foreground">No tables exist yet — add one under Tables first.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="customer_name">Customer Name</Label>
            <Input id="customer_name" {...register('customer_name')} />
            {errors.customer_name && (
              <p className="text-sm text-destructive">{errors.customer_name.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="customer_phone">Customer Phone</Label>
            <Input id="customer_phone" placeholder="Optional" {...register('customer_phone')} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="reservation_time">Reservation Date & Time</Label>
            <Input id="reservation_time" type="datetime-local" {...register('reservation_time')} />
            {errors.reservation_time && (
              <p className="text-sm text-destructive">{errors.reservation_time.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="party_size">Party Size</Label>
            <Input id="party_size" type="number" min="1" {...register('party_size')} />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" placeholder="Optional" {...register('notes')} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} disabled={tables.length === 0}>
            Create Reservation
          </Button>
        </div>
      </form>
    </Modal>
  )
}