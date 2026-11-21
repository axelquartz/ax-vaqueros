import { render, screen, act, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createLocalOrderRepository, getOrderRepository, resetOrderRepository, STORAGE_KEY, OrderTransitionError } from '@/lib/orders/repository'
import { canTransition, nextStatus, canCancel, ACTION_LABEL } from '@/lib/orders/status'
import { resolveTimestamp, seedOrders } from '@/lib/orders/seed'
import menu from '@/data/menu.json'
import { formatElapsed, minutesSince } from '@/components/merchant/OrderCard'
import ordersData from '@/data/orders.json'
import type { Order } from '@/types/order'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
import { MerchantPanel } from '@/components/merchant/MerchantPanel'
import { OrderStatus } from '@/components/order/OrderStatus'

const newOrder = (id: string, over: Partial<Order> = {}): Order => {
  const now = new Date().toISOString()
  return {
    id, createdAt: now, updatedAt: now, status: 'pending', deliveryMethod: 'table',
    customer: { name: 'Lucía', phone: '8110000000', tableNumber: '3', notes: 'Sin chile' },
    items: [{ productId: 'agua', name: 'Agua Natural', quantity: 1, unitPrice: 15, variants: {}, subtotal: 15 }],
    subtotal: 15, deliveryFee: 0, total: 15, ...over,
  }
}

beforeEach(() => {
  localStorage.clear()
  resetOrderRepository()
})

describe('status', () => {
  it('flujo lineal y cancelación', () => {
    expect(nextStatus('pending')).toBe('confirmed')
    expect(nextStatus('ready')).toBe('delivered')
    expect(nextStatus('delivered')).toBeUndefined()
    expect(canTransition('pending', 'preparing')).toBe(false)
    expect(canTransition('preparing', 'cancelled')).toBe(true)
    expect(canCancel('ready')).toBe(false)
    expect(ACTION_LABEL.pending).toBe('Confirmar')
  })
})

describe('seed', () => {
  it('resuelve fechas relativas', () => {
    const now = Date.UTC(2026, 0, 1, 12, 0)
    expect(resolveTimestamp('-10', now)).toBe(new Date(now - 600_000).toISOString())
    expect(resolveTimestamp('2026-01-01T00:00:00.000Z', now)).toBe('2026-01-01T00:00:00.000Z')
  })

  it('los pedidos de ejemplo usan productos y precios reales del menú', () => {
    for (const o of seedOrders()) {
      for (const item of o.items) {
        const product = menu.products.find(p => p.id === item.productId)
        expect(product, item.productId).toBeDefined()
        expect(item.unitPrice).toBe(product!.price)
        expect(item.subtotal).toBeGreaterThanOrEqual(product!.price * item.quantity)
      }
      expect(o.total).toBe(o.subtotal + o.deliveryFee)
      expect(o.subtotal).toBe(o.items.reduce((s, i) => s + i.subtotal, 0))
    }
  })
})

describe('LocalOrderRepository', () => {
  it('siembra los pedidos de ejemplo la primera vez', () => {
    const repo = createLocalOrderRepository(localStorage)
    expect(repo.list().map(o => o.id)).toEqual(ordersData.orders.map(o => o.id))
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
  })

  it('snapshot estable mientras no haya cambios', () => {
    const repo = createLocalOrderRepository(localStorage)
    expect(repo.list()).toBe(repo.list())
  })

  it('create agrega al inicio, notifica y persiste', () => {
    const repo = createLocalOrderRepository(localStorage)
    const spy = vi.fn()
    repo.subscribe(spy)
    repo.create(newOrder('ORD-5000'))
    expect(repo.list()[0].id).toBe('ORD-5000')
    expect(spy).toHaveBeenCalledOnce()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)[0].id).toBe('ORD-5000')
  })

  it('updateStatus respeta el flujo', () => {
    const repo = createLocalOrderRepository(localStorage)
    repo.create(newOrder('ORD-5001'))
    expect(repo.updateStatus('ORD-5001', 'confirmed').status).toBe('confirmed')
    expect(() => repo.updateStatus('ORD-5001', 'delivered')).toThrow(OrderTransitionError)
    expect(() => repo.updateStatus('ORD-NOPE', 'confirmed')).toThrow(OrderTransitionError)
  })

  it('se entera de cambios hechos en otra pestaña', () => {
    const repo = createLocalOrderRepository(localStorage)
    repo.list()
    const spy = vi.fn()
    repo.subscribe(spy)
    const other = [newOrder('ORD-6000'), ...repo.list()]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(other))
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
    expect(spy).toHaveBeenCalled()
    expect(repo.get('ORD-6000')).toBeDefined()
  })

  it('datos corruptos: vuelve a sembrar', () => {
    localStorage.setItem(STORAGE_KEY, '{roto')
    expect(createLocalOrderRepository(localStorage).list().length).toBe(ordersData.orders.length)
  })
})

describe('tiempo transcurrido', () => {
  it('formatea minutos', () => {
    expect(formatElapsed(0)).toBe('Ahora')
    expect(formatElapsed(7)).toBe('Hace 7 min')
    expect(formatElapsed(75)).toBe('Hace 1 h 15 min')
    expect(minutesSince(new Date(Date.now() - 5 * 60_000).toISOString(), Date.now())).toBe(5)
  })
})

