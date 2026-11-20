'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// ─── Coordenadas mock — Monterrey ─────────────────────────
const RESTAURANT = { lat: 25.6866, lng: -100.3161 }
const CUSTOMER   = { lat: 25.6980, lng: -100.3295 }

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

// ─── Fix Leaflet default icon path (Next.js / Webpack) ────
function fixLeafletIcons() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

// ─── Actualiza la vista del mapa cuando el rider se mueve ──
function MapPanner({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => { map.panTo(center, { animate: true, duration: 0.5 }) }, [center, map])
  return null
}

// ─── Mapa con animación del repartidor ────────────────────
function DeliveryMap() {
  const [progress, setProgress] = useState(0.08)

  useEffect(() => {
    const id = setInterval(() => {
      setProgress(p => {
        if (p >= 1) { clearInterval(id); return 1 }
        return Math.min(p + 0.004, 1)
      })
    }, 300)
    return () => clearInterval(id)
  }, [])

  const riderPos: [number, number] = [
    lerp(RESTAURANT.lat, CUSTOMER.lat, progress),
    lerp(RESTAURANT.lng, CUSTOMER.lng, progress),
  ]

  const center: [number, number] = [
    (RESTAURANT.lat + CUSTOMER.lat) / 2,
    (RESTAURANT.lng + CUSTOMER.lng) / 2,
  ]

  // Iconos definidos dentro del componente para evitar ejecución a nivel de módulo en SSR
  const restaurantIcon = L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
      <div style="background:#0C0C0C;border:1px solid #C9A96E;padding:5px 10px;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.6);line-height:0">
        <img src="/images/brand/logo-small.png" alt="Vaquero's" style="height:18px;width:auto;display:block" />
      </div>
      <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid #C9A96E"></div>
    </div>`,
    iconSize:   [62, 36],
    iconAnchor: [31, 36],
  })

  const customerIcon = L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
      <div style="background:#4CAF7D;color:#0C0C0C;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.5)">Tu dirección</div>
      <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid #4CAF7D"></div>
    </div>`,
    iconSize:   [90, 32],
    iconAnchor: [45, 32],
  })

  const riderIcon = L.divIcon({
    className: '',
    html: `<div style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6));transform:translateY(-8px)">🛵</div>`,
    iconSize:   [32, 32],
    iconAnchor: [16, 32],
  })

  return (
    <MapContainer
      center={center}
      zoom={14}
      scrollWheelZoom={false}
      zoomControl={false}
      style={{ width: '100%', height: '100%', background: '#161616' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
      />
      <MapPanner center={riderPos} />
      <Marker position={[RESTAURANT.lat, RESTAURANT.lng]} icon={restaurantIcon}>
        <Popup>Vaquero&apos;s</Popup>
      </Marker>
      <Marker position={[CUSTOMER.lat, CUSTOMER.lng]} icon={customerIcon}>
        <Popup>Tu dirección</Popup>
      </Marker>
      <Marker position={riderPos} icon={riderIcon}>
        <Popup>Repartidor en camino</Popup>
      </Marker>
    </MapContainer>
  )
}

// ─── Componente público ───────────────────────────────────
export function OrderMap() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    fixLeafletIcons()
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="bg-surface border border-border rounded-xl overflow-hidden h-56 flex items-center justify-center">
        <span className="text-muted text-xs">Cargando mapa...</span>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden h-56">
      <DeliveryMap />
    </div>
  )
}
