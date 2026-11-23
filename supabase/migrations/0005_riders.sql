-- Vaquero's — repartidores
-- Agrega rol al equipo (admin | rider) y asigna pedidos a un repartidor.
--   * admin: ve todo /admin, asigna repartidores (comportamiento de siempre).
--   * rider: solo ve y actualiza SUS pedidos asignados (/repartidor).
-- Para dar de alta un repartidor: crear el usuario en Supabase → Authentication
-- y luego: insert into public.staff (user_id, name, role) values ('<uuid>', 'Nombre', 'rider');
-- Idempotente: se puede volver a correr.

alter table public.staff add column if not exists role text not null default 'admin';
alter table public.staff drop constraint if exists staff_role_check;
alter table public.staff add constraint staff_role_check check (role in ('admin','rider'));

alter table public.orders add column if not exists rider_id uuid references public.staff (user_id) on delete set null;
create index if not exists orders_rider_idx on public.orders (rider_id) where rider_id is not null;

-- is_staff() pasa a significar "administrador" (las políticas existentes lo usan)
create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.staff where user_id = auth.uid() and role = 'admin') $$;

create or replace function public.is_rider()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.staff where user_id = auth.uid() and role = 'rider') $$;

grant execute on function public.is_rider() to authenticated;
revoke execute on function public.is_rider() from anon;

-- El admin ve a todo el equipo (para elegir repartidor)
drop policy if exists "admin ve el equipo" on public.staff;
create policy "admin ve el equipo" on public.staff
  for select to authenticated using (public.is_staff());

-- Repartidor: lee y actualiza solo los pedidos pagados que le asignaron
drop policy if exists "repartidor lee sus pedidos" on public.orders;
create policy "repartidor lee sus pedidos" on public.orders
  for select to authenticated
  using (public.is_rider() and rider_id = auth.uid() and paid_at is not null);

drop policy if exists "repartidor actualiza sus pedidos" on public.orders;
create policy "repartidor actualiza sus pedidos" on public.orders
  for update to authenticated
  using (public.is_rider() and rider_id = auth.uid() and paid_at is not null)
  with check (public.is_rider() and rider_id = auth.uid() and paid_at is not null);

grant update (rider_id) on public.orders to authenticated;

create or replace function public.orders_guard_status()
returns trigger
language plpgsql
as $$
declare
  allowed boolean;
  rider_changed boolean := (new.rider_lat, new.rider_lng, new.rider_at)
                           is distinct from (old.rider_lat, old.rider_lng, old.rider_at);
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
    -- Un repartidor solo puede marcar como entregado lo que va en camino
    if auth.uid() is not null and not public.is_staff() and not (old.status = 'ready' and new.status = 'delivered') then
      raise exception 'Solo puedes marcar como entregado un pedido en camino' using errcode = 'check_violation';
    end if;
  end if;

  -- Asignación: solo a repartidores, solo en domicilio, y no en pedidos cerrados
  if new.rider_id is distinct from old.rider_id and new.rider_id is not null then
    if new.delivery_method <> 'delivery' or new.status in ('delivered','cancelled') then
      raise exception 'El pedido % no admite repartidor', old.id using errcode = 'check_violation';
    end if;
    if not exists (select 1 from public.staff where user_id = new.rider_id and role = 'rider') then
      raise exception 'Repartidor inválido' using errcode = 'check_violation';
    end if;
    -- Cambiar de repartidor borra la ubicación del anterior
    new.rider_lat := null; new.rider_lng := null; new.rider_at := null;
    rider_changed := false;
  end if;

  -- Ubicación: solo en envíos a domicilio que van en camino (o para borrarla)
  if rider_changed and new.rider_lat is not null then
    if new.delivery_method <> 'delivery' or new.status <> 'ready' then
      raise exception 'El pedido % no va en camino', old.id using errcode = 'check_violation';
    end if;
    if new.rider_lat not between -90 and 90 or new.rider_lng not between -180 and 180 then
      raise exception 'Ubicación inválida' using errcode = 'check_violation';
    end if;
  end if;

  -- Al entregar o cancelar, se borra la ubicación (privacidad del repartidor)
  if new.status in ('delivered','cancelled') then
    new.rider_lat := null;
    new.rider_lng := null;
    new.rider_at  := null;
  end if;

  if new.status is distinct from old.status or new.rider_id is distinct from old.rider_id or not rider_changed then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end $$;
