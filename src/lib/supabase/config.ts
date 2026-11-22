/**
 * Supabase está "configurado" cuando existen sus variables. Sin ellas la app
 * sigue funcionando como demo (pedidos en el navegador), igual que antes.
 * Las NEXT_PUBLIC_* se incrustan en el build: en Netlify hay que volver a
 * publicar después de agregarlas.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ''

/** El navegador puede hablar con Supabase (panel del equipo) */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
}

/** El servidor puede guardar pedidos (requiere además la clave secreta) */
export function isServerSupabaseConfigured(): boolean {
  return isSupabaseConfigured() && Boolean(process.env.SUPABASE_SECRET_KEY)
}
