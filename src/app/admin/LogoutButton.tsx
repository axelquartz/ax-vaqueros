'use client'

import { useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase/browser'

export function LogoutButton() {
  const [pending, setPending] = useState(false)
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true)
        await getBrowserSupabase().auth.signOut()
        // Navegación completa: descarta el panel y sus datos en memoria
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign('/admin/login')
      }}
      className="min-h-10 px-3 text-sm text-muted hover:text-foreground transition-colors disabled:opacity-50"
    >
      {pending ? 'Saliendo…' : 'Salir'}
    </button>
  )
}
