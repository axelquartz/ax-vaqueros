'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import type { RefundStatus } from '@/lib/refunds'

interface Row { resolved_at?: string | null; order_id: string; status: RefundStatus; reason: string; admin_note: string; requested_at: string }

/** Solicitudes de reembolso: el admin aprueba (reembolsa en Mercado Pago) o rechaza a mano */
export function RefundsPanel() {
  const [all, setAll] = useState<Row[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const online = isSupabaseConfigured()

  const load = useCallback(async () => {
    const { data } = await getBrowserSupabase().from('refunds')
      .select('order_id, status, reason, admin_note, requested_at, resolved_at')
      .order('requested_at', { ascending: false }).limit(100)
    setAll((data ?? []) as Row[])
  }, [])
  useEffect(() => { if (online) void load() }, [online, load])

  async function decide(id: string, action: 'approve' | 'reject') {
    setBusy(id); setError(null)
    try {
      const note = action === 'reject' ? (window.prompt('Motivo del rechazo (opcional, lo verá el cliente)') ?? '') : ''
      const res = await fetch(`/api/admin/refunds/${encodeURIComponent(id)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, note }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error')
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar') }
    finally { setBusy(null); setConfirm(null); void load() }
  }

  if (!online || !all || all.length === 0) return null
  const history = all.filter(r => r.status === 'approved' || r.status === 'rejected')
  const rows = all.filter(r => r.status !== 'approved' && r.status !== 'rejected').reverse()
  return (
    <section aria-label="Reembolsos" className="max-w-6xl mx-auto px-4 pt-6 space-y-3">
      {rows.length > 0 && <h2 className="font-display text-xl font-bold text-foreground">Solicitudes de reembolso ({rows.length})</h2>}
      {error && <p role="alert" className="text-error text-sm">{error}</p>}
      {rows.length > 0 && <ul className="bg-surface border border-warning/40 rounded-2xl divide-y divide-border-subtle">
        {rows.map(r => (
          <li key={r.order_id} className="p-4 space-y-2">
            <p className="text-foreground font-semibold tabular">{r.order_id}</p>
            <p className="text-secondary text-sm">“{r.reason}”</p>
            {r.status === 'failed' && <p className="text-error text-xs">Falló en Mercado Pago: {r.admin_note}. Puedes reintentar.</p>}
            {r.status === 'processing' ? <p className="text-muted text-xs">Procesando…</p> : confirm === r.order_id ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-foreground">¿Reembolsar el total en Mercado Pago?</span>
                <Button variant="ghost" onClick={() => setConfirm(null)}>No</Button>
                <Button onClick={() => decide(r.order_id, 'approve')} disabled={busy === r.order_id}>Sí, reembolsar</Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button onClick={() => setConfirm(r.order_id)} disabled={busy === r.order_id}>Aprobar</Button>
                <Button variant="ghost" onClick={() => decide(r.order_id, 'reject')} disabled={busy === r.order_id}>Rechazar</Button>
              </div>
            )}
          </li>
        ))}
      </ul>}
      {history.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted hover:text-foreground">Historial de reembolsos ({history.length})</summary>
          <ul className="mt-2 bg-surface border border-border rounded-2xl divide-y divide-border-subtle">
            {history.slice(0, 30).map(r => (
              <li key={r.order_id} className="p-3 flex flex-wrap items-baseline justify-between gap-x-4">
                <span className="text-foreground tabular">{r.order_id}</span>
                <span className={r.status === 'approved' ? 'text-success' : 'text-muted'}>
                  {r.status === 'approved' ? 'Reembolsado' : 'Rechazado'}
                  {r.resolved_at && ` · ${new Date(r.resolved_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`}
                </span>
                <span className="basis-full text-muted text-xs">“{r.reason}”{r.admin_note && ` — ${r.admin_note}`}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
