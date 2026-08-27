import * as React from 'react'
import {
  ToastProviderPrimitive, ToastViewport, Toast, ToastClose, ToastTitle, ToastDescription,
} from '@/components/ui/Toast'

const ToastContext = React.createContext(null)

let idCounter = 0

/**
 * ToastProvider + useToast() combined in one file (deliberate — see Phase
 * 4 decision notes: the folder skeleton lists ToastProvider.jsx only, but
 * a paired hook is required for components to actually trigger toasts).
 * Wrap the app once, at the root, with <ToastProvider>.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = React.useState([])

  const toast = React.useCallback(({ title, description, variant = 'default', duration = 5000 }) => {
    const id = ++idCounter
    setToasts((prev) => [...prev, { id, title, description, variant, duration }])
    return id
  }, [])

  const dismiss = React.useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      <ToastProviderPrimitive>
        {children}
        {toasts.map(({ id, title, description, variant, duration }) => (
          <Toast key={id} variant={variant} duration={duration} onOpenChange={(open) => !open && dismiss(id)}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            <ToastClose />
          </Toast>
        ))}
        <ToastViewport />
      </ToastProviderPrimitive>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>')
  }
  return ctx
}