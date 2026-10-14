import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Sidebar from '@/components/layout/Sidebar'
import PendingFeatureBanner from '@/components/ui/PendingFeatureBanner'
import ImpersonationBanner from '@/features/staff/iam/impersonation/ImpersonationBanner'
import { Button } from '@/components/ui/Button'
import { useStaffAuth } from '@/hooks/useStaffAuth'
import { useAppConfig } from '@/hooks/useAppConfig'
import { usePermissionsRefresh } from '@/hooks/usePermissionsRefresh'
import { useImpersonationStore } from '@/store/impersonationStore'
import { navConfig } from '@/utils/navConfig'
import { hasPermission } from '@/utils/permissions'

// Combines navConfig (data) + hasPermission (staff role/permissions) +
// isModuleEnabled (live /config) into a filtered, GROUPED structure —
// [{ key, label, items: [{ key, to, label }] }] — consumed identically
// by both Navbar.jsx's desktop mega-menu and Sidebar.jsx's mobile
// accordion drawer, so the two can never drift out of sync with each
// other. A module being disabled hides its ENTIRE section, not just
// individual items (unchanged rule, per Global Context Prompt).
function buildNavGroups(user, isModuleEnabled) {
  const groups = []
  navConfig.forEach((group, gi) => {
    if (group.module && !isModuleEnabled(group.module)) return

    const visibleItems = group.items.filter((item) => {
      if (item.requiresSuperadmin) return Boolean(user?.is_superadmin)
      if (!item.permission) return true
      return hasPermission(user, item.permission)
    })
    if (visibleItems.length === 0) return

    groups.push({
      key: `group-${gi}`,
      label: group.section,
      items: visibleItems.map((item, ii) => ({ ...item, key: `${gi}-${ii}` })),
    })
  })
  return groups
}

export default function StaffLayout() {
  const { user, logout } = useStaffAuth()
  const { data, isModuleEnabled } = useAppConfig()
  const stopImpersonating = useImpersonationStore((s) => s.stop)
  const navigate = useNavigate()
  const location = useLocation()

  // Backlog item 4: mounted once, here, so both the automatic 5-minute
  // background refresh and the manual button below share the same
  // timer/state rather than each screen starting its own.
  const { refreshPermissions } = usePermissionsRefresh()
  const [refreshingPermissions, setRefreshingPermissions] = useState(false)

  const handleRefreshPermissions = async () => {
    setRefreshingPermissions(true)
    await refreshPermissions()
    setRefreshingPermissions(false)
  }

  // Mobile nav drawer state — has zero effect at the `md` breakpoint and
  // above, where Navbar.jsx's horizontal mega-menu is the only nav
  // surface and Sidebar.jsx doesn't render at all.
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  const navGroups = useMemo(
    () => buildNavGroups(user, isModuleEnabled),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, data]
  )

  const handleLogout = async () => {
    // Phase 9: an impersonation session must never survive past logout
    // (see impersonationStore.js's storage note) — cleared explicitly
    // here rather than relying solely on sessionStorage's lifetime,
    // since the same browser tab could otherwise still be
    // "impersonating" if a different staff member logs in next.
    stopImpersonating()
    await logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ImpersonationBanner />
      <Navbar
        logoUrl={data.logo_url}
        companyName={data.company_name}
        groups={navGroups}
        onMenuClick={() => setMobileNavOpen(true)}
        right={
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefreshPermissions}
              disabled={refreshingPermissions}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
              title="Refresh my permissions"
              aria-label="Refresh my permissions"
            >
              <RefreshCw className={`h-4 w-4 ${refreshingPermissions ? 'animate-spin' : ''}`} />
            </button>
            {/* Hidden below sm: with the hamburger + logo + this + the
                refresh/logout buttons all competing for a narrow header,
                the name is the one that's safe to drop. */}
            <span className="hidden sm:inline text-sm text-muted-foreground">
              {user?.first_name} {user?.last_name}
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Log out
            </Button>
          </div>
        }
      />
      <Sidebar
        groups={navGroups}
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
      <main className="flex-1 min-w-0 p-4 sm:p-6">
        {/* Flag #4 (Bucket B) — no GET /notifications (or equivalent)
            endpoint exists anywhere in the API. See PROGRESS.md
            Open Question #4. */}
        <PendingFeatureBanner className="mb-4">
          Instant in-app alerts aren't available yet — no notification
          endpoint exists on the backend. See Open Question #4 in
          PROGRESS.md.
        </PendingFeatureBanner>
        <Outlet />
      </main>
    </div>
  )
}