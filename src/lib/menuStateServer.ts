import { getServerSupabase } from '@/lib/supabase/server'
import { isServerSupabaseConfigured } from '@/lib/supabase/config'
import { EMPTY_MENU_STATE, type MenuState } from '@/lib/menuState'

/**
 * Lee precios/agotados y la pausa de pedidos. Si la base no responde, el
 * menú del catálogo sigue funcionando (no se cae la tienda por esto).
 */
export async function fetchMenuState(): Promise<MenuState> {
  if (!isServerSupabaseConfigured()) return EMPTY_MENU_STATE
  const db = getServerSupabase()
  const [products, settings] = await Promise.all([
    db.from('product_overrides').select('product_id, price, available'),
    db.from('store_settings').select('orders_paused').eq('id', 1).maybeSingle(),
  ])
  if (products.error) console.error('product_overrides', products.error)
  if (settings.error) console.error('store_settings', settings.error)
  return {
    overrides: (products.data ?? []).map(r => ({ productId: r.product_id, price: r.price, available: r.available })),
    ordersPaused: settings.data?.orders_paused ?? false,
  }
}
