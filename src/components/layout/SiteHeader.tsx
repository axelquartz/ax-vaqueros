import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { SiteNav } from '@/components/layout/SiteNav'

/** Barra superior fija del sitio del cliente; `status` es un extra opcional (p. ej. Abierto/Cerrado) */
export function SiteHeader({ status }: { status?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border">
      <div className="max-w-[90vw] mx-auto px-4 h-14 flex items-center justify-between gap-2">
        <Link href="/" aria-label="Vaquero's — Inicio" className="shrink-0">
          <Logo variant="small" className="h-8 sm:hidden" />
          <Logo variant="long" className="hidden sm:block h-6" />
        </Link>
        <div className="flex items-center gap-1 sm:gap-4 min-w-0">
          {status}
          <SiteNav />
        </div>
      </div>
    </header>
  )
}
