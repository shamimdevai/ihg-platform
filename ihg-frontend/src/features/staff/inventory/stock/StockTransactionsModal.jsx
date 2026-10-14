import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import Table from '@/components/ui/Table'
import * as inventoryStockApi from '@/api/staff/inventoryStockApi'

// Uses the raw Dialog primitive directly (not the shared Modal wrapper)
// for a wider container — same precedent as PermissionAssignment.jsx
// (Phase 8) for the same reason (a table needs more width than Modal's
// fixed max-w-lg allows).
export default function StockTransactionsModal({ open, onClose, stockRow, itemLabel }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['inventory', 'stock', 'transactions', stockRow?.inventory_item_id],
    queryFn: () => inventoryStockApi.listStockTransactions(stockRow.inventory_item_id),
    enabled: open && Boolean(stockRow),
  })

  const columns = [
    {
      key: 'created_at',
      header: 'Date',
      render: (row) => (row.created_at ? new Date(row.created_at).toLocaleString() : '—'),
    },
    { key: 'transaction_type', header: 'Type' },
    {
      key: 'quantity_delta',
      header: 'Change',
      render: (row) => (
        <span className={row.quantity_delta < 0 ? 'text-red-600' : 'text-green-700'}>
          {row.quantity_delta > 0 ? '+' : ''}
          {row.quantity_delta}
        </span>
      ),
    },
    { key: 'balance_after', header: 'Balance After' },
    { key: 'reason', header: 'Reason', render: (row) => row.reason || '—' },
  ]

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose?.()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Stock History{itemLabel ? ` — ${itemLabel}` : ''}</DialogTitle>
        </DialogHeader>
        <Table
          columns={columns}
          data={data}
          loading={isLoading}
          error={isError ? error?.response?.data?.message || error?.message : null}
          onRetry={refetch}
          emptyTitle="No stock movements recorded yet"
        />
      </DialogContent>
    </Dialog>
  )
}