import { renderHook, act } from '@testing-library/react'
import { CartProvider, useCart } from '@/context/CartContext'

const wrapper = ({ children }: { children: React.ReactNode }) => <CartProvider>{children}</CartProvider>

const base = {
  productId: 'alitas-5', name: 'Alitas 5 pzas', quantity: 1, unitPrice: 190,
  selectedVariants: { sabor: 'bbq' }, variantLabels: { sabor: 'BBQ' }, variantExtra: 0, subtotal: 190,
}

describe('CartContext', () => {
  it('agrega un producto y calcula total y conteo', () => {
    const { result } = renderHook(() => useCart(), { wrapper })
    act(() => result.current.addItem(base))
    expect(result.current.items).toHaveLength(1)
    expect(result.current.itemCount).toBe(1)
    expect(result.current.total).toBe(190)
  })

  it('agrupa el mismo producto con las mismas variantes', () => {
    const { result } = renderHook(() => useCart(), { wrapper })
    act(() => result.current.addItem(base))
    act(() => result.current.addItem({ ...base, quantity: 2, subtotal: 380 }))
    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].quantity).toBe(3)
    expect(result.current.total).toBe(570)
  })

  it('separa el mismo producto con variantes distintas', () => {
    const { result } = renderHook(() => useCart(), { wrapper })
    act(() => result.current.addItem(base))
    act(() => result.current.addItem({ ...base, selectedVariants: { sabor: 'mango' } }))
    expect(result.current.items).toHaveLength(2)
  })

  it('agrega productos diferentes uno tras otro', () => {
    const { result } = renderHook(() => useCart(), { wrapper })
    act(() => result.current.addItem(base))
    act(() => result.current.addItem({ ...base, productId: 'agua', name: 'Agua', unitPrice: 15, selectedVariants: {}, variantLabels: {}, subtotal: 15 }))
    expect(result.current.itemCount).toBe(2)
    expect(result.current.total).toBe(205)
  })

  it('actualiza cantidad y recalcula subtotal con extras', () => {
    const { result } = renderHook(() => useCart(), { wrapper })
    act(() => result.current.addItem({ ...base, variantExtra: 10, subtotal: 200 }))
    const id = result.current.items[0].id
    act(() => result.current.updateQuantity(id, 3))
    expect(result.current.items[0].subtotal).toBe(600)
  })

  it('elimina el item si la cantidad llega a 0, y con removeItem', () => {
    const { result } = renderHook(() => useCart(), { wrapper })
    act(() => result.current.addItem(base))
    act(() => result.current.updateQuantity(result.current.items[0].id, 0))
    expect(result.current.items).toHaveLength(0)
    act(() => result.current.addItem(base))
    act(() => result.current.removeItem(result.current.items[0].id))
    expect(result.current.itemCount).toBe(0)
  })

  it('clearCart vacía el carrito', () => {
    const { result } = renderHook(() => useCart(), { wrapper })
    act(() => result.current.addItem(base))
    act(() => result.current.clearCart())
    expect(result.current.items).toHaveLength(0)
  })

  it('useCart fuera del provider lanza error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useCart())).toThrow(/CartProvider/)
    spy.mockRestore()
  })
})
