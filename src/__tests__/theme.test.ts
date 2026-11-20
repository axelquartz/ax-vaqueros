import fs from 'node:fs'
import path from 'node:path'

const css = fs.readFileSync(path.resolve('src/app/globals.css'), 'utf8')

describe('globals.css', () => {
  it('declara dark mode por default', () => {
    expect(css).toMatch(/:root\s*{[^}]*color-scheme:\s*dark/)
  })

  it('define los tokens de movimiento', () => {
    for (const t of ['--ease-sheet', '--animate-sheet-in', '--animate-sheet-out', '--animate-fade-in', '--animate-fade-out', '--animate-fade-up', '--animate-rise-in']) {
      expect(css).toContain(t)
    }
    for (const k of ['sheet-in', 'sheet-out', 'fade-in', 'fade-out', 'fade-up', 'rise-in']) {
      expect(css).toMatch(new RegExp(`@keyframes ${k}\\b`))
    }
  })

  it('respeta prefers-reduced-motion sin usar animation:none', () => {
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/)
    expect(css).toContain('animation-duration: 0.01ms')
  })
})
