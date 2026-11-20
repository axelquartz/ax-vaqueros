import { render, screen } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import { Logo } from '@/components/brand/Logo'

describe('Logo', () => {
  it('variante long por default', () => {
    render(<Logo />)
    const img = screen.getByAltText("Vaquero's")
    expect(img).toHaveAttribute('src', '/images/brand/logo-long.png')
  })

  it('variante small', () => {
    render(<Logo variant="small" className="h-7" />)
    const img = screen.getByAltText("Vaquero's")
    expect(img).toHaveAttribute('src', '/images/brand/logo-small.png')
    expect(img).toHaveClass('h-7')
  })

  it.each(['public/images/brand/logo-long.png', 'public/images/brand/logo-small.png', 'src/app/icon.png', 'src/app/apple-icon.png'])(
    'existe el asset %s',
    file => expect(fs.existsSync(path.resolve(file))).toBe(true),
  )

  it('ya no existe el favicon default de Next', () => {
    expect(fs.existsSync(path.resolve('src/app/favicon.ico'))).toBe(false)
  })
})