describe('MerchantPanel', () => {
  const column = (name: string) => screen.getByRole('region', { name })
  const card = (id: string) => screen.getByRole('article', { name: `Pedido ${id}` })

  it('muestra los activos en columnas por estatus', () => {
    render(<MerchantPanel />)
    expect(within(column('Nuevos')).getByText('ORD-0043')).toBeInTheDocument()
    expect(within(column('Confirmados')).getByText('ORD-0042')).toBeInTheDocument()
    expect(within(column('Preparando')).getByText('ORD-0041')).toBeInTheDocument()
    expect(screen.queryByText('ORD-0040')).not.toBeInTheDocument() // entregado
    expect(screen.getByRole('tab', { name: /Activos 3/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('muestra mesa, dirección y notas', () => {
    render(<MerchantPanel />)
    expect(within(card('ORD-0042')).getByText('Mesa 6')).toBeInTheDocument()
    expect(within(card('ORD-0043')).getByText(/Av. Constitución/)).toBeInTheDocument()
    expect(within(card('ORD-0043')).getByText('Tocar el timbre dos veces')).toBeInTheDocument()
  })

  it('avanza un pedido hasta entregarlo', async () => {
    render(<MerchantPanel />)
    await userEvent.click(within(card('ORD-0043')).getByRole('button', { name: 'Confirmar' }))
    expect(within(column('Confirmados')).getByText('ORD-0043')).toBeInTheDocument()
    await userEvent.click(within(card('ORD-0043')).getByRole('button', { name: 'Empezar a preparar' }))
    await userEvent.click(within(card('ORD-0043')).getByRole('button', { name: 'Marcar listo' }))
    expect(within(column('Listos')).getByText('ORD-0043')).toBeInTheDocument()
    await userEvent.click(within(card('ORD-0043')).getByRole('button', { name: 'Entregar' }))
    expect(screen.queryByRole('article', { name: 'Pedido ORD-0043' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: /Entregados/ }))
    expect(card('ORD-0043')).toBeInTheDocument()
  })

  it('cancelar pide confirmación dentro de la tarjeta', async () => {
    render(<MerchantPanel />)
    await userEvent.click(within(card('ORD-0042')).getByRole('button', { name: 'Cancelar' }))
    await userEvent.click(within(card('ORD-0042')).getByRole('button', { name: 'No' }))
    expect(card('ORD-0042')).toBeInTheDocument()
    await userEvent.click(within(card('ORD-0042')).getByRole('button', { name: 'Cancelar' }))
    await userEvent.click(within(card('ORD-0042')).getByRole('button', { name: 'Sí, cancelar' }))
    expect(screen.queryByRole('article', { name: 'Pedido ORD-0042' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: /Cancelados 1/ }))
    expect(card('ORD-0042')).toBeInTheDocument()
  })

  it('un pedido que llega en vivo aparece marcado como Nuevo y actualiza el título', () => {
    render(<MerchantPanel />)
    act(() => { getOrderRepository().create(newOrder('ORD-7001')) })
    expect(within(card('ORD-7001')).getByText('Nuevo')).toBeInTheDocument()
    expect(within(card('ORD-7001')).getByText('Sin chile')).toBeInTheDocument()
    expect(document.title).toBe("(2) Pedidos — Vaquero's")
  })

  it('pedidos con más de 15 min sin atender se marcan urgentes', () => {
    render(<MerchantPanel />)
    // ORD-0041 se sembró hace 19 min y está en preparación
    expect(within(card('ORD-0041')).getByText('Hace 19 min')).toHaveClass('text-warning')
    expect(within(card('ORD-0043')).getByText('Hace 4 min')).not.toHaveClass('text-warning')
  })
})

describe('Estatus en vivo para el cliente', () => {
  it('la pantalla del pedido refleja lo que hace el restaurante', () => {
    getOrderRepository().create(newOrder('ORD-8000', { deliveryMethod: 'pickup' }))
    const base = { ...newOrder('ORD-8000'), items: [], total: 0 }
    render(<OrderStatus order={base} />)
    expect(screen.getAllByText('Recibido').length).toBeGreaterThan(0)
    act(() => { getOrderRepository().updateStatus('ORD-8000', 'confirmed') })
    expect(screen.getAllByText('Confirmado').length).toBeGreaterThan(0)
    expect(screen.getByText(/Agua Natural/)).toBeInTheDocument()
  })

  it('el evento storage de otra pestaña también actualiza al cliente', () => {
    const repo = getOrderRepository()
    repo.create(newOrder('ORD-8001'))
    render(<OrderStatus order={{ ...newOrder('ORD-8001'), items: [], total: 0 }} />)
    const updated = repo.list().map(o => (o.id === 'ORD-8001' ? { ...o, status: 'ready' } : o))
    act(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      fireEvent(window, new StorageEvent('storage', { key: STORAGE_KEY }))
    })
    expect(screen.getAllByText('Listo').length).toBeGreaterThan(0)
  })
})
