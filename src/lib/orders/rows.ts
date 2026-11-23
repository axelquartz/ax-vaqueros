import type { Customer, Order, OrderItem } from '@/types/order'

/** Fila de public.orders tal como la devuelve Supabase */
export interface OrderRow {
  id: string
  created_at: string
  updated_at: string
  status: string
  delivery_method: string
  customer: Customer
  items: OrderItem[]
  subtotal: number
  delivery_fee: number
  total: number
  payment_intent_id?: string | null
  access_token?: string
  paid_at?: string | null
  rider_lat?: number | null
  rider_lng?: number | null
  rider_at?: string | null
}

/** Columnas que la app necesita (nunca el access_token hacia el panel) */
export const ORDER_COLUMNS =
  'id, created_at, updated_at, status, delivery_method, customer, items, subtotal, delivery_fee, total, paid_at, rider_lat, rider_lng, rider_at'

export function rowToOrder(row: OrderRow): Order {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    deliveryMethod: row.delivery_method,
    customer: row.customer,
    items: row.items,
    subtotal: row.subtotal,
    deliveryFee: row.delivery_fee,
    total: row.total,
    // La ubicación solo existe mientras va en camino (la base la borra al entregar)
    rider:
      row.status === 'ready' && row.rider_lat != null && row.rider_lng != null && row.rider_at
        ? { lat: row.rider_lat, lng: row.rider_lng, at: row.rider_at }
        : undefined,
  }
}
