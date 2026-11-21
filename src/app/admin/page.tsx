import { MerchantPanel } from '@/components/merchant/MerchantPanel'
import { PerformanceDashboard } from '@/components/merchant/PerformanceDashboard'
import { Logo } from '@/components/brand/Logo'
import { isAdminAuthRequired } from '@/lib/adminAuth'
import { logout } from './actions'

export const metadata = { title: "Admin — Vaquero's", robots: { index: false } }

export default function AdminPage() {
  // El acceso se valida en src/proxy.ts antes de llegar aquí
  const protectedByPassword = isAdminAuthRequired()

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo variant="small" className="h-7" />
            <span className="h-6 w-px bg-border" aria-hidden />
            <p className="text-foreground font-semibold text-sm">Panel de operación</p>
          </div>
          {protectedByPassword && (
            <form action={logout}>
              <button type="submit" className="min-h-10 px-3 text-sm text-muted hover:text-foreground transition-colors">
                Salir
              </button>
            </form>
          )}
        </div>
      </header>
      {!protectedByPassword && (
        <p className="max-w-6xl mx-auto px-4 mt-4 text-warning text-xs">
          Modo desarrollo: el panel no tiene contraseña. En producción se requiere ADMIN_PASSWORD.
        </p>
      )}
      <MerchantPanel />
      <PerformanceDashboard />
    </div>
  )
}
