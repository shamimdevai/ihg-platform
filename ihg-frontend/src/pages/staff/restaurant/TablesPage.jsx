import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Checkbox } from '@/components/ui/Checkbox'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import ImageUploadField from '@/components/ui/ImageUploadField'
import { useToast } from '@/components/ui/ToastProvider'
import { usePermission } from '@/hooks/usePermission'
import * as restaurantApi from '@/api/staff/restaurantApi'
import TablesList from '@/features/staff/restaurant/tables/TablesList'
import ReservationsList from '@/features/staff/restaurant/tables/ReservationsList'

// Restaurant selector + create/EDIT restaurant (edit added with the
// property-photo feature: PUT /restaurant/restaurants/{id} and the
// image upload both need an edit mode). Mirrors Phase 13's RoomsPage.jsx
// hotel selector.
export default function TablesPage() {
  const canWrite = usePermission('restaurant:table:write')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null)
  const [restaurantFormOpen, setRestaurantFormOpen] = useState(false)
  const [editingRestaurant, setEditingRestaurant] = useState(null)

  const {
    data: restaurants,
    isLoading: restaurantsLoading,
    isError: restaurantsError,
  } = useQuery({
    queryKey: ['restaurant', 'restaurants'],
    queryFn: restaurantApi.listRestaurants,
  })

  useEffect(() => {
    if (!selectedRestaurantId && restaurants && restaurants.length > 0) {
      setSelectedRestaurantId(restaurants[0].id)
    }
  }, [restaurants, selectedRestaurantId])

  const createRestaurantMutation = useMutation({
    mutationFn: restaurantApi.createRestaurant,
    onSuccess: (restaurant) => {
      toast({ title: 'Restaurant created', variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['restaurant', 'restaurants'] })
      setSelectedRestaurantId(restaurant.id)
      setRestaurantFormOpen(false)
    },
    onError: (err) =>
      toast({
        title: 'Could not create restaurant',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const updateRestaurantMutation = useMutation({
    mutationFn: ({ id, values }) => restaurantApi.updateRestaurant(id, values),
    onSuccess: () => {
      toast({ title: 'Restaurant updated', variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['restaurant', 'restaurants'] })
      setRestaurantFormOpen(false)
      setEditingRestaurant(null)
    },
    onError: (err) =>
      toast({
        title: 'Could not update restaurant',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  // Tables are fetched here (not inside each tab separately) so
  // ReservationsList can join table_id → table_number and populate its
  // table filter/ReservationForm's table dropdown without a second
  // fetch — same convention as Phase 13's RoomsPage fetching roomTypes
  // once and sharing it across tabs.
  const { data: tables } = useQuery({
    queryKey: ['restaurant', 'tables', selectedRestaurantId, 'all'],
    queryFn: () => restaurantApi.listTables({ restaurantId: selectedRestaurantId }),
    enabled: Boolean(selectedRestaurantId),
  })

  const selectedRestaurant = restaurants?.find((r) => r.id === selectedRestaurantId) || null

  const openCreate = () => {
    setEditingRestaurant(null)
    setRestaurantFormOpen(true)
  }

  const openEdit = () => {
    setEditingRestaurant(selectedRestaurant)
    setRestaurantFormOpen(true)
  }

  const handleSubmit = (values) => {
    if (editingRestaurant) {
      updateRestaurantMutation.mutate({ id: editingRestaurant.id, values })
    } else {
      createRestaurantMutation.mutate(values)
    }
  }

  return (
    <div>
      <PageHeader
        title="Tables & Reservations"
        description="Manage restaurants, tables, and reservations."
        actions={canWrite && <Button onClick={openCreate}>Add Restaurant</Button>}
      />

      {restaurantsLoading && <LoadingState label="Loading restaurants…" />}

      {restaurantsError && (
        <EmptyState
          title="Couldn't load restaurants"
          description="Something went wrong fetching the restaurant list. Try refreshing the page."
        />
      )}

      {!restaurantsLoading && !restaurantsError && (!restaurants || restaurants.length === 0) && (
        <EmptyState
          title="No restaurants have been set up yet"
          description={
            canWrite
              ? 'Add a restaurant to start creating tables and reservations.'
              : 'Ask an administrator to set up a restaurant before tables can be managed here.'
          }
        />
      )}

      {!restaurantsLoading && restaurants && restaurants.length > 0 && (
        <>
          <div className="flex items-end gap-2 mb-6">
            <div className="w-72">
              <Label htmlFor="restaurant-select">Restaurant</Label>
              <Select value={selectedRestaurantId || undefined} onValueChange={setSelectedRestaurantId}>
                <SelectTrigger id="restaurant-select">
                  <SelectValue placeholder="Select a restaurant" />
                </SelectTrigger>
                <SelectContent>
                  {restaurants.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                      {!r.is_active ? ' (inactive)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {canWrite && selectedRestaurant && (
              <Button variant="outline" onClick={openEdit}>
                Edit Restaurant
              </Button>
            )}
          </div>

          {selectedRestaurantId && (
            <Tabs defaultValue="tables">
              <TabsList>
                <TabsTrigger value="tables">Tables</TabsTrigger>
                <TabsTrigger value="reservations">Reservations</TabsTrigger>
              </TabsList>
              <TabsContent value="tables">
                <TablesList restaurantId={selectedRestaurantId} />
              </TabsContent>
              <TabsContent value="reservations">
                <ReservationsList restaurantId={selectedRestaurantId} tables={tables || []} />
              </TabsContent>
            </Tabs>
          )}
        </>
      )}

      {canWrite && (
        <RestaurantForm
          open={restaurantFormOpen}
          onClose={() => {
            setRestaurantFormOpen(false)
            setEditingRestaurant(null)
          }}
          onSubmit={handleSubmit}
          loading={createRestaurantMutation.isPending || updateRestaurantMutation.isPending}
          initialValues={editingRestaurant}
        />
      )}
    </div>
  )
}

const restaurantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  is_active: z.boolean(),
})

const EMPTY_VALUES = { name: '', address: '', phone: '', email: '', is_active: true }

function RestaurantForm({ open, onClose, onSubmit, loading, initialValues }) {
  const isEditing = Boolean(initialValues)
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(restaurantSchema),
    defaultValues: EMPTY_VALUES,
  })

  useEffect(() => {
    if (open) {
      reset(
        initialValues
          ? {
              name: initialValues.name,
              address: initialValues.address || '',
              phone: initialValues.phone || '',
              email: initialValues.email || '',
              is_active: initialValues.is_active,
            }
          : EMPTY_VALUES
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialValues])

  const submit = (values) => {
    onSubmit({
      name: values.name,
      address: values.address || null,
      phone: values.phone || null,
      email: values.email || null,
      is_active: values.is_active,
    })
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEditing ? `Edit Restaurant — ${initialValues.name}` : 'Add Restaurant'}
    >
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <div className="space-y-1">
          <Label htmlFor="restaurant-name">Name</Label>
          <Input id="restaurant-name" {...register('name')} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="restaurant-address">Address</Label>
          <Input id="restaurant-address" {...register('address')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="restaurant-phone">Phone</Label>
            <Input id="restaurant-phone" {...register('phone')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="restaurant-email">Email</Label>
            <Input id="restaurant-email" type="email" {...register('email')} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Controller
            name="is_active"
            control={control}
            render={({ field }) => (
              <Checkbox id="restaurant-is_active" checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
          <Label htmlFor="restaurant-is_active">Active</Label>
        </div>
        {isEditing ? (
          <ImageUploadField
            key={initialValues.id}
            label="Restaurant photo"
            currentUrl={initialValues.image_url}
            onUpload={(file) => restaurantApi.uploadRestaurantImage(initialValues.id, file)}
            onUploaded={() => queryClient.invalidateQueries({ queryKey: ['restaurant', 'restaurants'] })}
          />
        ) : (
          <p className="text-xs text-muted-foreground">You can add a photo after the restaurant is created (use Edit).</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {isEditing ? 'Save Changes' : 'Create Restaurant'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}