import businessData from '@/data/business.json'

/**
 * Búsqueda de direcciones.
 *
 * 1. Mapbox (si hay NEXT_PUBLIC_MAPBOX_TOKEN): tiene números de casa, colonia
 *    y CP en Guadalajara.
 * 2. OpenStreetMap (Photon → Nominatim) como respaldo, gratis y sin llave,
 *    pero casi sin números de casa en México.
 *
 * Aun así, lo que manda es el punto: el cliente confirma su puerta en el mapa.
 */

export interface AddressSuggestion {
  label: string
  lat:   number
  lng:   number
}

const CENTER = businessData.coords
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
/** Zona metropolitana de Guadalajara (lon/lat mínimos y máximos) */
const AREA = { minLng: -103.55, minLat: 20.5, maxLng: -103.2, maxLat: 20.85 }

interface PhotonProps {
  name?: string; street?: string; housenumber?: string
  district?: string; locality?: string; city?: string; state?: string; type?: string
}

function photonLabel(p: PhotonProps): string {
  const street = p.street ? [p.street, p.housenumber].filter(Boolean).join(' ') : undefined
  // Para calles el "name" es la calle; para lugares (plazas, edificios) va primero el nombre
  const main = p.type === 'street' ? p.name : [p.name, street].filter(Boolean).join(', ')
  return [main, p.district || p.locality, p.city].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ')
}

async function photon(path: string): Promise<AddressSuggestion[]> {
  const res = await fetch(`https://photon.komoot.io/${path}`)
  if (!res.ok) return []
  const data = (await res.json()) as { features: { geometry: { coordinates: [number, number] }; properties: PhotonProps }[] }
  return data.features.map(f => ({
    label: photonLabel(f.properties),
    lng:   f.geometry.coordinates[0],
    lat:   f.geometry.coordinates[1],
  })).filter(s => s.label)
}

async function nominatim(query: string): Promise<AddressSuggestion[]> {
  const viewbox = `${AREA.minLng},${AREA.maxLat},${AREA.maxLng},${AREA.minLat}`
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=mx&addressdetails=1&viewbox=${viewbox}&bounded=1`,
  )
  if (!res.ok) return []
  const data = (await res.json()) as { lat: string; lon: string; display_name: string; address?: Record<string, string> }[]
  return data.map(r => {
    const a = r.address ?? {}
    const parts = [
      a.road ? [a.road, a.house_number].filter(Boolean).join(' ') : a.amenity || a.shop || a.building,
      a.neighbourhood || a.suburb,
      a.city || a.town || a.municipality,
    ].filter(Boolean)
    return { label: parts.length ? parts.join(', ') : r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) }
  })
}

interface MapboxFeature {
  geometry:   { coordinates: [number, number] }
  properties: { full_address?: string; name?: string; feature_type?: string }
}

/** "Av. X 81, Col, 45140 Zapopan, Jalisco, México" → sin estado ni país */
const mapboxLabel = (p: MapboxFeature['properties']) =>
  (p.full_address ?? p.name ?? '').replace(/, Jalisco, México$/, '').replace(/, México$/, '')

async function mapbox(path: string, params: Record<string, string>): Promise<AddressSuggestion[]> {
  if (!MAPBOX_TOKEN) return []
  const qs = new URLSearchParams({ ...params, country: 'mx', language: 'es', access_token: MAPBOX_TOKEN })
  const res = await fetch(`https://api.mapbox.com/search/geocode/v6/${path}?${qs}`)
  if (!res.ok) return []
  const data = (await res.json()) as { features?: MapboxFeature[] }
  return (data.features ?? []).map(f => ({
    label: mapboxLabel(f.properties),
    lng:   f.geometry.coordinates[0],
    lat:   f.geometry.coordinates[1],
  })).filter(s => s.label)
}

/** Sin duplicados (mismo texto) */
const unique = (list: AddressSuggestion[]) => list.filter((s, i) => list.findIndex(o => o.label === s.label) === i)

export async function searchAddress(query: string): Promise<AddressSuggestion[]> {
  if (query.trim().length < 3) return []
  try {
    const bbox = `${AREA.minLng},${AREA.minLat},${AREA.maxLng},${AREA.maxLat}`
    const exact = await mapbox('forward', {
      q: query, bbox, proximity: `${CENTER.lng},${CENTER.lat}`, limit: '5',
      types: 'address,street,neighborhood,locality,place',
    })
    if (exact.length) return unique(exact).slice(0, 5)
    const found = await photon(`api/?q=${encodeURIComponent(query)}&lat=${CENTER.lat}&lon=${CENTER.lng}&limit=6&bbox=${bbox}`)
    if (found.length) return unique(found).slice(0, 5)
    return unique(await nominatim(query)).slice(0, 5)
  } catch {
    return []
  }
}

/** Calle y colonia de un punto (para "usar mi ubicación" o al mover el pin) */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const [exact] = await mapbox('reverse', { longitude: String(lng), latitude: String(lat), types: 'address', limit: '1' })
    if (exact) return exact.label
    const [first] = await photon(`reverse?lat=${lat}&lon=${lng}&limit=1`)
    return first?.label ?? null
  } catch {
    return null
  }
}

export function isInDeliveryArea(lat: number, lng: number): boolean {
  return lat >= AREA.minLat && lat <= AREA.maxLat && lng >= AREA.minLng && lng <= AREA.maxLng
}
