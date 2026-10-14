import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import LoadingState from '@/components/ui/LoadingState'
import ErrorState from '@/components/ui/ErrorState'
import { useToast } from '@/components/ui/ToastProvider'
import * as addressesApi from '@/api/customer/addressesApi'

const addressSchema = z.object({
  label: z.string().min(1, 'Give this address a label (e.g. Home, Office)'),
  addressLine1: z.string().min(1, 'Street address is required'),
  addressLine2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().min(1, 'Country is required'),
  isDefault: z.boolean().default(false),
})

/**
 * AddressSelect — saved-address picker with an inline "quick add" form,
 * per Phase 27's brief: checkout shouldn't be blocked on Phase 29's full
 * address management screen. Controlled component: the parent
 * (PlaceOrderForm) owns the selected address id via value/onChange —
 * this component only owns its own fetch and the quick-add form's
 * open/closed state.
 */
export default function AddressSelect({ value, onChange }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showAddForm, setShowAddForm] = useState(false)

  const {
    data: addresses,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['customer', 'addresses'],
    queryFn: addressesApi.listAddresses,
  })

  // Auto-select the default address (or the first one) the first time
  // the list loads, if the parent doesn't already have a selection.
  useEffect(() => {
    if (!value && addresses && addresses.length > 0) {
      const defaultAddress = addresses.find((a) => a.is_default) || addresses[0]
      onChange(defaultAddress.id)
    }
  }, [addresses, value, onChange])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(addressSchema),
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

  const mutation = useMutation({
    mutationFn: (values) => addressesApi.createAddress(values),
    onSuccess: (newAddress) => {
      queryClient.invalidateQueries({ queryKey: ['customer', 'addresses'] })
      toast({ title: 'Address saved' })
      onChange(newAddress.id)
      reset()
      setShowAddForm(false)
    },
    onError: (err) => {
      toast({
        title: 'Could not save this address',
        description: err?.response?.data?.message || 'Please try again.',
        variant: 'destructive',
      })
    },
  })

  if (isLoading) {
    return <LoadingState label="Loading your addresses…" />
  }

  if (isError) {
    return (
      <ErrorState
        message={error?.response?.data?.message || error?.message || 'Could not load your addresses.'}
        onRetry={refetch}
      />
    )
  }

  return (
    <div className="space-y-3">
      <Label htmlFor="delivery-address">Delivery address</Label>

      {addresses && addresses.length > 0 ? (
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger id="delivery-address">
            <SelectValue placeholder="Choose a saved address" />
          </SelectTrigger>
          <SelectContent>
            {addresses.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.label} — {a.address_line1}, {a.city}
                {a.is_default ? ' (default)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="text-sm text-muted-foreground">
          You don't have any saved addresses yet — add one below.
        </p>
      )}

      {showAddForm ? (
        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="space-y-3 rounded-md border p-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="addr-label">Label</Label>
              <Input id="addr-label" placeholder="Home, Office…" {...register('label')} />
              {errors.label && <p className="text-sm text-destructive mt-1">{errors.label.message}</p>}
            </div>
            <div>
              <Label htmlFor="addr-country">Country</Label>
              <Input id="addr-country" {...register('country')} />
              {errors.country && <p className="text-sm text-destructive mt-1">{errors.country.message}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="addr-line1">Street address</Label>
            <Input id="addr-line1" {...register('addressLine1')} />
            {errors.addressLine1 && (
              <p className="text-sm text-destructive mt-1">{errors.addressLine1.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="addr-line2">Apartment, suite, etc. (optional)</Label>
            <Input id="addr-line2" {...register('addressLine2')} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="addr-city">City</Label>
              <Input id="addr-city" {...register('city')} />
              {errors.city && <p className="text-sm text-destructive mt-1">{errors.city.message}</p>}
            </div>
            <div>
              <Label htmlFor="addr-state">State (optional)</Label>
              <Input id="addr-state" {...register('state')} />
            </div>
            <div>
              <Label htmlFor="addr-postal">Postal code (optional)</Label>
              <Input id="addr-postal" {...register('postalCode')} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 rounded" {...register('isDefault')} />
            Set as my default address
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                reset()
                setShowAddForm(false)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting || mutation.isPending}>
              Save Address
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
          + Add a new address
        </Button>
      )}
    </div>
  )
}