'use client'

import ordersData from '@/data/orders.json'

// Pasos visibles en el tracker (sin 'cancelled')
const TRACKER_STEPS = ['pending', 'confirmed', 'preparing', 'ready', 'delivered']

const STEP_META: Record<string, { label: string; icon: string }> = {
  pending:   { label: 'Recibido',   icon: '📋' },
  confirmed: { label: 'Confirmado', icon: '✓'  },
  preparing: { label: 'Preparando', icon: '👨‍🍳' },
  ready:     { label: 'Listo',      icon: '🔔' },
  delivered: { label: 'Entregado',  icon: '✓'  },
}

// Para 'delivery', el último paso se llama 'En camino' en vez de 'Listo'
const DELIVERY_OVERRIDES: Partial<Record<string, { label: string; icon: string }>> = {
  ready:     { label: 'En camino', icon: '🛵' },
  delivered: { label: 'Entregado', icon: '✓'  },
}

interface StatusTrackerProps {
  currentStatus: string
  isDelivery?: boolean
}

export function StatusTracker({ currentStatus, isDelivery = false }: StatusTrackerProps) {
  const currentIndex = TRACKER_STEPS.indexOf(currentStatus)
  if (currentStatus === 'cancelled') return null

  return (
    <div className="bg-surface border border-border rounded-xl px-4 py-5">
      <div className="flex items-start justify-between">
        {TRACKER_STEPS.map((stepId, i) => {
          const done   = i < currentIndex
          const active = i === currentIndex
          const meta   = (isDelivery ? DELIVERY_OVERRIDES[stepId] : undefined) ?? STEP_META[stepId]
          const statusConfig = ordersData.statuses.find(s => s.id === stepId)

          return (
            <div key={stepId} className="flex items-start flex-1 last:flex-none">
              {/* Paso */}
              <div className="flex flex-col items-center gap-1.5">
                <div className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm border transition-colors',
                  done   ? `bg-${statusConfig?.color ?? 'brand'}/20 border-${statusConfig?.color ?? 'brand'}/40 text-${statusConfig?.color ?? 'brand'}` : '',
                  active ? 'bg-brand/15 border-brand text-brand'           : '',
                  !done && !active ? 'bg-elevated border-border text-muted' : '',
                ].join(' ')}>
                  {done ? '✓' : meta.icon}
                </div>
                <span className={`text-center leading-tight ${
                  active ? 'text-foreground' : 'text-muted'
                } text-xs`} style={{ maxWidth: 52 }}>
                  {meta.label}
                </span>
              </div>

              {/* Línea conectora */}
              {i < TRACKER_STEPS.length - 1 && (
                <div className={[
                  'flex-1 h-px mt-4 mx-1',
                  i < currentIndex ? 'bg-brand' : 'bg-border',
                ].join(' ')} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
