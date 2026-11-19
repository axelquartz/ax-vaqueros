# Directivas Operativas — Boutique AX (Producto 1: Vaquero's)

## Contexto del Proyecto

- **Producto:** Sistema de Pedidos y Menú Digital (Producto 1 - Demo Viva Vaquero's).
- **Enfoque:** Mobile-first, alta velocidad, estética Quiet Luxury (tema oscuro, limpio, sin ruido visual).
- **Stack:** Next.js (App Router), Tailwind CSS, TypeScript.

## Reglas de Arquitectura y Temas

- **Tokens Semánticos:** Definir la paleta de colores y tipografía mediante variables CSS en `globals.css` y `tailwind.config.js` (colores de marca, bordes y fondos).
- **Datos Iniciales:** Operar 100% con datos mock/hardcoded en JSON local antes de conectar cualquier base de datos.

## Componentes Requeridos para el Flujo del Pedido

1. `ProductCard`: Tarjeta de producto limpia con selector de variante/cantidad.
2. `CartDrawer`: Barra persistente inferior, no bloqueante, expandible.
3. `CheckoutFlow`: Stepper multi-paso — datos de cliente → método de entrega → pago → confirmación.
4. `OrderStatus`: Pantalla de confirmación con folio, estatus en tiempo real y mapa de seguimiento.
5. `MerchantPanel`: Vista básica de administración de pedidos entrantes.

## Próximas Integraciones

### Pasarela de Pagos
- Rediseñar `CheckoutFlow` como stepper antes de integrar.
- Candidatos: **Stripe** (recomendado), Conekta (OXXO), MercadoPago (LATAM).

### Mapa de Seguimiento (`OrderMap`)
- Mostrar mapa solo cuando `deliveryMethod === 'delivery'`.
- Para pedidos en mostrador/mesa: mostrar solo progreso de estatus en texto.
- Librería candidata: **Mapbox GL JS** o Google Maps SDK.
- Seguimiento en tiempo real requiere WebSockets o polling — depende de backend real.
- Por ahora: placeholder de mapa + simulación de movimiento con datos mock.

## Dependencias de Backend (futuras)
- Base de datos real (Supabase o similar) para pedidos persistentes.
- WebSockets para estatus en tiempo real (repartidor + cocina).
- GPS del repartidor para mapa live.
