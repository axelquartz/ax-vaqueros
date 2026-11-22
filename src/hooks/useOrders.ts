'use client'

import { useSyncExternalStore } from 'react'
import { getOrderRepository } from '@/lib/orders/repository'
import type { Order } from '@/types/order'

const EMPTY: Order[] = []
const subscribe = (cb: () => void) => getOrderRepository().subscribe(cb)

/** Todos los pedidos, en vivo. En el servidor devuelve [] (se llena al hidratar). */
export function useOrders(): Order[] {
  return useSyncExternalStore(subscribe, () => getOrderRepository().list(), () => EMPTY)
}

const noopSubscribe = () => () => {}

/**
 * Un pedido por folio, en vivo, desde el repositorio (demo local).
 * `enabled: false` no toca el repositorio (con Supabase el cliente consulta
 * su pedido por la API: useCustomerOrder).
 */
export function useOrder(id: string, { enabled = true }: { enabled?: boolean } = {}): Order | undefined {
  return useSyncExternalStore(
    enabled ? subscribe : noopSubscribe,
    () => (enabled ? getOrderRepository().get(id) : undefined),
    () => undefined,
  )
}
