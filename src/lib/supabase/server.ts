import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/**
 * Cliente con la clave secreta: ignora las reglas RLS. Solo para rutas del
 * servidor (crear pedidos, confirmar pagos). Nunca importarlo desde un
 * componente de cliente.
 */
export function getServerSupabase(): SupabaseClient {
  if (typeof window !== 'undefined') throw new Error('getServerSupabase solo funciona en el servidor')
  return (client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  }))
}
