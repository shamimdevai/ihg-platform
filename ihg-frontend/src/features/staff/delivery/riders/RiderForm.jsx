import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { usePermission } from '@/hooks/usePermission'
import * as iamStaffApi from '@/api/staff/iamStaffApi'

const createSchema = z.object({
  staff_id: z.string().min(1, 'A staff member is required'),
  vehicle_type: z.string().optional(),
  license_plate: z.string().optional(),
  phone: z.string().optional(),
})

const editSchema = z.object({
  vehicle_type: z.string().optional(),
  license_plate: z.string().optional(),
  phone: z.string().optional(),
})

// staff_id is required at creation (POST body) but has no general-edit
// path (PUT's schema doesn't include it) — same "edit mode hides the
// immutable field" pattern as StaffForm.jsx hiding email in edit mode
// (Phase 7). Staff dropdown is NOT filtered to any particular
// department (e.g. "Delivery") — nothing in the given schema enforces
// that constraint, and filtering speculatively would be a business-rule
// assumption this project's convention doesn't support without
// confirmation. Degrades to a plain UUID text input if the caller
// doesn't hold iam:staff:read — same defensive pattern as
// TablesList.jsx's AssignWaiterModal (Phase 17).
export default function RiderForm({ open, onClose, onSubmit, loading, rider }) {
  const isEdit = Boolean(rider)
  const canReadStaff = usePermission('iam:staff:read')

  const { data: staffList } = useQuery({
    queryKey: ['iam', 'staff'],
    queryFn: iamStaffApi.listStaff,
    enabled: open && !isEdit && canReadStaff,
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: {
      staff_id: '',
      vehicle_type: '',
      license_plate: '',
      phone: '',
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        staff_id: '',
        vehicle_type: rider?.vehicle_type || '',
        license_plate: rider?.license_plate || '',
        phone: rider?.phone || '',
      })
    }
  }, [open, rider, reset])

  const submit = (values) => {
    if (isEdit) {
      onSubmit({
        vehicle_type: values.vehicle_type || null,
        license_plate: values.license_plate || null,
        phone: values.phone || null,
      })
    } else {
      onSubmit({
        staff_id: values.staff_id,
        vehicle_type: values.vehicle_type || null,
        license_plate: values.license_plate || null,
        phone: values.phone || null,
      })
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? 'Edit Rider' : 'Add Rider'}>
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        {!isEdit && (
          <div className="space-y-1">
            <Label htmlFor="rider-staff">Staff Member</Label>
            {canReadStaff ? (
              <Select value={watch('staff_id')} onValueChange={(v) => setValue('staff_id', v)}>
                <SelectTrigger id="rider-staff">
                  <SelectValue placeholder="Select a staff member" />
                </SelectTrigger>
                <SelectContent>
                  {(staffList || []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.first_name} {s.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="rider-staff"
                placeholder="Staff ID (UUID)"
                value={watch('staff_id')}
                onChange={(e) => setValue('staff_id', e.target.value)}
              />
            )}
            {errors.staff_id && <p className="text-sm text-destructive">{errors.staff_id.message}</p>}
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="rider-vehicle-type">Vehicle Type (optional)</Label>
          <Input id="rider-vehicle-type" placeholder="e.g. Motorbike" {...register('vehicle_type')} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="rider-license-plate">License Plate (optional)</Label>
            <Input id="rider-license-plate" {...register('license_plate')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rider-phone">Phone (optional)</Label>
            <Input id="rider-phone" {...register('phone')} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {isEdit ? 'Save Changes' : 'Create Rider'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}