import { getServerSupabase } from '@/lib/supabase/server'
import { isServerSupabaseConfigured } from '@/lib/supabase/config'
import type { Promotion } from '@/lib/promotions'
import { COLUMNS, rowToPromotion, type PromoRow } from '@/lib/promotionRows'

/** Promociones activas con sus usos (pedidos pagados). Sin base o con error: ninguna. */
export async function fetchPromotions(): Promise<Promotion[]> {
  if (!isServerSupabaseConfigured()) return []
  const db = getServerSupabase()
  const { data, error } = await db.from('promotions').select(COLUMNS).eq('active', true)
  if (error) { console.error('promotions', error); return [] }
  const rows = (data ?? []) as PromoRow[]
  const limited = rows.filter(r => r.max_uses != null).map(r => r.id)
  const uses = new Map<string, number>()
  if (limited.length > 0) {
    const { data: used } = await db.from('orders').select('promo_id').in('promo_id', limited).not('paid_at', 'is', null)
    for (const o of used ?? []) uses.set(o.promo_id, (uses.get(o.promo_id) ?? 0) + 1)
  }
  return rows.map(r => rowToPromotion(r, uses.get(r.id) ?? 0))
}
