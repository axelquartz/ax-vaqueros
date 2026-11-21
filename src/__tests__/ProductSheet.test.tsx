import { useState } from 'react'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import userEvent from '@testing-library/user-event'
import { CartProvider, useCart } from '@/context/CartContext'
import { ProductSheet } from '@/components/menu/ProductSheet'
import { ProductCard } from '@/components/menu/ProductCard'
import menu from '@/data/menu.json'
import { priceLine } from '@/lib/pricing'
import type { Product } from '@/types/menu'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
import { CartDrawer } from '@/components/cart/CartDrawer'

const byId = (id: string) => menu.products.find(p => p.id === id) as Product
const alitas  = byId('alitas-5')            // sabor, dip, totopos (requeridos)
const dedos   = byId('dedos-queso-5')       // sin variantes
const combo   = byId('combinado-chico')     // salsas (multi, opcional)
const refresco = byId('refresco')           // tamaño requerido

function CartProbe() {
  const { itemCount, total, items } = useCart()
  return <output data-testid="probe">{`${itemCount}|${total}|${items.map(i => i.productId).join(',')}`}</output>
}
const probe = () => screen.getByTestId('probe').textContent!.split('|')

function renderSheet(product: Product | null, onClose = vi.fn()) {
  const utils = render(
    <CartProvider>
      <ProductSheet product={product} onClose={onClose} />
      <CartProbe />
    </CartProvider>,
  )
  return { ...utils, onClose }
}

const addButton = () => screen.getByRole('button', { name: /Agregar/ })

