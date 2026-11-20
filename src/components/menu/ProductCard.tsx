'use client'

import type { Product } from '@/types/menu'

interface ProductCardProps {
  product: Product
  onSelect: (product: Product) => void
}

export function ProductCard({ product, onSelect }: ProductCardProps) {
  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden bg-surface cursor-pointer transition-transform duration-200 ease-out active:scale-[0.98]"
      onClick={() => onSelect(product)}
    >
      {/* Imagen */}
      <div className="relative w-full">
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
      </div>

      {/* Info */}
      <div className="px-3 pt-3 pb-3 flex flex-col gap-1">
        <h3 className="font-display text-xl font-bold leading-[1.05] text-foreground line-clamp-2">{product.name}</h3>
        {product.description && (
          <p className="text-muted text-xs leading-relaxed line-clamp-2">{product.description}</p>
        )}
        <p className="font-display text-xl font-bold leading-none text-brand tabular mt-1.5">${product.price}</p>
      </div>
    </div>
  )
}
