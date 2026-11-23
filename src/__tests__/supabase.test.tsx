import { render, screen, act, waitFor } from '@testing-library/react'
import { NextRequest } from 'next/server'
import { createHmac } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Order } from '@/types/order'
import type { OrderRow } from '@/lib/orders/rows'

// ── Supabase falso ─────────────────────────────────────────────────────────
// Registra la cadena de llamadas (from → select/update/eq/… → await) y
// responde con lo que diga `respond`. Suficiente para probar la lógica sin red.
type Call = { table: string; ops: Array<[string, unknown[]]> }
type Result = { data: unknown; error: { code?: string; message: string; status?: number } | null }

function fakeDb(respond: (call: Call) => Result) {
  const calls: Call[] = []
  let realtime: ((payload: { new: unknown }) => void) | null = null
  let onSubscribe: ((status: string) => void) | null = null

  const builder = (table: string) => {
    const call: Call = { table, ops: [] }
    calls.push(call)
    const chain: Record<string, unknown> = {}
    for (const op of ['select', 'insert', 'update', 'eq', 'is', 'not', 'order', 'single', 'maybeSingle']) {
      chain[op] = (...args: unknown[]) => { call.ops.push([op, args]); return chain }
    }
    chain.then = (resolve: (r: Result) => void, reject: (e: unknown) => void) => {
      try { resolve(respond(call)) } catch (e) { reject(e) }
    }
    return chain
  }

  let channels = 0
  const channel = {
    on: (_t: string, _f: unknown, cb: typeof realtime) => { realtime = cb; return channel },
    subscribe: (cb: typeof onSubscribe) => { onSubscribe = cb; return channel },
  }

  const db = {
    from: builder,
    channel: () => { channels++; return channel },
    removeChannel: async () => 'ok',
  } as unknown as SupabaseClient
  return {
    db,
    calls,
    emit: (row: Partial<OrderRow>) => realtime?.({ new: row }),
    connect: () => onSubscribe?.('SUBSCRIBED'),
    drop: () => onSubscribe?.('CHANNEL_ERROR'),
    channels: () => channels,
  }
}

const has = (call: Call, op: string, ...args: unknown[]) =>
  call.ops.some(([o, a]) => o === op && args.every((v, i) => a[i] === v))

const row = (id: string, over: Partial<OrderRow> = {}): OrderRow => ({
  id,
  created_at: '2026-11-21T20:00:00.000Z',
  updated_at: '2026-11-21T20:00:00.000Z',
  status: 'pending',
  delivery_method: 'pickup',
  customer: { name: 'Ana', phone: '8110000000', notes: '' },
  items: [{ productId: 'agua', name: 'Agua Natural', quantity: 1, unitPrice: 15, variants: {}, subtotal: 15 }],
  subtotal: 15,
  delivery_fee: 0,
  total: 15,
  paid_at: '2026-11-21T20:01:00.000Z',
  ...over,
})

const flush = () => act(() => new Promise(r => setTimeout(r, 0)))

// ── Repositorio del panel ──────────────────────────────────────────────────
import { createSupabaseOrderRepository } from '@/lib/orders/supabaseRepository'
import { OrderTransitionError } from '@/lib/orders/repository'

