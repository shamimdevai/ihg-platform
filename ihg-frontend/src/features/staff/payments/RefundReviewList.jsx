import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import Table from '@/components/ui/Table'
import StatusBadge from '@/components/ui/StatusBadge'
import { usePermission } from '@/hooks/usePermission'
import * as paymentsRefundAdminApi from '@/api/staff/paymentsRefundAdminApi'
import * as iamStaffApi from '@/api/staff/iamStaffApi'
import RefundActionModal from './RefundActionModal'

// RefundRequest.status has no `enum` block in this phase's OpenAPI
// slice either (example payload shows only "pending"), but unlike
// Payment.status there are exactly two real review actions this
// resource can go through — approve and reject — which strongly
// implies exactly these three states. Proceeding with pending/approved/
// rejected as INFERRED (not schema-confirmed) per user instruction —
// used for both the badge (StatusBadge falls back gracefully for
// anything else) and the filter dropdown below.
const refundStatusMap = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
}

function shortId(id) {
  return id ? <span title={id}>{id.slice(0, 8)}…</span> : '—'
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

export default function RefundReviewList() {
  const canReview = usePermission('payments:refund:review')
  const canReadStaff = usePermission('iam:staff:read')
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('all')
  const [reviewing, setReviewing] = useState(null) // { request, action: 'approve' | 'reject' }

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['payments', 'refund-requests', statusFilter],
    queryFn: () =>
      paymentsRefundAdminApi.listRefundRequests(statusFilter === 'all' ? undefined : statusFilter),
  })

  // Intra-domain join, gated separately — degrades to raw UUIDs if the
  // caller doesn't hold iam:staff:read, same pattern AlertsList/
  // ItemsList used in Phase 11 rather than assuming every caller of
  // this screen also holds every other domain's read code.
  const { data: staff } = useQuery({
    queryKey: ['iam', 'staff'],
    queryFn: iamStaffApi.listStaff,
    enabled: canReadStaff,
  })
  const staffById = new Map((staff || []).map((s) => [s.id, s]))
  const staffLabel = (id) => {
    if (!id) return '—'
    const s = staffById.get(id)
    return s ? `${s.first_name} ${s.last_name}` : shortId(id)
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['payments', 'refund-requests'] })

  const columns = [
    { key: 'payment_id', header: 'Payment', render: (row) => shortId(row.payment_id) },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} colorMap={refundStatusMap} />,
    },
    { key: 'reason', header: 'Requested Reason', render: (row) => row.reason || '—' },
    { key: 'requested_by', header: 'Requested By', render: (row) => staffLabel(row.requested_by_staff_id) },
    { key: 'reviewed_by', header: 'Reviewed By', render: (row) => staffLabel(row.reviewed_by_staff_id) },
    { key: 'review_reason', header: 'Review Note', render: (row) => row.review_reason || '—' },
    { key: 'reviewed_at', header: 'Reviewed', render: (row) => formatDateTime(row.reviewed_at) },
    { key: 'created_at', header: 'Requested', render: (row) => formatDateTime(row.created_at) },
    ...(canReview
      ? [
          {
            key: 'actions',
            header: '',
            render: (row) =>
              // Hidden once reviewed — gated on the real reviewed_at
              // field, not the inferred status string, same structural
              // pattern as Phase 11's resolved_at-based gating.
              !row.reviewed_at && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setReviewing({ request: row, action: 'approve' })}>
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setReviewing({ request: row, action: 'reject' })}
                  >
                    Reject
                  </Button>
                </div>
              ),
          },
        ]
      : []),
  ]

  return (
    <div>
      <div className="flex items-end gap-2 mb-4 max-w-xs">
        <div className="space-y-1 flex-1">
          <Label htmlFor="refund-status-filter">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger id="refund-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Table
        columns={columns}
        data={data}
        loading={isLoading}
        error={isError ? error?.response?.data?.message || error?.message : null}
        onRetry={refetch}
        emptyTitle="No refund requests found"
      />

      {canReview && (
        <RefundActionModal
          open={Boolean(reviewing)}
          onClose={() => setReviewing(null)}
          request={reviewing?.request}
          action={reviewing?.action}
          onDone={() => {
            invalidate()
            setReviewing(null)
          }}
        />
      )}
    </div>
  )
}