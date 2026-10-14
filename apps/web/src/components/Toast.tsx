import { useEffect } from 'react'

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