describe('Repositorio Supabase (panel)', () => {
  it('carga solo pedidos pagados, más nuevos primero', async () => {
    const f = fakeDb(() => ({ data: [row('ORD-10002', { created_at: '2026-11-21T21:00:00Z' }), row('ORD-10001')], error: null }))
    const repo = createSupabaseOrderRepository(f.db)
    repo.subscribe(() => {})
    await flush()
    expect(has(f.calls[0], 'not', 'paid_at', 'is', null)).toBe(true)
    expect(repo.list().map(o => o.id)).toEqual(['ORD-10002', 'ORD-10001'])
    expect(repo.ready()).toBe(true)
  })

  it('tiempo real: agrega pedidos al pagarse e ignora borradores sin pagar', async () => {
    const f = fakeDb(() => ({ data: [], error: null }))
    const repo = createSupabaseOrderRepository(f.db)
    const listener = vi.fn()
    repo.subscribe(listener)
    await flush()

    f.emit(row('ORD-20000', { paid_at: null }))
    expect(repo.list()).toHaveLength(0)

    f.emit(row('ORD-20000'))
    expect(repo.get('ORD-20000')?.customer.name).toBe('Ana')
    expect(listener).toHaveBeenCalled()

    f.emit(row('ORD-20000', { status: 'confirmed' }))
    expect(repo.list()).toHaveLength(1)
    expect(repo.get('ORD-20000')?.status).toBe('confirmed')
  })

  it('cambio de estatus: se ve al instante y se confirma con la base de datos', async () => {
    const f = fakeDb(call =>
      has(call, 'update')
        ? { data: row('ORD-30000', { status: 'confirmed', updated_at: '2026-11-21T20:05:00Z' }), error: null }
        : { data: [row('ORD-30000')], error: null })
    const repo = createSupabaseOrderRepository(f.db)
    repo.subscribe(() => {})
    await flush()

    const optimistic = repo.updateStatus('ORD-30000', 'confirmed')
    expect(optimistic.status).toBe('confirmed')
    expect(repo.get('ORD-30000')?.status).toBe('confirmed')
    await flush()
    const update = f.calls.find(c => has(c, 'update'))!
    expect(update.ops[0]).toEqual(['update', [{ status: 'confirmed' }]])
    expect(repo.get('ORD-30000')?.updatedAt).toBe('2026-11-21T20:05:00Z')
  })

  it('si la base de datos rechaza el cambio, se revierte y avisa', async () => {
    const onError = vi.fn()
    const f = fakeDb(call =>
      has(call, 'update')
        ? { data: null, error: { message: 'sin conexión' } }
        : { data: [row('ORD-40000')], error: null })
    const repo = createSupabaseOrderRepository(f.db, { onError })
    repo.subscribe(() => {})
    await flush()

    repo.updateStatus('ORD-40000', 'confirmed')
    await flush()
    expect(repo.get('ORD-40000')?.status).toBe('pending')
    expect(onError).toHaveBeenCalledWith('No se pudo actualizar ORD-40000. Intenta de nuevo.')
  })

  it('valida la transición antes de llamar a la base de datos', async () => {
    const f = fakeDb(() => ({ data: [row('ORD-50000')], error: null }))
    const repo = createSupabaseOrderRepository(f.db)
    repo.subscribe(() => {})
    await flush()
    expect(() => repo.updateStatus('ORD-50000', 'delivered')).toThrow(OrderTransitionError)
    expect(f.calls.some(c => has(c, 'update'))).toBe(false)
  })

  it('al reconectar vuelve a cargar (no se pierden pedidos de mientras)', async () => {
    const f = fakeDb(() => ({ data: [row('ORD-60000')], error: null }))
    const repo = createSupabaseOrderRepository(f.db)
    repo.subscribe(() => {})
    await flush()
    const loads = () => f.calls.filter(c => has(c, 'not')).length
    expect(loads()).toBe(1)
    f.connect()
    await flush()
    expect(loads()).toBe(2)
  })
})

describe('Repositorio Supabase: panel abierto por horas', () => {
  afterEach(() => vi.useRealTimers())

  it('si se cae la conexión en tiempo real, se reconecta sola', async () => {
    vi.useFakeTimers()
    const f = fakeDb(() => ({ data: [], error: null }))
    createSupabaseOrderRepository(f.db).subscribe(() => {})
    expect(f.channels()).toBe(1)
    f.drop()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(f.channels()).toBe(2)
  })

  it('al volver a la pestaña o recuperar internet, vuelve a cargar', async () => {
    const f = fakeDb(() => ({ data: [], error: null }))
    createSupabaseOrderRepository(f.db).subscribe(() => {})
    await flush()
    const loads = () => f.calls.filter(c => has(c, 'not')).length
    const before = loads()
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    act(() => { window.dispatchEvent(new Event('online')) })
    await flush()
    expect(loads()).toBe(before + 2)
  })
})

