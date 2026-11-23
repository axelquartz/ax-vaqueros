import { QrCard } from '@/components/merchant/QrCard'
import { AdminHeader } from '../AdminHeader'

export const metadata = { title: "QR — Vaquero's", robots: { index: false } }

export default function AdminQrPage() {
  return (
    <div className="min-h-screen">
      <AdminHeader />
      <QrCard />
    </div>
  )
}
