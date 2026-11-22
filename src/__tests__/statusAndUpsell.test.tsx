import { render, screen, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CartProvider, useCart } from '@/context/CartContext'
import { getOrderRepository, resetOrderRepository } from '@/lib/orders/repository'
import { formatStatusTime, statusCopy } from '@/lib/orders/statusCopy'
import menu from '@/data/menu.json'
import type { Order } from '@/types/order'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/storeHours', () => ({ isStoreOpen: () => true, getStoreStatusText: () => 'Abierto hasta las 22:00' }))
vi.mock('@stripe/stripe-js', () => ({ loadStripe: () => null }))
import { OrderStatus } from '@/components/order/OrderStatus'
import { CheckoutFlow } from '@/components/checkout/CheckoutFlow'

beforeEach(() => {
  localStorage.clear()
  resetOrderRepository({ withHistory: false })
})

describe('Textos de cada etapa', () => {
  it('"Listo" depende de cómo se recibe el pedido', () => {
    expect(statusCopy('ready', 'pickup').title).toBe('¡Listo para recoger!')
    expect(statusCopy('ready', 'table').title).toBe('¡Va para tu mesa!')
    expect(statusCopy('ready', 'delivery').title).toBe('Va en camino')
    expect(statusCopy('preparing', 'delivery').title).toBe('Lo estamos preparando')
  })

  it('la hora se muestra en la zona del restaurante', () => {
    expect(formatStatusTime('2026-11-22T18:31:00Z')).toMatch(/^12:31\s?p/)
  })
})

describe('Cambio de estatus en la pantalla del cliente', () => {
  const order = (over: Partial<Order> = {}): Order => {
    const now = new Date().toISOString()
    return {
      id: 'ORD-8100', createdAt: now, updatedAt: now, status: 'pending', deliveryMethod: 'pickup',
      customer: { name: 'Ana', phone: '1', notes: '' },
      items: [{ productId: 'agua', name: 'Agua Natural', quantity: 1, unitPrice: 15, variants: {}, subtotal: 15 }],
      subtotal: 15, deliveryFee: 0, total: 15, ...over,
    }
  }

  it('muestra qué significa la etapa y desde cuándo', () => {
    getOrderRepository().create(order())
    render(<OrderStatus order={order()} />)
    expect(screen.getByText('Recibimos tu pedido')).toBeInTheDocument()
    expect(screen.getByText(/^Desde las /)).toBeInTheDocument()
  })

  it('al cargar no avisa; cuando el restaurante avanza el pedido, avisa y vibra', async () => {
    const vibrate = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
    getOrderRepository().create(order())
    render(<OrderStatus order={order()} />)
    expect(screen.queryByRole('status', { name: /./ })).toBeNull()
    expect(vibrate).not.toHaveBeenCalled()

    act(() => {
      getOrderRepository().updateStatus('ORD-8100', 'confirmed')
      getOrderRepository().updateStatus('ORD-8100', 'preparing')
      getOrderRepository().updateStatus('ORD-8100', 'ready')
    })
    const toast = screen.getAllByRole('status').find(el => el.textContent?.includes('¡Listo para recoger!'))
    expect(toast).toBeDefined()
    expect(within(toast!).getByText('Pasa al mostrador y menciona tu folio.')).toBeInTheDocument()
    expect(vibrate).toHaveBeenCalled()
  })
})

describe('"¿Te falta algo?" en el checkout', () => {
  function Seed() {
    const { addItem, items } = useCart()
    if (items.length === 0) {
      queueMicrotask(() => {
        const p = menu.products.find(x => x.id === 'dedos-queso-5')!
        addItem({ productId: p.id, name: p.name, quantity: 1, unitPrice: p.price, selectedVariants: {}, variantLabels: {}, variantExtra: 0, subtotal: p.price })
      })
    }
    return null
  }

  it('aparece en el Resumen, antes de los datos del cliente', async () => {
    render(<CartProvider><Seed /><CheckoutFlow /></CartProvider>)
    expect(await screen.findByRole('heading', { name: 'Tu orden' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '¿Te falta algo?' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.queryByRole('heading', { name: '¿Te falta algo?' })).toBeNull()
  })
})
