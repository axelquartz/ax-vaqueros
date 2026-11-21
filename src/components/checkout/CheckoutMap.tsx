'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { createDarkMap, pinIcon } from '@/lib/leaflet'

export function CheckoutMap({ lat, lng }: { lat: number; lng: number }) {
  const el     = useRef<HTMLDivElement>(null)
  const map    = useRef<L.Map | null>(null)
  const marker = useRef<L.Marker | null>(null)
  // Coordenadas actuales, para crear el mapa donde toca al (re)montar
  const coords = useRef({ lat, lng })
  useEffect(() => { coords.current = { lat, lng } })

  // Crear / destruir el mapa
  useEffect(() => {
    if (!el.current) return
    const { lat, lng } = coords.current
    const m = createDarkMap(el.current, [lat, lng], 16)
    marker.current = L.marker([lat, lng], { icon: pinIcon() }).addTo(m)
    map.current = m
    return () => {
      m.remove()
      map.current = null
      marker.current = null
    }
  }, [])

  // Volar suavemente cuando cambian las coordenadas
  useEffect(() => {
    if (!map.current) return
    marker.current?.setLatLng([lat, lng])
    map.current.flyTo([lat, lng], 16, { duration: 0.8 })
  }, [lat, lng])

  return (
    <div className="rounded-xl overflow-hidden border border-border h-44">
      <div ref={el} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
