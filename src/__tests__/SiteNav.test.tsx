import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SiteNav, NAV_LINKS } from '@/components/layout/SiteNav'

const burger = () => screen.getByRole('button', { name: /menú/ })
const panel = () => document.getElementById(burger().getAttribute('aria-controls')!)!

describe('SiteNav', () => {
  it('desktop: links en text-sm con espacio entre ellos', () => {
    render(<SiteNav />)
    const desktop = screen.getByRole('navigation', { name: 'Principal' })
    expect(desktop).toHaveClass('hidden', 'sm:flex', 'gap-5')
    NAV_LINKS.forEach(l => {
      const a = desktop.querySelector(`a[href="${l.href}"]`)!
      expect(a).toHaveTextContent(l.label)
      expect(a).toHaveClass('text-sm')
    })
  })

  it('móvil: hamburguesa cerrada por default, solo visible en móvil', () => {
    render(<SiteNav />)
    expect(burger()).toHaveClass('sm:hidden', 'w-11', 'h-11')
    expect(burger()).toHaveAttribute('aria-expanded', 'false')
    expect(burger()).toHaveAccessibleName('Abrir menú')
    expect(panel()).toHaveAttribute('inert')
    expect(panel()).toHaveClass('grid-rows-[0fr]')
  })

  it('abre y cierra con el botón', async () => {
    render(<SiteNav />)
    await userEvent.click(burger())
    expect(burger()).toHaveAttribute('aria-expanded', 'true')
    expect(burger()).toHaveAccessibleName('Cerrar menú')
    expect(panel()).not.toHaveAttribute('inert')
    expect(panel()).toHaveClass('grid-rows-[1fr]')
    NAV_LINKS.forEach(l => expect(panel().querySelector(`a[href="${l.href}"]`)).toHaveClass('min-h-12'))
    await userEvent.click(burger())
    expect(burger()).toHaveAttribute('aria-expanded', 'false')
  })

  it('cierra con Escape', async () => {
    render(<SiteNav />)
    await userEvent.click(burger())
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(burger()).toHaveAttribute('aria-expanded', 'false')
  })

  it('cierra al tocar un link y al tocar fuera', async () => {
    render(<SiteNav />)
    await userEvent.click(burger())
    fireEvent.click(panel().querySelector('a')!)
    expect(burger()).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(burger())
    const overlay = panel().previousElementSibling as HTMLElement
    fireEvent.click(overlay)
    expect(burger()).toHaveAttribute('aria-expanded', 'false')
  })
})
