import ConfirmDialog from '@/components/ui/ConfirmDialog'

// POST /hotel/checkin/{booking_id} takes no request body — this is a
// plain confirm, not a form. `booking` is the row being checked in;
// `onConfirm` is provided by the caller (BookingsList.jsx) already bound
// to the mutation.
export default function CheckInModal({ booking, onClose, onConfirm, loading }) {
  return (
    <ConfirmDialog
      open={Boolean(booking)}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Check in this guest?"
      description={
        booking
          ? `Room ${booking.roomNumber || booking.room_id} will be marked checked-in for this booking.`
          : undefined
      }
      confirmLabel="Check In"
      variant="default"
      loading={loading}
    />
  )
}