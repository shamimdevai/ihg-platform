import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
})

export default function DepartmentForm({ open, onClose, onSubmit, initialValues, loading }) {
  const isEdit = Boolean(initialValues)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  })

  useEffect(() => {
    if (open) {
      reset({
        name: initialValues?.name || '',
        description: initialValues?.description || '',
      })
    }
  }, [open, initialValues, reset])

  const submit = (values) => {
    // PUT's schema accepts partial fields, but sending both every time
    // (even on edit) is simplest and always valid for a two-field form
    // — no need to diff client-side.
    onSubmit({
      name: values.name,
      description: values.description || null,
    })
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Department' : 'Add Department'}>
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <div className="space-y-1">
          <Label htmlFor="name">Name</Label>
          <Input id="name" {...register('name')} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" {...register('description')} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {isEdit ? 'Save Changes' : 'Create Department'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}