import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

/** Persistent sidebar + topbar around a page's single scrolling content column. */
export function AppShell({
  title,
  context,
  actions,
  children,
}: {
  title: string
  context: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-surface text-fg lg:flex-row">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar title={title} context={context} actions={actions} />
        <main className="content">{children}</main>
      </div>
    </div>
  )
}
