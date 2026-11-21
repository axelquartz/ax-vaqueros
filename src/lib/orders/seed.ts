import ordersData from '@/data/orders.json'
import type { Order } from '@/types/order'

/**
 * Los pedidos de ejemplo guardan fechas relativas ("-12" = hace 12 minutos)
 * para que la demo siempre se vea fresca. Aquí se convierten a ISO.
 */
export function resolveTimestamp(value: string, now = Date.now()): string {
  const rel = /^-(\d+)$/.exec(value)
  return rel ? new Date(now - Number(rel[1]) * 60_000).toISOString() : value
}

export function seedOrders(now = Date.now()): Order[] {
  return (ordersData.orders as Order[]).map(o => ({
    ...o,
    createdAt: resolveTimestamp(o.createdAt, now),
    updatedAt: resolveTimestamp(o.updatedAt, now),
  }))
}
