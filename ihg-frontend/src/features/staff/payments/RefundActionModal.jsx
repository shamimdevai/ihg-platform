import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { useToast } from '@/components/ui/ToastProvider'
import * as paymentsRefundAdminApi from '@/api/staff/paymentsRefundAdminApi'

// Ahead-of-deliverable addition (same precedent as Phase 11's
// StockTransactionsModal / this phase's own DirectRefundModal) — not
// named as its own file in the DELIVERABLE list, but approve and reject
// each need a small form (optional review_reason for approve, a
// REQUIRED reason for reject, per the real request-body schemas), so
// both share one modal parameterized by `action` rather than
// duplicating the same Modal/Textarea/mutation scaffolding twice. This
// is Path B of RBAC_MATRIX §4.7's dual-refund architecture (request +
// review) — distinct from DirectRefundModal.jsx's immediate Path A.
export default function RefundActionModal({ open, onClose, request, action, onDone }) {
  const { toast } = useToast()
  const isReject = action === 'reject'
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ defaultValues: { text: '' } })

  useEffect(() => {
    if (open) reset({ text: '' })
  }, [open, action, reset])

  const mutation = useMutation({
    mutationFn: ({ text }) =>
      isReject
        ? paymentsRefundAdminApi.rejectRefundRequest(request.id, { reason: text })
        : paymentsRefundAdminApi.approveRefundRequest(request.id, { review_reason: text || undefined }),
    onSuccess: () => {
      toast({ title: isReject ? 'Refund request rejected' : 'Refund request approved', variant: 'success' })
      onDone?.()
    },
    onError: (err) =>
      toast({
        title: `Could not ${isReject ? 'reject' : 'approve'} refund request`,
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isReject ? 'Reject Refund Request' : 'Approve Refund Request'}
      description={request ? `Payment ${request.payment_id}` : ''}
    >
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4" noValidate>
        <div className="space-y-1">
          <Label htmlFor="review-text">{isReject ? 'Reason (required)' : 'Review Note (optional)'}</Label>
          <Textarea
            id="review-text"
            placeholder={isReject ? 'Why this request is being rejected' : 'Optional note for the record'}
            {...register('text', isReject ? { required: 'A reason is required to reject a request' } : {})}
          />
          {errors.text && <p className="text-sm text-destructive">{errors.text.message}</p>}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant={isReject ? 'destructive' : 'default'} loading={mutation.isPending}>
            {isReject ? 'Reject' : 'Approve'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}