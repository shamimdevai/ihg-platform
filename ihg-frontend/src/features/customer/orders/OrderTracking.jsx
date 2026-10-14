import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import Modal from '@/components/ui/Modal'
import LoadingState from '@/components/ui/LoadingState'
import ErrorState from '@/components/ui/ErrorState'
import { useToast } from '@/components/ui/ToastProvider'
import { useAppConfig } from '@/hooks/useAppConfig'
import * as deliveryOrdersApi from '@/api/customer/deliveryOrdersApi'
import { statusColorMap, isCustomerCancellable } from './OrderHistory'
import StatusBadge from '@/components/ui/StatusBadge'

const POLL_INTERVAL_MS = 15000

// Ordered progress steps, each keyed off a REAL typed timestamp field —
// not the inferred status string — per this project's standing "gate
// off real fields, not guessed enums" rule. Cancelled is handled as a
// separate terminal branch below, not a step in this list, since it can
// interrupt the sequence at any point rather than always following
// "Ready".
const PROGRESS_STEPS = [
  { key: 'created_at', label: 'Order placed' },
  { key: 'confirmed_at', label: 'Confirmed' },
  { key: 'ready_at', label: 'Ready' },
  { key: 'out_for_delivery_at', label: 'Out for delivery' },
  { key: 'delivered_at', label: 'Delivered' },
]

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : null
}

function formatPrice(value, currency) {
  const amount = Number(value).toFixed(2)
  return currency ? `${currency} ${amount}` : amount
}

/**
 * OrderTracking — self-service status view for ONE of the logged-in
 * customer's own orders. `orderId` comes from the route param, which
 * itself is only ever reached via OrderHistory.jsx's own list rows or
 * PlaceOrderForm.jsx's post-order-placement "View Order Status" link —
 * never typed/guessed. Both real endpoints this screen calls
 * (GET .../orders/mine/{id}, GET .../tracking/{id}/status) are
 * ownership-checked server-side per RBAC_MATRIX §6.8; there is no
 * general order-by-id lookup anywhere in this app for a customer to
 * misuse even if they tried editing the URL to another order's id — the
 * request would just be rejected.
 *
 * POLLING DECISION (per this phase's brief — pick one, note the
 * choice): there's no websocket/notification infrastructure anywhere in
 * this app (§1's known gaps, Open Question #4). Picked AUTOMATIC
 * POLLING as the primary mechanism — the lightweight
 * GET /delivery/tracking/{id}/status endpoint (no items, per
 * RBAC_MATRIX §6.8's own "lightweight" description) is re-fetched every
 * 15s via React Query's `refetchInterval`, and polling stops itself
 * once the order reaches a terminal state (delivered_at or
 * cancelled_at set) — no point continuing to poll a status that can't
 * change anymore. A manual "Refresh now" button is ALSO included
 * alongside the polling, purely as a convenience for someone who
 * doesn't want to wait up to 15s for a check they want right now — it
 * doesn't replace the polling, it just triggers the same query early.
 */
