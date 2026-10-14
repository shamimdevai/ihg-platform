import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import StatusBadge from '@/components/ui/StatusBadge'
import Table from '@/components/ui/Table'
import LoadingState from '@/components/ui/LoadingState'
import ErrorState from '@/components/ui/ErrorState'
import { useToast } from '@/components/ui/ToastProvider'
import { usePermission } from '@/hooks/usePermission'
import { useAppConfig } from '@/hooks/useAppConfig'
import * as hotelApi from '@/api/staff/hotelApi'
import PayInvoiceForm from './PayInvoiceForm'

const invoiceStatusMap = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  issued: { label: 'Issued', className: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Paid', className: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

function formatAmount(amount, currency) {
  if (amount == null) return '—'
  return `${Number(amount).toFixed(2)}${currency ? ` ${currency}` : ''}`
}

// Fetches InvoiceDetailRead (list-shape fields + nested `items` array)
// itself, keyed by invoiceId — separate from InvoiceList's own list
// query, since only GET /hotel/invoices/{id} returns line items
// (confirmed from source, RBAC_MATRIX §6.6 slice notes).
export default function InvoiceDetail({ invoiceId, open, onClose, onChanged }) {
  const canWrite = usePermission('hotel:invoice:write')
  const { toast } = useToast()
  const { data: config } = useAppConfig()
  const [payOpen, setPayOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const { data: invoice, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['hotel', 'invoice', invoiceId],
    queryFn: () => hotelApi.getInvoice(invoiceId),
    enabled: open && Boolean(invoiceId),
  })

  const issueMutation = useMutation({
    mutationFn: () => hotelApi.issueInvoice(invoiceId),
    onSuccess: () => {
      toast({ title: 'Invoice issued', variant: 'success' })
      refetch()
      onChanged?.()
    },
    onError: (err) =>
      toast({
        title: 'Could not issue invoice',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const blob = await hotelApi.getInvoicePdf(invoiceId)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${invoice?.invoice_number || invoiceId}.pdf`
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
      setDownloading(false)
    }
  }

  const currency = invoice?.currency || config?.currency

  const itemColumns = [
    { key: 'description', header: 'Description', render: (row) => row.description || '—' },
    { key: 'item_type', header: 'Type', render: (row) => row.item_type || '—' },
    { key: 'quantity', header: 'Qty', render: (row) => row.quantity ?? '—' },
    { key: 'unit_price', header: 'Unit Price', render: (row) => formatAmount(row.unit_price, currency) },
    { key: 'line_total', header: 'Line Total', render: (row) => formatAmount(row.line_total, currency) },
  ]

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={invoice ? `Invoice ${invoice.invoice_number}` : 'Invoice'}
      >
        {isLoading && <LoadingState label="Loading invoice…" />}
        {isError && (
          <ErrorState message={error?.response?.data?.message || error?.message} onRetry={refetch} />
        )}

        {invoice && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Status: </span>
                <StatusBadge status={invoice.status} colorMap={invoiceStatusMap} />
              </div>
              <div>
                <span className="text-muted-foreground">Booking: </span>
                <span title={invoice.booking_id}>{invoice.booking_id?.slice(0, 8)}…</span>
              </div>
              <div>
                <span className="text-muted-foreground">Subtotal: </span>
                {formatAmount(invoice.subtotal, currency)}
              </div>
              <div>
                <span className="text-muted-foreground">Tax: </span>
                {formatAmount(invoice.tax_amount, currency)}
              </div>
              <div>
                <span className="text-muted-foreground">Total: </span>
                <strong>{formatAmount(invoice.total_amount, currency)}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Issued: </span>
                {formatDateTime(invoice.issued_at)}
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Payment: </span>
                {invoice.payment_id ? (
                  <span title={invoice.payment_id}>{invoice.payment_id.slice(0, 8)}… (paid)</span>
                ) : (
                  <span className="text-muted-foreground">Unpaid</span>
                )}
              </div>
              {invoice.notes && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Notes: </span>
                  {invoice.notes}
                </div>
              )}
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Line Items</h4>
              <Table columns={itemColumns} data={invoice.items} emptyTitle="No line items" rowKey="id" />
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button variant="outline" loading={downloading} onClick={handleDownload}>
                Download PDF
              </Button>
              {canWrite && !invoice.issued_at && (
                <Button variant="outline" loading={issueMutation.isPending} onClick={() => issueMutation.mutate()}>
                  Issue Invoice
                </Button>
              )}
              {canWrite && !invoice.payment_id && (
                <Button onClick={() => setPayOpen(true)}>Pay Invoice</Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {canWrite && invoice && (
        <PayInvoiceForm
          open={payOpen}
          onClose={() => setPayOpen(false)}
          invoice={invoice}
          onPaid={() => {
            setPayOpen(false)
            refetch()
            onChanged?.()
          }}
        />
      )}
    </>
  )
}