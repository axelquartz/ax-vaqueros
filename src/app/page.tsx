'use client'

import { useState } from 'react'
import { ProductCard } from '@/components/menu/ProductCard'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { useCart } from '@/context/CartContext'
import menuData from '@/data/menu.json'

export default function MenuPage() {
  const [activeCategory, setActiveCategory] = useState('todos')
  const { itemCount } = useCart()

  const products = menuData.products.filter(
    p => (activeCategory === 'todos' || p.categoryId === activeCategory) && p.available
  )

  return (
    <div className="min-h-screen flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div>
            <h1 className="text-foreground font-semibold text-sm tracking-wide">Vaquero's</h1>
            <p className="text-muted text-xs">Menú Digital</p>
          </div>
          {itemCount > 0 && (
            <span className="text-muted text-xs">{itemCount} en carrito</span>
          )}
        </div>
      </header>

      {/* Categorías */}
      <div className="sticky top-14 z-20 bg-background/90 backdrop-blur-md border-b border-border-subtle">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-3 no-scrollbar">
            {menuData.categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={[
                  'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  activeCategory === cat.id
                    ? 'bg-brand text-inverse border-brand'
                    : 'bg-surface border-border text-secondary hover:border-border-strong',
                ].join(' ')}
              >
                <span>{cat.emoji}</span>
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Productos — padding inferior para que la barra del carrito no tape el último item */}
      <main className={[
        'flex-1 max-w-2xl mx-auto w-full px-4 py-4 space-y-3',
        itemCount > 0 ? 'pb-24' : '',
      ].join(' ')}>
        {products.length === 0 && (
          <p className="text-muted text-sm text-center py-10">Sin productos disponibles</p>
        )}
        {products.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </main>

      <CartDrawer />
    </div>
  )
}
