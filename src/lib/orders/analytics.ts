import menuData from '@/data/menu.json'
import ordersData from '@/data/orders.json'
import hoursData from '@/data/hours.json'
import type { Order } from '@/types/order'

/**
 * Métricas de desempeño a partir de los pedidos. Funciones puras: reciben
 * pedidos y una ventana de tiempo, no saben de dónde vienen los datos.
 *
 * Criterios:
 * - Ventas = pedidos no cancelados (el pago es por adelantado en el checkout).
 * - Tiempo de entrega = de creado a entregado, solo pedidos entregados.
 */

export type Period = 'today' | '7d' | '30d' | '6m' | 'all'

export interface Range { start: number; end: number }

const DAY = 86_400_000

function startOfDay(t: number) {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function addMonths(t: number, months: number) {
  const d = new Date(t)
  d.setMonth(d.getMonth() + months)
  return d.getTime()
}

/**
 * Ventana del periodo y la anterior equivalente, para comparar.
 * "Histórico" va desde el primer pedido registrado y no tiene periodo anterior.
 */
export function periodRanges(
  period: Period,
  now: number,
  firstOrderAt = now,
): { current: Range; previous: Range | null } {
  switch (period) {
    case 'today': {
      const start = startOfDay(now)
      // Ayer hasta la misma hora: comparación justa a mitad del día
      return { current: { start, end: now }, previous: { start: start - DAY, end: now - DAY } }
    }
    case '7d':
    case '30d': {
      const days = period === '7d' ? 7 : 30
      const start = startOfDay(now) - (days - 1) * DAY
      return { current: { start, end: now }, previous: { start: start - days * DAY, end: now - days * DAY } }
    }
    case '6m': {
      const start = startOfDay(addMonths(now, -6))
      return { current: { start, end: now }, previous: { start: startOfDay(addMonths(now, -12)), end: addMonths(now, -6) } }
    }
    case 'all':
      return { current: { start: startOfDay(Math.min(firstOrderAt, now)), end: now }, previous: null }
  }
}

/** Fecha del primer pedido (para "Histórico") */
export function firstOrderAt(orders: Order[]): number | null {
  let min = Infinity
  for (const o of orders) {
    const t = new Date(o.createdAt).getTime()
    if (t < min) min = t
  }
  return min === Infinity ? null : min
}

/** Agrupación de la gráfica según el periodo */
export function bucketsFor(period: Period, orders: Order[], range: Range, now: number): Bucket[] {
  if (period === 'today') return salesByHour(orders, now)
  if (period === '7d' || period === '30d') return salesByDay(orders, range)
  return salesByMonth(orders, range)
}

export function inRange(orders: Order[], { start, end }: Range): Order[] {
  return orders.filter(o => {
    const t = new Date(o.createdAt).getTime()
    return t >= start && t < end
  })
}

const isSale = (o: Order) => o.status !== 'cancelled'

export interface Summary {
  revenue: number
  orders: number
  avgTicket: number
  /** Minutos promedio de creado a entregado; null si no hay entregados */
  avgFulfillmentMin: number | null
  cancelled: number
  cancelRate: number
}

export function summarize(orders: Order[]): Summary {
  const sales = orders.filter(isSale)
  const revenue = sales.reduce((s, o) => s + o.total, 0)
  const delivered = orders.filter(o => o.status === 'delivered')
  const fulfillment = delivered.map(o => (new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime()) / 60_000)
  const cancelled = orders.length - sales.length
  return {
    revenue,
    orders: sales.length,
    avgTicket: sales.length ? Math.round(revenue / sales.length) : 0,
    avgFulfillmentMin: fulfillment.length ? Math.round(fulfillment.reduce((s, m) => s + m, 0) / fulfillment.length) : null,
    cancelled,
    cancelRate: orders.length ? cancelled / orders.length : 0,
  }
}

/** Cambio relativo; null si no hay base para comparar */
export function change(current: number, previous: number): number | null {
  if (!previous) return null
  return (current - previous) / previous
}

export interface Bucket { key: string; label: string; revenue: number; orders: number }

/** Ventas por hora del día (solo las horas en que abre el local) */
export function salesByHour(orders: Order[], day: number): Bucket[] {
  const schedule = hoursData.schedule.find(s => s.day === new Date(day).getDay())
  const open = schedule?.open ? Number(schedule.open.split(':')[0]) : 12
  const close = schedule?.close ? Number(schedule.close.split(':')[0]) : 23
  const buckets: Bucket[] = []
  for (let h = open; h < close; h++) {
    buckets.push({ key: String(h), label: `${h}:00`, revenue: 0, orders: 0 })
  }
  for (const o of orders.filter(isSale)) {
    const b = buckets.find(b => Number(b.key) === new Date(o.createdAt).getHours())
    if (b) { b.revenue += o.total; b.orders += 1 }
  }
  return buckets
}

const DAY_LABEL = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
export const MONTH_LABEL = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Ventas por día dentro del rango (un bucket por día, incluidos los días en cero) */
export function salesByDay(orders: Order[], { start, end }: Range): Bucket[] {
  const buckets: Bucket[] = []
  // Una semana: "Sáb 21". Más largo: "21 nov" (evita confundir "Mar 27" con marzo)
  const long = end - start > 8 * DAY
  for (let t = startOfDay(start); t < end; t = startOfDay(t + DAY + 3_600_000)) {
    const d = new Date(t)
    const label = long ? `${d.getDate()} ${MONTH_LABEL[d.getMonth()]}` : `${DAY_LABEL[d.getDay()]} ${d.getDate()}`
    buckets.push({ key: String(t), label, revenue: 0, orders: 0 })
  }
  const index = new Map(buckets.map(b => [b.key, b]))
  for (const o of orders.filter(isSale)) {
    const b = index.get(String(startOfDay(new Date(o.createdAt).getTime())))
    if (b) { b.revenue += o.total; b.orders += 1 }
  }
  return buckets
}

/** Ventas por mes calendario (el primer y el último mes pueden ser parciales) */
export function salesByMonth(orders: Order[], { start, end }: Range): Bucket[] {
  const buckets: Bucket[] = []
  const d = new Date(start)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  while (d.getTime() < end) {
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: `${MONTH_LABEL[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      revenue: 0,
      orders: 0,
    })
    d.setMonth(d.getMonth() + 1)
  }
  const index = new Map(buckets.map((b, i) => [b.key, i]))
  for (const o of orders.filter(isSale)) {
    const c = new Date(o.createdAt)
    const i = index.get(`${c.getFullYear()}-${c.getMonth()}`)
    if (i !== undefined) { buckets[i].revenue += o.total; buckets[i].orders += 1 }
  }
  return buckets
}

export interface ProductStat { productId: string; name: string; units: number; revenue: number }

export function topProducts(orders: Order[], limit = 5): ProductStat[] {
  const map = new Map<string, ProductStat>()
  for (const o of orders.filter(isSale)) {
    for (const item of o.items) {
      const stat = map.get(item.productId) ?? {
        productId: item.productId,
        name: menuData.products.find(p => p.id === item.productId)?.name ?? item.name,
        units: 0,
        revenue: 0,
      }
      stat.units += item.quantity
      stat.revenue += item.subtotal
      map.set(item.productId, stat)
    }
  }
  return [...map.values()].sort((a, b) => b.units - a.units || b.revenue - a.revenue).slice(0, limit)
}

export interface MethodStat { id: string; label: string; orders: number; revenue: number; share: number }

export function salesByMethod(orders: Order[]): MethodStat[] {
  const sales = orders.filter(isSale)
  return ordersData.deliveryMethods.map(m => {
    const list = sales.filter(o => o.deliveryMethod === m.id)
    return {
      id: m.id,
      label: m.label,
      orders: list.length,
      revenue: list.reduce((s, o) => s + o.total, 0),
      share: sales.length ? list.length / sales.length : 0,
    }
  })
}

export interface HourStat { hour: number; label: string; orders: number; revenue: number }

/** Horas con más pedidos (las 24 posibles, solo las que tuvieron ventas), de mayor a menor */
export function peakHours(orders: Order[], limit = 5): HourStat[] {
  const hours = Array.from({ length: 24 }, (_, hour): HourStat => ({
    hour, label: `${hour}:00–${(hour + 1) % 24}:00`, orders: 0, revenue: 0,
  }))
  for (const o of orders.filter(isSale)) {
    const h = hours[new Date(o.createdAt).getHours()]
    h.orders += 1
    h.revenue += o.total
  }
  return hours.filter(h => h.orders > 0).sort((a, b) => b.orders - a.orders || b.revenue - a.revenue || a.hour - b.hour).slice(0, limit)
}

/** Identifica al cliente por teléfono (últimos 10 dígitos); sin teléfono, por nombre */
export function customerKey(o: Order): string {
  const digits = o.customer.phone.replace(/\D/g, '').slice(-10)
  return digits.length >= 7 ? digits : `n:${o.customer.name.trim().toLowerCase()}`
}

export interface CustomerStat { key: string; name: string; orders: number; revenue: number }

export interface Loyalty {
  customers: number
  /** Clientes del periodo con 2 o más pedidos en todo el historial */
  returning: number
  returningShare: number
  top: CustomerStat[]
}

/**
 * Recurrentes: clientes con ventas en el periodo que tienen 2+ pedidos en el
 * historial (hasta el fin del periodo). `all` es todo el historial de pedidos.
 */
export function loyalty(periodOrders: Order[], all: Order[], limit = 5): Loyalty {
  const inPeriod = new Set(periodOrders.filter(isSale).map(customerKey))
  const history = new Map<string, CustomerStat>()
  for (const o of all.filter(isSale)) {
    const key = customerKey(o)
    if (!inPeriod.has(key)) continue
    const s = history.get(key) ?? { key, name: o.customer.name || 'Cliente', orders: 0, revenue: 0 }
    s.orders += 1
    s.revenue += o.total
    history.set(key, s)
  }
  const stats = [...history.values()]
  const returning = stats.filter(s => s.orders >= 2)
  return {
    customers: inPeriod.size,
    returning: returning.length,
    returningShare: inPeriod.size ? returning.length / inPeriod.size : 0,
    top: returning.sort((a, b) => b.orders - a.orders || b.revenue - a.revenue).slice(0, limit),
  }
}
