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
