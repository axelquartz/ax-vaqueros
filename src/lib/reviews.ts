export const MAX_COMMENT = 500

export interface ReviewInput { rating: number; comment: string }

/** Valida lo que manda el cliente: calificación 1–5 y comentario opcional (máx. 500) */
export function parseReview(body: unknown): ReviewInput | null {
  const b = body as { rating?: unknown; comment?: unknown } | null
  const rating = b?.rating
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) return null
  const comment = typeof b?.comment === 'string' ? b.comment.trim().slice(0, MAX_COMMENT) : ''
  return { rating, comment }
}

/** 4 o 5 estrellas: se invita a reseñar en Google; menos: comentario privado para el dueño */
export const isHappy = (rating: number) => rating >= 4
