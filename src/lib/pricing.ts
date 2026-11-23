import menuData from '@/data/menu.json'
import ordersData from '@/data/orders.json'
import type { Product, VariantGroup } from '@/types/menu'
import type { AppliedPromo } from '@/lib/promotions'

/**
 * Cálculo de precios: única fuente de verdad para totales.
 *
 * El servidor NUNCA confía en montos enviados por el cliente: recibe solo
 * qué se pidió (producto, variantes, cantidad) y recalcula aquí con los
 * precios del menú.
 */

export const MAX_QUANTITY_PER_LINE = 50
export const MAX_LINES = 50

export interface OrderLineInput {
  productId: string
  quantity: number
  /** groupId → optionId (multi: ids separados por coma) */
  selectedVariants: Record<string, string>
}

export interface PricedLine {
  productId:        string
  name:             string
  quantity:         number
  unitPrice:        number
  variantExtra:     number
  subtotal:         number
  selectedVariants: Record<string, string>
  variantLabels:    Record<string, string>
}

export interface PricedOrder {
  lines:       PricedLine[]
  subtotal:    number
  /** Descuento de promoción/cupón (solo sobre productos) */
  discount:    number
  promoId?:    string
  promoName?:  string
  deliveryFee: number
  total:       number
}

export class PricingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PricingError'
  }
}

const products = menuData.products as Product[]
const variantGroups = menuData.variants as Record<string, VariantGroup>

const splitIds = (value: string) => value.split(',').map(s => s.trim()).filter(Boolean)

export function priceLine(input: OrderLineInput, catalog: Product[] = products): PricedLine {
  const product = catalog.find(p => p.id === input.productId)
  if (!product) throw new PricingError(`Producto desconocido: ${input.productId}`)
  if (!product.available) throw new PricingError(`${product.name} no está disponible`)

  const { quantity } = input
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY_PER_LINE) {
    throw new PricingError(`Cantidad inválida para ${product.name}`)
  }

  const selected = input.selectedVariants ?? {}
  for (const groupId of Object.keys(selected)) {
    if (!product.variantGroups.includes(groupId)) {
      throw new PricingError(`${product.name} no tiene la opción "${groupId}"`)
    }
  }

  let variantExtra = 0
  const variantLabels: Record<string, string> = {}
  const cleanVariants: Record<string, string> = {}

  for (const groupId of product.variantGroups) {
    const group = variantGroups[groupId]
    if (!group) throw new PricingError(`Grupo de variantes desconocido: ${groupId}`)

    const ids = selected[groupId] ? splitIds(selected[groupId]) : []
    if (ids.length === 0) {
      if (group.required) throw new PricingError(`Falta elegir ${group.label} en ${product.name}`)
      continue
    }
    if (!group.multi && ids.length > 1) {
      throw new PricingError(`${group.label} admite una sola opción`)
    }
    if (new Set(ids).size !== ids.length) {
      throw new PricingError(`Opción repetida en ${group.label}`)
    }

    const labels: string[] = []
    for (const id of ids) {
      const option = group.options.find(o => o.id === id)
      if (!option) throw new PricingError(`Opción desconocida en ${group.label}: ${id}`)
      variantExtra += option.price
      labels.push(option.label)
    }
    variantLabels[groupId] = labels.join(', ')
    cleanVariants[groupId] = ids.join(',')
  }

  const unitPrice = product.price
  return {
    productId:        product.id,
    name:             product.name,
    quantity,
    unitPrice,
    variantExtra,
    subtotal:         (unitPrice + variantExtra) * quantity,
    selectedVariants: cleanVariants,
    variantLabels,
  }
}

export function getDeliveryFee(deliveryMethod: string): number {
  const method = ordersData.deliveryMethods.find(m => m.id === deliveryMethod)
  if (!method) throw new PricingError(`Método de entrega inválido: ${deliveryMethod}`)
  return method.price
}

export function priceOrder(
  items: OrderLineInput[], deliveryMethod: string, catalog: Product[] = products, promo: AppliedPromo | null = null,
  /** Envío calculado por distancia (solo domicilio); si no, el fijo del método */
  deliveryFeeOverride?: number,
): PricedOrder {
  if (!Array.isArray(items) || items.length === 0) throw new PricingError('El pedido está vacío')
  if (items.length > MAX_LINES) throw new PricingError('Demasiados productos en un pedido')

  const lines = items.map(item => priceLine(item, catalog))
  const subtotal = lines.reduce((sum, l) => sum + l.subtotal, 0)
  const methodFee = getDeliveryFee(deliveryMethod)
  const deliveryFee = deliveryMethod === 'delivery' && deliveryFeeOverride !== undefined ? deliveryFeeOverride : methodFee
  const discount = Math.min(promo?.discount ?? 0, subtotal)
  return {
    lines, subtotal, discount, deliveryFee,
    ...(discount > 0 && promo ? { promoId: promo.id, promoName: promo.name } : {}),
    total: subtotal - discount + deliveryFee,
  }
}
