import { ReactNode } from 'react'

export type BadgeColor = 'brand' | 'success' | 'error' | 'warning' | 'default'

interface BadgeProps {
  color?: BadgeColor
  children: ReactNode
  className?: string
}

const colorMap: Record<BadgeColor, string> = {
  brand:   'bg-brand/15 text-brand border-brand/30',
  success: 'bg-success/15 text-success border-success/30',
  error:   'bg-error/15 text-error border-error/30',
  warning: 'bg-warning/15 text-warning border-warning/30',
  default: 'bg-overlay text-secondary border-border',
}

export function Badge({ color = 'default', children, className = '' }: BadgeProps) {
  return (
    <span className={[
      'inline-flex items-center px-2 py-0.5 rounded-full',
      'text-xs font-medium border',
      colorMap[color],
      className,
    ].join(' ')}>
      {children}
    </span>
  )
}
