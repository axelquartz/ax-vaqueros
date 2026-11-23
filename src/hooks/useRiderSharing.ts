'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase/browser'

/**
 * El repartidor comparte su ubicación GPS del celular mientras el pedido va en
 * camino. Se guarda en el pedido (Supabase) y el cliente la ve en su mapa.
 *
 * Limitación del navegador: el GPS solo corre con la página abierta y la
 * pantalla encendida. Se pide "mantener pantalla encendida" (Wake Lock) cuando
 * el celular lo soporta.
 */

/** Enviar como máximo cada 8 s, o antes si se movió más de 30 m */
const MIN_INTERVAL_MS = 8_000
const MIN_DISTANCE_M = 30
/** Aunque no se mueva, avisar cada 30 s que sigue compartiendo */
const HEARTBEAT_MS = 30_000

export type RiderSharingState =
  | { status: 'off' }
  | { status: 'starting' }
  | { status: 'on'; sentAt?: number; accuracy?: number; warning?: string }
  | { status: 'error'; message: string }

function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function geoErrorMessage(err: GeolocationPositionError): string {
  if (err.code === err.PERMISSION_DENIED) return 'Permite el acceso a tu ubicación en el navegador para compartirla.'
  if (err.code === err.POSITION_UNAVAILABLE) return 'No se pudo obtener tu ubicación. Revisa que el GPS esté encendido.'
  return 'La ubicación tardó demasiado. Intenta de nuevo.'
}

export function useRiderSharing(orderId: string) {
  const [state, setState] = useState<RiderSharingState>({ status: 'off' })
  const watchId = useRef<number | null>(null)
  const wakeLock = useRef<WakeLockSentinel | null>(null)
  const last = useRef<{ lat: number; lng: number; at: number } | null>(null)

  const stop = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
    void wakeLock.current?.release().catch(() => {})
    wakeLock.current = null
    last.current = null
    setState({ status: 'off' })
  }, [])

  const start = useCallback(async () => {
    if (!('geolocation' in navigator)) {
      setState({ status: 'error', message: 'Este navegador no puede compartir ubicación.' })
      return
    }
    setState({ status: 'starting' })
    try {
      wakeLock.current = (await navigator.wakeLock?.request('screen')) ?? null
    } catch {
      // Sin Wake Lock: funciona igual mientras la pantalla siga encendida
    }

    watchId.current = navigator.geolocation.watchPosition(
      async pos => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        const now = Date.now()
        const prev = last.current
        if (prev) {
          const elapsed = now - prev.at
          const moved = distanceM(prev, point)
          if (elapsed < MIN_INTERVAL_MS) return
          if (moved < MIN_DISTANCE_M && elapsed < HEARTBEAT_MS) return
        }
        last.current = { ...point, at: now }
        const { error } = await getBrowserSupabase()
          .from('orders')
          .update({ rider_lat: point.lat, rider_lng: point.lng, rider_at: new Date(pos.timestamp).toISOString() })
          .eq('id', orderId)
        if (error) {
          console.error('No se pudo enviar la ubicación', error)
          last.current = prev // reintentar con la siguiente lectura
          setState(s => ({ ...(s.status === 'on' ? s : {}), status: 'on', warning: 'No se pudo enviar tu ubicación. Revisa tu conexión; se reintenta sola.' }))
          return
        }
        setState({ status: 'on', sentAt: now, accuracy: Math.round(pos.coords.accuracy) })
      },
      err => {
        stop()
        setState({ status: 'error', message: geoErrorMessage(err) })
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    )
  }, [orderId, stop])

  // El Wake Lock se suelta al ocultar la página: pedirlo otra vez al volver
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState === 'visible' && watchId.current !== null && !wakeLock.current) {
        try { wakeLock.current = (await navigator.wakeLock?.request('screen')) ?? null } catch {}
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // Al salir (o cuando el pedido deja de ir en camino) se deja de compartir
  useEffect(() => stop, [stop])

  return { state, start, stop, sharing: state.status === 'on' || state.status === 'starting' }
}
