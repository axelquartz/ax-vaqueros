import { MerchantPanel } from '@/components/merchant/MerchantPanel'
import { PerformanceDashboard } from '@/components/merchant/PerformanceDashboard'
import { Logo } from '@/components/brand/Logo'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { LogoutButton } from './LogoutButton'

export const metadata = { title: "Admin — Vaquero's", robots: { index: false } }

export default function AdminPage() {
  // El acceso se valida en src/proxy.ts antes de llegar aquí
  const online = isSupabaseConfigured()

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo variant="small" className="h-7" />
            <span className="h-6 w-px bg-border" aria-hidden />
            <p className="text-foreground font-semibold text-sm">Panel de operación</p>
          </div>
          {online && <LogoutButton />}
        </div>
      </header>
      {!online && (
        <p className="max-w-6xl mx-auto px-4 mt-4 text-warning text-xs">
          Modo demo: sin Supabase, el panel no pide acceso y usa pedidos de ejemplo guardados en este navegador.
        </p>
      )}
      <MerchantPanel />
      <PerformanceDashboard />
    </div>
  )
}
