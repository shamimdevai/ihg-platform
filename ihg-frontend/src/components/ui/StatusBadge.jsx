import { cn } from '@/lib/utils'

/**
 * Fully generic status pill — takes a status string and a colorMap prop
 * shaped like { [statusValue]: { label, className } }. Callers supply
 * their own per-domain map (see utils/statusBadgeMaps.js, built as each
 * domain's real enum values are confirmed) — this component has zero
 * knowledge of bookings/orders/tickets/etc.
 */
export default function StatusBadge({ status, colorMap = {}, className }) {
  const entry = colorMap[status] || { label: status, className: 'bg-gray-100 text-gray-700' }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        entry.className,
        className
      )}
    >
      {entry.label}
    </span>
  )
}