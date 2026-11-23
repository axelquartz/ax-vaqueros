'use client'

import { useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase/browser'

export function LogoutButton() {
  const [pending, setPending] = useState(false)
  return (
    <button
      type="button"
      disabled={pending}
      aria-label="Cerrar sesión"
      onClick={async () => {
        setPending(true)
        await getBrowserSupabase().auth.signOut()
        // Navegación completa: descarta el panel y sus datos en memoria
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign('/admin/login')
      }}
      className="min-h-10 px-2.5 sm:px-3 inline-flex items-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-500/10 text-sm font-medium text-rose-300 hover:bg-rose-500/20 transition-colors disabled:opacity-50"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      <span className="hidden sm:inline">{pending ? 'Cerrando…' : 'Cerrar sesión'}</span>
    </button>
  )
}
