import type { Order } from '@/types/order'

/** Header con la llave privada del pedido (no va en la URL) */
export const ORDER_TOKEN_HEADER = 'x-order-token'

export interface CustomerOrderResponse {
  paid: boolean
  order: Order
}
