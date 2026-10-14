import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import StatusBadge from '@/components/ui/StatusBadge'
import LoadingState from '@/components/ui/LoadingState'
import ErrorState from '@/components/ui/ErrorState'
import { useToast } from '@/components/ui/ToastProvider'
import * as profileApi from '@/api/customer/profileApi'

const verifiedMap = {
  true: { label: 'Verified', className: 'bg-green-100 text-green-700' },
  false: { label: 'Not verified', className: 'bg-yellow-100 text-yellow-800' },
}

const schema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
})

const PROFILE_QUERY_KEY = ['customer', 'profile']

export default function ProfileForm() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: profile, isLoading, isError, error, refetch } = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: profileApi.getMyProfile,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '', phone: '' },
  })

  // Populate the form once the real profile loads — can't set
  // defaultValues up front since the fetch is async.
  useEffect(() => {
    if (profile) {
      reset({
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        phone: profile.phone || '',
      })
    }
  }, [profile, reset])

  const mutation = useMutation({
    mutationFn: (values) =>
      profileApi.updateMyProfile({
        firstName: values.firstName || null,
        lastName: values.lastName || null,
        phone: values.phone || null,
      }),
    onSuccess: () => {
      toast({ title: 'Profile updated', variant: 'success' })
      queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY })
    },
    onError: (err) =>
      toast({
        title: 'Could not update your profile',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  if (isLoading) return <LoadingState label="Loading your profile…" />
  if (isError) {
    return (
      <ErrorState
        message={error?.response?.data?.message || error?.message || 'Could not load your profile.'}
        onRetry={refetch}
      />
    )
  }

  return (
    <Card className="max-w-lg">
      <CardContent className="pt-6 space-y-4">
        {/* Email is read-only — CONFIRMED from the real PUT /customers/me
            schema, which has no email field at all. There is therefore no
            email-change / re-verification flow to build here; this field
            simply cannot be edited through this screen. */}
        <div className="space-y-1">
          <Label htmlFor="pf-email">Email</Label>
          <div className="flex items-center gap-2">
            <Input id="pf-email" value={profile.email} disabled />
            <StatusBadge status={String(Boolean(profile.email_verified_at))} colorMap={verifiedMap} />
          </div>
          <p className="text-xs text-muted-foreground">
            Email cannot be changed here.
          </p>
        </div>

        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="pf-first">First name</Label>
              <Input id="pf-first" {...register('firstName')} />
              {errors.firstName && <p className="text-sm text-destructive">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="pf-last">Last name</Label>
              <Input id="pf-last" {...register('lastName')} />
              {errors.lastName && <p className="text-sm text-destructive">{errors.lastName.message}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="pf-phone">Phone</Label>
            <Input id="pf-phone" {...register('phone')} />
          </div>

          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting || mutation.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}