export default function OrderTracking() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const { data: config } = useAppConfig()
  const currency = config?.currency || ''
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  // Full detail (with items) — fetched once, not polled. Items don't
  // change after an order is placed.
  const detailQuery = useQuery({
    queryKey: ['delivery', 'my-orders', 'detail', orderId],
    queryFn: () => deliveryOrdersApi.getMyOrder(orderId),
  })

  // Lightweight status — the one this screen polls.
  const statusQuery = useQuery({
    queryKey: ['delivery', 'my-orders', 'status', orderId],
    queryFn: () => deliveryOrdersApi.getMyOrderStatus(orderId),
    refetchInterval: (query) => {
      const order = query.state.data
      const isTerminal = Boolean(order?.delivered_at || order?.cancelled_at)
      return isTerminal ? false : POLL_INTERVAL_MS
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => deliveryOrdersApi.cancelMyOrder(orderId, cancelReason || undefined),
    onSuccess: () => {
      toast({ title: 'Order cancelled', variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['delivery', 'my-orders'] })
      setCancelOpen(false)
      setCancelReason('')
    },
    onError: (err) => {
      toast({
        title: 'Could not cancel order',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      })
    },
  })

  if (detailQuery.isLoading) return <LoadingState />
  if (detailQuery.isError) {
    return (
      <ErrorState
        message={detailQuery.error?.response?.data?.message || detailQuery.error?.message}
        onRetry={detailQuery.refetch}
      />
    )
  }

  const detail = detailQuery.data
  // Prefer the polled status data once it's arrived (it's the more
  // current of the two after the first poll interval), fall back to
  // the one-time detail fetch while status is still loading.
  const current = statusQuery.data || detail
  const isCancelled = Boolean(current.cancelled_at)
  const isRefreshing = statusQuery.isFetching

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardContent className="py-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-sm text-muted-foreground">Order #{orderId.slice(0, 8)}</p>
              <StatusBadge status={current.status} colorMap={statusColorMap} className="mt-1" />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => statusQuery.refetch()}
              loading={isRefreshing}
            >
              Refresh now
            </Button>
          </div>

          {isCancelled ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
              <p className="font-medium text-destructive">This order was cancelled.</p>
              {current.cancelled_reason && (
                <p className="text-muted-foreground mt-1">Reason: {current.cancelled_reason}</p>
              )}
              {formatDate(current.cancelled_at) && (
                <p className="text-muted-foreground mt-1">{formatDate(current.cancelled_at)}</p>
              )}
            </div>
          ) : (
            <ol className="space-y-3">
              {PROGRESS_STEPS.map((step) => {
                const timestamp = current[step.key]
                const done = Boolean(timestamp)
                return (
                  <li key={step.key} className="flex items-center gap-3">
                    <span
                      className={
                        'h-2.5 w-2.5 rounded-full shrink-0 ' +
                        (done ? 'bg-primary' : 'bg-muted border border-muted-foreground/30')
                      }
                    />
                    <span className={done ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                      {step.label}
                    </span>
                    {done && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatDate(timestamp)}
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          )}

          <p className="text-xs text-muted-foreground">
            Status refreshes automatically every 15 seconds while this order is in progress.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Order summary</h3>
          <div className="rounded-md border divide-y">
            {(detail.items || []).map((item) => (
              <div key={item.id} className="px-3 py-2 text-sm flex justify-between">
                <div>
                  <div>
                    {item.quantity} × {item.item_name}
                  </div>
                  {item.special_instructions && (
                    <div className="text-muted-foreground text-xs">{item.special_instructions}</div>
                  )}
                </div>
                <div className="text-muted-foreground">{formatPrice(item.line_total, detail.currency || currency)}</div>
              </div>
            ))}
            {(!detail.items || detail.items.length === 0) && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No items found on this order.</div>
            )}
          </div>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(detail.subtotal, detail.currency || currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery fee</span>
              <span>{formatPrice(detail.delivery_fee, detail.currency || currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatPrice(detail.tax_amount, detail.currency || currency)}</span>
            </div>
            <div className="flex justify-between font-semibold text-foreground pt-1 border-t">
              <span>Total</span>
              <span>{formatPrice(detail.total_amount, detail.currency || currency)}</span>
            </div>
          </div>
          {detail.delivery_notes && (
            <p className="text-sm text-muted-foreground">Notes: {detail.delivery_notes}</p>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => navigate('/shop/orders')}>
          Back to Order History
        </Button>
        {isCustomerCancellable(current) && (
          <Button variant="destructive" onClick={() => setCancelOpen(true)}>
            Cancel Order
          </Button>
        )}
      </div>

      <Modal
        open={cancelOpen}
        onClose={() => {
          setCancelOpen(false)
          setCancelReason('')
        }}
        title="Cancel this order?"
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="tracking-cancel-reason">Reason (optional)</Label>
            <Textarea
              id="tracking-cancel-reason"
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
                setCancelOpen(false)
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
              onClick={() => cancelMutation.mutate()}
            >
              Cancel Order
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}