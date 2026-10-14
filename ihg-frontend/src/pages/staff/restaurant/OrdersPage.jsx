import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import PageHeader from '@/components/layout/PageHeader'
import { Label } from '@/components/ui/Label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import * as restaurantApi from '@/api/staff/restaurantApi'
import OrdersList from '@/features/staff/restaurant/orders/OrdersList'

// Restaurant selector, SELECTION ONLY (no "Add Restaurant" here) — same
// precedent as Phase 18's MenuPage.jsx: restaurant CRUD already lives on
// Phase 17's TablesPage.jsx against the same /restaurant/restaurants
// endpoint. Query keys for restaurants/tables are shared with
// TablesPage/MenuPage so switching between these screens doesn't
// re-fetch data that's already cached. Route stays gated by
// restaurant:order:read (staffRoutes.jsx, unchanged from Phase 5) — the
// correct gate for who can REACH this page, including Waiter. Write
// controls (New Order, Bill, Cancel) are separately hidden+guarded
// inside OrdersList by restaurant:order:write, which Waiter also holds.
export default function OrdersPage() {
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null)

  const {
    data: restaurants,
    isLoading: restaurantsLoading,
    isError: restaurantsError,
  } = useQuery({
    queryKey: ['restaurant', 'restaurants'],
    queryFn: restaurantApi.listRestaurants,
  })

  useEffect(() => {
    if (!selectedRestaurantId && restaurants && restaurants.length > 0) {
      setSelectedRestaurantId(restaurants[0].id)
    }
  }, [restaurants, selectedRestaurantId])

  // Tables fetched here (not inside OrdersList) so OrderCreate's table
  // dropdown and OrdersList's table filter/labels share one fetch — same
  // convention as Phase 17's TablesPage sharing tables with
  // ReservationsList, and the same query key so the cache is shared with
  // TablesPage if the staff member has that screen open too.
  const { data: tables } = useQuery({
    queryKey: ['restaurant', 'tables', selectedRestaurantId, 'all'],
    queryFn: () => restaurantApi.listTables({ restaurantId: selectedRestaurantId }),
    enabled: Boolean(selectedRestaurantId),
  })

  return (
    <div>
      <PageHeader title="Orders" description="Take and manage dine-in orders." />

      {restaurantsLoading && <LoadingState label="Loading restaurants…" />}

      {restaurantsError && (
        <EmptyState
          title="Couldn't load restaurants"
          description="Something went wrong fetching the restaurant list. Try refreshing the page."
        />
      )}

      {!restaurantsLoading && !restaurantsError && (!restaurants || restaurants.length === 0) && (
        <EmptyState
          title="No restaurants have been set up yet"
          description="Ask an administrator to set up a restaurant (Tables & Reservations page) before orders can be taken here."
        />
      )}

      {!restaurantsLoading && restaurants && restaurants.length > 0 && (
        <>
          <div className="w-72 mb-6">
            <Label htmlFor="restaurant-select">Restaurant</Label>
            <Select value={selectedRestaurantId || undefined} onValueChange={setSelectedRestaurantId}>
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

          {selectedRestaurantId && (
            <OrdersList restaurantId={selectedRestaurantId} tables={tables || []} />
          )}
        </>
      )}
    </div>
  )
}