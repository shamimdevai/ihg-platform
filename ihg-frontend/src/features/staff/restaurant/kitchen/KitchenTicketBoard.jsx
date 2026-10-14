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

// Confirmed, real enum (from the PUT .../status request schema's
// description field, not inferred) — see restaurantApi.js's header
// comment for the flagged "queued" example-value discrepancy.
const KITCHEN_STATUSES = ['pending', 'preparing', 'ready', 'served', 'cancelled']

const statusColorMap = {
  pending: { label: 'Pending', className: 'bg-gray-100 text-gray-700' },
  preparing: { label: 'Preparing', className: 'bg-amber-100 text-amber-800' },
  ready: { label: 'Ready', className: 'bg-blue-100 text-blue-700' },
  served: { label: 'Served', className: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
}

// Straight-line progression a kitchen ticket normally follows. Used only
// to power the one-tap "advance" button below — the Update Status modal
// still allows jumping to any of the 5 confirmed values (including
// cancelling from any non-terminal state), so this map is a convenience
// shortcut, not an enforced state machine.
const NEXT_STATUS = {
  pending: { value: 'preparing', label: 'Start Preparing' },
  preparing: { value: 'ready', label: 'Mark Ready' },
  ready: { value: 'served', label: 'Mark Served' },
}

const TERMINAL_STATUSES = ['served', 'cancelled']

function formatTime(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

function UpdateStatusModal({ ticket, onClose }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [status, setStatus] = useState(ticket.status)
  const [notes, setNotes] = useState(ticket.notes || '')

  const mutation = useMutation({
    mutationFn: () => restaurantApi.updateKitchenTicketStatus(ticket.id, status, notes),
    onSuccess: () => {
      toast({ title: 'Ticket status updated', variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['restaurant', 'kitchen'] })
      onClose()
    },
    onError: (err) =>
      toast({
        title: 'Could not update ticket',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  return (
    <Modal open onClose={onClose} title="Update Ticket Status">
      <div className="space-y-4">
        <div>
          <Label htmlFor="ticket-status">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="ticket-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KITCHEN_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusColorMap[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="ticket-notes">Notes (optional)</Label>
          <Input
            id="ticket-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes about this ticket"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function ViewItemsModal({ ticketId, onClose }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['restaurant', 'kitchen', 'detail', ticketId],
    queryFn: () => restaurantApi.getKitchenTicket(ticketId),
  })

  return (
    <Modal open onClose={onClose} title="Ticket Items">
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && (
        <p className="text-sm text-destructive">
          {error?.response?.data?.message || error?.message}
        </p>
      )}
      {data && (
        <div className="space-y-3">
          {/* No restaurant:table:read grant exists for Kitchen, so this
              can't be resolved to a table number client-side — shown as
              the raw ID, same defensive-degrade pattern Phase 15 used
              for room IDs on the housekeeping board. */}
          <div className="text-sm text-muted-foreground">
            Table: <span className="font-mono text-xs">{data.table_id}</span>
          </div>
          <div className="rounded-md border divide-y">
            {(data.items || []).map((item) => (
              <div key={item.id} className="px-3 py-2 text-sm">
                <div>
                  {item.quantity} × {item.item_name}
                </div>
                {item.special_instructions && (
                  <div className="text-muted-foreground text-xs">{item.special_instructions}</div>
                )}
              </div>
            ))}
            {(!data.items || data.items.length === 0) && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No items on this ticket.</div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

// Kitchen's one and only screen. No restaurant selector — the given
// GET /restaurant/kitchen slice takes no restaurant_id param, and Kitchen
// holds no restaurant:table:read to pick one from anyway. Loads using
// ONLY the kitchen ticket endpoints (list + detail + status-update) —
// no restaurant:order:* call anywhere in this file, per §1/§3: ticket
// responses embed everything Kitchen needs.
//
// Gating (RBAC_MATRIX v7 §4.9/§6.7): restaurant:kitchen:read gates the
// route (staffRoutes.jsx) and every GET call here; restaurant:kitchen:write
// gates every status-changing action below — CONFIRMED Kitchen holds
// both and nothing else in this domain.
export default function KitchenTicketBoard() {
  const canWrite = usePermission('restaurant:kitchen:write')
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [statusFilter, setStatusFilter] = useState('all')
  const [editingTicket, setEditingTicket] = useState(null)
  const [viewingTicketId, setViewingTicketId] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['restaurant', 'kitchen', statusFilter],
    queryFn: () =>
      restaurantApi.listKitchenTickets({
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
  })

  const advanceMutation = useMutation({
    mutationFn: ({ id, status }) => restaurantApi.updateKitchenTicketStatus(id, status),
    onSuccess: () => {
      toast({ title: 'Ticket status updated', variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['restaurant', 'kitchen'] })
    },
    onError: (err) =>
      toast({
        title: 'Could not update ticket',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const cancelMutation = useMutation({
    mutationFn: (id) => restaurantApi.updateKitchenTicketStatus(id, 'cancelled'),
    onSuccess: () => {
      toast({ title: 'Ticket cancelled', variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['restaurant', 'kitchen'] })
      setCancelTarget(null)
    },
    onError: (err) =>
      toast({
        title: 'Could not cancel ticket',
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
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} colorMap={statusColorMap} />,
    },
    { key: 'notes', header: 'Notes', render: (row) => row.notes || <span className="text-muted-foreground">—</span> },
    { key: 'started_at', header: 'Started', render: (row) => formatTime(row.started_at) },
    { key: 'ready_at', header: 'Ready', render: (row) => formatTime(row.ready_at) },
    { key: 'served_at', header: 'Served', render: (row) => formatTime(row.served_at) },
    {
      key: 'actions',
      header: '',
      render: (row) => {
        const next = NEXT_STATUS[row.status]
        const isTerminal = TERMINAL_STATUSES.includes(row.status)
        return (
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setViewingTicketId(row.id)}>
              View Items
            </Button>
            {canWrite && next && (
              <Button
                size="sm"
                onClick={() => advanceMutation.mutate({ id: row.id, status: next.value })}
                loading={advanceMutation.isPending && advanceMutation.variables?.id === row.id}
              >
                {next.label}
              </Button>
            )}
            {canWrite && (
              <Button variant="ghost" size="sm" onClick={() => setEditingTicket(row)}>
                Update Status
              </Button>
            )}
            {canWrite && !isTerminal && (
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
        <Label htmlFor="kitchen-status-filter" className="sr-only">
          Filter by status
        </Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger id="kitchen-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {KITCHEN_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {statusColorMap[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Table
        columns={columns}
        data={data}
        loading={isLoading}
        error={isError ? error?.response?.data?.message || error?.message : null}
        onRetry={refetch}
        emptyTitle="No kitchen tickets yet"
      />

      {editingTicket && <UpdateStatusModal ticket={editingTicket} onClose={() => setEditingTicket(null)} />}

      {viewingTicketId && (
        <ViewItemsModal ticketId={viewingTicketId} onClose={() => setViewingTicketId(null)} />
      )}

      {canWrite && (
        <ConfirmDialog
          open={Boolean(cancelTarget)}
          onClose={() => setCancelTarget(null)}
          onConfirm={() => cancelMutation.mutate(cancelTarget.id)}
          title="Cancel this ticket?"
          description="This cannot be undone. The ticket will be marked cancelled."
          confirmLabel="Cancel Ticket"
          cancelLabel="Keep Ticket"
          loading={cancelMutation.isPending}
        />
      )}
    </div>
  )
}