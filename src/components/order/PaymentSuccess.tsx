/**
 * Confirmación visual tras un pago exitoso.
 * Sutil: círculo que aparece con un rebote ligero, palomita que se dibuja
 * y una onda que se disipa una sola vez. Respeta prefers-reduced-motion
 * vía las reglas globales.
 */
export function PaymentSuccess() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center text-center pt-2 pb-1">
      <div className="relative w-16 h-16">
        <span className="absolute inset-0 rounded-full border-2 border-success animate-success-ring" aria-hidden />
        <div className="relative w-16 h-16 rounded-full bg-success/15 border border-success/40 flex items-center justify-center animate-success-pop">
          <svg viewBox="0 0 24 24" className="w-8 h-8 text-success" fill="none" aria-hidden>
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={1}
              className="animate-check-draw"
            />
          </svg>
        </div>
      </div>
      <h1 className="mt-5 font-display text-[2.125rem] font-bold leading-none text-foreground animate-fade-up [animation-delay:350ms]">
        ¡Pago confirmado!
      </h1>
      <p className="mt-2 text-secondary text-sm animate-fade-up [animation-delay:450ms]">
        Recibimos tu pedido.
      </p>
    </div>
  )
}
