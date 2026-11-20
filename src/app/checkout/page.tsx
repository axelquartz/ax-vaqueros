import { CheckoutFlow } from '@/components/checkout/CheckoutFlow'

export const instant = false
export const metadata = { title: "Checkout — Vaquero's" }

export default function CheckoutPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center">
          <a href="/" className="text-muted hover:text-foreground transition-colors text-sm flex items-center gap-2">
            ← Volver al menú
          </a>
        </div>
      </header>
      <CheckoutFlow />
    </div>
  )
}
