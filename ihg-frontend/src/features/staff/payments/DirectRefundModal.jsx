import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { useToast } from '@/components/ui/ToastProvider'
import * as paymentsApi from '@/api/staff/paymentsApi'

// Ahead-of-deliverable addition (same precedent as Phase 11's
// StockTransactionsModal) — not named as its own file in this phase's
// DELIVERABLE list, but POST /payments/{id}/refund (payments:refund:direct)
// is a real, in-scope endpoint and PaymentsList needs somewhere to collect
// the optional `reason` before calling it. This is Path A of RBAC_MATRIX
// §4.7's dual-refund architecture — immediate, no approval step —
// distinct from RefundActionModal.jsx's approve/reject flow (Path B).
export default function DirectRefundModal({ open, onClose, payment, onRefunded }) {
  const { toast } = useToast()
  const { register, handleSubmit, reset } = useForm({ defaultValues: { reason: '' } })

  const mutation = useMutation({
    mutationFn: ({ reason }) => paymentsApi.refundPayment(payment.id, { reason }),
    onSuccess: () => {
      toast({ title: 'Payment refunded', variant: 'success' })
      reset()
      onRefunded?.()
    },
    onError: (err) =>
      toast({
        title: 'Could not refund payment',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Refund Payment"
      description={
        payment
          ? `Immediately refund ${payment.amount} ${payment.currency || ''} for ${
              payment.reference_type || 'this reference'
            }. This cannot be undone.`
          : ''
      }
    >
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4" noValidate>
        <div className="space-y-1">
          <Label htmlFor="refund-reason">Reason</Label>
          <Textarea id="refund-reason" placeholder="Optional — e.g. duplicate charge" {...register('reason')} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="destructive" loading={mutation.isPending}>
            Refund
          </Button>
        </div>
      </form>
    </Modal>
  )
}