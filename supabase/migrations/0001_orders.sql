-- Vaquero's — pedidos
-- Ejecutar una vez en Supabase → SQL Editor. Es idempotente: se puede volver a correr.
--
-- Modelo de acceso:
--   * Clientes (anónimos): NO leen ni escriben la tabla directamente. El
--     servidor (clave secreta) crea el pedido al confirmarse el pago y expone
--     el estatus por una API que pide folio + token del pedido.
--   * Equipo del restaurante: usuarios de Supabase Auth registrados en `staff`.
--     Pueden ver los pedidos (con Realtime) y avanzar su estatus.
--   * Las transiciones de estatus se validan en la base de datos, igual que
--     en src/lib/orders/status.ts, aunque alguien llame a la API directo.

create extension if not exists pgcrypto;

-- ── Equipo ───────────────────────────────────────────────────────────────
create table if not exists public.staff (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text not null default '',
  created_at timestamptz not null default now()
);
alter table public.staff enable row level security;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.staff where user_id = auth.uid()) $$;

drop policy if exists "staff ve su propio registro" on public.staff;
create policy "staff ve su propio registro" on public.staff
  for select to authenticated using (user_id = auth.uid());

-- ── Pedidos ──────────────────────────────────────────────────────────────
create table if not exists public.orders (
  id                text primary key,                       -- folio, p. ej. ORD-1234
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  status            text not null default 'pending'
                    check (status in ('pending','confirmed','preparing','ready','delivered','cancelled')),
  delivery_method   text not null check (delivery_method in ('pickup','table','delivery')),
  customer          jsonb not null,                         -- {name, phone, address?, tableNumber?, notes}
  items             jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0),
  subtotal          integer not null check (subtotal >= 0), -- pesos MXN enteros
  delivery_fee      integer not null default 0 check (delivery_fee >= 0),
  total             integer not null check (total = subtotal + delivery_fee),
  payment_intent_id text unique,                            -- idempotencia del webhook de Stripe
  access_token      uuid not null default gen_random_uuid() -- para que el cliente consulte su pedido
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_active_idx on public.orders (status)
  where status in ('pending','confirmed','preparing','ready');

alter table public.orders enable row level security;

drop policy if exists "staff lee pedidos" on public.orders;
create policy "staff lee pedidos" on public.orders
  for select to authenticated using (public.is_staff());

drop policy if exists "staff actualiza pedidos" on public.orders;
create policy "staff actualiza pedidos" on public.orders
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
-- Sin políticas de insert/delete: solo el servidor (clave secreta) crea pedidos.

-- El equipo solo puede cambiar el estatus; el resto del pedido es inmutable.
revoke update on public.orders from anon, authenticated;
grant  update (status) on public.orders to authenticated;
revoke all on public.orders from anon;

-- ── Reglas de estatus ────────────────────────────────────────────────────
create or replace function public.orders_guard_status()
returns trigger
language plpgsql
as $$
declare
  allowed boolean;
begin
  if new.status is distinct from old.status then
    allowed := case
      when new.status = 'cancelled' then old.status in ('pending','confirmed','preparing')
      else (old.status, new.status) in (
        ('pending','confirmed'), ('confirmed','preparing'),
        ('preparing','ready'),   ('ready','delivered'))
    end;
    if not allowed then
      raise exception 'Transición no permitida: % → %', old.status, new.status
        using errcode = 'check_violation';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists orders_guard_status on public.orders;
create trigger orders_guard_status
  before update on public.orders
  for each row execute function public.orders_guard_status();

-- ── Tiempo real para el panel ────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
