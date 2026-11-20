'use client'

import { useEffect, useId, useState } from 'react'
import Link from 'next/link'

export const NAV_LINKS = [
  { href: '/nosotros', label: 'Nosotros' },
  { href: '/pedidos',  label: 'Mis pedidos' },
] as const

/**
 * Navegación del header.
 * - sm+: links en línea.
 * - móvil: botón hamburguesa → panel desplegable bajo el header.
 *
 * Debe vivir dentro de un header `position: sticky|relative`: el panel y el
 * overlay se posicionan en absoluto respecto a él (no `fixed`, porque el
 * backdrop-blur del header crea un containing block para hijos fijos).
 */
export function SiteNav() {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  // Cerrar con Escape y al pasar a desktop
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const mq = window.matchMedia('(min-width: 640px)')
    const onMq = () => { if (mq.matches) setOpen(false) }
    window.addEventListener('keydown', onKey)
    mq.addEventListener('change', onMq)
    return () => {
      window.removeEventListener('keydown', onKey)
      mq.removeEventListener('change', onMq)
    }
  }, [open])

  return (
    <>
      {/* Desktop */}
      <nav aria-label="Principal" className="hidden sm:flex items-center gap-5">
        {NAV_LINKS.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Móvil: botón hamburguesa (44px de área táctil) */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        className="sm:hidden -mr-2 w-11 h-11 flex items-center justify-center rounded-full text-foreground active:bg-overlay transition-colors"
      >
        <span className="relative block w-5 h-3.5" aria-hidden>
          <span className={`absolute left-0 right-0 h-0.5 rounded-full bg-current transition-transform duration-300 ease-sheet ${open ? 'top-1.5 rotate-45' : 'top-0'}`} />
          <span className={`absolute left-0 right-0 top-1.5 h-0.5 rounded-full bg-current transition-opacity duration-200 ${open ? 'opacity-0' : 'opacity-100'}`} />
          <span className={`absolute left-0 right-0 h-0.5 rounded-full bg-current transition-transform duration-300 ease-sheet ${open ? 'top-1.5 -rotate-45' : 'top-3'}`} />
        </span>
      </button>

      {/* Móvil: overlay — toca fuera para cerrar */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={`sm:hidden absolute left-0 right-0 top-full h-dvh bg-black/50 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Móvil: panel desplegable (grid-rows anima la altura real) */}
      <div
        id={panelId}
        inert={!open}
        className={`sm:hidden absolute left-0 right-0 top-full grid transition-[grid-template-rows,opacity] duration-300 ease-sheet ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="min-h-0 overflow-hidden">
          <nav aria-label="Principal (móvil)" className="bg-background border-b border-border px-4 py-2">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between min-h-12 text-base text-foreground border-b border-border-subtle last:border-0 active:text-brand transition-colors"
              >
                {link.label}
                <span className="text-muted text-lg" aria-hidden>›</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </>
  )
}
