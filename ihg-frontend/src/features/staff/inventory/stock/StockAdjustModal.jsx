import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { useToast } from '@/components/ui/ToastProvider'
import * as inventoryStockApi from '@/api/staff/inventoryStockApi'

const schema = z.object({
  direction: z.enum(['add', 'remove']),
  amount: z.coerce.number().positive('Enter an amount greater than 0'),
  reason: z.string().optional(),
})

// POST /inventory/stock/{item_id}/adjust takes a signed quantity_delta —
// this form collects a direction + a positive amount instead and
// combines them, since asking staff to type a signed number themselves
// is an easy place to make a costly mistake. transaction_type,
// reference_type, and reference_id are left unset (server defaults
// transaction_type to "manual_adjustment") — this UI only covers the
// manual-adjustment path; no reference_type/reference_id use case
// exists anywhere in this phase's scope.
export default function StockAdjustModal({ open, onClose, stockRow, itemLabel, onAdjusted }) {
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { direction: 'add', amount: '', reason: '' },
  })

  useEffect(() => {
    if (open) reset({ direction: 'add', amount: '', reason: '' })
  }, [open, reset])

  const mutation = useMutation({
    mutationFn: ({ quantity_delta, reason }) =>
      inventoryStockApi.adjustStock(stockRow.inventory_item_id, { quantity_delta, reason }),
    onSuccess: (data) => {
      toast({ title: 'Stock adjusted', description: `New balance: ${data.balance_after}`, variant: 'success' })
      onAdjusted?.()
    },
    onError: (err) =>
      toast({
        title: 'Could not adjust stock',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const submit = (values) => {
    const quantity_delta = values.direction === 'remove' ? -Math.abs(values.amount) : Math.abs(values.amount)
    mutation.mutate({ quantity_delta, reason: values.reason || undefined })
  }

  return (
    <Modal open={open} onClose={onClose} title={`Adjust Stock${itemLabel ? ` — ${itemLabel}` : ''}`}>
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <div className="space-y-1">
          <Label>Direction</Label>
          <Controller
            name="direction"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add stock</SelectItem>
                  <SelectItem value="remove">Remove stock</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="amount">Amount</Label>
          <Input id="amount" type="number" step="any" min="0" {...register('amount')} />
          {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="reason">Reason</Label>
          <Textarea id="reason" placeholder="Optional — e.g. damaged stock, stocktake correction" {...register('reason')} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Confirm Adjustment
          </Button>
        </div>
      </form>
    </Modal>
  )
}