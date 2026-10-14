import { useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { Checkbox } from '@/components/ui/Checkbox'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'

const schema = z
  .object({
    category_id: z.string().min(1, 'Category is required'),
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    price: z
      .string()
      .min(1, 'Price is required')
      .refine((val) => !isNaN(Number(val)) && Number(val) > 0, { message: 'Must be greater than 0' }),
    is_available: z.boolean(),
    inventory_item_id: z.string().optional(),
    inventory_qty_per_unit: z
      .string()
      .optional()
      .refine((val) => val === undefined || val === '' || (!isNaN(Number(val)) && Number(val) > 0), {
        message: 'Must be greater than 0',
      }),
    discount_type: z.enum(['none', 'percentage', 'fixed_amount']),
    discount_value: z.string().optional(),
    discount_starts_at: z.string().optional(),
    discount_ends_at: z.string().optional(),
  })
  // Mirrors the backend's own _validate_discount_fields — fast client-
  // side feedback, with the server remaining authoritative.
  .superRefine((data, ctx) => {
    if (data.discount_type !== 'none') {
      const value = Number(data.discount_value)
      if (!data.discount_value || isNaN(value) || value <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['discount_value'],
          message: 'Required when a discount type is selected',
        })
      } else if (data.discount_type === 'percentage' && value > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['discount_value'],
          message: 'Cannot exceed 100',
        })
      } else {
        const price = Number(data.price)
        if (data.discount_type === 'fixed_amount' && !isNaN(price) && value >= price) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['discount_value'],
            message: 'Must be less than the price',
          })
        }
      }
    }
    if (data.discount_starts_at && data.discount_ends_at && data.discount_ends_at <= data.discount_starts_at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discount_ends_at'],
        message: 'Must be after the start time',
      })
    }
  })

// datetime-local inputs use "YYYY-MM-DDTHH:mm" in the browser's own local
// time zone — these two converters go between that and a real ISO string
// (what the backend sends/expects) without a date library.
function isoToDatetimeLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function datetimeLocalToIso(value) {
  return value ? new Date(value).toISOString() : null
}

/**
 * Image: a real file can now be SELECTED in both create and edit mode.
 * In EDIT mode, behavior is unchanged from before — picking a file and
 * clicking "Upload" fires immediately (a separate multipart call,
 * since the backend has no combined create+image endpoint). In CREATE
 * mode, there's no item id yet to upload against, so the selected file
 * is just held here and handed back to the caller alongside the normal
 * form values on submit — MenuItemsList.jsx is what actually chains
 * "create, then upload" into one user-perceived action (see its
 * handleSubmit).
 *
 * Discount: optional type (percentage/fixed amount) + value, with
 * optional start/end scheduling. "Clear Discount" (edit mode only, only
 * shown when a discount is currently configured) calls a separate
 * backend action rather than being expressible through this form's own
 * submit — see menu_service.clear_discount()'s docstring for why.
 */
