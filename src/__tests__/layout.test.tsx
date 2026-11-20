vi.mock('next/font/google', () => ({
  Geist: () => ({ variable: 'geist' }),
  Geist_Mono: () => ({ variable: 'geist-mono' }),
}))

import { renderToStaticMarkup } from 'react-dom/server'
import RootLayout, { viewport, metadata } from '@/app/layout'

describe('RootLayout', () => {
  it('exporta viewport oscuro', () => {
    expect(viewport.colorScheme).toBe('dark')
    expect(viewport.themeColor).toBe('#0C0C0C')
  })

  it('el <html> lleva clase dark y color-scheme', () => {
    const html = renderToStaticMarkup(<RootLayout><p>hola</p></RootLayout>)
    expect(html).toMatch(/<html[^>]*class="dark /)
    expect(html).toContain('color-scheme:dark')
    expect(html).toContain('lang="es"')
  })

  it('mantiene el título', () => {
    expect(String(metadata.title)).toContain("Vaquero's")
  })
})
