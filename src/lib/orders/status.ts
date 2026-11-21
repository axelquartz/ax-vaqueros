import ordersData from '@/data/orders.json'

export type OrderStatusId = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled'

/** Flujo operativo de un pedido */
export const NEXT_STATUS: Partial<Record<OrderStatusId, OrderStatusId>> = {
  pending:   'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready:     'delivered',
}

/** Verbo del botón que mueve el pedido al siguiente estatus */
export const ACTION_LABEL: Partial<Record<OrderStatusId, string>> = {
  pending:   'Confirmar',
  confirmed: 'Empezar a preparar',
  preparing: 'Marcar listo',
  ready:     'Entregar',
}

export const ACTIVE_STATUSES: OrderStatusId[] = ['pending', 'confirmed', 'preparing', 'ready']
const CANCELLABLE: OrderStatusId[] = ['pending', 'confirmed', 'preparing']

export const isActive      = (s: string) => ACTIVE_STATUSES.includes(s as OrderStatusId)
export const canCancel     = (s: string) => CANCELLABLE.includes(s as OrderStatusId)
export const nextStatus    = (s: string) => NEXT_STATUS[s as OrderStatusId]

export function canTransition(from: string, to: string): boolean {
  if (to === 'cancelled') return canCancel(from)
  return nextStatus(from) === to
}

export function statusLabel(id: string): string {
  return ordersData.statuses.find(s => s.id === id)?.label ?? id
}

/** Minutos sin atender antes de marcar el pedido como urgente */
export const URGENT_AFTER_MIN = 15
