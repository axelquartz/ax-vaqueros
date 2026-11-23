'use client'

import { useEffect, useMemo, useState } from 'react'
import menuData from '@/data/menu.json'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { applyOverrides, type ProductOverride } from '@/lib/menuState'
import type { Product } from '@/types/menu'

const catalog = menuData.products as Product[]
const categories = menuData.categories.filter(c => c.id !== 'todos')

/** Precios y disponibilidad del día: se guardan al cambiar y se ven al instante en el menú */
export function MenuEditor() {
  const [overrides, setOverrides] = useState<ProductOverride[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const online = isSupabaseConfigured()

  useEffect(() => {
    if (!online) return
    void getBrowserSupabase().from('product_overrides').select('product_id, price, available')
      .then(({ data }) => setOverrides((data ?? []).map(r => ({ productId: r.product_id, price: r.price, available: r.available }))))
  }, [online])

  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(null), 2500)
    return () => clearTimeout(t)
  }, [saved])

  const current = useMemo(() => applyOverrides(overrides), [overrides])

  async function save(product: Product, patch: { price?: number | null; available?: boolean | null }) {
    const prev = overrides
    const existing = overrides.find(o => o.productId === product.id) ?? { productId: product.id, price: null, available: null }
    const next = { ...existing, ...patch }
    setOverrides([...overrides.filter(o => o.productId !== product.id), next])
    setError(null)
    const { error } = await getBrowserSupabase().from('product_overrides').upsert({
      product_id: product.id, price: next.price, available: next.available, updated_at: new Date().toISOString(),
    })
    if (error) {
      setOverrides(prev)
      setError(`No se pudo guardar ${product.name}. Revisa tu conexión.`)
      return
    }
    setSaved(`${product.name} actualizado`)
  }

  if (!online) {
    return <p className="max-w-3xl mx-auto px-4 py-10 text-warning text-sm">El editor de menú necesita Supabase configurado.</p>
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="font-display text-[1.625rem] font-bold leading-none text-foreground">Menú</h1>
        <p className="text-muted text-sm mt-1.5">Marca lo que se agotó o cambia un precio. Se refleja al instante para tus clientes.</p>
      </div>
      {error && <p role="alert" className="text-error text-sm bg-error/10 border border-error/25 rounded-lg px-3 py-2">{error}</p>}

      {categories.map(cat => {
        const list = current.filter(p => p.categoryId === cat.id)
        if (list.length === 0) return null
        return (
          <section key={cat.id} aria-label={cat.label} className="space-y-2">
            <h2 className="text-sm font-semibold text-secondary">{cat.emoji} {cat.label}</h2>
            <ul className="bg-surface border border-border rounded-2xl divide-y divide-border-subtle">
              {list.map(p => {
                const base = catalog.find(c => c.id === p.id)!
                return (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm truncate ${p.available ? 'text-foreground' : 'text-muted line-through'}`}>{p.name}</p>
                      {p.price !== base.price && <p className="text-muted text-xs">Precio base ${base.price}</p>}
                    </div>
                    <label className="flex items-center gap-1 text-muted text-sm">
                      $
                      <input
                        key={p.price}
                        type="number" inputMode="numeric" min={0} max={100000}
                        defaultValue={p.price}
                        aria-label={`Precio de ${p.name}`}
                        onBlur={e => {
                          const v = Number(e.target.value)
                          if (!Number.isInteger(v) || v < 0 || v === p.price) { e.target.value = String(p.price); return }
                          void save(base, { price: v === base.price ? null : v })
                        }}
                        className="w-20 min-h-10 rounded-lg border border-border bg-elevated px-2 text-foreground text-sm tabular"
                      />
                    </label>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={p.available}
                      aria-label={`${p.name} disponible`}
                      onClick={() => void save(base, { available: p.available ? false : null })}
                      className={[
                        'shrink-0 min-h-10 px-3 rounded-full text-xs font-medium border transition-colors',
                        p.available ? 'bg-success/10 border-success/30 text-success' : 'bg-error/10 border-error/30 text-error',
                      ].join(' ')}
                    >
                      {p.available ? 'Disponible' : 'Agotado'}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}

      {saved && (
        <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full border border-border bg-elevated px-4 py-2.5 text-sm text-foreground shadow-lg animate-fade-up">
          ✓ {saved}
        </div>
      )}
    </div>
  )
}
