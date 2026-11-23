/**
 * Lo que el cliente lee en cada etapa de su pedido. El texto depende de cómo
 * recibe el pedido (recoger, mesa o domicilio).
 */
export interface StatusCopy {
  title: string
  detail: string
}

const COPY: Record<string, StatusCopy> = {
  pending:   { title: 'Recibimos tu pedido',      detail: 'En un momento lo confirmamos.' },
  confirmed: { title: 'Pedido confirmado',        detail: 'Ya está en la fila de la cocina.' },
  preparing: { title: 'Lo estamos preparando',    detail: 'Nuestro equipo ya está cocinando tu pedido.' },
  delivered: { title: '¡Buen provecho!',          detail: 'Gracias por tu pedido.' },
  cancelled: { title: 'Pedido cancelado',         detail: 'Si tienes dudas, llámanos y con gusto te ayudamos.' },
}

const READY: Record<string, StatusCopy> = {
  pickup:   { title: '¡Listo para recoger!', detail: 'Pasa al mostrador y menciona tu folio.' },
  table:    { title: '¡Va para tu mesa!',    detail: 'En un momento te lo llevamos.' },
  delivery: { title: 'Va en camino',         detail: 'Tu repartidor ya salió con tu pedido.' },
}

export function statusCopy(status: string, deliveryMethod: string): StatusCopy {
  if (status === 'ready') return READY[deliveryMethod] ?? READY.pickup
  return COPY[status] ?? COPY.pending
}

/** "12:31 p.m." en la zona del restaurante */
export function formatStatusTime(iso: string, timeZone = 'America/Mexico_City'): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', timeZone })
}
