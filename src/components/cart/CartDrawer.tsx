'use client'

import { useRouter } from 'next/navigation'
import { useCart } from '@/context/CartContext'
import { Button } from '@/components/ui/Button'

export function CartDrawer() {
  const { items, removeItem, updateQuantity, total, itemCount, isOpen, closeCart } = useCart()
  const router = useRouter()

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={closeCart}
      />

      {/* Drawer inferior */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl max-h-[85vh] flex flex-col">

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h2 className="text-foreground font-semibold text-sm">
            Tu orden
            {itemCount > 0 && (
              <span className="ml-2 text-muted font-normal">
                ({itemCount} {itemCount === 1 ? 'artículo' : 'artículos'})
              </span>
            )}
          </h2>
          <button
            onClick={closeCart}
            className="text-muted hover:text-foreground transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-overlay"
          >
            ✕
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {items.length === 0 ? (
            <p className="text-muted text-sm text-center py-10">Tu carrito está vacío</p>
          ) : (
            <div className="space-y-1">
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

                  {/* Controles de cantidad */}
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
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-4 py-4 border-t border-border space-y-3 shrink-0">
            <div className="flex justify-between text-sm">
              <span className="text-secondary">Subtotal</span>
              <span className="text-foreground font-semibold">${total}</span>
            </div>
            <Button
              fullWidth
              size="lg"
              onClick={() => {
                closeCart()
                router.push('/checkout')
              }}
            >
              Continuar con el pedido
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
