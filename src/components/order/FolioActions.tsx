'use client'

import { useState } from 'react'

export function FolioActions({ folio }: { folio: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(folio)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const share = async () => {
    if (navigator.share) {
      await navigator.share({
        title: "Folio Vaquero's",
        text:  `Mi folio de pedido es ${folio}`,
      }).catch(() => null)
    } else {
      await copy()
    }
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
      {/* Recordatorio foto */}
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none mt-0.5">📸</span>
        <div>
          <p className="text-foreground text-sm font-medium">Guarda tu folio</p>
          <p className="text-muted text-xs mt-0.5 leading-relaxed">
            Toma una captura de pantalla o copia el folio para consultar tu pedido más tarde.
          </p>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex gap-2">
        <button
          onClick={copy}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border border-border bg-elevated text-secondary text-sm hover:border-border-strong hover:text-foreground transition-colors"
        >
          {copied ? '✓ Copiado' : '⎘ Copiar folio'}
        </button>
        <button
          onClick={share}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border border-brand/40 bg-brand/5 text-brand text-sm hover:bg-brand/10 transition-colors"
        >
          ↑ Compartir
        </button>
      </div>
    </div>
  )
}
