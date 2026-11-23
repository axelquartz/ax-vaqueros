'use client'

import { useCallback, useEffect, useState } from 'react'
import menuData from '@/data/menu.json'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { COLUMNS, rowToPromotion } from '@/lib/promotionRows'
import hours from '@/data/hours.json'
import { normalizeCode, promoStatus, type Promotion, type PromoStatus } from '@/lib/promotions'

const categories = menuData.categories.filter(c => c.id !== 'todos')
const products = menuData.products
// Lunes primero, como se lee en México (0 = domingo en la base)
const DAYS = [{ v: 1, l: 'L' }, { v: 2, l: 'M' }, { v: 3, l: 'X' }, { v: 4, l: 'J' }, { v: 5, l: 'V' }, { v: 6, l: 'S' }, { v: 0, l: 'D' }]
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

interface Form {
  name: string; kind: 'percent' | 'amount'; value: string
  scope: 'order' | 'category' | 'product'; target: string
  code: string; minSubtotal: string
  allDay: boolean
  days: number[]; startTime: string; endTime: string
  startsOn: string; endsOn: string; maxUses: string
}
const EMPTY: Form = {
  name: '', kind: 'percent', value: '10', scope: 'order', target: '', code: '', minSubtotal: '',
  allDay: true, days: [], startTime: '', endTime: '', startsOn: '', endsOn: '', maxUses: '',
}

const STATUS: Record<PromoStatus, { label: string; cls: string }> = {
  active:    { label: 'Activa ahora', cls: 'bg-success/10 border-success/30 text-success' },
  scheduled: { label: 'Programada',   cls: 'bg-warning/10 border-warning/30 text-warning' },
  paused:    { label: 'Pausada',      cls: 'bg-elevated border-border text-muted' },
  expired:   { label: 'Vencida',      cls: 'bg-error/10 border-error/30 text-error' },
}

const field = 'min-h-11 w-full rounded-lg border border-border bg-elevated px-3 text-foreground text-sm'

function describe(p: Promotion): string {
  const what = p.kind === 'percent' ? `${p.value}%` : `$${p.value}`
  const where = p.scope === 'order' ? 'del pedido'
    : p.scope === 'category' ? `en ${categories.find(c => c.id === p.target)?.label ?? p.target}`
    : `en ${products.find(x => x.id === p.target)?.name ?? p.target}`
  const when = [
    p.days ? p.days.map(d => DAY_NAMES[d]).join(', ') : null,
    p.startTime && p.endTime ? `${p.startTime}–${p.endTime}` : null,
    p.endsOn ? `hasta ${p.endsOn}` : null,
    p.minSubtotal ? `desde $${p.minSubtotal}` : null,
    p.maxUses ? `máx. ${p.maxUses} usos` : null,
  ].filter(Boolean).join(' · ')
  return `${what} ${where}${when ? ` · ${when}` : ''}`
}

