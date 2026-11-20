'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import ordersData from '@/data/orders.json'
import type { Order } from '@/types/order'
import type { BadgeColor } from '@/components/ui/Badge'

const STATUS_FLOW: Record<string, string> = {
  pending:   'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready:     'delivered',
}

const FILTERS = [
  { id: 'all',       label: 'Todos' },
  { id: 'pending',   label: 'Nuevos' },
  { id: 'confirmed', label: 'Confirmados' },
  { id: 'preparing', label: 'En preparación' },
  { id: 'ready',     label: 'Listos' },
  { id: 'delivered', label: 'Entregados' },
]

export function MerchantPanel() {
  const [orders, setOrders] = useState<Order[]>(ordersData.orders as Order[])
  const [activeFilter, setActiveFilter] = useState('all')

  const advanceStatus = (orderId: string) => {
    setOrders(prev =>
      prev.map(o => {
        if (o.id !== orderId) return o
        const next = STATUS_FLOW[o.status]
        return next ? { ...o, status: next, updatedAt: new Date().toISOString() } : o
      })
    )
  }

  const filtered = activeFilter === 'all'
    ? orders
    : orders.filter(o => o.status === activeFilter)

  const pendingCount = orders.filter(o => o.status === 'pending').length

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <h1 className="text-foreground font-semibold text-lg">Pedidos</h1>
        {pendingCount > 0 && (
          <Badge color="warning">
            {pendingCount} nuevo{pendingCount > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className={[
              'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              activeFilter === f.id
                ? 'bg-brand text-inverse border-brand'
                : 'bg-surface border-border text-secondary hover:border-border-strong',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Tarjetas de pedidos */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="text-muted text-sm text-center py-10">Sin pedidos en esta categoría</p>
        )}

        {filtered.map(order => {
          const statusConfig  = ordersData.statuses.find(s => s.id === order.status)
          const deliveryMethod = ordersData.deliveryMethods.find(m => m.id === order.deliveryMethod)
          const nextStatusId  = STATUS_FLOW[order.status]
          const nextLabel     = ordersData.statuses.find(s => s.id === nextStatusId)?.label

          return (
            <div key={order.id} className="bg-surface border border-border rounded-xl overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <span className="text-foreground font-mono font-semibold text-sm">{order.id}</span>
                  <span className="text-muted text-xs">{deliveryMethod?.label}</span>
                </div>
                {statusConfig && (
                  <Badge color={statusConfig.color as BadgeColor}>{statusConfig.label}</Badge>
                )}
              </div>

              {/* Cliente + items */}
              <div className="px-4 py-3 space-y-1.5">
                <p className="text-secondary text-xs font-medium">{order.customer.name}</p>
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-muted">{item.quantity}× {item.name}</span>
                    <span className="text-muted">${item.subtotal}</span>
                  </div>
                ))}
                {order.customer.notes && (
                  <p className="text-warning text-xs italic pt-1">"{order.customer.notes}"</p>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-foreground font-semibold text-sm">${order.total}</span>
                {nextLabel && (
                  <Button onClick={() => advanceStatus(order.id)}>
                    Marcar como {nextLabel}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
