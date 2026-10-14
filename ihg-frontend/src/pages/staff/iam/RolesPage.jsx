import { useState } from 'react'
import PageHeader from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog'
import { usePermission } from '@/hooks/usePermission'
import RolesList from '@/features/staff/iam/roles/RolesList'
import RoleForm from '@/features/staff/iam/roles/RoleForm'
import PermissionAssignment from '@/features/staff/iam/roles/PermissionAssignment'

export default function RolesPage() {
  const canWrite = usePermission('iam:roles:write')
  const [formOpen, setFormOpen] = useState(false)
  const [editingRole, setEditingRole] = useState(null)
  const [permissionsRole, setPermissionsRole] = useState(null)

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        description="Manage staff roles and the individual permission codes each one grants."
        actions={
          canWrite && (
            <Button
              onClick={() => {
                setEditingRole(null)
                setFormOpen(true)
              }}
            >
              Add Role
            </Button>
          )
        }
      />

      {/*
        Route/nav for this page stays gated by iam:roles:read (Manager
        holds it too, per RBAC_MATRIX §5.1) rather than hardcoded
        Admin-only, per PROJECT_STATE §2.3's standing rule. Every write
        control here and in RolesList/PermissionAssignment is separately
        gated by iam:roles:write (Admin-only, confirmed), so Manager can
        view this page but cannot create/edit a role or touch its
        permissions — flagged to the user as a deliberate reconciliation
        of a conflict with this phase's literal brief.
      */}

      <RolesList
        onEdit={(role) => {
          setEditingRole(role)
          setFormOpen(true)
        }}
        onManagePermissions={(role) => setPermissionsRole(role)}
      />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingRole ? 'Edit Role' : 'Add Role'}
      >
        <RoleForm
          role={editingRole}
          onSuccess={() => setFormOpen(false)}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>

      {/*
        Uses the raw Dialog primitives directly (not the shared Modal
        wrapper) so this one screen can be wider than Modal's fixed
        max-w-lg — the permission checklist needs more room. Deliberately
        avoids touching Modal.jsx itself, since that's shared Phase 4
        infrastructure and out of this phase's scope.
      */}
      <Dialog
        open={Boolean(permissionsRole)}
        onOpenChange={(next) => !next && setPermissionsRole(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Permissions — {permissionsRole?.name}</DialogTitle>
            <DialogDescription>
              Toggle which permission codes this role grants. Changes are sent
              as an assign call (new codes) plus individual remove calls
              (dropped codes) — see the assign-semantics note in chat.
            </DialogDescription>
          </DialogHeader>
          {permissionsRole && (
            <PermissionAssignment
              role={permissionsRole}
              onClose={() => setPermissionsRole(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}