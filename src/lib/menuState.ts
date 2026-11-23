import menuData from '@/data/menu.json'
import type { Product } from '@/types/menu'

/** Ajustes del día sobre el catálogo (tabla product_overrides) */
export interface ProductOverride {
  productId: string
  price: number | null
  available: boolean | null
}

export interface MenuState {
  overrides: ProductOverride[]
  ordersPaused: boolean
}

export const EMPTY_MENU_STATE: MenuState = { overrides: [], ordersPaused: false }

/** Catálogo con los precios y la disponibilidad vigentes */
export function applyOverrides(overrides: ProductOverride[], base: Product[] = menuData.products as Product[]): Product[] {
  const byId = new Map(overrides.map(o => [o.productId, o]))
  return base.map(p => {
    const o = byId.get(p.id)
    if (!o) return p
    return { ...p, price: o.price ?? p.price, available: o.available ?? p.available }
  })
}
