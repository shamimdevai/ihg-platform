import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'

/**
 * Simplified Modal wrapper over the raw Dialog primitive — most screens
 * just need open/onClose/title/children, not the full compound-component
 * API. Use Dialog.jsx directly if a screen genuinely needs more control
 * (custom trigger, footer layout, etc.).
 */
export default function Modal({ open, onClose, title, description, children }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose?.()}>
      <DialogContent>
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  )
}