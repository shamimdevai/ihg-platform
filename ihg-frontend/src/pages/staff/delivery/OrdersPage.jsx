import PageHeader from '@/components/layout/PageHeader'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import DeliveryOrdersList from '@/features/staff/delivery/orders/DeliveryOrdersList'
import DispatchPanel from '@/features/staff/delivery/orders/DispatchPanel'

// No restaurant/order selector needed here, unlike Hotel/Restaurant's
// equivalent pages — GET /delivery/orders takes no required parent
// resource, and both tabs work off the same order list.
export default function OrdersPage() {
  return (
    <div>
      <PageHeader
        title="Delivery Orders & Dispatch"
        description="Track delivery orders and assign ready orders to riders."
      />

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="dispatch">Dispatch</TabsTrigger>
        </TabsList>
        <TabsContent value="orders">
          <DeliveryOrdersList />
        </TabsContent>
        <TabsContent value="dispatch">
          <DispatchPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}