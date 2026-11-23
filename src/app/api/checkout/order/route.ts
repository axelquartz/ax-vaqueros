import { NextRequest, NextResponse } from 'next/server'
import { PricingError, type OrderLineInput, type PricedOrder } from '@/lib/pricing'
import { CouponError } from '@/lib/promotions'
import { quoteOrder } from '@/lib/quote'
import { getStoreStatusText, isStoreOpen } from '@/lib/storeHours'
import { isServerSupabaseConfigured } from '@/lib/supabase/config'
import { createDraft, updateDraft, type Draft } from '@/lib/orders/serverOrders'
import { fetchMenuState } from '@/lib/menuStateServer'
import { isMercadoPagoConfigured } from '@/lib/mercadopago'
import type { Customer } from '@/types/order'

/**
 * Paso de pago: guarda el pedido sin pagar y devuelve el total.
 *
 * El cliente solo dice QUÉ pidió. Precios, subtotales, envío y total se
 * calculan aquí con el menú (src/lib/pricing.ts); cualquier monto que llegue
 * en el body se ignora. Con Supabase el folio lo genera el servidor; si el
 * cliente regresa y cambia algo, vuelve a llamar con `draft` y se actualiza el
 * mismo pedido. El cobro se hace después en /api/checkout/pay.
 */
export interface CheckoutOrderRequest {
  deliveryMethod: string
  customer: {
    name:         string
    phone:        string
    address?:     string
    tableNumber?: string
    notes?:       string
    /** Punto elegido en el mapa (solo domicilio) */
    lat?:         number
    lng?:         number
  }
  items: OrderLineInput[]
  /** Cupón escrito por el cliente (opcional) */
  coupon?: string
  /** Borrador ya creado en esta sesión de checkout */
  draft?: Draft
}

export interface CheckoutOrderResponse {
  /** Total calculado por el servidor (MXN) */
  amount:       number
  discount:     number
  folio:        string
  /** Llave privada del pedido para pagarlo y consultarlo (solo con Supabase) */
  accessToken?: string
  /** Sin Mercado Pago: el pago se simula */
  demo:         boolean
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 })
}

/** Coordenadas dentro de México; cualquier otra cosa se descarta */
function cleanCoords(c: CheckoutOrderRequest['customer']): { lat?: number; lng?: number } {
  const { lat, lng } = c
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return {}
  if (lat < 14 || lat > 33 || lng < -119 || lng > -86) return {}
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 }
}

function cleanCustomer(c: CheckoutOrderRequest['customer'], deliveryMethod: string): Customer {
  return {
    ...(deliveryMethod === 'delivery' ? cleanCoords(c) : {}),
    name:        c.name.trim().slice(0, 80),
    phone:       c.phone.trim().slice(0, 30),
    address:     deliveryMethod === 'delivery' ? c.address?.trim().slice(0, 200) : undefined,
    tableNumber: deliveryMethod === 'table' ? c.tableNumber?.trim().slice(0, 10) : undefined,
    notes:       (c.notes ?? '').trim().slice(0, 300),
  }
}

function isDraft(value: unknown): value is Draft {
  const d = value as Draft
  return typeof d?.folio === 'string' && typeof d?.accessToken === 'string'
}

/** Sin Supabase (demo): folio de muestra, no se guarda nada */
const demoFolio = () => `ORD-${Math.floor(10000 + Math.random() * 90000)}`

export async function POST(req: NextRequest) {
  let body: CheckoutOrderRequest
  try {
    body = await req.json()
  } catch {
    return badRequest('Solicitud inválida')
  }

  // El checkout ya bloquea pedidos fuera de horario, pero el servidor es quien manda
  if (!isStoreOpen()) {
    return NextResponse.json(
      { error: `${getStoreStatusText()}. Por ahora no estamos recibiendo pedidos.` },
      { status: 409 },
    )
  }

  const menu = await fetchMenuState()
  if (menu.ordersPaused) {
    return NextResponse.json(
      { error: 'Por ahora no estamos recibiendo pedidos. Intenta de nuevo en unos minutos.' },
      { status: 409 },
    )
  }

  const { customer, items, deliveryMethod, draft, coupon } = body ?? {}
  if (typeof customer?.name !== 'string' || typeof customer?.phone !== 'string' ||
      !customer.name.trim() || !customer.phone.trim()) {
    return badRequest('Faltan datos del cliente')
  }

  let priced: PricedOrder
  try {
    priced = (await quoteOrder(items, deliveryMethod, typeof coupon === 'string' ? coupon : undefined)).priced
  } catch (err) {
    if (err instanceof CouponError) return badRequest(err.message)
    if (err instanceof PricingError) return badRequest(err.message)
    throw err
  }

  let saved: Draft | null = null
  if (isServerSupabaseConfigured()) {
    try {
      const input = { deliveryMethod, customer: cleanCustomer(customer, deliveryMethod), priced }
      if (isDraft(draft) && (await updateDraft(draft, input))) saved = draft
      else saved = await createDraft(input)
    } catch (err) {
      console.error('Supabase error:', err)
      return NextResponse.json({ error: 'No se pudo registrar el pedido. Intenta de nuevo.' }, { status: 500 })
    }
  }

  return NextResponse.json<CheckoutOrderResponse>({
    amount: priced.total,
    discount: priced.discount,
    folio: saved?.folio ?? demoFolio(),
    accessToken: saved?.accessToken,
    demo: !isMercadoPagoConfigured(),
  })
}
