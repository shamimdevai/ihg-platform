import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { useToast } from '@/components/ui/ToastProvider'
import * as inventoryAlertsApi from '@/api/staff/inventoryAlertsApi'

// Kept as its own component (per DELIVERABLE) rather than inlined into
// AlertsList — resolution_note is the only field, and since there's no
// "unresolve" endpoint, this action simply stops rendering for a row
// once resolved_at is set (see AlertsList.jsx).
export default function ResolveAlertAction({ open, onClose, alert, itemLabel, onResolved }) {
  const { toast } = useToast()
  const { register, handleSubmit, reset } = useForm({ defaultValues: { resolution_note: '' } })

  const mutation = useMutation({
    mutationFn: ({ resolution_note }) => inventoryAlertsApi.resolveAlert(alert.id, { resolution_note }),
    onSuccess: () => {
      toast({ title: 'Alert resolved', variant: 'success' })
      reset()
      onResolved?.()
    },
    onError: (err) =>
      toast({
        title: 'Could not resolve alert',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  return (
    <Modal open={open} onClose={onClose} title={`Resolve Alert${itemLabel ? ` — ${itemLabel}` : ''}`}>
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4" noValidate>
        <div className="space-y-1">
          <Label htmlFor="resolution_note">Resolution Note</Label>
          <Textarea
            id="resolution_note"
            placeholder="Optional — e.g. restocked from supplier"
            {...register('resolution_note')}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Mark Resolved
          </Button>
        </div>
      </form>
    </Modal>
  )
}