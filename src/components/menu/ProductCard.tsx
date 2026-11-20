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

  const hasRequired = variantGroups.some(g => g.required)

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden bg-surface">

      {/* Imagen */}
      <button className="relative w-full text-left" onClick={() => setExpanded(e => !e)}>
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image}
            alt={product.name}
            className={[
              'w-full aspect-[4/3] object-cover',
              product.imagePosition === 'top' ? 'object-top' : product.imagePosition === 'bottom' ? 'object-bottom' : 'object-center',
            ].join(' ')}
          />
        ) : (
          <div className="w-full aspect-[4/3] bg-elevated flex items-center justify-center">
            <span className="text-4xl opacity-20">🍗</span>
          </div>
        )}

        {/* Badge destacado */}
        {product.featured && (
          <span className="absolute top-2 left-2 bg-brand text-inverse text-xs font-semibold px-2 py-0.5 rounded-full leading-none">
            Popular
          </span>
        )}

        {/* Botón + */}
        <span className="absolute bottom-2.5 right-2.5 w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center text-xl font-light shadow-lg">
          +
        </span>
      </button>

      {/* Info */}
      <button className="text-left px-3 pt-3 pb-3 flex flex-col gap-1" onClick={() => setExpanded(e => !e)}>
        <h3 className="text-foreground font-bold text-base leading-snug line-clamp-2">{product.name}</h3>
        {product.description && (
          <p className="text-muted text-xs leading-relaxed line-clamp-2">{product.description}</p>
        )}
        <p className="text-brand font-bold text-base mt-0.5">${product.price}</p>
      </button>

      {/* Panel expandible */}
      {expanded && (
        <div className="border-t border-border/50 px-3 pb-3 space-y-3 pt-3 bg-elevated">

          {/* Variantes */}
          {variantGroups.map(group => (
            <div key={group.id}>
              <p className="text-xs text-secondary font-medium mb-2">
                {group.label}
                {group.required && <span className="text-error ml-1">*</span>}
                {group.multi && <span className="text-muted ml-1 font-normal">(varios)</span>}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {group.options.map((option: VariantOption) => (
                  <button
                    key={option.id}
                    onClick={() => handleVariantSelect(group.id, option.id, group.multi)}
                    className={[
                      'px-2.5 py-1 rounded-full text-xs border transition-colors',
                      isOptionSelected(group.id, option.id, group.multi)
                        ? 'bg-brand text-inverse border-brand font-medium'
                        : 'bg-surface border-border text-secondary hover:border-border-strong hover:text-foreground',
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-7 h-7 rounded-full border border-border text-secondary hover:border-border-strong flex items-center justify-center text-sm transition-colors"
              >−</button>
              <span className="text-foreground font-medium text-sm w-4 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                className="w-7 h-7 rounded-full border border-border text-secondary hover:border-border-strong flex items-center justify-center text-sm transition-colors"
              >+</button>
            </div>

            <Button
              size="sm"
              onClick={handleAddToCart}
              disabled={hasRequired && !allRequiredSelected}
            >
              Agregar · ${totalPrice}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
