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
    <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col animate-rise-in">

      {/* Panel expandible — sin backdrop, no bloquea interacción.
          grid-rows 0fr↔1fr anima la altura real en ambas direcciones. */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-[400ms] ease-sheet ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
        inert={!expanded}
        aria-hidden={!expanded}
      >
       <div className="min-h-0 overflow-hidden">
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
                      {Object.values(item.variantLabels).join(', ')}
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
       </div>
      </div>

      {/* Barra persistente — siempre visible y clickeable. El padding inferior
          deja libre la zona del gesto de inicio (iPhone) y la insignia del hosting. */}
      <div
        className="bg-surface border-t border-border px-4 pt-3 flex items-center gap-3"
        style={{ paddingBottom: 'calc(0.75rem + max(var(--host-badge-inset, 0px), env(safe-area-inset-bottom, 0px)))' }}
      >
        {/* Resumen — toca para expandir/colapsar */}
        <button
          onClick={() => setExpanded(e => !e)}
          aria-expanded={expanded}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          <span className="flex flex-col items-start leading-none text-left">
            <span className="font-display text-xl font-bold text-foreground tabular">${total}</span>
            <span className="text-muted text-xs mt-1">
              {itemCount} {itemCount === 1 ? 'artículo' : 'artículos'}
            </span>
          </span>
          {/* text-xs: más pequeño que el texto de los botones (text-sm) */}
          <span className="ml-auto flex items-center gap-1 text-secondary text-xs font-medium whitespace-nowrap">
            Ver pedido
            <span
              className={`text-[10px] transition-transform duration-300 ease-sheet ${expanded ? 'rotate-180' : ''}`}
              aria-hidden
            >▲</span>
          </span>
        </button>

        {/* Botón de pedido — siempre visible */}
        <Button
          onClick={() => router.push('/checkout')}
        >
          Hacer pedido
        </Button>
      </div>
    </div>
  )
}
