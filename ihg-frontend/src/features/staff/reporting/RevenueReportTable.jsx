import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/Select'
import Table from '@/components/ui/Table'
import { useAppConfig } from '@/hooks/useAppConfig'
import * as reportingApi from '@/api/staff/reportingApi'
import ExcelExportButton from './ExcelExportButton'

// Real values, confirmed from the endpoint's own query-param description
// ("One of: hotel, restaurant, delivery.") — not inferred.
const DOMAINS = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'delivery', label: 'Delivery' },
]

function formatCurrency(amount, currency) {
  if (amount == null) return '—'
  return `${Number(amount).toFixed(2)}${currency ? ` ${currency}` : ''}`
}

export default function RevenueReportTable() {
  const { data: appConfig, isModuleEnabled } = useAppConfig()
  const currency = appConfig?.currency

  // Default to the first enabled domain rather than always "hotel" — a
  // deployment with hotel disabled shouldn't land on an empty/404'ing
  // domain by default. Falls back to "hotel" if every module toggle is
  // absent (pre-seed window, per appConfigStore's default-enabled rule).
  const defaultDomain = DOMAINS.find((d) => isModuleEnabled(d.value))?.value || 'hotel'

  const [domain, setDomain] = useState(defaultDomain)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [applied, setApplied] = useState({
    domain: defaultDomain,
    dateFrom: undefined,
    dateTo: undefined,
  })

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reporting', 'revenue', applied],
    queryFn: () => reportingApi.getRevenueReport(applied),
  })

  const applyFilter = (e) => {
    e.preventDefault()
    setApplied({ domain, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined })
  }

  const clearDates = () => {
    setDateFrom('')
    setDateTo('')
    setApplied((prev) => ({ ...prev, dateFrom: undefined, dateTo: undefined }))
  }

  // headers/rows are parallel arrays, not field-keyed objects (confirmed
  // from the real response shape) — build Table's columns/data positionally
  // rather than assuming any specific field name.
  const columns = (data?.headers || []).map((header, i) => ({
    key: `col-${i}`,
    header,
    render: (row) => row.values[i] ?? '—',
  }))

  const tableData = (data?.rows || []).map((row, i) => ({
    id: i,
    values: Array.isArray(row) ? row : [row],
  }))

  return (
    <div>
      <form onSubmit={applyFilter} className="flex items-end gap-2 mb-6 flex-wrap">
        <div className="space-y-1">
          <Label htmlFor="revenue-domain">Domain</Label>
          <Select value={domain} onValueChange={setDomain}>
            <SelectTrigger id="revenue-domain" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOMAINS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="revenue-date-from">From</Label>
          <Input
            id="revenue-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="revenue-date-to">To</Label>
          <Input
            id="revenue-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-40"
          />
        </div>
        <Button type="submit">Apply</Button>
        {(dateFrom || dateTo) && (
          <Button type="button" variant="outline" onClick={clearDates}>
            Clear dates
          </Button>
        )}
        <div className="ml-auto">
          <ExcelExportButton domain={applied.domain} dateFrom={applied.dateFrom} dateTo={applied.dateTo} />
        </div>
      </form>

      {isError && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
          <span>{error?.response?.data?.message || error?.message || 'Failed to load the revenue report.'}</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {data && (
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <p className="text-sm text-muted-foreground">
            Showing {data.date_from} – {data.date_to} · {data.row_count} row{data.row_count === 1 ? '' : 's'}
          </p>
          <p className="text-sm font-semibold">
            Total: {formatCurrency(data.total_amount, currency)}
          </p>
        </div>
      )}

      <Table
        columns={columns}
        data={tableData}
        loading={isLoading}
        error={isError ? null : undefined}
        emptyTitle="No revenue records for this domain and date range"
      />
    </div>
  )
}