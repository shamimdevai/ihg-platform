import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/ToastProvider'
import { createRole, updateRole } from '@/api/staff/iamRolesApi'

const schema = z.object({
  name: z.string().min(1, 'Role name is required'),
  description: z.string().optional(),
})

export default function RoleForm({ role, onSuccess, onCancel }) {
  const isEdit = Boolean(role)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: role?.name || '',
      description: role?.description || '',
    },
  })

  const mutation = useMutation({
    mutationFn: (values) => {
      const payload = {
        name: values.name,
        description: values.description?.trim() || null,
      }
      return isEdit ? updateRole(role.id, payload) : createRole(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam-roles'] })
      toast({ title: isEdit ? 'Role updated' : 'Role created', variant: 'success' })
      onSuccess?.()
    },
    onError: (err) => {
      toast({
        title: 'Something went wrong',
        description: err?.response?.data?.message || 'Could not save this role.',
        variant: 'destructive',
      })
    },
  })

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      className="space-y-4"
      noValidate
    >
      <div className="space-y-1.5">
        <Label htmlFor="name">Role name</Label>
        <Input id="name" {...register('name')} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="What this role is for (optional)"
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting || mutation.isPending}>
          {isEdit ? 'Save changes' : 'Create role'}
        </Button>
      </div>
    </form>
  )
}