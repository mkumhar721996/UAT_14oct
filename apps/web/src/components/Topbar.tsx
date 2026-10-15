import type { ReactNode } from 'react'

export function Topbar({ title, context, actions }: { title: string; context: string; actions?: ReactNode }) {
  return (
    <div className="topbar">
      <div className="flex flex-col gap-[2px]">
        <h1 className="m-0 text-lg font-semibold">{title}</h1>
        <span className="text-sm text-fg-muted">{context}</span>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
