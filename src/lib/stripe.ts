import Stripe from 'stripe'

const PLACEHOLDER = 'REEMPLAZA_CON_TU_CLAVE'

/** Cliente de Stripe del servidor; null en modo demo (sin clave real) */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || key.includes(PLACEHOLDER)) return null
  return new Stripe(key)
}
