import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Download } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import * as reportingApi from '@/api/staff/reportingApi'

// Real download from GET /reporting/reports/revenue/export — a binary
// XLSX stream, not a client-generated fake export (RBAC_MATRIX §6.9).
// Download-trigger pattern matches hotelApi.getInvoicePdf() /
// InvoiceDetail.jsx's handleDownload() exactly: createObjectURL + a
// throwaway <a download> click, no third-party file-saver dependency.
export default function ExcelExportButton({ domain, dateFrom, dateTo }) {
  const [downloading, setDownloading] = useState(false)
  const { toast } = useToast()

  const handleExport = async () => {
    setDownloading(true)
    try {
      const blob = await reportingApi.exportRevenueReport({ domain, dateFrom, dateTo })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const rangePart = dateFrom || dateTo ? `_${dateFrom || 'start'}_${dateTo || 'end'}` : ''
      link.download = `revenue_${domain}${rangePart}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      toast({
        title: 'Could not export revenue report',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Button type="button" variant="outline" onClick={handleExport} loading={downloading}>
      {!downloading && <Download className="mr-2 h-4 w-4" />}
      Export to Excel
    </Button>
  )
}