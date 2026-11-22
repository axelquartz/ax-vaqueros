'use client'

import { useEffect } from 'react'

const BADGE_SELECTOR = '#nl-badge-frame'
const VAR = '--host-badge-inset'

/**
 * El plan gratuito de Netlify inyecta una insignia fija abajo a la derecha,
 * por encima de todo. No la ocultamos (sus términos no lo permiten): medimos
 * cuánto ocupa y exponemos esa altura en `--host-badge-inset` para que las
 * barras fijas de abajo (carrito, hoja de producto) y el final de la página
 * se recorran hacia arriba y no queden tapadas.
 *
 * Si la insignia no existe (otro hosting, plan de pago) o el visitante la
 * oculta, la variable vuelve a 0 y nada cambia.
 */
export function HostBadgeInset() {
  useEffect(() => {
    const root = document.documentElement
    let current = -1

    const measure = () => {
      const badge = document.querySelector<HTMLElement>(BADGE_SELECTOR)
      let inset = 0
      if (badge && badge.offsetWidth > 0 && badge.offsetHeight > 0 && getComputedStyle(badge).display !== 'none') {
        const rect = badge.getBoundingClientRect()
        // Espacio desde el borde superior de la insignia hasta el fondo de la ventana
        if (rect.top < window.innerHeight) inset = Math.ceil(window.innerHeight - rect.top)
      }
      if (inset === current) return
      current = inset
      if (inset) root.style.setProperty(VAR, `${inset}px`)
      else root.style.removeProperty(VAR)
    }

    measure()
    // La insignia se inyecta después de cargar y puede ocultarse o cambiar de tamaño
    const observer = new MutationObserver(measure)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] })
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
      root.style.removeProperty(VAR)
    }
  }, [])

  return null
}
