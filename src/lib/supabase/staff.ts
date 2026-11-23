import { createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'
import { getServerSupabase } from './server'

/**
 * Verifica que la petición venga de alguien del equipo (sesión de Supabase en
 * cookies + fila en `staff`). Devuelve su user_id y rol, o null.
 */
export async function getStaff(req: NextRequest): Promise<{ userId: string; role: string } | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } },
  )
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) return null
  const { data: staff } = await getServerSupabase().from('staff').select('role').eq('user_id', userId).maybeSingle()
  return staff ? { userId, role: staff.role as string } : null
}
