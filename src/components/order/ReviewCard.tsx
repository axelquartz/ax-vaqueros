'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import business from '@/data/business.json'
import { Button } from '@/components/ui/Button'
import { findOrderToken } from '@/lib/orderHistory'
import { ORDER_TOKEN_HEADER } from '@/lib/orders/customerApi'
import { isHappy, MAX_COMMENT } from '@/lib/reviews'

const noop = () => () => {}

/** Calificación 1–5 al entregarse el pedido. 4–5 invita a Google; menos pide un comentario privado */
export function ReviewCard({ folio }: { folio: string }) {
  const token = useSyncExternalStore(noop, () => findOrderToken(folio), () => undefined)
  const [loaded, setLoaded] = useState(false)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const headers = token ? { [ORDER_TOKEN_HEADER]: token } : undefined

  useEffect(() => {
    if (!headers) return
    let cancelled = false
    fetch(`/api/orders/${encodeURIComponent(folio)}/review`, { headers, cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelled) return
        if (d?.review) { setRating(d.review.rating); setComment(d.review.comment ?? ''); setSent(true) }
        setLoaded(true)
      })
      .catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folio, token])

  if (!token || !loaded) return null

  async function submit(nextRating: number, nextComment: string) {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(folio)}/review`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: nextRating, comment: nextComment }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'No se pudo enviar')
      setRating(nextRating); setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar. Intenta de nuevo.')
    } finally { setBusy(false) }
  }

  const googleUrl = business.googleReviewUrl
  const stars = (
    <div role="radiogroup" aria-label="Calificación" className="flex justify-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
          disabled={busy}
          onClick={() => { setRating(n); setSent(false); if (isHappy(n)) void submit(n, '') }}
          className={`size-11 text-3xl leading-none transition-colors ${n <= rating ? 'text-brand' : 'text-border-strong hover:text-brand-muted'}`}
        >★</button>
      ))}
    </div>
  )

  return (
    <section aria-label="Califica tu pedido" className="bg-surface border border-border rounded-xl p-5 text-center space-y-3">
      <p className="text-foreground text-sm font-semibold">{sent ? '¡Gracias por tu opinión!' : '¿Cómo estuvo tu pedido?'}</p>
      {stars}

      {rating > 0 && !isHappy(rating) && !(sent && !comment) && (
        <div className="space-y-2 text-left">
          <label htmlFor="review-comment" className="text-secondary text-sm">
            {sent ? 'Tu comentario' : 'Lamentamos que no haya sido perfecto. ¿Qué podemos mejorar?'}
          </label>
          <textarea
            id="review-comment" value={comment} maxLength={MAX_COMMENT} rows={3} disabled={sent}
            onChange={e => setComment(e.target.value)}
            className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-foreground text-sm"
          />
          {!sent && <Button fullWidth onClick={() => void submit(rating, comment)} disabled={busy}>Enviar comentario</Button>}
        </div>
      )}
      {sent && rating > 0 && !isHappy(rating) && !comment && (
        <Button variant="ghost" onClick={() => setSent(false)}>Agregar un comentario</Button>
      )}

      {sent && isHappy(rating) && googleUrl && (
        <a href={googleUrl} target="_blank" rel="noopener noreferrer"
           className="inline-flex items-center justify-center min-h-11 px-4 rounded-lg bg-brand text-inverse text-sm font-semibold">
          Deja tu reseña en Google
        </a>
      )}
      {sent && !isHappy(rating) && comment && <p className="text-muted text-xs">El dueño lo leerá personalmente.</p>}
      {error && <p role="alert" className="text-error text-xs">{error}</p>}
    </section>
  )
}
