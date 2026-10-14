import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import PageHeader from '@/components/layout/PageHeader'
import { usePermission } from '@/hooks/usePermission'
import BrandingForm from '@/features/staff/settings/BrandingForm'
import ModuleTogglesForm from '@/features/staff/settings/ModuleTogglesForm'

// RBAC DECISION (Phase 25, recorded in docs/PROGRESS.md): the brief
// flagged a conflict — Manager holds settings:read (RBAC_MATRIX v7
// §5.1) but this phase's brief said "Admin only." Resolved as: Manager
// gets a genuine READ-ONLY view of this screen, not route exclusion.
// The route itself stays gated by settings:read only (staffRoutes.jsx,
// unchanged since Phase 5) — this page decides what Manager actually
// sees once inside, via the settings:write check below.
export default function SettingsPage() {
  const canWrite = usePermission('settings:write')

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage branding and which business-line modules are enabled."
      />

      <Tabs defaultValue="branding">
        <TabsList>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="modules">Module Toggles</TabsTrigger>
        </TabsList>
        <TabsContent value="branding">
          <BrandingForm readOnly={!canWrite} />
        </TabsContent>
        <TabsContent value="modules">
          <ModuleTogglesForm readOnly={!canWrite} />
        </TabsContent>
      </Tabs>
    </div>
  )
}