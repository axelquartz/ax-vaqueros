'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/context/CartContext'
import { Button } from '@/components/ui/Button'

export function CartDrawer() {
  const { items, removeItem, updateQuantity, total, itemCount } = useCart()
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)

  // No mostrar nada si el carrito está vacío
  if (itemCount === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col">

      {/* Panel expandible — sin backdrop, no bloquea interacción */}
      {expanded && (
        <div className="bg-surface border-t border-x border-border rounded-t-2xl mx-0 max-h-[60vh] flex flex-col overflow-hidden">

          {/* Handle */}
          <button
            className="flex justify-center pt-3 pb-2 shrink-0 w-full"
            onClick={() => setExpanded(false)}
          >
            <div className="w-10 h-1 rounded-full bg-border-strong" />
          </button>

          {/* Items */}
          <div className="overflow-y-auto px-4 pb-2">
            {items.map(item => (
              <div key={item.id} className="flex items-start gap-3 py-3 border-b border-border-subtle last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-sm font-medium">{item.name}</p>
                  {Object.keys(item.variantLabels).length > 0 && (
                    <p className="text-muted text-xs mt-0.5">
                      {Object.values(item.variantLabels).join(' · ')}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="w-6 h-6 rounded-full border border-border text-secondary text-xs flex items-center justify-center hover:border-border-strong"
                  >
                    −
                  </button>
                  <span className="text-foreground text-xs font-medium w-4 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="w-6 h-6 rounded-full border border-border text-secondary text-xs flex items-center justify-center hover:border-border-strong"
                  >
                    +
                  </button>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-foreground text-sm font-semibold">${item.subtotal}</p>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-muted hover:text-error text-xs transition-colors mt-0.5"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Barra persistente — siempre visible y clickeable */}
      <div className="bg-surface border-t border-border px-4 py-3 flex items-center gap-3">
        {/* Resumen — toca para expandir/colapsar */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          <span className="text-brand text-sm">🛒</span>
          <span className="text-foreground text-sm font-medium">
            {itemCount} {itemCount === 1 ? 'artículo' : 'artículos'}
          </span>
          <span className="text-muted text-xs">· ${total}</span>
          <span className="text-muted text-xs ml-auto">{expanded ? '▼' : '▲'}</span>
        </button>

        {/* Botón de pedido — siempre visible */}
        <Button
          size="md"
          onClick={() => router.push('/checkout')}
        >
          Hacer pedido
        </Button>
      </div>
    </div>
  )
}
