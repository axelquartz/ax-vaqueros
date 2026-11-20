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
  // Photon (OpenStreetMap) — gratis, sin API key, bbox = México
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=es&bbox=-117.12,14.53,-86.74,32.72`
  try {
    const res  = await fetch(url)
    const data = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.features.map((f: any) => {
      const p = f.properties
      const parts = [
        p.street ? (p.housenumber ? `${p.street} ${p.housenumber}` : p.street) : null,
        p.name && p.name !== p.street ? p.name : null,
        p.city || p.town || p.village,
        p.state,
        p.country,
      ].filter(Boolean)
      return {
        label: parts.join(', '),
        lat:   f.geometry.coordinates[1],
        lng:   f.geometry.coordinates[0],
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
