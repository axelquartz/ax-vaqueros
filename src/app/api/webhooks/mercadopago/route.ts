import { NextRequest, NextResponse } from 'next/server'
import { isServerSupabaseConfigured } from '@/lib/supabase/config'
import { markPaidByPayment } from '@/lib/orders/serverOrders'
import { getPayment, isMercadoPagoConfigured, verifyWebhookSignature } from '@/lib/mercadopago'

/**
 * Aviso de Mercado Pago cuando cambia un pago. Garantiza que el pedido le
 * llegue a la cocina aunque el cliente cierre la página justo al pagar.
 *
 * No se confía en el contenido del aviso: con el id se consulta el pago a
 * Mercado Pago y solo se marca pagado si el monto y el folio coinciden. Si
 * existe MERCADOPAGO_WEBHOOK_SECRET, además se exige la firma.
 */
export async function POST(req: NextRequest) {
  if (!isMercadoPagoConfigured() || !isServerSupabaseConfigured()) {
    return NextResponse.json({ error: 'Webhook no configurado' }, { status: 503 })
  }

  const body = await req.json().catch(() => ({})) as { type?: string; data?: { id?: string | number } }
  const url = req.nextUrl
  const type = body.type ?? url.searchParams.get('type') ?? url.searchParams.get('topic')
  const dataId = String(url.searchParams.get('data.id') ?? body.data?.id ?? url.searchParams.get('id') ?? '')

  // Solo interesan pagos; el resto se confirma para que no se reintente
  if (type !== 'payment' || !/^\d+$/.test(dataId)) return NextResponse.json({ received: true })

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (secret && !verifyWebhookSignature({
    signature: req.headers.get('x-signature'),
    requestId: req.headers.get('x-request-id'),
    dataId,
    secret,
  })) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
  }

  try {
    const payment = await getPayment(dataId)
    const folio = await markPaidByPayment(payment)
    console.log(`Aviso de Mercado Pago: pago ${payment.id} (${payment.status}) → ${folio ?? 'sin pedido'}`)
    return NextResponse.json({ received: true })
  } catch (err) {
    // 500: Mercado Pago reintenta más tarde (marcar pagado es idempotente)
    console.error('Error procesando aviso de Mercado Pago:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
