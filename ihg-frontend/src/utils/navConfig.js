// Maps each staff nav section to its required permission code(s) and
// which enabledModules key (if any) gates the whole section. Pure data —
// no permission-checking logic lives here (that's StaffLayout.jsx's job,
// consistent with Phase 4's "components stay dumb" rule extending to
// config files too: this file has zero React/hook dependencies).
//
// `module`, when set, hides the ENTIRE section if that module is
// disabled — not just individual items (per Global Context Prompt).
// Only hotel/restaurant/delivery are ever module-gated (RBAC_MATRIX §7
// confirms settings/iam/customers/inventory/payments/reporting never are).

export const navConfig = [
  {
    section: 'Overview',
    items: [{ to: '/admin', label: 'Dashboard', permission: null }],
  },
  {
    section: 'Staff & Access',
    items: [
      { to: '/admin/iam/staff', label: 'Staff', permission: 'iam:staff:read' },
      { to: '/admin/iam/roles', label: 'Roles', permission: 'iam:roles:read' },
      { to: '/admin/iam/departments', label: 'Departments', permission: 'iam:departments:read' },
      // Impersonation is NOT permission-gated on the backend at all —
      // hardcoded is_superadmin check (RBAC_MATRIX §1, §7). Mirrored
      // here via requiresSuperadmin rather than a permission code.
      { to: '/admin/iam/impersonation', label: 'Impersonation', requiresSuperadmin: true },
    ],
  },
  {
    section: 'Guests',
    items: [
      { to: '/admin/customers/guests', label: 'Hotel Guests', permission: 'customers:guests:read' },
    ],
  },
  {
    section: 'Hotel',
    module: 'hotel',
    items: [
      { to: '/admin/hotel/rooms', label: 'Rooms', permission: 'hotel:room:read' },
      { to: '/admin/hotel/bookings', label: 'Bookings', permission: 'hotel:booking:read' },
      { to: '/admin/hotel/housekeeping', label: 'Housekeeping', permission: 'hotel:housekeeping:read' },
      { to: '/admin/hotel/invoices', label: 'Invoices', permission: 'hotel:invoice:read' },
    ],
  },
  {
    section: 'Restaurant',
    module: 'restaurant',
    items: [
      { to: '/admin/restaurant/tables', label: 'Tables & Reservations', permission: 'restaurant:table:read' },
      { to: '/admin/restaurant/menu', label: 'Menu', permission: 'restaurant:menu:read' },
      { to: '/admin/restaurant/orders', label: 'Orders', permission: 'restaurant:order:read' },
      { to: '/admin/restaurant/kitchen', label: 'Kitchen', permission: 'restaurant:kitchen:read' },
    ],
  },
  {
    section: 'Delivery',
    module: 'delivery',
    items: [
      // Gated by delivery:rider:write (Admin-only, confirmed RBAC_MATRIX),
      // NOT delivery:order:read — Rider also holds delivery:order:read,
      // which would incorrectly surface this staff-wide screen to them.
      // See Phase 5 flag #3.
      { to: '/admin/delivery/orders', label: 'Orders & Dispatch', permission: 'delivery:rider:write' },
      { to: '/admin/delivery/riders', label: 'Riders', permission: 'delivery:rider:write' },
      // Rider's own screen — gated by the one code only Rider (+Admin) holds.
      { to: '/admin/delivery/my-deliveries', label: 'My Deliveries', permission: 'delivery:order:update_status' },
    ],
  },
  {
    section: 'Inventory',
    items: [
      { to: '/admin/inventory/items', label: 'Items', permission: 'inventory:item:read' },
      { to: '/admin/inventory/suppliers', label: 'Suppliers', permission: 'inventory:supplier:read' },
      { to: '/admin/inventory/stock', label: 'Stock', permission: 'inventory:stock:read' },
      { to: '/admin/inventory/alerts', label: 'Alerts', permission: 'inventory:alert:read' },
    ],
  },
  {
    section: 'Payments',
    items: [
      { to: '/admin/payments', label: 'Payments', permission: 'payments:read' },
      { to: '/admin/payments/refunds', label: 'Refund Review', permission: 'payments:refund:review' },
    ],
  },
  {
    section: 'Reporting',
    items: [
      { to: '/admin/reporting', label: 'Reports', permission: 'reporting:read' },
    ],
  },
  {
    section: 'Settings',
    items: [
      // See Phase 5 flag #1 — gated by settings:read (confirmed granted
      // to Manager too, per RBAC_MATRIX), NOT hardcoded Admin-only
      // despite the Phase 25 brief saying "Admin only". Flagged to user.
      { to: '/admin/settings', label: 'Settings', permission: 'settings:read' },
    ],
  },
]