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
2. `CartDrawer`: Carrito lateral/inferior fluido con desglose de totales.
3. `CheckoutFlow`: Formulario simplificado de pedido (datos de cliente + método de entrega).
4. `OrderStatus`: Pantalla de confirmación con folio de pedido y estatus en tiempo real.
5. `MerchantPanel`: Vista básica de administración de pedidos entrantes.
