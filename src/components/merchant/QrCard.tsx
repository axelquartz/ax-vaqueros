'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import QRCode from 'qrcode'
import business from '@/data/business.json'

const field = 'min-h-11 w-full rounded-lg border border-border bg-elevated px-3 text-foreground text-sm'

/** Cartel con el QR general del sitio: se descarga o se imprime para el local, flyers y redes */
export function QrCard() {
  // Por defecto, el dominio desde el que se abre el panel (producción en producción)
  const origin = useSyncExternalStore(() => () => {}, () => window.location.origin, () => '')
  const [custom, setCustom] = useState<string | null>(null)
  const url = custom ?? origin
  const [svg, setSvg] = useState('')
  const [error, setError] = useState(false)

  const target = url.trim() ? `${url.trim().replace(/\/+$/, '')}/?ref=qr` : ''

  useEffect(() => {
    if (!target) return
    let cancelled = false
    QRCode.toString(target, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#111111', light: '#ffffff' } })
      .then(s => { if (!cancelled) { setSvg(s); setError(false) } })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [target])

  async function downloadPng() {
    const dataUrl = await QRCode.toDataURL(target, { width: 1200, margin: 2, errorCorrectionLevel: 'M' })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = 'qr-vaqueros.png'
    a.click()
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="print:hidden">
        <h1 className="font-display text-[1.625rem] font-bold leading-none text-foreground">QR</h1>
        <p className="text-muted text-sm mt-1.5">Un solo QR para tu menú. Imprímelo para el local, mesas, empaques o flyers; al escanearlo abre tu página de pedidos.</p>
      </div>

      <label className="block space-y-1.5 print:hidden">
        <span className="text-sm text-secondary">Dirección a la que lleva</span>
        <input className={field} value={url} onChange={e => setCustom(e.target.value)} inputMode="url" autoCapitalize="none" placeholder="https://tu-sitio.com" />
      </label>

      <div className="mx-auto w-full max-w-sm rounded-2xl bg-white p-6 text-center text-neutral-900 shadow-lg print:shadow-none">
        <p className="font-display text-2xl font-bold leading-none">{business.name}</p>
        <p className="mt-1.5 text-sm text-neutral-600">Escanea y pide desde tu celular</p>
        {svg
          ? <div role="img" aria-label="Código QR del menú" className="mx-auto mt-4 aspect-square w-full max-w-[16rem] [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />
          : <div className="mx-auto mt-4 aspect-square w-full max-w-[16rem] rounded-lg bg-neutral-100" />}
        <p className="mt-3 text-xs text-neutral-500 break-all">{url.replace(/^https?:\/\//, '').replace(/\/+$/, '')}</p>
      </div>
      {error && <p role="alert" className="text-error text-sm text-center">No se pudo generar el QR. Revisa la dirección.</p>}

      <div className="flex gap-3 print:hidden">
        <button type="button" disabled={!svg} onClick={() => void downloadPng()}
          className="flex-1 min-h-12 rounded-lg bg-brand text-inverse font-semibold disabled:opacity-50">Descargar PNG</button>
        <button type="button" disabled={!svg} onClick={() => window.print()}
          className="flex-1 min-h-12 rounded-lg border border-border text-foreground font-medium hover:bg-overlay disabled:opacity-50">Imprimir</button>
      </div>
    </div>
  )
}
