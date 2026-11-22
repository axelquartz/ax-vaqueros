import type { Metadata, Viewport } from 'next'
import { Big_Shoulders, Instrument_Sans } from 'next/font/google'
import './globals.css'
import { CartProvider } from '@/context/CartContext'
import { HostBadgeInset } from '@/components/layout/HostBadgeInset'

const display = Big_Shoulders({ variable: '--font-big-shoulders', subsets: ['latin'], weight: ['600', '700', '800'] })
const sans    = Instrument_Sans({ variable: '--font-instrument-sans', subsets: ['latin'] })

export const metadata: Metadata = {
  title: "Vaquero's — Menú Digital",
  description: 'Ordena tus tacos favoritos.',
}

export const viewport: Viewport = {
  themeColor: '#14100D',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" style={{ colorScheme: 'dark' }} className={`dark ${display.variable} ${sans.variable} h-full antialiased`}>
      {/* pb: el final de la página nunca queda bajo la insignia del hosting */}
      <body className="min-h-full flex flex-col bg-background text-foreground pb-[var(--host-badge-inset,0px)]">
        <HostBadgeInset />
        <CartProvider>
          {children}
        </CartProvider>
      </body>
    </html>
  )
}
