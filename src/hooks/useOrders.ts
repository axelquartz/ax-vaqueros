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

/** Un pedido por folio, en vivo (undefined si no existe en este dispositivo/backend). */
export function useOrder(id: string): Order | undefined {
  return useSyncExternalStore(
    subscribe,
    () => getOrderRepository().get(id),
    () => undefined,
  )
}
