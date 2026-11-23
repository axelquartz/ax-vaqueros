import { NextRequest, NextResponse } from 'next/server'
import { isServerSupabaseConfigured } from '@/lib/supabase/config'
import { getServerSupabase } from '@/lib/supabase/server'
import { getStaff } from '@/lib/supabase/staff'
import { isMercadoPagoConfigured, MercadoPagoError, refundPayment } from '@/lib/mercadopago'
import { parseRefundDecision } from '@/lib/refunds'
import { notifyOrder } from '@/lib/push'

/**
 * El admin aprueba o rechaza una solicitud de reembolso. Aprobar llama al
 * reembolso total de Mercado Pago. Solo staff que no sea repartidor.
 */
const FOLIO_RE = /^ORD-\d{4,6}$/
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(req: NextRequest, { params }: { params: Promise<{ folio: string }> }) {
  if (!isServerSupabaseConfigured()) return json({ error: 'No disponible' }, 503)
  const staff = await getStaff(req)
  if (!staff || staff.role === 'rider') return json({ error: 'Sin acceso' }, 403)

  const { folio } = await params
  const decision = parseRefundDecision(await req.json().catch(() => null))
  if (!FOLIO_RE.test(folio) || !decision) return json({ error: 'Solicitud inválida' }, 400)

  const db = getServerSupabase()
  const now = () => new Date().toISOString()

  if (decision.action === 'reject') {
    const { data } = await db.from('refunds')
      .update({ status: 'rejected', admin_note: decision.note, resolved_at: now() })
      .eq('order_id', folio).in('status', ['requested', 'failed']).select('order_id')
    if (!data?.length) return json({ error: 'La solicitud ya fue resuelta' }, 409)
    void notifyOrder(folio, { title: 'Solicitud de reembolso', body: 'Revisamos tu solicitud y no pudimos aprobarla. Entra a tu pedido para ver el detalle.' })
    return json({ status: 'rejected' })
  }

  if (!isMercadoPagoConfigured()) return json({ error: 'Mercado Pago no está configurado' }, 503)

  // Se "reclama" la solicitud antes de llamar a Mercado Pago: un doble clic no cobra dos veces
  const { data: claimed } = await db.from('refunds')
    .update({ status: 'processing' })
    .eq('order_id', folio).in('status', ['requested', 'failed']).select('order_id')
  if (!claimed?.length) return json({ error: 'La solicitud ya fue resuelta o se está procesando' }, 409)

  const { data: order } = await db.from('orders').select('payment_intent_id').eq('id', folio).maybeSingle()
  if (!order?.payment_intent_id) {
    await db.from('refunds').update({ status: 'failed', admin_note: 'El pedido no tiene pago ligado' }).eq('order_id', folio)
    return json({ error: 'El pedido no tiene pago ligado' }, 409)
  }

  try {
    const refund = await refundPayment(order.payment_intent_id)
    await db.from('refunds').update({ status: 'approved', mp_refund_id: String(refund.id), admin_note: decision.note, resolved_at: now() }).eq('order_id', folio)
    void notifyOrder(folio, { title: 'Reembolso aprobado', body: 'Te devolvimos el pago. Tu banco puede tardar unos días en reflejarlo.' })
    return json({ status: 'approved' })
  } catch (err) {
    const message = err instanceof MercadoPagoError ? err.message : 'Error al contactar a Mercado Pago'
    console.error('Reembolso fallido:', err)
    await db.from('refunds').update({ status: 'failed', admin_note: message.slice(0, 500) }).eq('order_id', folio)
    return json({ error: `Mercado Pago no pudo reembolsar: ${message}` }, 502)
  }
}
