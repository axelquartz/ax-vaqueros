import { NextRequest, NextResponse } from 'next/server'
import { priceOrder, PricingError, type OrderLineInput, type PricedOrder } from '@/lib/pricing'
import { getStoreStatusText, isStoreOpen } from '@/lib/storeHours'
import { isServerSupabaseConfigured } from '@/lib/supabase/config'
import { attachPaymentIntent, createDraft, updateDraft, type Draft } from '@/lib/orders/serverOrders'
import { getStripe } from '@/lib/stripe'
import type { Customer } from '@/types/order'

/**
 * El cliente solo dice QUÉ pidió. Precios, subtotales, envío y total se
 * calculan aquí con el menú (src/lib/pricing.ts); cualquier monto que llegue
 * en el body se ignora.
 *
 * Con Supabase, el pedido se guarda aquí como borrador sin pagar y el folio lo
 * genera el servidor. Si el total cambia en el paso de pago, el navegador
 * vuelve a llamar con `draft` y se actualiza el mismo pedido.
 */
export interface PaymentIntentRequest {
  deliveryMethod: string
  customer: {
    name:         string
    phone:        string
    address?:     string
    tableNumber?: string
    notes?:       string
  }
  items: OrderLineInput[]
  /** Borrador ya creado en esta sesión de checkout */
  draft?: Draft
}

export interface PaymentIntentResponse {
  clientSecret: string
  /** Total calculado por el servidor (MXN) */
  amount:       number
  folio:        string
  /** Llave privada del pedido para consultarlo (solo con Supabase) */
  accessToken?: string
  demo?:        boolean
  customerId?:  string
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 })
}

function cleanCustomer(c: PaymentIntentRequest['customer'], deliveryMethod: string): Customer {
  return {
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

const withinStripeLimit = (key: string, value: string) => (value.length <= 500 ? { [key]: value } : {})

/** Sin Supabase (demo): folio de muestra, no se guarda nada */
const demoFolio = () => `ORD-${Math.floor(10000 + Math.random() * 90000)}`

export async function POST(req: NextRequest) {
  let body: PaymentIntentRequest
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

  const { customer, items, deliveryMethod, draft } = body ?? {}
  if (typeof customer?.name !== 'string' || typeof customer?.phone !== 'string' ||
      !customer.name.trim() || !customer.phone.trim()) {
    return badRequest('Faltan datos del cliente')
  }

  let priced: PricedOrder
  try {
    priced = priceOrder(items, deliveryMethod)
  } catch (err) {
    if (err instanceof PricingError) return badRequest(err.message)
    throw err
  }

  const clean = cleanCustomer(customer, deliveryMethod)

  // 1. Guardar (o actualizar) el pedido sin pagar
  let saved: Draft | null = null
  if (isServerSupabaseConfigured()) {
    try {
      const input = { deliveryMethod, customer: clean, priced }
      if (isDraft(draft) && (await updateDraft(draft, input))) saved = draft
      else saved = await createDraft(input)
    } catch (err) {
      console.error('Supabase error:', err)
      return NextResponse.json({ error: 'No se pudo registrar el pedido. Intenta de nuevo.' }, { status: 500 })
    }
  }
  const folio = saved?.folio ?? demoFolio()
  const ids = { folio, accessToken: saved?.accessToken }

  // 2. Cobro. Modo demo — sin claves de Stripe (el total igual se valida arriba)
  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json<PaymentIntentResponse>({ clientSecret: 'demo_secret', amount: priced.total, demo: true, ...ids })
  }

  try {
    // TODO (producción): buscar Customer existente por teléfono antes de crear uno nuevo
    const stripeCustomer = await stripe.customers.create({
      name:  clean.name,
      phone: clean.phone,
      metadata: {
        address:     clean.address     ?? '',
        tableNumber: clean.tableNumber ?? '',
        notes:       clean.notes,
      },
    })

    const describe = (l: PricedOrder['lines'][number]) =>
      `${l.name}${Object.keys(l.variantLabels).length ? ` (${Object.values(l.variantLabels).join(', ')})` : ''}`

    const paymentIntent = await stripe.paymentIntents.create({
      amount:   Math.round(priced.total * 100), // Stripe usa centavos
      currency: 'mxn',
      customer: stripeCustomer.id,
      automatic_payment_methods: { enabled: true },
      metadata: {
        folio,
        deliveryMethod,
        deliveryFee:   String(priced.deliveryFee),
        customerName:  clean.name,
        customerPhone: clean.phone,
        itemsSummary:  priced.lines.map(l => `${l.quantity}x ${describe(l)} $${l.subtotal}`).join(' | ').slice(0, 500),
        // Stripe limita cada valor a 500 caracteres: con pedidos grandes la
        // factura toma los productos de la base de datos (ver webhook)
        ...withinStripeLimit('itemsJson', JSON.stringify(priced.lines.map(l => ({
          description: describe(l).replace(/ \((.*)\)$/, ' — $1'),
          quantity:    l.quantity,
          unitPrice:   l.unitPrice + l.variantExtra,
          subtotal:    l.subtotal,
        })))),
      },
    })

    if (saved) await attachPaymentIntent(folio, paymentIntent.id)

    return NextResponse.json<PaymentIntentResponse>({
      clientSecret: paymentIntent.client_secret!,
      amount:       priced.total,
      customerId:   stripeCustomer.id,
      ...ids,
    })
  } catch (err) {
    console.error('Stripe error:', err)
    return NextResponse.json({ error: 'No se pudo crear el intento de pago' }, { status: 500 })
  }
}
