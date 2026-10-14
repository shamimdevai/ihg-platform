import * as React from 'react'
import * as NavigationMenuPrimitive from '@radix-ui/react-navigation-menu'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Styled wrapper around @radix-ui/react-navigation-menu.
 *
 * DELIBERATELY does NOT render NavigationMenuPrimitive.Viewport. Radix's
 * "shared viewport" pattern renders every trigger's content inside ONE
 * panel anchored to a single fixed point (typically the left edge of
 * the whole bar), crossfading between different triggers' content — a
 * valid mega-menu style, but not what was wanted here: each section's
 * dropdown must open directly under THAT section's own trigger.
 *
 * Without a Viewport, Radix renders each Content in place as a normal
 * child of its own Item — so positioning it is just plain CSS:
 * `relative` on the Item, `absolute top-full` on the Content. Trade-off:
 * loses Radix's built-in width/height "morph" transition between two
 * open menus; gains menus that always open where you're actually
 * pointing.
 */
const NavigationMenu = React.forwardRef(({ className, children, onValueChange, ...props }, ref) => {
  // Tracks whether ANY dropdown is currently open, purely to decide
  // whether horizontal overflow-clipping is safe right now. Uncontrolled
  // from the caller's side (Navbar.jsx passes no `value`/`onValueChange`
  // today) — this just listens in, it doesn't take over open/close
  // behavior.
  const [openValue, setOpenValue] = React.useState('')

  return (
    <NavigationMenuPrimitive.Root
      ref={ref}
      onValueChange={(v) => {
        setOpenValue(v)
        onValueChange?.(v)
      }}
      className={cn(
        'relative z-40 flex w-full min-w-0 items-center',
        // Clip horizontal overflow ONLY while nothing is open. This is
        // what actually stops the row from bleeding into the right-side
        // "Admin User / Log out" area (the reported bug — a steady-state
        // overlap while closed, not just a resize-drag artifact). It's
        // switched OFF the instant a dropdown opens, because Content
        // renders as a normal DOM child positioned via its own Item's
        // `relative` (no portal) — an overflow-hidden ancestor would
        // otherwise clip the open dropdown panel itself.
        !openValue && 'overflow-hidden',
        className
      )}
      {...props}
    >
      {children}
    </NavigationMenuPrimitive.Root>
  )
})
NavigationMenu.displayName = NavigationMenuPrimitive.Root.displayName

const NavigationMenuList = React.forwardRef(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.List
    ref={ref}
    // min-w-0 is the actual fix: without it, this flex item's default
    // `min-width: auto` refuses to shrink below its own content's
    // natural width, regardless of how correctly `containerRef` above
    // it was measured and shrunk.
    className={cn('flex min-w-0 flex-nowrap list-none items-center gap-1', className)}
    {...props}
  />
))
NavigationMenuList.displayName = NavigationMenuPrimitive.List.displayName

// `relative` is the actual fix for the "fixed point" bug — this makes
// THIS item the positioning anchor for its own dropdown content below.
const NavigationMenuItem = React.forwardRef(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Item ref={ref} className={cn('relative', className)} {...props} />
))
NavigationMenuItem.displayName = NavigationMenuPrimitive.Item.displayName

const NavigationMenuTrigger = React.forwardRef(({ className, children, active, ...props }, ref) => (
  <NavigationMenuPrimitive.Trigger
    ref={ref}
    className={cn(
      'group inline-flex h-9 w-max shrink-0 items-center justify-center whitespace-nowrap rounded-md bg-transparent px-3 py-2 text-sm font-medium transition-colors focus:outline-none',
      // `active` (a child route is the current page) forces the same
      // solid bg-primary look Radix's own data-[state=open] gives it —
      // so the trigger stays highlighted after the dropdown closes,
      // matching how single-item groups (e.g. "Reports") already
      // behave via NavLink's real isActive.
      active
        ? 'bg-primary text-primary-foreground hover:bg-primary'
        : 'text-muted-foreground hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary data-[state=open]:bg-primary data-[state=open]:text-primary-foreground',
      className
    )}
    {...props}
  >
    {children}
    <ChevronDown
      className="relative top-px ml-1 h-3 w-3 transition duration-200 group-data-[state=open]:rotate-180"
      aria-hidden="true"
    />
  </NavigationMenuPrimitive.Trigger>
))
NavigationMenuTrigger.displayName = NavigationMenuPrimitive.Trigger.displayName

// `align="right"` is used for the rightmost trigger(s) — e.g. the
// "More" menu — so a wide panel opens leftward from the trigger's right
// edge instead of potentially running off the viewport's right side.
const NavigationMenuContent = React.forwardRef(({ className, align = 'left', ...props }, ref) => (
  <NavigationMenuPrimitive.Content
    ref={ref}
    className={cn(
      'absolute top-full z-40 mt-2 min-w-[220px] max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border border-border bg-white p-0 shadow-xl',
      'data-[motion^=from-]:animate-in data-[motion^=to-]:animate-out data-[motion^=from-]:fade-in data-[motion^=to-]:fade-out data-[motion^=from-]:zoom-in-95 data-[motion^=to-]:zoom-out-95',
      align === 'right' ? 'right-0' : 'left-0',
      className
    )}
    {...props}
  >
    {/* Colored accent strip — was the plain flat white panel you saw;
        this ties the dropdown back to the brand's primary color
        (already resolving to navy correctly, per the active-state
        triggers in your screenshot). */}
    <div className="h-1 w-full bg-primary" />
    <div className="p-1.5">{props.children}</div>
  </NavigationMenuPrimitive.Content>
))
NavigationMenuContent.displayName = NavigationMenuPrimitive.Content.displayName

const NavigationMenuLink = NavigationMenuPrimitive.Link

export {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
}