-- Vaquero's — pedidos pagados
-- El servidor guarda el pedido en cuanto el cliente llega al paso de pago
-- (borrador) y lo marca pagado cuando Stripe lo confirma. El equipo solo ve
-- pedidos pagados, así que un pago abandonado nunca le llega a la cocina.
-- Idempotente: se puede volver a correr.

alter table public.orders add column if not exists paid_at timestamptz;

create index if not exists orders_unpaid_idx on public.orders (created_at) where paid_at is null;

drop policy if exists "staff lee pedidos" on public.orders;
create policy "staff lee pedidos" on public.orders
  for select to authenticated using (public.is_staff() and paid_at is not null);

drop policy if exists "staff actualiza pedidos" on public.orders;
create policy "staff actualiza pedidos" on public.orders
  for update to authenticated
  using (public.is_staff() and paid_at is not null)
  with check (public.is_staff() and paid_at is not null);

-- Un pedido sin pagar no avanza de estatus.
create or replace function public.orders_guard_status()
returns trigger
language plpgsql
as $$
declare
  allowed boolean;
begin
  if new.status is distinct from old.status then
    if old.paid_at is null then
      raise exception 'El pedido % no está pagado', old.id using errcode = 'check_violation';
    end if;
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
