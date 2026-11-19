'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { Input, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useCart } from '@/context/CartContext'
import ordersData from '@/data/orders.json'

// ─── Stripe setup ─────────────────────────────────────────
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const stripeAppearance = {
  theme: 'night' as const,
  variables: {
    colorPrimary:         '#C9A96E',
    colorBackground:      '#1F1F1F',
    colorText:            '#F2EDE4',
    colorTextPlaceholder: '#5C5550',
    colorDanger:          '#E05C5C',
    borderRadius:         '12px',
    fontSizeBase:         '14px',
  },
  rules: {
    '.Input':       { border: '1px solid #2E2E2E', boxShadow: 'none' },
    '.Input:focus': { border: '1px solid #C9A96E', boxShadow: 'none' },
    '.Label':       { color: '#9A9088', fontSize: '12px', fontWeight: '500' },
  },
}

// ─── Types ────────────────────────────────────────────────
type DeliveryMethodId = 'pickup' | 'table' | 'delivery'

interface FormState {
  name: string
  phone: string
  address: string
  tableNumber: string
  notes: string
}

type StepId = 'review' | 'delivery' | 'customer' | 'payment'

const STEPS: { id: StepId; label: string }[] = [
  { id: 'review',   label: 'Resumen' },
  { id: 'delivery', label: 'Entrega' },
  { id: 'customer', label: 'Datos'   },
  { id: 'payment',  label: 'Pago'    },
]

