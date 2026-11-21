'use client'

import { useSyncExternalStore } from 'react'

/**
 * Reloj compartido que avanza cada 30 s para refrescar "Hace N min".
 * Store externo (no Date.now() en render): en el servidor vale 0 y el
 * panel no se prerenderiza con una hora congelada.
 */
let clockNow = 0
const clockListeners = new Set<() => void>()
let clockTimer: ReturnType<typeof setInterval> | undefined
function subscribeClock(cb: () => void) {
  clockListeners.add(cb)
  if (!clockTimer) {
    // Al (re)montar el panel, la hora se actualiza de inmediato: React re-lee
    // el snapshot tras suscribirse y re-renderiza si cambió
    clockNow = Date.now()
    clockTimer = setInterval(() => { clockNow = Date.now(); clockListeners.forEach(l => l()) }, 30_000)
  }
  return () => {
    clockListeners.delete(cb)
    if (clockListeners.size === 0) { clearInterval(clockTimer); clockTimer = undefined }
  }
}
const getClock = () => (clockNow ||= Date.now())
const getServerClock = () => 0

export function useNow(): number {
  return useSyncExternalStore(subscribeClock, getClock, getServerClock)
}
