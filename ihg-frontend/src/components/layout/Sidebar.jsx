import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

/**
 * Generic, reusable sidebar. Takes nav items as props — contains NO
 * hardcoded routes, permissions, or domain names (per Global Context
 * Prompt). Filtering/gating logic lives in the consuming layout
 * (StaffLayout.jsx), never here.
 *
 * items: [{ key, to, label, icon? } | { key, heading: true, label }]
 *
 * Extended at Phase 5 to support non-interactive heading rows for
 * grouping sections — a generic sidebar capability, not domain-specific,
 * so this stays backward-compatible with Phase 4's "no domain knowledge"
 * contract (a flat items array with no headings still works unchanged).
 */
export default function Sidebar({ items = [], className }) {
  return (
    <nav className={cn('w-56 shrink-0 border-r bg-background p-2 space-y-1', className)}>
      {items.map((item) =>
        item.heading ? (
          <div
            key={item.key}
            className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground first:pt-1"
          >
            {item.label}
          </div>
        ) : (
          <NavLink
            key={item.key}
            to={item.to}
            end={item.to === '/admin'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )
            }
          >
            {item.icon && <item.icon className="h-4 w-4" />}
            {item.label}
          </NavLink>
        )
      )}
    </nav>
  )
}