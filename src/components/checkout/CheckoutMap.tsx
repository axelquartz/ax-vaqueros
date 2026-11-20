'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Vuela suavemente al nuevo centro cuando cambian las coords
function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], 16, { duration: 0.8 })
  }, [lat, lng, map])
  return null
}

export function CheckoutMap({ lat, lng }: { lat: number; lng: number }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Fix Leaflet default icon path (Next.js / Webpack/Turbopack)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })
    setMounted(true)
  }, [])

  if (!mounted) return null

  // Definido dentro del componente para evitar ejecución a nivel de módulo en SSR
  const pinIcon = L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center">
      <div style="width:14px;height:14px;background:#C9A96E;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.6)"></div>
      <div style="width:2px;height:10px;background:#C9A96E;margin-top:-1px"></div>
    </div>`,
    iconSize:   [14, 24],
    iconAnchor: [7, 24],
  })

  return (
    <div className="rounded-xl overflow-hidden border border-border h-44">
      <MapContainer
        center={[lat, lng]}
        zoom={16}
        scrollWheelZoom={false}
        zoomControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        />
        <FlyTo lat={lat} lng={lng} />
        <Marker position={[lat, lng]} icon={pinIcon} />
      </MapContainer>
    </div>
  )
}