// ─── Step Indicator ───────────────────────────────────────
function StepIndicator({ current }: { current: StepId }) {
  const currentIndex = STEPS.findIndex(s => s.id === current)
  return (
    <div className="flex items-center justify-between px-1">
      {STEPS.map((step, i) => {
        const done   = i < currentIndex
        const active = i === currentIndex
        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={[
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border transition-colors',
                done   ? 'bg-brand border-brand text-inverse'             : '',
                active ? 'bg-brand/10 border-brand text-brand'            : '',
                !done && !active ? 'bg-elevated border-border text-muted' : '',
              ].join(' ')}>
                {done ? '✓' : i + 1}
              </div>
              <span className={`text-xs ${active ? 'text-foreground' : 'text-muted'}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={[
                'flex-1 h-px mx-2 mb-4',
                i < currentIndex ? 'bg-brand' : 'bg-border',
              ].join(' ')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1: Resumen ──────────────────────────────────────
function StepReview({ onNext }: { onNext: () => void }) {
  const { items, total, updateQuantity } = useCart()
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-foreground font-semibold text-base">Tu orden</h2>
        <p className="text-muted text-xs mt-0.5">Revisa los productos antes de continuar</p>
      </div>
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {items.map(item => (
          <div key={item.id} className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-foreground text-sm font-medium">{item.name}</p>
              {Object.values(item.variantLabels).length > 0 && (
                <p className="text-muted text-xs mt-0.5">{Object.values(item.variantLabels).join(' · ')}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => updateQuantity(item.id, item.quantity - 1)}
                className="w-6 h-6 rounded-full border border-border text-secondary text-xs flex items-center justify-center hover:border-border-strong">−</button>
              <span className="text-foreground text-xs font-medium w-4 text-center">{item.quantity}</span>
              <button onClick={() => updateQuantity(item.id, item.quantity + 1)}
                className="w-6 h-6 rounded-full border border-border text-secondary text-xs flex items-center justify-center hover:border-border-strong">+</button>
            </div>
            <span className="text-foreground text-sm font-semibold shrink-0">${item.subtotal}</span>
          </div>
        ))}
        <div className="flex justify-between px-4 py-3 bg-elevated">
          <span className="text-secondary text-sm">Subtotal</span>
          <span className="text-foreground text-sm font-semibold">${total}</span>
        </div>
      </div>
      <Button fullWidth size="lg" onClick={onNext} disabled={items.length === 0}>Continuar</Button>
    </div>
  )
}

// ─── Step 2: Entrega ──────────────────────────────────────
function StepDelivery({ selected, onSelect, onNext, onBack }: {
  selected: DeliveryMethodId
  onSelect: (id: DeliveryMethodId) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-foreground font-semibold text-base">¿Cómo lo recibes?</h2>
        <p className="text-muted text-xs mt-0.5">Elige el método de entrega</p>
      </div>
      <div className="space-y-2">
        {ordersData.deliveryMethods.map(method => (
          <button key={method.id} onClick={() => onSelect(method.id as DeliveryMethodId)}
            className={[
              'w-full flex items-center justify-between px-4 py-4 rounded-xl border text-left transition-colors',
              selected === method.id ? 'border-brand bg-brand/5' : 'border-border bg-surface hover:border-border-strong',
            ].join(' ')}>
            <div>
              <p className={`text-sm font-medium ${selected === method.id ? 'text-brand' : 'text-foreground'}`}>{method.label}</p>
              <p className="text-xs text-muted mt-0.5">{method.eta}</p>
            </div>
            <span className="text-sm text-secondary shrink-0">{method.price === 0 ? 'Gratis' : `+$${method.price}`}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <Button variant="ghost" size="lg" onClick={onBack} className="flex-1">Atrás</Button>
        <Button size="lg" onClick={onNext} className="flex-1">Continuar</Button>
      </div>
    </div>
  )
}

// ─── Step 3: Datos del cliente ────────────────────────────
function StepCustomer({ form, errors, deliveryMethod, onChange, onNext, onBack, loading }: {
  form: FormState
  errors: Partial<FormState>
  deliveryMethod: DeliveryMethodId
  onChange: (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onNext: () => void
  onBack: () => void
  loading: boolean
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-foreground font-semibold text-base">Tus datos</h2>
        <p className="text-muted text-xs mt-0.5">Para coordinar tu pedido</p>
      </div>
      <div className="space-y-3">
        <Input label="Nombre" placeholder="¿Cómo te llamamos?"
          value={form.name} onChange={onChange('name')} error={errors.name} />
        <Input label="Teléfono" placeholder="10 dígitos" type="tel"
          value={form.phone} onChange={onChange('phone')} error={errors.phone} />
        {deliveryMethod === 'table' && (
          <Input label="Número de mesa" placeholder="Ej. 4"
            value={form.tableNumber} onChange={onChange('tableNumber')} error={errors.tableNumber} />
        )}
        {deliveryMethod === 'delivery' && (
          <Input label="Dirección de entrega" placeholder="Calle, número, colonia"
            value={form.address} onChange={onChange('address')} error={errors.address} />
        )}
        <Textarea label="Notas (opcional)" placeholder="Alergias, preferencias..."
          value={form.notes} onChange={onChange('notes')} />
      </div>
      <div className="flex gap-3">
        <Button variant="ghost" size="lg" onClick={onBack} className="flex-1">Atrás</Button>
        <Button size="lg" onClick={onNext} disabled={loading} className="flex-1">
          {loading ? 'Preparando pago...' : 'Continuar'}
        </Button>
      </div>
    </div>
  )
}

// ─── Step 4: Pago demo (sin Stripe) ──────────────────────
function DemoPaymentForm({ total, deliveryFee, folio, onBack }: {
  total: number
  deliveryFee: number
  folio: string
  onBack: () => void
}) {
  const router = useRouter()
  const { clearCart } = useCart()
  const [submitting, setSubmitting] = useState(false)
  const orderTotal = total + deliveryFee

  const handlePay = async () => {
    setSubmitting(true)
    await new Promise(r => setTimeout(r, 900))
    clearCart()
    router.push(`/order/${folio}`)
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-foreground font-semibold text-base">Pago</h2>
        <p className="text-muted text-xs mt-0.5">Tus datos están protegidos por Stripe</p>
      </div>

      {/* Aviso modo demo */}
      <div className="bg-warning/10 border border-warning/30 rounded-xl px-4 py-3">
        <p className="text-warning text-xs font-medium">Modo demo activo</p>
        <p className="text-muted text-xs mt-0.5">
          Configura <code className="text-brand">STRIPE_SECRET_KEY</code> en <code className="text-brand">.env.local</code> para habilitar pagos reales.
        </p>
      </div>

      {/* Formulario simulado */}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-3 opacity-60">
        <div className="bg-elevated border border-border rounded-lg px-3 py-2.5">
          <p className="text-muted text-sm tracking-widest">•••• •••• •••• ••••</p>
        </div>
        <div className="flex gap-3">
          <div className="flex-1 bg-elevated border border-border rounded-lg px-3 py-2.5">
            <p className="text-muted text-xs">MM / AA</p>
          </div>
          <div className="w-24 bg-elevated border border-border rounded-lg px-3 py-2.5">
            <p className="text-muted text-xs">CVV</p>
          </div>
        </div>
      </div>

      {/* Desglose */}
      <div className="bg-surface border border-border rounded-xl px-4 py-3 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-secondary">Subtotal</span>
          <span className="text-foreground">${total}</span>
        </div>
        {deliveryFee > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-secondary">Envío</span>
            <span className="text-foreground">${deliveryFee}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold border-t border-border pt-2">
          <span className="text-foreground">Total</span>
          <span className="text-foreground">${orderTotal}</span>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" size="lg" onClick={onBack} disabled={submitting} className="flex-1">Atrás</Button>
        <Button size="lg" onClick={handlePay} disabled={submitting} className="flex-1">
          {submitting ? 'Procesando...' : `Simular pago · $${orderTotal}`}
        </Button>
      </div>
    </div>
  )
}

// ─── Step 4: Pago (dentro de Elements) ───────────────────
function PaymentForm({ total, deliveryFee, folio, onBack }: {
  total: number
  deliveryFee: number
  folio: string
  onBack: () => void
}) {
  const stripe   = useStripe()
  const elements = useElements()
  const router   = useRouter()
  const { clearCart } = useCart()

  const [submitting, setSubmitting] = useState(false)
  const [stripeError, setStripeError] = useState<string | null>(null)

  const orderTotal = total + deliveryFee

  const handlePay = async () => {
    if (!stripe || !elements) return
    setSubmitting(true)
    setStripeError(null)

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/order/${folio}`,
      },
      redirect: 'if_required',
    })

    if (error) {
      setStripeError(error.message ?? 'Error al procesar el pago')
      setSubmitting(false)
    } else {
      clearCart()
      router.push(`/order/${folio}`)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-foreground font-semibold text-base">Pago</h2>
        <p className="text-muted text-xs mt-0.5">Tus datos están protegidos por Stripe</p>
      </div>

      {/* Stripe PaymentElement */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <PaymentElement />
      </div>

      {stripeError && (
        <p className="text-error text-xs px-1">{stripeError}</p>
      )}

      {/* Desglose */}
      <div className="bg-surface border border-border rounded-xl px-4 py-3 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-secondary">Subtotal</span>
          <span className="text-foreground">${total}</span>
        </div>
        {deliveryFee > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-secondary">Envío</span>
            <span className="text-foreground">${deliveryFee}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold border-t border-border pt-2">
          <span className="text-foreground">Total</span>
          <span className="text-foreground">${orderTotal}</span>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" size="lg" onClick={onBack} disabled={submitting} className="flex-1">Atrás</Button>
        <Button size="lg" onClick={handlePay} disabled={submitting || !stripe} className="flex-1">
          {submitting ? 'Procesando...' : `Pagar $${orderTotal}`}
        </Button>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────
export function CheckoutFlow() {
  const { items, total } = useCart()
  const router = useRouter()

  const [step, setStep]               = useState<StepId>('review')
  const [deliveryMethod, setDelivery] = useState<DeliveryMethodId>('pickup')
  const [form, setForm]               = useState<FormState>({ name: '', phone: '', address: '', tableNumber: '', notes: '' })
  const [errors, setErrors]           = useState<Partial<FormState>>({})
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [isDemoMode, setIsDemoMode]   = useState(false)
  const [folio, setFolio]             = useState<string>('')
  const [creatingIntent, setCreatingIntent] = useState(false)

  const selectedMethod = ordersData.deliveryMethods.find(m => m.id === deliveryMethod)!
  const orderTotal = total + selectedMethod.price

  const patchField = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm(f => ({ ...f, [key]: e.target.value }))
      if (errors[key]) setErrors(err => ({ ...err, [key]: undefined }))
    }

  const validateCustomer = (): Partial<FormState> => {
    const e: Partial<FormState> = {}
    if (!form.name.trim())  e.name  = 'Requerido'
    if (!form.phone.trim()) e.phone = 'Requerido'
    if (deliveryMethod === 'delivery' && !form.address.trim())     e.address     = 'Requerido para domicilio'
    if (deliveryMethod === 'table'    && !form.tableNumber.trim()) e.tableNumber = 'Ingresa el número de mesa'
    return e
  }

  const goToPayment = async () => {
    const errs = validateCustomer()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setCreatingIntent(true)
    try {
      const newFolio = `ORD-${String(Math.floor(Math.random() * 9000) + 1000)}`
      const res = await fetch('/api/checkout/payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: orderTotal,
          folio:  newFolio,
          deliveryMethod,
          deliveryFee: selectedMethod.price,
          customer: {
            name:        form.name,
            phone:       form.phone,
            address:     form.address     || undefined,
            tableNumber: form.tableNumber || undefined,
            notes:       form.notes       || undefined,
          },
          items: items.map(i => ({
            name:          i.name,
            quantity:      i.quantity,
            unitPrice:     i.unitPrice,
            variantExtra:  i.variantExtra,
            variantLabels: i.variantLabels,
            subtotal:      i.subtotal,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setFolio(newFolio)
      setClientSecret(data.clientSecret)
      setIsDemoMode(!!data.demo)
      setStep('payment')
    } catch (err) {
      console.error(err)
      setErrors({ name: 'Error al conectar con el servidor de pagos. Intenta de nuevo.' })
    } finally {
      setCreatingIntent(false)
    }
  }

  if (items.length === 0 && step !== 'payment') {
    return (
      <div className="max-w-md mx-auto px-4 py-10 text-center space-y-4">
        <p className="text-muted text-sm">Tu carrito está vacío.</p>
        <Button variant="ghost" onClick={() => router.push('/')}>Volver al menú</Button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-6">
      <StepIndicator current={step} />

      {step === 'review' && (
        <StepReview onNext={() => setStep('delivery')} />
      )}
      {step === 'delivery' && (
        <StepDelivery
          selected={deliveryMethod}
          onSelect={setDelivery}
          onNext={() => setStep('customer')}
          onBack={() => setStep('review')}
        />
      )}
      {step === 'customer' && (
        <StepCustomer
          form={form}
          errors={errors}
          deliveryMethod={deliveryMethod}
          onChange={patchField}
          onNext={goToPayment}
          onBack={() => setStep('delivery')}
          loading={creatingIntent}
        />
      )}
      {step === 'payment' && clientSecret && (
        isDemoMode ? (
          <DemoPaymentForm
            total={total}
            deliveryFee={selectedMethod.price}
            folio={folio}
            onBack={() => setStep('customer')}
          />
        ) : (
          <Elements
            stripe={stripePromise}
            options={{ clientSecret, appearance: stripeAppearance }}
          >
            <PaymentForm
              total={total}
              deliveryFee={selectedMethod.price}
              folio={folio}
              onBack={() => setStep('customer')}
            />
          </Elements>
        )
      )}
    </div>
  )
}
