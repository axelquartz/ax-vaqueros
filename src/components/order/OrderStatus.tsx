'use client'

import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import ordersData from '@/data/orders.json'
import type { Order } from '@/types/order'
import type { BadgeColor } from '@/components/ui/Badge'

interface OrderStatusProps {
  order: Order
}

export function OrderStatus({ order }: OrderStatusProps) {
  const router = useRouter()
  const statusConfig = ordersData.statuses.find(s => s.id === order.status)
  const deliveryMethod = ordersData.deliveryMethods.find(m => m.id === order.deliveryMethod)

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-6">

      {/* Folio + estatus */}
      <div className="bg-surface border border-border rounded-xl p-5 text-center space-y-3">
        <p className="text-muted text-xs uppercase tracking-widest">Folio de pedido</p>
        <p className="text-foreground font-mono font-bold text-2xl tracking-widest">{order.id}</p>
        {statusConfig && (
          <Badge color={statusConfig.color as BadgeColor}>{statusConfig.label}</Badge>
        )}
        {deliveryMethod && (
          <p className="text-muted text-xs">{deliveryMethod.label} · {deliveryMethod.eta}</p>
        )}
        {order.customer.notes && (
          <p className="text-secondary text-xs italic mt-1">"{order.customer.notes}"</p>
        )}
      </div>

      {/* Desglose de items */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between items-start px-4 py-3 border-b border-border last:border-0">
            <div>
              <p className="text-foreground text-sm font-medium">{item.quantity}× {item.name}</p>
              {Object.values(item.variants).length > 0 && (
                <p className="text-muted text-xs mt-0.5">
                  {Object.values(item.variants).join(' · ')}
                </p>
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
          <span className="text-foreground text-sm font-semibold">${order.total}</span>
        </div>
      </div>

      <Button variant="ghost" fullWidth onClick={() => router.push('/')}>
        Hacer otro pedido
      </Button>
    </div>
  )
}
