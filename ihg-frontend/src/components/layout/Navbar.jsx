import { cn } from '@/lib/utils'

/**
 * Generic top bar — takes logoUrl/companyName (from useAppConfig) and a
 * `right` slot for auth-specific content (user menu, logout, etc.), kept
 * out of this component so it stays domain-agnostic.
 */
export default function Navbar({ logoUrl, companyName, right, className }) {
  return (
    <header className={cn('h-14 flex items-center justify-between px-4 border-b bg-background', className)}>
      <div className="flex items-center gap-2">
        {logoUrl && <img src={logoUrl} alt={companyName || 'Logo'} className="h-8 w-8" />}
        <span className="font-semibold text-primary">{companyName}</span>
      </div>
      <div>{right}</div>
    </header>
  )
}