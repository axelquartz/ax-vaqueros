'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useCart } from '@/context/CartContext'
import menuData from '@/data/menu.json'
import type { Product, VariantGroup, VariantOption } from '@/types/menu'

interface ProductCardProps {
  product: Product
}

interface ResolvedGroup extends VariantGroup {
  id: string
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState(false)

  const variantGroups: ResolvedGroup[] = product.variantGroups.map(id => ({
    id,
    ...(menuData.variants as Record<string, VariantGroup>)[id],
  }))

  const allRequiredSelected = variantGroups
    .filter(g => g.required)
    .every(g => selectedVariants[g.id])

  const variantExtra = variantGroups.reduce((sum, group) => {
    const option = group.options.find((o: VariantOption) => o.id === selectedVariants[group.id])
    return sum + (option?.price ?? 0)
  }, 0)

  const unitPrice = product.price + variantExtra
  const totalPrice = unitPrice * quantity

  const handleAddToCart = () => {
    if (variantGroups.some(g => g.required) && !allRequiredSelected) return

    const variantLabels: Record<string, string> = {}
    variantGroups.forEach(group => {
      const option = group.options.find((o: VariantOption) => o.id === selectedVariants[group.id])
      if (option) variantLabels[group.id] = option.label
    })

    addItem({
      productId: product.id,
      name: product.name,
      quantity,
      unitPrice: product.price,
      selectedVariants,
      variantLabels,
      variantExtra,
      subtotal: totalPrice,
    })

    setQuantity(1)
    setSelectedVariants({})
    setExpanded(false)
  }

  return (
    <div className={[
      'bg-surface border rounded-xl overflow-hidden transition-all duration-200',
      expanded ? 'border-brand/40' : 'border-border hover:border-border-strong',
    ].join(' ')}>

      {/* Header — toca para expandir */}
      <button className="w-full text-left p-4" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-foreground font-medium text-sm">{product.name}</h3>
              {product.featured && <span className="text-brand text-xs">★</span>}
            </div>
            <p className="text-muted text-xs leading-relaxed line-clamp-2">{product.description}</p>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-foreground font-semibold text-sm">${product.price}</span>
            {variantExtra > 0 && (
              <p className="text-muted text-xs">+${variantExtra}</p>
            )}
          </div>
        </div>
      </button>

      {/* Panel expandible */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 space-y-4 pt-3">

          {/* Variantes */}
          {variantGroups.map(group => (
            <div key={group.id}>
              <p className="text-xs text-secondary font-medium mb-2">
                {group.label}
                {group.required && <span className="text-error ml-1">*</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.options.map((option: VariantOption) => (
                  <button
                    key={option.id}
                    onClick={() => setSelectedVariants(prev => ({ ...prev, [group.id]: option.id }))}
                    className={[
                      'px-3 py-1.5 rounded-full text-xs border transition-colors',
                      selectedVariants[group.id] === option.id
                        ? 'bg-brand text-inverse border-brand font-medium'
                        : 'bg-elevated border-border text-secondary hover:border-border-strong hover:text-foreground',
                    ].join(' ')}
                  >
                    {option.label}
                    {option.price > 0 && <span className="ml-1 opacity-70">+${option.price}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Cantidad + Agregar */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-full border border-border text-secondary hover:border-border-strong hover:text-foreground transition-colors flex items-center justify-center"
              >
                −
              </button>
              <span className="text-foreground font-medium text-sm w-4 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                className="w-8 h-8 rounded-full border border-border text-secondary hover:border-border-strong hover:text-foreground transition-colors flex items-center justify-center"
              >
                +
              </button>
            </div>

            <Button
              size="sm"
              onClick={handleAddToCart}
              disabled={variantGroups.some(g => g.required) && !allRequiredSelected}
            >
              Agregar · ${totalPrice}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
