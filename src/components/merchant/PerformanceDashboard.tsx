'use client'

import { useMemo, useState } from 'react'
import { useOrders } from '@/hooks/useOrders'
import { useNow } from '@/hooks/useNow'
import { ordersToCsv } from '@/lib/orders/export'
import {
  MONTH_LABEL, bucketsFor, change, firstOrderAt, inRange, loyalty, peakHours, periodRanges, salesByMethod, summarize, topProducts,
  type Bucket, type Period,
} from '@/lib/orders/analytics'

const PERIODS: { id: Period; label: string; compare: string; chart: string }[] = [
  { id: 'today', label: 'Hoy',        compare: 'vs. ayer a esta hora',       chart: 'Ventas por hora' },
  { id: '7d',    label: '7 días',     compare: 'vs. los 7 días anteriores',  chart: 'Ventas por día' },
  { id: '30d',   label: 'Último mes', compare: 'vs. los 30 días anteriores', chart: 'Ventas por día' },
  { id: '6m',    label: '6 meses',    compare: 'vs. los 6 meses anteriores', chart: 'Ventas por mes' },
  { id: 'all',   label: 'Histórico',  compare: '',                           chart: 'Ventas por mes' },
]

const formatDate = (t: number) => {
  const d = new Date(t)
  return `${d.getDate()} ${MONTH_LABEL[d.getMonth()]} ${d.getFullYear()}`
}

export const money = (n: number) => `$${Math.round(n).toLocaleString('es-MX')}`
const percent = (n: number) => `${Math.round(n * 100)}%`

/** Eje Y compacto: $800, $12k, $1.2M */
export function moneyCompact(n: number): string {
  if (n >= 1_000_000) return `$${+(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${+(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`
  return `$${Math.round(n)}`
}

/** Tope del eje redondeado a 1, 2 o 5 × 10ⁿ */
export function niceMax(value: number): number {
  if (value <= 0) return 1
  const pow = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 5, 10].find(s => s * pow >= value)!
  return step * pow
}

// ─── KPI ────────────────────────────────────────────────
interface KpiProps {
  label: string
  value: string
  /** undefined = el periodo no se compara (Histórico) */
  delta?: number | null
  /** true cuando bajar es bueno (p. ej. tiempo de entrega) */
  lowerIsBetter?: boolean
  compare: string
  note?: string
}

function Kpi({ label, value, delta, lowerIsBetter = false, compare, note }: KpiProps) {
  const flat = delta != null && Math.abs(delta) < 0.005
  const good = delta != null && !flat && (delta > 0) !== lowerIsBetter
  return (
    <div className="bg-surface border border-border rounded-2xl p-4">
      <p className="text-muted text-xs">{label}</p>
      <p className="font-display text-[1.75rem] font-bold leading-none text-foreground tabular mt-2">{value}</p>
      {delta !== undefined && <p className="text-xs mt-2 tabular">
        {delta === null ? (
          <span className="text-muted">Sin datos para comparar</span>
        ) : flat ? (
          <span className="text-muted">Igual {compare}</span>
        ) : (
          <>
            <span className={good ? 'text-success' : 'text-error'}>
              <span aria-hidden>{delta > 0 ? '▲' : '▼'}</span>{' '}
              <span className="sr-only">{delta > 0 ? 'Subió' : 'Bajó'} </span>
              {percent(Math.abs(delta))}
            </span>{' '}
            <span className="text-muted">{compare}</span>
          </>
        )}
      </p>}
      {note && <p className="text-muted text-xs mt-1">{note}</p>}
    </div>
  )
}

