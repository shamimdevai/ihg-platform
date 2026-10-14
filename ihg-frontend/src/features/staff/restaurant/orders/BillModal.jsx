import { useMutation, useQueryClient } from '@tanstack/react-query'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import PendingFeatureBanner from '@/components/ui/PendingFeatureBanner'
import { useToast } from '@/components/ui/ToastProvider'
import * as restaurantApi from '@/api/staff/restaurantApi'

function formatMoney(amount, currency) {
  const value = Number(amount || 0).toFixed(2)
  return currency && currency !== 'currency_example' ? `${currency} ${value}` : value
}

/**
 * Flag #3 (Global Context Prompt §1 Bucket B): POST .../bill marks the
 * order's status only — it does NOT create a real Payment record the
 * way hotel invoices do (Phase 16's PayInvoiceForm.jsx, which calls
 * through to payment_service internally). There is no payment endpoint
 * to submit here, so this modal contains NO payment input fields of any
 * kind — only a read-only summary of the order's own totals and the
 * banner below. See PROGRESS.md Open Question (3).
 */
export default function BillModal({ open, onClose, order, restaurantId, tableLabel }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const billMutation = useMutation({
    mutationFn: () => restaurantApi.billOrder(order.id),
    onSuccess: () => {
      toast({ title: 'Order marked billed', variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['restaurant', 'orders', restaurantId] })
      onClose()
    },
    onError: (err) =>
      toast({
        title: 'Could not bill order',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  if (!order) return null

  return (
    <Modal open={open} onClose={onClose} title="Generate Bill">
      <div className="space-y-4">
        <PendingFeatureBanner>
          Marking this order billed does not process a payment — restaurant payment processing
          isn't yet implemented. See Open Question #3 in PROGRESS.md.
        </PendingFeatureBanner>

        <div className="rounded-md border p-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Table</span>
            <span>{tableLabel || order.table_id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatMoney(order.subtotal, order.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax</span>
            <span>{formatMoney(order.tax_amount, order.currency)}</span>
          </div>
          <div className="flex justify-between font-medium pt-1 border-t mt-1">
            <span>Total</span>
            <span>{formatMoney(order.total_amount, order.currency)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={billMutation.isPending}>
            Cancel
          </Button>
          <Button type="button" loading={billMutation.isPending} onClick={() => billMutation.mutate()}>
            Mark as Billed
          </Button>
        </div>
      </div>
    </Modal>
  )
}