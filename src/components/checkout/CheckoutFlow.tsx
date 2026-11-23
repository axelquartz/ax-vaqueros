'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CardPayment, initMercadoPago } from '@mercadopago/sdk-react'
import { Input, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useCart } from '@/context/CartContext'
import ordersData from '@/data/orders.json'
import { rememberOrderToken, saveOrder } from '@/lib/orderHistory'
import { ORDER_TOKEN_HEADER, type CustomerOrderResponse } from '@/lib/orders/customerApi'
import { getOrderRepository } from '@/lib/orders/repository'
import { isStoreOpen, getStoreStatusText } from '@/lib/storeHours'
import dynamic from 'next/dynamic'
import { AddressAutocomplete } from '@/components/checkout/AddressAutocomplete'
import { Upsell } from '@/components/checkout/Upsell'
import { ProductSheet } from '@/components/menu/ProductSheet'
import type { Product } from '@/types/menu'
import type { CartItem } from '@/types/cart'
import type { Order } from '@/types/order'
const CheckoutMap = dynamic(
  () => import('@/components/checkout/CheckoutMap').then(m => m.CheckoutMap),
  { ssr: false }
)

// ─── Mercado Pago ─────────────────────────────────────────
const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY
if (typeof window !== 'undefined' && MP_PUBLIC_KEY) initMercadoPago(MP_PUBLIC_KEY, { locale: 'es-MX' })

