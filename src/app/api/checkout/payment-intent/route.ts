import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const PLACEHOLDER = 'REEMPLAZA_CON_TU_CLAVE'
const isDemoMode  = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes(PLACEHOLDER)

export interface PaymentIntentRequest {
  amount:         number
  folio:          string
  deliveryMethod: string
  deliveryFee:    number
  customer: {
    name:        string
    phone:       string
    address?:    string
    tableNumber?: string
    notes?:      string
  }
  items: Array<{
    name:          string
    quantity:      number
    unitPrice:     number
    variantExtra:  number
    variantLabels: Record<string, string>
    subtotal:      number
  }>
}

export async function POST(req: NextRequest) {
  try {
    const body: PaymentIntentRequest = await req.json()
    const { amount, folio, customer, items, deliveryMethod, deliveryFee } = body

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Monto inválido' }, { status: 400 })
    }

    // Modo demo — sin claves reales
    if (isDemoMode) {
      return NextResponse.json({ clientSecret: 'demo_secret', demo: true })
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

    // Crear Customer en Stripe
    // TODO (producción): buscar Customer existente por email/teléfono en BD antes de crear uno nuevo
    const stripeCustomer = await stripe.customers.create({
      name:  customer.name,
      phone: customer.phone,
      metadata: {
        address:     customer.address     ?? '',
        tableNumber: customer.tableNumber ?? '',
        notes:       customer.notes       ?? '',
      },
    })

    // Serializar items para guardarlos en metadata del Payment Intent
    const itemsSummary = items
      .map(i => `${i.quantity}x ${i.name}${Object.keys(i.variantLabels).length ? ` (${Object.values(i.variantLabels).join(', ')})` : ''} $${i.subtotal}`)
      .join(' | ')

    // Crear Payment Intent vinculado al Customer
    const paymentIntent = await stripe.paymentIntents.create({
      amount:   Math.round(amount * 100), // Stripe usa centavos
      currency: 'mxn',
      customer: stripeCustomer.id,
      automatic_payment_methods: { enabled: true },
      metadata: {
        folio,
        deliveryMethod,
        deliveryFee:    String(deliveryFee),
        customerName:   customer.name,
        customerPhone:  customer.phone,
        itemsSummary,
        // Items en JSON para usarlos en el webhook al generar la factura
        itemsJson: JSON.stringify(
          items.map(i => ({
            description: `${i.name}${Object.keys(i.variantLabels).length ? ` — ${Object.values(i.variantLabels).join(', ')}` : ''}`,
            quantity:    i.quantity,
            unitPrice:   i.unitPrice + i.variantExtra,
            subtotal:    i.subtotal,
          }))
        ),
      },
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      customerId:   stripeCustomer.id,
    })
  } catch (err) {
    console.error('Stripe error:', err)
    return NextResponse.json({ error: 'No se pudo crear el intento de pago' }, { status: 500 })
  }
}
