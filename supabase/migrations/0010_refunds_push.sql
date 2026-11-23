-- Vaquero's — reembolsos (solicitud del cliente, decisión manual del admin) y
-- suscripciones push. Idempotente: se puede volver a correr.

create table if not exists public.refunds (
  order_id     text primary key references public.orders (id) on delete cascade,
  status       text not null default 'requested'
               check (status in ('requested','processing','approved','rejected','failed')),
  reason       text not null check (char_length(reason) between 5 and 500),
  admin_note   text not null default '' check (char_length(admin_note) <= 500),
  mp_refund_id text,
  requested_at timestamptz not null default now(),
  resolved_at  timestamptz
);
create index if not exists refunds_status_idx on public.refunds (status, requested_at desc);

alter table public.refunds enable row level security;
drop policy if exists "staff lee reembolsos" on public.refunds;
create policy "staff lee reembolsos" on public.refunds
  for select to authenticated using (public.is_staff());
grant select on public.refunds to authenticated;
grant select, insert, update, delete on public.refunds to service_role;

create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  role       text not null check (role in ('customer','staff')),
  order_id   text references public.orders (id) on delete cascade,
  user_id    uuid,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_order_idx on public.push_subscriptions (order_id);
create index if not exists push_subs_role_idx on public.push_subscriptions (role);

-- Solo el servidor (clave secreta) lee y escribe suscripciones
alter table public.push_subscriptions enable row level security;
grant select, insert, update, delete on public.push_subscriptions to service_role;
