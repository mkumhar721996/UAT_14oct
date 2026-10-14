import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Toast = { id: number; message: string; danger: boolean }
const ToastContext = createContext<(message: string, danger?: boolean) => void>(() => {})

export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
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
