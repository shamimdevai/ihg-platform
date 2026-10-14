import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import StatusBadge from '@/components/ui/StatusBadge'
import { useToast } from '@/components/ui/ToastProvider'
import { usePermission } from '@/hooks/usePermission'
import { useAppConfig } from '@/hooks/useAppConfig'
import * as deliveryApi from '@/api/staff/deliveryApi'

// Same INFERRED, NOT SCHEMA-CONFIRMED order-status colorMap as
// DeliveryOrdersList.jsx (Phase 21) — duplicated locally rather than
// imported, since that file doesn't export it and this screen is
// deliberately kept independent of the staff-wide dispatch screen. If
// real enum values are ever confirmed, both copies need updating
// together (flagged, not a new gap).
const orderStatusColorMap = {
  placed: { label: 'Placed', className: 'bg-gray-100 text-gray-700' },
  confirmed: { label: 'Confirmed', className: 'bg-blue-100 text-blue-700' },
  preparing: { label: 'Preparing', className: 'bg-amber-100 text-amber-800' },
  ready: { label: 'Ready', className: 'bg-purple-100 text-purple-700' },
  assigned: { label: 'Assigned', className: 'bg-indigo-100 text-indigo-700' },
  out_for_delivery: { label: 'Out for Delivery', className: 'bg-cyan-100 text-cyan-700' },
  delivered: { label: 'Delivered', className: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
}

const riderStatusColorMap = {
  available: { label: 'Available', className: 'bg-green-100 text-green-700' },
  busy: { label: 'Busy', className: 'bg-amber-100 text-amber-800' },
  offline: { label: 'Offline', className: 'bg-gray-200 text-gray-600' },
}

function formatTime(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

// Read-only per §1/acceptance-checklist — no edit form anywhere on this
// screen. Rider's own profile write access doesn't exist as a
// permission at all (delivery:rider:write is Admin/dispatcher-only,
// RBAC_MATRIX §4.10) — this isn't a client-side choice to hide an
// available action, there is genuinely no self-service edit endpoint.
function MyProfileCard({ rider, isLoading }) {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading your profile…</p>
  }
  if (!rider) return null

  return (
    <div className="rounded-md border p-4 mb-6 flex flex-wrap items-center gap-x-8 gap-y-2">
      <div>
        <div className="text-xs text-muted-foreground">Vehicle</div>
        <div className="text-sm font-medium">{rider.vehicle_type || '—'}</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Plate</div>
        <div className="text-sm font-medium">{rider.license_plate || '—'}</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Phone</div>
        <div className="text-sm font-medium">{rider.phone || '—'}</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Status</div>
        <StatusBadge status={rider.status} colorMap={riderStatusColorMap} />
      </div>
      <div className="text-xs text-muted-foreground ml-auto">
        This profile is view-only here — changes are made by dispatch/admin.
      </div>
    </div>
  )
}

// This is deliberately the narrowest screen in the staff portal —
// route-gated by delivery:order:update_status (staffRoutes.jsx), and
// every read/write action inside it uses only the three codes Rider
// actually holds (delivery:order:read, delivery:order:update_status,
// delivery:rider:read). No restaurant:*/customers:*/iam:* grant exists
// on this role, so restaurant_id/customer_id/delivery_address_id are
// shown as raw IDs — same defensive-degrade precedent as TaskBoard.jsx
// (Phase 15) and RiderForm.jsx (Phase 21).
export default function RiderMyDeliveries() {
  const canUpdateStatus = usePermission('delivery:order:update_status')
  const { data: config } = useAppConfig()
  const currency = config?.currency || ''
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [showCompleted, setShowCompleted] = useState(false)

  const {
    data: myRider,
    isLoading: riderLoading,
    isError: riderError,
    error: riderErrorObj,
  } = useQuery({
    queryKey: ['delivery', 'riders', 'me'],
    queryFn: deliveryApi.getMyRiderProfile,
  })

  // No dedicated "my assignments" endpoint exists — per RBAC_MATRIX
  // §6.8, this is GET /delivery/assignments filtered by the caller's
  // own rider_id (from GET /delivery/riders/me above), joined
  // client-side with each assignment's order via GET /delivery/orders/
  // {id} (delivery:order:read, which Rider holds). Defaults to
  // is_active=true (currently in-progress deliveries) — "Show completed
  // too" widens this to the rider's full history.
  const {
    data: deliveries,
    isLoading: deliveriesLoading,
    isError: deliveriesError,
    error: deliveriesErrorObj,
    refetch,
  } = useQuery({
    queryKey: ['delivery', 'my-deliveries', myRider?.id, showCompleted],
    queryFn: async () => {
      const assignments = await deliveryApi.listAssignments({
        riderId: myRider.id,
        isActive: showCompleted ? undefined : true,
      })
      return Promise.all(
        assignments.map(async (assignment) => {
          try {
            const order = await deliveryApi.getOrder(assignment.order_id)
            return { ...assignment, order }
          } catch {
            // Order detail fetch failing shouldn't hide the assignment
            // row entirely — just show it without order detail.
            return { ...assignment, order: null }
          }
        })
      )
    },
    enabled: Boolean(myRider?.id),
  })

  const invalidateMyDeliveries = () => {
    queryClient.invalidateQueries({ queryKey: ['delivery', 'my-deliveries'] })
    // Delivering also frees the rider back to "available" server-side
    // (RBAC_MATRIX §6.8) — refresh the profile card too.
    queryClient.invalidateQueries({ queryKey: ['delivery', 'riders', 'me'] })
  }

  const pickupMutation = useMutation({
    mutationFn: (orderId) => deliveryApi.pickupDeliveryOrder(orderId),
    onSuccess: () => {
      toast({ title: 'Marked as picked up', variant: 'success' })
      invalidateMyDeliveries()
    },
    onError: (err) =>
      toast({
        title: 'Could not mark picked up',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const deliverMutation = useMutation({
    mutationFn: (orderId) => deliveryApi.deliverDeliveryOrder(orderId),
    onSuccess: () => {
      toast({ title: 'Marked as delivered', variant: 'success' })
      invalidateMyDeliveries()
    },
    onError: (err) =>
      toast({
        title: 'Could not mark delivered',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const columns = [
    {
      key: 'order_id',
      header: 'Order',
      render: (row) => <span className="font-mono text-xs">{row.order_id}</span>,
    },
    {
      key: 'order_status',
      header: 'Order Status',
      render: (row) =>
        row.order ? (
          <StatusBadge status={row.order.status} colorMap={orderStatusColorMap} />
        ) : (
          <span className="text-muted-foreground text-xs">Unavailable</span>
        ),
    },
    {
      key: 'total_amount',
      header: 'Total',
      render: (row) => (row.order ? `${row.order.total_amount} ${row.order.currency || currency}` : '—'),
    },
    {
      key: 'delivery_notes',
      header: 'Notes',
      render: (row) => row.order?.delivery_notes || <span className="text-muted-foreground">—</span>,
    },
    { key: 'assigned_at', header: 'Assigned', render: (row) => formatTime(row.assigned_at) },
    { key: 'picked_up_at', header: 'Picked Up', render: (row) => formatTime(row.picked_up_at) },
    { key: 'delivered_at', header: 'Delivered', render: (row) => formatTime(row.delivered_at) },
    {
      key: 'actions',
      header: '',
      render: (row) => {
        // Gated off the assignment's own real typed fields — the same
        // fields the pickup/deliver calls themselves set — rather than
        // the weak-signal DeliveryAssignment.status string (which this
        // codebase has never trusted for gating, see deliveryApi.js's
        // header comment).
        const isCancelled = Boolean(row.cancelled_at)
        const isDelivered = Boolean(row.delivered_at)
        const isPickedUp = Boolean(row.picked_up_at)

        if (!canUpdateStatus || isCancelled || isDelivered) return null

        if (!isPickedUp) {
          return (
            <Button
              size="sm"
              onClick={() => pickupMutation.mutate(row.order_id)}
              loading={pickupMutation.isPending && pickupMutation.variables === row.order_id}
            >
              Mark Picked Up
            </Button>
          )
        }

        return (
          <Button
            size="sm"
            onClick={() => deliverMutation.mutate(row.order_id)}
            loading={deliverMutation.isPending && deliverMutation.variables === row.order_id}
          >
            Mark Delivered
          </Button>
        )
      },
    },
  ]

  return (
    <div>
      <MyProfileCard rider={myRider} isLoading={riderLoading} />
      {riderError && (
        <p className="text-sm text-destructive mb-4">
          Could not load your rider profile: {riderErrorObj?.response?.data?.message || riderErrorObj?.message}
        </p>
      )}

      <div className="mb-4 flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
          />
          Show completed deliveries too
        </label>
      </div>

      <Table
        columns={columns}
        data={deliveries}
        loading={deliveriesLoading}
        error={deliveriesError ? deliveriesErrorObj?.response?.data?.message || deliveriesErrorObj?.message : null}
        onRetry={refetch}
        rowKey="id"
        emptyTitle={showCompleted ? 'No deliveries assigned to you yet' : 'No active deliveries assigned to you right now'}
      />
    </div>
  )
}