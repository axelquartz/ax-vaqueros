'use client'

import { useEffect, useState } from 'react'
import {
  APIProvider,
  Map,
  AdvancedMarker,
} from '@vis.gl/react-google-maps'

// ─── Coordenadas mock — Monterrey ─────────────────────────
const RESTAURANT: google.maps.LatLngLiteral = { lat: 25.6866, lng: -100.3161 }
const CUSTOMER:   google.maps.LatLngLiteral = { lat: 25.6980, lng: -100.3295 }

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

// ─── Mapa con animación del repartidor ───────────────────
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

  const riderPos: google.maps.LatLngLiteral = {
    lat: lerp(RESTAURANT.lat, CUSTOMER.lat, progress),
    lng: lerp(RESTAURANT.lng, CUSTOMER.lng, progress),
  }

  const center: google.maps.LatLngLiteral = {
    lat: (RESTAURANT.lat + CUSTOMER.lat) / 2,
    lng: (RESTAURANT.lng + CUSTOMER.lng) / 2,
  }

  return (
    <Map
      defaultCenter={center}
      defaultZoom={14}
      mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
      colorScheme="DARK"
      disableDefaultUI
      gestureHandling="cooperative"
      style={{ width: '100%', height: '100%' }}
    >
      {/* Restaurante */}
      <AdvancedMarker position={RESTAURANT} title="Vaquero's">
        <div className="flex flex-col items-center gap-1">
          <div className="bg-brand text-inverse text-xs font-semibold px-2 py-0.5 rounded-full shadow">
            Vaquero's
          </div>
          <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-brand" />
        </div>
      </AdvancedMarker>

      {/* Cliente */}
      <AdvancedMarker position={CUSTOMER} title="Tu dirección">
        <div className="flex flex-col items-center gap-1">
          <div className="bg-success text-inverse text-xs font-semibold px-2 py-0.5 rounded-full shadow">
            Tu dirección
          </div>
          <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-success" />
        </div>
      </AdvancedMarker>

      {/* Repartidor */}
      <AdvancedMarker position={riderPos} title="Repartidor">
        <div className="text-2xl drop-shadow-lg" style={{ transform: 'translateY(-8px)' }}>
          🛵
        </div>
      </AdvancedMarker>
    </Map>
  )
}

// ─── Fallback cuando no hay API key ──────────────────────
function MapPlaceholder() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-elevated">
      <span className="text-3xl">🗺️</span>
      <p className="text-muted text-xs text-center px-4">
        Mapa de seguimiento en vivo
      </p>
      <p className="text-brand text-xs">
        Configura NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      </p>
    </div>
  )
}

// ─── Componente público ───────────────────────────────────
export function OrderMap() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  const hasKey = apiKey && apiKey !== 'REEMPLAZA_CON_TU_API_KEY'

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden h-56">
      {hasKey ? (
        <APIProvider apiKey={apiKey}>
          <DeliveryMap />
        </APIProvider>
      ) : (
        <MapPlaceholder />
      )}
    </div>
  )
}
