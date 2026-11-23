'use client'

import { useEffect, useState } from 'react'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { DEFAULT_TIERS, MAX_FEE, MAX_KM, MAX_TIERS, ROAD_FACTOR, parseTiers, type DeliveryTier } from '@/lib/deliveryZones'
import { Button } from '@/components/ui/Button'

/** Tramos de envío por distancia: "hasta X km, $Y". El último tramo es el límite de cobertura. */
export function DeliveryZonesEditor() {
  const [rows, setRows] = useState<{ km: string; fee: string }[] | null>(null)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const toRows = (t: DeliveryTier[]) => t.map(x => ({ km: String(x.km), fee: String(x.fee) }))

  useEffect(() => {
    if (!isSupabaseConfigured()) { setRows(toRows(DEFAULT_TIERS)); return }
    void getBrowserSupabase().from('store_settings').select('delivery_tiers').eq('id', 1).maybeSingle()
      .then(({ data }) => setRows(toRows(parseTiers(data?.delivery_tiers) ?? DEFAULT_TIERS)))
  }, [])

  if (!rows) return null

  const edit = (i: number, key: 'km' | 'fee', value: string) => {
    setRows(r => r!.map((row, j) => (j === i ? { ...row, [key]: value } : row)))
    setStatus('idle')
  }

  const save = async () => {
    const tiers = parseTiers(rows.map(r => ({ km: Number(r.km), fee: Number(r.fee) })))
    if (!tiers) {
      setStatus('error')
      setMessage(`Revisa los tramos: kilómetros entre 0 y ${MAX_KM} sin repetir, y costo entero entre $0 y $${MAX_FEE}.`)
      return
    }
    setStatus('saving')
    const { error } = await getBrowserSupabase()
      .from('store_settings').update({ delivery_tiers: tiers, updated_at: new Date().toISOString() }).eq('id', 1)
    if (error) { setStatus('error'); setMessage('No se pudo guardar. ¿Ya corriste la migración 0009?'); return }
    setRows(toRows(tiers))
    setStatus('saved')
  }

  const input = 'w-24 min-h-10 rounded-lg bg-surface border border-border px-3 text-sm text-foreground tabular focus:border-brand outline-none'

  return (
    <section className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      <div>
        <h1 className="font-display text-[1.625rem] font-bold leading-none text-foreground">Envío a domicilio</h1>
        <p className="text-muted text-sm mt-1.5">
          El cliente paga según qué tan lejos esté de tu local. La distancia es aproximada (línea recta × {ROAD_FACTOR}).
          El tramo más lejano es el límite: más allá de ahí no se entrega.
        </p>
      </div>

      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-wrap items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3">
            <label className="flex items-center gap-2 text-sm text-secondary">
              Hasta
              <input className={input} inputMode="decimal" aria-label={`Kilómetros del tramo ${i + 1}`} value={r.km} onChange={e => edit(i, 'km', e.target.value)} />
              km
            </label>
            <label className="flex items-center gap-2 text-sm text-secondary">
              Costo $
              <input className={input} inputMode="numeric" aria-label={`Costo del tramo ${i + 1}`} value={r.fee} onChange={e => edit(i, 'fee', e.target.value)} />
            </label>
            {i === rows.length - 1 && <span className="text-xs text-muted">Límite de cobertura</span>}
            {rows.length > 1 && (
              <button type="button" onClick={() => { setRows(rows.filter((_, j) => j !== i)); setStatus('idle') }}
                className="ml-auto text-xs text-muted hover:text-error transition-colors min-h-10 px-2">Quitar</button>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        {rows.length < MAX_TIERS && (
          <Button variant="ghost" onClick={() => { setRows([...rows, { km: '', fee: '' }]); setStatus('idle') }}>Agregar tramo</Button>
        )}
        <Button onClick={save} disabled={status === 'saving'}>{status === 'saving' ? 'Guardando…' : 'Guardar'}</Button>
        {status === 'saved' && <span role="status" className="text-success text-sm">Guardado</span>}
        {status === 'error' && <span role="alert" className="text-error text-sm">{message}</span>}
      </div>
    </section>
  )
}
