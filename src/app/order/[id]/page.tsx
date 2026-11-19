import { OrderStatus } from '@/components/order/OrderStatus'
import ordersData from '@/data/orders.json'
import type { Order } from '@/types/order'

export const instant = false
export const metadata = { title: "Estado del pedido — Vaquero's" }

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OrderPage({ params }: PageProps) {
  const { id } = await params

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
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center">
          <a href="/" className="text-muted hover:text-foreground transition-colors text-sm flex items-center gap-2">
            ← Volver al menú
          </a>
        </div>
      </header>
      <OrderStatus order={order} />
    </div>
  )
}
