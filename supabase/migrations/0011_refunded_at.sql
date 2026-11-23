-- Vaquero's — marca de pedido reembolsado (para que el dashboard no lo cuente como venta).
-- Solo la escribe el servidor al aprobar un reembolso. Idempotente.

alter table public.orders add column if not exists refunded_at timestamptz;
