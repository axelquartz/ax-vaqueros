-- Vaquero's — costo de envío por distancia (se define desde /admin/envio)
-- delivery_tiers: [{"km": 3, "fee": 35}, {"km": 5, "fee": 45}, ...] ordenado por km.
-- El tramo más lejano es el límite de cobertura. Por defecto: 8 km a $45 (igual que el envío fijo anterior).
-- Idempotente: se puede volver a correr.

alter table public.store_settings
  add column if not exists delivery_tiers jsonb not null default '[{"km": 8, "fee": 45}]'::jsonb;

alter table public.store_settings drop constraint if exists store_settings_delivery_tiers_check;
alter table public.store_settings add constraint store_settings_delivery_tiers_check
  check (jsonb_typeof(delivery_tiers) = 'array' and jsonb_array_length(delivery_tiers) between 1 and 10);

grant update (delivery_tiers) on public.store_settings to authenticated;
