'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/brand/Logo'
import { LogoutButton } from './LogoutButton'

const LINKS = [
  { href: '/admin', label: 'Pedidos' },
  { href: '/admin/menu', label: 'Menú' },
  { href: '/admin/promos', label: 'Promos' },
  { href: '/admin/qr', label: 'QR' },
]

/** Barra común del panel: las tres secciones siempre a un toque, sin botón de regreso */
export function AdminHeader({ online = true }: { online?: boolean }) {
  const pathname = usePathname()
  return (
    <header className="border-b border-border print:hidden">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Logo variant="small" className="h-7 shrink-0" />
          {online && <span className="h-6 w-px bg-border hidden sm:block" aria-hidden />}
          {online && (
            <nav aria-label="Secciones del panel" className="flex items-center">
              {LINKS.map(l => {
                const active = pathname === l.href
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    aria-current={active ? 'page' : undefined}
                    className={[
                      'min-h-10 px-2 sm:px-3 inline-flex items-center rounded-lg text-sm transition-colors',
                      active ? 'text-foreground font-semibold bg-elevated' : 'text-muted hover:text-foreground',
                    ].join(' ')}
                  >
                    {l.label}
                  </Link>
                )
              })}
            </nav>
          )}
        </div>
        {online && <LogoutButton />}
      </div>
    </header>
  )
}
