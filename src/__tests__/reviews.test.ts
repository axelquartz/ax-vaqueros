import { isHappy, parseReview } from '@/lib/reviews'

describe('reseñas', () => {
  it('acepta calificación 1–5 y recorta el comentario', () => {
    expect(parseReview({ rating: 5 })).toEqual({ rating: 5, comment: '' })
    expect(parseReview({ rating: 2, comment: '  frío  ' })).toEqual({ rating: 2, comment: 'frío' })
    expect(parseReview({ rating: 3, comment: 'x'.repeat(900) })?.comment).toHaveLength(500)
  })
  it('rechaza calificaciones inválidas', () => {
    for (const rating of [0, 6, 2.5, '5', null, undefined]) expect(parseReview({ rating })).toBeNull()
    expect(parseReview(null)).toBeNull()
  })
  it('4–5 es feliz; 1–3 no', () => {
    expect([1, 2, 3, 4, 5].map(isHappy)).toEqual([false, false, false, true, true])
  })
})
