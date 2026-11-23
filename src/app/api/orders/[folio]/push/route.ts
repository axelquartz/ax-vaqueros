import { NextRequest, NextResponse } from 'next/server'
import { isServerSupabaseConfigured } from '@/lib/supabase/config'
import { getServerSupabase } from '@/lib/supabase/server'
import { findForCustomer } from '@/lib/orders/serverOrders'
import { ORDER_TOKEN_HEADER } from '@/lib/orders/customerApi'
import { parseSubscription } from '@/lib/push'

/** El cliente activa (POST) o desactiva (DELETE) avisos push de su pedido */
const FOLIO_RE = /^ORD-\d{4,6}$/
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function handle(req: NextRequest, params: Promise<{ folio: string }>, save: boolean) {
  if (!isServerSupabaseConfigured()) return json({ error: 'No disponible' }, 503)
  const { folio } = await params
  const token = req.headers.get(ORDER_TOKEN_HEADER) ?? ''
  const row = FOLIO_RE.test(folio) && token ? await findForCustomer(folio, token) : null
  if (!row) return json({ error: 'Pedido no encontrado' }, 404)
  const sub = parseSubscription(await req.json().catch(() => null))
  if (!sub) return json({ error: 'Suscripción inválida' }, 400)

  const db = getServerSupabase()
  if (!save) {
    await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint).eq('order_id', row.id)
    return json({ ok: true })
  }
  const { error } = await db.from('push_subscriptions').upsert({
    endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, role: 'customer', order_id: row.id, user_id: null,
  })
  if (error) { console.error('push sub', error); return json({ error: 'No se pudo activar' }, 500) }
  return json({ ok: true })
}

export const POST = (req: NextRequest, c: { params: Promise<{ folio: string }> }) => handle(req, c.params, true)
export const DELETE = (req: NextRequest, c: { params: Promise<{ folio: string }> }) => handle(req, c.params, false)
