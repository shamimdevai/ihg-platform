import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import { useAppConfig } from '@/hooks/useAppConfig'
import * as reportingApi from '@/api/staff/reportingApi'
import DashboardWidgetCard from '@/components/charts/DashboardWidgetCard'
import RevenueChart from '@/components/charts/RevenueChart'

// Field names confirmed directly from app/domains/reporting/services/
// dashboard_service.py (the OpenAPI schema itself types these as plain
// `dict`, so this mapping is NOT derivable from the spec alone — see
// docs/PROGRESS.md "Notes for next session" for this phase's entry).
const MODULE_CONFIG = [
  {
    key: 'hotel',
    label: 'Hotel',
    metrics: [
      { field: 'bookings_count', label: 'Bookings' },
      { field: 'cancelled_bookings_count', label: 'Cancelled' },
      { field: 'paid_invoices_count', label: 'Paid Invoices' },
    ],
  },
  {
    key: 'restaurant',
    label: 'Restaurant',
    metrics: [
      { field: 'orders_count', label: 'Orders' },
      { field: 'cancelled_orders_count', label: 'Cancelled' },
      { field: 'billed_orders_count', label: 'Billed' },
    ],
  },
  {
    key: 'delivery',
    label: 'Delivery',
    metrics: [
      { field: 'orders_count', label: 'Orders' },
      { field: 'cancelled_orders_count', label: 'Cancelled' },
      { field: 'delivered_orders_count', label: 'Delivered' },
    ],
  },
]

function formatCurrency(amount, currency) {
  if (amount == null) return '—'
  return `${Number(amount).toFixed(2)}${currency ? ` ${currency}` : ''}`
}

export default function DashboardWidgets() {
  const { data: appConfig, isModuleEnabled } = useAppConfig()
  const currency = appConfig?.currency

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [appliedRange, setAppliedRange] = useState({ dateFrom: undefined, dateTo: undefined })

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reporting', 'dashboard', appliedRange],
    queryFn: () => reportingApi.getDashboard(appliedRange),
  })

  const applyFilter = (e) => {
    e.preventDefault()
    setAppliedRange({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined })
  }

  const clearFilter = () => {
    setDateFrom('')
    setDateTo('')
    setAppliedRange({ dateFrom: undefined, dateTo: undefined })
  }

  // Option A (confirmed this session): a currently-disabled module gets
  // no breakdown widget or chart bar at all. total_revenue is shown
  // as-is from the backend regardless — dashboard_service.py deliberately
  // does NOT apply module toggles to that figure (RBAC_MATRIX §4.11) —
  // so it may silently include a disabled module's historical revenue.
  // A hint is shown on that card, but only when a module is actually
  // disabled, to avoid noise on a fully-enabled deployment.
  const enabledModules = MODULE_CONFIG.filter((m) => isModuleEnabled(m.key))
  const anyModuleDisabled = MODULE_CONFIG.some((m) => !isModuleEnabled(m.key))

  const chartData = data
    ? enabledModules.map((m) => ({
        module: m.label,
        revenue: Number(data[m.key]?.revenue ?? 0),
      }))
    : []

  return (
    <div>
      <form onSubmit={applyFilter} className="flex items-end gap-2 mb-6 flex-wrap">
        <div className="space-y-1">
          <Label htmlFor="dashboard-date-from">From</Label>
          <Input
            id="dashboard-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dashboard-date-to">To</Label>
          <Input
            id="dashboard-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-40"
          />
        </div>
        <Button type="submit">Apply</Button>
        {(dateFrom || dateTo) && (
          <Button type="button" variant="outline" onClick={clearFilter}>
            Clear
          </Button>
        )}
      </form>

      {isError && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
          <span>{error?.response?.data?.message || error?.message || 'Failed to load dashboard data.'}</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {data && (
        <p className="text-sm text-muted-foreground mb-4">
          Showing {data.date_from} – {data.date_to}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <DashboardWidgetCard
          label="Total Revenue"
          value={formatCurrency(data?.total_revenue, currency)}
          hint={anyModuleDisabled ? 'May include revenue from a currently disabled module' : undefined}
          loading={isLoading}
        />
        {enabledModules.map((m) => (
          <DashboardWidgetCard
            key={`${m.key}-revenue`}
            label={`${m.label} Revenue`}
            value={formatCurrency(data?.[m.key]?.revenue, currency)}
            loading={isLoading}
          />
        ))}
      </div>

      {enabledModules.map((m) => (
        <div key={m.key} className="mb-8">
          <h3 className="text-sm font-semibold mb-2">{m.label}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {m.metrics.map((metric) => (
              <DashboardWidgetCard
                key={metric.field}
                label={metric.label}
                value={data?.[m.key]?.[metric.field] ?? '—'}
                loading={isLoading}
              />
            ))}
          </div>
        </div>
      ))}

      {enabledModules.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Revenue by Module</h3>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading chart…</p>
          ) : (
            <RevenueChart data={chartData} currency={currency} />
          )}
        </div>
      )}
    </div>
  )
}