import { NextRequest, NextResponse } from 'next/server'
import { isServerSupabaseConfigured } from '@/lib/supabase/config'
import { getServerSupabase } from '@/lib/supabase/server'
import { findForCustomer } from '@/lib/orders/serverOrders'
import { ORDER_TOKEN_HEADER } from '@/lib/orders/customerApi'
import { parseReview } from '@/lib/reviews'

/**
 * Reseña del cliente (folio + llave del pedido en el header, igual que el estatus).
 * GET  → su reseña, si ya la dio
 * POST → la guarda o la actualiza; solo pedidos pagados y entregados
 */
const FOLIO_RE = /^ORD-\d{4,6}$/
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function authorize(req: NextRequest, params: Promise<{ folio: string }>) {
  if (!isServerSupabaseConfigured()) return { error: json({ error: 'No disponible' }, 503) }
  const { folio } = await params
  const token = req.headers.get(ORDER_TOKEN_HEADER) ?? ''
  const row = FOLIO_RE.test(folio) && token ? await findForCustomer(folio, token) : null
  if (!row) return { error: json({ error: 'Pedido no encontrado' }, 404) }
  return { row }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ folio: string }> }) {
  const auth = await authorize(req, params)
  if (auth.error) return auth.error
  const { data } = await getServerSupabase().from('reviews').select('rating, comment').eq('order_id', auth.row.id).maybeSingle()
  return json({ review: data ?? null })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ folio: string }> }) {
  const auth = await authorize(req, params)
  if (auth.error) return auth.error
  if (!auth.row.paid_at || auth.row.status !== 'delivered') {
    return json({ error: 'Podrás calificar cuando recibas tu pedido' }, 409)
  }
  let input
  try { input = parseReview(await req.json()) } catch { input = null }
  if (!input) return json({ error: 'Calificación inválida' }, 400)

  const { error } = await getServerSupabase().from('reviews').upsert({
    order_id: auth.row.id, rating: input.rating, comment: input.comment, updated_at: new Date().toISOString(),
  })
  if (error) { console.error('reviews', error); return json({ error: 'No se pudo guardar tu reseña' }, 500) }
  return json({ review: input })
}
