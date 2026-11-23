import { describe, expect, it } from 'vitest'
import menuData from '@/data/menu.json'
import { CouponError, pickPromotion, type Promotion } from '@/lib/promotions'
import { priceOrder } from '@/lib/pricing'
import type { Product } from '@/types/menu'

const catalog = menuData.products as Product[]
const TZ = 'America/Mexico_City'
// Martes 2026-11-24 14:00 hora de México
const TUE_2PM = new Date('2026-11-24T20:00:00Z')
const lines = [{ productId: 'alitas-5', subtotal: 190 }, { productId: 'alitas-5', subtotal: 190 }]

const promo = (over: Partial<Promotion> = {}): Promotion => ({
  id: 'p1', name: 'Promo', kind: 'percent', value: 10, scope: 'order', target: null, code: null,
  minSubtotal: 0, days: null, startTime: null, endTime: null, startsOn: null, endsOn: null,
  maxUses: null, uses: 0, active: true, ...over,
})
const pick = (promos: Promotion[], code?: string, now = TUE_2PM) => pickPromotion(promos, lines, catalog, now, TZ, code)

describe('promociones', () => {
  it('aplica % automático sobre los productos', () => {
    expect(pick([promo()])?.discount).toBe(38)
  })
  it('monto fijo no pasa del subtotal', () => {
    expect(pick([promo({ kind: 'amount', value: 9999 })])?.discount).toBe(380)
  })
  it('solo el día y horario configurados', () => {
    const p = promo({ days: [2], startTime: '13:00', endTime: '16:00' })
    expect(pick([p])).not.toBeNull()
    expect(pick([promo({ days: [3] })])).toBeNull()
    expect(pick([promo({ startTime: '16:00', endTime: '18:00' })])).toBeNull()
  })
  it('horario que cruza medianoche', () => {
    const p = promo({ startTime: '20:00', endTime: '02:00' })
    expect(pick([p], undefined, new Date('2026-11-25T03:00:00Z'))).not.toBeNull() // 21:00 MX
    expect(pick([p])).toBeNull()
  })
  it('por producto y por categoría', () => {
    expect(pick([promo({ scope: 'product', target: 'alitas-5' })])?.discount).toBe(38)
    expect(pick([promo({ scope: 'product', target: 'otro' })])).toBeNull()
    const cat = catalog.find(p => p.id === 'alitas-5')!.categoryId
    expect(pick([promo({ scope: 'category', target: cat })])?.discount).toBe(38)
  })
  it('respeta el mínimo de compra', () => {
    expect(pick([promo({ minSubtotal: 500 })])).toBeNull()
  })
  it('el cupón se aplica solo con su código; sin código no cuenta', () => {
    const c = promo({ code: 'ALITAS10' })
    expect(pick([c])).toBeNull()
    expect(pick([c], ' alitas10 ')?.discount).toBe(38)
  })
  it('cupón inválido, agotado o fuera de vigencia da error claro', () => {
    expect(() => pick([promo({ code: 'AAA' })], 'ZZZ')).toThrow(CouponError)
    expect(() => pick([promo({ code: 'AAA', maxUses: 5, uses: 5 })], 'AAA')).toThrow(/agotó/)
    expect(() => pick([promo({ code: 'AAA', endsOn: '2026-11-01' })], 'AAA')).toThrow(/vigente/)
    expect(() => pick([promo({ code: 'AAA', minSubtotal: 900 })], 'AAA')).toThrow(/al menos \$900/)
  })
  it('no se acumulan: gana la que más descuenta', () => {
    const auto = promo({ id: 'a', value: 5 })
    const coupon = promo({ id: 'c', value: 20, code: 'GRANDE' })
    expect(pick([auto, coupon], 'GRANDE')?.id).toBe('c')
    expect(pick([auto, promo({ id: 'c', value: 2, code: 'CHICO' })], 'CHICO')?.id).toBe('a')
  })
  it('el descuento no toca el envío y el total cuadra', () => {
    const applied = pick([promo()])
    const priced = priceOrder([{ productId: 'dedos-queso-5', quantity: 2, selectedVariants: {} }], 'delivery', catalog, applied)
    expect(priced.discount).toBeGreaterThan(0)
    expect(priced.total).toBe(priced.subtotal - priced.discount + priced.deliveryFee)
  })
})
