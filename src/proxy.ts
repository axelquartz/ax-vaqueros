import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isSupabaseConfigured } from '@/lib/supabase/config'

const LOGIN = '/admin/login'
const RIDER_PAGE = '/repartidor'

/**
 * Protege /admin y /repartidor: hace falta una sesión de Supabase de alguien registrado en
 * la tabla `staff`. Además renueva la sesión (cookies) en cada visita.
 *
 * Esta es la puerta de la página; los datos los protegen además las reglas
 * RLS de la base de datos, así que aunque alguien se saltara esta revisión no
 * vería pedidos.
 *
 * Sin Supabase configurado: en desarrollo el panel se abre (demo local); en
 * producción queda cerrado.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname === LOGIN) return NextResponse.next()

  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV !== 'production') return NextResponse.next()
    return NextResponse.redirect(new URL(LOGIN, request.url))
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value))
        },
      },
    },
  )

  // getClaims verifica la firma del token (no basta con leer la cookie)
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) return redirectKeepingCookies(request, response)

  const { data: staff } = await supabase.from('staff').select('role').eq('user_id', userId).maybeSingle()
  if (!staff) return redirectKeepingCookies(request, response, 'sin-acceso')

  // Cada rol a su pantalla: el repartidor no ve el panel completo
  const isRiderPage = pathname === RIDER_PAGE || pathname.startsWith(`${RIDER_PAGE}/`)
  if (staff.role === 'rider' && !isRiderPage) {
    const redirect = NextResponse.redirect(new URL(RIDER_PAGE, request.url))
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie))
    return redirect
  }

  return response
}

/** Redirige al login conservando las cookies de sesión renovadas */
function redirectKeepingCookies(request: NextRequest, from: NextResponse, error?: string) {
  const url = new URL(LOGIN, request.url)
  if (error) url.searchParams.set('error', error)
  const redirect = NextResponse.redirect(url)
  from.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie))
  return redirect
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/repartidor', '/repartidor/:path*'],
}
