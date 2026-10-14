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
import { useToast } from '@/components/ui/ToastProvider'
import ImageUploadField from '@/components/ui/ImageUploadField'
import { usePermission } from '@/hooks/usePermission'
import * as hotelApi from '@/api/staff/hotelApi'
import RoomTypesList from '@/features/staff/hotel/rooms/RoomTypesList'
import RoomsList from '@/features/staff/hotel/rooms/RoomsList'
import AvailabilitySearch from '@/features/staff/hotel/rooms/AvailabilitySearch'

export default function RoomsPage() {
  const canWrite = usePermission('hotel:room:write')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedHotelId, setSelectedHotelId] = useState(null)
  const [hotelFormOpen, setHotelFormOpen] = useState(false)
  // Backlog item 7, RESOLVED: PUT /hotel/hotels/{id} already worked
  // (no backend change needed — it always accepted is_active), only the
  // edit UI was missing. When set, HotelForm opens in edit mode instead
  // of create mode.
  const [editingHotel, setEditingHotel] = useState(null)

  const {
    data: hotels,
    isLoading: hotelsLoading,
    isError: hotelsError,
  } = useQuery({
    queryKey: ['hotel', 'hotels'],
    queryFn: hotelApi.listHotels,
  })

  useEffect(() => {
    if (!selectedHotelId && hotels && hotels.length > 0) {
      setSelectedHotelId(hotels[0].id)
    }
  }, [hotels, selectedHotelId])

  const createHotelMutation = useMutation({
    mutationFn: hotelApi.createHotel,
    onSuccess: (hotel) => {
      toast({ title: 'Hotel created', variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['hotel', 'hotels'] })
      setSelectedHotelId(hotel.id)
      setHotelFormOpen(false)
    },
    onError: (err) =>
      toast({
        title: 'Could not create hotel',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const updateHotelMutation = useMutation({
    mutationFn: ({ id, values }) => hotelApi.updateHotel(id, values),
    onSuccess: () => {
      toast({ title: 'Hotel updated', variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['hotel', 'hotels'] })
      setHotelFormOpen(false)
      setEditingHotel(null)
    },
    onError: (err) =>
      toast({
        title: 'Could not update hotel',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const { data: roomTypes } = useQuery({
    queryKey: ['hotel', 'room-types', selectedHotelId],
    queryFn: () => hotelApi.listRoomTypes(selectedHotelId),
    enabled: Boolean(selectedHotelId),
  })

  const selectedHotel = hotels?.find((h) => h.id === selectedHotelId) || null

  const openCreateHotel = () => {
    setEditingHotel(null)
    setHotelFormOpen(true)
  }

  const openEditHotel = () => {
    setEditingHotel(selectedHotel)
    setHotelFormOpen(true)
  }

  const handleHotelSubmit = (values) => {
    if (editingHotel) {
      updateHotelMutation.mutate({ id: editingHotel.id, values })
    } else {
      createHotelMutation.mutate(values)
    }
  }

  return (
    <div>
      <PageHeader
        title="Rooms"
        description="Manage hotels, room types, and individual rooms."
        actions={canWrite && <Button onClick={openCreateHotel}>Add Hotel</Button>}
      />

      {hotelsLoading && <LoadingState label="Loading hotels…" />}

      {hotelsError && (
        <EmptyState
          title="Couldn't load hotels"
          description="Something went wrong fetching the hotel list. Try refreshing the page."
        />
      )}

      {!hotelsLoading && !hotelsError && (!hotels || hotels.length === 0) && (
        <EmptyState
          title="No hotels have been set up yet"
          description={
            canWrite
              ? 'Add a hotel to start creating room types and rooms.'
              : 'Ask an administrator to set up a hotel before rooms can be managed here.'
          }
        />
      )}

      {!hotelsLoading && hotels && hotels.length > 0 && (
        <>
          <div className="flex items-end gap-2 mb-6">
            <div className="w-72">
              <Label htmlFor="hotel-select">Hotel</Label>
              <Select value={selectedHotelId || undefined} onValueChange={setSelectedHotelId}>
                <SelectTrigger id="hotel-select">
                  <SelectValue placeholder="Select a hotel" />
                </SelectTrigger>
                <SelectContent>
                  {hotels.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                      {!h.is_active ? ' (inactive)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {canWrite && selectedHotel && (
              <Button variant="outline" onClick={openEditHotel}>
                Edit Hotel
              </Button>
            )}
          </div>

          {selectedHotelId && (
            <Tabs defaultValue="rooms">
              <TabsList>
                <TabsTrigger value="rooms">Rooms</TabsTrigger>
                <TabsTrigger value="room-types">Room Types</TabsTrigger>
                <TabsTrigger value="availability">Availability</TabsTrigger>
              </TabsList>
              <TabsContent value="rooms">
                <RoomsList hotelId={selectedHotelId} roomTypes={roomTypes || []} />
              </TabsContent>
              <TabsContent value="room-types">
                <RoomTypesList hotelId={selectedHotelId} />
              </TabsContent>
              <TabsContent value="availability">
                <AvailabilitySearch hotelId={selectedHotelId} roomTypes={roomTypes || []} />
              </TabsContent>
            </Tabs>
          )}
        </>
      )}

      {canWrite && (
        <HotelForm
          open={hotelFormOpen}
          onClose={() => {
            setHotelFormOpen(false)
            setEditingHotel(null)
          }}
          onSubmit={handleHotelSubmit}
          loading={createHotelMutation.isPending || updateHotelMutation.isPending}
          initialValues={editingHotel}
        />
      )}
    </div>
  )
}

const hotelSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  is_active: z.boolean(),
})

function HotelForm({ open, onClose, onSubmit, loading, initialValues }) {
  const isEditing = Boolean(initialValues)
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(hotelSchema),
    defaultValues: { name: '', address: '', phone: '', email: '', is_active: true },
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
          : { name: '', address: '', phone: '', email: '', is_active: true }
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
    <Modal open={open} onClose={handleClose} title={isEditing ? `Edit Hotel — ${initialValues.name}` : 'Add Hotel'}>
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <div className="space-y-1">
          <Label htmlFor="hotel-name">Name</Label>
          <Input id="hotel-name" {...register('name')} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="hotel-address">Address</Label>
          <Input id="hotel-address" {...register('address')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="hotel-phone">Phone</Label>
            <Input id="hotel-phone" {...register('phone')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hotel-email">Email</Label>
            <Input id="hotel-email" type="email" {...register('email')} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Controller
            name="is_active"
            control={control}
            render={({ field }) => (
              <Checkbox id="hotel-is_active" checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
          <Label htmlFor="hotel-is_active">Active</Label>
        </div>
        {isEditing && (
          <ImageUploadField
            key={initialValues.id}
            label="Hotel photo"
            currentUrl={initialValues.image_url}
            onUpload={(file) => hotelApi.uploadHotelImage(initialValues.id, file)}
            onUploaded={() => queryClient.invalidateQueries({ queryKey: ['hotel', 'hotels'] })}
          />
        )}
        {isEditing && (
          <p className="text-xs text-muted-foreground">
            Deactivating a hotel doesn't delete anything — it just marks the property inactive. Its room types,
            rooms, and booking history are unaffected.
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {isEditing ? 'Save Changes' : 'Create Hotel'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}