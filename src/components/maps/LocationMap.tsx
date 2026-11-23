'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { createDarkMap, pinIcon } from '@/lib/leaflet'

/** Mapa fijo con un pin (p. ej. la ubicación del restaurante en "Nosotros") */
export function LocationMap({ lat, lng }: { lat: number; lng: number }) {
  const el = useRef<HTMLDivElement>(null)
  const coords = useRef({ lat, lng })
  useEffect(() => { coords.current = { lat, lng } })

  // Crear / destruir el mapa (ver nota en src/lib/leaflet.ts)
  useEffect(() => {
    if (!el.current) return
    const { lat, lng } = coords.current
    const m = createDarkMap(el.current, [lat, lng], 16)
    L.marker([lat, lng], { icon: pinIcon() }).addTo(m)
    return () => { m.remove() }
  }, [])

  return <div ref={el} style={{ width: '100%', height: '100%' }} />
}
