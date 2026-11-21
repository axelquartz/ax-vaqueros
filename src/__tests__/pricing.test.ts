// @vitest-environment node
import { NextRequest } from 'next/server'
import { priceLine, priceOrder, PricingError, MAX_QUANTITY_PER_LINE } from '@/lib/pricing'
import { POST } from '@/app/api/checkout/payment-intent/route'
import menu from '@/data/menu.json'
import orders from '@/data/orders.json'

type Variants = Record<string, { label: string; required: boolean; multi?: boolean; options: { id: string; label: string; price: number }[] }>
const variants = menu.variants as Variants
const product = (id: string) => menu.products.find(p => p.id === id)!

/** Primera opción de cada grupo requerido */
function requiredSelection(productId: string) {
  const sel: Record<string, string> = {}
  for (const g of product(productId).variantGroups) if (variants[g].required) sel[g] = variants[g].options[0].id
  return sel
}

describe('priceLine', () => {
  it('producto sin variantes', () => {
    const l = priceLine({ productId: 'agua', quantity: 2, selectedVariants: {} })
    expect(l).toMatchObject({ unitPrice: product('agua').price, variantExtra: 0, subtotal: product('agua').price * 2 })
  })

  it('suma el extra de variantes con precio', () => {
    const size = variants.drink_size.options.find(o => o.price > 0) ?? variants.drink_size.options[0]
    const l = priceLine({ productId: 'refresco', quantity: 1, selectedVariants: { drink_size: size.id } })
    expect(l.subtotal).toBe(product('refresco').price + size.price)
    expect(l.variantLabels.drink_size).toBe(size.label)
  })

  it('multi: suma todas las opciones elegidas', () => {
    const [a, b] = variants.ingredientes.options
    const l = priceLine({ productId: 'tostilocos', quantity: 1, selectedVariants: { ingredientes: `${a.id},${b.id}` } })
    expect(l.variantExtra).toBe(a.price + b.price)
  })

  it.each([
    ['producto inexistente', { productId: 'nope', quantity: 1, selectedVariants: {} }],
    ['cantidad 0', { productId: 'agua', quantity: 0, selectedVariants: {} }],
    ['cantidad decimal', { productId: 'agua', quantity: 1.5, selectedVariants: {} }],
    ['cantidad excesiva', { productId: 'agua', quantity: MAX_QUANTITY_PER_LINE + 1, selectedVariants: {} }],
    ['falta variante requerida', { productId: 'alitas-5', quantity: 1, selectedVariants: {} }],
    ['opción inexistente', { productId: 'refresco', quantity: 1, selectedVariants: { drink_size: 'xxl' } }],
    ['grupo ajeno al producto', { productId: 'agua', quantity: 1, selectedVariants: { sabor: variants.sabor.options[0].id } }],
    ['dos opciones en grupo de una sola', { productId: 'refresco', quantity: 1, selectedVariants: { drink_size: variants.drink_size.options.map(o => o.id).join(',') } }],
  ])('rechaza: %s', (_, input) => {
    expect(() => priceLine(input as never)).toThrow(PricingError)
  })
})

describe('priceOrder', () => {
  it('suma líneas y envío según el método', () => {
    const delivery = orders.deliveryMethods.find(m => m.price > 0)!
    const o = priceOrder([
      { productId: 'agua', quantity: 1, selectedVariants: {} },
      { productId: 'alitas-5', quantity: 1, selectedVariants: requiredSelection('alitas-5') },
    ], delivery.id)
    expect(o.deliveryFee).toBe(delivery.price)
    expect(o.total).toBe(o.subtotal + delivery.price)
  })

  it('rechaza pedido vacío y método de entrega inválido', () => {
    expect(() => priceOrder([], 'pickup')).toThrow(PricingError)
    expect(() => priceOrder([{ productId: 'agua', quantity: 1, selectedVariants: {} }], 'dron')).toThrow(PricingError)
  })
})

describe('POST /api/checkout/payment-intent', () => {
  const call = (body: unknown) =>
    POST(new NextRequest('http://localhost/api/checkout/payment-intent', { method: 'POST', body: JSON.stringify(body) }))

  const valid = {
    folio: 'ORD-1234',
    deliveryMethod: 'pickup',
    customer: { name: 'Cliente', phone: '5500000000' },
    items: [{ productId: 'dedos-queso-5', quantity: 2, selectedVariants: {} }],
  }

  it('calcula el total en el servidor', async () => {
    const res = await call(valid)
    expect(res.status).toBe(200)
    expect((await res.json()).amount).toBe(product('dedos-queso-5').price * 2)
  })

  it('ignora montos manipulados enviados por el cliente', async () => {
    const res = await call({
      ...valid,
      amount: 1,
      deliveryFee: 0,
      items: [{ ...valid.items[0], unitPrice: 1, subtotal: 1 }],
    })
    expect((await res.json()).amount).toBe(product('dedos-queso-5').price * 2)
  })

  it.each([
    ['folio inválido', { ...valid, folio: 'hack' }],
    ['sin datos de cliente', { ...valid, customer: { name: '', phone: '' } }],
    ['producto inexistente', { ...valid, items: [{ productId: 'gratis', quantity: 1, selectedVariants: {} }] }],
    ['cantidad negativa', { ...valid, items: [{ productId: 'agua', quantity: -3, selectedVariants: {} }] }],
    ['sin productos', { ...valid, items: [] }],
  ])('400: %s', async (_, body) => {
    const res = await call(body)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBeTruthy()
  })

  it('400 con JSON inválido', async () => {
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: '{nope' }))
    expect(res.status).toBe(400)
  })
})
