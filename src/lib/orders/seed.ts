import ordersData from '@/data/orders.json'
import type { Order } from '@/types/order'
import { generateHistory } from './history'

/**
 * Los pedidos de ejemplo guardan fechas relativas ("-12" = hace 12 minutos)
 * para que la demo siempre se vea fresca. Aquí se convierten a ISO.
 */
export function resolveTimestamp(value: string, now = Date.now()): string {
  const rel = /^-(\d+)$/.exec(value)
  return rel ? new Date(now - Number(rel[1]) * 60_000).toISOString() : value
}

/** Pedidos activos de ejemplo (orders.json) */
export function seedActiveOrders(now = Date.now()): Order[] {
  return (ordersData.orders as Order[]).map(o => ({
    ...o,
    createdAt: resolveTimestamp(o.createdAt, now),
    updatedAt: resolveTimestamp(o.updatedAt, now),
  }))
}

/** Siembra completa: pedidos activos + historial para el dashboard */
export function seedOrders(now = Date.now()): Order[] {
  return [...seedActiveOrders(now), ...generateHistory(now)]
}
