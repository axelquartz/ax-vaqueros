'use client'

import { useEffect, useState } from 'react'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getBrowserSupabase } from '@/lib/supabase/browser'

interface Review { order_id: string; rating: number; comment: string; created_at: string }

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n)

/** Calificación promedio y comentarios de clientes (los de 1–3 estrellas con texto van primero) */
export function ReviewsPanel() {
  const [reviews, setReviews] = useState<Review[] | null>(null)
  const online = isSupabaseConfigured()

  useEffect(() => {
    if (!online) return
    void getBrowserSupabase().from('reviews').select('order_id, rating, comment, created_at')
      .order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => setReviews((data ?? []) as Review[]))
  }, [online])

  if (!online || reviews === null) return null
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0
  const withComment = reviews.filter(r => r.comment).slice(0, 10)

  return (
    <section aria-label="Reseñas" className="max-w-6xl mx-auto px-4 pb-10 space-y-3">
      <h2 className="font-display text-xl font-bold text-foreground">Reseñas</h2>
      {reviews.length === 0 ? (
        <p className="text-muted text-sm">Aún no hay reseñas. Aparecen cuando un cliente califica un pedido entregado.</p>
      ) : (
        <>
          <p className="text-foreground">
            <span className="font-display text-3xl font-bold tabular">{avg.toFixed(1)}</span>
            <span className="text-brand ml-2" aria-hidden>{stars(Math.round(avg))}</span>
            <span className="text-muted text-sm ml-2">{reviews.length} {reviews.length === 1 ? 'reseña' : 'reseñas'}</span>
          </p>
          {withComment.length > 0 && (
            <ul className="bg-surface border border-border rounded-2xl divide-y divide-border-subtle">
              {withComment.map(r => (
                <li key={r.order_id} className="px-4 py-3 space-y-1">
                  <p className="text-xs text-muted">
                    <span className={r.rating <= 3 ? 'text-warning' : 'text-brand'}>{stars(r.rating)}</span>
                    {' · '}{r.order_id}{' · '}{new Date(r.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                  </p>
                  <p className="text-foreground text-sm">{r.comment}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
