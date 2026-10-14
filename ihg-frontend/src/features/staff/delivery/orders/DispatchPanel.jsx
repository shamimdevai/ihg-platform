import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import StatusBadge from '@/components/ui/StatusBadge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { Label } from '@/components/ui/Label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { useToast } from '@/components/ui/ToastProvider'
import { usePermission } from '@/hooks/usePermission'
import * as deliveryApi from '@/api/staff/deliveryApi'

// DeliveryAssignment.status has the WEAKEST schema signal of any
// unconfirmed field in this codebase — the given schema literally shows
// the placeholder "status_example", not even a plausible real value.
// Displayed only via StatusBadge's safe fallback below; never offered
// as a dropdown option anywhere.
const assignmentStatusMap = {}

function formatTime(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

// Assigns a "ready" order (real typed field: ready_at present, and not
// yet out for delivery/delivered/cancelled) to a rider. Gated by
// delivery:rider:write — CONFIRMED the code that gates POST
// /delivery/assignments server-side (RBAC_MATRIX §4.10/§6.8), matching
// this screen's own route guard exactly (unlike DeliveryOrdersList's
// order actions, which use the separate delivery:order:write code).
//
// "Ready but unassigned" is computed client-side from real typed
// fields (ready_at set, out_for_delivery_at/delivered_at/cancelled_at
// NOT set) cross-referenced against active assignments — deliberately
// NOT filtered by a guessed status="ready" query param, since
// DeliveryOrder.status has no confirmed enum (see DeliveryOrdersList.jsx).
// Riders are filtered to status=available at the query level — "available"
// is the one Rider.status value that appears as the schema's own real
// example (see deliveryApi.js), a stronger signal than a pure guess.
export default function DispatchPanel() {
  const canDispatch = usePermission('delivery:rider:write')
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [selections, setSelections] = useState({}) // { [orderId]: riderId }
  const [cancelTarget, setCancelTarget] = useState(null)

  const {
    data: orders,
    isLoading: ordersLoading,
    isError: ordersError,
    error: ordersErrorObj,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: ['delivery', 'orders', 'all-for-dispatch'],
    queryFn: () => deliveryApi.listOrders(),
  })

  const { data: activeAssignments } = useQuery({
    queryKey: ['delivery', 'assignments', 'active'],
    queryFn: () => deliveryApi.listAssignments({ isActive: true }),
  })

  const { data: availableRiders } = useQuery({
    queryKey: ['delivery', 'riders', 'available'],
    queryFn: () => deliveryApi.listRiders({ status: 'available', isActive: true }),
    enabled: canDispatch,
  })

  const assignedOrderIds = new Set((activeAssignments || []).map((a) => a.order_id))

  const readyUnassignedOrders = (orders || []).filter(
    (o) =>
      o.ready_at &&
      !o.out_for_delivery_at &&
      !o.delivered_at &&
      !o.cancelled_at &&
      !assignedOrderIds.has(o.id)
  )

  const invalidateDispatchData = () => {
    // Backlog item 9: both assign AND cancel can change a rider's
    // status server-side (busy ↔ available), so both queries are
    // invalidated together after either mutation — not just
    // assignments — or the "Assign to Rider" dropdown could show a
    // rider as available/unavailable stale by one action.
    queryClient.invalidateQueries({ queryKey: ['delivery', 'assignments'] })
    queryClient.invalidateQueries({ queryKey: ['delivery', 'riders'] })
    queryClient.invalidateQueries({ queryKey: ['delivery', 'orders'] })
  }

  const assignMutation = useMutation({
    mutationFn: ({ orderId, riderId }) => deliveryApi.createAssignment({ orderId, riderId }),
    onSuccess: (_, { orderId }) => {
      toast({ title: 'Rider assigned', variant: 'success' })
      invalidateDispatchData()
      setSelections((prev) => {
        const next = { ...prev }
        delete next[orderId]
        return next
      })
    },
    onError: (err) =>
      toast({
        title: 'Could not assign rider',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  // Backlog item 9, RESOLVED — cancelAssignment() now exists. Frees the
  // rider back to "available" and the order back to "ready_for_pickup"
  // server-side (rider_service.cancel_assignment) — both queries, plus
  // orders, are invalidated together above for this reason.
  const cancelMutation = useMutation({
    mutationFn: (assignmentId) => deliveryApi.cancelAssignment(assignmentId),
    onSuccess: () => {
      toast({ title: 'Assignment cancelled', variant: 'success' })
      invalidateDispatchData()
      setCancelTarget(null)
    },
    onError: (err) => {
      toast({
        title: 'Could not cancel assignment',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      })
      setCancelTarget(null)
    },
  })

  const orderColumns = [
    { key: 'id', header: 'Order', render: (row) => <span className="font-mono text-xs">{row.id}</span> },
    { key: 'total_amount', header: 'Total', render: (row) => `${row.total_amount} ${row.currency || ''}` },
    { key: 'ready_at', header: 'Ready Since', render: (row) => formatTime(row.ready_at) },
    {
      key: 'rider',
      header: 'Assign to Rider',
      render: (row) => (
        <div className="w-56">
          <Select
            value={selections[row.id] || ''}
            onValueChange={(riderId) => setSelections((prev) => ({ ...prev, [row.id]: riderId }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an available rider" />
            </SelectTrigger>
            <SelectContent>
              {(availableRiders || []).length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">No riders available</div>
              )}
              {(availableRiders || []).map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.vehicle_type ? `${r.vehicle_type} — ` : ''}
                  {r.phone || r.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button
          size="sm"
          disabled={!selections[row.id]}
          loading={assignMutation.isPending && assignMutation.variables?.orderId === row.id}
          onClick={() => assignMutation.mutate({ orderId: row.id, riderId: selections[row.id] })}
        >
          Assign
        </Button>
      ),
    },
  ]

  const assignmentColumns = [
    { key: 'order_id', header: 'Order', render: (row) => <span className="font-mono text-xs">{row.order_id}</span> },
    { key: 'rider_id', header: 'Rider', render: (row) => <span className="font-mono text-xs">{row.rider_id}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} colorMap={assignmentStatusMap} />,
    },
    { key: 'assigned_at', header: 'Assigned', render: (row) => formatTime(row.assigned_at) },
    { key: 'picked_up_at', header: 'Picked Up', render: (row) => formatTime(row.picked_up_at) },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button variant="destructive" size="sm" onClick={() => setCancelTarget(row)}>
          Cancel
        </Button>
      ),
    },
  ]

  if (!canDispatch) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        You don't have permission to dispatch riders.
      </p>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-semibold mb-2">Ready orders awaiting a rider</h3>
        <Table
          columns={orderColumns}
          data={readyUnassignedOrders}
          loading={ordersLoading}
          error={ordersError ? ordersErrorObj?.response?.data?.message || ordersErrorObj?.message : null}
          onRetry={refetchOrders}
          emptyTitle="No ready orders waiting for a rider"
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Active assignments</h3>
        <Table
          columns={assignmentColumns}
          data={activeAssignments}
          loading={false}
          error={null}
          emptyTitle="No active assignments"
        />
      </div>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => cancelMutation.mutate(cancelTarget.id)}
        title="Cancel this assignment?"
        description="The rider will be freed back to available, and the order will return to ready-for-pickup so it can be re-dispatched."
        confirmLabel="Cancel Assignment"
        variant="destructive"
        loading={cancelMutation.isPending}
      />
    </div>
  )
}