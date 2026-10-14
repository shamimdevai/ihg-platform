import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import StatusBadge from '@/components/ui/StatusBadge'
import { usePermission } from '@/hooks/usePermission'
import * as inventoryStockApi from '@/api/staff/inventoryStockApi'
import * as inventoryItemsApi from '@/api/staff/inventoryItemsApi'
import StockAdjustModal from './StockAdjustModal'
import StockTransactionsModal from './StockTransactionsModal'

const lowStockMap = {
  low: { label: 'Low stock', className: 'bg-red-100 text-red-700' },
  ok: { label: 'OK', className: 'bg-green-100 text-green-700' },
}

export default function StockList() {
  const canReadItems = usePermission('inventory:item:read')
  const canAdjust = usePermission('inventory:stock:adjust')
  const queryClient = useQueryClient()
  const [adjusting, setAdjusting] = useState(null)
  const [viewingHistory, setViewingHistory] = useState(null)

  const { data: stock, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['inventory', 'stock'],
    queryFn: inventoryStockApi.listStock,
  })

  // Item name/unit/reorder_threshold live on the separate items
  // resource — joined client-side purely for display. Falls back to
  // the raw item id if the caller can't read items.
  const { data: items } = useQuery({
    queryKey: ['inventory', 'items'],
    queryFn: inventoryItemsApi.listItems,
    enabled: canReadItems,
  })

  const itemsById = new Map((items || []).map((i) => [i.id, i]))
  const invalidateStock = () => queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] })

  const columns = [
    {
      key: 'item',
      header: 'Item',
      render: (row) => itemsById.get(row.inventory_item_id)?.name || row.inventory_item_id,
    },
    {
      key: 'quantity_on_hand',
      header: 'Quantity on Hand',
      render: (row) => {
        const item = itemsById.get(row.inventory_item_id)
        return `${row.quantity_on_hand}${item?.unit ? ` ${item.unit}` : ''}`
      },
    },
    {
      key: 'level',
      header: 'Level',
      render: (row) => {
        const item = itemsById.get(row.inventory_item_id)
        if (!item || item.reorder_threshold == null) return '—'
        const isLow = row.quantity_on_hand <= item.reorder_threshold
        return <StatusBadge status={isLow ? 'low' : 'ok'} colorMap={lowStockMap} />
      },
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setViewingHistory(row)}>
            History
          </Button>
          {canAdjust && (
            <Button size="sm" onClick={() => setAdjusting(row)}>
              Adjust
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <Table
        columns={columns}
        data={stock}
        loading={isLoading}
        error={isError ? error?.response?.data?.message || error?.message : null}
        onRetry={refetch}
        emptyTitle="No stock records yet"
      />
      {canAdjust && (
        <StockAdjustModal
          open={Boolean(adjusting)}
          onClose={() => setAdjusting(null)}
          stockRow={adjusting}
          itemLabel={adjusting ? itemsById.get(adjusting.inventory_item_id)?.name : ''}
          onAdjusted={() => {
            invalidateStock()
            setAdjusting(null)
          }}
        />
      )}
      <StockTransactionsModal
        open={Boolean(viewingHistory)}
        onClose={() => setViewingHistory(null)}
        stockRow={viewingHistory}
        itemLabel={viewingHistory ? itemsById.get(viewingHistory.inventory_item_id)?.name : ''}
      />
    </div>
  )
}