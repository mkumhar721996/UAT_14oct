import { useEffect } from 'react'

/** Stub drawer: the real add-expense form belongs to the Add story. */
export function AddExpensePanel({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="add-expense-title">
        <h2 className="heading-lg" id="add-expense-title">
          Add expense
        </h2>
        <p className="text-muted">The add expense form opens here.</p>
        <div>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </aside>
    </>
  )
}
