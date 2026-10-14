import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/ToastProvider'
import { usePermission } from '@/hooks/usePermission'
import { useAppConfig } from '@/hooks/useAppConfig'
import * as deliveryApi from '@/api/staff/deliveryApi'

// INFERRED, NOT SCHEMA-CONFIRMED — DeliveryOrder.status has no `enum`
// block in this phase's given slice, only a single example value
// ("placed"). This 8-value lifecycle is a reasonable domain guess
// (matching the Global Context Prompt's own paraphrase), not a
// confirmed list. StatusBadge's fallback (colorMap miss → neutral gray,
// verbatim label) renders any real value safely even if this guess is
// wrong. Tighten the moment real enum values are confirmed, per this
// project's standing rule.
const statusColorMap = {
  placed: { label: 'Placed', className: 'bg-gray-100 text-gray-700' },
  confirmed: { label: 'Confirmed', className: 'bg-blue-100 text-blue-700' },
  preparing: { label: 'Preparing', className: 'bg-amber-100 text-amber-800' },
  ready: { label: 'Ready', className: 'bg-purple-100 text-purple-700' },
  assigned: { label: 'Assigned', className: 'bg-indigo-100 text-indigo-700' },
  out_for_delivery: { label: 'Out for Delivery', className: 'bg-cyan-100 text-cyan-700' },
  delivered: { label: 'Delivered', className: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
}

// One-tap "advance" actions this staff screen can trigger directly.
// assigned/out_for_delivery/delivered are NOT reachable from here — they
// happen via Dispatch (assignment) and the Rider's own pickup/deliver
// actions (Phase 22, delivery:order:update_status), not staff order
// writes. Keyed by the CURRENT inferred status string, since — unlike
// confirm/ready below — there is no real typed field (no
// `preparing_at`) to determine this step's boundary instead. Flagged:
// this is a genuine schema gap, the same class as Reservation.status
// (Phase 17) and DineInOrder.status (Phase 19), not a design choice.
const NEXT_ACTION = {
  placed: { label: 'Confirm Order', apiCall: (id) => deliveryApi.confirmOrder(id) },
  confirmed: { label: 'Mark Preparing', apiCall: (id) => deliveryApi.markOrderPreparing(id) },
  preparing: { label: 'Mark Ready', apiCall: (id) => deliveryApi.markOrderReady(id) },
}

function formatTime(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

function ViewItemsModal({ orderId, onClose }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['delivery', 'orders', 'detail', orderId],
    queryFn: () => deliveryApi.getOrder(orderId),
  })

  return (
    <Modal open onClose={onClose} title="Order Items">
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && (
        <p className="text-sm text-destructive">
          {error?.response?.data?.message || error?.message}
        </p>
      )}
      {data && (
        <div className="space-y-3">
          {data.delivery_notes && (
            <p className="text-sm text-muted-foreground">Notes: {data.delivery_notes}</p>
          )}
          <div className="rounded-md border divide-y">
            {(data.items || []).map((item) => (
              <div key={item.id} className="px-3 py-2 text-sm flex justify-between">
                <div>
                  <div>
                    {item.quantity} × {item.item_name}
                  </div>
                  {item.special_instructions && (
                    <div className="text-muted-foreground text-xs">{item.special_instructions}</div>
                  )}
                </div>
                <div className="text-muted-foreground">{item.line_total}</div>
              </div>
            ))}
            {(!data.items || data.items.length === 0) && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No items on this order.</div>
            )}
          </div>
          {data.cancelled_reason && (
            <p className="text-sm text-destructive">Cancelled: {data.cancelled_reason}</p>
          )}
        </div>
      )}
    </Modal>
  )
}

