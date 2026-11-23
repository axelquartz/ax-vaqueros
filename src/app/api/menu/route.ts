import { NextResponse } from 'next/server'
import { fetchMenuState } from '@/lib/menuStateServer'

export const dynamic = 'force-dynamic'

/** Estado público del menú: precios y agotados vigentes, y si se pausaron los pedidos */
export async function GET() {
  return NextResponse.json(await fetchMenuState(), { headers: { 'Cache-Control': 'no-store' } })
}
