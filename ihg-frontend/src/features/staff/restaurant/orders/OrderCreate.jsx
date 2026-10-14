import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Input } from '@/components/ui/Input'
import Table from '@/components/ui/Table'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { useToast } from '@/components/ui/ToastProvider'
import { useAppConfig } from '@/hooks/useAppConfig'
import * as restaurantApi from '@/api/staff/restaurantApi'
import { useMenuItems, MenuItemsBrowser } from '@/features/staff/restaurant/menu/MenuItemsList'

function formatMoney(amount, currency) {
  const value = Number(amount || 0).toFixed(2)
  return currency ? `${currency} ${value}` : value
}

/**
 * Table dropdown deliberately does NOT filter to status=available,
 * unlike BookingForm's room dropdown (Phase 14) or AvailabilitySearch
 * (Phase 13). A dine-in order is taken for a table that's already
 * occupied/seated — filtering to "available" would make it impossible
 * to select the actual table the waiter is standing at. All active
 * tables for the restaurant are shown, with each table's current status
 * displayed alongside its number so the waiter can still see it.
 */
export default function OrderCreate({ open, onClose, restaurantId, tables = [] }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: config } = useAppConfig()
  const currency = config?.currency

  const [tableId, setTableId] = useState('')
  const [notes, setNotes] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [cart, setCart] = useState([])

  useEffect(() => {
    if (open) {
      setTableId('')
      setNotes('')
      setCategoryFilter('all')
      setCart([])
    }
  }, [open])

  // categories aren't passed in — this screen only needs them for the
  // filter dropdown's labels, and MenuItemsBrowser degrades gracefully
  // (shows "—") if none are supplied. Kept minimal since OrderCreate is
  // opened from OrdersList, which doesn't otherwise need categories.
  const menuQuery = useMenuItems({
    restaurantId,
    categoryId: categoryFilter === 'all' ? undefined : categoryFilter,
    isAvailable: true,
  })

  const createMutation = useMutation({
    mutationFn: restaurantApi.createOrder,
    onSuccess: () => {
      toast({ title: 'Order placed', variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['restaurant', 'orders', restaurantId] })
      onClose()
    },
    onError: (err) =>
      toast({
        title: 'Could not place order',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const addItem = (menuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.menu_item_id === menuItem.id)
      if (existing) {
        return prev.map((i) =>
          i.menu_item_id === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [
        ...prev,
        {
          menu_item_id: menuItem.id,
          name: menuItem.name,
          // Effective (post-discount) price, matching what the server
          // snapshots at order placement. Estimate only — the server's
          // returned totals remain authoritative.
          unit_price: menuItem.effective_price ?? menuItem.price,
          quantity: 1,
          special_instructions: '',
        },
      ]
    })
  }

  const updateQuantity = (menuItemId, rawValue) => {
    const quantity = Math.max(1, Number(rawValue) || 1)
    setCart((prev) => prev.map((i) => (i.menu_item_id === menuItemId ? { ...i, quantity } : i)))
  }

  const updateInstructions = (menuItemId, value) => {
    setCart((prev) =>
      prev.map((i) => (i.menu_item_id === menuItemId ? { ...i, special_instructions: value } : i))
    )
  }

  const removeItem = (menuItemId) => {
    setCart((prev) => prev.filter((i) => i.menu_item_id !== menuItemId))
  }

  const estimatedSubtotal = cart.reduce((sum, i) => sum + Number(i.unit_price || 0) * i.quantity, 0)

  const handleSubmit = () => {
    if (!tableId) {
      toast({ title: 'Select a table first', variant: 'destructive' })
      return
    }
    if (cart.length === 0) {
      toast({ title: 'Add at least one item', variant: 'destructive' })
      return
    }
    createMutation.mutate({
      restaurant_id: restaurantId,
      table_id: tableId,
      notes: notes || undefined,
      items: cart.map((i) => ({
        menu_item_id: i.menu_item_id,
        quantity: i.quantity,
        special_instructions: i.special_instructions || undefined,
      })),
    })
  }

  const cartColumns = [
    { key: 'name', header: 'Item' },
    { key: 'unit_price', header: 'Price', render: (row) => formatMoney(row.unit_price, currency) },
    {
      key: 'quantity',
      header: 'Qty',
      render: (row) => (
        <Input
          type="number"
          min="1"
          className="w-20"
          value={row.quantity}
          onChange={(e) => updateQuantity(row.menu_item_id, e.target.value)}
        />
      ),
    },
    {
      key: 'special_instructions',
      header: 'Notes',
      render: (row) => (
        <Input
          placeholder="Optional"
          value={row.special_instructions}
          onChange={(e) => updateInstructions(row.menu_item_id, e.target.value)}
        />
      ),
    },
    {
      key: 'line_total',
      header: 'Est. Total',
      render: (row) => formatMoney(Number(row.unit_price || 0) * row.quantity, currency),
    },
    {
      key: 'remove',
      header: '',
      render: (row) => (
        <Button variant="ghost" size="sm" onClick={() => removeItem(row.menu_item_id)}>
          Remove
        </Button>
      ),
    },
  ]

  return (
    <Modal open={open} onClose={onClose} title="New Order">
      <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
        <div className="space-y-1">
          <Label htmlFor="order-table">Table</Label>
          <Select value={tableId || undefined} onValueChange={setTableId}>
            <SelectTrigger id="order-table">
              <SelectValue placeholder="Select a table" />
            </SelectTrigger>
            <SelectContent>
              {tables.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  Table {t.table_number} ({t.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {tables.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No tables exist for this restaurant yet — add one on the Tables & Reservations page first.
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="order-notes">Order Notes</Label>
          <Textarea
            id="order-notes"
            placeholder="Optional — e.g. allergy note, special request"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div>
          <Label>Add Items</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Only available menu items are shown. Click "Add" to add an item to this order.
          </p>
          <MenuItemsBrowser
            items={menuQuery.data}
            categories={[]}
            loading={menuQuery.isLoading}
            error={menuQuery.isError ? menuQuery.error?.response?.data?.message || menuQuery.error?.message : null}
            onRetry={menuQuery.refetch}
            onSelect={addItem}
          />
        </div>

        <div>
          <Label>Order Items</Label>
          <div className="mt-2">
            <Table columns={cartColumns} data={cart} rowKey="menu_item_id" emptyTitle="No items added yet" />
          </div>
          {cart.length > 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              Items subtotal (estimated): {formatMoney(estimatedSubtotal, currency)} — tax and the final
              total are calculated by the server once the order is placed.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button type="button" loading={createMutation.isPending} onClick={handleSubmit}>
            Place Order
          </Button>
        </div>
      </div>
    </Modal>
  )
}