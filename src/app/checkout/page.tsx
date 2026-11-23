import { CheckoutFlow } from '@/components/checkout/CheckoutFlow'
import { SiteHeader } from '@/components/layout/SiteHeader'

export const instant = false
export const metadata = { title: "Checkout — Vaquero's" }

export default function CheckoutPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <CheckoutFlow />
    </div>
  )
}
