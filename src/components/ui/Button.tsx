import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'destructive'
  fullWidth?: boolean
}

const variants = {
  primary:     'bg-brand text-inverse border-transparent hover:bg-brand-light active:bg-brand-muted font-medium',
  ghost:       'bg-transparent text-foreground border-border hover:bg-overlay',
  destructive: 'bg-error/10 text-error border-error/30 hover:bg-error/20',
}

/** Tamaño único para todos los botones (referencia: "Hacer pedido") */
const size = 'px-4 py-2.5 text-sm rounded-xl border'

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', fullWidth = false, className = '', children, ...props }, ref) => (
    <button
      ref={ref}
      className={[
        'inline-flex items-center justify-center gap-2',
        'transition-[color,background-color,border-color,transform] duration-150 ease-out',
        'active:scale-[0.97] disabled:active:scale-100',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variants[variant],
        size,
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  )
)

Button.displayName = 'Button'
