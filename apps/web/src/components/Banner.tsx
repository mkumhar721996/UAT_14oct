import type { ReactNode } from 'react'

export type BannerVariant = 'success' | 'warning' | 'danger' | 'info'

const ICONS: Record<BannerVariant, string> = { success: '✓', warning: '⚠', danger: '✕', info: '✎' }

export function Banner({
  variant,
  kind,
  title,
  icon,
  children,
}: {
  /** Preferred prop name (requisitions/jobs features). */
  variant?: BannerVariant
  /** Alias kept for the employee-profile feature's call sites. */
  kind?: BannerVariant
  title: ReactNode
  icon?: string
  children?: ReactNode
}) {
  const resolved = variant ?? kind ?? 'info'
  return (
    <div className={`banner banner-${resolved}`} role={resolved === 'danger' ? 'alert' : 'status'}>
      <span className="banner-icon shrink-0 font-semibold" aria-hidden="true">
        {icon ?? ICONS[resolved]}
      </span>
      <div>
        <strong>{title}</strong>
        {children}
      </div>
    </div>
  )
}
