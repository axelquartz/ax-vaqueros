'use client'

import { useState, useEffect, useRef } from 'react'
import { reverseGeocode, searchAddress, type AddressSuggestion } from '@/lib/geocode'

interface Props {
  value:    string
  onChange: (value: string) => void
  /** Sugerencia elegida o ubicación del GPS: texto + punto en el mapa */
  onSelect: (address: string, lat: number, lng: number) => void
  error?:   string
}

function locateError(err: GeolocationPositionError): string {
  if (err.code === err.PERMISSION_DENIED) return 'Permite el acceso a tu ubicación, o marca tu casa en el mapa.'
  return 'No pudimos obtener tu ubicación. Búscala o márcala en el mapa.'
}

export function AddressAutocomplete({ value, onChange, onSelect, error }: Props) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [open,        setOpen]        = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [locating,    setLocating]    = useState(false)
  const [locateMsg,   setLocateMsg]   = useState<string | null>(null)
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  /** El texto vino de una selección (no buscar otra vez) */
  const selectedRef  = useRef<string | null>(null)

  // Debounce — busca 400 ms después de que el cliente deja de escribir
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value || value.length < 3 || value === selectedRef.current) return

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const results = await searchAddress(value)
      setSuggestions(results)
      setOpen(results.length > 0)
      setLoading(false)
    }, 400)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [value])

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (s: AddressSuggestion) => {
    selectedRef.current = s.label
    onSelect(s.label, s.lat, s.lng)
    setOpen(false)
    setSuggestions([])
  }

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocateMsg('Tu navegador no comparte ubicación. Marca tu casa en el mapa.')
      return
    }
    setLocating(true)
    setLocateMsg(null)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        const label = (await reverseGeocode(lat, lng)) ?? value
        selectedRef.current = label
        onSelect(label, lat, lng)
        setLocating(false)
        setLocateMsg('Listo. Agrega tu número y revisa el pin en el mapa.')
      },
      err => {
        setLocating(false)
        setLocateMsg(locateError(err))
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    )
  }

  return (
    <div ref={containerRef} className="relative space-y-2">
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="delivery-address" className="text-xs font-medium text-secondary">Dirección de entrega</label>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="text-brand text-xs font-medium hover:text-brand-light disabled:opacity-60 transition-colors"
          >
            {locating ? 'Ubicando…' : '📍 Usar mi ubicación actual'}
          </button>
        </div>
        <div className="relative">
          <input
            id="delivery-address"
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder="Calle, número y colonia"
            autoComplete="street-address"
            className={[
              'w-full bg-surface border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted',
              'focus:outline-none focus:border-brand transition-colors',
              error ? 'border-error' : 'border-border',
            ].join(' ')}
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-3.5 h-3.5 border border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        {error && <p className="text-xs text-error">{error}</p>}
        {locateMsg && <p role="status" className="text-xs text-secondary">{locateMsg}</p>}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-[1100] top-full mt-1 w-full bg-elevated border border-border rounded-xl shadow-xl overflow-hidden">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={() => handleSelect(s)}
                className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-overlay transition-colors border-b border-border last:border-0 leading-snug"
              >
                <span className="mr-1.5 text-xs">📍</span>{s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
