import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { useToast } from '@/components/ui/ToastProvider'
import * as iamStaffApi from '@/api/staff/iamStaffApi'

const NO_DEPARTMENT = 'none'

const baseShape = {
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  roleId: z.string().min(1, 'Role is required'),
  departmentId: z.string(),
}

const createSchema = z.object({ email: z.string().email('Enter a valid email address'), ...baseShape })
const editSchema = z.object(baseShape)

/**
 * Create/edit modal for a staff record. `staff` null = create mode
 * (email required). Creating an account automatically sends the invite
 * email — RBAC_MATRIX §7 confirms there's no separate "first invite"
 * endpoint, only POST /iam/staff/{id}/invite to RESEND one (see
 * InviteStaffModal). `staff` present = edit mode — email is not shown/
 * editable since PUT /iam/staff/{id}'s schema has no email field.
 */
export default function StaffForm({ open, onClose, staff, roles, departments }) {
  const isEdit = Boolean(staff)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: { email: '', firstName: '', lastName: '', roleId: '', departmentId: NO_DEPARTMENT },
  })

  useEffect(() => {
    if (!open) return
    if (staff) {
      reset({
        email: staff.email,
        firstName: staff.first_name,
        lastName: staff.last_name,
        roleId: staff.role_id,
        departmentId: staff.department_id || NO_DEPARTMENT,
      })
    } else {
      reset({ email: '', firstName: '', lastName: '', roleId: '', departmentId: NO_DEPARTMENT })
    }
  }, [open, staff, reset])

  const mutation = useMutation({
    mutationFn: (values) => {
      const departmentId = values.departmentId === NO_DEPARTMENT ? null : values.departmentId
      if (isEdit) {
        return iamStaffApi.updateStaff(staff.id, {
          firstName: values.firstName,
          lastName: values.lastName,
          roleId: values.roleId,
          departmentId,
        })
      }
      return iamStaffApi.createStaff({
        email: values.email,
        firstName: values.firstName,
        lastName: values.lastName,
        roleId: values.roleId,
        departmentId,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      toast({
        title: isEdit ? 'Staff account updated.' : 'Staff account created.',
        description: isEdit ? undefined : 'An invite email has been sent to set their password.',
        variant: 'success',
      })
      onClose()
    },
    onError: (err) => {
      toast({
        title: isEdit ? 'Could not update staff account.' : 'Could not create staff account.',
        description: err?.response?.data?.message || err?.message,
        variant: 'destructive',
      })
    },
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Staff Account' : 'Add Staff'}
      description={
        isEdit ? undefined : 'Creating an account automatically sends the new staff member an invite email to set their password.'
      }
    >
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4" noValidate>
        {!isEdit && (
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="off" {...register('email')} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" {...register('firstName')} />
            {errors.firstName && <p className="text-sm text-destructive">{errors.firstName.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" {...register('lastName')} />
            {errors.lastName && <p className="text-sm text-destructive">{errors.lastName.message}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <Label>Role</Label>
          <Controller
            name="roleId"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.roleId && <p className="text-sm text-destructive">{errors.roleId.message}</p>}
        </div>

        <div className="space-y-1">
          <Label>Department</Label>
          <Controller
            name="departmentId"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="No department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DEPARTMENT}>No department</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting || mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {isEdit ? 'Save Changes' : 'Add Staff'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}