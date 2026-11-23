'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { createDarkMap, pinIcon } from '@/lib/leaflet'
import businessData from '@/data/business.json'

type Point = { lat: number; lng: number }

interface CheckoutMapProps {
  /** Punto de entrega elegido (null: aún no marca nada) */
  point: Point | null
  /** El cliente tocó el mapa o arrastró el pin */
  onPick: (lat: number, lng: number) => void
}

/**
 * Mapa del checkout: el cliente marca su puerta tocando el mapa o arrastrando
 * el pin. Ese punto es el que usa el repartidor (OSM no tiene números de casa).
 */
export function CheckoutMap({ point, onPick }: CheckoutMapProps) {
  const el     = useRef<HTMLDivElement>(null)
  const map    = useRef<L.Map | null>(null)
  const marker = useRef<L.Marker | null>(null)
  const latest = useRef({ point, onPick })
  useEffect(() => { latest.current = { point, onPick } })

  const place = (m: L.Map, lat: number, lng: number) => {
    if (marker.current) {
      marker.current.setLatLng([lat, lng])
      return
    }
    marker.current = L.marker([lat, lng], { icon: pinIcon(), draggable: true, autoPan: true }).addTo(m)
    marker.current.on('dragend', () => {
      const p = marker.current!.getLatLng()
      latest.current.onPick(p.lat, p.lng)
    })
  }

  // Crear / destruir el mapa (ver nota en src/lib/leaflet.ts)
  useEffect(() => {
    if (!el.current) return
    const { point } = latest.current
    const start = point ?? businessData.coords
    const m = createDarkMap(el.current, [start.lat, start.lng], point ? 17 : 13)
    if (point) place(m, point.lat, point.lng)
    m.on('click', (e: L.LeafletMouseEvent) => {
      place(m, e.latlng.lat, e.latlng.lng)
      latest.current.onPick(e.latlng.lat, e.latlng.lng)
    })
    map.current = m
    return () => {
      m.remove()
      map.current = null
      marker.current = null
    }
  }, [])

  // Punto nuevo desde fuera (sugerencia o GPS): mover el pin y volar ahí
  const lat = point?.lat
  const lng = point?.lng
  useEffect(() => {
    const m = map.current
    if (!m || lat == null || lng == null) return
    const current = marker.current?.getLatLng()
    if (current && current.lat === lat && current.lng === lng) return // lo movió el propio cliente
    place(m, lat, lng)
    m.flyTo([lat, lng], Math.max(m.getZoom(), 17), { duration: 0.8 })
  }, [lat, lng])

  return (
    <div className="space-y-1.5">
      <div className="rounded-xl overflow-hidden border border-border h-52">
        <div ref={el} style={{ width: '100%', height: '100%' }} />
      </div>
      <p className="text-muted text-xs">
        {point ? 'Arrastra el pin o toca el mapa para marcar tu puerta exacta.' : 'Toca el mapa para marcar dónde entregamos.'}
      </p>
    </div>
  )
}