/** Selecciona la primera opción de cada grupo requerido */
async function pickRequired(product: Product) {
  for (const gid of product.variantGroups) {
    const group = (menu.variants as Record<string, { required: boolean; options: { label: string }[] }>)[gid]
    if (!group.required) continue
    const label = group.options[0].label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}`) }))
  }
}

describe('ProductSheet', () => {
  it('no renderiza nada sin producto', () => {
    renderSheet(null)
    expect(screen.queryByRole('button', { name: /Agregar/ })).not.toBeInTheDocument()
  })

  it('producto sin variantes: Agregar funciona y cierra', async () => {
    const { onClose } = renderSheet(dedos)
    expect(addButton()).toBeEnabled()
    expect(addButton()).toHaveTextContent(`$${dedos.price}`)
    await userEvent.click(addButton())
    expect(probe()).toEqual(['1', String(dedos.price), dedos.id])
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('variantes requeridas: deshabilitado hasta elegir todas, luego agrega', async () => {
    const { onClose } = renderSheet(alitas)
    expect(addButton()).toBeDisabled()
    await pickRequired(alitas)
    expect(addButton()).toBeEnabled()
    await userEvent.click(addButton())
    expect(probe()[0]).toBe('1')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('refresco: tamaño requerido suma su precio', async () => {
    renderSheet(refresco)
    await pickRequired(refresco)
    await userEvent.click(addButton())
    const extra = (menu.variants as Record<string, { options: { price: number }[] }>).drink_size.options[0].price
    expect(probe()[1]).toBe(String(refresco.price + extra))
  })

  it('variantes opcionales multi se pueden omitir', async () => {
    renderSheet(combo)
    expect(addButton()).toBeEnabled()
    await userEvent.click(addButton())
    expect(probe()[0]).toBe('1')
  })

  it('cantidad multiplica el total', async () => {
    renderSheet(dedos)
    await userEvent.click(screen.getByRole('button', { name: '+' }))
    await userEvent.click(screen.getByRole('button', { name: '+' }))
    expect(addButton()).toHaveTextContent(`$${dedos.price * 3}`)
    await userEvent.click(addButton())
    expect(probe()).toEqual(['3', String(dedos.price * 3), dedos.id])
  })

  it('chips de variantes con área táctil mobile-first y estado accesible', async () => {
    renderSheet(alitas)
    const label = (menu.variants as Record<string, { options: { label: string }[] }>).sabor.options[0].label
    const chip = screen.getByRole('button', { name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) })
    expect(chip).toHaveClass('min-h-10', 'px-4', 'text-sm')
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
  })

  it('multi: dos toques seguidos en el mismo render conservan ambas opciones', () => {
    renderSheet(byId('tostilocos'))
    const chips = screen.getAllByRole('button', { pressed: false })
    act(() => { chips[1].click(); chips[2].click() })
    expect(chips[1]).toHaveAttribute('aria-pressed', 'true')
    expect(chips[2]).toHaveAttribute('aria-pressed', 'true')
  })

  it('queda por encima del carrito y con footer fijo', () => {
    renderSheet(dedos)
    const sheet = addButton().closest('.fixed')!
    expect(sheet).toHaveClass('z-[70]')
    expect(sheet).toHaveClass('animate-sheet-in')
  })

  it('al cerrar anima la salida y se desmonta al terminar', () => {
    const { rerender } = renderSheet(dedos)
    rerender(
      <CartProvider>
        <ProductSheet product={null} onClose={vi.fn()} />
        <CartProbe />
      </CartProvider>,
    )
    const sheet = screen.getByRole('button', { name: /Agregar/ }).closest('.fixed')!
    expect(sheet).toHaveClass('animate-sheet-out')
    fireEvent.animationEnd(sheet)
    expect(screen.queryByRole('button', { name: /Agregar/ })).not.toBeInTheDocument()
  })

  it('se desmonta aunque animationend nunca llegue (respaldo por tiempo)', () => {
    vi.useFakeTimers()
    try {
      const { rerender } = renderSheet(dedos)
      rerender(
        <CartProvider>
          <ProductSheet product={null} onClose={vi.fn()} />
          <CartProbe />
        </CartProvider>,
      )
      expect(screen.getByRole('button', { name: /Agregar/ })).toBeInTheDocument()
      act(() => { vi.advanceTimersByTime(400) })
      expect(screen.queryByRole('button', { name: /Agregar/ })).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('el tiempo de respaldo coincide con la duración del CSS', () => {
    const css = fs.readFileSync(path.resolve('src/app/globals.css'), 'utf8')
    const src = fs.readFileSync(path.resolve('src/components/menu/ProductSheet.tsx'), 'utf8')
    const cssMs = Number(css.match(/--animate-sheet-out:\s*sheet-out\s+(\d+)ms/)![1])
    const tsMs  = Number(src.match(/const EXIT_MS = (\d+)/)![1])
    expect(tsMs).toBe(cssMs)
  })
})

describe('Precio del cliente = precio del servidor', () => {
  const groups = menu.variants as Record<string, { required: boolean; multi?: boolean; options: { id: string; label: string }[] }>

  it.each(menu.products.filter(p => p.available).map(p => [p.id]))('%s', async id => {
    const product = byId(id)
    let added: { subtotal: number; quantity: number; selectedVariants: Record<string, string> } | undefined
    function Spy() {
      const { items } = useCart()
      added = items[0]
      return null
    }
    render(<CartProvider><ProductSheet product={product} onClose={vi.fn()} /><Spy /></CartProvider>)

    // requeridas + la última opción de cada grupo multi, y cantidad 2
    for (const gid of product.variantGroups) {
      const g = groups[gid]
      const picks = g.required ? [g.options[0]] : g.multi ? [g.options[g.options.length - 1]] : []
      for (const o of picks) {
        const label = o.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}`) }))
      }
    }
    await userEvent.click(screen.getByRole('button', { name: '+' }))
    await userEvent.click(addButton())

    const server = priceLine({ productId: id, quantity: added!.quantity, selectedVariants: added!.selectedVariants })
    expect(added!.subtotal).toBe(server.subtotal)
  })
})

/** Reproduce el flujo real de la página: tarjeta → sheet → carrito */
function MenuHarness({ products }: { products: Product[] }) {
  const [selected, setSelected] = useState<Product | null>(null)
  return (
    <CartProvider>
      {products.map(p => <ProductCard key={p.id} product={p} onSelect={setSelected} />)}
      <ProductSheet product={selected} onClose={() => setSelected(null)} />
      <CartDrawer />
      <CartProbe />
    </CartProvider>
  )
}

