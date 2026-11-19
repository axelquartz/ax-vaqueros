import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Sin firma' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature error:', err)
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent)
        break

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent)
        break

      default:
        // Ignorar eventos no manejados
        break
    }
  } catch (err) {
    console.error(`Error procesando evento ${event.type}:`, err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// ─── Handlers ─────────────────────────────────────────────

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const { folio, deliveryMethod, deliveryFee, customerName, itemsJson } = paymentIntent.metadata

  console.log(`✓ Pago confirmado — ${folio} (${customerName})`)

  if (!paymentIntent.customer || !itemsJson) {
    console.warn('Sin customer o items en metadata, omitiendo factura')
    return
  }

  const customerId = typeof paymentIntent.customer === 'string'
    ? paymentIntent.customer
    : paymentIntent.customer.id

  const items: Array<{
    description: string
    quantity:    number
    unitPrice:   number
    subtotal:    number
  }> = JSON.parse(itemsJson)

  // Crear Invoice Items para cada producto del pedido
  await Promise.all(
    items.map(item =>
      stripe.invoiceItems.create({
        customer:    customerId,
        amount:      Math.round(item.subtotal * 100), // total por línea
        currency:    'mxn',
        description: `${item.quantity}x ${item.description}`,
      })
    )
  )

  // Agregar envío como línea extra si aplica
  const fee = Number(deliveryFee ?? 0)
  if (fee > 0) {
    await stripe.invoiceItems.create({
      customer:    customerId,
      amount:      Math.round(fee * 100),
      currency:    'mxn',
      description: `Envío — ${deliveryMethod}`,
    })
  }

  // Crear la factura
  const invoice = await stripe.invoices.create({
    customer:     customerId,
    auto_advance: false, // No intentar cobrar de nuevo
    metadata: { folio, deliveryMethod },
    custom_fields: [{ name: 'Folio', value: folio }],
  })

  // Finalizar la factura
  await stripe.invoices.finalizeInvoice(invoice.id)

  // Marcar como pagada (el cargo ya se hizo vía Payment Intent)
  await stripe.invoices.pay(invoice.id, { paid_out_of_band: true })

  console.log(`📄 Factura generada — ${invoice.id} para ${folio}`)

  // TODO: actualizar estatus del pedido en BD y notificar cocina
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const { folio, customerName } = paymentIntent.metadata
  console.warn(`✗ Pago fallido — ${folio} (${customerName})`)
  // TODO: notificar al cliente y actualizar estatus en BD
}
