import type { ReactNode } from 'react'

const ICONS = { danger: '⚠', warning: '⚠', success: '✓', pending: '⌛' } as const

export function Banner({
  kind,
  title,
  children,
}: {
  kind: 'danger' | 'warning' | 'success'
  title: string
  children?: ReactNode
}) {
  return (
    <div className={`banner banner-${kind}`} role={kind === 'danger' ? 'alert' : 'status'}>
      <span className="banner-icon" aria-hidden="true">
        {ICONS[kind]}
      </span>
      <div>
        <strong>{title}</strong>
        {children}
      </div>
    </div>
  )
}
