'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { login, type LoginState } from '../actions'

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: null })

  return (
    <form action={action} className="space-y-4">
      <Input
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        autoFocus
        aria-invalid={!!state.error}
        aria-describedby={state.error ? 'login-error' : undefined}
      />
      {state.error && (
        <p id="login-error" role="alert" className="text-error text-sm">{state.error}</p>
      )}
      <Button type="submit" fullWidth disabled={pending}>
        {pending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}
