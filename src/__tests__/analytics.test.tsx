import { render, screen, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  bucketsFor, change, firstOrderAt, inRange, periodRanges, salesByDay, salesByHour, salesByMethod, salesByMonth,
  summarize, topProducts,
} from '@/lib/orders/analytics'
import { getOrderRepository, resetOrderRepository, STORAGE_KEY } from '@/lib/orders/repository'
import { PerformanceDashboard, niceMax, money, moneyCompact } from '@/components/merchant/PerformanceDashboard'
import type { Order } from '@/types/order'

// Sábado 21 nov 2026, 8:30 p.m. (hora local)
const NOW = new Date(2026, 10, 21, 20, 30).getTime()
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).toISOString()

const order = (id: string, over: Partial<Order>): Order => ({
  id, createdAt: at(21, 19), updatedAt: at(21, 19, 20), status: 'delivered', deliveryMethod: 'pickup',
  customer: { name: 'X', phone: '', notes: '' },
  items: [{ productId: 'boneless-10', name: 'Boneless 10 pzas', quantity: 1, unitPrice: 190, variants: {}, subtotal: 190 }],
  subtotal: 190, deliveryFee: 0, total: 190, ...over,
})

const ORDERS: Order[] = [
  order('A', {}),                                                                         // hoy 19:00, 20 min
  order('B', { createdAt: at(21, 20), updatedAt: at(21, 20, 40), deliveryMethod: 'delivery', total: 235, subtotal: 190, deliveryFee: 45 }),
  order('C', { createdAt: at(21, 14), status: 'cancelled' }),                             // cancelado
  order('D', { createdAt: at(21, 20, 10), status: 'preparing',
    items: [{ productId: 'agua', name: 'Agua Natural', quantity: 3, unitPrice: 15, variants: {}, subtotal: 45 }], subtotal: 45, total: 45 }),
  order('E', { createdAt: at(20, 19), updatedAt: at(20, 19, 30) }),                       // ayer, antes de esta hora
  order('F', { createdAt: at(20, 21), updatedAt: at(20, 21, 30), total: 500 }),           // ayer, después de esta hora
  order('G', { createdAt: at(10, 19), updatedAt: at(10, 19, 30), total: 300 }),           // hace 11 días
]