// ── Pedidos del lado del servidor (Mercado Pago) ───────────────────────────
const server = vi.hoisted(() => ({ db: null as unknown as SupabaseClient }))
vi.mock('@/lib/supabase/server', () => ({ getServerSupabase: () => server.db }))
import { getCustomerOrder, markPaidByPayment } from '@/lib/orders/serverOrders'
import { paymentPaysOrder, verifyWebhookSignature, type MpPayment } from '@/lib/mercadopago'

const TOKEN = '7d3f1c2a-1111-4222-8333-444455556666'
const mpPayment = (over: Partial<MpPayment> = {}): MpPayment => ({
  id: 123456, status: 'approved', status_detail: 'accredited', transaction_amount: 15,
  currency_id: 'MXN', external_reference: 'ORD-70000', ...over,
})
/** Responde a las llamadas a la API de Mercado Pago */
function mockMercadoPago(handler: (url: string, init?: RequestInit) => unknown, status = 200) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) =>
    new Response(JSON.stringify(handler(url, init)), { status }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
const mpEnv = () => vi.stubEnv('MERCADOPAGO_ACCESS_TOKEN', 'TEST-token')

describe('Pedidos en el servidor', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

  it('paymentPaysOrder exige aprobado, en MXN, del total exacto y del mismo folio', () => {
    const order = { id: 'ORD-70000', total: 15 }
    expect(paymentPaysOrder(mpPayment(), order)).toBe(true)
    expect(paymentPaysOrder(mpPayment({ status: 'in_process' }), order)).toBe(false)
    expect(paymentPaysOrder(mpPayment({ transaction_amount: 1 }), order)).toBe(false)
    expect(paymentPaysOrder(mpPayment({ currency_id: 'USD' }), order)).toBe(false)
    expect(paymentPaysOrder(mpPayment({ external_reference: 'ORD-99999' }), order)).toBe(false)
  })

  it('firma del aviso: acepta la correcta y rechaza una alterada', () => {
    const secret = 'secreto'
    const v1 = createHmac('sha256', secret).update('id:123456;request-id:req-1;ts:1700000000;').digest('hex')
    const ok = { signature: `ts=1700000000,v1=${v1}`, requestId: 'req-1', dataId: '123456', secret }
    expect(verifyWebhookSignature(ok)).toBe(true)
    expect(verifyWebhookSignature({ ...ok, dataId: '999' })).toBe(false)
    expect(verifyWebhookSignature({ ...ok, signature: null })).toBe(false)
  })

  it('cliente: con llave incorrecta no encuentra nada (y no consulta con un token mal formado)', async () => {
    const f = fakeDb(() => ({ data: null, error: null }))
    server.db = f.db
    expect(await getCustomerOrder('ORD-70000', 'no-es-uuid')).toEqual({ found: false })
    expect(f.calls).toHaveLength(0)
    expect(await getCustomerOrder('ORD-70000', TOKEN)).toEqual({ found: false })
    expect(has(f.calls[0], 'eq', 'access_token', TOKEN)).toBe(true)
  })

  it('cliente: si Mercado Pago ya aprobó pero el aviso no ha llegado, lo marca pagado', async () => {
    mpEnv()
    const fetchMock = mockMercadoPago(() => mpPayment())
    const f = fakeDb(call =>
      has(call, 'update')
        ? { data: null, error: null }
        : { data: { ...row('ORD-70000', { paid_at: null }), access_token: TOKEN, payment_intent_id: '123456' }, error: null })
    server.db = f.db
    const result = await getCustomerOrder('ORD-70000', TOKEN)
    expect(result).toMatchObject({ found: true, paid: true, order: { id: 'ORD-70000', total: 15 } })
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.mercadopago.com/v1/payments/123456')
    const update = f.calls.find(c => has(c, 'update'))!
    expect(has(update, 'is', 'paid_at', null)).toBe(true) // idempotente
  })

  it('cliente: no marca pagado si el cobro no coincide con el total', async () => {
    mpEnv()
    mockMercadoPago(() => mpPayment({ transaction_amount: 1 }))
    const f = fakeDb(() => ({ data: { ...row('ORD-70000', { paid_at: null }), access_token: TOKEN, payment_intent_id: '123456' }, error: null }))
    server.db = f.db
    expect(await getCustomerOrder('ORD-70000', TOKEN)).toMatchObject({ found: true, paid: false })
    expect(f.calls.some(c => has(c, 'update'))).toBe(false)
  })

  it('con Mercado Pago, "confirmar" nunca marca pagado sin un pago aprobado', async () => {
    mpEnv()
    const f = fakeDb(() => ({ data: { ...row('ORD-70000', { paid_at: null }), access_token: TOKEN, payment_intent_id: null }, error: null }))
    server.db = f.db
    expect(await getCustomerOrder('ORD-70000', TOKEN, { confirmDemo: true })).toMatchObject({ paid: false })
  })

  it('modo demo (sin Mercado Pago): solo se marca pagado al confirmar', async () => {
    const f = fakeDb(call =>
      has(call, 'update') ? { data: null, error: null } : { data: { ...row('ORD-70000', { paid_at: null }), access_token: TOKEN, payment_intent_id: null }, error: null })
    server.db = f.db
    expect(await getCustomerOrder('ORD-70000', TOKEN)).toMatchObject({ paid: false })
    expect(await getCustomerOrder('ORD-70000', TOKEN, { confirmDemo: true })).toMatchObject({ paid: true })
  })

  it('aviso: marca pagado el pedido del folio del pago', async () => {
    const f = fakeDb(call =>
      has(call, 'update') ? { data: null, error: null } : { data: { id: 'ORD-70000', total: 15, paid_at: null }, error: null })
    server.db = f.db
    expect(await markPaidByPayment(mpPayment())).toBe('ORD-70000')
    expect(f.calls.some(c => has(c, 'update'))).toBe(true)
  })

  it('aviso: ignora un pago con monto distinto', async () => {
    const f = fakeDb(() => ({ data: { id: 'ORD-70000', total: 999, paid_at: null }, error: null }))
    server.db = f.db
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await markPaidByPayment(mpPayment())).toBeNull()
    expect(f.calls.some(c => has(c, 'update'))).toBe(false)
  })
})

