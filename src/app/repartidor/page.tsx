import { Logo } from '@/components/brand/Logo'
import { LogoutButton } from '@/app/admin/LogoutButton'
import { RiderOrders } from '@/components/rider/RiderOrders'

export const metadata = { title: "Repartidor — Vaquero's", robots: { index: false } }

export default function RiderPage() {
  // El acceso (rol repartidor o admin) se valida en src/proxy.ts
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="max-w-xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo variant="small" className="h-7" />
            <span className="h-6 w-px bg-border" aria-hidden />
            <p className="text-foreground font-semibold text-sm">Mis entregas</p>
          </div>
          <LogoutButton />
        </div>
      </header>
      <RiderOrders />
    </div>
  )
}
