import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { useToast } from '@/components/ui/ToastProvider'

// Reusable photo uploader for staff forms (hotel, restaurant, room type).
// `onUpload(file)` must call the API and resolve to the updated record
// (which carries image_url). Remount with a `key` when the record changes.
export default function ImageUploadField({ label = 'Photo', currentUrl, onUpload, onUploaded }) {
  const inputRef = useRef(null)
  const { toast } = useToast()
  const [url, setUrl] = useState(currentUrl || null)
  const [busy, setBusy] = useState(false)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please choose an image file', variant: 'destructive' })
      return
    }
    setBusy(true)
    try {
      const updated = await onUpload(file)
      setUrl(updated?.image_url || null)
      toast({ title: 'Photo uploaded', variant: 'success' })
      onUploaded?.(updated)
    } catch (err) {
      toast({
        title: 'Could not upload photo',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        {url ? (
          <img src={url} alt="" className="h-20 w-32 rounded-md border object-cover" />
        ) : (
          <div className="flex h-20 w-32 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
            No photo
          </div>
        )}
        <Button type="button" variant="outline" size="sm" loading={busy} onClick={() => inputRef.current?.click()}>
          {url ? 'Replace photo' : 'Upload photo'}
        </Button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    </div>
  )
}