'use client'

import { useState, useEffect } from 'react'
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
import { saveOrder } from '@/lib/orderHistory'
import { isStoreOpen, getStoreStatusText } from '@/lib/storeHours'
import dynamic from 'next/dynamic'
import { AddressAutocomplete } from '@/components/checkout/AddressAutocomplete'
import { Upsell } from '@/components/checkout/Upsell'
import { ProductSheet } from '@/components/menu/ProductSheet'
import type { Product } from '@/types/menu'
import type { CartItem } from '@/types/cart'
const CheckoutMap = dynamic(
  () => import('@/components/checkout/CheckoutMap').then(m => m.CheckoutMap),
  { ssr: false }
)

// ─── Stripe setup ─────────────────────────────────────────
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const stripeAppearance = {
  theme: 'night' as const,
  variables: {
    colorPrimary:         '#C49B6C',
    colorBackground:      '#28211B',
    colorText:            '#F2EADD',
    colorTextPlaceholder: '#8C7F6E',
    colorDanger:          '#E05C5C',
    borderRadius:         '12px',
    fontSizeBase:         '14px',
  },
  rules: {
    '.Input':       { border: '1px solid #352D25', boxShadow: 'none' },
    '.Input:focus': { border: '1px solid #C49B6C', boxShadow: 'none' },
    '.Label':       { color: '#B4A691', fontSize: '12px', fontWeight: '500' },
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
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border transition-colors duration-300',
                done   ? 'bg-brand border-brand text-inverse'             : '',
                active ? 'bg-brand/10 border-brand text-brand'            : '',
                !done && !active ? 'bg-elevated border-border text-muted' : '',
              ].join(' ')}>
                {done ? '✓' : i + 1}
              </div>
              <span className={`text-xs transition-colors duration-300 ${active ? 'text-foreground' : 'text-muted'}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={[
                'flex-1 h-px mx-2 mb-4 transition-colors duration-300',
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
  const [open, setOpen]         = useState(true)
  const [statusText, setStatus] = useState('')

  useEffect(() => {
    setOpen(isStoreOpen())
    setStatus(getStoreStatusText())
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-[1.625rem] font-bold leading-none text-foreground">Tu orden</h2>
        <p className="text-muted text-sm mt-1.5">Revisa los productos antes de continuar</p>
      </div>

      {!open && statusText && (
        <div className="bg-surface border border-border rounded-xl px-4 py-3 space-y-1">
          <p className="text-foreground text-sm font-medium">Restaurante cerrado</p>
          <p className="text-muted text-xs">{statusText}</p>
          <p className="text-muted text-xs">Puedes revisar tu orden, pero no podrás continuar hasta que abramos.</p>
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {items.map(item => (
          <div key={item.id} className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-foreground text-sm font-medium">{item.name}</p>
              {Object.values(item.variantLabels).length > 0 && (
                <p className="text-muted text-sm mt-1.5">{Object.values(item.variantLabels).join(', ')}</p>
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
      <Button fullWidth onClick={onNext} disabled={items.length === 0 || !open}>Continuar</Button>
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
        <h2 className="font-display text-[1.625rem] font-bold leading-none text-foreground">¿Cómo lo recibes?</h2>
        <p className="text-muted text-sm mt-1.5">Elige el método de entrega</p>
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
        <Button variant="ghost" onClick={onBack} className="flex-1">Atrás</Button>
        <Button onClick={onNext} className="flex-1">Continuar</Button>
      </div>
    </div>
  )
}

// ─── Step 3: Datos del cliente ────────────────────────────
function StepCustomer({ form, errors, deliveryMethod, onChange, onAddressChange, onAddressSelect, coords, onNext, onBack, loading }: {
  form:            FormState
  errors:          Partial<FormState>
  deliveryMethod:  DeliveryMethodId
  onChange:        (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onAddressChange: (value: string) => void
  onAddressSelect: (address: string, lat: number, lng: number) => void
  coords:          { lat: number; lng: number } | null
  onNext:          () => void
  onBack:          () => void
  loading:         boolean
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-[1.625rem] font-bold leading-none text-foreground">Tus datos</h2>
        <p className="text-muted text-sm mt-1.5">Para coordinar tu pedido</p>
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
          <>
            <AddressAutocomplete
              value={form.address}
              onChange={onAddressChange}
              onSelect={onAddressSelect}
              error={errors.address}
            />
            {coords && <CheckoutMap lat={coords.lat} lng={coords.lng} />}
          </>
        )}
        <Textarea label="Notas (opcional)" placeholder="Alergias, preferencias..."
          value={form.notes} onChange={onChange('notes')} />
      </div>
      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack} className="flex-1">Atrás</Button>
        <Button onClick={onNext} disabled={loading} className="flex-1">
          {loading ? 'Preparando pago...' : 'Continuar'}
        </Button>
      </div>
    </div>
  )
}

// ─── Guardar pedido + ir a la confirmación ───────────────
function toSavedItems(items: CartItem[]) {
  return items.map(i => ({ name: i.name, quantity: i.quantity, subtotal: i.subtotal, variants: i.variantLabels }))
}

interface PaymentFormProps {
  total: number
  deliveryFee: number
  folio: string
  deliveryMethod: string
  itemCount: number
  onBack: () => void
  /** Bloque "¿Te falta algo?" — se muestra antes del desglose */
  upsell?: React.ReactNode
  /** El total cambió y el cobro se está actualizando: no permitir pagar aún */
  refreshing?: boolean
}

// ─── Step 4: Pago demo (sin Stripe) ──────────────────────
function DemoPaymentForm({ total, deliveryFee, folio, deliveryMethod, itemCount, onBack, upsell, refreshing }: PaymentFormProps) {
  const router = useRouter()
  const { items, clearCart } = useCart()
  const [submitting, setSubmitting] = useState(false)
  const orderTotal = total + deliveryFee

  const handlePay = async () => {
    setSubmitting(true)
    await new Promise(r => setTimeout(r, 900))
    saveOrder({ folio, timestamp: new Date().toISOString(), total: orderTotal, deliveryMethod, itemCount, deliveryFee, items: toSavedItems(items) })
    clearCart()
    router.push(`/order/${folio}?pagado=1`)
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-[1.625rem] font-bold leading-none text-foreground">Pago</h2>
        <p className="text-muted text-sm mt-1.5">Tus datos están protegidos por Stripe</p>
      </div>

      {/* Aviso modo demo */}
      <div className="bg-warning/10 border border-warning/30 rounded-xl px-4 py-3">
        <p className="text-warning text-xs font-medium">Modo demo activo</p>
        <p className="text-muted text-sm mt-1.5">
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

      {upsell}

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
        <Button variant="ghost" onClick={onBack} disabled={submitting} className="flex-1">Atrás</Button>
        <Button onClick={handlePay} disabled={submitting || refreshing} className="flex-1">
          {submitting ? 'Procesando...' : refreshing ? 'Actualizando total…' : `Simular pago de $${orderTotal}`}
        </Button>
      </div>
    </div>
  )
}

// ─── Step 4: Pago (dentro de Elements) ───────────────────
function PaymentForm({ total, deliveryFee, folio, deliveryMethod, itemCount, onBack, upsell, refreshing }: PaymentFormProps) {
  const stripe   = useStripe()
  const elements = useElements()
  const router   = useRouter()
  const { items, clearCart } = useCart()

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
      saveOrder({ folio, timestamp: new Date().toISOString(), total: orderTotal, deliveryMethod, itemCount, deliveryFee, items: toSavedItems(items) })
      clearCart()
      router.push(`/order/${folio}?pagado=1`)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-[1.625rem] font-bold leading-none text-foreground">Pago</h2>
        <p className="text-muted text-sm mt-1.5">Tus datos están protegidos por Stripe</p>
      </div>

      {/* Stripe PaymentElement */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <PaymentElement />
      </div>

      {stripeError && (
        <p className="text-error text-xs px-1">{stripeError}</p>
      )}

      {upsell}

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
        <Button variant="ghost" onClick={onBack} disabled={submitting} className="flex-1">Atrás</Button>
        <Button onClick={handlePay} disabled={submitting || !stripe || refreshing} className="flex-1">
          {submitting ? 'Procesando...' : refreshing ? 'Actualizando total…' : `Pagar $${orderTotal}`}
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
  const [coords, setCoords]           = useState<{ lat: number; lng: number } | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [isDemoMode, setIsDemoMode]   = useState(false)
  const [folio, setFolio]             = useState<string>('')
  const [creatingIntent, setCreatingIntent] = useState(false)
  const [intentAmount, setIntentAmount] = useState<number | null>(null)
  const [sheetProduct, setSheetProduct] = useState<Product | null>(null)

  const selectedMethod = ordersData.deliveryMethods.find(m => m.id === deliveryMethod)!
  const orderTotal = total + selectedMethod.price

  const patchField = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm(f => ({ ...f, [key]: e.target.value }))
      if (errors[key]) setErrors(err => ({ ...err, [key]: undefined }))
    }

  // Cuando el usuario escribe manualmente en el campo dirección
  const handleAddressChange = (value: string) => {
    setForm(f => ({ ...f, address: value }))
    setCoords(null) // limpiar coords hasta que seleccione una sugerencia
    if (errors.address) setErrors(err => ({ ...err, address: undefined }))
  }

  // Cuando el usuario selecciona una sugerencia del autocomplete
  const handleAddressSelect = (address: string, lat: number, lng: number) => {
    setForm(f => ({ ...f, address }))
    setCoords({ lat, lng })
    if (errors.address) setErrors(err => ({ ...err, address: undefined }))
  }

  // Limpiar coords si cambia el método de entrega
  const handleDeliveryChange = (id: DeliveryMethodId) => {
    setDelivery(id)
    if (id !== 'delivery') setCoords(null)
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
      const amount = orderTotal
      const data = await requestIntent(newFolio, amount)

      setFolio(newFolio)
      setClientSecret(data.clientSecret)
      setIsDemoMode(!!data.demo)
      setIntentAmount(amount)
      setStep('payment')
    } catch (err) {
      console.error(err)
      setErrors({ name: 'Error al conectar con el servidor de pagos. Intenta de nuevo.' })
    } finally {
      setCreatingIntent(false)
    }
  }

  /** Crea el Payment Intent con el carrito y datos actuales */
  async function requestIntent(intentFolio: string, amount: number): Promise<{ clientSecret: string; demo?: boolean }> {
      const res = await fetch('/api/checkout/payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          folio:  intentFolio,
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
      return data
  }

  // Si el total cambia en el paso de pago (p. ej. "¿Te falta algo?"), el Payment
  // Intent de Stripe quedó con el monto anterior: se crea uno nuevo con el total
  // actual y se bloquea el botón de pago mientras tanto.
  const intentStale = step === 'payment' && !isDemoMode && intentAmount !== null && intentAmount !== orderTotal
  useEffect(() => {
    if (!intentStale) return
    let cancelled = false
    const amount = orderTotal
    const t = setTimeout(() => {
      requestIntent(folio, amount)
        .then(data => {
          if (cancelled) return
          setClientSecret(data.clientSecret)
          setIntentAmount(amount)
        })
        .catch(err => console.error('No se pudo actualizar el cobro', err))
    }, 400)
    return () => { cancelled = true; clearTimeout(t) }
    // requestIntent lee el carrito/form actuales; basta con reaccionar al total
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentStale, orderTotal, folio])

  const upsell = <Upsell onOpenProduct={setSheetProduct} />

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

      {/* key={step} re-monta el contenido y dispara la transición en cada paso */}
      <div key={step} className="animate-fade-up">
        {step === 'review' && (
          <StepReview onNext={() => setStep('delivery')} />
        )}
        {step === 'delivery' && (
          <StepDelivery
            selected={deliveryMethod}
            onSelect={handleDeliveryChange}
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
            onAddressChange={handleAddressChange}
            onAddressSelect={handleAddressSelect}
            coords={coords}
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
              deliveryMethod={deliveryMethod}
              itemCount={items.reduce((s, i) => s + i.quantity, 0)}
              onBack={() => setStep('customer')}
              upsell={upsell}
            />
          ) : (
            <Elements
              key={clientSecret}
              stripe={stripePromise}
              options={{ clientSecret, appearance: stripeAppearance }}
            >
              <PaymentForm
                total={total}
                deliveryFee={selectedMethod.price}
                folio={folio}
                deliveryMethod={deliveryMethod}
                itemCount={items.reduce((s, i) => s + i.quantity, 0)}
                onBack={() => setStep('customer')}
                upsell={upsell}
                refreshing={intentStale}
              />
            </Elements>
          )
        )}
      </div>

      {/* Sheet para recomendaciones con variantes obligatorias (p. ej. refresco) */}
      <ProductSheet product={sheetProduct} onClose={() => setSheetProduct(null)} />
    </div>
  )
}