describe('analytics', () => {
  it('ventana de hoy compara contra ayer a la misma hora', () => {
    const { current, previous } = periodRanges('today', NOW)
    expect(inRange(ORDERS, current).map(o => o.id).sort()).toEqual(['A', 'B', 'C', 'D'])
    expect(inRange(ORDERS, previous!).map(o => o.id)).toEqual(['E'])
  })

  it('7 días contra los 7 anteriores', () => {
    const { current, previous } = periodRanges('7d', NOW)
    expect(inRange(ORDERS, current).map(o => o.id).sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
    expect(inRange(ORDERS, previous!).map(o => o.id)).toEqual(['G'])
  })

  it('último mes, 6 meses e histórico', () => {
    const m = periodRanges('30d', NOW)
    expect(inRange(ORDERS, m.current)).toHaveLength(7)
    expect(m.previous!.end - m.previous!.start).toBe(m.current.end - m.current.start)

    const six = periodRanges('6m', NOW)
    expect(new Date(six.current.start)).toEqual(new Date(2026, 4, 21))
    expect(new Date(six.previous!.start)).toEqual(new Date(2025, 10, 21))

    const first = firstOrderAt(ORDERS)!
    expect(new Date(first)).toEqual(new Date(2026, 10, 10, 19))
    const all = periodRanges('all', NOW, first)
    expect(all.previous).toBeNull()
    expect(inRange(ORDERS, all.current)).toHaveLength(ORDERS.length)
    expect(firstOrderAt([])).toBeNull()
  })

  it('agrupa por mes con meses parciales y años', () => {
    const range = { start: new Date(2025, 10, 21).getTime(), end: NOW }
    const buckets = salesByMonth(ORDERS, range)
    expect(buckets).toHaveLength(13)
    expect(buckets[0].label).toBe('nov 25')
    expect(buckets.at(-1)).toMatchObject({ label: 'nov 26', orders: 6 })
    expect(bucketsFor('6m', ORDERS, periodRanges('6m', NOW).current, NOW)).toHaveLength(7)
    expect(bucketsFor('30d', ORDERS, periodRanges('30d', NOW).current, NOW)).toHaveLength(30)
  })

  it('resumen: ventas sin cancelados, ticket y tiempo de entrega', () => {
    const today = inRange(ORDERS, periodRanges('today', NOW).current)
    const s = summarize(today)
    expect(s.revenue).toBe(190 + 235 + 45)
    expect(s.orders).toBe(3)
    expect(s.avgTicket).toBe(157)
    expect(s.avgFulfillmentMin).toBe(30) // (20 + 40) / 2, solo entregados
    expect(s.cancelled).toBe(1)
    expect(s.cancelRate).toBe(0.25)
  })

  it('cambio relativo', () => {
    expect(change(150, 100)).toBe(0.5)
    expect(change(5, 0)).toBeNull()
  })

  it('ventas por hora solo en horario del sábado (12–23)', () => {
    const buckets = salesByHour(ORDERS.slice(0, 4), NOW)
    expect(buckets[0].label).toBe('12:00')
    expect(buckets).toHaveLength(11)
    expect(buckets.find(b => b.key === '20')).toMatchObject({ revenue: 280, orders: 2 })
    expect(buckets.find(b => b.key === '14')?.revenue).toBe(0) // el cancelado no cuenta
  })

  it('ventas por día incluye días en cero', () => {
    const range = periodRanges('7d', NOW).current
    const buckets = salesByDay(inRange(ORDERS, range), range)
    expect(buckets).toHaveLength(7)
    expect(buckets.at(-1)).toMatchObject({ label: 'Sáb 21', orders: 3 })
    expect(buckets.at(-2)).toMatchObject({ label: 'Vie 20', revenue: 690 })
    expect(buckets[0].revenue).toBe(0)
  })

  it('más vendido por unidades y mezcla por tipo de pedido', () => {
    const today = ORDERS.slice(0, 4)
    expect(topProducts(today)[0]).toMatchObject({ productId: 'agua', units: 3 })
    const methods = salesByMethod(today)
    expect(methods.find(m => m.id === 'pickup')).toMatchObject({ orders: 2 })
    expect(methods.find(m => m.id === 'delivery')?.share).toBeCloseTo(1 / 3)
  })

  it('niceMax y formato de dinero', () => {
    expect(niceMax(0)).toBe(1)
    expect(niceMax(430)).toBe(500)
    expect(niceMax(1200)).toBe(2000)
    expect(money(12345)).toBe('$12,345')
    expect(moneyCompact(800)).toBe('$800')
    expect(moneyCompact(2500)).toBe('$2.5k')
    expect(moneyCompact(20000)).toBe('$20k')
    expect(moneyCompact(1_200_000)).toBe('$1.2M')
  })
})

describe('PerformanceDashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW })
    localStorage.clear()
    // Solo los pedidos de prueba: sin siembra ni historial de ejemplo
    resetOrderRepository({ withHistory: false })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ORDERS))
  })
  afterEach(() => {
    vi.useRealTimers()
    resetOrderRepository()
  })

  it('muestra KPIs de hoy con comparación contra ayer', () => {
    render(<PerformanceDashboard />)
    const region = screen.getByRole('region', { name: 'Desempeño' })
    expect(within(region).getByText('$470')).toBeInTheDocument()       // ventas
    expect(within(region).getByText('1 cancelados (25%)')).toBeInTheDocument()
    expect(within(region).getByText('30 min')).toBeInTheDocument()
    expect(within(region).getByText('Ventas por hora')).toBeInTheDocument()
    expect(within(region).getByText('Lo más vendido')).toBeInTheDocument()
  })

  it('estado vacío cuando no hay ventas', () => {
    localStorage.setItem(STORAGE_KEY, '[]')
    resetOrderRepository({ withHistory: false })
    render(<PerformanceDashboard />)
    expect(screen.getAllByText('Aún no hay ventas en este periodo.').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Ver tabla' })).not.toBeInTheDocument()
  })

  it('cambia a 7 días y ofrece vista de tabla', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    render(<PerformanceDashboard />)
    await user.click(screen.getByRole('tab', { name: '7 días' }))
    expect(screen.getByText('Ventas por día')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver tabla' }))
    const table = screen.getByRole('table')
    expect(within(table).getByText('Sáb 21')).toBeInTheDocument()
    expect(within(table).getByText('$690')).toBeInTheDocument()
  })

  it('tooltip al pasar sobre una barra', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    render(<PerformanceDashboard />)
    await user.hover(screen.getByRole('button', { name: /^20:00/ }))
    expect(screen.getByRole('status')).toHaveTextContent('$280')
  })

  it('histórico: desde el primer pedido y sin comparación', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    render(<PerformanceDashboard />)
    await user.click(screen.getByRole('tab', { name: 'Histórico' }))
    expect(screen.getByText(/desde el 10 nov 2026/)).toBeInTheDocument()
    expect(screen.getByText('Ventas por mes')).toBeInTheDocument()
    expect(screen.queryByText(/vs\./)).not.toBeInTheDocument()
    const ventas = screen.getByText('Ventas').parentElement!
    expect(within(ventas).getByText('$1,460')).toBeInTheDocument()
  })

  it('6 meses compara contra los 6 anteriores', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    render(<PerformanceDashboard />)
    await user.click(screen.getByRole('tab', { name: '6 meses' }))
    expect(screen.getAllByText(/vs\. los 6 meses anteriores/).length).toBeGreaterThan(0)
  })

  it('se actualiza cuando llega un pedido', () => {
    render(<PerformanceDashboard />)
    act(() => { getOrderRepository().create(order('Z', { createdAt: at(21, 20, 20), status: 'pending', total: 30 })) })
    const ventas = screen.getByText('Ventas').parentElement!
    expect(within(ventas).getByText('$500')).toBeInTheDocument()
  })
})