export default function MenuItemForm({
  open,
  onClose,
  onSubmit,
  onUploadImage,
  onClearDiscount,
  initialValues,
  categories,
  loading,
  uploadingImage,
  clearingDiscount,
}) {
  const isEdit = Boolean(initialValues)
  const fileInputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      category_id: '',
      name: '',
      description: '',
      price: '',
      is_available: true,
      inventory_item_id: '',
      inventory_qty_per_unit: '',
      discount_type: 'none',
      discount_value: '',
      discount_starts_at: '',
      discount_ends_at: '',
    },
  })

  const discountType = watch('discount_type')

  useEffect(() => {
    if (open) {
      reset({
        category_id: initialValues?.category_id || '',
        name: initialValues?.name || '',
        description: initialValues?.description || '',
        price: initialValues?.price != null ? String(initialValues.price) : '',
        is_available: initialValues?.is_available ?? true,
        inventory_item_id: initialValues?.inventory_item_id || '',
        inventory_qty_per_unit:
          initialValues?.inventory_qty_per_unit != null ? String(initialValues.inventory_qty_per_unit) : '',
        discount_type: initialValues?.discount_type || 'none',
        discount_value: initialValues?.discount_value != null ? String(initialValues.discount_value) : '',
        discount_starts_at: isoToDatetimeLocal(initialValues?.discount_starts_at),
        discount_ends_at: isoToDatetimeLocal(initialValues?.discount_ends_at),
      })
      setSelectedFile(null)
    }
  }, [open, initialValues, reset])

  const submit = (values) => {
    const payload = {
      category_id: values.category_id,
      name: values.name,
      description: values.description || null,
      price: Number(values.price),
      is_available: values.is_available,
      inventory_item_id: values.inventory_item_id || null,
      inventory_qty_per_unit: values.inventory_qty_per_unit ? Number(values.inventory_qty_per_unit) : null,
    }
    // Discount fields are only included when a type is actually
    // selected — mirrors the backend's "set together, or not at all"
    // rule. Leaving them out entirely (rather than sending nulls) means
    // an EDIT that doesn't touch the discount section leaves an
    // existing discount untouched, consistent with update_item()'s
    // general "skip None" semantics project-wide.
    if (values.discount_type !== 'none') {
      payload.discount_type = values.discount_type
      payload.discount_value = Number(values.discount_value)
      payload.discount_starts_at = datetimeLocalToIso(values.discount_starts_at)
      payload.discount_ends_at = datetimeLocalToIso(values.discount_ends_at)
    }
    onSubmit(payload, selectedFile)
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) setSelectedFile(file)
  }

  const handleUploadClick = () => {
    if (selectedFile) onUploadImage(selectedFile)
  }

  const hasExistingDiscount = Boolean(initialValues?.discount_type)

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Menu Item' : 'Add Menu Item'}>
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="item-name">Name</Label>
            <Input id="item-name" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="item-category_id">Category</Label>
            <Controller
              name="category_id"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="item-category_id">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories || []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.category_id && (
              <p className="text-sm text-destructive">{errors.category_id.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="item-description">Description</Label>
          <Textarea id="item-description" {...register('description')} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="item-price">Price</Label>
            <Input id="item-price" type="number" step="0.01" {...register('price')} />
            {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Controller
              name="is_available"
              control={control}
              render={({ field }) => (
                <Checkbox id="item-is_available" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            <Label htmlFor="item-is_available">Available</Label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="item-inventory_item_id">Linked Inventory Item ID</Label>
            <Input id="item-inventory_item_id" placeholder="Optional UUID" {...register('inventory_item_id')} />
            <p className="text-xs text-muted-foreground">
              Leave blank if this item shouldn't deduct stock on order.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="item-inventory_qty_per_unit">Qty Consumed per Order</Label>
            <Input
              id="item-inventory_qty_per_unit"
              type="number"
              step="any"
              placeholder="Optional"
              {...register('inventory_qty_per_unit')}
            />
            {errors.inventory_qty_per_unit && (
              <p className="text-sm text-destructive">{errors.inventory_qty_per_unit.message}</p>
            )}
          </div>
        </div>

        {/* Discount section */}
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <Label>Discount</Label>
            {isEdit && hasExistingDiscount && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClearDiscount}
                loading={clearingDiscount}
              >
                Clear Discount
              </Button>
            )}
          </div>

          <Controller
            name="discount_type"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No discount</SelectItem>
                  <SelectItem value="percentage">Percentage off</SelectItem>
                  <SelectItem value="fixed_amount">Fixed amount off</SelectItem>
                </SelectContent>
              </Select>
            )}
          />

          {discountType !== 'none' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="item-discount_value">
                    {discountType === 'percentage' ? 'Percent off' : 'Amount off'}
                  </Label>
                  <Input
                    id="item-discount_value"
                    type="number"
                    step="0.01"
                    placeholder={discountType === 'percentage' ? 'e.g. 20' : 'e.g. 5.00'}
                    {...register('discount_value')}
                  />
                  {errors.discount_value && (
                    <p className="text-sm text-destructive">{errors.discount_value.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="item-discount_starts_at">Starts (optional)</Label>
                  <Input id="item-discount_starts_at" type="datetime-local" {...register('discount_starts_at')} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="item-discount_ends_at">Ends (optional)</Label>
                  <Input id="item-discount_ends_at" type="datetime-local" {...register('discount_ends_at')} />
                  {errors.discount_ends_at && (
                    <p className="text-sm text-destructive">{errors.discount_ends_at.message}</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Leave start/end blank for a discount that runs until manually cleared.
              </p>
            </>
          )}
        </div>

        {/* Image — now available in BOTH create and edit mode */}
        <div className="space-y-1 border-t pt-4">
          <Label>Image</Label>
          {initialValues?.image_url && (
            <img
              src={initialValues.image_url}
              alt={initialValues.name}
              className="h-24 w-24 object-cover rounded-md border mb-2"
            />
          )}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="text-sm"
            />
            {isEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleUploadClick}
                disabled={!selectedFile}
                loading={uploadingImage}
              >
                Upload Now
              </Button>
            )}
          </div>
          {isEdit ? (
            <p className="text-xs text-muted-foreground">
              Uploading replaces the current image immediately — it's a separate action from saving the
              fields above.
            </p>
          ) : (
            selectedFile && (
              <p className="text-xs text-muted-foreground">
                "{selectedFile.name}" will be uploaded automatically once this item is created.
              </p>
            )
          )}
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