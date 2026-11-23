import type { Order } from '@/types/order'

/**
 * Exportación a CSV (RFC 4180) pensada para Excel/Sheets:
 * - UTF-8 con BOM (acentos correctos en Excel) y saltos de línea CRLF.
 * - Campos con comas, comillas o saltos de línea entre comillas dobles.
 * - Protección contra inyección de fórmulas: texto libre que empiece con = + - @ se prefija con '.
 * - Fechas ISO 8601 en hora local, importes numéricos sin símbolo ni separador de miles.
 */
const METHOD: Record<string, string> = { pickup: 'Mostrador', table: 'Mesa', delivery: 'Domicilio' }
const STATUS: Record<string, string> = {
  pending: 'Recibido', confirmed: 'Confirmado', preparing: 'Preparando', ready: 'Listo', delivered: 'Entregado', cancelled: 'Cancelado',
}

export const CSV_HEADERS = [
  'Folio', 'Fecha', 'Hora', 'Estatus', 'Tipo de pedido', 'Cliente', 'Teléfono', 'Productos',
  'Subtotal', 'Descuento', 'Promoción', 'Envío', 'Total',
]

const pad = (n: number) => String(n).padStart(2, '0')

export function csvCell(value: string | number): string {
  let text = String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function ordersToCsv(orders: Order[]): string {
  const rows = [...orders]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(o => {
      const d = new Date(o.createdAt)
      return [
        o.id,
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        `${pad(d.getHours())}:${pad(d.getMinutes())}`,
        o.refundedAt ? 'Reembolsado' : STATUS[o.status] ?? o.status,
        METHOD[o.deliveryMethod] ?? o.deliveryMethod,
        o.customer.name,
        o.customer.phone,
        o.items.map(i => `${i.quantity}x ${i.name}`).join('; '),
        o.subtotal,
        o.discount ?? 0,
        o.promoName ?? '',
        o.deliveryFee,
        o.total,
      ].map(csvCell).join(',')
    })
  return '﻿' + [CSV_HEADERS.map(csvCell).join(','), ...rows].join('\r\n') + '\r\n'
}
