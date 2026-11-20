const STORAGE_KEY = 'ax_orders'
const MAX_ORDERS  = 30

export interface SavedOrder {
  folio:          string
  timestamp:      string   // ISO
  total:          number
  deliveryMethod: string
  itemCount:      number
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
