'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import ordersData from '@/data/orders.json'
import { ACTION_LABEL, URGENT_AFTER_MIN, canCancel, isActive, nextStatus, statusLabel, type OrderStatusId } from '@/lib/orders/status'
import type { Order } from '@/types/order'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { RiderShare } from './RiderShare'
import type { Rider } from '@/hooks/useRiders'

export function minutesSince(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000))
}

export function formatElapsed(min: number): string {
  if (min < 1) return 'Ahora'
  if (min < 60) return `Hace ${min} min`
  const h = Math.floor(min / 60)
  return `Hace ${h} h ${min % 60} min`
}

/** Ruta en Google Maps hacia el cliente (punto del mapa, o la dirección escrita) */
function directionsUrl(order: Order): string {
  const { lat, lng, address } = order.customer
  const destination = lat != null && lng != null ? `${lat},${lng}` : address ?? ''
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
}

interface OrderCardProps {
  order: Order
  now: number
  isNew?: boolean
  onAdvance: (id: string, to: OrderStatusId) => void
  onCancel: (id: string) => void
  /** Repartidores disponibles; si hay, se muestra el selector de asignación */
  riders?: Rider[]
  onAssign?: (id: string, riderId: string | null) => void
}

export function OrderCard({ order, now, isNew = false, onAdvance, onCancel, riders = [], onAssign }: OrderCardProps) {
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const method  = ordersData.deliveryMethods.find(m => m.id === order.deliveryMethod)
  const next    = nextStatus(order.status)
  const action  = ACTION_LABEL[order.status as OrderStatusId]
  const elapsed = minutesSince(order.createdAt, now)
  const urgent  = isActive(order.status) && order.status !== 'ready' && elapsed >= URGENT_AFTER_MIN

  const destination =
    order.deliveryMethod === 'table'    && order.customer.tableNumber ? `Mesa ${order.customer.tableNumber}` :
    order.deliveryMethod === 'delivery' && order.customer.address     ? order.customer.address :
    method?.label

  return (
    <article
      aria-label={`Pedido ${order.id}`}
      className={[
        'bg-surface border rounded-2xl overflow-hidden transition-colors duration-300',
        isNew ? 'border-brand animate-fade-up' : urgent ? 'border-warning/50' : 'border-border',
      ].join(' ')}
    >
      {/* Folio + tiempo */}
      <header className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <p className="font-display text-xl font-bold leading-none text-foreground tabular">{order.id}</p>
          <p className="text-secondary text-sm mt-1.5 truncate" title={destination}>
            {order.deliveryMethod === 'delivery' && destination !== method?.label && (
              <span className="text-muted">{method?.label}: </span>
            )}
            {destination}
          </p>
          {order.deliveryMethod === 'delivery' && (order.customer.lat != null || order.customer.address) && (
            <a
              href={directionsUrl(order)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-1 text-brand text-xs font-medium hover:text-brand-light transition-colors"
            >
              Cómo llegar ↗
            </a>
          )}
        </div>
        <div className="text-right shrink-0">
          {isNew && <p className="text-brand text-xs font-semibold">Nuevo</p>}
          <p className={`text-xs tabular ${urgent ? 'text-warning font-semibold' : 'text-muted'}`}>
            {formatElapsed(elapsed)}
          </p>
        </div>
      </header>

      {/* Cliente */}
      <p className="px-4 mt-3 text-sm text-foreground">
        {order.customer.name}
        {order.customer.phone && (
          <a href={`tel:${order.customer.phone}`} className="ml-2 text-muted tabular hover:text-foreground transition-colors">
            {order.customer.phone}
          </a>
        )}
      </p>

      {/* Productos */}
      <ul className="px-4 mt-3 space-y-2">
        {order.items.map((item, i) => (
          <li key={i} className="flex justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="text-foreground">
                <span className="font-semibold tabular">{item.quantity}×</span> {item.name}
              </p>
              {Object.values(item.variants).length > 0 && (
                <p className="text-muted text-xs mt-0.5">{Object.values(item.variants).join(', ')}</p>
              )}
            </div>
            <span className="text-secondary tabular shrink-0">${item.subtotal}</span>
          </li>
        ))}
      </ul>

      {/* Notas: lo que la cocina no puede pasar por alto */}
      {order.customer.notes && (
        <p className="mx-4 mt-3 rounded-lg bg-warning/10 border border-warning/25 px-3 py-2 text-warning text-sm">
          {order.customer.notes}
        </p>
      )}

      {/* Asignar repartidor (solo domicilio, mientras el pedido siga abierto) */}
      {order.deliveryMethod === 'delivery' && isActive(order.status) && onAssign && riders.length > 0 && (
        <label className="mx-4 mt-3 flex items-center justify-between gap-3 text-sm">
          <span className="text-muted">Repartidor</span>
          <select
            value={order.riderId ?? ''}
            onChange={e => onAssign(order.id, e.target.value || null)}
            className="min-h-10 rounded-lg border border-border bg-elevated px-2 text-foreground text-sm"
          >
            <option value="">Sin asignar</option>
            {riders.map(r => <option key={r.userId} value={r.userId}>{r.name || 'Repartidor'}</option>)}
          </select>
        </label>
      )}

      {/* Repartidor: compartir GPS con el cliente mientras va en camino */}
      {order.deliveryMethod === 'delivery' && order.status === 'ready' && isSupabaseConfigured() && (
        <RiderShare orderId={order.id} />
      )}

      {/* Total + acciones */}
      <footer className="mt-4 px-4 py-3 border-t border-border-subtle">
        {confirmingCancel ? (
          <div className="flex items-center justify-between gap-3" role="group" aria-label="Confirmar cancelación">
            <p className="text-sm text-foreground">¿Cancelar este pedido?</p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setConfirmingCancel(false)}>No</Button>
              <Button variant="destructive" onClick={() => onCancel(order.id)}>Sí, cancelar</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-xl font-bold leading-none text-foreground tabular">${order.total}</span>
              {canCancel(order.status) && (
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(true)}
                  className="text-muted text-xs hover:text-error transition-colors"
                >
                  Cancelar
                </button>
              )}
            </div>
            {next && action ? (
              <Button onClick={() => onAdvance(order.id, next)}>{action}</Button>
            ) : (
              <span className="text-muted text-sm">{statusLabel(order.status)}</span>
            )}
          </div>
        )}
      </footer>
    </article>
  )
}
