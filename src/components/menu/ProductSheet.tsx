'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { useCart } from '@/context/CartContext'
import menuData from '@/data/menu.json'
import type { Product, VariantGroup, VariantOption } from '@/types/menu'

interface ProductSheetProps {
  product: Product | null
  onClose: () => void
}

interface ResolvedGroup extends VariantGroup {
  id: string
}

export function ProductSheet({ product, onClose }: ProductSheetProps) {
  const { addItem } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({})

  useEffect(() => {
    setQuantity(1)
    setSelectedVariants({})
  }, [product?.id])

  if (!product) return null

  const variantGroups: ResolvedGroup[] = product.variantGroups.map(id => ({
    id,
    ...(menuData.variants as Record<string, VariantGroup>)[id],
  }))

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

  const allRequiredSelected = variantGroups
    .filter(g => g.required)
    .every(g => !!selectedVariants[g.id])

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
      productId:     product.id,
      name:          product.name,
      quantity,
      unitPrice:     product.price,
      selectedVariants,
      variantLabels,
      variantExtra,
      subtotal:      totalPrice,
    })

    onClose()
  }

  const hasRequired = variantGroups.some(g => g.required)

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-2xl max-h-[85vh] flex flex-col">

        {/* Handle + close */}
        <div className="relative flex justify-center items-center pt-3 pb-2 px-4 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border-strong" />
          <button
            onClick={onClose}
            className="absolute right-4 w-7 h-7 rounded-full bg-elevated flex items-center justify-center text-muted hover:text-foreground transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-4 pb-8 space-y-4">

          {/* Producto */}
          <div className="flex gap-3 items-start pt-1">
            {product.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image}
                alt={product.name}
                className={[
                  'w-24 h-24 rounded-xl object-cover shrink-0',
                  product.imagePosition === 'top' ? 'object-top' : 'object-center',
                ].join(' ')}
              />
            )}
            <div className="flex-1">
              <h2 className="text-foreground font-bold text-base leading-snug">{product.name}</h2>
              {product.description && (
                <p className="text-muted text-xs leading-relaxed mt-1">{product.description}</p>
              )}
              <p className="text-brand font-bold text-base mt-2">${product.price}</p>
            </div>
          </div>

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
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-full border border-border text-secondary hover:border-border-strong flex items-center justify-center text-sm transition-colors"
              >−</button>
              <span className="text-foreground font-medium text-sm w-4 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                className="w-8 h-8 rounded-full border border-border text-secondary hover:border-border-strong flex items-center justify-center text-sm transition-colors"
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
      </div>
    </>
  )
}
