import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import { Label } from '@/components/ui/Label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { useToast } from '@/components/ui/ToastProvider'
import { usePermission } from '@/hooks/usePermission'
import * as hotelApi from '@/api/staff/hotelApi'
import RoomForm from './RoomForm'

// Real values, taken verbatim from the PUT /rooms/{id}/status request
// schema's description field: "available" | "occupied" | "cleaning" |
// "maintenance" — not inferred.
const ROOM_STATUSES = ['available', 'occupied', 'cleaning', 'maintenance']

const statusColorMap = {
  available: { label: 'Available', className: 'bg-green-100 text-green-700' },
  occupied: { label: 'Occupied', className: 'bg-red-100 text-red-700' },
  cleaning: { label: 'Cleaning', className: 'bg-blue-100 text-blue-700' },
  maintenance: { label: 'Maintenance', className: 'bg-amber-100 text-amber-700' },
}

const activeMap = {
  true: { label: 'Active', className: 'bg-green-100 text-green-700' },
  false: { label: 'Inactive', className: 'bg-gray-200 text-gray-600' },
}

export default function RoomsList({ hotelId, roomTypes = [] }) {
  const canWrite = usePermission('hotel:room:write')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState(null)
  const [statusEditing, setStatusEditing] = useState(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['hotel', 'rooms', hotelId, statusFilter],
    queryFn: () => hotelApi.listRooms({ hotelId, status: statusFilter === 'all' ? undefined : statusFilter }),
    enabled: Boolean(hotelId),
  })

  const invalidateRooms = () => queryClient.invalidateQueries({ queryKey: ['hotel', 'rooms', hotelId] })

  const createMutation = useMutation({
    mutationFn: hotelApi.createRoom,
    onSuccess: () => {
      toast({ title: 'Room created', variant: 'success' })
      invalidateRooms()
      setFormOpen(false)
    },
    onError: (err) =>
      toast({
        title: 'Could not create room',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  // Backlog item 7, RESOLVED — general edit now exists on the backend.
  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => hotelApi.updateRoom(id, values),
    onSuccess: () => {
      toast({ title: 'Room updated', variant: 'success' })
      invalidateRooms()
      setFormOpen(false)
      setEditingRoom(null)
    },
    onError: (err) =>
      toast({
        title: 'Could not update room',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => hotelApi.updateRoomStatus(id, status),
    onSuccess: () => {
      toast({ title: 'Room status updated', variant: 'success' })
      invalidateRooms()
      setStatusEditing(null)
    },
    onError: (err) =>
      toast({
        title: 'Could not update room status',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const roomTypeName = (roomTypeId) => roomTypes.find((rt) => rt.id === roomTypeId)?.name || '—'

  const openCreate = () => {
    setEditingRoom(null)
    setFormOpen(true)
  }

  const openEdit = (room) => {
    setEditingRoom(room)
    setFormOpen(true)
  }

  const handleFormSubmit = (values) => {
    if (editingRoom) {
      updateMutation.mutate({ id: editingRoom.id, values })
    } else {
      createMutation.mutate(values)
    }
  }

  const columns = [
    { key: 'room_number', header: 'Room #' },
    { key: 'floor', header: 'Floor', render: (row) => row.floor || '—' },
    { key: 'room_type_id', header: 'Room Type', render: (row) => roomTypeName(row.room_type_id) },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} colorMap={statusColorMap} />,
    },
    {
      key: 'is_active',
      header: 'Active',
      render: (row) => <StatusBadge status={String(row.is_active)} colorMap={activeMap} />,
    },
    ...(canWrite
      ? [
          {
            key: 'actions',
            header: '',
            render: (row) => (
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => setStatusEditing(row)}>
                  Change Status
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="w-48">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {ROOM_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusColorMap[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canWrite && <Button onClick={openCreate}>Add Room</Button>}
      </div>

      <Table
        columns={columns}
        data={data}
        loading={isLoading}
        error={isError ? error?.response?.data?.message || error?.message : null}
        onRetry={refetch}
        emptyTitle="No rooms yet"
      />

      {canWrite && (
        <RoomForm
          open={formOpen}
          onClose={() => {
            setFormOpen(false)
            setEditingRoom(null)
          }}
          onSubmit={handleFormSubmit}
          loading={createMutation.isPending || updateMutation.isPending}
          hotelId={hotelId}
          roomTypes={roomTypes}
          initialValues={editingRoom}
        />
      )}

      {canWrite && (
        <RoomStatusModal
          room={statusEditing}
          onClose={() => setStatusEditing(null)}
          onSubmit={(status) => statusMutation.mutate({ id: statusEditing.id, status })}
          loading={statusMutation.isPending}
        />
      )}
    </div>
  )
}

function RoomStatusModal({ room, onClose, onSubmit, loading }) {
  const [status, setStatus] = useState('available')

  useEffect(() => {
    if (room) setStatus(room.status)
  }, [room])

  return (
    <Modal open={Boolean(room)} onClose={onClose} title={room ? `Room ${room.room_number} — Status` : ''}>
      <div className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="room-status">New Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="room-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROOM_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusColorMap[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onSubmit(status)} loading={loading}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  )
}