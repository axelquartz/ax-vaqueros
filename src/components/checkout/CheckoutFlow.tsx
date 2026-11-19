'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useCart } from '@/context/CartContext'
import ordersData from '@/data/orders.json'

type DeliveryMethodId = 'pickup' | 'table' | 'delivery'

interface FormState {
  name: string
  phone: string
  address: string
  tableNumber: string
  notes: string
}

export function CheckoutFlow() {
  const { items, total, clearCart } = useCart()
  const router = useRouter()

  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethodId>('pickup')
  const [form, setForm] = useState<FormState>({ name: '', phone: '', address: '', tableNumber: '', notes: '' })
  const [errors, setErrors] = useState<Partial<FormState>>({})
  const [submitting, setSubmitting] = useState(false)

  const selectedMethod = ordersData.deliveryMethods.find(m => m.id === deliveryMethod)!
  const orderTotal = total + selectedMethod.price

  const patch = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors(err => ({ ...err, [key]: undefined }))
  }

  const validate = (): Partial<FormState> => {
    const e: Partial<FormState> = {}
    if (!form.name.trim())  e.name  = 'Requerido'
    if (!form.phone.trim()) e.phone = 'Requerido'
    if (deliveryMethod === 'delivery' && !form.address.trim())     e.address     = 'Requerido para domicilio'
    if (deliveryMethod === 'table'    && !form.tableNumber.trim()) e.tableNumber = 'Ingresa el número de mesa'
    return e
  }

  const handleSubmit = async () => {
    const newErrors = validate()
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setSubmitting(true)
    await new Promise(r => setTimeout(r, 700))
    const folio = `ORD-${String(Math.floor(Math.random() * 9000) + 1000)}`
    clearCart()
    router.push(`/order/${folio}`)
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-6">
      <h1 className="text-foreground font-semibold text-lg">Tu pedido</h1>

      {/* Resumen */}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
        {items.map(item => (
          <div key={item.id} className="flex justify-between gap-2 text-sm">
            <span className="text-secondary">
              {item.quantity}× {item.name}
              {Object.values(item.variantLabels).length > 0 && (
                <span className="text-muted"> · {Object.values(item.variantLabels).join(', ')}</span>
              )}
            </span>
            <span className="text-foreground font-medium shrink-0">${item.subtotal}</span>
          </div>
        ))}
      </div>

      {/* Método de entrega */}
      <div>
        <p className="text-xs text-secondary font-medium mb-3">Método de entrega</p>
        <div className="space-y-2">
          {ordersData.deliveryMethods.map(method => (
            <button
              key={method.id}
              onClick={() => setDeliveryMethod(method.id as DeliveryMethodId)}
              className={[
                'w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors',
                deliveryMethod === method.id
                  ? 'border-brand bg-brand/5'
                  : 'border-border bg-surface hover:border-border-strong',
              ].join(' ')}
            >
              <div>
                <p className={`text-sm font-medium ${deliveryMethod === method.id ? 'text-brand' : 'text-foreground'}`}>
                  {method.label}
                </p>
                <p className="text-xs text-muted mt-0.5">{method.eta}</p>
              </div>
              <span className="text-sm text-secondary shrink-0">
                {method.price === 0 ? 'Gratis' : `$${method.price}`}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Datos del cliente */}
      <div className="space-y-4">
        <p className="text-xs text-secondary font-medium">Tus datos</p>
        <Input label="Nombre" placeholder="¿Cómo te llamamos?"
          value={form.name} onChange={patch('name')} error={errors.name} />
        <Input label="Teléfono" placeholder="10 dígitos" type="tel"
          value={form.phone} onChange={patch('phone')} error={errors.phone} />
        {deliveryMethod === 'table' && (
          <Input label="Número de mesa" placeholder="Ej. 4"
            value={form.tableNumber} onChange={patch('tableNumber')} error={errors.tableNumber} />
        )}
        {deliveryMethod === 'delivery' && (
          <Input label="Dirección de entrega" placeholder="Calle, número, colonia"
            value={form.address} onChange={patch('address')} error={errors.address} />
        )}
        <Textarea label="Notas (opcional)" placeholder="Alergias, preferencias..."
          value={form.notes} onChange={patch('notes')} />
      </div>

      {/* Total + Confirmar */}
      <div className="space-y-3 pt-2">
        <div className="flex justify-between text-sm">
          <span className="text-secondary">Subtotal</span>
          <span className="text-foreground">${total}</span>
        </div>
        {selectedMethod.price > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-secondary">Envío</span>
            <span className="text-foreground">${selectedMethod.price}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold border-t border-border pt-3">
          <span className="text-foreground">Total</span>
          <span className="text-foreground">${orderTotal}</span>
        </div>
        <Button fullWidth size="lg" onClick={handleSubmit} disabled={submitting || items.length === 0}>
          {submitting ? 'Enviando pedido...' : `Confirmar pedido · $${orderTotal}`}
        </Button>
      </div>
    </div>
  )
}
