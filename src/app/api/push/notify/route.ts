import { NextRequest, NextResponse } from 'next/server'
import { isServerSupabaseConfigured } from '@/lib/supabase/config'
import { getServerSupabase } from '@/lib/supabase/server'
import { getStaff } from '@/lib/supabase/staff'
import { notifyOrder } from '@/lib/push'
import { statusCopy } from '@/lib/orders/statusCopy'

/**
 * El panel llama aquí tras cambiar el estatus de un pedido. El estatus real se
 * lee de la base de datos (el del navegador se ignora).
 */
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(req: NextRequest) {
  if (!isServerSupabaseConfigured()) return json({ error: 'No disponible' }, 503)
  if (!(await getStaff(req))) return json({ error: 'Sin acceso' }, 403)
  const { orderId } = (await req.json().catch(() => ({}))) as { orderId?: unknown }
  if (typeof orderId !== 'string' || !/^ORD-\d{4,6}$/.test(orderId)) return json({ error: 'Pedido inválido' }, 400)

  const { data } = await getServerSupabase().from('orders').select('status, delivery_method, paid_at').eq('id', orderId).maybeSingle()
  if (!data?.paid_at) return json({ error: 'Pedido no encontrado' }, 404)
  const copy = statusCopy(data.status, data.delivery_method)
  await notifyOrder(orderId, { title: copy.title, body: copy.detail })
  return json({ ok: true })
}
