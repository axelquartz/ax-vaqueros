import { OrderStatus } from '@/components/order/OrderStatus'
import ordersData from '@/data/orders.json'
import type { Order } from '@/types/order'
import { SiteHeader } from '@/components/layout/SiteHeader'
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
      <SiteHeader />
      <OrderStatus order={order} justPaid={pagado === '1'} />
    </div>
  )
}
