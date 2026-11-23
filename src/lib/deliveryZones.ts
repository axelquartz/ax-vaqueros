import businessData from '@/data/business.json'

/**
 * Envío por distancia. Tramos [{ km, fee }]: el cliente paga el `fee` del primer
 * tramo cuyo `km` alcance su distancia; el último tramo es el límite de cobertura.
 *
 * La distancia es aproximada: línea recta desde el local × 1.3 (factor de rodeo
 * urbano). Es estable, gratis y no depende de un servicio externo al cotizar.
 */
export interface DeliveryTier { km: number; fee: number }
export interface Point { lat: number; lng: number }

export const DEFAULT_TIERS: DeliveryTier[] = [{ km: 8, fee: 45 }]
export const ROAD_FACTOR = 1.3
export const MAX_TIERS = 10
export const MAX_KM = 50
export const MAX_FEE = 500

export function haversineKm(a: Point, b: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** Distancia aproximada por calle desde el local */
export function deliveryKm(point: Point, origin: Point = businessData.coords): number {
  return haversineKm(origin, point) * ROAD_FACTOR
}

/** Costo según la distancia; null = fuera de cobertura */
export function feeForDistance(tiers: DeliveryTier[], km: number): number | null {
  const tier = [...tiers].sort((a, b) => a.km - b.km).find(t => km <= t.km)
  return tier ? tier.fee : null
}

export const maxCoverageKm = (tiers: DeliveryTier[]) => Math.max(...tiers.map(t => t.km))

/** Valida y normaliza tramos (de la base o del editor); null si son inválidos */
export function parseTiers(value: unknown): DeliveryTier[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_TIERS) return null
  const tiers: DeliveryTier[] = []
  for (const t of value) {
    const km = Number((t as DeliveryTier)?.km)
    const fee = Number((t as DeliveryTier)?.fee)
    if (!Number.isFinite(km) || km <= 0 || km > MAX_KM) return null
    if (!Number.isInteger(fee) || fee < 0 || fee > MAX_FEE) return null
    tiers.push({ km: Math.round(km * 10) / 10, fee })
  }
  tiers.sort((a, b) => a.km - b.km)
  for (let i = 1; i < tiers.length; i++) if (tiers[i].km === tiers[i - 1].km) return null
  return tiers
}

/** Punto dentro de México; cualquier otra cosa se descarta */
export function validPoint(lat: unknown, lng: unknown): Point | null {
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < 14 || lat > 33 || lng < -119 || lng > -86) return null
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 }
}
