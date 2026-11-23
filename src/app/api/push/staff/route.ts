import { NextRequest, NextResponse } from 'next/server'
import { isServerSupabaseConfigured } from '@/lib/supabase/config'
import { getServerSupabase } from '@/lib/supabase/server'
import { getStaff } from '@/lib/supabase/staff'
import { parseSubscription } from '@/lib/push'

/** El equipo (no repartidores) activa o desactiva avisos de pedidos nuevos */
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function handle(req: NextRequest, save: boolean) {
  if (!isServerSupabaseConfigured()) return json({ error: 'No disponible' }, 503)
  const staff = await getStaff(req)
  if (!staff || staff.role === 'rider') return json({ error: 'Sin acceso' }, 403)
  const sub = parseSubscription(await req.json().catch(() => null))
  if (!sub) return json({ error: 'Suscripción inválida' }, 400)
  const db = getServerSupabase()
  if (!save) {
    await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint).eq('user_id', staff.userId)
    return json({ ok: true })
  }
  const { error } = await db.from('push_subscriptions').upsert({
    endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, role: 'staff', order_id: null, user_id: staff.userId,
  })
  if (error) { console.error('push staff', error); return json({ error: 'No se pudo activar' }, 500) }
  return json({ ok: true })
}

export const POST = (req: NextRequest) => handle(req, true)
export const DELETE = (req: NextRequest) => handle(req, false)
