import { notifyStaff } from '@/lib/push'
import { getServerSupabase } from '@/lib/supabase/server'
import type { PricedOrder } from '@/lib/pricing'
import type { Customer, Order } from '@/types/order'
import { ORDER_COLUMNS, rowToOrder, type OrderRow } from './rows'
import { getPayment, isMercadoPagoConfigured, paymentPaysOrder, type MpPayment } from '@/lib/mercadopago'

/**
 * Pedidos en Supabase, del lado del servidor (clave secreta).
 *
 * Ciclo de vida:
 *  1. createDraft: al llegar al paso de pago se guarda el pedido sin pagar
 *     (con el total calculado por el servidor) y se genera el folio.
 *  2. Al cobrar (/api/checkout/pay) se guarda el id del pago de Mercado Pago.
 *     Se marca pagado con lo que llegue primero: la respuesta del cobro, el
 *     aviso de Mercado Pago o la consulta del cliente. Siempre se verifica el
 *     pago con Mercado Pago. Desde ahí lo ve el equipo. Es idempotente.
 *  3. El cliente consulta su pedido con folio + access_token.
 */

export interface DraftInput {
  deliveryMethod: string
  customer: Customer
  priced: PricedOrder
}

export interface Draft {
  folio: string
  accessToken: string
}

const MAX_FOLIO_ATTEMPTS = 5

/** Folio legible de 5 dígitos; la llave primaria evita duplicados */
function randomFolio(): string {
  return `ORD-${Math.floor(10000 + Math.random() * 90000)}`
}

function draftFields({ deliveryMethod, customer, priced }: DraftInput) {
  return {
    delivery_method: deliveryMethod,
    customer,
    items: priced.lines.map(l => ({
      productId: l.productId,
      name: l.name,
      quantity: l.quantity,
      unitPrice: l.unitPrice + l.variantExtra,
      variants: l.variantLabels,
      subtotal: l.subtotal,
    })),
    subtotal: priced.subtotal,
    delivery_fee: priced.deliveryFee,
    discount: priced.discount,
    promo_id: priced.promoId ?? null,
    promo_name: priced.promoName ?? null,
    total: priced.total,
  }
}

export async function createDraft(input: DraftInput): Promise<Draft> {
  const db = getServerSupabase()
  for (let attempt = 0; attempt < MAX_FOLIO_ATTEMPTS; attempt++) {
    const folio = randomFolio()
    const { data, error } = await db
      .from('orders')
      .insert({ id: folio, ...draftFields(input) })
      .select('id, access_token')
      .single()
    if (!error) return { folio: data.id, accessToken: data.access_token }
    if (error.code !== '23505') throw new Error(`No se pudo guardar el pedido: ${error.message}`)
  }
  throw new Error('No se pudo generar un folio único')
}

/**
 * El total cambió en el paso de pago (p. ej. agregó algo): actualiza el mismo
 * borrador. Devuelve false si no existe, el token no coincide o ya se pagó.
 */
export async function updateDraft(draft: Draft, input: DraftInput): Promise<boolean> {
  const { data, error } = await getServerSupabase()
    .from('orders')
    .update({ ...draftFields(input), payment_intent_id: null })
    .eq('id', draft.folio)
    .eq('access_token', draft.accessToken)
    .is('paid_at', null)
    .select('id')
  if (error) throw new Error(`No se pudo actualizar el pedido: ${error.message}`)
  return (data ?? []).length > 0
}

/** Guarda el id del pago de Mercado Pago (columna payment_intent_id) */
export async function attachPayment(folio: string, paymentId: string): Promise<void> {
  const { error } = await getServerSupabase()
    .from('orders')
    .update({ payment_intent_id: paymentId })
    .eq('id', folio)
    .is('paid_at', null)
  if (error) throw new Error(`No se pudo ligar el pago al pedido: ${error.message}`)
}

type CustomerRow = OrderRow & { access_token: string; payment_intent_id: string | null }

export async function findForCustomer(folio: string, accessToken: string): Promise<CustomerRow | null> {
  if (!UUID_RE.test(accessToken)) return null
  const { data, error } = await getServerSupabase()
    .from('orders')
    .select(`${ORDER_COLUMNS}, access_token, payment_intent_id`)
    .eq('id', folio)
    .eq('access_token', accessToken)
    .maybeSingle()
  if (error) throw new Error(`No se pudo leer el pedido: ${error.message}`)
  return data as CustomerRow | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function setPaid(folio: string): Promise<void> {
  const { data, error } = await getServerSupabase()
    .from('orders')
    .update({ paid_at: new Date().toISOString() })
    .eq('id', folio)
    .is('paid_at', null)
    .select('id')
  if (error) throw new Error(`No se pudo marcar pagado: ${error.message}`)
  if (data?.length) void notifyStaff({ title: 'Pedido nuevo', body: folio })
}

export type CustomerOrderResult =
  | { found: false }
  | { found: true; paid: boolean; order: Order }

/**
 * Pedido para el cliente (folio + token). Si aún no está pagado y tiene un
 * pago de Mercado Pago, lo consulta y lo marca pagado si ya se aprobó: cubre
 * el caso en que el aviso todavía no llega.
 * `confirmDemo` marca pagado sin cobrar (solo cuando no hay Mercado Pago).
 */
export async function getCustomerOrder(
  folio: string,
  accessToken: string,
  opts: { confirmDemo?: boolean } = {},
): Promise<CustomerOrderResult> {
  const row = await findForCustomer(folio, accessToken)
  if (!row) return { found: false }

  let paid = Boolean(row.paid_at)
  if (!paid && isMercadoPagoConfigured()) {
    if (row.payment_intent_id) {
      const payment = await getPayment(row.payment_intent_id)
      if (paymentPaysOrder(payment, row)) {
        await setPaid(row.id)
        paid = true
      }
    }
  } else if (!paid && opts.confirmDemo) {
    await setPaid(row.id)
    paid = true
  }
  return { found: true, paid, order: rowToOrder(row) }
}

/**
 * Aviso de Mercado Pago (ya consultado con su API): marca pagado el pedido de
 * ese folio si el pago lo cubre. Idempotente. Devuelve el folio o null.
 */
export async function markPaidByPayment(payment: MpPayment): Promise<string | null> {
  if (!payment.external_reference) return null
  const { data, error } = await getServerSupabase()
    .from('orders')
    .select('id, total, paid_at')
    .eq('id', payment.external_reference)
    .maybeSingle()
  if (error) throw new Error(`No se pudo leer el pedido: ${error.message}`)
  if (!data) return null
  if (data.paid_at) return data.id
  if (!paymentPaysOrder(payment, data)) {
    if (payment.status === 'approved') console.warn(`Pago ${payment.id} no coincide con el pedido ${data.id}; no se marca pagado`)
    return null
  }
  await setPaid(data.id)
  return data.id
}
