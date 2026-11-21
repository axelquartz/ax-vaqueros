import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { priceOrder, PricingError, type OrderLineInput } from '@/lib/pricing'
import { getStoreStatusText, isStoreOpen } from '@/lib/storeHours'

const PLACEHOLDER = 'REEMPLAZA_CON_TU_CLAVE'
const isDemoMode  = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes(PLACEHOLDER)

/**
 * El cliente solo dice QUÉ pidió. Precios, subtotales, envío y total se
 * calculan aquí con el menú (src/lib/pricing.ts); cualquier monto que llegue
 * en el body se ignora.
 */
export interface PaymentIntentRequest {
  folio:          string
  deliveryMethod: string
  customer: {
    name:         string
    phone:        string
    address?:     string
    tableNumber?: string
    notes?:       string
  }
  items: OrderLineInput[]
}

export interface PaymentIntentResponse {
  clientSecret: string
  /** Total calculado por el servidor (MXN) */
  amount:       number
  demo?:        boolean
  customerId?:  string
}

const FOLIO_RE = /^ORD-\d{4,6}$/

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 })
}

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

  const { folio, customer, items, deliveryMethod } = body ?? {}
  if (typeof folio !== 'string' || !FOLIO_RE.test(folio)) return badRequest('Folio inválido')
  if (!customer?.name?.trim() || !customer?.phone?.trim()) return badRequest('Faltan datos del cliente')

  let order
  try {
    order = priceOrder(items, deliveryMethod)
  } catch (err) {
    if (err instanceof PricingError) return badRequest(err.message)
    throw err
  }

  // Modo demo — sin claves reales (el total igual se valida arriba)
  if (isDemoMode) {
    return NextResponse.json<PaymentIntentResponse>({ clientSecret: 'demo_secret', amount: order.total, demo: true })
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

    // TODO (producción): buscar Customer existente por teléfono en BD antes de crear uno nuevo
    const stripeCustomer = await stripe.customers.create({
      name:  customer.name,
      phone: customer.phone,
      metadata: {
        address:     customer.address     ?? '',
        tableNumber: customer.tableNumber ?? '',
        notes:       customer.notes       ?? '',
      },
    })

    const describe = (l: (typeof order.lines)[number]) =>
      `${l.name}${Object.keys(l.variantLabels).length ? ` (${Object.values(l.variantLabels).join(', ')})` : ''}`

    const paymentIntent = await stripe.paymentIntents.create({
      amount:   Math.round(order.total * 100), // Stripe usa centavos
      currency: 'mxn',
      customer: stripeCustomer.id,
      automatic_payment_methods: { enabled: true },
      metadata: {
        folio,
        deliveryMethod,
        deliveryFee:   String(order.deliveryFee),
        customerName:  customer.name,
        customerPhone: customer.phone,
        itemsSummary:  order.lines.map(l => `${l.quantity}x ${describe(l)} $${l.subtotal}`).join(' | '),
        // Items en JSON para el webhook que genera la factura
        itemsJson: JSON.stringify(order.lines.map(l => ({
          description: describe(l).replace(/ \((.*)\)$/, ' — $1'),
          quantity:    l.quantity,
          unitPrice:   l.unitPrice + l.variantExtra,
          subtotal:    l.subtotal,
        }))),
      },
    })

    return NextResponse.json<PaymentIntentResponse>({
      clientSecret: paymentIntent.client_secret!,
      amount:       order.total,
      customerId:   stripeCustomer.id,
    })
  } catch (err) {
    console.error('Stripe error:', err)
    return NextResponse.json({ error: 'No se pudo crear el intento de pago' }, { status: 500 })
  }
}
