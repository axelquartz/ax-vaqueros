'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/**
 * Cliente del navegador. Guarda la sesión en cookies para que el proxy de
 * /admin pueda leerla. Solo lo usa el panel del equipo; los clientes del
 * restaurante nunca hablan con Supabase directamente.
 */
export function getBrowserSupabase(): SupabaseClient {
  return (client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  ))
}
