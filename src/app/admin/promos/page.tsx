import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { PromoEditor } from '@/components/merchant/PromoEditor'
import { LogoutButton } from '../LogoutButton'

export const metadata = { title: "Promociones — Vaquero's", robots: { index: false } }

export default function AdminPromosPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo variant="small" className="h-7" />
            <span className="h-6 w-px bg-border" aria-hidden />
            <Link href="/admin" className="text-muted hover:text-foreground text-sm transition-colors">← Pedidos</Link>
          </div>
          <LogoutButton />
        </div>
      </header>
      <PromoEditor />
    </div>
  )
}
