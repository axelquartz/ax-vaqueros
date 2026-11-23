'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { findOrderToken } from '@/lib/orderHistory'
import { ORDER_TOKEN_HEADER, type CustomerOrderResponse } from '@/lib/orders/customerApi'
import { isActive } from '@/lib/orders/status'
import type { Order } from '@/types/order'

export const POLL_MS = 10_000
/** Envío en camino: más seguido para que el repartidor se mueva fluido */
export const POLL_ON_THE_WAY_MS = 5_000

export type CustomerOrderState =
  | { state: 'idle' }                       // sin Supabase o sin llave en este dispositivo
  | { state: 'loading' }
  | { state: 'unpaid'; order: Order }       // el pago aún no se confirma
  | { state: 'paid'; order: Order }
  | { state: 'not-found' }

/**
 * Estatus del pedido del cliente desde el servidor, con su llave privada.
 * Consulta cada 10 s mientras el pedido siga activo (o sin confirmar) y deja
 * de consultar al entregarse o cancelarse.
 */
const noopSubscribe = () => () => {}

export function useCustomerOrder(folio: string, enabled: boolean): CustomerOrderState {
  // La llave vive en localStorage: en el servidor no existe (undefined)
  const token = useSyncExternalStore(noopSubscribe, () => (enabled ? findOrderToken(folio) : undefined), () => undefined)
  const [result, setResult] = useState<{ key: string; value: CustomerOrderState } | null>(null)
  const key = `${folio}:${token}`

  useEffect(() => {
    if (!token) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false
    let onTheWay = false
    const set = (value: CustomerOrderState) => { if (!stopped) setResult({ key, value }) }

    const poll = async () => {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(folio)}`, {
          headers: { [ORDER_TOKEN_HEADER]: token },
          cache: 'no-store',
        })
        if (res.status === 404) return set({ state: 'not-found' })
        if (res.ok) {
          const data = (await res.json()) as CustomerOrderResponse
          set({ state: data.paid ? 'paid' : 'unpaid', order: data.order })
          if (data.paid && !isActive(data.order.status)) return // terminado: no seguir consultando
          onTheWay = data.order.deliveryMethod === 'delivery' && data.order.status === 'ready'
        }
      } catch {
        // Sin conexión: se reintenta en el siguiente ciclo
      }
      if (!stopped) timer = setTimeout(poll, onTheWay ? POLL_ON_THE_WAY_MS : POLL_MS)
    }

    void poll()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [folio, token, key])

  if (!enabled || !token) return { state: 'idle' }
  // Resultado de otro folio/llave (navegó a otro pedido): aún cargando
  return result?.key === key ? result.value : { state: 'loading' }
}
