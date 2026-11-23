import { describe, expect, it } from 'vitest'
import { rowToOrder, type OrderRow } from '@/lib/orders/rows'

const base: OrderRow = {
  id: 'ORD-10000', created_at: '2026-11-22T20:00:00Z', updated_at: '2026-11-22T20:00:00Z',
  status: 'ready', delivery_method: 'delivery',
  customer: { name: 'Ana', phone: '3310000000', notes: '', address: 'Av. X 1', lat: 20.73, lng: -103.42 },
  items: [{ productId: 'agua', name: 'Agua', quantity: 1, unitPrice: 15, variants: {}, subtotal: 15 }],
  subtotal: 15, delivery_fee: 45, total: 60,
  rider_lat: 20.72, rider_lng: -103.41, rider_at: '2026-11-22T20:10:00Z',
}

describe('Ubicación del repartidor en el pedido', () => {
  it('se incluye mientras el pedido va en camino', () => {
    expect(rowToOrder(base).rider).toEqual({ lat: 20.72, lng: -103.41, at: '2026-11-22T20:10:00Z' })
  })
  it('no se expone en otro estatus ni sin coordenadas', () => {
    expect(rowToOrder({ ...base, status: 'delivered' }).rider).toBeUndefined()
    expect(rowToOrder({ ...base, rider_lat: null }).rider).toBeUndefined()
  })
  it('el punto de entrega del cliente viaja con el pedido', () => {
    expect(rowToOrder(base).customer).toMatchObject({ lat: 20.73, lng: -103.42 })
  })
})
