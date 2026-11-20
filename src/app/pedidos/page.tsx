'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { readOrders } from '@/lib/orderHistory'
import type { SavedOrder } from '@/lib/orderHistory'
import ordersData from '@/data/orders.json'

export default function PedidosPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<SavedOrder[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setOrders(readOrders())
    setMounted(true)
  }, [])

  const methodLabel = (id: string) =>
    ordersData.deliveryMethods.find(m => m.id === id)?.label ?? id

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('es-MX', {
      day:   '2-digit',
      month: 'short',
      year:  'numeric',
      hour:  '2-digit',
      minute:'2-digit',
    })
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="text-muted hover:text-foreground transition-colors text-sm"
          >
            ← Volver
          </button>
          <span className="text-border">|</span>
          <h1 className="text-foreground text-sm font-medium">Mis pedidos</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-3">
        {!mounted && (
          <p className="text-muted text-sm text-center py-10">Cargando…</p>
        )}

        {mounted && orders.length === 0 && (
          <div className="text-center py-14 space-y-2">
            <p className="text-2xl">🧾</p>
            <p className="text-foreground text-sm font-medium">Sin pedidos guardados</p>
            <p className="text-muted text-xs">
              Tus folios se guardan en este dispositivo cuando realizas un pedido.
            </p>
            <button
              onClick={() => router.push('/')}
              className="mt-4 text-brand text-sm hover:underline"
            >
              Ir al menú →
            </button>
          </div>
        )}

        {mounted && orders.map(order => (
          <button
            key={order.folio}
            onClick={() => router.push(`/order/${order.folio}`)}
            className="w-full text-left bg-surface border border-border hover:border-border-strong rounded-xl px-4 py-3 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-foreground font-mono font-semibold text-sm tracking-wider">
                  {order.folio}
                </p>
                <p className="text-muted text-xs mt-1">
                  {formatDate(order.timestamp)} · {methodLabel(order.deliveryMethod)}
                </p>
                <p className="text-muted text-xs">{order.itemCount} producto{order.itemCount !== 1 ? 's' : ''}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-foreground font-semibold text-sm">${order.total}</p>
                <p className="text-muted text-xs mt-1">Ver →</p>
              </div>
            </div>
          </button>
        ))}

        {mounted && orders.length > 0 && (
          <p className="text-muted text-xs text-center pt-2">
            Guardados en este dispositivo · máx. 30 pedidos
          </p>
        )}
      </main>
    </div>
  )
}
