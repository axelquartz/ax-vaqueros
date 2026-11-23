import { getServerSupabase } from '@/lib/supabase/server'
import { isServerSupabaseConfigured } from '@/lib/supabase/config'
import { DEFAULT_TIERS, parseTiers, type DeliveryTier } from '@/lib/deliveryZones'

/** Tramos de envío definidos en el admin; si la base no responde (o aún no hay migración), los de fábrica */
export async function fetchDeliveryTiers(): Promise<DeliveryTier[]> {
  if (!isServerSupabaseConfigured()) return DEFAULT_TIERS
  const { data, error } = await getServerSupabase().from('store_settings').select('delivery_tiers').eq('id', 1).maybeSingle()
  if (error) { console.error('delivery_tiers', error); return DEFAULT_TIERS }
  return parseTiers(data?.delivery_tiers) ?? DEFAULT_TIERS
}
