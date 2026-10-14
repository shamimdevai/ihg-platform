import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useImpersonationStore } from '@/store/impersonationStore'
import { useToast } from '@/components/ui/ToastProvider'

// Backend currently only supports target_type="staff" (RBAC_MATRIX §7),
// and the only real trigger point is StaffList's per-row "Impersonate"
// action, which always already knows the target staff record — so this
// is a pure confirm-and-go modal, not a manual target-entry form. The
// earlier manual-entry version (kept as a stopgap until StaffList's
// real file was available) and the standalone ImpersonationPage it
// powered are both retired now that a real trigger exists.
export default function ImpersonateModal({ open, onClose, staff, onStarted }) {
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const start = useImpersonationStore((s) => s.start)
  const { toast } = useToast()

  const handleClose = () => {
    setError(null)
    onClose?.()
  }

  const handleConfirm = async () => {
    if (!staff) return
    setError(null)
    setLoading(true)
    try {
      await start({ targetType: 'staff', targetId: staff.id })
      toast({
        title: 'Impersonation started',
        description: 'You are now viewing the platform as that account.',
        variant: 'success',
      })
      onStarted?.()
      onClose?.()
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to start impersonation.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Impersonate a staff account"
      description="You will act as this account until you explicitly stop. This is logged and never silent."
    >
      <div className="space-y-4">
        {staff && (
          <p className="text-sm text-foreground">
            You're about to impersonate{' '}
            <span className="font-medium">
              {staff.first_name} {staff.last_name}
            </span>{' '}
            ({staff.email}). Every action taken while impersonating will be performed as this
            account.
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" loading={loading} onClick={handleConfirm}>
            Start impersonating
          </Button>
        </div>
      </div>
    </Modal>
  )
}