import { DeliveryZonesEditor } from '@/components/merchant/DeliveryZonesEditor'
import { AdminHeader } from '../AdminHeader'

export const metadata = { title: "Envío — Vaquero's", robots: { index: false } }

export default function AdminDeliveryPage() {
  return (
    <div className="min-h-screen">
      <AdminHeader />
      <DeliveryZonesEditor />
    </div>
  )
}
