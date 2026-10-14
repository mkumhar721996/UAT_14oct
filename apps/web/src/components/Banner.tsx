import type { ReactNode } from 'react'

export type BannerVariant = 'success' | 'warning' | 'danger' | 'info'

const ICONS: Record<BannerVariant, string> = { success: '✓', warning: '!', danger: '✕', info: '✎' }

export function Banner({
  variant,
  title,
  icon,
  children,
}: {
  variant: BannerVariant
  title: ReactNode
  icon?: string
  children?: ReactNode
}) {
  return (
    <div className={`banner banner-${variant}`} role={variant === 'danger' ? 'alert' : undefined}>
      <span className="shrink-0 font-semibold" aria-hidden="true">
        {icon ?? ICONS[variant]}
      </span>
      <div>
        <strong>{title}</strong>
        {children}
      </div>
    </div>
  )
}
