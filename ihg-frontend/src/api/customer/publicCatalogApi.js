import publicClient from '../publicClient'

// Public (no login) hotel catalog — see backend hotel/api/public_catalog.py.

export async function listHotels() {
  const res = await publicClient.get('/hotel/public/hotels')
  return res.data.data // [{ id, name, address, phone, email }]
}

export async function listRoomTypes(hotelId) {
  const res = await publicClient.get(`/hotel/public/hotels/${hotelId}/room-types`)
  return res.data.data // [{ id, hotel_id, name, description, base_rate, capacity, amenities, image_url }]
}

export async function searchAvailability({ hotelId, checkIn, checkOut, guests }) {
  const res = await publicClient.get('/hotel/public/availability', {
    params: {
      hotel_id: hotelId,
      check_in: checkIn,
      check_out: checkOut,
      guests: guests || undefined,
    },
  })
  // { hotel_id, check_in, check_out, nights, room_types: [{ ...roomType, available_rooms, nights, estimated_total }] }
  return res.data.data
}