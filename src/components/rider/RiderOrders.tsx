'use client'

import { Button } from '@/components/ui/Button'
import { RiderShare } from '@/components/merchant/RiderShare'
import { useOrders } from '@/hooks/useOrders'
import { getOrderRepository } from '@/lib/orders/repository'
import { isActive, statusLabel } from '@/lib/orders/status'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type { Order } from '@/types/order'

function directionsUrl(order: Order): string {
  const { lat, lng, address } = order.customer
  const destination = lat != null && lng != null ? `${lat},${lng}` : address ?? ''
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
}

/** Entregas del repartidor: la base (RLS) ya solo le devuelve las suyas */
export function RiderOrders() {
  const orders = useOrders()
  const mine = orders
    .filter(o => o.deliveryMethod === 'delivery' && isActive(o.status))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  if (!isSupabaseConfigured()) {
    return <p className="max-w-xl mx-auto px-4 py-10 text-warning text-sm">Esta vista necesita Supabase configurado.</p>
  }

  return (
    <main className="max-w-xl mx-auto px-4 py-6 space-y-4">
      <p className="text-muted text-xs">Mantén esta página abierta y la pantalla encendida mientras haces entregas.</p>
      {mine.length === 0 ? (
        <p className="text-muted text-sm py-16 text-center">No tienes entregas asignadas. Aparecerán aquí al instante.</p>
      ) : (
        mine.map(order => (
          <article key={order.id} aria-label={`Pedido ${order.id}`} className="bg-surface border border-border rounded-2xl overflow-hidden">
            <header className="px-4 pt-4 flex items-start justify-between gap-3">
              <p className="font-display text-xl font-bold leading-none text-foreground tabular">{order.id}</p>
              <span className="text-xs text-muted">{statusLabel(order.status)}</span>
            </header>
            <p className="px-4 mt-3 text-foreground text-sm">{order.customer.address ?? 'Ubicación en el mapa'}</p>
            <p className="px-4 mt-2 text-sm text-foreground">
              {order.customer.name}
              {order.customer.phone && (
                <a href={`tel:${order.customer.phone}`} className="ml-2 text-brand tabular">{order.customer.phone}</a>
              )}
            </p>
            {order.customer.notes && (
              <p className="mx-4 mt-3 rounded-lg bg-warning/10 border border-warning/25 px-3 py-2 text-warning text-sm">{order.customer.notes}</p>
            )}
            <div className="px-4 mt-3 flex items-center justify-between text-sm">
              <span className="text-muted">Cobrar</span>
              <span className="font-display text-xl font-bold text-foreground tabular">${order.total}</span>
            </div>
            <div className="px-4 mt-3">
              <a
                href={directionsUrl(order)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center min-h-12 rounded-xl border border-border text-brand font-medium text-sm hover:bg-overlay transition-colors"
              >
                Cómo llegar ↗
              </a>
            </div>
            {order.status === 'ready' ? (
              <>
                <RiderShare orderId={order.id} />
                <div className="p-4">
                  <Button fullWidth onClick={() => getOrderRepository().updateStatus(order.id, 'delivered')}>
                    Marcar como entregado
                  </Button>
                </div>
              </>
            ) : (
              <p className="px-4 py-4 text-muted text-xs">Aún en cocina. Cuando esté listo podrás salir y compartir tu ubicación.</p>
            )}
          </article>
        ))
      )}
    </main>
  )
}