// Gated at the route level by delivery:rider:write (see staffRoutes.jsx
// — deliberate, to keep Rider off this staff-wide screen despite Rider
// holding delivery:order:read). The write actions BELOW are gated by
// delivery:order:write instead — the actual code that protects
// confirm/preparing/ready/cancel server-side (RBAC_MATRIX §6.8). These
// are two independent permission codes; don't conflate them.
export default function DeliveryOrdersList() {
  const canWriteOrders = usePermission('delivery:order:write')
  const { data: config } = useAppConfig()
  const currency = config?.currency || ''
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [statusFilter, setStatusFilter] = useState('')
  const [viewingOrderId, setViewingOrderId] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelReason, setCancelReason] = useState('')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['delivery', 'orders', statusFilter],
    queryFn: () => deliveryApi.listOrders({ status: statusFilter || undefined }),
  })

  const invalidateOrders = () => queryClient.invalidateQueries({ queryKey: ['delivery', 'orders'] })

  const advanceMutation = useMutation({
    mutationFn: ({ id, apiCall }) => apiCall(id),
    onSuccess: () => {
      toast({ title: 'Order updated', variant: 'success' })
      invalidateOrders()
    },
    onError: (err) =>
      toast({
        title: 'Could not update order',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }) => deliveryApi.cancelOrder(id, reason),
    onSuccess: () => {
      toast({ title: 'Order cancelled', variant: 'success' })
      invalidateOrders()
      setCancelTarget(null)
      setCancelReason('')
    },
    onError: (err) =>
      toast({
        title: 'Could not cancel order',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const columns = [
    { key: 'id', header: 'Order', render: (row) => <span className="font-mono text-xs">{row.id}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} colorMap={statusColorMap} />,
    },
    {
      key: 'total_amount',
      header: 'Total',
      render: (row) => `${row.total_amount} ${row.currency || currency}`,
    },
    { key: 'confirmed_at', header: 'Confirmed', render: (row) => formatTime(row.confirmed_at) },
    { key: 'ready_at', header: 'Ready', render: (row) => formatTime(row.ready_at) },
    { key: 'out_for_delivery_at', header: 'Out for Delivery', render: (row) => formatTime(row.out_for_delivery_at) },
    { key: 'delivered_at', header: 'Delivered', render: (row) => formatTime(row.delivered_at) },
    {
      key: 'actions',
      header: '',
      render: (row) => {
        const isTerminal = Boolean(row.cancelled_at || row.delivered_at)
        const next = NEXT_ACTION[row.status]
        return (
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setViewingOrderId(row.id)}>
              View Items
            </Button>
            {canWriteOrders && !isTerminal && next && (
              <Button
                size="sm"
                onClick={() => advanceMutation.mutate({ id: row.id, apiCall: next.apiCall })}
                loading={advanceMutation.isPending && advanceMutation.variables?.id === row.id}
              >
                {next.label}
              </Button>
            )}
            {canWriteOrders && !isTerminal && (
              <Button variant="ghost" size="sm" onClick={() => setCancelTarget(row)}>
                Cancel
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <div className="mb-4 w-56">
        <Label htmlFor="delivery-order-status-filter">Filter by status</Label>
        {/* Free-text, not a dropdown — status has no confirmed enum
            (see header comment). Same treatment as every unconfirmed
            status field since Phase 11. */}
        <Input
          id="delivery-order-status-filter"
          placeholder="e.g. placed, confirmed, ready…"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        />
      </div>

      <Table
        columns={columns}
        data={data}
        loading={isLoading}
        error={isError ? error?.response?.data?.message || error?.message : null}
        onRetry={refetch}
        emptyTitle="No delivery orders yet"
      />

      {viewingOrderId && <ViewItemsModal orderId={viewingOrderId} onClose={() => setViewingOrderId(null)} />}

      {canWriteOrders && (
        <Modal
          open={Boolean(cancelTarget)}
          onClose={() => {
            setCancelTarget(null)
            setCancelReason('')
          }}
          title="Cancel this order?"
        >
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="delivery-cancel-reason">Reason (optional)</Label>
              <Textarea
                id="delivery-cancel-reason"
                placeholder="Optional — e.g. restaurant out of stock"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCancelTarget(null)
                  setCancelReason('')
                }}
                disabled={cancelMutation.isPending}
              >
                Keep Order
              </Button>
              <Button
                type="button"
                variant="destructive"
                loading={cancelMutation.isPending}
                onClick={() =>
                  cancelMutation.mutate({ id: cancelTarget.id, reason: cancelReason || undefined })
                }
              >
                Cancel Order
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}