// ── Ruta de pago con Supabase ──────────────────────────────────────────────
vi.mock('@/lib/menuStateServer', () => ({ fetchMenuState: async () => ({ overrides: [], ordersPaused: false }) }))
vi.mock('@/lib/promotionsServer', () => ({ fetchPromotions: async () => [] }))
vi.mock('@/lib/storeHours', () => ({ isStoreOpen: () => true, getStoreStatusText: () => 'Abierto' }))
import { POST as createIntent } from '@/app/api/checkout/order/route'
import { POST as payRoute } from '@/app/api/checkout/pay/route'
import { POST as mpWebhook } from '@/app/api/webhooks/mercadopago/route'
import { GET as getOrderRoute, POST as confirmOrderRoute } from '@/app/api/orders/[folio]/route'

const onlineEnv = () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://demo.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
  vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test')
  vi.stubEnv('MERCADOPAGO_ACCESS_TOKEN', '')
}

describe('API con Supabase', () => {
  afterEach(() => vi.unstubAllEnvs())

  const body = {
    deliveryMethod: 'pickup',
    customer: { name: 'Ana', phone: '8110000000', address: 'no aplica para recoger' },
    items: [{ productId: 'agua', quantity: 1, selectedVariants: {} }],
  }
  const post = (b: unknown) =>
    createIntent(new NextRequest('http://localhost/api/checkout/order', { method: 'POST', body: JSON.stringify(b) }))

  it('guarda el borrador con el total del servidor y devuelve folio y llave', async () => {
    onlineEnv()
    const f = fakeDb(() => ({ data: { id: 'ORD-12345', access_token: TOKEN }, error: null }))
    server.db = f.db
    const res = await post({ ...body, amount: 1 })
    const data = await res.json()
    expect(data).toMatchObject({ folio: 'ORD-12345', accessToken: TOKEN, demo: true })
    const insert = f.calls[0].ops.find(([o]) => o === 'insert')![1][0] as Record<string, unknown>
    expect(insert.total).toBe(data.amount)
    expect((insert.customer as { address?: string }).address).toBeUndefined() // solo domicilio guarda dirección
  })

  it('domicilio: guarda el punto del mapa solo si está en México', async () => {
    onlineEnv()
    const insertOf = async (customer: Record<string, unknown>) => {
      const f = fakeDb(() => ({ data: { id: 'ORD-12345', access_token: TOKEN }, error: null }))
      server.db = f.db
      await post({ ...body, deliveryMethod: 'delivery', customer: { ...body.customer, ...customer } })
      return (f.calls[0].ops.find(([o]) => o === 'insert')![1][0] as { customer: Record<string, unknown> }).customer
    }
    expect(await insertOf({ lat: 20.7302, lng: -103.4222 })).toMatchObject({ lat: 20.7302, lng: -103.4222 })
    expect(await insertOf({ lat: 48.85, lng: 2.35 })).not.toHaveProperty('lat')
    expect(await insertOf({ lat: '20', lng: '-103' })).not.toHaveProperty('lat')
  })

  it('si el folio ya existe, prueba con otro', async () => {
    onlineEnv()
    let attempt = 0
    const f = fakeDb(() => (++attempt === 1
      ? { data: null, error: { code: '23505', message: 'duplicate' } }
      : { data: { id: 'ORD-22222', access_token: TOKEN }, error: null }))
    server.db = f.db
    expect((await (await post(body)).json()).folio).toBe('ORD-22222')
    expect(attempt).toBe(2)
  })

  it('al cambiar el total actualiza el mismo borrador', async () => {
    onlineEnv()
    const f = fakeDb(() => ({ data: [{ id: 'ORD-12345' }], error: null }))
    server.db = f.db
    const data = await (await post({ ...body, draft: { folio: 'ORD-12345', accessToken: TOKEN } })).json()
    expect(data.folio).toBe('ORD-12345')
    expect(f.calls.some(c => has(c, 'insert'))).toBe(false)
    expect(has(f.calls[0], 'is', 'paid_at', null)).toBe(true) // nunca toca un pedido pagado
  })

  it('estatus del cliente: sin llave → 404; con llave → pedido', async () => {
    onlineEnv()
    server.db = fakeDb(() => ({ data: { ...row('ORD-70000'), access_token: TOKEN, payment_intent_id: null }, error: null })).db
    const params = Promise.resolve({ folio: 'ORD-70000' })
    expect((await getOrderRoute(new NextRequest('http://localhost/api/orders/ORD-70000'), { params })).status).toBe(404)

    const res = await getOrderRoute(
      new NextRequest('http://localhost/api/orders/ORD-70000', { headers: { 'x-order-token': TOKEN } }),
      { params: Promise.resolve({ folio: 'ORD-70000' }) },
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toMatchObject({ paid: true, order: { id: 'ORD-70000' } })
  })

  it('sin Supabase la ruta de estatus no está disponible', async () => {
    const res = await confirmOrderRoute(
      new NextRequest('http://localhost/api/orders/ORD-70000', { method: 'POST', headers: { 'x-order-token': TOKEN } }),
      { params: Promise.resolve({ folio: 'ORD-70000' }) },
    )
    expect(res.status).toBe(503)
  })
})

// ── Cobro y aviso de Mercado Pago ──────────────────────────────────────────
describe('Cobro con Mercado Pago', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

  const draftRow = { ...row('ORD-70000', { paid_at: null, total: 245, subtotal: 245 }), access_token: TOKEN, payment_intent_id: null }
  const form = { token: 'card-token', payment_method_id: 'visa', installments: 1, issuer_id: '1', payer: { email: 'ana@example.com' } }
  const pay = (b: unknown, token = TOKEN) =>
    payRoute(new NextRequest('http://localhost/api/checkout/pay', { method: 'POST', headers: { 'x-order-token': token }, body: JSON.stringify(b) }))

  it('cobra el total guardado (no el del navegador) y marca pagado al aprobarse', async () => {
    onlineEnv(); mpEnv()
    const fetchMock = mockMercadoPago(() => mpPayment({ transaction_amount: 245 }))
    const f = fakeDb(call => (has(call, 'update') ? { data: null, error: null } : { data: draftRow, error: null }))
    server.db = f.db

    const res = await pay({ folio: 'ORD-70000', form: { ...form, transaction_amount: 1 } })
    expect(await res.json()).toEqual({ status: 'approved' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.mercadopago.com/v1/payments')
    const sent = JSON.parse(String(init?.body))
    expect(sent).toMatchObject({ transaction_amount: 245, token: 'card-token', external_reference: 'ORD-70000' })
    expect((init?.headers as Record<string, string>)['X-Idempotency-Key']).toBeTruthy()
    const updates = f.calls.filter(c => has(c, 'update'))
    expect(updates.map(c => Object.keys(c.ops[0][1][0] as object)[0])).toEqual(['payment_intent_id', 'paid_at'])
  })

  it('tarjeta rechazada: 402 con un mensaje claro y el pedido sigue sin pagar', async () => {
    onlineEnv(); mpEnv()
    mockMercadoPago(() => mpPayment({ status: 'rejected', status_detail: 'cc_rejected_insufficient_amount', transaction_amount: 245 }))
    const f = fakeDb(call => (has(call, 'update') ? { data: null, error: null } : { data: draftRow, error: null }))
    server.db = f.db
    const res = await pay({ folio: 'ORD-70000', form })
    expect(res.status).toBe(402)
    expect((await res.json()).error).toBe('La tarjeta no tiene fondos suficientes.')
    expect(f.calls.some(c => has(c, 'update') && Object.keys(c.ops[0][1][0] as object)[0] === 'paid_at')).toBe(false)
  })

  it('pago en revisión del banco: queda pendiente', async () => {
    onlineEnv(); mpEnv()
    mockMercadoPago(() => mpPayment({ status: 'in_process', status_detail: 'pending_contingency', transaction_amount: 245 }))
    server.db = fakeDb(call => (has(call, 'update') ? { data: null, error: null } : { data: draftRow, error: null })).db
    expect(await (await pay({ folio: 'ORD-70000', form })).json()).toEqual({ status: 'pending' })
  })

  it('sin la llave del pedido no se puede cobrar', async () => {
    onlineEnv(); mpEnv()
    const fetchMock = mockMercadoPago(() => mpPayment())
    server.db = fakeDb(() => ({ data: null, error: null })).db
    expect((await pay({ folio: 'ORD-70000', form }, '00000000-0000-4000-8000-000000000000')).status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  const notify = (id: string, headers: Record<string, string> = {}) =>
    mpWebhook(new NextRequest(`http://localhost/api/webhooks/mercadopago?data.id=${id}&type=payment`, {
      method: 'POST', headers, body: JSON.stringify({ type: 'payment', action: 'payment.updated', data: { id } }),
    }))

  it('aviso: consulta el pago a Mercado Pago y marca pagado', async () => {
    onlineEnv(); mpEnv()
    const fetchMock = mockMercadoPago(() => mpPayment())
    const f = fakeDb(call => (has(call, 'update') ? { data: null, error: null } : { data: { id: 'ORD-70000', total: 15, paid_at: null }, error: null }))
    server.db = f.db
    vi.spyOn(console, 'log').mockImplementation(() => {})
    expect((await notify('123456')).status).toBe(200)
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.mercadopago.com/v1/payments/123456')
    expect(f.calls.some(c => has(c, 'update'))).toBe(true)
  })

  it('aviso con secreto configurado: rechaza firmas inválidas sin consultar nada', async () => {
    onlineEnv(); mpEnv()
    vi.stubEnv('MERCADOPAGO_WEBHOOK_SECRET', 'secreto')
    const fetchMock = mockMercadoPago(() => mpPayment())
    expect((await notify('123456', { 'x-signature': 'ts=1,v1=falsa', 'x-request-id': 'r' })).status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('aviso de otro tipo: se confirma y se ignora', async () => {
    onlineEnv(); mpEnv()
    const fetchMock = mockMercadoPago(() => ({}))
    const res = await mpWebhook(new NextRequest('http://localhost/api/webhooks/mercadopago', { method: 'POST', body: JSON.stringify({ type: 'merchant_order', data: { id: '1' } }) }))
    expect(res.status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ── Acceso al panel (proxy) ────────────────────────────────────────────────
const auth = vi.hoisted(() => ({ userId: null as string | null, staff: false }))
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getClaims: async () => ({ data: auth.userId ? { claims: { sub: auth.userId } } : null }) },
    from: () => {
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: auth.staff ? { user_id: auth.userId } : null }) }
      return q
    },
  }),
  createBrowserClient: vi.fn(),
}))
import { proxy } from '@/proxy'

describe('Proxy de /admin', () => {
  afterEach(() => vi.unstubAllEnvs())
  const visit = (path: string) => proxy(new NextRequest(`http://localhost${path}`))
  const location = (res: Response) => res.headers.get('location')

  it('sin Supabase: abierto en desarrollo, cerrado en producción', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(location(await visit('/admin'))).toBeNull()
    vi.stubEnv('NODE_ENV', 'production')
    expect(location(await visit('/admin'))).toBe('http://localhost/admin/login')
  })

  it('sin sesión → login', async () => {
    onlineEnv()
    auth.userId = null
    expect(location(await visit('/admin'))).toBe('http://localhost/admin/login')
  })

  it('con sesión pero sin ser del equipo → login con aviso', async () => {
    onlineEnv()
    auth.userId = 'u1'
    auth.staff = false
    expect(location(await visit('/admin'))).toBe('http://localhost/admin/login?error=sin-acceso')
  })

  it('equipo → entra', async () => {
    onlineEnv()
    auth.userId = 'u1'
    auth.staff = true
    expect(location(await visit('/admin'))).toBeNull()
  })

  it('el login siempre está disponible', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(location(await visit('/admin/login'))).toBeNull()
  })
})

// ── Pantalla del cliente con Supabase ──────────────────────────────────────
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
import { OrderStatus } from '@/components/order/OrderStatus'
import { saveOrder } from '@/lib/orderHistory'

describe('Estatus del cliente con Supabase', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.useRealTimers()
    localStorage.clear()
  })

  const placeholder: Order = {
    id: 'ORD-70000', createdAt: '', updatedAt: '', status: 'pending', deliveryMethod: 'pickup',
    customer: { name: '', phone: '', notes: '' }, items: [], subtotal: 0, deliveryFee: 0, total: 0,
  }

  function serve(responses: Array<{ paid: boolean; status: string }>) {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const next = responses.length > 1 ? responses.shift()! : responses[0]
      expect((init?.headers as Record<string, string>)['x-order-token']).toBe(TOKEN)
      return new Response(JSON.stringify({ paid: next.paid, order: { ...placeholder, ...{ items: row('x').items, total: 15, subtotal: 15 }, status: next.status } }))
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('consulta el pedido al servidor con su llave y sigue el estatus', async () => {
    onlineEnv()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    saveOrder({ folio: 'ORD-70000', timestamp: '', total: 15, deliveryMethod: 'pickup', itemCount: 1, accessToken: TOKEN })
    const fetchMock = serve([{ paid: true, status: 'pending' }, { paid: true, status: 'preparing' }])

    render(<OrderStatus order={placeholder} />)
    await waitFor(() => expect(screen.getByText(/Agua Natural/)).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith('/api/orders/ORD-70000', expect.anything())

    await act(() => vi.advanceTimersByTimeAsync(10_000))
    await waitFor(() => expect(screen.getAllByText('Preparando').length).toBeGreaterThan(0))
  })

  it('avisa mientras el pago se confirma', async () => {
    onlineEnv()
    saveOrder({ folio: 'ORD-70000', timestamp: '', total: 15, deliveryMethod: 'pickup', itemCount: 1, accessToken: TOKEN })
    serve([{ paid: false, status: 'pending' }])
    render(<OrderStatus order={placeholder} />)
    expect(await screen.findByText('Estamos confirmando tu pago. Esta pantalla se actualiza sola.')).toBeInTheDocument()
  })

  it('deja de consultar cuando el pedido termina', async () => {
    onlineEnv()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    saveOrder({ folio: 'ORD-70000', timestamp: '', total: 15, deliveryMethod: 'pickup', itemCount: 1, accessToken: TOKEN })
    const fetchMock = serve([{ paid: true, status: 'delivered' }])
    render(<OrderStatus order={placeholder} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
