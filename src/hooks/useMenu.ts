'use client'

import { useEffect, useMemo, useState } from 'react'
import { applyOverrides, EMPTY_MENU_STATE, type MenuState } from '@/lib/menuState'
import type { Product } from '@/types/menu'

/**
 * Menú vigente: catálogo + precios/agotados del panel. Mientras carga (o si
 * falla) se usa el catálogo tal cual; se actualiza al volver a la pestaña.
 */
export function useMenu(): { products: Product[]; ordersPaused: boolean } {
  const [state, setState] = useState<MenuState>(EMPTY_MENU_STATE)
  useEffect(() => {
    const load = () =>
      fetch('/api/menu', { cache: 'no-store' })
        .then(r => (r.ok ? (r.json() as Promise<MenuState>) : null))
        .then(s => { if (s) setState(s) })
        .catch(() => {})
    void load()
    const onVisible = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
  const products = useMemo(() => applyOverrides(state.overrides), [state.overrides])
  return { products, ordersPaused: state.ordersPaused }
}
