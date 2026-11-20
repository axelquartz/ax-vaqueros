import { CheckoutFlow } from '@/components/checkout/CheckoutFlow'
import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'

export const instant = false
export const metadata = { title: "Checkout — Vaquero's" }

export default function CheckoutPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/" className="text-muted hover:text-foreground transition-colors text-sm flex items-center gap-2">
            ← Volver al menú
          </a>
          <Link href="/" aria-label="Vaquero's — Inicio" className="shrink-0">
            <Logo variant="small" className="h-7" />
          </Link>
        </div>
      </header>
      <CheckoutFlow />
    </div>
  )
}
