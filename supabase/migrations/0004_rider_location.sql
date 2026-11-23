-- Vaquero's — ubicación del repartidor (envíos a domicilio)
-- El repartidor (usuario del equipo) comparte su GPS desde el panel mientras
-- el pedido va en camino; el cliente lo ve en el mapa de su pedido.
-- Idempotente: se puede volver a correr.

alter table public.orders add column if not exists rider_lat double precision;
alter table public.orders add column if not exists rider_lng double precision;
alter table public.orders add column if not exists rider_at  timestamptz;

-- El equipo puede escribir la ubicación (además del estatus). Las políticas
-- existentes ya limitan a staff y a pedidos pagados.
grant update (rider_lat, rider_lng, rider_at) on public.orders to authenticated;

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

  -- updated_at marca el último cambio de estatus/datos, no cada punto de GPS
  if new.status is distinct from old.status or not rider_changed then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end $$;
