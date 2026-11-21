import { MerchantPanel } from '@/components/merchant/MerchantPanel'
import { Logo } from '@/components/brand/Logo'

export const metadata = { title: "Panel de pedidos — Vaquero's" }

export default function MerchantPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo variant="small" className="h-7" />
            <span className="h-6 w-px bg-border" aria-hidden />
            <p className="text-foreground font-semibold text-sm">Panel de operación</p>
          </div>
        </div>
      </header>
      <MerchantPanel />
    </div>
  )
}
