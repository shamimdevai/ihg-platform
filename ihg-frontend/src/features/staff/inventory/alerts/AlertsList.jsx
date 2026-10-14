import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import StatusBadge from '@/components/ui/StatusBadge'
import { usePermission } from '@/hooks/usePermission'
import * as inventoryAlertsApi from '@/api/staff/inventoryAlertsApi'
import * as inventoryItemsApi from '@/api/staff/inventoryItemsApi'
import ResolveAlertAction from './ResolveAlertAction'

const resolvedMap = {
  open: { label: 'Open', className: 'bg-red-100 text-red-700' },
  resolved: { label: 'Resolved', className: 'bg-green-100 text-green-700' },
}

// The `status` query param and each alert's own `status` field are real,
// but their exact enum values are NOT confirmed in this phase's OpenAPI
// slice (schema shows only the placeholder "status_example"). Rather
// than guess wrong values into a dropdown, the filter below is free
// text, and the "Open"/"Resolved" badge per row is derived structurally
// from `resolved_at` being present or not (a real, typed field) — the
// raw `status` string is also shown, verbatim, alongside it so nothing
// is hidden.
export default function AlertsList() {
  const canResolve = usePermission('inventory:alert:resolve')
  const canReadItems = usePermission('inventory:item:read')
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [resolving, setResolving] = useState(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['inventory', 'alerts', statusFilter],
    queryFn: () => inventoryAlertsApi.listAlerts(statusFilter || undefined),
  })

  const { data: items } = useQuery({
    queryKey: ['inventory', 'items'],
    queryFn: inventoryItemsApi.listItems,
    enabled: canReadItems,
  })
  const itemsById = new Map((items || []).map((i) => [i.id, i]))

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['inventory', 'alerts'] })

  const columns = [
    {
      key: 'item',
      header: 'Item',
      render: (row) => itemsById.get(row.inventory_item_id)?.name || row.inventory_item_id,
    },
    {
      key: 'state',
      header: 'State',
      render: (row) => <StatusBadge status={row.resolved_at ? 'resolved' : 'open'} colorMap={resolvedMap} />,
    },
    { key: 'status', header: 'Raw Status', render: (row) => row.status || '—' },
    { key: 'threshold_at_trigger', header: 'Threshold' },
    { key: 'quantity_at_trigger', header: 'Qty at Trigger' },
    {
      key: 'created_at',
      header: 'Triggered',
      render: (row) => (row.created_at ? new Date(row.created_at).toLocaleString() : '—'),
    },
    {
      key: 'resolution',
      header: 'Resolved',
      render: (row) =>
        row.resolved_at ? (
          <span title={row.resolution_note || ''}>{new Date(row.resolved_at).toLocaleString()}</span>
        ) : (
          '—'
        ),
    },
    ...(canResolve
      ? [
          {
            key: 'actions',
            header: '',
            render: (row) =>
              !row.resolved_at && (
                <Button size="sm" onClick={() => setResolving(row)}>
                  Resolve
                </Button>
              ),
          },
        ]
      : []),
  ]

  return (
    <div>
      <div className="flex items-end gap-2 mb-4 max-w-xs">
        <div className="space-y-1 flex-1">
          <Label htmlFor="status-filter">Filter by status (exact value)</Label>
          <Input
            id="status-filter"
            placeholder="e.g. active"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
        {statusFilter && (
          <Button variant="outline" onClick={() => setStatusFilter('')}>
            Clear
          </Button>
        )}
      </div>

      <Table
        columns={columns}
        data={data}
        loading={isLoading}
        error={isError ? error?.response?.data?.message || error?.message : null}
        onRetry={refetch}
        emptyTitle="No low-stock alerts"
      />

      {canResolve && (
        <ResolveAlertAction
          open={Boolean(resolving)}
          onClose={() => setResolving(null)}
          alert={resolving}
          itemLabel={resolving ? itemsById.get(resolving.inventory_item_id)?.name : ''}
          onResolved={() => {
            invalidate()
            setResolving(null)
          }}
        />
      )}
    </div>
  )
}