'use client'

import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { StatusTracker } from './StatusTracker'
import { FolioActions } from './FolioActions'
import { PaymentSuccess } from './PaymentSuccess'
import { findOrder } from '@/lib/orderHistory'
import ordersData from '@/data/orders.json'
import type { Order } from '@/types/order'
import type { BadgeColor } from '@/components/ui/Badge'

// Leaflet necesita `window`: solo en cliente
const OrderMap = dynamic(() => import('./OrderMap').then(m => m.OrderMap), { ssr: false })

interface OrderStatusProps {
  order: Order
  /** Llegó directo de un pago exitoso: mostrar la confirmación animada */
  justPaid?: boolean
}

const noopSubscribe = () => () => {}

/** Completa un pedido recién creado (sin datos en el mock) con lo guardado en este dispositivo */
function useHydratedOrder(order: Order): Order {
  const isPlaceholder = order.items.length === 0 && order.total === 0
  const raw = useSyncExternalStore(
    noopSubscribe,
    () => (isPlaceholder ? JSON.stringify(findOrder(order.id) ?? null) : 'null'),
    () => 'null',
  )
  return useMemo(() => {
    const saved = JSON.parse(raw) as ReturnType<typeof findOrder> | null
    if (!saved) return order
    return {
      ...order,
      deliveryMethod: saved.deliveryMethod,
      deliveryFee:    saved.deliveryFee ?? 0,
      total:          saved.total,
      items: (saved.items ?? []).map(i => ({
        productId: '', name: i.name, quantity: i.quantity,
        unitPrice: i.subtotal / i.quantity, variants: i.variants, subtotal: i.subtotal,
      })),
    }
  }, [raw, order])
}

export function OrderStatus({ order: baseOrder, justPaid = false }: OrderStatusProps) {
  const router = useRouter()
  const order  = useHydratedOrder(baseOrder)

  // Quita ?pagado=1 para que recargar la página no repita la animación
  useEffect(() => {
    if (justPaid) window.history.replaceState(null, '', window.location.pathname)
  }, [justPaid])
  const statusConfig   = ordersData.statuses.find(s => s.id === order.status)
  const deliveryMethod = ordersData.deliveryMethods.find(m => m.id === order.deliveryMethod)
  const isDelivery     = order.deliveryMethod === 'delivery'

  // Mostrar mapa cuando el pedido está en camino o listo (solo domicilio)
  const showMap = isDelivery && ['preparing', 'ready', 'delivered'].includes(order.status)

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-4">

      {justPaid && <PaymentSuccess />}

      {/* El resto entra después de la confirmación */}
      <div className={justPaid ? 'space-y-4 animate-fade-up [animation-delay:550ms]' : 'space-y-4'}>

      {/* Folio + badge */}
      <div className="bg-surface border border-border rounded-xl p-5 text-center space-y-3">
        <p className="text-secondary text-sm">Tu folio</p>
        <p className="font-display text-[2.125rem] font-bold leading-none text-foreground tabular tracking-[0.02em]">{order.id}</p>
        {statusConfig && (
          <Badge color={statusConfig.color as BadgeColor}>{statusConfig.label}</Badge>
        )}
        {deliveryMethod && (
          <p className="text-muted text-sm leading-snug">
            {deliveryMethod.label}
            <br />
            Listo en {deliveryMethod.eta}
          </p>
        )}
        {order.customer.notes && (
          <p className="text-secondary text-xs italic">"{order.customer.notes}"</p>
        )}
      </div>

      {/* Guardar folio */}
      <FolioActions folio={order.id} />

      {/* Tracker de estatus */}
      <StatusTracker currentStatus={order.status} isDelivery={isDelivery} />

      {/* Mapa de seguimiento (solo domicilio en tránsito) */}
      {showMap && <OrderMap />}

      {/* Desglose del pedido */}
      {order.items.length > 0 && (
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between items-start px-4 py-3 border-b border-border last:border-0">
            <div>
              <p className="text-foreground text-sm font-medium">{item.quantity}× {item.name}</p>
              {Object.values(item.variants).length > 0 && (
                <p className="text-muted text-xs mt-0.5">{Object.values(item.variants).join(', ')}</p>
              )}
            </div>
            <span className="text-foreground text-sm font-medium shrink-0">${item.subtotal}</span>
          </div>
        ))}
        {order.deliveryFee > 0 && (
          <div className="flex justify-between px-4 py-3 border-t border-border">
            <span className="text-secondary text-sm">Envío</span>
            <span className="text-foreground text-sm">${order.deliveryFee}</span>
          </div>
        )}
        <div className="flex justify-between px-4 py-3 border-t border-border bg-elevated">
          <span className="text-foreground text-sm font-semibold">Total</span>
          <span className="font-display text-xl font-bold leading-none text-foreground tabular">${order.total}</span>
        </div>
      </div>
      )}

      <Button variant="ghost" fullWidth onClick={() => router.push('/')}>
        Hacer otro pedido
      </Button>
      </div>
    </div>
  )
}
