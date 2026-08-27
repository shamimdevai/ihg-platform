import { useMutation } from '@tanstack/react-query'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/ToastProvider'
import * as iamStaffApi from '@/api/staff/iamStaffApi'

/**
 * Confirms and triggers POST /iam/staff/{id}/invite — RESENDING an
 * invite email to an existing staff account (e.g. the original invite
 * expired or was lost). A brand-new account's first invite is sent
 * automatically on creation (see StaffForm) — there is no separate
 * "send first invite" endpoint, only this resend one.
 */
export default function InviteStaffModal({ open, onClose, staff }) {
  const { toast } = useToast()

  const mutation = useMutation({
    mutationFn: () => iamStaffApi.resendInvite(staff.id),
    onSuccess: () => {
      toast({
        title: 'Invite email resent.',
        description: staff ? `Sent to ${staff.email}.` : undefined,
        variant: 'success',
      })
      onClose()
    },
    onError: (err) => {
      toast({
        title: 'Could not resend invite email.',
        description: err?.response?.data?.message || err?.message,
        variant: 'destructive',
      })
    },
  })

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={() => mutation.mutate()}
      title="Resend invite email?"
      description={staff ? `A new invite email will be sent to ${staff.email}.` : undefined}
      confirmLabel="Resend Invite"
      variant="default"
      loading={mutation.isPending}
    />
  )
}