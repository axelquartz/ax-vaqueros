import type { Promotion } from '@/lib/promotions'

/** Filas de public.promotions → Promotion (sin dependencias de servidor) */
export interface PromoRow {
  id: string; name: string; kind: 'percent' | 'amount'; value: number
  scope: 'order' | 'category' | 'product'; target: string | null; code: string | null
  min_subtotal: number; days: number[] | null; start_time: string | null; end_time: string | null
  starts_on: string | null; ends_on: string | null; max_uses: number | null; active: boolean
}

export const COLUMNS = 'id, name, kind, value, scope, target, code, min_subtotal, days, start_time, end_time, starts_on, ends_on, max_uses, active'
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null)

export function rowToPromotion(r: PromoRow, uses = 0): Promotion {
  return {
    id: r.id, name: r.name, kind: r.kind, value: r.value, scope: r.scope, target: r.target, code: r.code,
    minSubtotal: r.min_subtotal, days: r.days && r.days.length ? r.days : null,
    startTime: hhmm(r.start_time), endTime: hhmm(r.end_time), startsOn: r.starts_on, endsOn: r.ends_on,
    maxUses: r.max_uses, uses, active: r.active,
  }
}
