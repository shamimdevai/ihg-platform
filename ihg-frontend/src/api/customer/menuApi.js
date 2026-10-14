import publicClient from '../publicClient'

// Customer-side restaurant/menu browsing.
//
// Backlog item 10, RESOLVED. This file previously called the SAME
// paths staff's restaurantApi.js uses (/restaurant/menu/items,
// /restaurant/menu/categories) — a real, previously-undiscovered bug:
// those routes are staff-only in the real backend (gated by
// require_permission, via get_current_staff_user, which rejects a
// customer token outright). Every call from this file would have
// 401'd. Fixed by adding new, customer-gated endpoints on the backend
// under a /restaurant/customer prefix (see
// app/domains/restaurant/api/customer_menu.py), reusing the same
// service-layer functions the staff routes call — only the auth gate
// differs. This file now points at those new paths.
//
// Also resolved in the same pass: a real customer-facing restaurant
// list now exists (listRestaurants() below) — MenuBrowse.jsx no longer
// needs to derive restaurant_id(s) from fetched menu items and label a
// multi-restaurant deployment's selector by a shortened UUID.

export async function listRestaurants() {
  const res = await publicClient.get('/restaurant/public/restaurants')
  return res.data.data // [{ id, name }]
}

export async function listMenuItems({ restaurantId, categoryId, isAvailable } = {}) {
  const res = await publicClient.get('/restaurant/public/menu/items', {
    params: {
      restaurant_id: restaurantId || undefined,
      category_id: categoryId || undefined,
      is_available: isAvailable === undefined ? undefined : isAvailable,
    },
  })
  return res.data.data // [{ id, restaurant_id, category_id, name, description, price, image_url, is_available, inventory_item_id, inventory_qty_per_unit }]
}

export async function getMenuItem(itemId) {
  const res = await publicClient.get(`/restaurant/public/menu/items/${itemId}`)
  return res.data.data
}

export async function listMenuCategories(restaurantId) {
  // restaurant_id is a REQUIRED query param on this endpoint — only
  // call this once a restaurant_id is known (now sourced from
  // listRestaurants() above, not derived from menu items).
  const res = await publicClient.get('/restaurant/public/menu/categories', {
    params: { restaurant_id: restaurantId },
  })
  return res.data.data // [{ id, restaurant_id, name, display_order, is_active }] — already filtered to is_active server-side
}