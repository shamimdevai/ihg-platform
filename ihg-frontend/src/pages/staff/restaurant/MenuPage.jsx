import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import PageHeader from '@/components/layout/PageHeader'
import { Label } from '@/components/ui/Label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import * as restaurantApi from '@/api/staff/restaurantApi'
import MenuCategoriesList from '@/features/staff/restaurant/menu/MenuCategoriesList'
import MenuItemsList from '@/features/staff/restaurant/menu/MenuItemsList'

// Restaurant selector, SELECTION ONLY (no "Add Restaurant" here) —
// restaurant CRUD already lives on Phase 17's TablesPage.jsx (same
// backend resource, restaurant:table:write-gated there). Duplicating a
// second create form on this page would just be two UIs writing to the
// same /restaurant/restaurants endpoint; reusing the existing list via
// its own query key keeps both screens in sync without extra code.
// Route itself stays gated by restaurant:menu:read (staffRoutes.jsx,
// unchanged from Phase 5) — that's the correct gate for who can REACH
// this page at all, including Waiter. Write controls (Add/Edit
// Category/Item, image upload) are separately hidden+guarded inside
// MenuCategoriesList/MenuItemsList by restaurant:menu:write, which
// Waiter does not hold.
export default function MenuPage() {
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

  // Categories fetched once here (not inside each tab) so MenuItemsList
  // can join category_id → category name and populate its filter/form
  // dropdown without a second fetch — same convention as Phase 17's
  // TablesPage fetching tables once and sharing them with
  // ReservationsList.
  const { data: categories } = useQuery({
    queryKey: ['restaurant', 'menu-categories', selectedRestaurantId],
    queryFn: () => restaurantApi.listMenuCategories(selectedRestaurantId),
    enabled: Boolean(selectedRestaurantId),
  })

  return (
    <div>
      <PageHeader title="Menu Management" description="Manage menu categories and items." />

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
          description="Ask an administrator to set up a restaurant (Tables & Reservations page) before the menu can be managed here."
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
            <Tabs defaultValue="items">
              <TabsList>
                <TabsTrigger value="items">Items</TabsTrigger>
                <TabsTrigger value="categories">Categories</TabsTrigger>
              </TabsList>
              <TabsContent value="items">
                <MenuItemsList restaurantId={selectedRestaurantId} categories={categories || []} />
              </TabsContent>
              <TabsContent value="categories">
                <MenuCategoriesList restaurantId={selectedRestaurantId} />
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  )
}
