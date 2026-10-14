import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/ToastProvider'
import { usePermission } from '@/hooks/usePermission'
import * as iamDepartmentsApi from '@/api/staff/iamDepartmentsApi'
import DepartmentForm from './DepartmentForm'

export default function DepartmentsList() {
  const canWrite = usePermission('iam:departments:write')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['departments'],
    queryFn: iamDepartmentsApi.listDepartments,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['departments'] })

  const createMutation = useMutation({
    mutationFn: iamDepartmentsApi.createDepartment,
    onSuccess: () => {
      toast({ title: 'Department created', variant: 'success' })
      invalidate()
      setFormOpen(false)
    },
    onError: (err) => {
      toast({
        title: 'Could not create department',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => iamDepartmentsApi.updateDepartment(id, values),
    onSuccess: () => {
      toast({ title: 'Department updated', variant: 'success' })
      invalidate()
      setFormOpen(false)
      setEditing(null)
    },
    onError: (err) => {
      toast({
        title: 'Could not update department',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: iamDepartmentsApi.deleteDepartment,
    onSuccess: () => {
      toast({ title: `"${deleteTarget?.name}" was deleted.`, variant: 'success' })
      invalidate()
      setDeleteTarget(null)
    },
    onError: (err) => {
      // The backend's 409 message is specific and actionable ("still
      // assigned to N staff member(s)...") — shown verbatim rather than
      // a generic failure toast, so the person knows exactly what to fix
      // before trying again.
      toast({
        title: 'Could not delete department',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      })
      setDeleteTarget(null)
    },
  })

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (dept) => {
    setEditing(dept)
    setFormOpen(true)
  }

  const handleSubmit = (values) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, values })
    } else {
      createMutation.mutate(values)
    }
  }

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'description', header: 'Description', render: (row) => row.description || '—' },
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
                <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(row)}>
                  Delete
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <div>
      {canWrite && (
        <div className="flex justify-end mb-4">
          <Button onClick={openCreate}>Add Department</Button>
        </div>
      )}
      <Table
        columns={columns}
        data={data}
        loading={isLoading}
        error={isError ? error?.response?.data?.message || error?.message : null}
        onRetry={refetch}
        emptyTitle="No departments yet"
      />
      {canWrite && (
        <DepartmentForm
          open={formOpen}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
          }}
          onSubmit={handleSubmit}
          initialValues={editing}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        title="Delete department?"
        description={
          deleteTarget
            ? `This will delete "${deleteTarget.name}". This can't be undone from this screen. If any staff are currently assigned to it, the deletion will be blocked until they're reassigned.`
            : undefined
        }
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}