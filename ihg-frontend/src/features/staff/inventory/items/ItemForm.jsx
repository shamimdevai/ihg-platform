import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { Checkbox } from '@/components/ui/Checkbox'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { usePermission } from '@/hooks/usePermission'
import * as inventorySuppliersApi from '@/api/staff/inventorySuppliersApi'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  unit: z.string().min(1, 'Unit is required'),
  sku: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  reorder_threshold: z
    .string()
    .optional()
    .refine((val) => val === undefined || val === '' || (!isNaN(Number(val)) && Number(val) >= 0), {
      message: 'Must be 0 or more',
    }),
  default_supplier_id: z.string().optional(), // 'none' sentinel or a real uuid
  is_active: z.boolean(),
})

export default function ItemForm({ open, onClose, onSubmit, initialValues, loading }) {
  const isEdit = Boolean(initialValues)

  // Reading the supplier list to power this dropdown is intra-domain
  // (inventory:supplier:*), not cross-domain — but it's still a
  // separate permission code from inventory:item:write, which a future
  // narrower custom role might not hold. Falls back to a plain UUID
  // text field rather than silently hiding the field.
  const canReadSuppliers = usePermission('inventory:supplier:read')

  const { data: suppliers } = useQuery({
    queryKey: ['inventory', 'suppliers'],
    queryFn: inventorySuppliersApi.listSuppliers,
    enabled: open && canReadSuppliers,
  })

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      unit: '',
      sku: '',
      description: '',
      category: '',
      reorder_threshold: '',
      default_supplier_id: 'none',
      is_active: true,
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        name: initialValues?.name || '',
        unit: initialValues?.unit || '',
        sku: initialValues?.sku || '',
        description: initialValues?.description || '',
        category: initialValues?.category || '',
        reorder_threshold:
          initialValues?.reorder_threshold != null ? String(initialValues.reorder_threshold) : '',
        default_supplier_id: initialValues?.default_supplier_id || 'none',
        is_active: initialValues?.is_active ?? true,
      })
    }
  }, [open, initialValues, reset])

  const submit = (values) => {
    onSubmit({
      name: values.name,
      unit: values.unit,
      sku: values.sku || null,
      description: values.description || null,
      category: values.category || null,
      reorder_threshold: values.reorder_threshold ? Number(values.reorder_threshold) : null,
      default_supplier_id: values.default_supplier_id === 'none' ? null : values.default_supplier_id,
      is_active: values.is_active,
    })
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Item' : 'Add Item'}>
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="unit">Unit</Label>
            <Input id="unit" placeholder="e.g. kg, pcs, liter" {...register('unit')} />
            {errors.unit && <p className="text-sm text-destructive">{errors.unit.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="sku">SKU</Label>
            <Input id="sku" {...register('sku')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="category">Category</Label>
            <Input id="category" {...register('category')} />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" {...register('description')} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="reorder_threshold">Reorder Threshold</Label>
            <Input id="reorder_threshold" type="number" step="any" placeholder="Optional" {...register('reorder_threshold')} />
            {errors.reorder_threshold && (
              <p className="text-sm text-destructive">{errors.reorder_threshold.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              A low-stock alert is triggered once stock falls to or below this level.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="default_supplier_id">Default Supplier</Label>
            {canReadSuppliers ? (
              <Controller
                name="default_supplier_id"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="default_supplier_id">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {(suppliers || []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            ) : (
              <>
                <Input id="default_supplier_id" placeholder="Supplier UUID (optional)" {...register('default_supplier_id')} />
                <p className="text-xs text-muted-foreground">
                  You don't have access to the supplier list — paste a supplier ID directly if needed.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Controller
            name="is_active"
            control={control}
            render={({ field }) => (
              <Checkbox id="is_active" checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
          <Label htmlFor="is_active">Active</Label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {isEdit ? 'Save Changes' : 'Create Item'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}