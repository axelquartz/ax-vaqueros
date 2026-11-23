'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { createDarkMap } from '@/lib/leaflet'
import businessData from '@/data/business.json'
import type { RiderLocation } from '@/types/order'

type Point = { lat: number; lng: number }

const RESTAURANT: Point = businessData.coords

/** Ubicación de más de 2 min: el repartidor dejó de compartir o perdió señal */
const STALE_MS = 2 * 60_000

// ─── Íconos (se crean en el cliente, nunca a nivel de módulo en SSR) ──
const restaurantIcon = () => L.divIcon({
  className: '',
  html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
    <div style="background:#14100D;border:1px solid #C49B6C;padding:5px 10px;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.6);line-height:0">
      <img src="/images/brand/logo-small.png" alt="Vaquero's" style="height:18px;width:auto;display:block" />
    </div>
    <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid #C49B6C"></div>
  </div>`,
  iconSize:   [62, 36],
  iconAnchor: [31, 36],
})

const customerIcon = () => L.divIcon({
  className: '',
  html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
    <div style="background:#6DB38A;color:#14100D;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.5)">Tu dirección</div>
    <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid #6DB38A"></div>
  </div>`,
  iconSize:   [90, 32],
  iconAnchor: [45, 32],
})

const riderIcon = () => L.divIcon({
  className: '',
  html: `<div style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6));transform:translateY(-8px)">🛵</div>`,
  iconSize:   [32, 32],
  iconAnchor: [16, 32],
})

function agoText(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 15) return 'hace un momento'
  if (s < 60) return `hace ${s} s`
  return `hace ${Math.round(s / 60)} min`
}

interface OrderMapProps {
  /** Punto de entrega elegido en el checkout */
  destination?: Point
  /** Ubicación real del repartidor (solo mientras va en camino) */
  rider?: RiderLocation
  /** El pedido ya salió (estatus "En camino") */
  onTheWay: boolean
  /** Sin backend (demo): simular el recorrido */
  simulate?: boolean
}

export function OrderMap({ destination, rider, onTheWay, simulate = false }: OrderMapProps) {
  const el          = useRef<HTMLDivElement>(null)
  const map         = useRef<L.Map | null>(null)
  const riderMarker = useRef<L.Marker | null>(null)
  const framed      = useRef(false)
  const [now, setNow] = useState(() => Date.now())
  const [simProgress, setSimProgress] = useState(0.08)

  // Punto actual del repartidor: real, o simulado en modo demo
  const target = destination ?? (simulate ? { lat: RESTAURANT.lat + 0.011, lng: RESTAURANT.lng - 0.013 } : undefined)
  const riderPoint: Point | undefined = rider
    ? rider
    : simulate && target
      ? { lat: RESTAURANT.lat + (target.lat - RESTAURANT.lat) * simProgress, lng: RESTAURANT.lng + (target.lng - RESTAURANT.lng) * simProgress }
      : undefined

  const latest = useRef({ target, riderPoint })
  useEffect(() => { latest.current = { target, riderPoint } })

  // Crear / destruir el mapa (ver nota en src/lib/leaflet.ts)
  useEffect(() => {
    if (!el.current) return
    const { target } = latest.current
    const m = createDarkMap(el.current, [RESTAURANT.lat, RESTAURANT.lng], 14)
    L.marker([RESTAURANT.lat, RESTAURANT.lng], { icon: restaurantIcon() }).bindPopup("Vaquero's").addTo(m)
    if (target) {
      L.marker([target.lat, target.lng], { icon: customerIcon() }).bindPopup('Tu dirección').addTo(m)
      m.fitBounds(L.latLngBounds([[RESTAURANT.lat, RESTAURANT.lng], [target.lat, target.lng]]), { padding: [40, 40], maxZoom: 15 })
    }
    map.current = m
    framed.current = false
    return () => {
      m.remove()
      map.current = null
      riderMarker.current = null
    }
  }, [])

  // Mover el marcador del repartidor
  const riderLat = riderPoint?.lat
  const riderLng = riderPoint?.lng
  useEffect(() => {
    const m = map.current
    if (!m || riderLat == null || riderLng == null) return
    const pos: L.LatLngTuple = [riderLat, riderLng]
    if (!riderMarker.current) {
      riderMarker.current = L.marker(pos, { icon: riderIcon(), zIndexOffset: 1000 }).bindPopup('Tu repartidor').addTo(m)
    } else {
      riderMarker.current.setLatLng(pos)
    }
    // Primera ubicación: encuadrar repartidor + destino; después solo seguirlo si sale de vista
    const { target } = latest.current
    if (!framed.current) {
      framed.current = true
      const pts: L.LatLngTuple[] = [pos, target ? [target.lat, target.lng] : [RESTAURANT.lat, RESTAURANT.lng]]
      m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 16 })
    } else if (!m.getBounds().pad(-0.15).contains(pos)) {
      m.panTo(pos, { animate: true, duration: 0.5 })
    }
  }, [riderLat, riderLng])

  // Simulación (demo sin backend)
  useEffect(() => {
    if (!simulate || !onTheWay) return
    const id = setInterval(() => setSimProgress(p => Math.min(p + 0.004, 1)), 300)
    return () => clearInterval(id)
  }, [simulate, onTheWay])

  // Reloj para "actualizado hace…"
  useEffect(() => {
    if (!rider) return
    const id = setInterval(() => setNow(Date.now()), 5_000)
    return () => clearInterval(id)
  }, [rider])

  const age = rider ? now - new Date(rider.at).getTime() : 0
  const caption = simulate
    ? 'Simulación del recorrido (modo demo)'
    : !onTheWay
      ? 'Verás a tu repartidor aquí en cuanto salga con tu pedido.'
      : !rider
        ? 'Tu pedido va en camino. Esperando la ubicación del repartidor…'
        : age > STALE_MS
          ? `Última ubicación del repartidor ${agoText(age)}`
          : `Ubicación del repartidor · ${agoText(age)}`

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="h-56">
        <div ref={el} style={{ width: '100%', height: '100%', background: '#161616' }} />
      </div>
      <p role="status" className="px-4 py-2.5 text-secondary text-xs border-t border-border">{caption}</p>
    </div>
  )
}
