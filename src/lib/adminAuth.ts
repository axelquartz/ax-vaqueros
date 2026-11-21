/**
 * Acceso al panel /admin con una sola contraseña (ADMIN_PASSWORD).
 *
 * Solución provisional hasta tener usuarios reales (Supabase Auth): una
 * cookie httpOnly con la fecha de expiración firmada con HMAC-SHA256.
 * La llave se deriva de la contraseña, así que cambiarla cierra todas las
 * sesiones abiertas. Usa Web Crypto para funcionar igual en Proxy y en Node.
 */

export const ADMIN_COOKIE = 'ax_admin'
export const SESSION_HOURS = 12

const encoder = new TextEncoder()

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? ''
}

/** Sin contraseña configurada: en producción el panel queda cerrado; en desarrollo, abierto */
export function isAdminAuthRequired(): boolean {
  return process.env.NODE_ENV === 'production' || adminPassword() !== ''
}

export function isAdminConfigured(): boolean {
  return adminPassword() !== ''
}

async function hmacKey(purpose: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(`${purpose}:${process.env.ADMIN_SESSION_SECRET ?? ''}:${adminPassword()}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

function toBase64Url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const bin = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = new Uint8Array(new ArrayBuffer(bin.length))
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

/** Compara la contraseña en tiempo constante (verificación HMAC) */
export async function checkAdminPassword(input: string): Promise<boolean> {
  const password = adminPassword()
  if (!password || typeof input !== 'string') return false
  const key = await hmacKey('password')
  const expected = await crypto.subtle.sign('HMAC', key, encoder.encode(password))
  return crypto.subtle.verify('HMAC', key, expected, encoder.encode(input))
}

export async function createSessionToken(now = Date.now()): Promise<string> {
  const exp = now + SESSION_HOURS * 3_600_000
  const sig = await crypto.subtle.sign('HMAC', await hmacKey('session'), encoder.encode(`admin.${exp}`))
  return `${exp}.${toBase64Url(sig)}`
}

export async function verifySessionToken(token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!token || !isAdminConfigured()) return false
  const [expRaw, sigRaw] = token.split('.')
  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp <= now || !sigRaw) return false
  const sig = fromBase64Url(sigRaw)
  if (!sig) return false
  return crypto.subtle.verify('HMAC', await hmacKey('session'), sig, encoder.encode(`admin.${exp}`))
}
