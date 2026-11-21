import type { Order } from '@/types/order'
import { canTransition, type OrderStatusId } from './status'
import { seedOrders } from './seed'

/**
 * Acceso a pedidos. Toda la UI (panel, checkout, estatus del cliente) pasa por
 * esta interfaz: para conectar Supabase basta con otra implementación de
 * OrderRepository en getOrderRepository(), sin tocar componentes.
 */
export interface OrderRepository {
  /** Snapshot estable (misma referencia mientras no cambie nada) */
  list(): Order[]
  get(id: string): Order | undefined
  create(order: Order): void
  updateStatus(id: string, status: OrderStatusId): Order
  /** Notifica cambios, incluidos los hechos en otras pestañas. Devuelve unsubscribe. */
  subscribe(listener: () => void): () => void
}

export class OrderTransitionError extends Error {}

export const STORAGE_KEY = 'ax_merchant_orders'

/**
 * Implementación de demo: localStorage + evento `storage` para sincronizar
 * pestañas (cliente en una, panel en otra) como si fuera tiempo real.
 * TODO (backend): reemplazar por Supabase + Realtime.
 */
export function createLocalOrderRepository(storage: Storage = window.localStorage): OrderRepository {
  let cache: Order[] | null = null
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach(l => l())

  const load = (): Order[] => {
    try {
      const raw = storage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw) as Order[]
    } catch { /* datos corruptos: se re-siembra */ }
    const seeded = seedOrders()
    save(seeded, false)
    return seeded
  }

  const save = (next: Order[], emit = true) => {
    cache = next
    try { storage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* sin storage: solo memoria */ }
    if (emit) notify()
  }

  const list = () => (cache ??= load())

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', e => {
      if (e.key !== STORAGE_KEY) return
      cache = null
      notify()
    })
  }

  return {
    list,
    get: id => list().find(o => o.id === id),
    create(order) {
      save([order, ...list().filter(o => o.id !== order.id)])
    },
    updateStatus(id, status) {
      const current = list().find(o => o.id === id)
      if (!current) throw new OrderTransitionError(`No existe el pedido ${id}`)
      if (!canTransition(current.status, status)) {
        throw new OrderTransitionError(`No se puede pasar de ${current.status} a ${status}`)
      }
      const updated = { ...current, status, updatedAt: new Date().toISOString() }
      save(list().map(o => (o.id === id ? updated : o)))
      return updated
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

let instance: OrderRepository | null = null

export function getOrderRepository(): OrderRepository {
  return (instance ??= createLocalOrderRepository())
}

/** Solo para pruebas */
export function resetOrderRepository() {
  instance = null
}