// ─── Gráfica de barras (una serie) ───────────────────────
function SalesChart({ title, buckets }: { title: string; buckets: Bucket[] }) {
  const [active, setActive] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)
  const max = niceMax(Math.max(...buckets.map(b => b.revenue), 0))
  const ticks = [max, max / 2, 0]
  // Etiquetas del eje X: todas si caben; si no, una de cada `step`
  const step = buckets.length > 16 ? Math.ceil(buckets.length / 7) : 1
  const dense = buckets.length > 8 && step === 1

  return (
    <div className="bg-surface border border-border rounded-2xl p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-secondary">{title}</h3>
        <button
          type="button"
          hidden={buckets.every(b => b.revenue === 0)}
          onClick={() => setShowTable(v => !v)}
          aria-pressed={showTable}
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          {showTable ? 'Ver gráfica' : 'Ver tabla'}
        </button>
      </div>

      {buckets.every(b => b.revenue === 0) ? (
        <p className="text-muted text-sm py-16 text-center">Aún no hay ventas en este periodo.</p>
      ) : showTable ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-xs text-left">
                <th className="font-normal py-1.5">Periodo</th>
                <th className="font-normal py-1.5 text-right">Pedidos</th>
                <th className="font-normal py-1.5 text-right">Ventas</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map(b => (
                <tr key={b.key} className="border-t border-border-subtle">
                  <td className="py-1.5 text-secondary">{b.label}</td>
                  <td className="py-1.5 text-right tabular text-secondary">{b.orders}</td>
                  <td className="py-1.5 text-right tabular text-foreground">{money(b.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 flex gap-3">
          {/* Eje Y */}
          <div className="relative h-44 w-10 shrink-0 text-[10px] text-muted tabular text-right">
            {ticks.map((t, i) => (
              <span key={i} className="absolute right-0 -translate-y-1/2" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}>
                {moneyCompact(t)}
              </span>
            ))}
          </div>

          <div className="relative flex-1 min-w-0">
            {/* Rejilla */}
            <div className="absolute inset-x-0 top-0 h-44 pointer-events-none" aria-hidden>
              {ticks.map((_, i) => (
                <div key={i} className="absolute inset-x-0 border-t border-border-subtle" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }} />
              ))}
            </div>

            {/* Barras */}
            <div className="relative h-44 flex items-end gap-[2px]" onMouseLeave={() => setActive(null)}>
              {buckets.map((b, i) => (
                <button
                  key={b.key}
                  type="button"
                  aria-label={`${b.label}: ${money(b.revenue)}, ${b.orders} pedidos`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="relative flex-1 h-full flex items-end justify-center group outline-none"
                >
                  <span
                    className={`block w-full max-w-8 rounded-t-[4px] transition-opacity ${active === null || active === i ? 'bg-brand' : 'bg-brand opacity-40'} group-focus-visible:ring-2 group-focus-visible:ring-brand-light`}
                    style={{ height: `${(b.revenue / max) * 100}%`, minHeight: b.revenue > 0 ? 2 : 0 }}
                  />
                </button>
              ))}

              {/* Tooltip */}
              {active !== null && (
                <div
                  role="status"
                  className="absolute -top-2 z-10 -translate-x-1/2 -translate-y-full pointer-events-none whitespace-nowrap rounded-lg border border-border bg-elevated px-2.5 py-1.5 text-xs shadow-lg"
                  style={{ left: `${((active + 0.5) / buckets.length) * 100}%` }}
                >
                  <p className="text-muted">{buckets[active].label}</p>
                  <p className="text-foreground font-semibold tabular">{money(buckets[active].revenue)}</p>
                  <p className="text-secondary tabular">{buckets[active].orders} pedidos</p>
                </div>
              )}
            </div>

            {/* Eje X */}
            <div className="flex gap-[2px] mt-2 text-[10px] text-muted" aria-hidden>
              {buckets.map((b, i) => (
                <span
                  key={b.key}
                  className={`flex-1 min-w-0 text-center whitespace-nowrap ${
                    (buckets.length - 1 - i) % step ? 'invisible' : dense && i % 2 ? 'invisible sm:visible' : ''
                  }`}
                >
                  {b.label.replace(':00', '')}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Lista con barras horizontales ───────────────────────
function RankedList({ title, rows, empty }: {
  title: string
  rows: { key: string; label: string; value: number; detail: string }[]
  empty: string
}) {
  const max = Math.max(...rows.map(r => r.value), 0)
  return (
    <div className="bg-surface border border-border rounded-2xl p-4">
      <h3 className="text-sm font-semibold text-secondary">{title}</h3>
      {rows.length === 0 || max === 0 ? (
        <p className="text-muted text-sm py-6 text-center">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map(r => (
            <li key={r.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-foreground truncate">{r.label}</span>
                <span className="text-secondary tabular shrink-0">{r.detail}</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-elevated overflow-hidden" aria-hidden>
                <div className="h-full rounded-full bg-brand" style={{ width: `${(r.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Dashboard ──────────────────────────────────────────
export function PerformanceDashboard() {
  const orders = useOrders()
  const now = useNow()
  const [period, setPeriod] = useState<Period>('today')
  const meta = PERIODS.find(p => p.id === period)!

  const first = useMemo(() => firstOrderAt(orders), [orders])

  const data = useMemo(() => {
    const { current, previous } = periodRanges(period, now, first ?? now)
    const cur = inRange(orders, current)
    return {
      start: current.start,
      end: current.end,
      rows: cur,
      cur: summarize(cur),
      prev: previous ? summarize(inRange(orders, previous)) : null,
      buckets: bucketsFor(period, cur, current, now),
      top: topProducts(cur),
      methods: salesByMethod(cur),
      peaks: peakHours(cur),
      loyal: loyalty(cur, orders.filter(o => new Date(o.createdAt).getTime() < current.end)),
    }
  }, [orders, now, period, first])

  const exportCsv = () => {
    const blob = new Blob([ordersToCsv(data.rows)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const d = new Date(now)
    const a = document.createElement('a')
    a.href = url
    a.download = `pedidos-${period}-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (now === 0) return null // servidor: el dashboard se calcula en el cliente

  const { cur, prev } = data
  const compare = period === 'all' ? `desde el ${formatDate(data.start)}` : meta.compare
  const delta = (a: number, b: number | undefined) => (prev ? change(a, b ?? 0) : undefined)

  return (
    <section aria-labelledby="perf-title" className="max-w-6xl mx-auto px-4 pb-12 space-y-5">
      <div className="border-t border-border pt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="perf-title" className="font-display text-[1.625rem] font-bold leading-none text-foreground">Desempeño</h2>
          <p className="text-muted text-sm mt-1.5">Ventas pagadas, sin cancelaciones · {compare}</p>
        </div>
        <div role="tablist" aria-label="Periodo" className="flex gap-1 p-1 bg-surface border border-border rounded-full max-w-full overflow-x-auto no-scrollbar">
          {PERIODS.map(p => (
            <button
              key={p.id}
              role="tab"
              aria-selected={period === p.id}
              onClick={() => setPeriod(p.id)}
              className={[
                'shrink-0 min-h-10 px-4 rounded-full text-sm font-medium transition-colors',
                period === p.id ? 'bg-elevated text-foreground' : 'text-muted hover:text-foreground',
              ].join(' ')}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={exportCsv} disabled={data.rows.length === 0}
          className="min-h-10 px-4 rounded-full text-sm border border-border bg-surface text-secondary hover:text-foreground hover:border-border-strong transition-colors disabled:opacity-40">
          Exportar CSV · {meta.label}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Ventas" value={money(cur.revenue)} delta={delta(cur.revenue, prev?.revenue)} compare={compare} />
        <Kpi
          label="Pedidos"
          value={cur.orders.toLocaleString('es-MX')}
          delta={delta(cur.orders, prev?.orders)}
          compare={compare}
          note={cur.cancelled > 0 ? `${cur.cancelled} cancelados (${percent(cur.cancelRate)})` : 'Sin cancelaciones'}
        />
        <Kpi label="Ticket promedio" value={money(cur.avgTicket)} delta={delta(cur.avgTicket, prev?.avgTicket)} compare={compare} />
        <Kpi
          label="Tiempo de entrega"
          value={cur.avgFulfillmentMin === null ? '—' : `${cur.avgFulfillmentMin} min`}
          delta={!prev ? undefined : cur.avgFulfillmentMin === null || prev.avgFulfillmentMin === null ? null : change(cur.avgFulfillmentMin, prev.avgFulfillmentMin)}
          lowerIsBetter
          compare={compare}
          note="Promedio, de pedido a entregado"
        />
      </div>

      <SalesChart key={period} title={meta.chart} buckets={data.buckets} />

      <div className="grid gap-3 md:grid-cols-2">
        <RankedList
          title="Lo más vendido"
          empty="Aún no hay ventas en este periodo."
          rows={data.top.map(p => ({ key: p.productId, label: p.name, value: p.units, detail: `${p.units} uds · ${money(p.revenue)}` }))}
        />
        <RankedList
          title="Por tipo de pedido"
          empty="Aún no hay ventas en este periodo."
          rows={data.methods.map(m => ({ key: m.id, label: m.label, value: m.orders, detail: `${m.orders} · ${percent(m.share)}` }))}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <RankedList
          title="Horas pico"
          empty="Aún no hay ventas en este periodo."
          rows={data.peaks.map(h => ({ key: String(h.hour), label: h.label, value: h.orders, detail: `${h.orders} pedidos · ${money(h.revenue)}` }))}
        />
        <RankedList
          title={`Clientes recurrentes · ${data.loyal.returning} de ${data.loyal.customers} (${percent(data.loyal.returningShare)})`}
          empty="Aún no hay clientes que hayan repetido."
          rows={data.loyal.top.map(c => ({ key: c.key, label: c.name, value: c.orders, detail: `${c.orders} pedidos · ${money(c.revenue)}` }))}
        />
      </div>
    </section>
  )
}
