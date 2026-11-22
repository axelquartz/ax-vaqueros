import type { Order } from '@/types/order'
import { canTransition, type OrderStatusId } from './status'
import { seedActiveOrders } from './seed'
import { generateHistory } from './history'
import { createSupabaseOrderRepository } from './supabaseRepository'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getBrowserSupabase } from '@/lib/supabase/browser'

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

// v3: el historial ya no se guarda (se genera en memoria); las versiones anteriores se re-siembran
export const STORAGE_KEY = 'ax_orders_v3'

export interface LocalRepositoryOptions {
  /** Agregar el historial de ejemplo para el dashboard (demo). Default: true */
  withHistory?: boolean
}

/**
 * Implementación de demo: localStorage + evento `storage` para sincronizar
 * pestañas (cliente en una, panel en otra) como si fuera tiempo real.
 *
 * Solo se guardan los pedidos "vivos" (los de ejemplo y los que llegan del
 * checkout). El historial de ejemplo (~1 año, miles de pedidos cerrados) no
 * cabe en localStorage: es determinista, así que se genera en memoria una vez.
 * TODO (backend): reemplazar por Supabase + Realtime.
 */
export function createLocalOrderRepository(
  storage: Storage = window.localStorage,
  { withHistory = true }: LocalRepositoryOptions = {},
): OrderRepository {
  let stored: Order[] | null = null
  let cache: Order[] | null = null
  let history: Order[] | null = null
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach(l => l())

  const load = (): Order[] => {
    try {
      const raw = storage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw) as Order[]
    } catch { /* datos corruptos: se re-siembra */ }
    const seeded = seedActiveOrders()
    persist(seeded)
    return seeded
  }

  const persist = (next: Order[]) => {
    try { storage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* sin storage: solo memoria */ }
  }

  const live = () => (stored ??= load())

  const save = (next: Order[]) => {
    stored = next
    cache = null
    persist(next)
    notify()
  }

  const list = () => {
    if (cache) return cache
    const own = live()
    if (withHistory) {
      history ??= generateHistory()
      const ids = new Set(own.map(o => o.id))
      cache = [...own, ...history.filter(o => !ids.has(o.id))]
    } else {
      cache = own
    }
    return cache
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', e => {
      if (e.key !== STORAGE_KEY) return
      stored = null
      cache = null
      notify()
    })
  }

  return {
    list,
    get: id => list().find(o => o.id === id),
    create(order) {
      save([order, ...live().filter(o => o.id !== order.id)])
    },
    updateStatus(id, status) {
      const current = list().find(o => o.id === id)
      if (!current) throw new OrderTransitionError(`No existe el pedido ${id}`)
      if (!canTransition(current.status, status)) {
        throw new OrderTransitionError(`No se puede pasar de ${current.status} a ${status}`)
      }
      const updated = { ...current, status, updatedAt: new Date().toISOString() }
      save(live().map(o => (o.id === id ? updated : o)))
      return updated
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

let instance: OrderRepository | null = null
let instanceOptions: LocalRepositoryOptions = {}

// ── Errores de sincronización (para avisar en el panel) ──
let lastError: string | null = null
const errorListeners = new Set<() => void>()
function reportError(message: string | null) {
  lastError = message
  errorListeners.forEach(l => l())
}
export const getRepositoryError = () => lastError
export const clearRepositoryError = () => reportError(null)
export function subscribeRepositoryError(listener: () => void) {
  errorListeners.add(listener)
  return () => { errorListeners.delete(listener) }
}

/**
 * Repositorio del panel: Supabase si está configurado (pedidos reales, en
 * tiempo real, solo para el equipo con sesión); si no, la demo local con
 * historial de ejemplo. Los clientes nunca usan esto: consultan su pedido por
 * la API (/api/orders/[folio]).
 */
export function getOrderRepository(): OrderRepository {
  if (instance) return instance
  instance = isSupabaseConfigured()
    ? createSupabaseOrderRepository(getBrowserSupabase(), { onError: reportError })
    : createLocalOrderRepository(window.localStorage, instanceOptions)
  return instance
}

/** Solo para pruebas: la siguiente llamada crea un repositorio nuevo */
export function resetOrderRepository(options: LocalRepositoryOptions = {}) {
  instance = null
  instanceOptions = options
  lastError = null
}
