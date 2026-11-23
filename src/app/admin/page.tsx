import { MerchantPanel } from '@/components/merchant/MerchantPanel'
import { PerformanceDashboard } from '@/components/merchant/PerformanceDashboard'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { StorePauseToggle } from '@/components/merchant/StorePauseToggle'
import { ReviewsPanel } from '@/components/merchant/ReviewsPanel'
import { RefundsPanel } from '@/components/merchant/RefundsPanel'
import { PushToggle } from '@/components/PushToggle'
import { AdminHeader } from './AdminHeader'

export const metadata = { title: "Admin — Vaquero's", robots: { index: false } }

export default function AdminPage() {
  // El acceso se valida en src/proxy.ts antes de llegar aquí
  const online = isSupabaseConfigured()

  return (
    <div className="min-h-screen">
      <AdminHeader online={online} />
      {!online && (
        <p className="max-w-6xl mx-auto px-4 mt-4 text-warning text-xs">
          Modo demo: sin Supabase, el panel no pide acceso y usa pedidos de ejemplo guardados en este navegador.
        </p>
      )}
      {online && <div className="max-w-6xl mx-auto px-4 pt-4 flex justify-end"><StorePauseToggle /></div>}
      {online && <div className="max-w-6xl mx-auto px-4 pt-4"><PushToggle mode="staff" /></div>}
      {online && <RefundsPanel />}
      <MerchantPanel />
      <PerformanceDashboard />
      {online && <ReviewsPanel />}
    </div>
  )
}
