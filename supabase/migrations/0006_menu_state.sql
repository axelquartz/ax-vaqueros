-- Vaquero's — control del menú desde el panel
--   * product_overrides: precio y disponibilidad ("agotado") por producto. El
--     catálogo (fotos, variantes) sigue en menu.json; esto lo ajusta al día.
--   * store_settings: pausar la recepción de pedidos (cocina saturada).
-- El menú es público (lectura sin sesión); solo el admin escribe.
-- Idempotente: se puede volver a correr.

create table if not exists public.product_overrides (
  product_id text primary key,
  price      integer check (price is null or (price >= 0 and price <= 100000)),
  available  boolean,                       -- null = usar el valor del catálogo
  updated_at timestamptz not null default now()
);
alter table public.product_overrides enable row level security;

drop policy if exists "menu publico" on public.product_overrides;
create policy "menu publico" on public.product_overrides for select to anon, authenticated using (true);
drop policy if exists "admin escribe menu" on public.product_overrides;
create policy "admin escribe menu" on public.product_overrides
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.store_settings (
  id            smallint primary key default 1 check (id = 1),
  orders_paused boolean not null default false,
  updated_at    timestamptz not null default now()
);
insert into public.store_settings (id) values (1) on conflict do nothing;
alter table public.store_settings enable row level security;

drop policy if exists "ajustes publicos" on public.store_settings;
create policy "ajustes publicos" on public.store_settings for select to anon, authenticated using (true);
drop policy if exists "admin actualiza ajustes" on public.store_settings;
create policy "admin actualiza ajustes" on public.store_settings
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

grant select on public.product_overrides, public.store_settings to anon, authenticated;
grant insert, update, delete on public.product_overrides to authenticated;
grant update (orders_paused, updated_at) on public.store_settings to authenticated;
grant select, insert, update, delete on public.product_overrides, public.store_settings to service_role;
