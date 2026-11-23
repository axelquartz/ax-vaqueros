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
  discount?: number
  promo_name?: string | null
  total: number
  payment_intent_id?: string | null
  access_token?: string
  paid_at?: string | null
  refunded_at?: string | null
  rider_lat?: number | null
  rider_lng?: number | null
  rider_at?: string | null
  rider_id?: string | null
}

/** Columnas que la app necesita (nunca el access_token hacia el panel) */
export const ORDER_COLUMNS =
  'id, created_at, updated_at, status, delivery_method, customer, items, subtotal, delivery_fee, discount, promo_name, total, paid_at, refunded_at, rider_lat, rider_lng, rider_at, rider_id'

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
    discount: row.discount || undefined,
    promoName: row.promo_name ?? undefined,
    total: row.total,
    refundedAt: row.refunded_at ?? undefined,
    riderId: row.rider_id ?? undefined,
    // La ubicación solo existe mientras va en camino (la base la borra al entregar)
    rider:
      row.status === 'ready' && row.rider_lat != null && row.rider_lng != null && row.rider_at
        ? { lat: row.rider_lat, lng: row.rider_lng, at: row.rider_at }
        : undefined,
  }
}
