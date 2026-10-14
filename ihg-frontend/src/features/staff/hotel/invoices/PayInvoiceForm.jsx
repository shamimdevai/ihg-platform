import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { useToast } from '@/components/ui/ToastProvider'
import * as hotelApi from '@/api/staff/hotelApi'

// DESIGN NOTE — flagged as a real conflict, not silently resolved:
// this phase's brief asked for a form built against the payments tag's
// POST /payments/intents + POST /payments/{id}/confirm directly. But
// RBAC_MATRIX v7 §4.8/§6.6 documents POST /hotel/invoices/{id}/pay as
// "the only endpoint in hotel that reaches into payments" — it already
// calls create_payment_intent()/confirm_payment() internally, and it's
// the ONLY call in this slice that updates the Invoice's own
// status/payment_id fields. Calling /payments/intents + /confirm
// directly from here would create a real, valid Payment row with no
// endpoint anywhere to then link it back to this Invoice — the invoice
// would look unpaid forever even though a payment exists. Built against
// hotelApi.payInvoice() (→ POST /hotel/invoices/{id}/pay) instead, since
// it's the only path that actually pays the invoice. See
// paymentsApi.js's createPaymentIntent/confirmPayment for the unwired
// alternative if a different design is confirmed later.
//
// There's also no raw "card number" field anywhere in this backend's
// payments schema — PaymentMethod rows are pre-created, owner-less,
// generic records (RBAC_MATRIX §4.6), and Payment Methods CRUD UI is
// explicitly out of scope (Phase 12 notes). So the only real "method"
// input this schema supports is an optional method_id UUID — not a
// card form. Flagged rather than fabricating fields the backend doesn't
// have.
const paySchema = z.object({
  methodId: z.union([z.string().uuid('Must be a valid method ID (UUID)'), z.literal('')]),
})

export default function PayInvoiceForm({ open, onClose, invoice, onPaid }) {
  const { toast } = useToast()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(paySchema), defaultValues: { methodId: '' } })

  const mutation = useMutation({
    mutationFn: (methodId) => hotelApi.payInvoice(invoice.id, methodId || null),
    onSuccess: () => {
      toast({ title: 'Invoice paid', variant: 'success' })
      reset()
      onPaid?.()
    },
    onError: (err) =>
      toast({
        title: 'Could not pay invoice',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Pay Invoice"
      description={
        invoice
          ? `Pay ${invoice.total_amount} ${invoice.currency || ''} for invoice ${invoice.invoice_number}. This cannot be undone.`
          : ''
      }
    >
      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values.methodId))}
        className="space-y-4"
        noValidate
      >
        <div className="space-y-1">
          <Label htmlFor="pay-method-id">Payment Method ID (optional)</Label>
          <Input id="pay-method-id" placeholder="UUID — leave blank if none on file" {...register('methodId')} />
          {errors.methodId && <p className="text-sm text-destructive">{errors.methodId.message}</p>}
          <p className="text-xs text-muted-foreground">
            There is no payment-method lookup screen in this app yet — enter a known method ID directly, or leave
            blank.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Pay Invoice
          </Button>
        </div>
      </form>
    </Modal>
  )
}