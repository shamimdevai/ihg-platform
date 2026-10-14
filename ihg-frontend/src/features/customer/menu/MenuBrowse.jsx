import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import LoadingState from '@/components/ui/LoadingState'
import ErrorState from '@/components/ui/ErrorState'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/ToastProvider'
import { useAppConfig } from '@/hooks/useAppConfig'
import { useCartStore } from '@/store/cartStore'
import * as menuApi from '@/api/customer/menuApi'
import PropertyPicker from '@/features/customer/shared/PropertyPicker'
import MenuItemCard from './MenuItemCard'

/**
 * Public menu browsing. The chosen restaurant lives in the URL
 * (?restaurantId=…). One restaurant → used silently. Several → a picker
 * is shown first. A cart holds items from ONE restaurant only: adding
 * from a different one asks to clear the cart first.
 */
export default function MenuBrowse() {
  const { toast } = useToast()
  const { data: config } = useAppConfig()
  const currency = config?.currency
  const addItem = useCartStore((s) => s.addItem)
  const clearCart = useCartStore((s) => s.clearCart)

  const [params, setParams] = useSearchParams()
  const restaurantParam = params.get('restaurantId')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [pendingItem, setPendingItem] = useState(null)

  const {
    data: restaurants,
    isLoading: restaurantsLoading,
    isError: restaurantsError,
    error: restaurantsErrorObj,
    refetch: refetchRestaurants,
  } = useQuery({
    queryKey: ['customer', 'restaurants'],
    queryFn: menuApi.listRestaurants,
  })

  const effectiveRestaurantId =
    restaurantParam || (restaurants?.length === 1 ? restaurants[0].id : null)

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['customer', 'menu-categories', effectiveRestaurantId],
    queryFn: () => menuApi.listMenuCategories(effectiveRestaurantId),
    enabled: Boolean(effectiveRestaurantId),
  })

  const {
    data: items,
    isLoading: itemsLoading,
    isError: itemsError,
    error: itemsErrorObj,
    refetch: refetchItems,
  } = useQuery({
    queryKey: ['customer', 'menu-items', effectiveRestaurantId],
    queryFn: () => menuApi.listMenuItems({ restaurantId: effectiveRestaurantId, isAvailable: true }),
    enabled: Boolean(effectiveRestaurantId),
  })

  const visibleItems = (items || []).filter(
    (i) => categoryFilter === 'all' || i.category_id === categoryFilter
  )

  const setRestaurant = (id) => {
    setParams({ restaurantId: id })
    setCategoryFilter('all')
  }

  const addAndToast = (item) => {
    const result = addItem(item, effectiveRestaurantId)
    if (result.ok) {
      toast({ title: `${item.name} added to cart`, variant: 'success' })
    } else {
      toast({ title: 'Could not add item', description: result.reason, variant: 'destructive' })
    }
  }

  const handleAdd = (item) => {
    const cart = useCartStore.getState()
    if (cart.items.length > 0 && cart.restaurantId && cart.restaurantId !== effectiveRestaurantId) {
      setPendingItem(item) // ask before switching restaurants
      return
    }
    addAndToast(item)
  }

  const confirmSwitch = () => {
    const item = pendingItem
    setPendingItem(null)
    clearCart()
    if (item) addAndToast(item)
  }

  if (restaurantsLoading) {
    return <LoadingState label="Loading restaurants…" />
  }

  if (restaurantsError) {
    return (
      <ErrorState
        message={
          restaurantsErrorObj?.response?.data?.message ||
          restaurantsErrorObj?.message ||
          'Could not load restaurants.'
        }
        onRetry={refetchRestaurants}
      />
    )
  }

  if (!restaurants || restaurants.length === 0) {
    return <EmptyState title="No restaurants available right now" description="Check back later." />
  }

  if (restaurants.length > 1 && !restaurantParam) {
    return (
      <PropertyPicker
        kind="restaurant"
        heading="Choose a restaurant"
        properties={restaurants}
        buildLink={(r) => `/shop/menu?restaurantId=${r.id}`}
      />
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4 mb-6">
        {restaurants.length > 1 && (
          <div className="w-64">
            <Label htmlFor="restaurant-select">Restaurant</Label>
            <Select value={effectiveRestaurantId || undefined} onValueChange={setRestaurant}>
              <SelectTrigger id="restaurant-select">
                <SelectValue placeholder="Select a restaurant" />
              </SelectTrigger>
              <SelectContent>
                {restaurants.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="w-64">
          <Label htmlFor="category-select">Category</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter} disabled={categoriesLoading}>
            <SelectTrigger id="category-select">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {[...(categories || [])]
                .sort((a, b) => a.display_order - b.display_order)
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {itemsLoading ? (
        <LoadingState label="Loading menu…" />
      ) : itemsError ? (
        <ErrorState
          message={itemsErrorObj?.response?.data?.message || itemsErrorObj?.message || 'Could not load the menu.'}
          onRetry={refetchItems}
        />
      ) : visibleItems.length === 0 ? (
        <EmptyState title="No items in this category" description="Try a different category, or view all items." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleItems.map((item) => (
            <MenuItemCard key={item.id} item={item} currency={currency} onAdd={handleAdd} />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingItem)}
        onClose={() => setPendingItem(null)}
        onConfirm={confirmSwitch}
        title="Switch restaurant?"
        description="Your cart has items from another restaurant. A delivery order can only come from one restaurant, so adding this will clear your current cart."
        confirmLabel="Clear cart and add"
        variant="destructive"
      />
    </div>
  )
}