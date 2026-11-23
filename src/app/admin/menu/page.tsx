import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { MenuEditor } from '@/components/merchant/MenuEditor'
import { LogoutButton } from '../LogoutButton'

export const metadata = { title: "Menú — Vaquero's", robots: { index: false } }

export default function AdminMenuPage() {
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
      <MenuEditor />
    </div>
  )
}
