import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

/**
 * Mercado Pago del lado del servidor (API REST, sin SDK).
 *
 * Regla de seguridad: nunca se confía en lo que diga el navegador ni el
 * contenido de un aviso (webhook). Para saber si un pedido está pagado, el
 * servidor consulta el pago directamente a Mercado Pago con su Access Token y
 * comprueba estatus, moneda, monto y folio.
 */

const API = 'https://api.mercadopago.com/v1/payments'

export function isMercadoPagoConfigured(): boolean {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN)
}

/** Lo mínimo del pago que usa la app */
export interface MpPayment {
  id: number | string
  status: string            // approved | in_process | pending | rejected | cancelled | refunded…
  status_detail: string
  transaction_amount: number
  currency_id: string
  external_reference: string | null
}

/** Datos que entrega el formulario de tarjeta (Card Payment Brick) */
export interface CardFormData {
  token: string
  issuer_id?: string
  payment_method_id: string
  installments: number
  payer: { email?: string; identification?: { type: string; number: string } }
}

export class MercadoPagoError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'MercadoPagoError'
  }
}

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new MercadoPagoError(data?.message ?? `Mercado Pago respondió ${res.status}`, res.status)
  return data as T
}

/**
 * Cobra el pedido. El monto SIEMPRE es el total guardado en la base de datos
 * (nunca el del navegador); el folio va como external_reference.
 */
export function createCardPayment(input: {
  folio: string
  total: number
  description: string
  form: CardFormData
}): Promise<MpPayment> {
  const { form } = input
  return call<MpPayment>(API, {
    method: 'POST',
    headers: { 'X-Idempotency-Key': randomUUID() },
    body: JSON.stringify({
      transaction_amount: input.total,
      token: form.token,
      description: input.description,
      installments: form.installments,
      payment_method_id: form.payment_method_id,
      issuer_id: form.issuer_id ? Number(form.issuer_id) : undefined,
      payer: {
        email: form.payer?.email,
        identification: form.payer?.identification?.number ? form.payer.identification : undefined,
      },
      external_reference: input.folio,
      statement_descriptor: 'VAQUEROS',
    }),
  })
}

export function getPayment(id: string | number): Promise<MpPayment> {
  return call<MpPayment>(`${API}/${encodeURIComponent(String(id))}`)
}

/**
 * Reembolso total. La llave de idempotencia es estable por pago: un reintento
 * (doble clic, red caída) nunca devuelve el dinero dos veces.
 */
export function refundPayment(paymentId: string | number): Promise<{ id: number | string; status: string }> {
  return call(`${API}/${encodeURIComponent(String(paymentId))}/refunds`, {
    method: 'POST',
    headers: { 'X-Idempotency-Key': `refund-${paymentId}` },
    body: JSON.stringify({}),
  })
}

/** ¿Este pago cubre exactamente este pedido? */
export function paymentPaysOrder(payment: MpPayment, order: { id: string; total: number }): boolean {
  return (
    payment.status === 'approved' &&
    payment.currency_id === 'MXN' &&
    Math.round(payment.transaction_amount * 100) === Math.round(order.total * 100) &&
    payment.external_reference === order.id
  )
}

/**
 * Firma del aviso de Mercado Pago (header x-signature: "ts=…,v1=…").
 * v1 = HMAC-SHA256(secreto, "id:{data.id};request-id:{x-request-id};ts:{ts};")
 * Es una capa extra: aunque la firma pase, el pago se vuelve a consultar.
 */
export function verifyWebhookSignature(opts: {
  signature: string | null
  requestId: string | null
  dataId: string
  secret: string
}): boolean {
  if (!opts.signature) return false
  const parts = Object.fromEntries(
    opts.signature.split(',').map(p => p.trim().split('=', 2) as [string, string]),
  )
  const { ts, v1 } = parts
  if (!ts || !v1) return false

  let manifest = `id:${opts.dataId.toLowerCase()};`
  if (opts.requestId) manifest += `request-id:${opts.requestId};`
  manifest += `ts:${ts};`

  const expected = createHmac('sha256', opts.secret).update(manifest).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(v1)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Mensaje para el cliente cuando el banco rechaza la tarjeta */
export function rejectionMessage(statusDetail: string): string {
  const messages: Record<string, string> = {
    cc_rejected_insufficient_amount: 'La tarjeta no tiene fondos suficientes.',
    cc_rejected_bad_filled_security_code: 'El código de seguridad (CVV) no es correcto.',
    cc_rejected_bad_filled_date: 'La fecha de vencimiento no es correcta.',
    cc_rejected_bad_filled_card_number: 'Revisa el número de la tarjeta.',
    cc_rejected_bad_filled_other: 'Revisa los datos de la tarjeta.',
    cc_rejected_call_for_authorize: 'Tu banco pide que autorices el pago. Llámalos e intenta de nuevo.',
    cc_rejected_card_disabled: 'La tarjeta está inactiva. Actívala con tu banco o usa otra.',
    cc_rejected_duplicated_payment: 'Ya hiciste un pago igual hace un momento. Revisa tus pedidos.',
    cc_rejected_high_risk: 'El pago fue rechazado por seguridad. Intenta con otra tarjeta.',
    cc_rejected_max_attempts: 'Llegaste al límite de intentos. Usa otra tarjeta.',
  }
  return messages[statusDetail] ?? 'El pago fue rechazado. Intenta con otra tarjeta.'
}
