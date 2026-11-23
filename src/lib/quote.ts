import { priceOrder, PricingError, type OrderLineInput } from '@/lib/pricing'
import { pickPromotion } from '@/lib/promotions'
import { fetchPromotions } from '@/lib/promotionsServer'
import { fetchMenuState } from '@/lib/menuStateServer'
import { applyOverrides } from '@/lib/menuState'
import hours from '@/data/hours.json'
import { fetchDeliveryTiers } from '@/lib/deliveryZonesServer'
import { deliveryKm, feeForDistance, maxCoverageKm, type Point } from '@/lib/deliveryZones'

/**
 * Cotización del servidor: precios del menú + mejor promoción/cupón.
 * La usan /api/checkout/quote (vista previa) y /api/checkout/order (el cobro real).
 */
export async function quoteOrder(
  items: OrderLineInput[], deliveryMethod: string, coupon?: string,
  point?: Point | null, opts: { strict?: boolean } = {},
) {
  const menu = await fetchMenuState()
  const catalog = applyOverrides(menu.overrides)

  // Envío a domicilio: se cobra por distancia. Sin punto, la vista previa lo deja pendiente; el cobro exige el punto.
  let deliveryFee: number | undefined
  let deliveryPending = false
  if (deliveryMethod === 'delivery') {
    if (point) {
      const tiers = await fetchDeliveryTiers()
      const fee = feeForDistance(tiers, deliveryKm(point))
      if (fee === null) throw new DeliveryZoneError(`Tu ubicación está fuera de nuestra zona de entrega (máximo ${maxCoverageKm(tiers)} km).`)
      deliveryFee = fee
    } else if (opts.strict) {
      throw new PricingError('Marca tu ubicación en el mapa para calcular el envío')
    } else {
      deliveryFee = 0
      deliveryPending = true
    }
  }

  const base = priceOrder(items, deliveryMethod, catalog, null, deliveryFee)
  const promos = await fetchPromotions()
  const promo = pickPromotion(
    promos, base.lines.map(l => ({ productId: l.productId, subtotal: l.subtotal })),
    catalog, new Date(), hours.timezone, coupon,
  )
  return { priced: priceOrder(items, deliveryMethod, catalog, promo, deliveryFee), menu, deliveryPending }
}

/** Ubicación fuera de la cobertura de envío */
export class DeliveryZoneError extends Error {
  constructor(message: string) { super(message); this.name = 'DeliveryZoneError' }
}
