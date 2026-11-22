const STORAGE_KEY = 'ax_orders'
const MAX_ORDERS  = 30

export interface SavedOrderItem {
  name:     string
  quantity: number
  subtotal: number
  variants: Record<string, string>
}

export interface SavedOrder {
  folio:          string
  timestamp:      string   // ISO
  total:          number
  deliveryMethod: string
  itemCount:      number
  /** Detalle para la pantalla de confirmación (pedidos guardados antes no lo traen) */
  items?:         SavedOrderItem[]
  deliveryFee?:   number
  /** Llave privada para consultar el pedido en el servidor (con Supabase) */
  accessToken?:   string
}

export function findOrder(folio: string): SavedOrder | undefined {
  return readOrders().find(o => o.folio === folio)
}

export function saveOrder(order: SavedOrder): void {
  if (typeof window === 'undefined') return
  const existing = readOrders()
  const deduped  = [order, ...existing.filter(o => o.folio !== order.folio)]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped.slice(0, MAX_ORDERS)))
}

export function readOrders(): SavedOrder[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

// ── Llaves de pedidos aún sin pagar ──
// Se guardan antes de ir a Stripe: si el banco pide verificación y el
// navegador vuelve a /order/[folio] por redirección, la pantalla de estatus
// todavía puede consultar el pedido.
const TOKENS_KEY = 'ax_order_tokens'
const MAX_TOKENS = 10

function readTokens(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function rememberOrderToken(folio: string, token: string): void {
  if (typeof window === 'undefined') return
  const entries = Object.entries({ ...readTokens(), [folio]: token }).slice(-MAX_TOKENS)
  try { localStorage.setItem(TOKENS_KEY, JSON.stringify(Object.fromEntries(entries))) } catch { /* sin storage */ }
}

/** Llave del pedido guardada en este dispositivo (pagado o en proceso) */
export function findOrderToken(folio: string): string | undefined {
  if (typeof window === 'undefined') return undefined
  return findOrder(folio)?.accessToken ?? readTokens()[folio]
}
