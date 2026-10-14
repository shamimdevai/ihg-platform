import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Table from '@/components/ui/Table'
import StatusBadge from '@/components/ui/StatusBadge'
import { useToast } from '@/components/ui/ToastProvider'
import { usePermission } from '@/hooks/usePermission'
import { useAppConfig } from '@/hooks/useAppConfig'
import * as hotelApi from '@/api/staff/hotelApi'
import InvoiceDetail from './InvoiceDetail'

// Invoice.status has NO confirmed enum in this phase's OpenAPI slice —
// the example payload shows only "draft", no `enum` block. Inferred,
// non-exhaustive colorMap (draft/issued/paid/cancelled) via StatusBadge's
// graceful fallback — same treatment every unconfirmed status field in
// this codebase has gotten since Phase 11's alert status. Not a locked
// list until the backend owner confirms real values.
const invoiceStatusMap = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  issued: { label: 'Issued', className: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Paid', className: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
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

export default function InvoiceList() {
  const canWrite = usePermission('hotel:invoice:write')
  const { toast } = useToast()
  const { data: config } = useAppConfig()
  const queryClient = useQueryClient()

  const [status, setStatus] = useState('')
  const [viewingInvoiceId, setViewingInvoiceId] = useState(null)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [downloadingId, setDownloadingId] = useState(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['hotel', 'invoices', { status }],
    queryFn: () => hotelApi.listInvoices({ status: status || undefined }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['hotel', 'invoices'] })

  const generateMutation = useMutation({
    mutationFn: hotelApi.generateInvoice,
    onSuccess: (invoice) => {
      toast({ title: 'Invoice generated', variant: 'success' })
      invalidate()
      setGenerateOpen(false)
      setViewingInvoiceId(invoice.id)
    },
    onError: (err) =>
      toast({
        title: 'Could not generate invoice',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const handleDownload = async (invoice) => {
    setDownloadingId(invoice.id)
    try {
      const blob = await hotelApi.getInvoicePdf(invoice.id)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${invoice.invoice_number || invoice.id}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      toast({
        title: 'Could not download invoice PDF',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      })
    } finally {
      setDownloadingId(null)
    }
  }

  const columns = [
    { key: 'invoice_number', header: 'Invoice #', render: (row) => row.invoice_number || '—' },
    { key: 'booking_id', header: 'Booking', render: (row) => shortId(row.booking_id) },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} colorMap={invoiceStatusMap} />,
    },
    {
      key: 'total_amount',
      header: 'Total',
      render: (row) => formatAmount(row.total_amount, row.currency || config?.currency),
    },
    {
      key: 'payment_id',
      header: 'Payment',
      render: (row) => (row.payment_id ? shortId(row.payment_id) : <span className="text-muted-foreground">Unpaid</span>),
    },
    { key: 'issued_at', header: 'Issued', render: (row) => formatDateTime(row.issued_at) },
    { key: 'created_at', header: 'Created', render: (row) => formatDateTime(row.created_at) },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setViewingInvoiceId(row.id)}>
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            loading={downloadingId === row.id}
            onClick={() => handleDownload(row)}
          >
            PDF
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-end justify-between gap-2 mb-4 flex-wrap">
        <div className="space-y-1">
          <Label htmlFor="invoice-status-filter">Status</Label>
          <Input
            id="invoice-status-filter"
            placeholder="e.g. draft, issued, paid"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-56"
          />
        </div>
        {canWrite && <Button onClick={() => setGenerateOpen(true)}>Generate Invoice</Button>}
      </div>

      <Table
        columns={columns}
        data={data}
        loading={isLoading}
        error={isError ? error?.response?.data?.message || error?.message : null}
        onRetry={refetch}
        emptyTitle="No invoices found"
      />

      <InvoiceDetail
        invoiceId={viewingInvoiceId}
        open={Boolean(viewingInvoiceId)}
        onClose={() => setViewingInvoiceId(null)}
        onChanged={invalidate}
      />

      {canWrite && (
        <GenerateInvoiceForm
          open={generateOpen}
          onClose={() => setGenerateOpen(false)}
          onSubmit={(bookingId) => generateMutation.mutate(bookingId)}
          loading={generateMutation.isPending}
        />
      )}
    </div>
  )
}

// Ahead-of-deliverable addition (same precedent as Phase 13's RoomsPage
// hotel selector/create form) — not named as its own file in this
// phase's DELIVERABLE list, but POST /hotel/invoices/generate/{booking_id}
// is a real, in-scope endpoint, and CheckOutModal.jsx (Phase 14) already
// forward-referenced this exact call as "a separate step, available once
// invoicing is built (Phase 16)". No booking-browsing UI exists inside
// this screen to pick a checked-out booking from, so this is a plain
// booking-ID text input, not a booking picker — flagged, not silently
// built as something fancier than the given slice supports.
const generateSchema = z.object({
  bookingId: z.string().uuid('Enter a valid booking ID (UUID)'),
})

function GenerateInvoiceForm({ open, onClose, onSubmit, loading }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(generateSchema), defaultValues: { bookingId: '' } })

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Generate Invoice"
      description="Enter the booking this invoice is for. Typically used after check-out — check-out itself does not generate an invoice automatically."
    >
      <form
        onSubmit={handleSubmit((values) => onSubmit(values.bookingId))}
        className="space-y-4"
        noValidate
      >
        <div className="space-y-1">
          <Label htmlFor="generate-booking-id">Booking ID</Label>
          <Input id="generate-booking-id" placeholder="UUID" {...register('bookingId')} />
          {errors.bookingId && <p className="text-sm text-destructive">{errors.bookingId.message}</p>}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Generate
          </Button>
        </div>
      </form>
    </Modal>
  )
}