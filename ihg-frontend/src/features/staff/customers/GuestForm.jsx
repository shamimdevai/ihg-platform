import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/ToastProvider';
import { createGuest, updateGuest } from '@/api/staff/hotelGuestsApi';

const guestSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  identification_number: z.string().optional().or(z.literal('')),
  nationality: z.string().optional().or(z.literal('')),
  is_vip: z.boolean().default(false),
});

function toApiPayload(values) {
  return {
    first_name: values.first_name,
    last_name: values.last_name,
    email: values.email || null,
    phone: values.phone || null,
    identification_number: values.identification_number || null,
    nationality: values.nationality || null,
    is_vip: values.is_vip,
  };
}

export default function GuestForm({ open, onClose, guest }) {
  const isEdit = Boolean(guest);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(guestSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      identification_number: '',
      nationality: '',
      is_vip: false,
    },
  });

  useEffect(() => {
    if (open) {
      reset(
        guest
          ? {
              first_name: guest.first_name || '',
              last_name: guest.last_name || '',
              email: guest.email || '',
              phone: guest.phone || '',
              identification_number: guest.identification_number || '',
              nationality: guest.nationality || '',
              is_vip: Boolean(guest.is_vip),
            }
          : {
              first_name: '',
              last_name: '',
              email: '',
              phone: '',
              identification_number: '',
              nationality: '',
              is_vip: false,
            }
      );
    }
  }, [open, guest, reset]);

  const mutation = useMutation({
    mutationFn: (values) =>
      isEdit
        ? updateGuest(guest.id, toApiPayload(values))
        : createGuest(toApiPayload(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotelGuests'] });
      toast({
        title: isEdit ? 'Guest updated' : 'Guest created',
        variant: 'default',
      });
      onClose();
    },
    onError: (err) => {
      toast({
        title: 'Could not save this guest',
        description: err?.response?.data?.message || 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Guest' : 'Add Guest'}>
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">First name</label>
            <Input {...register('first_name')} />
            {errors.first_name && (
              <p className="text-sm text-destructive mt-1">{errors.first_name.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Last name</label>
            <Input {...register('last_name')} />
            {errors.last_name && (
              <p className="text-sm text-destructive mt-1">{errors.last_name.message}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <Input type="email" {...register('email')} />
          {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <Input {...register('phone')} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">ID / Passport number</label>
          <Input {...register('identification_number')} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Nationality</label>
          <Input {...register('nationality')} />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('is_vip')} className="h-4 w-4 rounded" />
          Mark as VIP guest
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {isEdit ? 'Save Changes' : 'Create Guest'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}