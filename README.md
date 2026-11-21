# Vaquero's — Pedidos y menú digital

Producto 1 de Boutique AX. Next.js 16 (App Router, `cacheComponents`), Tailwind v4 y TypeScript. Mobile-first, tema oscuro.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # pruebas (Vitest)
npx next build     # verificar build de producción
```

## Rutas

| Ruta | Qué es |
|---|---|
| `/` | Menú y carrito |
| `/checkout` | Pedido en 4 pasos: resumen → entrega → datos → pago (Stripe) |
| `/order/[folio]` | Confirmación y estatus del pedido en vivo |
| `/pedidos` | Pedidos hechos desde este dispositivo |
| `/nosotros` | Historia, horario y mapa |
| `/admin` | Panel del restaurante: gestión de pedidos y dashboard de desempeño (requiere contraseña) |

## Variables de entorno

En `.env.local` para desarrollo y en Netlify (Site configuration → Environment variables) para producción.

| Variable | Para qué |
|---|---|
| `STRIPE_SECRET_KEY` | Crear cobros en el servidor. Sin ella, el checkout funciona en modo demo (sin cobro). |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Formulario de pago de Stripe en el navegador. |
| `STRIPE_WEBHOOK_SECRET` | Verificar la firma de los avisos de Stripe en `/api/webhooks/stripe`. |
| `ADMIN_PASSWORD` | Contraseña del panel `/admin`. **En producción, sin ella el panel queda cerrado.** En desarrollo, si no existe, el panel se abre con un aviso. |
| `ADMIN_SESSION_SECRET` | Opcional. Refuerza la firma de la sesión del panel. Cambiarla (o cambiar la contraseña) cierra todas las sesiones. |

## Reglas del negocio en el servidor

- **Precios:** el servidor recalcula el total con el menú (`src/lib/pricing.ts`); nunca confía en montos del navegador.
- **Horario:** fuera del horario de `src/data/hours.json` la API de pago rechaza el pedido (409).

## Datos (estado actual: demo sin base de datos)

- Menú, horario y configuración: JSON en `src/data/`.
- Pedidos: `src/lib/orders/repository.ts`. Hoy se guardan en el navegador (localStorage) y se sincronizan entre pestañas; **no** viajan entre dispositivos.
- El dashboard usa un año de historial de ejemplo generado en memoria (`src/lib/orders/history.ts`), que se elimina al conectar pedidos reales.

### Siguiente paso: Supabase

1. Crear una implementación de `OrderRepository` sobre Supabase (+ Realtime) y usarla en `getOrderRepository()`; los componentes no cambian.
2. Guardar el pedido en el servidor al confirmar el pago (webhook de Stripe en `/api/webhooks/stripe`), no desde el navegador.
3. Reemplazar la contraseña única de `/admin` por usuarios de Supabase Auth.
4. Quitar el historial de ejemplo.
