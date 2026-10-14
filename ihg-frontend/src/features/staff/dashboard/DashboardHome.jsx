import { usePermission } from '@/hooks/usePermission'
import { useStaffAuth } from '@/hooks/useStaffAuth'
import DashboardWidgets from '@/features/staff/reporting/DashboardWidgets'

// Phase 23: wired to GET /reporting/dashboard via DashboardWidgets.
//
// IMPORTANT, flagged rather than silently handled: this component is
// reachable by EVERY staff role — the /admin/dashboard route itself is
// gated `permission: null` (Phase 5), not reporting:read. Only Admin
// and Manager actually hold reporting:read (RBAC_MATRIX v7 §5.1), so a
// Housekeeping/Waiter/Kitchen/Rider/Reception login would 403 on their
// own landing page if DashboardWidgets fetched unconditionally. Gating
// here client-side, same permission-driven pattern as every other
// screen in this project — NOT a change to Phase 5's route-level
// permission:null gate, which stays out of this phase's scope.
export default function DashboardHome() {
  const canViewReporting = usePermission('reporting:read')
  const { user } = useStaffAuth()

  if (!canViewReporting) {
    return (
      <p className="text-sm text-muted-foreground">
        Welcome{user?.role?.name ? `, ${user.role.name}` : ''}. Dashboard
        reporting widgets are available to Admin and Manager accounts —
        use the sidebar for the screens available to your role.
      </p>
    )
  }

  return <DashboardWidgets />
}