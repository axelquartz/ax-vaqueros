import { feeForDistance, haversineKm, parseTiers, validPoint, deliveryKm } from '@/lib/deliveryZones'
import { ordersToCsv, csvCell } from '@/lib/orders/export'
import { priceOrder } from '@/lib/pricing'
import type { Order } from '@/types/order'

describe('envío por distancia', () => {
  const tiers = [{ km: 3, fee: 35 }, { km: 5, fee: 45 }, { km: 8, fee: 65 }]

  it('cobra el primer tramo que alcanza y rechaza lo que pasa del último', () => {
    expect(feeForDistance(tiers, 0.5)).toBe(35)
    expect(feeForDistance(tiers, 3)).toBe(35)
    expect(feeForDistance(tiers, 3.1)).toBe(45)
    expect(feeForDistance(tiers, 8)).toBe(65)
    expect(feeForDistance(tiers, 8.1)).toBeNull()
  })

  it('haversine: ~111 km por grado de latitud', () => {
    expect(haversineKm({ lat: 20, lng: -103 }, { lat: 21, lng: -103 })).toBeCloseTo(111.2, 0)
    expect(deliveryKm({ lat: 20.7313, lng: -103.4079 })).toBe(0)
  })

  it('valida y ordena tramos', () => {
    expect(parseTiers([{ km: 5, fee: 45 }, { km: 3, fee: 35 }])).toEqual([{ km: 3, fee: 35 }, { km: 5, fee: 45 }])
    expect(parseTiers([])).toBeNull()
    expect(parseTiers([{ km: 3, fee: 35 }, { km: 3, fee: 40 }])).toBeNull()
    expect(parseTiers([{ km: 0, fee: 35 }])).toBeNull()
    expect(parseTiers([{ km: 3, fee: -1 }])).toBeNull()
    expect(parseTiers([{ km: 3, fee: 10.5 }])).toBeNull()
  })

  it('descarta puntos fuera de México', () => {
    expect(validPoint(20.7, -103.4)).toEqual({ lat: 20.7, lng: -103.4 })
    expect(validPoint(40, -3)).toBeNull()
    expect(validPoint('20', -103)).toBeNull()
  })

  it('el pedido usa el envío calculado solo a domicilio', () => {
    const items = [{ productId: 'agua', quantity: 1, selectedVariants: {} }]
    expect(priceOrder(items, 'delivery', undefined, null, 65).deliveryFee).toBe(65)
    expect(priceOrder(items, 'pickup', undefined, null, 65).deliveryFee).toBe(0)
  })
})

describe('CSV', () => {
  const order: Order = {
    id: 'ORD-1', createdAt: new Date(2026, 10, 21, 19, 5).toISOString(), updatedAt: new Date(2026, 10, 21, 19, 30).toISOString(),
    status: 'delivered', deliveryMethod: 'delivery', customer: { name: '=SUMA(1)', phone: '5512345678', notes: '' },
    items: [{ productId: 'a', name: 'Alitas, 8 pzas', quantity: 2, unitPrice: 190, variants: {}, subtotal: 380 }],
    subtotal: 380, deliveryFee: 45, total: 425,
  }

  it('escapa comas, comillas y fórmulas', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('di "hola"')).toBe('"di ""hola"""')
    expect(csvCell('=1+1')).toBe("'=1+1")
    expect(csvCell(-5)).toBe('-5')
  })

  it('BOM, CRLF, encabezado y fila', () => {
    const csv = ordersToCsv([order])
    expect(csv.startsWith('﻿Folio,Fecha')).toBe(true)
    const lines = csv.trim().split('\r\n')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toBe('ORD-1,2026-11-21,19:05,Entregado,Domicilio,\'=SUMA(1),5512345678,"2x Alitas, 8 pzas",380,0,,45,425')
  })
})
