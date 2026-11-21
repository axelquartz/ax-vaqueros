// @vitest-environment node
import { NextRequest } from 'next/server'
import {
  ADMIN_COOKIE, checkAdminPassword, createSessionToken, isAdminAuthRequired, verifySessionToken,
} from '@/lib/adminAuth'
import { proxy } from '@/proxy'

const PASSWORD = 'clave-de-prueba'

beforeEach(() => {
  vi.stubEnv('ADMIN_PASSWORD', PASSWORD)
  vi.stubEnv('NODE_ENV', 'production')
})
afterEach(() => vi.unstubAllEnvs())

describe('adminAuth', () => {
  it('valida la contraseña', async () => {
    expect(await checkAdminPassword(PASSWORD)).toBe(true)
    expect(await checkAdminPassword('otra')).toBe(false)
    expect(await checkAdminPassword('')).toBe(false)
  })

  it('sin contraseña configurada nadie entra', async () => {
    vi.stubEnv('ADMIN_PASSWORD', '')
    expect(await checkAdminPassword('')).toBe(false)
    expect(await verifySessionToken(await createSessionToken())).toBe(false)
  })

  it('la sesión firmada vale 12 horas', async () => {
    const now = Date.now()
    const token = await createSessionToken(now)
    expect(await verifySessionToken(token, now + 11 * 3_600_000)).toBe(true)
    expect(await verifySessionToken(token, now + 13 * 3_600_000)).toBe(false)
  })

  it('rechaza sesiones alteradas o de otra contraseña', async () => {
    const token = await createSessionToken()
    const [exp, sig] = token.split('.')
    expect(await verifySessionToken(`${Number(exp) + 999_999_999}.${sig}`)).toBe(false)
    expect(await verifySessionToken(`${exp}.AAAA`)).toBe(false)
    expect(await verifySessionToken('basura')).toBe(false)
    vi.stubEnv('ADMIN_PASSWORD', 'nueva-clave')
    expect(await verifySessionToken(token)).toBe(false) // cambiar la clave cierra sesiones
  })

  it('en desarrollo sin contraseña el panel queda abierto; en producción no', () => {
    vi.stubEnv('ADMIN_PASSWORD', '')
    vi.stubEnv('NODE_ENV', 'development')
    expect(isAdminAuthRequired()).toBe(false)
    vi.stubEnv('NODE_ENV', 'production')
    expect(isAdminAuthRequired()).toBe(true)
  })
})

describe('proxy /admin', () => {
  const request = (path: string, cookie?: string) =>
    new NextRequest(`http://localhost${path}`, cookie ? { headers: { cookie: `${ADMIN_COOKIE}=${cookie}` } } : undefined)

  it('sin sesión redirige al login', async () => {
    const res = await proxy(request('/admin'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/admin/login')
  })

  it('con sesión válida deja pasar', async () => {
    const res = await proxy(request('/admin', await createSessionToken()))
    expect(res.headers.get('location')).toBeNull()
    expect(res.headers.get('x-middleware-next')).toBe('1')
  })

  it('el login siempre es accesible', async () => {
    const res = await proxy(request('/admin/login'))
    expect(res.headers.get('location')).toBeNull()
  })
})
