import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Mobile-only nav drawer. Since the navbar redesign, desktop (`md` and
 * above) navigation lives entirely in Navbar.jsx's horizontal mega-menu —
 * this component no longer renders an in-flow desktop column at all
 * (previously it did, as a static `md:w-56` sidebar; that variant is
 * retired). Below `md`, it's a slide-in drawer with collapsible/
 * accordion sections, mirroring the desktop mega-menu's own grouping —
 * tap a section to expand its items, rather than one long flat list.
 *
 * `groups` — same shape Navbar.jsx consumes, built once in
 * StaffLayout.jsx and passed to both:
 *   [{ key, label, items: [{ key, to, label }] }]
 * Contains no permission/module knowledge of its own.
 *
 * A group with exactly one item renders as a direct link with no
 * expand/collapse affordance, same treatment as Navbar.jsx gives it.
 */
export default function Sidebar({ groups = [], className, mobileOpen = false, onClose }) {
  // Which section keys are currently expanded. Starts empty — nothing
  // auto-opens; the person taps a section to reveal its items.
  const [openKeys, setOpenKeys] = useState(() => new Set())

  const toggleGroup = (key) => {
    setOpenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <nav
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] transform overflow-y-auto border-r bg-background p-2 transition-transform duration-200 ease-in-out md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          className
        )}
      >
        <div className="flex items-center justify-between px-1 pb-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Menu
          </span>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-0.5">
          {groups.map((group) =>
            group.items.length === 1 ? (
              <NavLink
                key={group.key}
                to={group.items[0].to}
                end={group.items[0].to === '/admin'}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )
                }
              >
                {group.items[0].label}
              </NavLink>
            ) : (
              <div key={group.key}>
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                  aria-expanded={openKeys.has(group.key)}
                >
                  {group.label}
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150',
                      openKeys.has(group.key) && 'rotate-180'
                    )}
                  />
                </button>
                {openKeys.has(group.key) && (
                  <div className="ml-2 space-y-0.5 border-l pl-2 py-0.5">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.key}
                        to={item.to}
                        onClick={onClose}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                          )
                        }
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </nav>
    </>
  )
}