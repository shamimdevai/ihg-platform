import { Menu, ChevronDown } from 'lucide-react'
import { NavLink,useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useResponsiveNavGroups } from '@/hooks/useResponsiveNavGroups'
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from '@/components/ui/NavigationMenu'

const itemLinkClass = ({ isActive }) =>
  cn(
    'flex select-none items-center rounded-md px-3 py-2 text-sm font-medium leading-none transition-colors',
    isActive
      ? 'bg-primary text-primary-foreground'
      : 'text-foreground hover:bg-primary/10 hover:text-primary'
  )

const topLinkClass = ({ isActive }) =>
  cn(
    'inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-primary text-primary-foreground'
      : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
  )

// A group with exactly one item is a direct link (no dropdown needed).
// `align` controls which edge the dropdown panel hangs from — "right"
// is used for the last visible group and for "More", so their panels
// never run off the right edge of the viewport.
// A route counts as "active" for a group if it exactly matches an
// item's `to`, or is nested under it (e.g. a detail view pushed under
// a list route) — same prefix rule react-router's own NavLink uses.
function isGroupActive(group, pathname) {
  return group.items.some(
    (item) => pathname === item.to || pathname.startsWith(item.to + '/')
  )
}

function GroupNavItem({ group, align = 'left' }) {
  const { pathname } = useLocation()

  if (group.items.length === 1) {
    return (
      <NavigationMenuItem>
        <NavLink to={group.items[0].to} end={group.items[0].to === '/admin'} className={topLinkClass}>
          {group.items[0].label}
        </NavLink>
      </NavigationMenuItem>
    )
  }
  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger active={isGroupActive(group, pathname)}>{group.label}</NavigationMenuTrigger>
      <NavigationMenuContent align={align}>
        <ul className="grid w-56 gap-0.5">
          {group.items.map((item) => (
            <li key={item.key}>
              <NavigationMenuLink asChild>
                <NavLink to={item.to} className={itemLinkClass}>
                  {item.label}
                </NavLink>
              </NavigationMenuLink>
            </li>
          ))}
        </ul>
      </NavigationMenuContent>
    </NavigationMenuItem>
  )
}

// Hidden mirror of every group's real markup, used only to measure true
// rendered widths (visibility:hidden keeps layout/offsetWidth valid
// while removing it from paint, hit-testing, and tab order).
function MeasureRow({ groups, setMeasureRef, moreRef }) {
  return (
    // w-0 h-0 overflow-hidden on the WRAPPER is the actual fix: it makes
    // this element contribute NOTHING to any ancestor's (ultimately the
    // page's) scrollable overflow area, regardless of how wide its
    // children really are. Each child's own offsetWidth — what
    // recalculate() in useResponsiveNavGroups.js actually reads — is
    // still computed from that child's own layout box and is completely
    // unaffected by an ancestor clipping/zeroing its own size. Only the
    // ancestor's contribution to page-level scrolling changes.
    //
    // The previous version (`invisible absolute left-0 top-0`, no size/
    // overflow constraint) measured correctly but leaked its full,
    // unclipped width into the page's scrollable area — that phantom
    // scrollbar, not a measurement or rendering bug, was the real cause
    // of items appearing to vanish with no working "More" button.
    <div aria-hidden="true" className="invisible absolute left-0 top-0 h-0 w-0 overflow-hidden">
      <div className="flex flex-nowrap items-center gap-1">
        {groups.map((group, i) => (
          <div key={group.key} ref={setMeasureRef(i)} className="shrink-0">
            {group.items.length === 1 ? (
              <span className="inline-flex h-9 items-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium">
                {group.items[0].label}
              </span>
            ) : (
              <span className="inline-flex h-9 items-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium">
                {group.label}
                <ChevronDown className="ml-1 h-3 w-3" />
              </span>
            )}
          </div>
        ))}
        <span ref={moreRef} className="inline-flex h-9 items-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium">
          More
          <ChevronDown className="ml-1 h-3 w-3" />
        </span>
      </div>
    </div>
  )
}

/**
 * Staff portal top bar — primary desktop navigation surface.
 *
 * `groups` — filtered/permission-gated structure from StaffLayout.jsx,
 * shared with Sidebar.jsx's mobile drawer:
 *   [{ key, label, items: [{ key, to, label }] }]
 *
 * Overflow: sections that don't fit the available width collapse into a
 * real "More" dropdown (measured via useResponsiveNavGroups — see that
 * file), rather than wrapping to a second row or scrolling sideways.
 */
export default function Navbar({ logoUrl, companyName, groups = [], right, onMenuClick, className }) {
  const { pathname } = useLocation()
  const { containerRef, moreRef, setMeasureRef, visibleGroups, overflowGroups } =
    useResponsiveNavGroups(groups)

  return (
    <header
      className={cn(
        'sticky top-0 z-50 flex h-14 items-center gap-2 border-b bg-background px-3 sm:px-4',
        className
      )}
    >
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      <div className="flex shrink-0 items-center gap-2 min-w-0">
        {logoUrl && <img src={logoUrl} alt={companyName || 'Logo'} className="h-8 w-8 shrink-0" />}
        <span className="hidden font-semibold text-primary truncate sm:inline">{companyName}</span>
      </div>

      {/* relative: anchors the absolutely-positioned hidden MeasureRow.
          min-w-0: lets this shrink instead of forcing the header wider
          than the viewport (the actual overflow trigger for "More"). */}
      <div ref={containerRef} className="relative hidden md:block flex-1 min-w-0">
        <MeasureRow groups={groups} setMeasureRef={setMeasureRef} moreRef={moreRef} />

        <NavigationMenu>
          <NavigationMenuList>
            {visibleGroups.map((group, i) => (
              <GroupNavItem
                key={group.key}
                group={group}
                align={i === visibleGroups.length - 1 && overflowGroups.length === 0 ? 'right' : 'left'}
              />
            ))}

            {overflowGroups.length > 0 && (
              <NavigationMenuItem>
                <NavigationMenuTrigger active={overflowGroups.some((g) => isGroupActive(g, pathname))}>
                  More
                </NavigationMenuTrigger>
                <NavigationMenuContent align="right">
                  <div className="max-h-[70vh] w-64 overflow-y-auto">
                    {overflowGroups.map((group, gi) => (
                      <div key={group.key} className={gi > 0 ? 'mt-2 border-t pt-2' : ''}>
                        <p className="px-3 pb-0.5 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {group.label}
                        </p>
                        <ul className="grid gap-0.5">
                          {group.items.map((item) => (
                            <li key={item.key}>
                              <NavigationMenuLink asChild>
                                <NavLink to={item.to} className={itemLinkClass}>
                                  {item.label}
                                </NavLink>
                              </NavigationMenuLink>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>
            )}
          </NavigationMenuList>
        </NavigationMenu>
      </div>

      <div className="shrink-0 ml-auto">{right}</div>
    </header>
  )
}