import { MerchantPanel } from '@/components/merchant/MerchantPanel'

export const metadata = { title: "Panel de pedidos — Vaquero's" }

export default function MerchantPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div>
            <h1 className="text-foreground font-semibold text-sm">Panel de operación</h1>
            <p className="text-muted text-xs">Vaquero's</p>
          </div>
        </div>
      </header>
      <MerchantPanel />
    </div>
  )
}
