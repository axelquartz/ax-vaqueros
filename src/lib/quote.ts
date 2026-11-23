import { priceOrder, type OrderLineInput } from '@/lib/pricing'
import { pickPromotion } from '@/lib/promotions'
import { fetchPromotions } from '@/lib/promotionsServer'
import { fetchMenuState } from '@/lib/menuStateServer'
import { applyOverrides } from '@/lib/menuState'
import hours from '@/data/hours.json'

/**
 * Cotización del servidor: precios del menú + mejor promoción/cupón.
 * La usan /api/checkout/quote (vista previa) y /api/checkout/order (el cobro real).
 */
export async function quoteOrder(items: OrderLineInput[], deliveryMethod: string, coupon?: string) {
  const menu = await fetchMenuState()
  const catalog = applyOverrides(menu.overrides)
  const base = priceOrder(items, deliveryMethod, catalog)
  const promos = await fetchPromotions()
  const promo = pickPromotion(
    promos, base.lines.map(l => ({ productId: l.productId, subtotal: l.subtotal })),
    catalog, new Date(), hours.timezone, coupon,
  )
  return { priced: priceOrder(items, deliveryMethod, catalog, promo), menu }
}
