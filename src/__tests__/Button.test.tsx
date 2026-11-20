import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/Button'

const SIZE = ['px-4', 'py-2.5', 'text-sm', 'rounded-xl', 'border']

describe('Button', () => {
  it.each(['primary', 'ghost', 'destructive'] as const)('variante %s usa el tamaño único', variant => {
    render(<Button variant={variant}>X</Button>)
    const btn = screen.getByRole('button')
    SIZE.forEach(c => expect(btn).toHaveClass(c))
  })

  it('tiene feedback táctil al presionar', () => {
    render(<Button>X</Button>)
    expect(screen.getByRole('button')).toHaveClass('active:scale-[0.97]')
  })

  it('dispara onClick', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Ok</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Ok' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('no dispara onClick deshabilitado', async () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Ok</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('fullWidth agrega w-full', () => {
    render(<Button fullWidth>X</Button>)
    expect(screen.getByRole('button')).toHaveClass('w-full')
  })
})
