import { PromoEditor } from '@/components/merchant/PromoEditor'
import { AdminHeader } from '../AdminHeader'

export const metadata = { title: "Promociones — Vaquero's", robots: { index: false } }

export default function AdminPromosPage() {
  return (
    <div className="min-h-screen">
      <AdminHeader />
      <PromoEditor />
    </div>
  )
}