/** Promociones (se aplican solas) y cupones (con código): el dueño las administra sin pedir soporte */
export function PromoEditor() {
  const [promos, setPromos] = useState<Promotion[]>([])
  const [form, setForm] = useState<Form>(EMPTY)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const online = isSupabaseConfigured()

  const load = useCallback(async () => {
    const { data, error } = await getBrowserSupabase().from('promotions').select(COLUMNS).order('created_at', { ascending: false })
    if (error) { setError('No se pudieron cargar las promociones. ¿Ya corriste la migración 0007?'); return }
    setPromos((data ?? []).map(r => rowToPromotion(r as Parameters<typeof rowToPromotion>[0])))
  }, [])
  useEffect(() => { if (online) void load() }, [online, load])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }))

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const value = Number(form.value)
    if (!form.name.trim()) return setError('Ponle un nombre.')
    if (!Number.isInteger(value) || value <= 0 || (form.kind === 'percent' && value > 100)) return setError('Revisa el valor del descuento.')
    if (form.scope !== 'order' && !form.target) return setError('Elige a qué aplica.')
    const code = normalizeCode(form.code)
    if (code && !/^[A-Z0-9]{3,20}$/.test(code)) return setError('El código usa solo letras y números (3 a 20).')
    if (!form.allDay && !(form.startTime && form.endTime)) return setError('Pon hora de inicio y de fin, o marca "Todo el día".')
    setBusy(true)
    const { error } = await getBrowserSupabase().from('promotions').insert({
      name: form.name.trim(), kind: form.kind, value, scope: form.scope,
      target: form.scope === 'order' ? null : form.target, code: code || null,
      min_subtotal: Number(form.minSubtotal) || 0,
      days: form.days.length ? form.days : null,
      start_time: form.allDay ? null : form.startTime, end_time: form.allDay ? null : form.endTime,
      starts_on: form.startsOn || null, ends_on: form.endsOn || null,
      max_uses: Number(form.maxUses) || null,
    })
    setBusy(false)
    if (error) return setError(error.code === '23505' ? 'Ya existe un cupón con ese código.' : 'No se pudo guardar. Revisa los datos.')
    setForm(EMPTY); setOpen(false); void load()
  }

  async function toggle(p: Promotion) {
    const { error } = await getBrowserSupabase().from('promotions').update({ active: !p.active }).eq('id', p.id)
    if (error) setError('No se pudo actualizar.'); else void load()
  }
  async function remove(p: Promotion) {
    if (!window.confirm(`¿Borrar "${p.name}"?`)) return
    const { error } = await getBrowserSupabase().from('promotions').delete().eq('id', p.id)
    if (error) setError('No se pudo borrar.'); else void load()
  }

  if (!online) return <p className="max-w-3xl mx-auto px-4 py-10 text-warning text-sm">Las promociones necesitan Supabase configurado.</p>

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[1.625rem] font-bold leading-none text-foreground">Promociones</h1>
          <p className="text-muted text-sm mt-1.5">Sin código se aplican solas. Con código son cupones que el cliente escribe. Solo se aplica una por pedido: la que más descuente.</p>
        </div>
        <button type="button" onClick={() => setOpen(o => !o)} className="shrink-0 min-h-11 px-4 rounded-lg bg-brand text-inverse text-sm font-semibold">
          {open ? 'Cerrar' : '+ Nueva'}
        </button>
      </div>
      {error && <p role="alert" className="text-error text-sm bg-error/10 border border-error/25 rounded-lg px-3 py-2">{error}</p>}

      {open && (
        <form onSubmit={create} className="bg-surface border border-border rounded-2xl p-4 space-y-4">
          <label className="block space-y-1.5"><span className="text-sm text-secondary">Nombre (lo ve el cliente)</span>
            <input className={field} value={form.name} maxLength={60} placeholder="Martes de alitas" onChange={e => set('name', e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5"><span className="text-sm text-secondary">Descuento</span>
              <select className={field} value={form.kind} onChange={e => set('kind', e.target.value as Form['kind'])}>
                <option value="percent">Porcentaje (%)</option><option value="amount">Monto fijo ($)</option>
              </select>
            </label>
            <label className="block space-y-1.5"><span className="text-sm text-secondary">{form.kind === 'percent' ? 'Porcentaje' : 'Pesos'}</span>
              <input className={field} type="number" inputMode="numeric" min={1} value={form.value} onChange={e => set('value', e.target.value)} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5"><span className="text-sm text-secondary">Aplica a</span>
              <select className={field} value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value as Form['scope'], target: '' }))}>
                <option value="order">Todo el pedido</option><option value="category">Una categoría</option><option value="product">Un producto</option>
              </select>
            </label>
            {form.scope !== 'order' && (
              <label className="block space-y-1.5"><span className="text-sm text-secondary">¿Cuál?</span>
                <select className={field} value={form.target} onChange={e => set('target', e.target.value)}>
                  <option value="">Elige…</option>
                  {form.scope === 'category'
                    ? categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)
                    : products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            )}
          </div>
          <label className="block space-y-1.5"><span className="text-sm text-secondary">Código de cupón (opcional)</span>
            <input className={`${field} uppercase`} value={form.code} maxLength={20} placeholder="Vacío = se aplica sola" onChange={e => set('code', e.target.value)} />
          </label>
          <div>
            <span className="text-sm text-secondary">Días (ninguno = todos)</span>
            <div className="flex gap-1.5 mt-1.5">
              {DAYS.map(d => {
                const on = form.days.includes(d.v)
                return (
                  <button key={d.v} type="button" aria-pressed={on} aria-label={DAY_NAMES[d.v]}
                    onClick={() => set('days', on ? form.days.filter(x => x !== d.v) : [...form.days, d.v])}
                    className={`size-11 rounded-full text-sm font-medium border ${on ? 'bg-brand text-inverse border-brand' : 'bg-elevated border-border text-muted'}`}>{d.l}</button>
                )
              })}
            </div>
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-2.5 min-h-11 text-sm text-foreground">
              <input type="checkbox" className="size-5 accent-[var(--brand)]" checked={form.allDay} onChange={e => set('allDay', e.target.checked)} />
              Todo el día
            </label>
            {!form.allDay && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5"><span className="text-sm text-secondary">Desde la hora</span>
                  <input className={field} type="time" value={form.startTime} onChange={e => set('startTime', e.target.value)} /></label>
                <label className="block space-y-1.5"><span className="text-sm text-secondary">Hasta la hora</span>
                  <input className={field} type="time" value={form.endTime} onChange={e => set('endTime', e.target.value)} /></label>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5"><span className="text-sm text-secondary">Válida desde</span>
              <input className={field} type="date" value={form.startsOn} onChange={e => set('startsOn', e.target.value)} /></label>
            <label className="block space-y-1.5"><span className="text-sm text-secondary">Válida hasta</span>
              <input className={field} type="date" value={form.endsOn} onChange={e => set('endsOn', e.target.value)} /></label>
            <label className="block space-y-1.5"><span className="text-sm text-secondary">Compra mínima ($)</span>
              <input className={field} type="number" inputMode="numeric" min={0} value={form.minSubtotal} onChange={e => set('minSubtotal', e.target.value)} /></label>
            <label className="block space-y-1.5"><span className="text-sm text-secondary">Usos máximos</span>
              <input className={field} type="number" inputMode="numeric" min={1} placeholder="Sin límite" value={form.maxUses} onChange={e => set('maxUses', e.target.value)} /></label>
          </div>
          <button type="submit" disabled={busy} className="w-full min-h-12 rounded-lg bg-brand text-inverse font-semibold disabled:opacity-50">
            {busy ? 'Guardando…' : 'Guardar promoción'}
          </button>
        </form>
      )}

      <ul className="bg-surface border border-border rounded-2xl divide-y divide-border-subtle">
        {promos.length === 0 && <li className="px-4 py-6 text-muted text-sm text-center">Aún no hay promociones.</li>}
        {promos.map(p => {
          const st = promoStatus(p, new Date(), hours.timezone)
          const badge = STATUS[st.status]
          return (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className={`text-sm truncate ${st.status === 'paused' || st.status === 'expired' ? 'text-muted' : 'text-foreground'}`}>
                  {p.name} {p.code && <span className="ml-1 rounded bg-elevated border border-border px-1.5 py-0.5 text-xs tabular">{p.code}</span>}
                </p>
                <p className="text-muted text-xs mt-0.5">{describe(p)}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                  {st.note && <span className="text-muted text-xs">{st.note}</span>}
                </p>
              </div>
              {st.status !== 'expired' && (
                <button type="button" onClick={() => void toggle(p)} aria-label={`${p.active ? 'Pausar' : 'Activar'} ${p.name}`}
                  className="shrink-0 min-h-10 px-3 rounded-lg border border-border text-xs text-secondary hover:bg-overlay">
                  {p.active ? 'Pausar' : 'Activar'}
                </button>
              )}
              <button type="button" aria-label={`Borrar ${p.name}`} onClick={() => void remove(p)} className="shrink-0 min-h-10 px-2 text-muted hover:text-error text-sm">✕</button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
