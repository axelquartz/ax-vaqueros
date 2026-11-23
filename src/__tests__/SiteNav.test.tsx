import { render, screen } from '@testing-library/react'
import { SiteNav, NAV_LINKS, isActiveLink } from '@/components/layout/SiteNav'

let path = '/'
vi.mock('next/navigation', () => ({ usePathname: () => path }))

describe('SiteNav', () => {
  it('Menú, Nosotros y Mis pedidos siempre visibles (sin hamburguesa)', () => {
    render(<SiteNav />)
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    expect(nav).not.toHaveClass('hidden')
    expect(NAV_LINKS.map(l => l.label)).toEqual(['Menú', 'Nosotros', 'Mis pedidos'])
    NAV_LINKS.forEach(l => expect(nav.querySelector(`a[href="${l.href}"]`)).toHaveTextContent(l.label))
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('marca la sección actual', () => {
    path = '/nosotros'
    render(<SiteNav />)
    expect(screen.getByRole('link', { name: 'Nosotros' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Menú' })).not.toHaveAttribute('aria-current')
  })

  it('el detalle de un pedido cuenta como Mis pedidos; el menú solo en "/"', () => {
    expect(isActiveLink('/pedidos', '/order/ORD-12345')).toBe(true)
    expect(isActiveLink('/', '/checkout')).toBe(false)
    expect(isActiveLink('/', '/')).toBe(true)
  })
})
