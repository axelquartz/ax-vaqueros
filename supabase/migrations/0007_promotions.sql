-- Vaquero's — promociones y cupones
--   * promotions: sin `code` se aplica sola; con `code` el cliente lo escribe en el checkout.
--   * orders: guarda el descuento aplicado (total = subtotal - descuento + envío).
-- Solo el equipo lee/escribe promotions (los códigos no son públicos); el servidor las
-- evalúa con la clave secreta. Idempotente: se puede volver a correr.

create table if not exists public.promotions (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 60),
  kind         text not null check (kind in ('percent','amount')),
  value        integer not null check (value > 0 and value <= 100000),
  scope        text not null default 'order' check (scope in ('order','category','product')),
  target       text,                                   -- id de categoría o producto según scope
  code         text check (code is null or code ~ '^[A-Z0-9]{3,20}$'),
  min_subtotal integer not null default 0 check (min_subtotal >= 0),
  days         smallint[],                             -- 0=domingo … 6=sábado; null = todos
  start_time   time,                                   -- null = todo el día
  end_time     time,
  starts_on    date,
  ends_on      date,
  max_uses     integer check (max_uses is null or max_uses > 0),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  check (kind <> 'percent' or value <= 100),
  check (scope = 'order' or target is not null)
);
create unique index if not exists promotions_code_idx on public.promotions (code) where code is not null;

alter table public.promotions enable row level security;
drop policy if exists "staff gestiona promociones" on public.promotions;
create policy "staff gestiona promociones" on public.promotions
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

grant select, insert, update, delete on public.promotions to authenticated, service_role;

alter table public.orders add column if not exists discount   integer not null default 0 check (discount >= 0);
alter table public.orders add column if not exists promo_id   uuid;
alter table public.orders add column if not exists promo_name text;

-- El total ahora descuenta la promoción
do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.orders'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%subtotal + delivery_fee%'
  loop
    execute format('alter table public.orders drop constraint %I', c);
  end loop;
end $$;
alter table public.orders drop constraint if exists orders_total_discount_check;
alter table public.orders add constraint orders_total_discount_check
  check (discount <= subtotal and total = subtotal - discount + delivery_fee);
