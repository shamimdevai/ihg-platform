import { AlertOctagon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useImpersonationStore } from '@/store/impersonationStore'
import { useStaffAuth } from '@/hooks/useStaffAuth'

// Persistent, never-dismissible — unlike PendingFeatureBanner, this
// reflects a live, security-sensitive state, not an informational
// notice. Renders null itself when not impersonating, so StaffLayout
// can mount it unconditionally on every screen.
export default function ImpersonationBanner() {
  const active = useImpersonationStore((s) => s.active)
  const targetType = useImpersonationStore((s) => s.targetType)
  const targetId = useImpersonationStore((s) => s.targetId)
  const stop = useImpersonationStore((s) => s.stop)
  const { realUser } = useStaffAuth()

  if (!active) return null

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 bg-destructive text-destructive-foreground px-4 py-2 text-sm font-medium"
    >
      <div className="flex items-center gap-2">
        <AlertOctagon className="h-4 w-4 shrink-0" />
        <span>
          You are impersonating a "{targetType}" account (ID: {targetId})
          {realUser?.email ? <> — really logged in as {realUser.email}</> : null}.
          Actions taken now are performed as that account.
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="bg-white text-destructive hover:bg-white/90"
        onClick={stop}
      >
        Stop impersonating
      </Button>
    </div>
  )
}