import { NextRequest, NextResponse } from 'next/server'
import { PricingError, type OrderLineInput } from '@/lib/pricing'
import { CouponError } from '@/lib/promotions'
import { DeliveryZoneError, quoteOrder } from '@/lib/quote'
import { validPoint } from '@/lib/deliveryZones'

/** Vista previa del descuento (promo automática o cupón) para el carrito */
export async function POST(req: NextRequest) {
  let body: { items: OrderLineInput[]; deliveryMethod: string; coupon?: string; lat?: number; lng?: number }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 }) }
  try {
    const { priced, deliveryPending } = await quoteOrder(
      body.items, body.deliveryMethod, typeof body.coupon === 'string' ? body.coupon : undefined, validPoint(body.lat, body.lng),
    )
    return NextResponse.json({
      discount: priced.discount, promoName: priced.promoName ?? null, total: priced.total,
      deliveryFee: priced.deliveryFee, deliveryPending,
    })
  } catch (err) {
    if (err instanceof CouponError) return NextResponse.json({ error: err.message, coupon: true }, { status: 400 })
    if (err instanceof DeliveryZoneError) return NextResponse.json({ error: err.message, zone: true }, { status: 400 })
    if (err instanceof PricingError) return NextResponse.json({ error: err.message }, { status: 400 })
    throw err
  }
}
