import PageHeader from '@/components/layout/PageHeader'
import RevenueReportTable from '@/features/staff/reporting/RevenueReportTable'

// Route itself stays gated by reporting:read (Phase 5 infrastructure,
// unchanged) — Admin + Manager both hold it per RBAC_MATRIX v7 §5.1,
// same gating as Phase 23's Dashboard widgets. No additional
// component-level permission branch needed here: unlike Phase 23's
// DashboardHome.jsx (which renders for every role via a permission:null
// route and had to branch internally), this route is ALREADY
// permission-gated at the router level by StaffProtectedRoute — anyone
// who reaches this page already holds reporting:read.
export default function ReportsPage() {
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Revenue by domain, with a real Excel export."
      />
      <RevenueReportTable />
    </div>
  )
}