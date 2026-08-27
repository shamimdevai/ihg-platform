import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'

// Static placeholder widget layout — NO real API call yet (Phase 23
// wires GET /reporting/dashboard). Per the Phase 5 brief, this phase
// only needs the shell.
const placeholderWidgets = [
  { label: 'Active Bookings', value: '—' },
  { label: "Today's Orders", value: '—' },
  { label: 'Deliveries In Progress', value: '—' },
  { label: 'Revenue (This Month)', value: '—' },
]

export default function DashboardHome() {
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        Live dashboard data will be wired up in a later phase (Reporting).
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {placeholderWidgets.map((w) => (
          <Card key={w.label}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {w.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{w.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}