'use client'

import { useState, useEffect, useRef } from 'react'

interface Suggestion {
  label: string
  lat:   number
  lng:   number
}

interface Props {
  value:    string
  onChange: (value: string) => void
  onSelect: (address: string, lat: number, lng: number) => void
  error?:   string
}

async function fetchSuggestions(query: string): Promise<Suggestion[]> {
  if (query.length < 3) return []
  // Nominatim (OpenStreetMap) — gratis, sin API key, filtrado a México
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=mx&addressdetails=1`
  try {
    const res  = await fetch(url, {
      headers: { 'User-Agent': 'ax-vaqueros/1.0 (food ordering app)' },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[] = await res.json()
    return data.map(r => {
      const a = r.address ?? {}
      // Construir etiqueta corta: calle + número + colonia + ciudad + estado
      const parts = [
        a.road        ? (a.house_number ? `${a.road} ${a.house_number}` : a.road) : null,
        a.neighbourhood || a.suburb || a.village || a.town,
        a.city || a.municipality,
        a.state,
      ].filter(Boolean)
      return {
        label: parts.length > 0 ? parts.join(', ') : (r.display_name as string),
        lat:   parseFloat(r.lat),
        lng:   parseFloat(r.lon),
      }
    })
  } catch {
    return []
  }
}

export function AddressAutocomplete({ value, onChange, onSelect, error }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open,        setOpen]        = useState(false)
  const [loading,     setLoading]     = useState(false)
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounce — dispara búsqueda 400 ms después de que el usuario deja de escribir
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value || value.length < 3) { setSuggestions([]); setOpen(false); return }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const results = await fetchSuggestions(value)
      setSuggestions(results)
      setOpen(results.length > 0)
      setLoading(false)
    }, 400)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [value])

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (s: Suggestion) => {
    onChange(s.label)
    onSelect(s.label, s.lat, s.lng)
    setOpen(false)
    setSuggestions([])
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="space-y-1">
        <label className="text-xs font-medium text-secondary">Dirección de entrega</label>
        <div className="relative">
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder="Calle, número, colonia..."
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
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-elevated border border-border rounded-xl shadow-xl overflow-hidden">
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
