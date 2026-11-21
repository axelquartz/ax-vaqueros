import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_COOKIE, isAdminAuthRequired, verifySessionToken } from '@/lib/adminAuth'

/**
 * Protege /admin: sin sesión válida, redirige a /admin/login.
 * (El panel hoy lee los pedidos en el navegador, así que no hay datos del
 * servidor que proteger más abajo; con Supabase, cada consulta validará
 * además la sesión del usuario.)
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname === '/admin/login' || !isAdminAuthRequired()) return NextResponse.next()

  const ok = await verifySessionToken(request.cookies.get(ADMIN_COOKIE)?.value)
  if (ok) return NextResponse.next()

  return NextResponse.redirect(new URL('/admin/login', request.url))
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
