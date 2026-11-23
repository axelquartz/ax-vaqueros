import type { SupabaseClient } from '@supabase/supabase-js'
import type { Order } from '@/types/order'
import { canTransition, type OrderStatusId } from './status'
import { OrderTransitionError, type OrderRepository } from './repository'
import { ORDER_COLUMNS, rowToOrder, type OrderRow } from './rows'

export interface SupabaseRepositoryOptions {
  /** Se llama cuando falla una operación (p. ej. sin conexión); el cambio se revierte */
  onError?: (message: string) => void
}

/**
 * Pedidos del panel desde Supabase. Lee con la sesión del equipo (las reglas
 * RLS solo dejan ver pedidos pagados) y recibe cambios en tiempo real.
 *
 * La interfaz es síncrona (useSyncExternalStore): list() devuelve lo que hay en
 * memoria; la carga inicial y Realtime llenan la memoria y avisan. Los cambios
 * de estatus se aplican al instante y se revierten si la base de datos los
 * rechaza.
 */
export function createSupabaseOrderRepository(
  db: SupabaseClient,
  { onError }: SupabaseRepositoryOptions = {},
): OrderRepository & { ready(): boolean } {
  let orders: Order[] = []
  let loaded = false
  let started = false
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach(l => l())

  const sorted = (list: Order[]) => [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const upsert = (order: Order) => {
    orders = sorted([order, ...orders.filter(o => o.id !== order.id)])
    notify()
  }

  async function load() {
    const { data, error } = await db
      .from('orders')
      .select(ORDER_COLUMNS)
      .not('paid_at', 'is', null)
      .order('created_at', { ascending: false })
    if (error) {
      onError?.('No se pudieron cargar los pedidos. Revisa tu conexión.')
      console.error('Supabase load error:', error)
      return
    }
    // Lo que llegó por Realtime durante la carga gana (es más reciente)
    const live = new Map(orders.map(o => [o.id, o]))
    orders = sorted([...(data as OrderRow[]).map(rowToOrder).filter(o => !live.has(o.id)), ...live.values()])
    loaded = true
    notify()
  }

  const RETRY_MS = 5_000

  function connect() {
    const channel = db
      .channel('orders-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
        const row = payload.new as OrderRow | undefined
        if (row?.id && row.paid_at) upsert(rowToOrder(row))
      })
      .subscribe(status => {
        // Al (re)conectar se vuelve a cargar para no perder pedidos de mientras
        if (status === 'SUBSCRIBED') void load()
        // Conexión caída (sueño de la compu, token vencido, red): reintentar
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setTimeout(() => {
            void db.removeChannel(channel)
            connect()
          }, RETRY_MS)
        }
      })
  }

  function start() {
    if (started) return
    started = true
    connect()
    void load()
    if (typeof window !== 'undefined') {
      // Un panel abierto por horas: al volver a la pestaña o recuperar internet, ponerse al día
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void load()
      })
      window.addEventListener('online', () => void load())
    }
  }

  return {
    ready: () => loaded,
    list: () => orders,
    get: id => orders.find(o => o.id === id),
    create() {
      throw new Error('Con Supabase los pedidos los crea el servidor al confirmarse el pago')
    },
    updateStatus(id, status: OrderStatusId) {
      const current = orders.find(o => o.id === id)
      if (!current) throw new OrderTransitionError(`No existe el pedido ${id}`)
      if (!canTransition(current.status, status)) {
        throw new OrderTransitionError(`No se puede pasar de ${current.status} a ${status}`)
      }
      const optimistic = { ...current, status, updatedAt: new Date().toISOString() }
      upsert(optimistic)

      void db
        .from('orders')
        .update({ status })
        .eq('id', id)
        .select(ORDER_COLUMNS)
        .single()
        .then(({ data, error }) => {
          if (error || !data) {
            // Revertir solo si nadie lo cambió mientras tanto
            if (orders.find(o => o.id === id) === optimistic) upsert(current)
            onError?.(`No se pudo actualizar ${id}. Intenta de nuevo.`)
            console.error('Supabase update error:', error)
            return
          }
          upsert(rowToOrder(data as OrderRow))
        })
      return optimistic
    },
    assignRider(id, riderId) {
      const current = orders.find(o => o.id === id)
      if (!current) return
      const optimistic = { ...current, riderId: riderId ?? undefined, rider: undefined }
      upsert(optimistic)
      void db
        .from('orders')
        .update({ rider_id: riderId })
        .eq('id', id)
        .select(ORDER_COLUMNS)
        .single()
        .then(({ data, error }) => {
          if (error || !data) {
            if (orders.find(o => o.id === id) === optimistic) upsert(current)
            onError?.(`No se pudo asignar el repartidor a ${id}.`)
            console.error('Supabase assign error:', error)
            return
          }
          upsert(rowToOrder(data as OrderRow))
        })
    },
    subscribe(listener) {
      listeners.add(listener)
      start()
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
