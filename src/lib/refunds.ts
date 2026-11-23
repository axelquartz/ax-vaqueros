export const MIN_REASON = 5
export const MAX_REASON = 500

export type RefundStatus = 'requested' | 'processing' | 'approved' | 'rejected' | 'failed'

export const REFUND_LABEL: Record<RefundStatus, string> = {
  requested: 'Solicitud en revisión',
  processing: 'Procesando reembolso',
  approved: 'Reembolso aprobado',
  rejected: 'Solicitud rechazada',
  failed: 'Solicitud en revisión',
}

/** Motivo obligatorio (5–500 caracteres) */
export function parseRefundReason(body: unknown): string | null {
  const r = (body as { reason?: unknown } | null)?.reason
  if (typeof r !== 'string') return null
  const reason = r.trim()
  return reason.length >= MIN_REASON ? reason.slice(0, MAX_REASON) : null
}

/** Decisión del admin; el motivo del rechazo es opcional */
export function parseRefundDecision(body: unknown): { action: 'approve' | 'reject'; note: string } | null {
  const b = body as { action?: unknown; note?: unknown } | null
  if (b?.action !== 'approve' && b?.action !== 'reject') return null
  const note = typeof b.note === 'string' ? b.note.trim().slice(0, 500) : ''
  return { action: b.action, note }
}
