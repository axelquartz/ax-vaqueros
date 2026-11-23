import L from 'leaflet'

// Mosaicos estándar de OpenStreetMap (gratis, sin llave; uso ligero con atribución).
// CARTO dark_all empezó a exigir API key (nov 2026). El tema oscuro se logra
// con un filtro CSS sobre los mosaicos (.map-tiles-dark en globals.css).
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

/**
 * Crea un mapa Leaflet con el estilo oscuro de la marca.
 *
 * Los mapas se manejan de forma imperativa (crear en un efecto, `map.remove()`
 * en su cleanup) en lugar de con react-leaflet: con `cacheComponents`, Next
 * oculta las páginas visitadas con <Activity>, lo que ejecuta los cleanups y
 * vuelve a correr los efectos al regresar. react-leaflet reutilizaba un mapa
 * ya destruido y fallaba con "Cannot read properties of undefined (reading
 * 'appendChild')". Así, cada vez que la página se muestra hay un mapa nuevo.
 */
export function createDarkMap(el: HTMLElement, center: L.LatLngExpression, zoom: number): L.Map {
  const map = L.map(el, { center, zoom, scrollWheelZoom: false, zoomControl: false })
  L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19, className: 'map-tiles-dark' }).addTo(map)
  return map
}

export function pinIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center">
      <div style="width:14px;height:14px;background:#C49B6C;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.6)"></div>
      <div style="width:2px;height:10px;background:#C49B6C;margin-top:-1px"></div>
    </div>`,
    iconSize:   [14, 24],
    iconAnchor: [7, 24],
  })
}