describe('Flujo de pedido (menú → sheet → carrito)', () => {
  it('agrega un producto, abre otro y Agregar sigue funcionando', async () => {
    render(<MenuHarness products={[dedos, alitas, combo]} />)

    await userEvent.click(screen.getByText(dedos.name))
    await userEvent.click(addButton())
    expect(probe()[0]).toBe('1')
    expect(screen.getByRole('button', { name: 'Hacer pedido' })).toBeInTheDocument()

    // termina la animación de salida del primer sheet
    const closingSheet = document.querySelector('.animate-sheet-out')
    if (closingSheet) fireEvent.animationEnd(closingSheet)

    // segundo producto, con el carrito ya visible
    await userEvent.click(screen.getByText(alitas.name))
    await pickRequired(alitas)
    await userEvent.click(addButton())
    expect(probe()[0]).toBe('2')
    expect(probe()[2]).toBe(`${dedos.id},${alitas.id}`)
  })

  it('abre otro producto mientras el anterior aún se está cerrando', async () => {
    render(<MenuHarness products={[dedos, combo]} />)
    await userEvent.click(screen.getByText(dedos.name))
    await userEvent.click(addButton())
    // sin disparar animationEnd: el sheet viejo sigue saliendo
    await userEvent.click(screen.getByText(combo.name))
    expect(screen.getByRole('heading', { level: 2, name: combo.name })).toBeInTheDocument()
    await userEvent.click(addButton())
    expect(probe()[0]).toBe('2')
  })

  it('reabrir el mismo producto reinicia cantidad y variantes', async () => {
    render(<MenuHarness products={[dedos]} />)
    await userEvent.click(screen.getByText(dedos.name))
    await userEvent.click(screen.getByRole('button', { name: '+' }))
    await userEvent.click(addButton())
    fireEvent.animationEnd(document.querySelector('.animate-sheet-out')!)
    await userEvent.click(screen.getAllByText(dedos.name)[0])
    expect(addButton()).toHaveTextContent(`$${dedos.price}`)
  })
})

describe('CartDrawer', () => {
  it('no aparece con el carrito vacío', () => {
    render(<CartProvider><CartDrawer /></CartProvider>)
    expect(screen.queryByText('Hacer pedido')).not.toBeInTheDocument()
  })

  it('expande/colapsa con transición y bloquea el panel colapsado', async () => {
    render(<MenuHarness products={[dedos]} />)
    await userEvent.click(screen.getByText(dedos.name))
    await userEvent.click(addButton())

    const toggle = screen.getByRole('button', { name: /artículo/ })
    const panel = screen.getByText('Eliminar').closest('.grid')!
    expect(panel).toHaveClass('grid-rows-[0fr]')
    expect(panel).toHaveAttribute('inert')

    await userEvent.click(toggle)
    expect(panel).toHaveClass('grid-rows-[1fr]')
    expect(panel).not.toHaveAttribute('inert')
    within(panel as HTMLElement).getByText(dedos.name)
  })

  it('el toggle dice "Ver pedido", en texto más chico que los botones', async () => {
    render(<MenuHarness products={[dedos]} />)
    await userEvent.click(screen.getByText(dedos.name))
    await userEvent.click(addButton())

    const label = screen.getByText('Ver pedido')
    expect(label).toHaveClass('text-xs')
    expect(screen.getByRole('button', { name: 'Hacer pedido' })).toHaveClass('text-sm')

    const toggle = screen.getByRole('button', { name: /Ver pedido/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(label)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('Hacer pedido navega a /checkout', async () => {
    render(<MenuHarness products={[dedos]} />)
    await userEvent.click(screen.getByText(dedos.name))
    await userEvent.click(addButton())
    await userEvent.click(screen.getByRole('button', { name: 'Hacer pedido' }))
    expect(push).toHaveBeenCalledWith('/checkout')
  })
})
