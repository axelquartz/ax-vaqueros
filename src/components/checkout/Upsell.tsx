'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useCart } from '@/context/CartContext'
import { useMenu } from '@/hooks/useMenu'
import menuData from '@/data/menu.json'
import upsellData from '@/data/upsell.json'
import type { Product, VariantGroup } from '@/types/menu'

const variants = menuData.variants as Record<string, VariantGroup>

export function hasRequiredVariants(product: Product): boolean {
  return product.variantGroups.some(id => variants[id]?.required)
}

/** Productos sugeridos que aún no están en el carrito, en el orden configurado */
export function pickUpsell(cartProductIds: string[], catalog: Product[] = menuData.products as Product[]): Product[] {
  const inCart = new Set(cartProductIds)
  return upsellData.productIds
    .map(id => catalog.find(p => p.id === id))
    .filter((p): p is Product => !!p && p.available && !inCart.has(p.id))
    .slice(0, upsellData.maxItems)
}

/**
 * "¿Te falta algo?" — recomendaciones de último momento en el checkout.
 * Productos sin variantes obligatorias se agregan con un toque; los demás
 * abren el ProductSheet para elegir (onOpenProduct).
 */
export function Upsell({ onOpenProduct }: { onOpenProduct: (p: Product) => void }) {
  const { items, addItem } = useCart()
  const { products: catalog } = useMenu()
  // Lista fija al montar: lo recién agregado se queda visible con su ✓
  const [initialCart] = useState(() => items.map(i => i.productId))
  const products = useMemo(() => pickUpsell(initialCart, catalog), [initialCart, catalog])
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  if (products.length === 0) return null

  const handleAdd = (product: Product) => {
    if (hasRequiredVariants(product)) {
      onOpenProduct(product)
      return
    }
    addItem({
      productId:        product.id,
      name:             product.name,
      quantity:         1,
      unitPrice:        product.price,
      selectedVariants: {},
      variantLabels:    {},
      variantExtra:     0,
      subtotal:         product.price,
    })
    setJustAdded(product.id)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setJustAdded(null), 1400)
  }

  return (
    <section aria-labelledby="upsell-title" className="space-y-3 animate-fade-up">
      <div>
        <h3 id="upsell-title" className="font-display text-xl font-bold leading-none text-foreground">{upsellData.title}</h3>
        <p className="text-muted text-xs mt-1">{upsellData.subtitle}</p>
      </div>

      {/* Carrusel horizontal: mobile-first, con snap y sangrado hasta el borde */}
      <ul className="-mx-4 px-4 flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-1">
        {products.map(product => {
          const added = justAdded === product.id
          return (
            <li key={product.id} className="snap-start shrink-0 w-32">
              <button
                type="button"
                onClick={() => handleAdd(product)}
                aria-label={`Agregar ${product.name}, $${product.price}`}
                className="w-full text-left bg-surface border border-border rounded-xl overflow-hidden transition-transform duration-150 ease-out active:scale-[0.97]"
              >
                <div className="relative aspect-square bg-elevated">
                  {product.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.image} alt="" className="w-full h-full object-cover" loading="lazy" />
                  )}
                  <span
                    aria-hidden
                    className={[
                      'absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center text-base shadow-lg',
                      'transition-[background-color,transform] duration-200 ease-out',
                      added ? 'bg-success text-background scale-110' : 'bg-foreground text-background',
                    ].join(' ')}
                  >
                    {added ? '✓' : '+'}
                  </span>
                </div>
                <div className="px-2.5 py-2">
                  <p className="font-display text-base font-bold leading-[1.05] text-foreground line-clamp-2 min-h-[2lh]">{product.name}</p>
                  <p className="font-display text-base font-bold leading-none text-brand tabular mt-1">${product.price}</p>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="sr-only" aria-live="polite">{justAdded ? 'Agregado al pedido' : ''}</p>
    </section>
  )
}
