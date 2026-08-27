import { Button } from '@/components/ui/Button'

/**
 * Client-side "load more" over an already-fetched full array — NOT real
 * pagination (list endpoints return plain arrays, no page/cursor params
 * exist yet, per Bucket A). `visibleCount` is owned by the parent.
 */
export default function LoadMore({ totalCount, visibleCount, onLoadMore, step = 20 }) {
  if (visibleCount >= totalCount) return null
  return (
    <div className="flex justify-center py-4">
      <Button variant="outline" onClick={() => onLoadMore(Math.min(visibleCount + step, totalCount))}>
        Load more ({totalCount - visibleCount} remaining)
      </Button>
    </div>
  )
}