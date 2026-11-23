'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useNow } from '@/hooks/useNow'
import { useOrders } from '@/hooks/useOrders'
import { clearRepositoryError, getOrderRepository, getRepositoryError, subscribeRepositoryError } from '@/lib/orders/repository'
import { ACTIVE_STATUSES, statusLabel, type OrderStatusId } from '@/lib/orders/status'
import { OrderCard } from './OrderCard'
import { useRiders } from '@/hooks/useRiders'
import type { Order } from '@/types/order'

type Tab = 'active' | 'delivered' | 'cancelled'

const TABS: { id: Tab; label: string }[] = [
  { id: 'active',    label: 'Activos' },
  { id: 'delivered', label: 'Entregados hoy' },
  { id: 'cancelled', label: 'Cancelados hoy' },
]

const COLUMN_TITLE: Partial<Record<OrderStatusId, string>> = {
  pending:   'Nuevos',
  confirmed: 'Confirmados',
  preparing: 'Preparando',
  ready:     'Listos',
}

const byOldest = (a: Order, b: Order) => a.createdAt.localeCompare(b.createdAt)
const byNewest = (a: Order, b: Order) => b.updatedAt.localeCompare(a.updatedAt)

/** Campanita de dos tonos con Web Audio (sin archivos) */
function playChime(ctx: AudioContext) {
  const t = ctx.currentTime
  ;[880, 1320].forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = freq
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.0001, t + i * 0.18)
    gain.gain.exponentialRampToValueAtTime(0.25, t + i * 0.18 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.35)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t + i * 0.18)
    osc.stop(t + i * 0.18 + 0.4)
  })
}

