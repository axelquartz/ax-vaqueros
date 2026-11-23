'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/Button'
import { findOrderToken } from '@/lib/orderHistory'
import { ORDER_TOKEN_HEADER } from '@/lib/orders/customerApi'
import { MAX_REASON, MIN_REASON, REFUND_LABEL, type RefundStatus } from '@/lib/refunds'

const noop = () => () => {}
interface Refund { status: RefundStatus; reason: string; admin_note: string }

/** El cliente solicita un reembolso con motivo obligatorio; el equipo decide a mano */
export function RefundCard({ folio }: { folio: string }) {
  const token = useSyncExternalStore(noop, () => findOrderToken(folio), () => undefined)
  const [loaded, setLoaded] = useState(false)
  const [refund, setRefund] = useState<Refund | null>(null)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const url = `/api/orders/${encodeURIComponent(folio)}/refund`

  useEffect(() => {
    if (!token) return
    let cancelled = false
    fetch(url, { headers: { [ORDER_TOKEN_HEADER]: token }, cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled) { setRefund(d?.refund ?? null); setLoaded(true) } })
      .catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [url, token])

  if (!token || !loaded) return null

  async function submit() {
    setBusy(true); setError(null)
    try {
      const res = await fetch(url, {
        method: 'POST', headers: { [ORDER_TOKEN_HEADER]: token!, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'No se pudo enviar')
      setRefund(d.refund)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo enviar. Intenta de nuevo.') }
    finally { setBusy(false) }
  }

  if (refund) {
    return (
      <div role="status" className="bg-surface border border-border rounded-xl p-4 space-y-1">
        <p className="text-foreground text-sm font-medium">{REFUND_LABEL[refund.status]}</p>
        <p className="text-muted text-xs">Tu motivo: “{refund.reason}”</p>
        {refund.status === 'rejected' && refund.admin_note && <p className="text-secondary text-xs">Respuesta: {refund.admin_note}</p>}
        {refund.status === 'approved' && <p className="text-secondary text-xs">Tu banco puede tardar unos días en reflejarlo.</p>}
      </div>
    )
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full text-center text-muted text-xs underline underline-offset-2 hover:text-foreground">
        ¿Problema con tu pedido? Solicitar reembolso
      </button>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
      <label className="block text-sm text-foreground" htmlFor="refund-reason">¿Qué pasó con tu pedido?</label>
      <textarea
        id="refund-reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={MAX_REASON} rows={3}
        className="w-full rounded-lg border border-border bg-elevated p-3 text-sm text-foreground"
        placeholder="Cuéntanos el motivo de tu solicitud"
      />
      <p className="text-muted text-xs">Nuestro equipo la revisa y te avisa. No es automático.</p>
      {error && <p role="alert" className="text-error text-xs">{error}</p>}
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
        <Button onClick={submit} disabled={busy || reason.trim().length < MIN_REASON}>Enviar solicitud</Button>
      </div>
    </div>
  )
}
