import staffClient from '../staffClient'

// reporting — single resource, single permission code (reporting:read,
// RBAC_MATRIX v7 §4.11/§6.9).
//
// date_from/date_to are both optional per the given OpenAPI slice
// (nullable query params) — omit either to let the backend apply its
// own default range.

export async function getDashboard({ dateFrom, dateTo } = {}) {
  const params = {}
  if (dateFrom) params.date_from = dateFrom
  if (dateTo) params.date_to = dateTo
  const res = await staffClient.get('/reporting/dashboard', { params })
  return res.data.data
}

// ---- Revenue report — Phase 24 -------------------------------------------
// GET /reporting/reports/revenue. `domain` is REQUIRED (one of
// hotel/restaurant/delivery, per the OpenAPI slice) — unlike the dashboard,
// this endpoint has no "all domains" mode. date_from/date_to stay optional.
// Response IS wrapped in the standard {success,message,data} envelope; data
// shape is { domain, date_from, date_to, headers: string[], rows: array[],
// row_count, total_amount } — headers/rows are parallel (each row is an
// array of values in the same order as headers), not objects, so the table
// component maps them positionally rather than by field name.

export async function getRevenueReport({ domain, dateFrom, dateTo }) {
  const params = { domain }
  if (dateFrom) params.date_from = dateFrom
  if (dateTo) params.date_to = dateTo
  const res = await staffClient.get('/reporting/reports/revenue', { params })
  return res.data.data
}

// GET /reporting/reports/revenue/export — binary XLSX stream, NOT the
// {success,message,data} envelope (RBAC_MATRIX §6.9, same precedent as
// hotel's invoice PDF endpoint, hotelApi.getInvoicePdf()). Requested as a
// blob; caller triggers the browser download, same pattern as
// InvoiceDetail.jsx's handleDownload().
export async function exportRevenueReport({ domain, dateFrom, dateTo }) {
  const params = { domain }
  if (dateFrom) params.date_from = dateFrom
  if (dateTo) params.date_to = dateTo
  const res = await staffClient.get('/reporting/reports/revenue/export', {
    params,
    responseType: 'blob',
  })
  return res.data
}