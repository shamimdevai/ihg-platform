import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'

// Generic stat-card widget, deferred from Phase 4 until real dashboard
// data existed to build it against (Phase 23). Deliberately has zero
// knowledge of hotel/restaurant/delivery/reporting — callers pass a
// label + already-formatted value string, same "dumb presentational
// component, caller does the formatting" convention as StatusBadge.
export default function DashboardWidgetCard({ label, value, hint, loading }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{loading ? '…' : value ?? '—'}</p>
        {hint && !loading && (
          <p className="text-xs text-muted-foreground mt-1">{hint}</p>
        )}
      </CardContent>
    </Card>
  )
}