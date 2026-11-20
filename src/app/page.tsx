'use client'

import { useState, useEffect } from 'react'
import { ProductCard } from '@/components/menu/ProductCard'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { AnnouncementBanner } from '@/components/layout/AnnouncementBanner'
import { TopBanner } from '@/components/layout/TopBanner'
import { useCart } from '@/context/CartContext'
import { isStoreOpen, getStoreStatusText } from '@/lib/storeHours'
import menuData from '@/data/menu.json'

export default function MenuPage() {
  const [activeCategory, setActiveCategory] = useState('todos')
  const { itemCount } = useCart()
  const [storeOpen, setStoreOpen]       = useState(true)
  const [storeStatus, setStoreStatus]   = useState('')
useEffect(() => {
    setStoreOpen(isStoreOpen())
    setStoreStatus(getStoreStatusText())
  }, [])

  const products = menuData.products.filter(
    p => (activeCategory === 'todos' || p.categoryId === activeCategory) && p.available
  )

  return (
    <div className="min-h-screen flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-[90vw] mx-auto px-4 h-14 flex items-center justify-between">
          <div>
            <h1 className="text-foreground font-bold text-lg tracking-wide">Vaquero's</h1>
            <p className="text-muted text-xs">Menú Digital</p>
          </div>
          <div className="flex items-center gap-3">
            {storeStatus && (
              <span className={`text-xs font-medium ${storeOpen ? 'text-green-400' : 'text-muted'}`}>
                {storeOpen ? '● Abierto' : '● Cerrado'}
              </span>
            )}
            <a href="/nosotros" className="text-muted hover:text-foreground transition-colors text-xs">
              Nosotros
            </a>
            <a href="/pedidos" className="text-muted hover:text-foreground transition-colors text-xs">
              Mis pedidos
            </a>
          </div>
        </div>
      </header>

      <TopBanner />
      <AnnouncementBanner />

      {/* Categorías */}
      <div className="sticky top-14 z-20 bg-background/90 backdrop-blur-md border-b border-border-subtle">
        <div className="max-w-[90vw] mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-3 no-scrollbar">
            {menuData.categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={[
                  'shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-colors',
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

      {/* Productos */}
      <main className={[
        'flex-1 w-full px-3 py-3',
        itemCount > 0 ? 'pb-24' : 'pb-6',
      ].join(' ')}>
        {products.length === 0 && (
          <p className="text-muted text-sm text-center py-10">Sin productos disponibles</p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-w-[90vw] mx-auto w-full">
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </main>

<CartDrawer />
    </div>
  )
}
