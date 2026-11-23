import type { Product } from '@/types/menu'

/**
 * Promociones y cupones. Lógica pura (sin base de datos) para poder probarla.
 *
 * Reglas simples, pensadas para que el dueño las entienda:
 *  - Sin código: se aplica sola. Con código: el cliente lo escribe en el checkout.
 *  - El descuento solo toca los productos (nunca el envío).
 *  - Se aplica UNA sola: la que más descuente (no se acumulan).
 */

export interface Promotion {
  id: string
  name: string
  kind: 'percent' | 'amount'
  value: number
  scope: 'order' | 'category' | 'product'
  target: string | null
  code: string | null
  minSubtotal: number
  /** 0 = domingo … 6 = sábado; null = todos los días */
  days: number[] | null
  /** "HH:MM"; null = todo el día */
  startTime: string | null
  endTime: string | null
  /** "YYYY-MM-DD" */
  startsOn: string | null
  endsOn: string | null
  maxUses: number | null
  /** Pedidos pagados que ya la usaron (lo calcula el servidor) */
  uses: number
  active: boolean
}

export interface DiscountLine { productId: string; subtotal: number }
export interface AppliedPromo { id: string; name: string; discount: number }

export class CouponError extends Error {
  constructor(message: string) { super(message); this.name = 'CouponError' }
}

export const normalizeCode = (raw: string) => raw.trim().toUpperCase().replace(/\s+/g, '')

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Fecha/hora local del negocio (zona horaria dada) */
export function localParts(now: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
    }).formatToParts(now).map(p => [p.type, p.value]),
  )
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday)
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute), day }
}

/** ¿Está vigente ahora (fechas, día, horario, usos)? No revisa el carrito */
export function isActiveNow(p: Promotion, now: Date, timeZone: string): boolean {
  if (!p.active) return false
  if (p.maxUses != null && p.uses >= p.maxUses) return false
  const t = localParts(now, timeZone)
  if (p.startsOn && t.date < p.startsOn) return false
  if (p.endsOn && t.date > p.endsOn) return false
  if (p.days && p.days.length > 0 && !p.days.includes(t.day)) return false
  if (p.startTime && p.endTime) {
    const s = toMinutes(p.startTime), e = toMinutes(p.endTime)
    // Cruza medianoche (p. ej. 20:00–02:00)
    const inside = s <= e ? t.minutes >= s && t.minutes < e : t.minutes >= s || t.minutes < e
    if (!inside) return false
  }
  return true
}

/** Descuento en pesos de una promoción sobre el carrito (0 si no aplica) */
export function discountFor(p: Promotion, lines: DiscountLine[], catalog: Product[]): number {
  const subtotal = lines.reduce((s, l) => s + l.subtotal, 0)
  if (subtotal < p.minSubtotal) return 0
  const base = lines
    .filter(l => {
      if (p.scope === 'order') return true
      const prod = catalog.find(c => c.id === l.productId)
      return p.scope === 'product' ? l.productId === p.target : prod?.categoryId === p.target
    })
    .reduce((s, l) => s + l.subtotal, 0)
  if (base === 0) return 0
  const raw = p.kind === 'percent' ? Math.floor((base * p.value) / 100) : p.value
  return Math.min(raw, base)
}

/**
 * Mejor descuento disponible. Con `code` se considera también ese cupón; si el
 * código no existe o no se puede usar, lanza CouponError con un mensaje claro.
 */
export function pickPromotion(
  promos: Promotion[], lines: DiscountLine[], catalog: Product[], now: Date, timeZone: string, code?: string,
): AppliedPromo | null {
  const wanted = code ? normalizeCode(code) : ''
  let coupon: Promotion | undefined
  if (wanted) {
    coupon = promos.find(p => p.code === wanted && p.active)
    if (!coupon) throw new CouponError('Ese cupón no existe')
    if (coupon.maxUses != null && coupon.uses >= coupon.maxUses) throw new CouponError('Ese cupón ya se agotó')
    if (!isActiveNow(coupon, now, timeZone)) throw new CouponError('Ese cupón no está vigente ahora')
    const subtotal = lines.reduce((s, l) => s + l.subtotal, 0)
    if (subtotal < coupon.minSubtotal) throw new CouponError(`Ese cupón requiere un pedido de al menos $${coupon.minSubtotal}`)
    if (discountFor(coupon, lines, catalog) === 0) throw new CouponError('Ese cupón no aplica a los productos de tu pedido')
  }
  const candidates = promos.filter(p => (p.code === null && isActiveNow(p, now, timeZone)) || p === coupon)
  let best: AppliedPromo | null = null
  for (const p of candidates) {
    const discount = discountFor(p, lines, catalog)
    if (discount > (best?.discount ?? 0)) best = { id: p.id, name: p.name, discount }
  }
  return best
}
