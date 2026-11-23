-- Vaquero's — reseñas post-entrega
-- Una por pedido. El cliente la envía por la API del servidor (folio + llave del
-- pedido, solo si ya se entregó); el equipo las lee desde el panel.
-- Idempotente: se puede volver a correr.

create table if not exists public.reviews (
  order_id   text primary key references public.orders (id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  comment    text not null default '' check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reviews_created_idx on public.reviews (created_at desc);

alter table public.reviews enable row level security;
drop policy if exists "staff lee resenas" on public.reviews;
create policy "staff lee resenas" on public.reviews
  for select to authenticated using (public.is_staff());

grant select on public.reviews to authenticated;
grant select, insert, update, delete on public.reviews to service_role;
