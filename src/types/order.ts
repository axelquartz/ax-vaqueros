export interface OrderItem {
  productId: string
  name: string
  quantity: number
  unitPrice: number
  variants: Record<string, string>
  subtotal: number
}

export interface Customer {
  name: string
  phone: string
  address?: string
  tableNumber?: string
  notes: string
  /** Punto elegido en el mapa del checkout (solo domicilio) */
  lat?: number
  lng?: number
}

/** Última ubicación del repartidor (solo mientras el pedido va en camino) */
export interface RiderLocation {
  lat: number
  lng: number
  /** Cuándo se tomó (ISO) */
  at: string
}

export interface Order {
  id: string
  createdAt: string
  updatedAt: string
  status: string
  deliveryMethod: string
  customer: Customer
  items: OrderItem[]
  subtotal: number
  deliveryFee: number
  /** Descuento de promoción/cupón ya restado del total */
  discount?: number
  promoName?: string
  total: number
  /** Cuándo se reembolsó el pago (ya no cuenta como venta) */
  refundedAt?: string
  rider?: RiderLocation
  /** Repartidor asignado (user_id de staff) */
  riderId?: string
}

export interface DeliveryMethod {
  id: string
  label: string
  price: number
  eta: string
}

export interface OrderStatus {
  id: string
  label: string
  color: string
}
