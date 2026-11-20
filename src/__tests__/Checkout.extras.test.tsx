import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CartProvider, useCart } from '@/context/CartContext'
import { Upsell, pickUpsell, hasRequiredVariants } from '@/components/checkout/Upsell'
import { PaymentSuccess } from '@/components/order/PaymentSuccess'
import { saveOrder } from '@/lib/orderHistory'
import menu from '@/data/menu.json'
import upsell from '@/data/upsell.json'
import fs from 'node:fs'
import path from 'node:path'
import type { Product } from '@/types/menu'
import type { Order } from '@/types/order'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
import { OrderStatus } from '@/components/order/OrderStatus'

const byId = (id: string) => menu.products.find(p => p.id === id) as Product

function CartProbe() {
  const { items } = useCart()
  return <output data-testid="probe">{items.map(i => `${i.productId}x${i.quantity}`).join(',')}</output>
}

function Seed({ ids }: { ids: string[] }) {
  const { addItem, items } = useCart()
  if (items.length === 0 && ids.length) {
    queueMicrotask(() => ids.forEach(id => {
      const p = byId(id)
      addItem({ productId: id, name: p.name, quantity: 1, unitPrice: p.price, selectedVariants: {}, variantLabels: {}, variantExtra: 0, subtotal: p.price })
    }))
  }
  return null
}

describe('pickUpsell', () => {
  it('respeta el orden configurado y el máximo', () => {
    const picked = pickUpsell([])
    expect(picked.map(p => p.id)).toEqual(upsell.productIds.slice(0, upsell.maxItems))
  })

  it('excluye lo que ya está en el carrito', () => {
    const picked = pickUpsell(['agua', 'refresco'])
    expect(picked.map(p => p.id)).not.toContain('agua')
    expect(picked.map(p => p.id)).not.toContain('refresco')
    expect(picked).toHaveLength(upsell.maxItems)
  })

  it('todos los ids configurados existen en el menú', () => {
    upsell.productIds.forEach(id => expect(byId(id)).toBeDefined())
  })

  it('detecta variantes obligatorias', () => {
    expect(hasRequiredVariants(byId('refresco'))).toBe(true)
    expect(hasRequiredVariants(byId('agua'))).toBe(false)
  })
})

describe('Upsell "¿Te falta algo?"', () => {
  it('muestra título y tarjetas', () => {
    render(<CartProvider><Upsell onOpenProduct={vi.fn()} /></CartProvider>)
    expect(screen.getByRole('heading', { name: '¿Te falta algo?' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(upsell.maxItems)
  })

  it('producto sin variantes se agrega con un toque y muestra ✓', async () => {
    render(<CartProvider><Upsell onOpenProduct={vi.fn()} /><CartProbe /></CartProvider>)
    const agua = byId('agua')
    await userEvent.click(screen.getByRole('button', { name: `Agregar ${agua.name}, $${agua.price}` }))
    expect(screen.getByTestId('probe')).toHaveTextContent('aguax1')
    expect(screen.getByText('Agregado al pedido')).toBeInTheDocument()
  })

  it('producto con variantes obligatorias abre el sheet en vez de agregar', async () => {
    const onOpen = vi.fn()
    render(<CartProvider><Upsell onOpenProduct={onOpen} /><CartProbe /></CartProvider>)
    const refresco = byId('refresco')
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`Agregar ${refresco.name}`) }))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'refresco' }))
    expect(screen.getByTestId('probe')).toHaveTextContent('')
  })

  it('no sugiere lo que ya está en el carrito', async () => {
    render(<CartProvider><Seed ids={['agua']} /><CartProbe /></CartProvider>)
    await act(async () => {})
    // monta Upsell ya con agua en el carrito
    const { container } = render(
      <CartProvider>
        <Seed ids={['agua']} />
        <Delayed><Upsell onOpenProduct={vi.fn()} /></Delayed>
      </CartProvider>,
    )
    await act(async () => {})
    expect(container.querySelector('[aria-label^="Agregar Agua"]')).toBeNull()
  })
})

/** Monta los hijos después de que Seed llenó el carrito */
function Delayed({ children }: { children: React.ReactNode }) {
  const { items } = useCart()
  return items.length ? <>{children}</> : null
}

describe('PaymentSuccess', () => {
  it('anuncia el pago con animaciones', () => {
    render(<PaymentSuccess />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('¡Pago confirmado!')
    expect(status).toHaveTextContent('Recibimos tu pedido.')
    expect(status.querySelector('.animate-success-pop')).not.toBeNull()
    expect(status.querySelector('.animate-check-draw')).not.toBeNull()
  })

  it('las animaciones de éxito existen en el CSS', () => {
    const css = fs.readFileSync(path.resolve('src/app/globals.css'), 'utf8')
    for (const k of ['success-pop', 'check-draw', 'success-ring']) expect(css).toMatch(new RegExp(`@keyframes ${k}\\b`))
  })
})

describe('OrderStatus tras el pago', () => {
  const placeholder: Order = {
    id: 'ORD-7777', createdAt: '', updatedAt: '', status: 'pending', deliveryMethod: 'pickup',
    customer: { name: '', phone: '', notes: '' }, items: [], subtotal: 0, deliveryFee: 0, total: 0,
  }

  beforeEach(() => localStorage.clear())

  it('justPaid: muestra la confirmación y limpia ?pagado de la URL', () => {
    window.history.replaceState(null, '', '/order/ORD-7777?pagado=1')
    render(<OrderStatus order={placeholder} justPaid />)
    expect(screen.getByRole('status')).toHaveTextContent('¡Pago confirmado!')
    expect(window.location.search).toBe('')
  })

  it('sin justPaid no hay animación de éxito', () => {
    render(<OrderStatus order={placeholder} />)
    expect(screen.queryByText('¡Pago confirmado!')).not.toBeInTheDocument()
  })

  it('completa el pedido recién creado con lo guardado en el dispositivo', () => {
    saveOrder({
      folio: 'ORD-7777', timestamp: '', total: 215, deliveryMethod: 'delivery', itemCount: 2, deliveryFee: 45,
      items: [{ name: 'Dedos de Queso 5 pzas', quantity: 1, subtotal: 170, variants: {} }],
    })
    render(<OrderStatus order={placeholder} justPaid />)
    expect(screen.getByText(/Dedos de Queso 5 pzas/)).toBeInTheDocument()
    expect(screen.getByText('$215')).toBeInTheDocument()
    expect(screen.getByText(/Domicilio/)).toBeInTheDocument()
  })

  it('pedido sin productos no muestra un desglose en $0', () => {
    render(<OrderStatus order={placeholder} />)
    expect(screen.queryByText('Total')).not.toBeInTheDocument()
  })
})
