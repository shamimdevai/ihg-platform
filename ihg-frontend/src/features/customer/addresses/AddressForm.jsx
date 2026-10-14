import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Checkbox } from '@/components/ui/Checkbox'

// Same field set as Phase 27's AddressSelect quick-add form (deliberate
// parity — this is the full version of that same form). latitude/
// longitude are real, optional fields on the backend but have no input
// here, same as the quick-add form — no map picker exists anywhere in
// this app, so there's nothing to source coordinates from either place.
const schema = z.object({
  label: z.string().min(1, 'Give this address a label (e.g. Home, Office)'),
  addressLine1: z.string().min(1, 'Street address is required'),
  addressLine2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().min(1, 'Country is required'),
  isDefault: z.boolean(),
})

export default function AddressForm({ open, onClose, onSubmit, initialValues, loading }) {
  const isEdit = Boolean(initialValues)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      label: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
      isDefault: false,
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        label: initialValues?.label || '',
        addressLine1: initialValues?.address_line1 || '',
        addressLine2: initialValues?.address_line2 || '',
        city: initialValues?.city || '',
        state: initialValues?.state || '',
        postalCode: initialValues?.postal_code || '',
        country: initialValues?.country || '',
        isDefault: initialValues?.is_default ?? false,
      })
    }
  }, [open, initialValues, reset])

  const submit = (values) => {
    onSubmit(values)
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Address' : 'Add Address'}>
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="af-label">Label</Label>
            <Input id="af-label" placeholder="Home, Office…" {...register('label')} />
            {errors.label && <p className="text-sm text-destructive">{errors.label.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="af-country">Country</Label>
            <Input id="af-country" {...register('country')} />
            {errors.country && <p className="text-sm text-destructive">{errors.country.message}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="af-line1">Street address</Label>
          <Input id="af-line1" {...register('addressLine1')} />
          {errors.addressLine1 && (
            <p className="text-sm text-destructive">{errors.addressLine1.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="af-line2">Apartment, suite, etc. (optional)</Label>
          <Input id="af-line2" {...register('addressLine2')} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label htmlFor="af-city">City</Label>
            <Input id="af-city" {...register('city')} />
            {errors.city && <p className="text-sm text-destructive">{errors.city.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="af-state">State (optional)</Label>
            <Input id="af-state" {...register('state')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="af-postal">Postal code (optional)</Label>
            <Input id="af-postal" {...register('postalCode')} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Controller
            name="isDefault"
            control={control}
            render={({ field }) => (
              <Checkbox id="af-default" checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
          <Label htmlFor="af-default">Set as my default address</Label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {isEdit ? 'Save Changes' : 'Add Address'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}