import { useMemo } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Navbar from '@/components/layout/Navbar'
import Sidebar from '@/components/layout/Sidebar'
import PendingFeatureBanner from '@/components/ui/PendingFeatureBanner'
import { Button } from '@/components/ui/Button'
import { useStaffAuth } from '@/hooks/useStaffAuth'
import { useAppConfig } from '@/hooks/useAppConfig'
import { navConfig } from '@/utils/navConfig'
import { hasPermission } from '@/utils/permissions'

// Combines navConfig (data) + hasPermission (staff role/permissions) +
// isModuleEnabled (live /config) into the final, filtered items array
// Sidebar renders — a module being disabled hides its ENTIRE section,
// not just individual items (per Global Context Prompt).
function buildSidebarItems(user, isModuleEnabled) {
  const items = []
  navConfig.forEach((group, gi) => {
    if (group.module && !isModuleEnabled(group.module)) return

    const visible = group.items.filter((item) => {
      if (item.requiresSuperadmin) return Boolean(user?.is_superadmin)
      if (!item.permission) return true
      return hasPermission(user, item.permission)
    })
    if (visible.length === 0) return

    items.push({ heading: true, key: `heading-${gi}`, label: group.section })
    visible.forEach((item, ii) => items.push({ ...item, key: `${gi}-${ii}` }))
  })
  return items
}

export default function StaffLayout() {
  const { user, logout } = useStaffAuth()
  const { data, isModuleEnabled } = useAppConfig()
  const navigate = useNavigate()

  const sidebarItems = useMemo(
    () => buildSidebarItems(user, isModuleEnabled),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, data]
  )

  const handleLogout = async () => {
    await logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        logoUrl={data.logo_url}
        companyName={data.company_name}
        right={
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {user?.first_name} {user?.last_name}
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Log out
            </Button>
          </div>
        }
      />
      <div className="flex flex-1">
        <Sidebar items={sidebarItems} />
        <main className="flex-1 p-6">
          {/* Flag #4 (Bucket B) — no GET /notifications (or equivalent)
              endpoint exists anywhere in the API. This banner deliberately
              sits where a notification bell would eventually live — never
              replace with a fake-functional bell UI with nowhere to fetch
              from. See PROGRESS.md Open Question #4. */}
          <PendingFeatureBanner className="mb-4">
            Instant in-app alerts aren't available yet — no notification
            endpoint exists on the backend. See Open Question #4 in
            PROGRESS.md.
          </PendingFeatureBanner>
          <Outlet />
        </main>
      </div>
    </div>
  )
}