export function MerchantPanel() {
  const orders = useOrders()
  const now = useNow()
  const riders = useRiders()
  const [tab, setTab] = useState<Tab>('active')
  const [error, setError] = useState<string | null>(null)

  // ── Pedidos nuevos: resaltado + sonido opcional
  const seen = useRef<Set<string> | null>(null)
  const [newIds, setNewIds] = useState<Set<string>>(() => new Set())
  const [soundOn, setSoundOn] = useState(false)
  const audio = useRef<AudioContext | null>(null)

  useEffect(() => {
    if (orders.length === 0) return
    if (seen.current === null) {           // primera carga: nada es "nuevo"
      seen.current = new Set(orders.map(o => o.id))
      return
    }
    const arrived = orders.filter(o => !seen.current!.has(o.id))
    if (arrived.length === 0) return
    arrived.forEach(o => seen.current!.add(o.id))
    setNewIds(prev => new Set([...prev, ...arrived.map(o => o.id)]))
    if (soundOn && audio.current) playChime(audio.current)
  }, [orders, soundOn])

  const toggleSound = async () => {
    const next = !soundOn
    if (next) {
      // El navegador solo permite audio tras un gesto del usuario: se crea aquí
      audio.current ??= new AudioContext()
      await audio.current.resume()
      playChime(audio.current)
    }
    // Sin persistir: el navegador exige un toque por carga para reproducir audio
    setSoundOn(next)
  }

  // ── Datos derivados
  const active    = useMemo(() => orders.filter(o => ACTIVE_STATUSES.includes(o.status as OrderStatusId)).sort(byOldest), [orders])
  // Historial del turno: solo lo cerrado hoy (el resto vive en el dashboard)
  const dayStart  = useMemo(() => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.toISOString() }, [now])
  const delivered = useMemo(() => orders.filter(o => o.status === 'delivered' && o.updatedAt >= dayStart).sort(byNewest), [orders, dayStart])
  const cancelled = useMemo(() => orders.filter(o => o.status === 'cancelled' && o.updatedAt >= dayStart).sort(byNewest), [orders, dayStart])
  const pendingCount = active.filter(o => o.status === 'pending').length
  const counts: Record<Tab, number> = { active: active.length, delivered: delivered.length, cancelled: cancelled.length }

  // Pestaña del navegador: "(2) Pedidos" cuando hay nuevos sin confirmar
  useEffect(() => {
    document.title = `${pendingCount > 0 ? `(${pendingCount}) ` : ''}Pedidos — Vaquero's`
  }, [pendingCount])

  // ── Acciones
  const act = (fn: () => void) => {
    try { fn(); setError(null) } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo actualizar el pedido') }
  }
  const advance = (id: string, to: OrderStatusId) => act(() => {
    getOrderRepository().updateStatus(id, to)
    setNewIds(prev => { const n = new Set(prev); n.delete(id); return n })
  })
  const cancel = (id: string) => act(() => { getOrderRepository().updateStatus(id, 'cancelled') })

  const card = (o: Order) => (
    <OrderCard key={o.id} order={o} now={now} isNew={newIds.has(o.id)} onAdvance={advance} onCancel={cancel} riders={riders} onAssign={(id, riderId) => getOrderRepository().assignRider?.(id, riderId)} />
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      <SyncError />

      {/* Encabezado */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[1.625rem] font-bold leading-none text-foreground">Pedidos</h1>
          <p className="text-muted text-sm mt-1.5" aria-live="polite">
            {pendingCount > 0
              ? `${pendingCount} ${pendingCount === 1 ? 'pedido nuevo' : 'pedidos nuevos'} por confirmar`
              : 'Sin pedidos nuevos'}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={soundOn}
          className={[
            'shrink-0 min-h-10 px-4 rounded-full text-sm font-medium border transition-colors',
            soundOn ? 'bg-brand/10 border-brand/40 text-brand' : 'bg-surface border-border text-secondary hover:border-border-strong',
          ].join(' ')}
        >
          {soundOn ? 'Sonido activado' : 'Activar sonido'}
        </button>
      </div>

      {/* Pestañas */}
      <div role="tablist" aria-label="Estado de los pedidos" className="flex gap-1 p-1 bg-surface border border-border rounded-full w-fit max-w-full overflow-x-auto no-scrollbar">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={[
              'shrink-0 min-h-10 px-4 rounded-full text-sm font-medium transition-colors',
              tab === t.id ? 'bg-elevated text-foreground' : 'text-muted hover:text-foreground',
            ].join(' ')}
          >
            {t.label} <span className="tabular text-muted">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-error text-sm bg-error/10 border border-error/25 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Activos: columnas por estatus (apiladas en móvil) */}
      {tab === 'active' && (
        active.length === 0 ? (
          <p className="text-muted text-sm py-16 text-center">No hay pedidos activos. Los nuevos aparecerán aquí.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4 items-start">
            {ACTIVE_STATUSES.map(status => {
              const column = active.filter(o => o.status === status)
              return (
                <section key={status} aria-label={COLUMN_TITLE[status]} className="space-y-3">
                  <h2 className="flex items-baseline justify-between text-sm font-semibold text-secondary">
                    {COLUMN_TITLE[status]}
                    <span className="tabular text-muted font-normal">{column.length}</span>
                  </h2>
                  {column.length === 0
                    ? <p className="text-muted text-xs border border-dashed border-border rounded-2xl px-4 py-6 text-center">Sin pedidos</p>
                    : column.map(card)}
                </section>
              )
            })}
          </div>
        )
      )}

      {/* Historial */}
      {tab !== 'active' && (() => {
        const list = tab === 'delivered' ? delivered : cancelled
        return list.length === 0 ? (
          <p className="text-muted text-sm py-16 text-center">
            {tab === 'delivered' ? 'Aún no hay pedidos entregados hoy.' : 'No hay pedidos cancelados hoy.'}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 items-start">{list.map(card)}</div>
        )
      })()}

      <p className="sr-only" aria-live="assertive">
        {newIds.size > 0 ? `Llegó un pedido nuevo. ${statusLabel('pending')}.` : ''}
      </p>
    </div>
  )
}

/** Aviso cuando falla la conexión con la base de datos (el cambio ya se revirtió) */
function SyncError() {
  const message = useSyncExternalStore(subscribeRepositoryError, getRepositoryError, () => null)
  if (!message) return null
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-error/40 bg-error/10 px-4 py-3">
      <p className="text-error text-sm">{message}</p>
      <button type="button" onClick={clearRepositoryError} className="min-h-10 px-2 text-sm text-muted hover:text-foreground">
        Cerrar
      </button>
    </div>
  )
}
