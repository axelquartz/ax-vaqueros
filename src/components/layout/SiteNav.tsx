'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export const NAV_LINKS = [
  { href: '/',         label: 'Menú' },
  { href: '/nosotros', label: 'Nosotros' },
  { href: '/pedidos',  label: 'Mis pedidos' },
] as const

/** ¿La ruta actual pertenece a esta sección? (el detalle de un pedido cuenta como "Mis pedidos") */
export function isActiveLink(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/'
  if (href === '/pedidos') return pathname.startsWith('/pedidos') || pathname.startsWith('/order')
  return pathname.startsWith(href)
}

/**
 * Navegación principal: Menú, Nosotros y Mis pedidos siempre visibles (sin
 * hamburguesa), para moverse entre secciones sin usar el botón de regreso.
 */
export function SiteNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Principal" className="flex items-center">
      {NAV_LINKS.map(link => {
        const active = isActiveLink(link.href, pathname)
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={[
              'min-h-11 px-2 sm:px-3 inline-flex items-center rounded-lg text-sm transition-colors whitespace-nowrap',
              active ? 'text-foreground font-semibold bg-elevated' : 'text-muted hover:text-foreground',
            ].join(' ')}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
