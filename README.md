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
| `/admin` | Panel del restaurante: gestión de pedidos y dashboard de desempeño (usuarios del equipo) |

## Variables de entorno

En `.env.local` para desarrollo y en Netlify (Project configuration → Environment variables) para producción.

> **Importante:** en Netlify el servidor recibe las variables al publicar. Después de crear o cambiar una variable hay que volver a publicar (Deploys → Trigger deploy → Deploy site); si no, el sitio sigue con los valores anteriores.

| Variable | Para qué |
|---|---|
| `STRIPE_SECRET_KEY` | Crear cobros en el servidor. Sin ella, el checkout funciona en modo demo (sin cobro). |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Formulario de pago de Stripe en el navegador. |
| `STRIPE_WEBHOOK_SECRET` | Verificar la firma de los avisos de Stripe en `/api/webhooks/stripe`. |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave publicable (`sb_publishable_…`). Pública por diseño: las reglas RLS protegen los datos. |
| `SUPABASE_SECRET_KEY` | Clave secreta (`sb_secret_…`), solo servidor: crea pedidos y confirma pagos. **Nunca** en el navegador ni en el chat. |

Sin las variables de Supabase la app funciona como demo: pedidos en el navegador y panel abierto en desarrollo (cerrado en producción).

## Reglas del negocio en el servidor

- **Precios:** el servidor recalcula el total con el menú (`src/lib/pricing.ts`); nunca confía en montos del navegador.
- **Horario:** fuera del horario de `src/data/hours.json` la API de pago rechaza el pedido (409).

## Datos

- Menú, horario y configuración: JSON en `src/data/`.
- Pedidos: Supabase (`supabase/migrations/`, se ejecutan en orden en el SQL Editor).

### Cómo viaja un pedido

1. **Paso de pago:** `/api/checkout/payment-intent` calcula el total, guarda el pedido **sin pagar** con un folio generado por el servidor y una llave privada (`access_token`), y crea el cobro en Stripe.
2. **Pago:** el pedido se marca pagado con lo que llegue primero: el aviso de Stripe (`/api/webhooks/stripe`) o el navegador al volver del pago (`POST /api/orders/[folio]`, que verifica el cobro con Stripe). Ambos son idempotentes y comprueban monto y folio.
3. **Cliente:** `/order/[folio]` consulta `GET /api/orders/[folio]` con la llave (header `x-order-token`) cada 10 s hasta que el pedido termina.
4. **Panel:** el equipo (usuarios de Supabase Auth en la tabla `staff`) ve solo pedidos pagados, en tiempo real, y solo puede cambiar el estatus. La base de datos valida las transiciones.

### Agregar a alguien al equipo

1. Supabase → Authentication → Users → **Add user** (correo y contraseña, con "Auto Confirm User").
2. SQL Editor: `insert into staff (user_id, name) select id, 'Nombre' from auth.users where email = 'correo@ejemplo.com';`

### Pendiente

- Limpiar borradores sin pagar viejos (p. ej. una tarea programada que borre los de más de 24 h).
- Seguimiento del repartidor en el mapa (hoy es simulado).
