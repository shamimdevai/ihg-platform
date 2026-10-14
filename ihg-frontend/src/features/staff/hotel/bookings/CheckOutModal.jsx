import ConfirmDialog from '@/components/ui/ConfirmDialog'

// POST /hotel/checkout/{booking_id} takes no request body — this is a
// plain confirm, not a form. CONFIRMED from source: checkout does NOT
// auto-generate an invoice — that's a separate explicit call
// (POST /hotel/invoices/generate/{booking_id}), Phase 16's own scope.
// The note below exists so Reception isn't surprised when no invoice
// appears automatically after checking a guest out.
export default function CheckOutModal({ booking, onClose, onConfirm, loading }) {
  return (
    <ConfirmDialog
      open={Boolean(booking)}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Check out this guest?"
      description={
        booking
          ? `Room ${booking.roomNumber || booking.room_id} will be marked checked-out for this booking. Note: this does not generate an invoice automatically — that's a separate step, available once invoicing is built (Phase 16).`
          : undefined
      }
      confirmLabel="Check Out"
      variant="default"
      loading={loading}
    />
  )
}