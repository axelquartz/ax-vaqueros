import { OrderStatus } from '@/components/order/OrderStatus'
import ordersData from '@/data/orders.json'
import type { Order } from '@/types/order'
import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { connection } from 'next/server'

export const instant = false
export const metadata = { title: "Estado del pedido — Vaquero's" }

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ pagado?: string }>
}

export default async function OrderPage({ params, searchParams }: PageProps) {
  // Render por request: el pedido de respaldo usa la hora actual
  await connection()
  const { id } = await params
  const { pagado } = await searchParams

  // Busca en mock data; si no existe (pedido recién creado), genera uno de muestra
  const order: Order = (ordersData.orders.find(o => o.id === id) as Order | undefined) ?? {
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'pending',
    deliveryMethod: 'pickup',
    customer: { name: '', phone: '', notes: '' },
    items: [],
    subtotal: 0,
    deliveryFee: 0,
    total: 0,
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/" className="text-muted hover:text-foreground transition-colors text-sm flex items-center gap-2">
            <svg aria-hidden viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
            Menú
          </a>
          <Link href="/" aria-label="Vaquero's — Inicio" className="shrink-0">
            <Logo variant="small" className="h-7" />
          </Link>
        </div>
      </header>
      <OrderStatus order={order} justPaid={pagado === '1'} />
    </div>
  )
}
