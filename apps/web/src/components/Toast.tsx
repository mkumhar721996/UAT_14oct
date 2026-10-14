import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

/**
 * Simple, controlled toast used by the requisitions/jobs features: pass the
 * current message (or `null`) and it auto-dismisses after a few seconds.
 */
export function Toast({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(onDismiss, 3200)
    return () => clearTimeout(timer)
  }, [message, onDismiss])

  return (
    <div role="status" aria-live="polite">
      {message && (
        <div className="fixed bottom-4 right-4 z-[3000] max-w-[360px] rounded-md bg-fg px-4 py-3 text-md text-surface shadow-card">
          {message}
        </div>
      )}
    </div>
  )
}

/**
 * Context-based toast stack used by the employee-profile feature: wrap the
 * app in `ToastProvider` and call `useToast()` to push a message.
 */
type QueuedToast = { id: number; message: string; danger: boolean }
const ToastContext = createContext<(message: string, danger?: boolean) => void>(() => {})

export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<QueuedToast[]>([])
  const push = useCallback((message: string, danger = false) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, danger }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={'toast' + (t.danger ? ' toast-danger' : '')}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
