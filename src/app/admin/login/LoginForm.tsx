'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getBrowserSupabase } from '@/lib/supabase/browser'

const MESSAGES: Record<string, string> = {
  'sin-acceso': 'Tu usuario no tiene acceso al panel. Pide al administrador que te agregue al equipo.',
}

const noopSubscribe = () => () => {}

export function LoginForm() {
  const configured = isSupabaseConfigured()
  const [submitError, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  // ?error=sin-acceso: entró con una cuenta que no es del equipo; se cierra esa sesión
  const code = useSyncExternalStore(noopSubscribe, () => new URLSearchParams(window.location.search).get('error'), () => null)
  useEffect(() => {
    if (code && configured) void getBrowserSupabase().auth.signOut()
  }, [code, configured])
  const error = submitError ?? (code ? MESSAGES[code] ?? null : null)

  if (!configured) {
    return (
      <p role="alert" className="text-error text-sm">
        El panel no está configurado (faltan las variables de Supabase).
      </p>
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setPending(true)
    setError(null)
    const { error } = await getBrowserSupabase().auth.signInWithPassword({
      email: String(form.get('email') ?? '').trim(),
      password: String(form.get('password') ?? ''),
    })
    if (error) {
      setError(error.status === 400 ? 'Correo o contraseña incorrectos.' : 'No se pudo entrar. Revisa tu conexión e intenta de nuevo.')
      setPending(false)
      return
    }
    // Navegación completa (no del router) para que el proxy lea la sesión nueva
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign('/admin')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Correo" name="email" type="email" autoComplete="username" required autoFocus />
      <Input
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        aria-invalid={!!error}
        aria-describedby={error ? 'login-error' : undefined}
      />
      {error && (
        <p id="login-error" role="alert" className="text-error text-sm">{error}</p>
      )}
      <Button type="submit" fullWidth disabled={pending}>
        {pending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}
