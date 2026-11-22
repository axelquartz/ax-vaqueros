import { NextRequest, NextResponse } from 'next/server'
import { getStoreStatusText, isStoreOpen } from '@/lib/storeHours'
import { isServerSupabaseConfigured } from '@/lib/supabase/config'
import { attachPayment, findForCustomer, setPaid } from '@/lib/orders/serverOrders'
import {
  createCardPayment, isMercadoPagoConfigured, MercadoPagoError, paymentPaysOrder, rejectionMessage,
  type CardFormData,
} from '@/lib/mercadopago'
import { ORDER_TOKEN_HEADER } from '@/lib/orders/customerApi'

/**
 * Cobra un pedido guardado con la tarjeta que capturó el formulario de
 * Mercado Pago. El monto es el total guardado en la base de datos; el del
 * navegador se ignora.
 */
export interface PayRequest {
  folio: string
  form: CardFormData
}

export interface PayResponse {
  /** approved: pagado · pending: el banco lo está revisando */
  status: 'approved' | 'pending'
}

const fail = (error: string, status: number) => NextResponse.json({ error }, { status })

export async function POST(req: NextRequest) {
  if (!isServerSupabaseConfigured() || !isMercadoPagoConfigured()) {
    return fail('Pagos en línea no disponibles', 503)
  }
  if (!isStoreOpen()) return fail(`${getStoreStatusText()}. Por ahora no estamos recibiendo pedidos.`, 409)

  let body: PayRequest
  try {
    body = await req.json()
  } catch {
    return fail('Solicitud inválida', 400)
  }
  const token = req.headers.get(ORDER_TOKEN_HEADER) ?? ''
  const form = body?.form
  if (typeof body?.folio !== 'string' || !token || typeof form?.token !== 'string' || typeof form?.payment_method_id !== 'string') {
    return fail('Solicitud inválida', 400)
  }

  const row = await findForCustomer(body.folio, token)
  if (!row) return fail('Pedido no encontrado', 404)
  if (row.paid_at) return NextResponse.json<PayResponse>({ status: 'approved' })

  try {
    const payment = await createCardPayment({
      folio: row.id,
      total: row.total,
      description: `Vaquero's · Pedido ${row.id}`,
      form: {
        token: form.token,
        issuer_id: form.issuer_id,
        payment_method_id: form.payment_method_id,
        installments: Math.max(1, Math.floor(Number(form.installments) || 1)),
        payer: form.payer ?? {},
      },
    })
    await attachPayment(row.id, String(payment.id))

    if (paymentPaysOrder(payment, row)) {
      await setPaid(row.id)
      return NextResponse.json<PayResponse>({ status: 'approved' })
    }
    if (payment.status === 'in_process' || payment.status === 'pending') {
      // El aviso de Mercado Pago (o la consulta del cliente) lo marcará pagado
      return NextResponse.json<PayResponse>({ status: 'pending' })
    }
    return fail(rejectionMessage(payment.status_detail), 402)
  } catch (err) {
    console.error('Mercado Pago error:', err)
    if (err instanceof MercadoPagoError && err.status < 500) {
      return fail('No se pudo procesar la tarjeta. Revisa los datos e intenta de nuevo.', 402)
    }
    return fail('No se pudo conectar con Mercado Pago. Intenta de nuevo.', 502)
  }
}
