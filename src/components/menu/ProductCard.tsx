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

  // ─── Helpers for multi-select groups ─────────────────────
  const getSelectedIds = (groupId: string): string[] => {
    const val = selectedVariants[groupId]
    return val ? val.split(',').filter(Boolean) : []
  }

  const isOptionSelected = (groupId: string, optionId: string, isMulti?: boolean): boolean => {
    if (!isMulti) return selectedVariants[groupId] === optionId
    return getSelectedIds(groupId).includes(optionId)
  }

  const handleVariantSelect = (groupId: string, optionId: string, isMulti?: boolean) => {
    if (!isMulti) {
      setSelectedVariants(prev => ({ ...prev, [groupId]: optionId }))
      return
    }
    setSelectedVariants(prev => {
      const current = getSelectedIds(groupId)
      const next = current.includes(optionId)
        ? current.filter(x => x !== optionId)
        : [...current, optionId]
      return { ...prev, [groupId]: next.join(',') }
    })
  }

  // ─── Validation ───────────────────────────────────────────
  const allRequiredSelected = variantGroups
    .filter(g => g.required)
    .every(g => !!selectedVariants[g.id])

  // ─── Price calculation ────────────────────────────────────
  const variantExtra = variantGroups.reduce((sum, group) => {
    if (!selectedVariants[group.id]) return sum
    if (group.multi) {
      return sum + getSelectedIds(group.id).reduce((s, id) => {
        const opt = group.options.find((o: VariantOption) => o.id === id)
        return s + (opt?.price ?? 0)
      }, 0)
    }
    const opt = group.options.find((o: VariantOption) => o.id === selectedVariants[group.id])
    return sum + (opt?.price ?? 0)
  }, 0)

  const unitPrice  = product.price + variantExtra
  const totalPrice = unitPrice * quantity

  // ─── Add to cart ──────────────────────────────────────────
  const handleAddToCart = () => {
    if (variantGroups.some(g => g.required) && !allRequiredSelected) return

    const variantLabels: Record<string, string> = {}
    variantGroups.forEach(group => {
      if (!selectedVariants[group.id]) return
      if (group.multi) {
        const labels = getSelectedIds(group.id)
          .map(id => group.options.find((o: VariantOption) => o.id === id)?.label)
          .filter(Boolean) as string[]
        if (labels.length > 0) variantLabels[group.id] = labels.join(', ')
      } else {
        const opt = group.options.find((o: VariantOption) => o.id === selectedVariants[group.id])
        if (opt) variantLabels[group.id] = opt.label
      }
    })

    addItem({
      productId:      product.id,
      name:           product.name,
      quantity,
      unitPrice:      product.price,
      selectedVariants,
      variantLabels,
      variantExtra,
      subtotal:       totalPrice,
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
        <div className="flex items-start gap-3">
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-foreground font-medium text-sm">{product.name}</h3>
              {product.featured && <span className="text-brand text-xs">★</span>}
            </div>
            <p className="text-muted text-xs leading-relaxed line-clamp-2 mb-2">{product.description}</p>
            <span className="text-foreground font-semibold text-sm">
              ${product.price}
              {variantExtra > 0 && <span className="text-muted font-normal text-xs ml-1">+${variantExtra}</span>}
            </span>
          </div>
          {/* Thumbnail */}
          {product.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image}
              alt={product.name}
              className="shrink-0 w-20 h-20 rounded-xl object-cover border border-border"
            />
          )}
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
                {group.multi && <span className="text-muted ml-1 font-normal">(varios)</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.options.map((option: VariantOption) => (
                  <button
                    key={option.id}
                    onClick={() => handleVariantSelect(group.id, option.id, group.multi)}
                    className={[
                      'px-3 py-1.5 rounded-full text-xs border transition-colors',
                      isOptionSelected(group.id, option.id, group.multi)
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
