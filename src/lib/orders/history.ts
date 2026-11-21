import menuData from '@/data/menu.json'
import hoursData from '@/data/hours.json'
import { priceOrder, type OrderLineInput } from '@/lib/pricing'
import type { Product, VariantGroup } from '@/types/menu'
import type { Order } from '@/types/order'

/**
 * Historial de ejemplo para el dashboard de desempeño (solo demo).
 * Genera pedidos ya cerrados (entregados o cancelados) de los últimos días,
 * con productos y precios reales del menú y dentro del horario del local.
 * Es determinista por día: la misma fecha siempre produce los mismos pedidos.
 * TODO (backend): eliminar cuando haya pedidos reales en Supabase.
 */

/** Un año: alcanza para comparar 6 meses contra los 6 anteriores */
export const HISTORY_DAYS = 365

const products = (menuData.products as Product[]).filter(p => p.available)
const variants = menuData.variants as Record<string, VariantGroup>

/** Peso relativo de cada producto (los platos fuertes se piden más) */
const WEIGHT: Record<string, number> = {
  'alitas-5': 6, 'alitas-8': 7, 'alitas-10': 5,
  'boneless-10': 8, 'boneless-16': 5, 'boneless-20': 3,
  'dedos-queso-5': 3, 'dedos-queso-8': 2, 'dedos-queso-10': 2,
  'tostilocos': 4, 'banderilla-crunch-queso': 4, 'banderilla-normal-queso': 3,
}
const EXTRAS = ['refresco', 'agua', 'punio-papas-francesa', 'punio-papas-gajo', 'punio-salchipulpos']

/** Peso de cada hora del día (más pedidos a la hora de la cena) */
const HOUR_WEIGHT: Record<number, number> = {
  12: 2, 13: 4, 14: 5, 15: 3, 16: 2, 17: 3, 18: 5, 19: 8, 20: 9, 21: 7, 22: 3,
}

const METHODS: [string, number][] = [['pickup', 40], ['table', 35], ['delivery', 25]]

/** PRNG determinista (mulberry32) */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickWeighted<T>(rand: () => number, entries: [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let r = rand() * total
  for (const [value, w] of entries) {
    if ((r -= w) < 0) return value
  }
  return entries[entries.length - 1][0]
}

function line(rand: () => number, product: Product, quantity: number): OrderLineInput {
  const selectedVariants: Record<string, string> = {}
  for (const groupId of product.variantGroups) {
    const group = variants[groupId]
    if (!group?.required) continue
    selectedVariants[groupId] = group.options[Math.floor(rand() * group.options.length)].id
  }
  return { productId: product.id, quantity, selectedVariants }
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Pedidos de un día. `until` limita el día actual a lo que ya pasó. */
function ordersForDay(day: Date, until: number, folioStart: number, scale: number): Order[] {
  const schedule = hoursData.schedule.find(s => s.day === day.getDay())
  if (!schedule?.open || !schedule.close) return []

  const seed = day.getFullYear() * 10_000 + (day.getMonth() + 1) * 100 + day.getDate()
  const rand = rng(seed)
  const weekend = [0, 5, 6].includes(day.getDay())
  const count = Math.round(((weekend ? 32 : 20) + rand() * 10) * scale)

  const openMin = toMinutes(schedule.open)
  const closeMin = toMinutes(schedule.close)
  const hours = Object.entries(HOUR_WEIGHT)
    .map(([h, w]) => [Number(h), w] as [number, number])
    .filter(([h]) => h * 60 >= openMin - 59 && h * 60 < closeMin)

  const mains = products.filter(p => WEIGHT[p.id]).map(p => [p, WEIGHT[p.id]] as [Product, number])
  const extras = products.filter(p => EXTRAS.includes(p.id))

  const orders: Order[] = []
  for (let i = 0; i < count; i++) {
    const hour = pickWeighted(rand, hours)
    const minute = Math.max(openMin, hour * 60 + Math.floor(rand() * 60))
    const created = new Date(day)
    created.setHours(0, minute, Math.floor(rand() * 60), 0)
    if (created.getTime() > until) continue

    const items: OrderLineInput[] = [line(rand, pickWeighted(rand, mains), rand() < 0.15 ? 2 : 1)]
    if (rand() < 0.35) items.push(line(rand, pickWeighted(rand, mains), 1))
    if (rand() < 0.6) items.push(line(rand, extras[Math.floor(rand() * extras.length)], 1 + Math.floor(rand() * 2)))

    const method = pickWeighted(rand, METHODS)
    const priced = priceOrder(items, method)
    const cancelled = rand() < 0.04
    // Tiempo hasta entregar: más largo a domicilio
    const minutes = method === 'delivery' ? 28 + rand() * 20 : 12 + rand() * 18
    const closedAt = new Date(created.getTime() + (cancelled ? 4 : minutes) * 60_000)
    if (closedAt.getTime() > until) continue

    orders.push({
      id: `ORD-${folioStart + i}`,
      createdAt: created.toISOString(),
      updatedAt: closedAt.toISOString(),
      status: cancelled ? 'cancelled' : 'delivered',
      deliveryMethod: method,
      customer: {
        name: 'Cliente',
        phone: '',
        tableNumber: method === 'table' ? String(1 + Math.floor(rand() * 12)) : undefined,
        address: method === 'delivery' ? 'Domicilio' : undefined,
        notes: '',
      },
      items: priced.lines.map(l => ({
        productId: l.productId,
        name: l.name,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        variants: l.variantLabels,
        subtotal: l.subtotal,
      })),
      subtotal: priced.subtotal,
      deliveryFee: priced.deliveryFee,
      total: priced.total,
    })
  }
  return orders
}

/**
 * Historial de los últimos HISTORY_DAYS días (incluye hoy hasta hace 45 min,
 * para no chocar con los pedidos activos de ejemplo).
 */
export function generateHistory(now = Date.now()): Order[] {
  const until = now - 45 * 60_000
  const all: Order[] = []
  for (let d = HISTORY_DAYS - 1; d >= 0; d--) {
    const day = new Date(now)
    day.setHours(0, 0, 0, 0)
    day.setDate(day.getDate() - d)
    // El negocio crece: hace un año vendía ~55% de lo que vende hoy
    const scale = 0.55 + 0.45 * (1 - d / (HISTORY_DAYS - 1))
    // Folios de 5 dígitos (10000+): el checkout usa 4, así nunca chocan
    all.push(...ordersForDay(day, until, 10_000 + (HISTORY_DAYS - 1 - d) * 100, scale))
  }
  return all
}
