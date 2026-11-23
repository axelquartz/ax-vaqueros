'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { StatusTracker } from './StatusTracker'
import { ReviewCard } from './ReviewCard'
import { FolioActions } from './FolioActions'
import { PaymentSuccess } from './PaymentSuccess'
import { findOrder } from '@/lib/orderHistory'
import { useOrder } from '@/hooks/useOrders'
import { useCustomerOrder } from '@/hooks/useCustomerOrder'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { statusCopy } from '@/lib/orders/statusCopy'
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
  const fromHistory = useHydratedOrder(baseOrder)
  // En vivo: refleja los cambios de estatus que haga el restaurante.
  // Con Supabase se consulta al servidor; en la demo, al repositorio local.
  const online = isSupabaseConfigured()
  const remote = useCustomerOrder(baseOrder.id, online)
  const local  = useOrder(baseOrder.id, { enabled: !online })
  const remoteOrder = remote.state === 'paid' || remote.state === 'unpaid' ? remote.order : undefined
  const order = remoteOrder ?? local ?? fromHistory
  const announcement = useStatusAnnouncement((remoteOrder ?? local)?.status)

  // Quita ?pagado=1 para que recargar la página no repita la animación
  useEffect(() => {
    if (justPaid) window.history.replaceState(null, '', window.location.pathname)
  }, [justPaid])
  const statusConfig   = ordersData.statuses.find(s => s.id === order.status)
  const deliveryMethod = ordersData.deliveryMethods.find(m => m.id === order.deliveryMethod)
  const isDelivery     = order.deliveryMethod === 'delivery'

  // Mapa de seguimiento (solo domicilio): desde que se prepara hasta que llega
  const showMap = isDelivery && ['preparing', 'ready'].includes(order.status)
  const { lat, lng } = order.customer

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-4">

      {justPaid && <PaymentSuccess />}

      {/* Aviso cuando el restaurante avanza el pedido mientras el cliente mira */}
      <div aria-live="polite" className="fixed inset-x-0 z-[60] flex justify-center px-4 pointer-events-none" style={{ top: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}>
        {announcement && (
          <p key={announcement.id} role="status" className="max-w-sm w-full bg-elevated border border-brand/50 rounded-xl px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-rise-in">
            <span className="block text-foreground text-sm font-semibold">{statusCopy(announcement.status, order.deliveryMethod).title}</span>
            <span className="block text-secondary text-xs mt-0.5">{statusCopy(announcement.status, order.deliveryMethod).detail}</span>
          </p>
        )}
      </div>

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
          <p className="text-secondary text-xs italic">“{order.customer.notes}”</p>
        )}
      </div>

      {remote.state === 'unpaid' && (
        <p role="status" className="bg-surface border border-border rounded-xl px-4 py-3 text-secondary text-sm text-center">
          Estamos confirmando tu pago. Esta pantalla se actualiza sola.
        </p>
      )}

      {online && order.status === 'delivered' && <ReviewCard folio={order.id} />}

      {/* Guardar folio */}
      <FolioActions folio={order.id} />

      {/* Tracker de estatus */}
      <StatusTracker
        currentStatus={order.status}
        isDelivery={isDelivery}
        deliveryMethod={order.deliveryMethod}
        updatedAt={remoteOrder || local ? order.updatedAt : undefined}
      />

      {/* Mapa de seguimiento (solo domicilio en tránsito) */}
      {showMap && (
        <OrderMap
          destination={lat != null && lng != null ? { lat, lng } : undefined}
          rider={order.rider}
          onTheWay={order.status === 'ready'}
          simulate={!online}
        />
      )}

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
        {(order.discount ?? 0) > 0 && (
          <div className="flex justify-between px-4 py-3 border-t border-border">
            <span className="text-success text-sm">{order.promoName ?? 'Descuento'}</span>
            <span className="text-success text-sm">−${order.discount}</span>
          </div>
        )}
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

const ANNOUNCE_MS = 5000

/**
 * Detecta cuando el estatus en vivo cambia (no la primera carga) y devuelve un
 * aviso temporal; además vibra el celular si el navegador lo permite.
 */
function useStatusAnnouncement(liveStatus: string | undefined) {
  const [seen, setSeen] = useState(liveStatus)
  const [announcement, setAnnouncement] = useState<{ id: number; status: string } | null>(null)

  // Ajuste de estado durante el render (patrón recomendado por React para
  // reaccionar a un cambio de prop sin un efecto extra)
  if (liveStatus !== seen) {
    setSeen(liveStatus)
    if (seen !== undefined && liveStatus !== undefined) {
      setAnnouncement(prev => ({ id: (prev?.id ?? 0) + 1, status: liveStatus }))
    }
  }

  useEffect(() => {
    if (!announcement) return
    navigator.vibrate?.(180)
    const t = setTimeout(() => setAnnouncement(null), ANNOUNCE_MS)
    return () => clearTimeout(t)
  }, [announcement])

  return announcement
}
