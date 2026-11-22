import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { isServerSupabaseConfigured } from '@/lib/supabase/config'
import { markPaidByIntent } from '@/lib/orders/serverOrders'
import { getServerSupabase } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook no configurado' }, { status: 503 })
  }
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
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('Webhook signature error:', err)
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(stripe, event.data.object as Stripe.PaymentIntent)
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

async function handlePaymentSucceeded(stripe: Stripe, paymentIntent: Stripe.PaymentIntent) {
  const { folio, deliveryMethod, deliveryFee, customerName, itemsJson } = paymentIntent.metadata

  // 1. Lo importante: el pedido pasa a pagado y le llega al panel del restaurante.
  //    Si esto falla se responde 500 y Stripe reintenta (es idempotente).
  if (isServerSupabaseConfigured()) {
    const marked = await markPaidByIntent(paymentIntent)
    if (!marked) console.warn(`Pago ${paymentIntent.id} sin pedido válido en la base de datos`)
  }
  console.log(`✓ Pago confirmado — ${folio} (${customerName})`)

  // 2. La factura no debe bloquear el pedido: sus errores solo se registran
  try {
    await createInvoice(stripe, paymentIntent, folio, deliveryMethod, deliveryFee, itemsJson)
  } catch (err) {
    console.error(`No se pudo generar la factura de ${folio}:`, err)
  }
}

type InvoiceLine = { description: string; quantity: number; unitPrice: number; subtotal: number }

/** Productos del pedido: de la metadata de Stripe o, si no cupieron, de la base de datos */
async function invoiceLines(folio: string, itemsJson: string | undefined): Promise<InvoiceLine[] | null> {
  if (itemsJson) return JSON.parse(itemsJson)
  if (!isServerSupabaseConfigured()) return null
  const { data } = await getServerSupabase().from('orders').select('items').eq('id', folio).maybeSingle()
  if (!data) return null
  return (data.items as Array<{ name: string; quantity: number; unitPrice: number; subtotal: number; variants: Record<string, string> }>)
    .map(i => ({
      description: Object.keys(i.variants ?? {}).length ? `${i.name} — ${Object.values(i.variants).join(', ')}` : i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      subtotal: i.subtotal,
    }))
}

async function createInvoice(
  stripe: Stripe,
  paymentIntent: Stripe.PaymentIntent,
  folio: string,
  deliveryMethod: string,
  deliveryFee: string | undefined,
  itemsJson: string | undefined,
) {
  const items = await invoiceLines(folio, itemsJson)
  if (!paymentIntent.customer || !items) {
    console.warn('Sin customer o items, omitiendo factura')
    return
  }

  const customerId = typeof paymentIntent.customer === 'string'
    ? paymentIntent.customer
    : paymentIntent.customer.id

  // Crear la factura primero (API v2026+ requiere asociar items al invoice explícitamente)
  const invoice = await stripe.invoices.create({
    customer:     customerId,
    auto_advance: false,
    metadata: { folio, deliveryMethod },
    custom_fields: [{ name: 'Folio', value: folio }],
  })

  // Crear Invoice Items asociados al invoice recién creado
  await Promise.all(
    items.map(item =>
      stripe.invoiceItems.create({
        customer:    customerId,
        invoice:     invoice.id,
        amount:      Math.round(item.subtotal * 100),
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
      invoice:     invoice.id,
      amount:      Math.round(fee * 100),
      currency:    'mxn',
      description: `Envío — ${deliveryMethod}`,
    })
  }

  // Finalizar la factura
  await stripe.invoices.finalizeInvoice(invoice.id)

  // Marcar como pagada (el cargo ya se hizo vía Payment Intent)
  await stripe.invoices.pay(invoice.id, { paid_out_of_band: true })

  console.log(`📄 Factura generada — ${invoice.id} para ${folio}`)
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const { folio, customerName } = paymentIntent.metadata
  // El pedido sigue sin pagar (el equipo no lo ve); el cliente puede reintentar
  console.warn(`✗ Pago fallido — ${folio} (${customerName})`)
}
