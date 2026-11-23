'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { createDarkMap } from '@/lib/leaflet'
import businessData from '@/data/business.json'
import type { Rider } from '@/hooks/useRiders'
import type { Order } from '@/types/order'

const RESTAURANT = businessData.coords
/** Sin señal por más de 2 min: el repartidor dejó de compartir o perdió cobertura */
const STALE_MS = 2 * 60_000

const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)

const restaurantIcon = () => L.divIcon({
  className: '',
  html: `<div style="background:#14100D;border:1px solid #C49B6C;padding:4px 8px;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.6);line-height:0"><img src="/images/brand/logo-small.png" alt="Vaquero's" style="height:16px;width:auto;display:block" /></div>`,
  iconSize: [56, 28], iconAnchor: [28, 14],
})

const riderIcon = (label: string, stale: boolean) => L.divIcon({
  className: '',
  html: `<div style="display:flex;flex-direction:column;align-items:center;gap:1px;opacity:${stale ? 0.45 : 1}">
    <div style="background:#C49B6C;color:#14100D;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.5)">${esc(label)}</div>
    <div style="font-size:24px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))">🛵</div>
  </div>`,
  iconSize: [100, 42], iconAnchor: [50, 42],
})

const destIcon = () => L.divIcon({
  className: '',
  html: `<div style="width:12px;height:12px;background:#6DB38A;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.6)"></div>`,
  iconSize: [12, 12], iconAnchor: [6, 6],
})

interface Props {
  /** Pedidos a domicilio en camino */
  orders: Order[]
  riders: Rider[]
  now: number
}

/** Mapa en vivo del panel: dónde va cada repartidor y a qué entrega */
export function LiveRidersMap({ orders, riders, now }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const framedFor = useRef('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!el.current) return
    const m = createDarkMap(el.current, [RESTAURANT.lat, RESTAURANT.lng], 13)
    layer.current = L.layerGroup().addTo(m)
    map.current = m
    setReady(true)
    return () => { m.remove(); map.current = null; layer.current = null; framedFor.current = ''; setReady(false) }
  }, [])

  useEffect(() => {
    const m = map.current, g = layer.current
    if (!ready || !m || !g) return
    g.clearLayers()
    const pts: L.LatLngTuple[] = [[RESTAURANT.lat, RESTAURANT.lng]]
    L.marker([RESTAURANT.lat, RESTAURANT.lng], { icon: restaurantIcon() }).addTo(g)

    for (const o of orders) {
      const { lat, lng } = o.customer
      const dest: L.LatLngTuple | null = lat != null && lng != null ? [lat, lng] : null
      if (dest) {
        L.marker(dest, { icon: destIcon() }).bindPopup(`${esc(o.id)} · ${esc(o.customer.name)}`).addTo(g)
        pts.push(dest)
      }
      if (o.rider) {
        const name = riders.find(r => r.userId === o.riderId)?.name || 'Repartidor'
        const stale = now - new Date(o.rider.at).getTime() > STALE_MS
        const pos: L.LatLngTuple = [o.rider.lat, o.rider.lng]
        L.marker(pos, { icon: riderIcon(`${name} · ${o.id}`, stale), zIndexOffset: 1000 }).addTo(g)
        if (dest) L.polyline([pos, dest], { color: '#C49B6C', weight: 2, dashArray: '4 6', opacity: 0.6 }).addTo(g)
        pts.push(pos)
      }
    }
    // Encuadrar al cambiar el conjunto de entregas (no en cada movimiento, para no pelear con el zoom del usuario)
    const key = orders.map(o => `${o.id}:${o.rider ? 1 : 0}`).sort().join('|')
    if (framedFor.current !== key) {
      framedFor.current = key
      m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 15 })
    }
  }, [orders, riders, now, ready])

  const live = orders.filter(o => o.rider).length
  return (
    <section aria-label="Repartidores en vivo" className="bg-surface border border-border rounded-2xl overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <h2 className="text-sm font-semibold text-foreground">Repartidores en camino</h2>
        <p className="text-muted text-xs tabular">
          {orders.length} {orders.length === 1 ? 'entrega' : 'entregas'}
          {orders.length > 0 && ` · ${live} con ubicación`}
        </p>
      </header>
      <div className="h-72">
        <div ref={el} style={{ width: '100%', height: '100%', background: '#161616' }} />
      </div>
    </section>
  )
}
