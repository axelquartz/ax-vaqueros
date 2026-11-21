'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { createDarkMap } from '@/lib/leaflet'

// ─── Coordenadas mock — Monterrey ─────────────────────────
const RESTAURANT = { lat: 25.6866, lng: -100.3161 }
const CUSTOMER   = { lat: 25.6980, lng: -100.3295 }
const CENTER: [number, number] = [(RESTAURANT.lat + CUSTOMER.lat) / 2, (RESTAURANT.lng + CUSTOMER.lng) / 2]

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function riderPosition(progress: number): [number, number] {
  return [lerp(RESTAURANT.lat, CUSTOMER.lat, progress), lerp(RESTAURANT.lng, CUSTOMER.lng, progress)]
}

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

// ─── Mapa con simulación del repartidor ───────────────────
export function OrderMap() {
  const el    = useRef<HTMLDivElement>(null)
  const map   = useRef<L.Map | null>(null)
  const rider = useRef<L.Marker | null>(null)
  const [progress, setProgress] = useState(0.08)
  const progressRef = useRef(progress)
  useEffect(() => { progressRef.current = progress })

  // Crear / destruir el mapa (ver nota en src/lib/leaflet.ts)
  useEffect(() => {
    if (!el.current) return
    const m = createDarkMap(el.current, CENTER, 14)
    L.marker([RESTAURANT.lat, RESTAURANT.lng], { icon: restaurantIcon() }).bindPopup("Vaquero's").addTo(m)
    L.marker([CUSTOMER.lat, CUSTOMER.lng], { icon: customerIcon() }).bindPopup('Tu dirección').addTo(m)
    rider.current = L.marker(riderPosition(progressRef.current), { icon: riderIcon() })
      .bindPopup('Repartidor en camino')
      .addTo(m)
    map.current = m
    return () => {
      m.remove()
      map.current = null
      rider.current = null
    }
  }, [])

  // Simulación: el repartidor avanza hacia el cliente
  useEffect(() => {
    const id = setInterval(() => {
      setProgress(p => (p >= 1 ? 1 : Math.min(p + 0.004, 1)))
    }, 300)
    return () => clearInterval(id)
  }, [])

  // Mover el marcador y seguirlo con la cámara
  useEffect(() => {
    const pos = riderPosition(progress)
    rider.current?.setLatLng(pos)
    map.current?.panTo(pos, { animate: true, duration: 0.5 })
  }, [progress])

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden h-56">
      <div ref={el} style={{ width: '100%', height: '100%', background: '#161616' }} />
    </div>
  )
}
