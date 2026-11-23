'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { findOrderToken } from '@/lib/orderHistory'

type Props =
  | { mode: 'customer'; folio: string }
  | { mode: 'staff' }

const urlBase64ToUint8Array = (b64: string) => {
  const raw = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

/** Botón para activar avisos push. No aparece si el navegador no los soporta (p. ej. iPhone sin instalar la app). */
export function PushToggle(props: Props) {
  const token = useSyncExternalStore(() => () => {}, () => (props.mode === 'customer' ? findOrderToken(props.folio) : null), () => null)
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const [state, setState] = useState<'hidden' | 'off' | 'on' | 'denied' | 'busy'>('hidden')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!key || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return
    if (Notification.permission === 'denied') { setState('denied'); return }
    navigator.serviceWorker.getRegistration('/sw.js').then(reg => reg?.pushManager.getSubscription())
      .then(sub => setState(sub ? 'on' : 'off')).catch(() => setState('off'))
  }, [key])

  if (state === 'hidden' || !key || (props.mode === 'customer' && !token)) return null

  const endpoint = props.mode === 'customer' ? `/api/orders/${encodeURIComponent(props.folio)}/push` : '/api/push/staff'
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (props.mode === 'customer') headers['x-order-token'] = token ?? ''

  async function enable() {
    setState('busy'); setError(null)
    try {
      if ((await Notification.requestPermission()) !== 'granted') { setState('denied'); return }
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({
        userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key!),
      })
      const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ subscription: sub.toJSON() }) })
      if (!res.ok) throw new Error()
      setState('on')
    } catch { setError('No se pudo activar. Intenta de nuevo.'); setState('off') }
  }

  async function disable() {
    setState('busy')
    try {
      const sub = await (await navigator.serviceWorker.getRegistration('/sw.js'))?.pushManager.getSubscription()
      if (sub) {
        await fetch(endpoint, { method: 'DELETE', headers, body: JSON.stringify({ subscription: sub.toJSON() }) })
        if (props.mode === 'customer') await sub.unsubscribe()
      }
    } finally { setState('off') }
  }

  const customer = props.mode === 'customer'
  if (!customer) {
    // Chip compacto para la barra del panel
    return (
      <button
        type="button" disabled={state === 'busy' || state === 'denied'} aria-pressed={state === 'on'}
        onClick={() => (state === 'on' ? disable() : enable())}
        title={state === 'denied' ? 'Bloqueaste las notificaciones en el navegador' : error ?? undefined}
        className={[
          'shrink-0 min-h-10 px-4 rounded-full text-sm font-medium border transition-colors disabled:opacity-60',
          state === 'on' ? 'bg-brand/10 border-brand/40 text-brand' : 'bg-surface border-border text-secondary hover:border-border-strong',
        ].join(' ')}
      >
        {state === 'denied' ? 'Avisos bloqueados' : state === 'on' ? 'Avisos activados' : 'Activar avisos'}
      </button>
    )
  }

  const label = 'Avísame cuando cambie mi pedido'
  return (
    <div className="flex items-center justify-between gap-3 bg-surface border border-border rounded-xl px-4 py-3">
      <p className="text-sm text-foreground">
        🔔 {label}
        {state === 'denied' && <span className="block text-muted text-xs">Bloqueaste las notificaciones en tu navegador.</span>}
        {error && <span className="block text-error text-xs">{error}</span>}
      </p>
      {state !== 'denied' && (
        <button
          type="button" disabled={state === 'busy'}
          onClick={() => (state === 'on' ? disable() : enable())}
          className="shrink-0 min-h-10 px-3 rounded-lg border border-brand/40 text-brand text-sm hover:bg-brand/10 disabled:opacity-50"
        >
          {state === 'on' ? 'Desactivar' : 'Activar'}
        </button>
      )}
    </div>
  )
}
