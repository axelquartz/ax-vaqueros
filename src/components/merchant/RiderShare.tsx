'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useRiderSharing } from '@/hooks/useRiderSharing'

/** Botón del repartidor: compartir su GPS con el cliente mientras va en camino */
export function RiderShare({ orderId }: { orderId: string }) {
  const { state, start, stop, sharing } = useRiderSharing(orderId)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!sharing) return
    const id = setInterval(() => setNow(Date.now()), 5_000)
    return () => clearInterval(id)
  }, [sharing])

  const ago = state.status === 'on' && state.sentAt ? Math.max(0, Math.round((now - state.sentAt) / 1000)) : null

  return (
    <div className="mx-4 mt-3 rounded-lg border border-border bg-elevated px-3 py-2.5 space-y-2">
      {sharing ? (
        <>
          <div className="flex items-center gap-2">
            <span aria-hidden className="relative flex h-2.5 w-2.5">
              <span className="absolute inset-0 rounded-full bg-success/60 animate-status-pulse" />
              <span className="relative h-2.5 w-2.5 rounded-full bg-success" />
            </span>
            <p className="text-sm text-foreground" role="status">
              {state.status === 'starting' ? 'Buscando señal GPS…' : 'El cliente ve tu ubicación'}
            </p>
          </div>
          {ago !== null && (
            <p className="text-muted text-xs tabular">
              Enviada hace {ago < 5 ? 'un momento' : `${ago} s`}
              {state.status === 'on' && state.accuracy ? ` · precisión ±${state.accuracy} m` : ''}
            </p>
          )}
          {state.status === 'on' && state.warning && <p className="text-warning text-xs">{state.warning}</p>}
          <p className="text-muted text-xs">Deja esta pantalla abierta durante la entrega.</p>
          <Button variant="ghost" fullWidth onClick={stop}>Dejar de compartir</Button>
        </>
      ) : (
        <>
          {state.status === 'error' && <p className="text-error text-xs" role="alert">{state.message}</p>}
          <Button variant="ghost" fullWidth onClick={() => void start()}>📍 Compartir mi ubicación</Button>
        </>
      )}
    </div>
  )
}
