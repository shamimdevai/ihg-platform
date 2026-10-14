import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import StatusBadge from '@/components/ui/StatusBadge'
import { usePermission } from '@/hooks/usePermission'
import * as paymentsApi from '@/api/staff/paymentsApi'
import DirectRefundModal from './DirectRefundModal'

// Payment.status has NO confirmed enum in this phase's OpenAPI slice —
// the example payload shows only "succeeded", with no `enum` block the
// way `simulate_outcome` ("paid"/"failed") has one. The four values
// below are a reasonable inference from the surrounding typed fields
// (paid_at, failure_reason, refunded_at) but are NOT schema-confirmed.
// StatusBadge's built-in fallback (colorMap miss → neutral gray,
// verbatim label) means any other real value still renders correctly,
// just unstyled — nothing is hidden or mis-rendered. Logged under
// docs/PROGRESS.md "Notes for next session", same treatment Phase 11
// gave the equally-unconfirmed inventory alert `status` field.
const paymentStatusMap = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700' },
  succeeded: { label: 'Succeeded', className: 'bg-green-100 text-green-700' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-700' },
  refunded: { label: 'Refunded', className: 'bg-purple-100 text-purple-700' },
}

function shortId(id) {
  return id ? <span title={id}>{id.slice(0, 8)}…</span> : '—'
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

function formatAmount(amount, currency) {
  if (amount == null) return '—'
  return `${Number(amount).toFixed(2)}${currency ? ` ${currency}` : ''}`
}

export default function PaymentsList() {
  const canRefundDirect = usePermission('payments:refund:direct')
  const queryClient = useQueryClient()
  const [referenceType, setReferenceType] = useState('')
  const [referenceId, setReferenceId] = useState('')
  const [refunding, setRefunding] = useState(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['payments', 'list', { referenceType, referenceId }],
    queryFn: () =>
      paymentsApi.listPayments({
        reference_type: referenceType || undefined,
        reference_id: referenceId || undefined,
      }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['payments', 'list'] })

  const clearFilters = () => {
    setReferenceType('')
    setReferenceId('')
  }

  const columns = [
    { key: 'reference_type', header: 'Reference Type', render: (row) => row.reference_type || '—' },
    { key: 'reference_id', header: 'Reference ID', render: (row) => shortId(row.reference_id) },
    { key: 'amount', header: 'Amount', render: (row) => formatAmount(row.amount, row.currency) },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} colorMap={paymentStatusMap} />,
    },
    { key: 'method_id', header: 'Method', render: (row) => shortId(row.method_id) },
    { key: 'paid_at', header: 'Paid', render: (row) => formatDateTime(row.paid_at) },
    { key: 'refunded_at', header: 'Refunded', render: (row) => formatDateTime(row.refunded_at) },
    {
      key: 'reasons',
      header: 'Notes',
      render: (row) =>
        row.failure_reason || row.refund_reason ? (
          <span className="text-xs text-muted-foreground">
            {row.failure_reason ? `Failure: ${row.failure_reason}` : ''}
            {row.failure_reason && row.refund_reason ? ' · ' : ''}
            {row.refund_reason ? `Refund: ${row.refund_reason}` : ''}
          </span>
        ) : (
          '—'
        ),
    },
    { key: 'created_at', header: 'Created', render: (row) => formatDateTime(row.created_at) },
    ...(canRefundDirect
      ? [
          {
            key: 'actions',
            header: '',
            render: (row) =>
              !row.refunded_at && (
                <Button variant="destructive" size="sm" onClick={() => setRefunding(row)}>
                  Refund
                </Button>
              ),
          },
        ]
      : []),
  ]

  return (
    <div>
      <div className="flex items-end gap-2 mb-4 flex-wrap">
        <div className="space-y-1">
          <Label htmlFor="reference-type-filter">Reference Type</Label>
          <Input
            id="reference-type-filter"
            placeholder="e.g. hotel_invoice"
            value={referenceType}
            onChange={(e) => setReferenceType(e.target.value)}
            className="w-48"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="reference-id-filter">Reference ID</Label>
          <Input
            id="reference-id-filter"
            placeholder="UUID"
            value={referenceId}
            onChange={(e) => setReferenceId(e.target.value)}
            className="w-64"
          />
        </div>
        {(referenceType || referenceId) && (
          <Button variant="outline" onClick={clearFilters}>
            Clear
          </Button>
        )}
      </div>

      <Table
        columns={columns}
        data={data}
        loading={isLoading}
        error={isError ? error?.response?.data?.message || error?.message : null}
        onRetry={refetch}
        emptyTitle="No payments found"
      />

      {canRefundDirect && (
        <DirectRefundModal
          open={Boolean(refunding)}
          onClose={() => setRefunding(null)}
          payment={refunding}
          onRefunded={() => {
            invalidate()
            setRefunding(null)
          }}
        />
      )}
    </div>
  )
}