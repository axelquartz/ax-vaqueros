import { NextRequest, NextResponse } from 'next/server'
import { isServerSupabaseConfigured } from '@/lib/supabase/config'
import { getServerSupabase } from '@/lib/supabase/server'
import { findForCustomer } from '@/lib/orders/serverOrders'
import { ORDER_TOKEN_HEADER } from '@/lib/orders/customerApi'
import { parseRefundReason } from '@/lib/refunds'
import { notifyStaff } from '@/lib/push'

/**
 * Solicitud de reembolso del cliente (folio + llave del pedido).
 * GET  → estado de su solicitud, si existe
 * POST → crea la solicitud (motivo obligatorio). Nunca devuelve dinero: el
 *        admin decide a mano desde el panel.
 */
const FOLIO_RE = /^ORD-\d{4,6}$/
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function authorize(req: NextRequest, params: Promise<{ folio: string }>) {
  if (!isServerSupabaseConfigured()) return { error: json({ error: 'No disponible' }, 503) }
  const { folio } = await params
  const token = req.headers.get(ORDER_TOKEN_HEADER) ?? ''
  const row = FOLIO_RE.test(folio) && token ? await findForCustomer(folio, token) : null
  if (!row) return { error: json({ error: 'Pedido no encontrado' }, 404) }
  return { row }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ folio: string }> }) {
  const auth = await authorize(req, params)
  if (auth.error) return auth.error
  const { data } = await getServerSupabase().from('refunds').select('status, reason, admin_note').eq('order_id', auth.row.id).maybeSingle()
  return json({ refund: data ? { ...data, admin_note: data.status === 'rejected' ? data.admin_note : '' } : null })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ folio: string }> }) {
  const auth = await authorize(req, params)
  if (auth.error) return auth.error
  if (!auth.row.paid_at || !auth.row.payment_intent_id) return json({ error: 'Este pedido no tiene un pago que reembolsar' }, 409)
  const reason = parseRefundReason(await req.json().catch(() => null))
  if (!reason) return json({ error: 'Cuéntanos el motivo (mínimo 5 caracteres)' }, 400)

  // Una sola solicitud por pedido (llave primaria)
  const { error } = await getServerSupabase().from('refunds').insert({ order_id: auth.row.id, reason })
  if (error?.code === '23505') return json({ error: 'Ya hay una solicitud para este pedido' }, 409)
  if (error) { console.error('refunds', error); return json({ error: 'No se pudo enviar tu solicitud' }, 500) }

  void notifyStaff({ title: 'Solicitud de reembolso', body: `${auth.row.id}: ${reason.slice(0, 80)}`, url: '/admin' })
  return json({ refund: { status: 'requested', reason, admin_note: '' } })
}
