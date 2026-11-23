import webpush from 'web-push'
import { getServerSupabase } from '@/lib/supabase/server'

/** Notificaciones push web (VAPID). Si faltan las llaves, todo es un no-op. */
export interface PushMessage { title: string; body: string; url?: string }

export function isPushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

export interface SubscriptionInput { endpoint: string; keys: { p256dh: string; auth: string } }

/** Valida lo que manda el navegador (PushSubscription.toJSON) */
export function parseSubscription(body: unknown): SubscriptionInput | null {
  const s = (body as { subscription?: SubscriptionInput } | null)?.subscription
  if (!s || typeof s.endpoint !== 'string' || !s.endpoint.startsWith('https://') || s.endpoint.length > 1000) return null
  if (typeof s.keys?.p256dh !== 'string' || typeof s.keys?.auth !== 'string') return null
  return { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } }
}

async function sendTo(rows: { endpoint: string; p256dh: string; auth: string }[], msg: PushMessage) {
  if (!isPushConfigured() || rows.length === 0) return
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'https://vaquerowings.com', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!)
  const payload = JSON.stringify({ url: '/', ...msg })
  const gone: string[] = []
  await Promise.all(rows.map(async r => {
    try {
      await webpush.sendNotification({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, payload, { TTL: 3600 })
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) gone.push(r.endpoint)   // suscripción caducada
      else console.error('push', code ?? err)
    }
  }))
  if (gone.length) await getServerSupabase().from('push_subscriptions').delete().in('endpoint', gone)
}

/** Avisa al cliente de un pedido (nunca lanza: un push fallido no rompe el flujo) */
export async function notifyOrder(orderId: string, msg: PushMessage): Promise<void> {
  try {
    const { data } = await getServerSupabase().from('push_subscriptions').select('endpoint, p256dh, auth').eq('order_id', orderId)
    await sendTo(data ?? [], { url: `/order/${orderId}`, ...msg })
  } catch (err) { console.error('notifyOrder', err) }
}

/** Avisa al equipo (cocina/admin), no a repartidores */
export async function notifyStaff(msg: PushMessage): Promise<void> {
  try {
    const { data } = await getServerSupabase().from('push_subscriptions').select('endpoint, p256dh, auth').eq('role', 'staff')
    await sendTo(data ?? [], { url: '/admin', ...msg })
  } catch (err) { console.error('notifyStaff', err) }
}
