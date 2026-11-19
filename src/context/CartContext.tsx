'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import type { CartItem } from '@/types/cart'

interface CartContextValue {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'id'>) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  total: number
  itemCount: number
}

const CartContext = createContext<CartContextValue | null>(null)

function buildCartItemId(productId: string, variants: Record<string, string>): string {
  const variantStr = Object.entries(variants)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join('|')
  return `${productId}__${variantStr}`
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])

  const addItem = useCallback((item: Omit<CartItem, 'id'>) => {
    const id = buildCartItemId(item.productId, item.selectedVariants)
    setItems(prev => {
      const existing = prev.find(i => i.id === id)
      if (existing) {
        const newQty = existing.quantity + item.quantity
        return prev.map(i =>
          i.id === id
            ? { ...i, quantity: newQty, subtotal: newQty * (i.unitPrice + i.variantExtra) }
            : i
        )
      }
      return [...prev, { ...item, id }]
    })
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
  }, [])

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setItems(prev => prev.filter(i => i.id !== id))
      return
    }
    setItems(prev =>
      prev.map(i =>
        i.id === id
          ? { ...i, quantity, subtotal: quantity * (i.unitPrice + i.variantExtra) }
          : i
      )
    )
  }, [])

  const clearCart = useCallback(() => setItems([]), [])

  const total = items.reduce((sum, i) => sum + i.subtotal, 0)
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, total, itemCount }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
