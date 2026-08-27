import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * For Bucket B's four flagged, genuinely-ambiguous gaps (hotel
 * self-booking, customer table reservation, restaurant payment
 * processing, in-app alerts) — NEVER for a feature that's simply
 * unbuilt yet. Dismissible, clearly labeled "pending backend support".
 */
export default function PendingFeatureBanner({ children, className }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800',
        className
      )}
      role="status"
    >
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="flex-1">{children}</div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-amber-700 hover:text-amber-900"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}