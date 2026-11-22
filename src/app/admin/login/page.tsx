import { Logo } from '@/components/brand/Logo'
import { LoginForm } from './LoginForm'

export const metadata = { title: "Entrar — Vaquero's", robots: { index: false } }

export default function AdminLoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8 animate-fade-up">
        <div className="flex flex-col items-center gap-4 text-center">
          <Logo variant="small" className="h-10" />
          <div>
            <h1 className="font-display text-[1.625rem] font-bold leading-none text-foreground">Panel de operación</h1>
            <p className="text-muted text-sm mt-1.5">Acceso solo para el equipo del restaurante</p>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5">
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