/** Formulario de tarjeta con la paleta de la marca (tema oscuro) */
const mpCustomization = {
  paymentMethods: { maxInstallments: 1 },
  visual: {
    style: {
      theme: 'dark' as const,
      customVariables: {
        baseColor:            '#C49B6C',
        baseColorFirstVariant: '#B08758',
        baseColorSecondVariant: '#9A7448',
        formBackgroundColor:  '#1D1814',
        inputBackgroundColor: '#28211B',
        textPrimaryColor:     '#F2EADD',
        textSecondaryColor:   '#B4A691',
        outlinePrimaryColor:  '#352D25',
        outlineSecondaryColor: '#C49B6C',
        buttonTextColor:      '#14100D',
        errorColor:           '#DE6A55',
        borderRadiusMedium:   '12px',
        borderRadiusLarge:    '12px',
      },
    },
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
function StepReview({ onNext, upsell }: { onNext: () => void; upsell?: React.ReactNode }) {
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
      {/* "¿Te falta algo?" mientras todavía arma su pedido: así el total ya es
          el final al llegar al pago (no hay que recalcular el cobro) */}
      {open && upsell}

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
  /** Llave privada del pedido guardado (con Supabase) */
  accessToken?: string
  onBack: () => void
  /** Cobro aprobado (o pendiente de revisión del banco): registrar y navegar */
  onPaid: (result?: { pending: boolean }) => void | Promise<void>
}

function Breakdown({ total, deliveryFee }: { total: number; deliveryFee: number }) {
  return (
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
        <span className="text-foreground">${total + deliveryFee}</span>
      </div>
    </div>
  )
}

// ─── Step 4: Pago demo (sin Mercado Pago) ────────────────
function DemoPaymentForm({ total, deliveryFee, onBack, onPaid }: PaymentFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const orderTotal = total + deliveryFee

  const handlePay = async () => {
    setSubmitting(true)
    await new Promise(r => setTimeout(r, 900))
    onPaid()
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-[1.625rem] font-bold leading-none text-foreground">Pago</h2>
        <p className="text-muted text-sm mt-1.5">Pago seguro con Mercado Pago</p>
      </div>

      {/* Aviso modo demo */}
      <div className="bg-warning/10 border border-warning/30 rounded-xl px-4 py-3">
        <p className="text-warning text-xs font-medium">Modo demo activo</p>
        <p className="text-muted text-sm mt-1.5">
          Configura las credenciales de Mercado Pago para habilitar pagos reales.
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


      <Breakdown total={total} deliveryFee={deliveryFee} />

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack} disabled={submitting} className="flex-1">Atrás</Button>
        <Button onClick={handlePay} disabled={submitting} className="flex-1">
          {submitting ? 'Procesando...' : `Simular pago de $${orderTotal}`}
        </Button>
      </div>
    </div>
  )
}

// ─── Step 4: Pago con Mercado Pago ───────────────────────
function PaymentForm({ total, deliveryFee, folio, accessToken, onBack, onPaid }: PaymentFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const orderTotal = total + deliveryFee

  // El Brick llama a esto con la tarjeta tokenizada (los datos de la tarjeta
  // nunca pasan por nuestro servidor). Rechazar la promesa le indica al Brick
  // que el pago falló para que el cliente pueda corregir y reintentar.
  const handleSubmit = async (form: unknown) => {
    setError(null)
    const res = await fetch('/api/checkout/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [ORDER_TOKEN_HEADER]: accessToken ?? '' },
      body: JSON.stringify({ folio, form }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error ?? 'No se pudo procesar el pago. Intenta de nuevo.')
      throw new Error(data.error)
    }
    await onPaid({ pending: data.status === 'pending' })
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-[1.625rem] font-bold leading-none text-foreground">Pago</h2>
        <p className="text-muted text-sm mt-1.5">Pago seguro con Mercado Pago</p>
      </div>

      <Breakdown total={total} deliveryFee={deliveryFee} />

      {!ready && <p className="text-muted text-sm px-1">Cargando formulario de pago…</p>}
      <div className="rounded-xl overflow-hidden">
        <CardPayment
          initialization={{ amount: orderTotal }}
          customization={mpCustomization}
          locale="es-MX"
          onSubmit={handleSubmit}
          onReady={() => setReady(true)}
          onError={err => console.error('Mercado Pago Brick:', err)}
        />
      </div>

      {error && <p role="alert" className="text-error text-sm px-1">{error}</p>}

      <Button variant="ghost" fullWidth onClick={onBack}>Atrás</Button>
    </div>
  )
}

interface IntentResult {
  amount: number
  folio: string
  accessToken?: string
  demo: boolean
}

// ─── Main ─────────────────────────────────────────────────
export function CheckoutFlow() {
  const { items, total, clearCart } = useCart()
  const router = useRouter()

  const [step, setStep]               = useState<StepId>('review')
  const [deliveryMethod, setDelivery] = useState<DeliveryMethodId>('pickup')
  const [form, setForm]               = useState<FormState>({ name: '', phone: '', address: '', tableNumber: '', notes: '' })
  const [errors, setErrors]           = useState<Partial<FormState>>({})
  const [coords, setCoords]           = useState<{ lat: number; lng: number } | null>(null)
  const [isDemoMode, setIsDemoMode]   = useState(false)
  const [folio, setFolio]             = useState<string>('')
  /** Llave privada del pedido guardado en el servidor (solo con Supabase) */
  const [accessToken, setAccessToken] = useState<string | undefined>()
  const [creatingIntent, setCreatingIntent] = useState(false)
  const [intentAmount, setIntentAmount] = useState<number | null>(null)
  const [sheetProduct, setSheetProduct] = useState<Product | null>(null)
  /** Pago hecho: mientras se abre la confirmación, no volver a pintar el pago con el carrito vacío */
  const [leaving, setLeaving]         = useState(false)

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
      const amount = orderTotal
      // Volver al paso de datos y regresar reutiliza el mismo pedido
      const data = await requestIntent(accessToken ? { folio, accessToken } : undefined, amount)

      applyIntent(data)
      setIsDemoMode(data.demo)
      setIntentAmount(amount)
      setStep('payment')
    } catch (err) {
      console.error(err)
      setErrors({ name: err instanceof Error && err.message ? err.message : 'Error al conectar con el servidor de pagos. Intenta de nuevo.' })
    } finally {
      setCreatingIntent(false)
    }
  }

  /** El servidor asigna el folio; la llave se guarda antes de pagar (para consultar el pedido después) */
  function applyIntent(data: IntentResult) {
    setFolio(data.folio)
    setAccessToken(data.accessToken)
    if (data.accessToken) rememberOrderToken(data.folio, data.accessToken)
  }

  /** Crea (o actualiza) el pedido guardado con el carrito y datos actuales */
  async function requestIntent(draft: { folio: string; accessToken: string } | undefined, expectedAmount: number): Promise<IntentResult> {
      // Solo se envía QUÉ se pidió; el servidor calcula el total con el menú
      const res = await fetch('/api/checkout/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft,
          deliveryMethod,
          customer: {
            name:        form.name,
            phone:       form.phone,
            address:     form.address     || undefined,
            tableNumber: form.tableNumber || undefined,
            notes:       form.notes       || undefined,
            ...(deliveryMethod === 'delivery' && coords ? coords : {}),
          },
          items: items.map(i => ({
            productId:        i.productId,
            quantity:         i.quantity,
            selectedVariants: i.selectedVariants,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo preparar el pago')
      // Nunca cobrar un monto distinto al que el cliente está viendo
      if (data.amount !== expectedAmount) {
        throw new Error('Los precios de tu pedido cambiaron. Revisa el resumen e intenta de nuevo.')
      }
      return data
  }

  const upsell = <Upsell onOpenProduct={setSheetProduct} />

  /** Pago confirmado: registra el pedido (le llega al panel), lo guarda en el dispositivo y navega */
  const completeOrder = async (result?: { pending: boolean }) => {
    const now = new Date().toISOString()
    let order: Order = {
      id: folio,
      createdAt: now,
      updatedAt: now,
      status: 'pending',
      deliveryMethod,
      customer: {
        name:        form.name.trim(),
        phone:       form.phone.trim(),
        address:     deliveryMethod === 'delivery' ? form.address.trim() : undefined,
        tableNumber: deliveryMethod === 'table' ? form.tableNumber.trim() : undefined,
        notes:       form.notes.trim(),
        ...(deliveryMethod === 'delivery' && coords ? coords : {}),
      },
      items: items.map(i => ({
        productId: i.productId,
        name:      i.name,
        quantity:  i.quantity,
        unitPrice: i.unitPrice + i.variantExtra,
        variants:  i.variantLabels,
        subtotal:  i.subtotal,
      })),
      subtotal:    total,
      deliveryFee: selectedMethod.price,
      total:       orderTotal,
    }

    if (accessToken) {
      // Con Supabase el pedido ya está guardado: el servidor confirma el pago
      // (con Mercado Pago, o directo en modo demo). Si no responde, la
      // pantalla de estatus lo vuelve a intentar sola.
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(folio)}`, {
          method: 'POST',
          headers: { [ORDER_TOKEN_HEADER]: accessToken },
        })
        if (res.ok) order = ((await res.json()) as CustomerOrderResponse).order
      } catch (err) {
        console.error('No se pudo confirmar el pedido; la pantalla de estatus reintentará', err)
      }
    } else {
      getOrderRepository().create(order)
    }

    saveOrder({
      folio, timestamp: order.createdAt, total: order.total, deliveryMethod,
      itemCount: order.items.reduce((n, i) => n + i.quantity, 0),
      deliveryFee: order.deliveryFee, items: toSavedItems(items),
      accessToken,
    })
    setLeaving(true)
    clearCart()
    // Pago en revisión del banco: sin animación de éxito; la pantalla avisa cuando se confirme
    router.push(result?.pending ? `/order/${folio}` : `/order/${folio}?pagado=1`)
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

      {/* key={step} re-monta el contenido y dispara la transición en cada paso */}
      <div key={step} className="animate-fade-up">
        {step === 'review' && (
          <StepReview onNext={() => setStep('delivery')} upsell={upsell} />
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
        {step === 'payment' && leaving && (
          <p role="status" className="text-secondary text-sm text-center py-16">Pago listo. Abriendo tu pedido…</p>
        )}
        {step === 'payment' && !leaving && intentAmount !== null && (
          isDemoMode ? (
            <DemoPaymentForm
              total={total}
              deliveryFee={selectedMethod.price}
              folio={folio}
              onBack={() => setStep('customer')}
              onPaid={completeOrder}
            />
          ) : (
            <PaymentForm
              // Nuevo formulario si cambia el pedido (folio o total)
              key={`${folio}-${intentAmount}`}
              total={total}
              deliveryFee={selectedMethod.price}
              folio={folio}
              accessToken={accessToken}
              onBack={() => setStep('customer')}
              onPaid={completeOrder}
            />
          )
        )}
      </div>

      {/* Sheet para recomendaciones con variantes obligatorias (p. ej. refresco) */}
      <ProductSheet product={sheetProduct} onClose={() => setSheetProduct(null)} />
    </div>
  )
}
