import { NextRequest, NextResponse } from 'next/server'
import { isServerSupabaseConfigured } from '@/lib/supabase/config'
import { getCustomerOrder } from '@/lib/orders/serverOrders'
import { getStripe } from '@/lib/stripe'
import { ORDER_TOKEN_HEADER, type CustomerOrderResponse } from '@/lib/orders/customerApi'

/**
 * Pedido del cliente. La llave privada del pedido viaja en el header
 * `x-order-token` (no en la URL, para que no quede en historiales ni logs).
 *
 * GET  → estatus actual (verifica con Stripe si el aviso de pago aún no llega)
 * POST → confirmar después de pagar; en modo demo (sin Stripe) lo marca pagado
 */
const FOLIO_RE = /^ORD-\d{4,6}$/

async function handle(req: NextRequest, params: Promise<{ folio: string }>, confirm: boolean) {
  if (!isServerSupabaseConfigured()) {
    return NextResponse.json({ error: 'Pedidos en línea no disponibles' }, { status: 503 })
  }
  const { folio } = await params
  const token = req.headers.get(ORDER_TOKEN_HEADER) ?? ''
  if (!FOLIO_RE.test(folio) || !token) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  try {
    const result = await getCustomerOrder(folio, token, { stripe: getStripe(), confirmDemo: confirm })
    if (!result.found) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    return NextResponse.json<CustomerOrderResponse>(
      { paid: result.paid, order: result.order },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    console.error('Error al consultar pedido:', err)
    return NextResponse.json({ error: 'No se pudo consultar el pedido' }, { status: 500 })
  }
}

export function GET(req: NextRequest, { params }: { params: Promise<{ folio: string }> }) {
  return handle(req, params, false)
}

export function POST(req: NextRequest, { params }: { params: Promise<{ folio: string }> }) {
  return handle(req, params, true)
}
