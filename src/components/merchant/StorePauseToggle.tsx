'use client'

import { useEffect, useState } from 'react'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getBrowserSupabase } from '@/lib/supabase/browser'

/** Pausa/reanuda la recepción de pedidos (cocina saturada) */
export function StorePauseToggle() {
  const [paused, setPaused] = useState<boolean | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    void getBrowserSupabase().from('store_settings').select('orders_paused').eq('id', 1).maybeSingle()
      .then(({ data }) => setPaused(data?.orders_paused ?? false))
  }, [])

  if (paused === null) return null

  const toggle = async () => {
    const next = !paused
    setPaused(next)
    setError(false)
    const { error } = await getBrowserSupabase()
      .from('store_settings').update({ orders_paused: next, updated_at: new Date().toISOString() }).eq('id', 1)
    if (error) { setPaused(!next); setError(true) }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span role="alert" className="text-error text-xs">No se pudo cambiar</span>}
      <button
        type="button"
        onClick={toggle}
        aria-pressed={paused}
        className={[
          'min-h-10 px-4 rounded-full text-sm font-medium border transition-colors',
          paused ? 'bg-warning/10 border-warning/40 text-warning' : 'bg-surface border-border text-secondary hover:border-border-strong',
        ].join(' ')}
      >
        {paused ? 'Pedidos pausados · Reanudar' : 'Pausar pedidos'}
      </button>
    </div>
  )
}
