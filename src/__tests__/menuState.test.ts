import { describe, expect, it } from 'vitest'
import { applyOverrides } from '@/lib/menuState'
import { priceOrder } from '@/lib/pricing'
import menuData from '@/data/menu.json'
import type { Product } from '@/types/menu'

const base = menuData.products as Product[]
const target = base.find(p => p.variantGroups.length === 0 && p.available)!

describe('menú con ajustes del panel', () => {
  it('sin ajustes deja el catálogo igual', () => {
    expect(applyOverrides([])).toEqual(base)
  })
  it('un precio ajustado manda sobre el del catálogo, y null lo respeta', () => {
    const p = applyOverrides([{ productId: target.id, price: 99, available: null }]).find(x => x.id === target.id)!
    expect(p.price).toBe(99)
    expect(p.available).toBe(true)
  })
  it('el servidor cobra el precio ajustado', () => {
    const catalog = applyOverrides([{ productId: target.id, price: 99, available: null }])
    const order = priceOrder([{ productId: target.id, quantity: 2, selectedVariants: {} }], 'pickup', catalog)
    expect(order.subtotal).toBe(198)
  })
  it('un producto agotado no se puede pedir', () => {
    const catalog = applyOverrides([{ productId: target.id, price: null, available: false }])
    expect(() => priceOrder([{ productId: target.id, quantity: 1, selectedVariants: {} }], 'pickup', catalog)).toThrow(/no está disponible/)
  })
})
