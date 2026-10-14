import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listHousekeepingTasks,
  updateHousekeepingTaskStatus,
} from '@/api/staff/hotelApi'
import { usePermission } from '@/hooks/usePermission'
import { useStaffAuth } from '@/hooks/useStaffAuth'
import Table from '@/components/ui/Table'
import StatusBadge from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'

// INFERRED, NOT SCHEMA-CONFIRMED — see hotelApi.js's note above this
// component's imports. HousekeepingTask.status has no enum block
// anywhere in this phase's OpenAPI slice, only the single example value
// "pending". These four values are a reasonable domain guess for a
// cleaning-task lifecycle, not a confirmed list — StatusBadge's built-in
// fallback (colorMap miss → neutral gray, verbatim label) means any
// real value this guess missed still renders safely, it just won't get
// a custom color. Tighten this the moment the backend owner confirms
// real values, per this project's standing rule for unconfirmed enums.
const TASK_STATUS_COLORS = {
  pending: { label: 'Pending', className: 'bg-gray-100 text-gray-700' },
  in_progress: { label: 'In Progress', className: 'bg-amber-100 text-amber-800' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
}

// Same inferred set, offered as quick-pick options in the status-update
// modal below. A free-text fallback input is also provided in the modal
// itself, since this list is a guess, not a closed enum — staff aren't
// blocked from setting a value outside this list if the real workflow
// needs one.
const INFERRED_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

function UpdateStatusModal({ task, onClose }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState(task.status || 'pending')
  const [customStatus, setCustomStatus] = useState('')
  const [notes, setNotes] = useState(task.notes || '')
  const [useCustom, setUseCustom] = useState(false)

  const mutation = useMutation({
    mutationFn: () =>
      updateHousekeepingTaskStatus(
        task.id,
        useCustom ? customStatus.trim() : status,
        notes
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['housekeeping-tasks'] })
      onClose()
    },
  })

  const isValid = useCustom ? customStatus.trim().length > 0 : !!status

  return (
    <Modal open onClose={onClose} title="Update Task Status">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Room task: <span className="font-medium">{task.task_type}</span>
        </p>

        {!useCustom ? (
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INFERRED_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              className="text-xs text-blue-600 mt-1 underline"
              onClick={() => setUseCustom(true)}
            >
              Use a different status value
            </button>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-1">
              Status (custom value)
            </label>
            <Input
              value={customStatus}
              onChange={(e) => setCustomStatus(e.target.value)}
              placeholder="e.g. blocked"
            />
            <button
              type="button"
              className="text-xs text-blue-600 mt-1 underline"
              onClick={() => setUseCustom(false)}
            >
              Choose from common statuses instead
            </button>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">
            Notes (optional)
          </label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes about this task"
          />
        </div>

        {mutation.isError && (
          <p className="text-sm text-red-600">
            Could not update the task. Please try again.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!isValid}
            loading={mutation.isPending}
          >
            Save
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default function TaskBoard() {
  const { user } = useStaffAuth()
  const canWrite = usePermission('hotel:housekeeping:write')

  const [showMineOnly, setShowMineOnly] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [roomIdFilter, setRoomIdFilter] = useState('')
  const [editingTask, setEditingTask] = useState(null)

  const { data: tasks = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: [
      'housekeeping-tasks',
      { showMineOnly, statusFilter, roomIdFilter, userId: user?.id },
    ],
    queryFn: () =>
      listHousekeepingTasks({
        roomId: roomIdFilter || undefined,
        status: statusFilter || undefined,
        assignedToStaffId: showMineOnly ? user?.id : undefined,
      }),
  })

  const columns = [
    {
      key: 'room_id',
      header: 'Room',
      // No hotel:room:read grant exists for Housekeeping, so this can't
      // be resolved to a room number/floor client-side — shown as the
      // raw ID, same defensive-degrade treatment Phase 14 used for
      // BookingForm's guest dropdown when customers:guests:read isn't
      // held.
      render: (task) => (
        <span className="font-mono text-xs">{task.room_id}</span>
      ),
    },
    {
      key: 'task_type',
      header: 'Task',
      render: (task) => task.task_type || '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (task) => (
        <StatusBadge status={task.status} colorMap={TASK_STATUS_COLORS} />
      ),
    },
    {
      key: 'notes',
      header: 'Notes',
      render: (task) => task.notes || <span className="text-gray-400">—</span>,
    },
    {
      key: 'completed_at',
      header: 'Completed',
      render: (task) =>
        task.completed_at
          ? new Date(task.completed_at).toLocaleString()
          : <span className="text-gray-400">Not yet</span>,
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (task) => new Date(task.created_at).toLocaleString(),
    },
    ...(canWrite
      ? [
          {
            key: 'actions',
            header: '',
            render: (task) => (
              <Button size="sm" onClick={() => setEditingTask(task)}>
                Update Status
              </Button>
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showMineOnly}
            onChange={(e) => setShowMineOnly(e.target.checked)}
          />
          Show only tasks assigned to me
        </label>

        <div>
          <label className="block text-xs font-medium mb-1">
            Status filter
          </label>
          {/* Free-text, not a dropdown — status has no confirmed enum,
              see the note above TASK_STATUS_COLORS. */}
          <Input
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="e.g. pending"
            className="w-40"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">
            Room ID filter
          </label>
          <Input
            value={roomIdFilter}
            onChange={(e) => setRoomIdFilter(e.target.value)}
            placeholder="Room UUID"
            className="w-64"
          />
        </div>
      </div>

      <Table
        columns={columns}
        data={tasks}
        loading={isLoading}
        error={isError ? (error?.response?.data?.message || error?.message || 'Could not load housekeeping tasks.') : null}
        onRetry={refetch}
        emptyTitle="No tasks found"
      />

      {editingTask && (
        <UpdateStatusModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  )
}