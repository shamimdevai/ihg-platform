import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import StatusBadge from '@/components/ui/StatusBadge'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/ToastProvider'
import { useAppConfig } from '@/hooks/useAppConfig'
import * as deliveryOrdersApi from '@/api/customer/deliveryOrdersApi'

// INFERRED, NOT SCHEMA-CONFIRMED — DeliveryOrder.status still has no
// `enum` block in THIS phase's given slice either (single example value,
// "placed", same as every prior phase's slice for this field). Reusing
// Phase 21's 8-value inferred lifecycle rather than guessing again from
// scratch — the meaning hasn't changed, just the consumer. Duplicated
// locally rather than imported from the staff-side file (same "local
// duplicate, not a cross-portal import" precedent Phase 22's
// RiderMyDeliveries.jsx set) — staff and customer portals stay
// independent. If real enum values are ever confirmed, both copies (and
// this one) need updating together.
export const statusColorMap = {
  placed: { label: 'Placed', className: 'bg-gray-100 text-gray-700' },
  confirmed: { label: 'Confirmed', className: 'bg-blue-100 text-blue-700' },
  preparing: { label: 'Preparing', className: 'bg-amber-100 text-amber-800' },
  ready: { label: 'Ready', className: 'bg-purple-100 text-purple-700' },
  assigned: { label: 'Assigned', className: 'bg-indigo-100 text-indigo-700' },
  out_for_delivery: { label: 'Out for Delivery', className: 'bg-cyan-100 text-cyan-700' },
  delivered: { label: 'Delivered', className: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
}

// Structural gate, not the inferred status string — matches this
// project's standing "gate off real typed fields" rule. The real
// server-side rule (RBAC_MATRIX §6.8's is_customer_cancellable()) only
// allows cancelling while still "placed"/"confirmed". We have no
// `preparing_at` field to draw that exact line (the same genuine gap
// Phase 21 flagged for the staff-side "Mark Preparing" button), so this
// shows Cancel any time the order hasn't reached `ready_at` and isn't
// already terminal — a superset of the real allowed window. A cancel
// attempted once the order has actually started preparing will be
// correctly rejected server-side; the mutation's onError below surfaces
// that rather than pretending it can't happen.
export function isCustomerCancellable(order) {
  return !order.ready_at && !order.delivered_at && !order.cancelled_at
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

export default function OrderHistory() {
  const { data: config } = useAppConfig()
  const currency = config?.currency || ''
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState('')
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelReason, setCancelReason] = useState('')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['delivery', 'my-orders', statusFilter],
    queryFn: () => deliveryOrdersApi.listMyOrders({ status: statusFilter || undefined }),
  })

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }) => deliveryOrdersApi.cancelMyOrder(id, reason),
    onSuccess: () => {
      toast({ title: 'Order cancelled', variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['delivery', 'my-orders'] })
      setCancelTarget(null)
      setCancelReason('')
    },
    onError: (err) => {
      // Covers the real "too late to cancel" rejection our client-side
      // gate above can't perfectly predict (no preparing_at field) —
      // see isCustomerCancellable()'s own comment.
      toast({
        title: 'Could not cancel order',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      })
    },
  })

  const columns = [
    {
      key: 'id',
      header: 'Order',
      render: (row) => (
        <Link to={`/shop/orders/${row.id}`} className="font-mono text-xs text-primary hover:underline">
          {row.id.slice(0, 8)}
        </Link>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} colorMap={statusColorMap} />,
    },
    { key: 'created_at', header: 'Placed', render: (row) => formatDate(row.created_at) },
    {
      key: 'total_amount',
      header: 'Total',
      render: (row) => `${row.total_amount} ${row.currency || currency}`,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex flex-wrap gap-2 justify-end">
          <Link to={`/shop/orders/${row.id}`}>
            <Button variant="outline" size="sm">
              Track
            </Button>
          </Link>
          {isCustomerCancellable(row) && (
            <Button variant="ghost" size="sm" onClick={() => setCancelTarget(row)}>
              Cancel
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="mb-4 w-56">
        <Label htmlFor="my-order-status-filter">Filter by status</Label>
        {/* Free-text, not a dropdown — status has no confirmed enum,
            same treatment as every unconfirmed status field since
            Phase 11. */}
        <Input
          id="my-order-status-filter"
          placeholder="e.g. placed, confirmed, delivered…"
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
        emptyTitle="You haven't placed any delivery orders yet"
      />

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
            <Label htmlFor="my-order-cancel-reason">Reason (optional)</Label>
            <Textarea
              id="my-order-cancel-reason"
              placeholder="Optional — let us know why"
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
    </div>
  )
}