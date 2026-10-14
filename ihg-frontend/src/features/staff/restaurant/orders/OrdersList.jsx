import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { useToast } from '@/components/ui/ToastProvider'
import { usePermission } from '@/hooks/usePermission'
import * as restaurantApi from '@/api/staff/restaurantApi'
import OrderCreate from './OrderCreate'
import BillModal from './BillModal'

// DineInOrder.status has NO confirmed enum in this phase's given slice
// (single example value "open", no `enum` block). INFERRED as
// open/billed/cancelled — the one example value plus the two real
// transition actions this screen exposes (bill → billed, cancel →
// cancelled). Same gap Reservation.status had in Phase 17: there is no
// real typed field anywhere in the response shape (no billed_at/
// cancelled_at) to gate the Bill/Cancel buttons off of instead, so they
// are gated directly off this inferred status string below. Free-text
// filter (not a dropdown), same treatment as every unconfirmed status
// field since Phase 11. Re-verify once real enum values are confirmed.
const statusColorMap = {
  open: { label: 'Open', className: 'bg-blue-100 text-blue-700' },
  billed: { label: 'Billed', className: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
}

function formatMoney(amount, currency) {
  const value = Number(amount || 0).toFixed(2)
  return currency && currency !== 'currency_example' ? `${currency} ${value}` : value
}

// Gating (RBAC_MATRIX v7 §4.9/§6.7, PROGRESS.md Resolved item —
// restaurant:order:*): restaurant:order:read gates the route/nav and
// this screen's GET calls (staffRoutes.jsx, unchanged from Phase 5);
// restaurant:order:write gates New Order/Bill/Cancel below — CONFIRMED
// held by Waiter alongside restaurant:menu:read only (no
// restaurant:table:*), the domain's most active Waiter permission.
export default function OrdersList({ restaurantId, tables = [] }) {
  const canWrite = usePermission('restaurant:order:write')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [tableFilter, setTableFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [billTarget, setBillTarget] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [viewTarget, setViewTarget] = useState(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['restaurant', 'orders', restaurantId, tableFilter, statusFilter],
    queryFn: () =>
      restaurantApi.listOrders({
        restaurantId,
        tableId: tableFilter === 'all' ? undefined : tableFilter,
        status: statusFilter || undefined,
      }),
    enabled: Boolean(restaurantId),
  })

  // Ahead-of-deliverable addition, flagged rather than added silently:
  // not named in Phase 19's own file list, but GET /restaurant/orders/
  // {id} (returning DineInOrderDetailRead with nested items) is a real,
  // in-scope endpoint, and staff reasonably need to see what's on an
  // order before billing it. Lightweight, lazy-fetched inline modal —
  // same ahead-of-deliverable precedent as Phase 11's
  // StockTransactionsModal.
  const viewQuery = useQuery({
    queryKey: ['restaurant', 'orders', 'detail', viewTarget],
    queryFn: () => restaurantApi.getOrder(viewTarget),
    enabled: Boolean(viewTarget),
  })

  const cancelMutation = useMutation({
    mutationFn: (id) => restaurantApi.cancelOrder(id),
    onSuccess: () => {
      toast({ title: 'Order cancelled', variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['restaurant', 'orders', restaurantId] })
      setCancelTarget(null)
    },
    onError: (err) =>
      toast({
        title: 'Could not cancel order',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const tableLabel = (tableId) => {
    const t = tables.find((t) => t.id === tableId)
    return t ? `Table ${t.table_number}` : tableId
  }

  const columns = [
    { key: 'table_id', header: 'Table', render: (row) => tableLabel(row.table_id) },
    { key: 'total_amount', header: 'Total', render: (row) => formatMoney(row.total_amount, row.currency) },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} colorMap={statusColorMap} />,
    },
    {
      key: 'created_at',
      header: 'Placed',
      render: (row) => (row.created_at ? new Date(row.created_at).toLocaleString() : '—'),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => {
        // Gated off the inferred status string — see header comment.
        const isOpen = row.status !== 'billed' && row.status !== 'cancelled'
        return (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setViewTarget(row.id)}>
              View
            </Button>
            {canWrite && isOpen && (
              <Button variant="outline" size="sm" onClick={() => setBillTarget(row)}>
                Bill
              </Button>
            )}
            {canWrite && isOpen && (
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
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex gap-4 flex-wrap">
          <div className="w-48">
            <Select value={tableFilter} onValueChange={setTableFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All tables" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tables</SelectItem>
                {tables.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    Table {t.table_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-56">
            <Label htmlFor="order-status-filter" className="sr-only">
              Filter by status
            </Label>
            <Input
              id="order-status-filter"
              placeholder="Filter by status (e.g. open)"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
        </div>
        {canWrite && <Button onClick={() => setCreateOpen(true)}>New Order</Button>}
      </div>

      <Table
        columns={columns}
        data={data}
        loading={isLoading}
        error={isError ? error?.response?.data?.message || error?.message : null}
        onRetry={refetch}
        emptyTitle="No orders yet"
      />

      {canWrite && (
        <OrderCreate
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          restaurantId={restaurantId}
          tables={tables}
        />
      )}

      {canWrite && (
        <BillModal
          open={Boolean(billTarget)}
          onClose={() => setBillTarget(null)}
          order={billTarget}
          restaurantId={restaurantId}
          tableLabel={billTarget ? tableLabel(billTarget.table_id) : null}
        />
      )}

      {canWrite && (
        <ConfirmDialog
          open={Boolean(cancelTarget)}
          onClose={() => setCancelTarget(null)}
          onConfirm={() => cancelMutation.mutate(cancelTarget.id)}
          title="Cancel this order?"
          description="This cannot be undone. The order will be marked cancelled."
          confirmLabel="Cancel Order"
          cancelLabel="Keep Order"
          loading={cancelMutation.isPending}
        />
      )}

      <Modal open={Boolean(viewTarget)} onClose={() => setViewTarget(null)} title="Order Items">
        {viewQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {viewQuery.isError && (
          <p className="text-sm text-destructive">
            {viewQuery.error?.response?.data?.message || viewQuery.error?.message}
          </p>
        )}
        {viewQuery.data && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">{tableLabel(viewQuery.data.table_id)}</div>
            <div className="rounded-md border divide-y">
              {(viewQuery.data.items || []).map((item) => (
                <div key={item.id} className="px-3 py-2 flex justify-between text-sm">
                  <div>
                    <div>
                      {item.quantity} × {item.item_name}
                    </div>
                    {item.special_instructions && (
                      <div className="text-muted-foreground text-xs">{item.special_instructions}</div>
                    )}
                  </div>
                  <div>{formatMoney(item.line_total, viewQuery.data.currency)}</div>
                </div>
              ))}
              {(!viewQuery.data.items || viewQuery.data.items.length === 0) && (
                <div className="px-3 py-2 text-sm text-muted-foreground">No items on this order.</div>
              )}
            </div>
            <div className="text-sm text-right font-medium">
              Total: {formatMoney(viewQuery.data.total_amount, viewQuery.data.currency)}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}