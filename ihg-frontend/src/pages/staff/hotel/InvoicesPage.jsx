import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import PageHeader from '@/components/layout/PageHeader'
import { usePermission } from '@/hooks/usePermission'
import InvoiceList from '@/features/staff/hotel/invoices/InvoiceList'
import ServiceRequestsList from '@/features/staff/hotel/invoices/ServiceRequestsList'

// Route itself is gated by hotel:invoice:read only (staffRoutes.jsx,
// set at Phase 5) — the Service Requests tab below is gated
// independently on hotel:service_request:read, a separate permission
// code (RBAC_MATRIX §4.8). Today both are Admin-only via "*" so this is
// unobservable, but it's the correct, permission-driven way to do it —
// a future custom role holding one code without the other would see
// only the tab their grant actually covers, not both by association.
//
// NOTE, flagged not fixed (out of this phase's scope — route guarding
// is Phase 5 infrastructure): if a future custom role were ever granted
// hotel:service_request:read WITHOUT hotel:invoice:read, they still
// couldn't reach this page at all, since the route guard itself
// requires hotel:invoice:read. Not touched here without explicit
// approval, since it's a routing-level change, not a page-level one.
export default function InvoicesPage() {
  const canViewServiceRequests = usePermission('hotel:service_request:read')

  return (
    <div>
      <PageHeader title="Invoices" description="View and pay hotel invoices, and review in-room service requests." />

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          {canViewServiceRequests && <TabsTrigger value="service-requests">Service Requests</TabsTrigger>}
        </TabsList>
        <TabsContent value="invoices">
          <InvoiceList />
        </TabsContent>
        {canViewServiceRequests && (
          <TabsContent value="service-requests">
            <ServiceRequestsList />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}