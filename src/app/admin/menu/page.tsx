import { MenuEditor } from '@/components/merchant/MenuEditor'
import { AdminHeader } from '../AdminHeader'

export const metadata = { title: "Menú — Vaquero's", robots: { index: false } }

export default function AdminMenuPage() {
  return (
    <div className="min-h-screen">
      <AdminHeader />
      <MenuEditor />
    </div>
  )
}
